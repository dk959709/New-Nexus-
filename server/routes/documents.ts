import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { getBackendApiKey } from '../apiCatalog.js';

export interface ServerDocumentChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  charCount: number;
}

export interface ServerLibraryDocument {
  id: string;
  name: string;
  size: number;
  type: 'pdf' | 'txt' | 'csv' | 'docx' | string;
  uploadedAt: number;
  enabledForJarvis: boolean;
  chunkCount: number;
  charCount: number;
  status: 'indexed' | 'indexing' | 'error';
  errorMessage?: string;
  previewSnippet?: string;
}

export interface DocumentStorageData {
  documents: ServerLibraryDocument[];
  chunks: ServerDocumentChunk[];
}

const DOCUMENTS_FILE_PATH = resolve(process.cwd(), 'data', 'documents.json');

// In-memory cache
let inMemoryStore: DocumentStorageData = {
  documents: [],
  chunks: [],
};

// Initialize directory and load persisted documents
function ensureDataDir(): void {
  const dir = resolve(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadPersistedDocuments(): DocumentStorageData {
  try {
    ensureDataDir();
    if (fs.existsSync(DOCUMENTS_FILE_PATH)) {
      const raw = fs.readFileSync(DOCUMENTS_FILE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.documents) && Array.isArray(data.chunks)) {
        inMemoryStore = data;
        return inMemoryStore;
      }
    }
  } catch (err) {
    console.error('[DocumentStore] Failed to load persisted documents:', err);
  }
  inMemoryStore = { documents: [], chunks: [] };
  return inMemoryStore;
}

export function savePersistedDocuments(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(DOCUMENTS_FILE_PATH, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DocumentStore] Failed to save persisted documents:', err);
  }
}

// Initial load
loadPersistedDocuments();

/**
 * Intelligent text chunker: creates 500-900 character chunks with ~120 char overlap
 * breaks cleanly on paragraphs, sentences, or word boundaries.
 */
export function chunkDocumentText(
  text: string,
  docId: string,
  docName: string,
  targetChunkSize = 750,
  overlapSize = 120,
): ServerDocumentChunk[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const chunks: ServerDocumentChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < clean.length) {
    let endIndex = startIndex + targetChunkSize;

    if (endIndex >= clean.length) {
      endIndex = clean.length;
    } else {
      // Find clean natural boundary: paragraph break, newline, period, question mark, or space
      const searchWindow = clean.slice(Math.max(startIndex + targetChunkSize - 150, startIndex), Math.min(startIndex + targetChunkSize + 100, clean.length));
      
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

    if (endIndex >= clean.length) {
      break;
    }

    // Advance with overlap
    startIndex = Math.max(endIndex - overlapSize, startIndex + 1);
  }

  return chunks;
}

// Subword / N-gram term frequency vectorizer for local semantic vector scoring
function tokenizeForVector(text: string): Map<string, number> {
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

function calculateTfidfCosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  for (const [term, valA] of vecA.entries()) {
    const valB = vecB.get(term);
    if (valB) {
      dotProduct += valA * valB;
    }
  }
  return Math.min(Math.max(dotProduct, 0), 1);
}

function cosineSimilarityDense(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
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
 * Generate Gemini embeddings if API key is present
 */
async function generateEmbeddingsWithGemini(
  texts: string[],
): Promise<Array<number[] | undefined>> {
  const geminiKey = getBackendApiKey('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  if (!geminiKey) return texts.map(() => undefined);

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const results: Array<number[] | undefined> = [];

    // Process in small batches
    for (let i = 0; i < texts.length; i += 5) {
      const batch = texts.slice(i, i + 5);
      const batchPromises = batch.map(async (txt) => {
        try {
          const res = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: txt.slice(0, 2048),
          });
          if (res && res.embedding && Array.isArray(res.embedding.values)) {
            return res.embedding.values;
          }
        } catch {
          // fallback
        }
        return undefined;
      });

      const batchRes = await Promise.all(batchPromises);
      results.push(...batchRes);
    }

    return results;
  } catch (err) {
    console.warn('[Embeddings] Gemini embedding API call encountered an issue, using hybrid local vector index:', err);
    return texts.map(() => undefined);
  }
}

async function generateSingleEmbedding(text: string): Promise<number[] | undefined> {
  const geminiKey = getBackendApiKey('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  if (!geminiKey) return undefined;
  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text.slice(0, 2048),
    });
    if (res && res.embedding && Array.isArray(res.embedding.values)) {
      return res.embedding.values;
    }
  } catch {
    // fallback
  }
  return undefined;
}

export const documentsRouter = Router();

/**
 * GET /api/documents - List all documents and storage stats
 */
documentsRouter.get('/api/documents', (req: Request, res: Response) => {
  try {
    loadPersistedDocuments();
    const totalSizeBytes = inMemoryStore.documents.reduce((acc, d) => acc + (d.size || 0), 0);
    const activeDocuments = inMemoryStore.documents.filter((d) => d.enabledForJarvis).length;

    return res.json({
      ok: true,
      documents: inMemoryStore.documents,
      stats: {
        totalDocuments: inMemoryStore.documents.length,
        totalChunks: inMemoryStore.chunks.length,
        totalSizeBytes,
        activeDocuments,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve documents';
    return res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * GET /api/documents/:id/chunks - Get chunks of a specific document
 */
documentsRouter.get('/api/documents/:id/chunks', (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    const doc = inMemoryStore.documents.find((d) => d.id === docId);
    if (!doc) {
      return res.status(404).json({ ok: false, error: 'Document not found' });
    }
    const chunks = inMemoryStore.chunks.filter((c) => c.docId === docId);
    return res.json({ ok: true, document: doc, chunks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve chunks';
    return res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * POST /api/documents/upload - Ingest document text, chunk it, embed, and store
 */
documentsRouter.post('/api/documents/upload', async (req: Request, res: Response) => {
  try {
    const { name, size, type, textContent } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, error: 'Filename is required' });
    }

    if (!textContent || typeof textContent !== 'string' || !textContent.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'No extractable text content found in document. Please check the file format or contents.',
      });
    }

    const cleanText = textContent.trim();
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const extension = name.split('.').pop()?.toLowerCase() || type || 'txt';

    // 1. Chunk document
    const rawChunks = chunkDocumentText(cleanText, docId, name);

    if (rawChunks.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Document produced 0 text chunks. Ensure the file contains readable text.',
      });
    }

    // 2. Compute embeddings (with Gemini if available)
    const chunkTexts = rawChunks.map((c) => c.text);
    const embeddings = await generateEmbeddingsWithGemini(chunkTexts);

    const processedChunks: ServerDocumentChunk[] = rawChunks.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddings[idx],
    }));

    // 3. Create document record
    const newDoc: ServerLibraryDocument = {
      id: docId,
      name,
      size: Number(size) || cleanText.length,
      type: extension,
      uploadedAt: Date.now(),
      enabledForJarvis: true, // Enabled by default
      chunkCount: processedChunks.length,
      charCount: cleanText.length,
      status: 'indexed',
      previewSnippet: cleanText.slice(0, 240).replace(/\s+/g, ' ').trim() + (cleanText.length > 240 ? '...' : ''),
    };

    // 4. Save to persistent store
    loadPersistedDocuments();
    inMemoryStore.documents.unshift(newDoc);
    inMemoryStore.chunks.push(...processedChunks);
    savePersistedDocuments();

    console.log(`[DocumentStore] Successfully ingested & indexed "${name}" (${processedChunks.length} chunks)`);

    return res.json({
      ok: true,
      document: newDoc,
      chunksCount: processedChunks.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to upload document';
    console.error('[DocumentStore] Upload error:', err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * POST /api/documents/toggle - Toggle 'enabledForJarvis' inclusion state
 */
documentsRouter.post('/api/documents/toggle', (req: Request, res: Response) => {
  try {
    const { id, enabledForJarvis } = req.body || {};
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ ok: false, error: 'Document ID is required' });
    }

    loadPersistedDocuments();
    const doc = inMemoryStore.documents.find((d) => d.id === id);
    if (!doc) {
      return res.status(404).json({ ok: false, error: 'Document not found' });
    }

    doc.enabledForJarvis = Boolean(enabledForJarvis);
    savePersistedDocuments();

    return res.json({ ok: true, document: doc });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update document status';
    return res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * DELETE /api/documents/:id - Delete document and all associated chunks
 */
documentsRouter.delete('/api/documents/:id', (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    if (!docId) {
      return res.status(400).json({ ok: false, error: 'Document ID is required' });
    }

    loadPersistedDocuments();
    const initialDocCount = inMemoryStore.documents.length;
    inMemoryStore.documents = inMemoryStore.documents.filter((d) => d.id !== docId);
    inMemoryStore.chunks = inMemoryStore.chunks.filter((c) => c.docId !== docId);

    if (inMemoryStore.documents.length === initialDocCount) {
      return res.status(404).json({ ok: false, error: 'Document not found' });
    }

    savePersistedDocuments();
    console.log(`[DocumentStore] Deleted document ${docId}`);

    return res.json({ ok: true, message: 'Document removed successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete document';
    return res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * POST /api/documents/search - Vector Similarity & Semantic Retrieval (RAG)
 * Modes:
 * - 'all': searches across all documents where enabledForJarvis === true
 * - 'specific': searches only within the specified selectedDocId
 */
documentsRouter.post('/api/documents/search', async (req: Request, res: Response) => {
  try {
    const { query, mode = 'all', selectedDocId, topK = 6 } = req.body || {};

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.json({ ok: true, results: [] });
    }

    loadPersistedDocuments();

    // 1. Filter candidate chunks based on mode
    let candidateChunks: ServerDocumentChunk[] = [];

    if (mode === 'specific' && selectedDocId) {
      candidateChunks = inMemoryStore.chunks.filter((c) => c.docId === selectedDocId);
    } else {
      // 'all' mode: only include documents marked enabledForJarvis
      const activeDocIds = new Set(
        inMemoryStore.documents.filter((d) => d.enabledForJarvis).map((d) => d.id),
      );
      candidateChunks = inMemoryStore.chunks.filter((c) => activeDocIds.has(c.docId));
    }

    if (candidateChunks.length === 0) {
      return res.json({
        ok: true,
        results: [],
        message: mode === 'specific'
          ? 'Selected document has no indexed text chunks.'
          : 'No active documents available for search.',
      });
    }

    // 2. Query representation
    const queryVectorTfidf = tokenizeForVector(query);
    let queryDenseEmbedding: number[] | undefined;

    // Check if any candidate has dense embedding
    const hasDenseEmbeddings = candidateChunks.some((c) => Array.isArray(c.embedding) && c.embedding.length > 0);
    if (hasDenseEmbeddings) {
      queryDenseEmbedding = await generateSingleEmbedding(query);
    }

    // 3. Score chunks
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

    // 4. Sort and return top K
    scoredChunks.sort((a, b) => b.score - a.score);
    const topResults = scoredChunks.slice(0, Number(topK) || 6);

    return res.json({
      ok: true,
      results: topResults,
      totalSearchedChunks: candidateChunks.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Search failed';
    console.error('[DocumentStore] Search error:', err);
    return res.status(500).json({ ok: false, error: msg });
  }
});
