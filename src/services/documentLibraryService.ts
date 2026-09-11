import mammoth from 'mammoth';
import { extractPdfText } from './jarvisAttachmentService';
import { storage } from '@/lib/storage';
import { BASE } from './api';
import {
  getIndexedDbDocuments,
  getIndexedDbChunks,
  saveDocumentToIndexedDb,
  updateDocumentInclusionInDb,
  deleteDocumentFromIndexedDb,
  calculateDocumentStats,
} from './documentIndexedDb';
import type {
  LibraryDocument,
  DocumentChunk,
  DocumentRetrievalResult,
  DocumentLibraryStats,
  DocumentType,
} from '@/types';

export const SUPPORTED_DOCUMENT_EXTENSIONS = ['pdf', 'txt', 'csv', 'docx', 'md', 'json', 'log'];
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB per file
export const MAX_TOTAL_LIBRARY_BYTES = 50 * 1024 * 1024; // 50 MB total library size

export function formatDocumentSize(bytes: number): string {
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getDocumentTypeBadge(ext: string): { label: string; bg: string; text: string; border: string } {
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  switch (cleanExt) {
    case 'pdf':
      return { label: 'PDF', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' };
    case 'docx':
    case 'doc':
      return { label: 'DOCX', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' };
    case 'csv':
      return { label: 'CSV', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'txt':
    case 'md':
    case 'log':
    default:
      return { label: cleanExt.toUpperCase() || 'TXT', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
  }
}

/**
 * Validate document upload file against individual file size and format limits
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: 'No file provided.' };
  
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format ".${ext}". Supported formats: PDF, TXT, CSV, DOCX, MD, JSON, LOG.`,
    };
  }

  // 50MB upper limit per file
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${formatDocumentSize(file.size)}). Max allowed size per document is 50 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Extract raw text from PDF, DOCX, CSV, or TXT
 */
export async function extractTextFromDocument(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf') {
    const text = await extractPdfText(file);
    if (!text || !text.trim()) {
      throw new Error('No readable text found in PDF. Scanned images or password-protected PDFs are not supported.');
    }
    return text.trim();
  }

  if (ext === 'docx' || ext === 'doc') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || '';
      if (!text.trim()) {
        throw new Error('DOCX file appears to be empty or contains no extractable text.');
      }
      return text.trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse DOCX document';
      throw new Error(`Failed to extract DOCX text: ${msg}`);
    }
  }

  // TXT, CSV, MD, JSON, LOG
  const rawText = await file.text();
  if (!rawText || !rawText.trim()) {
    throw new Error('The file appears to be empty.');
  }

  return rawText.trim();
}

/**
 * Intelligent text chunker: creates 500-900 character chunks with ~120 char overlap
 * breaks cleanly on natural paragraphs, sentences, or word boundaries.
 */
export function chunkTextLocally(
  text: string,
  docId: string,
  docName: string,
  targetChunkSize = 750,
  overlapSize = 120,
): DocumentChunk[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const chunks: DocumentChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < clean.length) {
    let endIndex = startIndex + targetChunkSize;

    if (endIndex >= clean.length) {
      endIndex = clean.length;
    } else {
      const searchWindow = clean.slice(
        Math.max(startIndex + targetChunkSize - 150, startIndex),
        Math.min(startIndex + targetChunkSize + 100, clean.length),
      );

      const paragraphOffset = searchWindow.lastIndexOf('\n\n');
      const newlineOffset = searchWindow.lastIndexOf('\n');
      const sentenceOffset = searchWindow.search(/[.!?]\s+(?=[A-Z0-9"']|$)/);
      const spaceOffset = searchWindow.lastIndexOf(' ');

      if (paragraphOffset !== -1 && paragraphOffset > 50) {
        endIndex = startIndex + targetChunkSize - 150 + paragraphOffset + 2;
      } else if (sentenceOffset !== -1 && sentenceOffset > 50) {
        endIndex = startIndex + targetChunkSize - 150 + sentenceOffset + 1;
      } else if (newlineOffset !== -1 && newlineOffset > 50) {
        endIndex = startIndex + targetChunkSize - 150 + newlineOffset + 1;
      } else if (spaceOffset !== -1 && spaceOffset > 50) {
        endIndex = startIndex + targetChunkSize - 150 + spaceOffset + 1;
      }
    }

    const chunkContent = clean.slice(startIndex, endIndex).trim();
    if (chunkContent.length > 20) {
      chunks.push({
        id: `chk_${docId}_${chunkIndex}`,
        docId,
        docName,
        chunkIndex,
        text: chunkContent,
        charCount: chunkContent.length,
      });
      chunkIndex++;
    }

    if (endIndex >= clean.length) break;
    startIndex = Math.max(endIndex - overlapSize, startIndex + 1);
  }

  return chunks;
}

// Subword / N-gram term frequency vectorizer for local semantic vector indexing
export function tokenizeForVector(text: string): Map<string, number> {
  const tokens = new Map<string, number>();
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s_-]/g, ' ');
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);

  // Unigrams + Bigrams
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    tokens.set(w, (tokens.get(w) || 0) + 1);
    if (i < words.length - 1) {
      const bi = `${w}_${words[i + 1]}`;
      tokens.set(bi, (tokens.get(bi) || 0) + 1.5);
    }
  }

  // Length normalization
  let sumSq = 0;
  for (const count of tokens.values()) {
    sumSq += count * count;
  }
  const magnitude = Math.sqrt(sumSq) || 1;
  for (const [key, count] of tokens.entries()) {
    tokens.set(key, count / magnitude);
  }

  return tokens;
}

export function calculateTfidfCosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  for (const [term, valA] of vecA.entries()) {
    const valB = vecB.get(term);
    if (valB) {
      dotProduct += valA * valB;
    }
  }
  return Math.min(Math.max(dotProduct, 0), 1);
}

export function cosineSimilarityDense(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Request dense embeddings from server embedding endpoint
 */
async function fetchEmbeddingsFromServer(
  texts: string[],
): Promise<Array<number[] | undefined>> {
  try {
    const res = await fetch(`${BASE}/api/documents/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && Array.isArray(json.embeddings)) {
        return json.embeddings;
      }
    }
  } catch (err) {
    console.warn('[DocLibrary] Server embedding generation unavailable, using local vector representation:', err);
  }
  return texts.map(() => undefined);
}

async function fetchSingleEmbeddingFromServer(text: string): Promise<number[] | undefined> {
  try {
    const res = await fetch(`${BASE}/api/documents/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && Array.isArray(json.embedding)) {
        return json.embedding;
      }
    }
  } catch {
    // fallback
  }
  return undefined;
}

/**
 * Fetch all documents and storage stats from browser IndexedDB
 */
export async function getLibraryDocuments(): Promise<{
  documents: LibraryDocument[];
  stats: DocumentLibraryStats;
}> {
  const documents = await getIndexedDbDocuments();
  const stats = await calculateDocumentStats();
  // Also sync lightweight metadata list to storage for instant synchronous lookup
  try {
    storage.saveDocumentLibrary(documents);
  } catch {
    // ignore
  }
  return { documents, stats };
}

/**
 * Upload and index a new document directly into device IndexedDB
 */
export async function uploadDocumentToLibrary(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<LibraryDocument> {
  const val = validateDocumentFile(file);
  if (!val.valid) {
    throw new Error(val.error || 'Invalid document file');
  }

  // Check total library size limit (50 MB total limit)
  const currentDocs = await getIndexedDbDocuments();
  const currentTotalBytes = currentDocs.reduce((acc, d) => acc + (d.size || 0), 0);
  if (currentTotalBytes + file.size > MAX_TOTAL_LIBRARY_BYTES) {
    throw new Error(
      `Total library storage capacity exceeded (50 MB max). Current: ${formatDocumentSize(
        currentTotalBytes,
      )}, adding this file requires ${formatDocumentSize(file.size)}. Please remove unused documents.`,
    );
  }

  onProgress?.('Extracting document text on device...');
  const textContent = await extractTextFromDocument(file);

  if (!textContent.trim()) {
    throw new Error('No readable text could be extracted from this document.');
  }

  onProgress?.('Segmenting text into semantic chunks...');
  const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
  const rawChunks = chunkTextLocally(textContent, docId, file.name);

  if (rawChunks.length === 0) {
    throw new Error('Document produced 0 text chunks. Ensure the file contains sufficient readable text.');
  }

  onProgress?.('Computing vector embeddings...');
  const chunkTexts = rawChunks.map((c) => c.text);
  const embeddings = await fetchEmbeddingsFromServer(chunkTexts);

  const processedChunks: DocumentChunk[] = rawChunks.map((chunk, idx) => ({
    ...chunk,
    embedding: embeddings[idx],
  }));

  const newDoc: LibraryDocument = {
    id: docId,
    name: file.name,
    size: file.size,
    type: ext as DocumentType,
    uploadedAt: Date.now(),
    enabledForJarvis: true,
    chunkCount: processedChunks.length,
    charCount: textContent.length,
    status: 'indexed',
    previewSnippet: textContent.slice(0, 240).replace(/\s+/g, ' ').trim() + (textContent.length > 240 ? '...' : ''),
  };

  onProgress?.('Storing in device IndexedDB vault...');
  await saveDocumentToIndexedDb(newDoc, processedChunks);

  // Sync lightweight metadata to localStorage
  try {
    const updated = [newDoc, ...currentDocs.filter((d) => d.id !== newDoc.id)];
    storage.saveDocumentLibrary(updated);
  } catch {
    // ignore
  }

  return newDoc;
}

/**
 * Toggle document inclusion in JARVIS searches
 */
export async function toggleDocumentInclusion(
  id: string,
  enabledForJarvis: boolean,
): Promise<void> {
  await updateDocumentInclusionInDb(id, enabledForJarvis);
  const current = storage.getDocumentLibrary();
  const updated = current.map((d) => (d.id === id ? { ...d, enabledForJarvis } : d));
  storage.saveDocumentLibrary(updated);
}

/**
 * Delete a document and its associated chunks from device IndexedDB
 */
export async function deleteDocumentFromLibrary(id: string): Promise<void> {
  await deleteDocumentFromIndexedDb(id);
  const current = storage.getDocumentLibrary();
  const updated = current.filter((d) => d.id !== id);
  storage.saveDocumentLibrary(updated);
}

/**
 * Semantic Vector Search / RAG Retrieval directly from IndexedDB on device
 */
export async function searchDocumentLibrary(
  query: string,
  options: {
    mode?: 'all' | 'specific';
    selectedDocId?: string;
    topK?: number;
  } = {},
): Promise<DocumentRetrievalResult[]> {
  const { mode = 'all', selectedDocId, topK = 6 } = options;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  // 1. Retrieve all stored documents and chunks from IndexedDB
  const allDocs = await getIndexedDbDocuments();
  let candidateChunks: DocumentChunk[] = [];

  if (mode === 'specific' && selectedDocId) {
    candidateChunks = await getIndexedDbChunks(selectedDocId);
  } else {
    // Only search documents marked as enabledForJarvis
    const activeDocIds = new Set(allDocs.filter((d) => d.enabledForJarvis).map((d) => d.id));
    if (activeDocIds.size === 0) {
      return [];
    }
    const allChunks = await getIndexedDbChunks();
    candidateChunks = allChunks.filter((c) => activeDocIds.has(c.docId));
  }

  if (candidateChunks.length === 0) {
    return [];
  }

  // 2. Query representation
  const queryVectorTfidf = tokenizeForVector(query);
  let queryDenseEmbedding: number[] | undefined;

  // If any candidate chunk has dense embeddings, fetch dense embedding for query
  const hasDenseEmbeddings = candidateChunks.some(
    (c) => Array.isArray(c.embedding) && c.embedding.length > 0,
  );
  if (hasDenseEmbeddings) {
    queryDenseEmbedding = await fetchSingleEmbeddingFromServer(query);
  }

  // 3. Score chunks locally in browser using hybrid cosine + TF-IDF + keyword matching
  const scoredChunks = candidateChunks.map((chunk) => {
    let denseScore = 0;
    if (
      queryDenseEmbedding &&
      Array.isArray(chunk.embedding) &&
      chunk.embedding.length === queryDenseEmbedding.length
    ) {
      denseScore = cosineSimilarityDense(queryDenseEmbedding, chunk.embedding);
    }

    const chunkTfidf = tokenizeForVector(chunk.text);
    const tfidfScore = calculateTfidfCosineSimilarity(queryVectorTfidf, chunkTfidf);

    // Exact keyword bonus
    const queryLower = query.toLowerCase();
    const chunkLower = chunk.text.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
    let matchCount = 0;
    for (const w of queryWords) {
      if (chunkLower.includes(w)) matchCount++;
    }
    const keywordRatio = queryWords.length > 0 ? matchCount / queryWords.length : 0;

    // Hybrid combined score
    let finalScore = 0;
    if (denseScore > 0) {
      finalScore = denseScore * 0.65 + tfidfScore * 0.25 + keywordRatio * 0.1;
    } else {
      finalScore = tfidfScore * 0.75 + keywordRatio * 0.25;
    }

    return {
      docId: chunk.docId,
      docName: chunk.docName,
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      score: Math.round(finalScore * 100) / 100,
    };
  });

  // 4. Sort descending and pick top K
  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK);
}
