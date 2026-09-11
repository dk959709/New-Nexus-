import mammoth from 'mammoth';
import { extractPdfText } from './jarvisAttachmentService';
import { storage } from '@/lib/storage';
import { BASE } from './api';
import type {
  LibraryDocument,
  DocumentChunk,
  DocumentRetrievalResult,
  DocumentLibraryStats,
  DocumentType,
} from '@/types';

export const SUPPORTED_DOCUMENT_EXTENSIONS = ['pdf', 'txt', 'csv', 'docx', 'md', 'json', 'log'];

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
 * Validate document upload file
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: 'No file provided.' };
  
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format ".${ext}". Supported formats: PDF, TXT, CSV, DOCX.`,
    };
  }

  // 50MB upper limit
  if (file.size > 50 * 1024 * 1024) {
    return {
      valid: false,
      error: `File is too large (${formatDocumentSize(file.size)}). Max allowed size is 50 MB.`,
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

  // TXT, CSV, MD, JSON
  const rawText = await file.text();
  if (!rawText || !rawText.trim()) {
    throw new Error('The file appears to be empty.');
  }

  return rawText.trim();
}

/**
 * Client-side fallback text chunker
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

/**
 * Fetch all documents from server with local storage fallback
 */
export async function getLibraryDocuments(): Promise<{
  documents: LibraryDocument[];
  stats: DocumentLibraryStats;
}> {
  try {
    const res = await fetch(`${BASE}/api/documents`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && Array.isArray(json.documents)) {
        // Update local storage sync
        storage.saveDocumentLibrary(json.documents);
        return {
          documents: json.documents,
          stats: json.stats || calculateLocalStats(json.documents),
        };
      }
    }
  } catch (err) {
    console.warn('[DocLibrary] Server fetch failed, using local cache:', err);
  }

  // Fallback to local storage
  const localDocs = storage.getDocumentLibrary();
  return {
    documents: localDocs,
    stats: calculateLocalStats(localDocs),
  };
}

function calculateLocalStats(docs: LibraryDocument[]): DocumentLibraryStats {
  const totalSizeBytes = docs.reduce((acc, d) => acc + (d.size || 0), 0);
  const totalChunks = docs.reduce((acc, d) => acc + (d.chunkCount || 0), 0);
  const activeDocuments = docs.filter((d) => d.enabledForJarvis).length;
  return {
    totalDocuments: docs.length,
    totalChunks,
    totalSizeBytes,
    activeDocuments,
  };
}

/**
 * Upload and index a new document (extract text -> chunk -> embed -> save)
 */
export async function uploadDocumentToLibrary(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<LibraryDocument> {
  const val = validateDocumentFile(file);
  if (!val.valid) {
    throw new Error(val.error || 'Invalid document file');
  }

  onProgress?.('Extracting document text...');
  const textContent = await extractTextFromDocument(file);

  onProgress?.('Chunking and generating semantic embeddings...');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';

  try {
    const res = await fetch(`${BASE}/api/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        type: ext,
        textContent,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && json.document) {
        // Sync local cache
        const current = storage.getDocumentLibrary();
        const updated = [json.document, ...current.filter((d) => d.id !== json.document.id)];
        storage.saveDocumentLibrary(updated);
        return json.document;
      }
      throw new Error(json.error || 'Server ingestion failed.');
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Server responded with HTTP ${res.status}`);
  } catch (err: unknown) {
    console.warn('[DocLibrary] Server upload failed, performing client-side ingestion:', err);

    // Fallback client-side ingestion
    const docId = `doc_local_${Date.now()}`;
    const chunks = chunkTextLocally(textContent, docId, file.name);

    const newDoc: LibraryDocument = {
      id: docId,
      name: file.name,
      size: file.size,
      type: ext as DocumentType,
      uploadedAt: Date.now(),
      enabledForJarvis: true,
      chunkCount: chunks.length,
      charCount: textContent.length,
      status: 'indexed',
      previewSnippet: textContent.slice(0, 240).replace(/\s+/g, ' ').trim() + (textContent.length > 240 ? '...' : ''),
      chunks,
    };

    const current = storage.getDocumentLibrary();
    storage.saveDocumentLibrary([newDoc, ...current]);
    return newDoc;
  }
}

/**
 * Toggle document inclusion in JARVIS searches
 */
export async function toggleDocumentInclusion(
  id: string,
  enabledForJarvis: boolean,
): Promise<void> {
  // Optimistic local update
  const current = storage.getDocumentLibrary();
  const updated = current.map((d) => (d.id === id ? { ...d, enabledForJarvis } : d));
  storage.saveDocumentLibrary(updated);

  try {
    await fetch(`${BASE}/api/documents/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabledForJarvis }),
    });
  } catch (err) {
    console.warn('[DocLibrary] Toggle sync failed:', err);
  }
}

/**
 * Delete a document from library
 */
export async function deleteDocumentFromLibrary(id: string): Promise<void> {
  // Optimistic local update
  const current = storage.getDocumentLibrary();
  const updated = current.filter((d) => d.id !== id);
  storage.saveDocumentLibrary(updated);

  try {
    await fetch(`${BASE}/api/documents/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.warn('[DocLibrary] Delete sync failed:', err);
  }
}

/**
 * Semantic Vector Search / RAG Retrieval across library
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

  try {
    const res = await fetch(`${BASE}/api/documents/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        mode,
        selectedDocId,
        topK,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && Array.isArray(json.results)) {
        return json.results;
      }
    }
  } catch (err) {
    console.warn('[DocLibrary] Server vector search failed, using client fallback:', err);
  }

  // Client-side fallback vector search
  const docs = storage.getDocumentLibrary();
  let candidateDocs = docs;
  if (mode === 'specific' && selectedDocId) {
    candidateDocs = docs.filter((d) => d.id === selectedDocId);
  } else {
    candidateDocs = docs.filter((d) => d.enabledForJarvis);
  }

  const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const results: DocumentRetrievalResult[] = [];

  for (const doc of candidateDocs) {
    const chunks = doc.chunks || [];
    for (const chunk of chunks) {
      const lower = chunk.text.toLowerCase();
      let matchCount = 0;
      for (const term of queryTerms) {
        if (lower.includes(term)) matchCount++;
      }

      if (matchCount > 0 || queryTerms.length === 0) {
        const score = queryTerms.length > 0 ? Math.min(matchCount / queryTerms.length, 1) : 0.5;
        results.push({
          docId: doc.id,
          docName: doc.name,
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          score: Math.round(score * 100) / 100,
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
