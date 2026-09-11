import type { LibraryDocument, DocumentChunk, DocumentLibraryStats } from '@/types';

const DB_NAME = 'nexus_jarvis_documents_v1';
const DB_VERSION = 1;
const STORE_DOCS = 'documents';
const STORE_CHUNKS = 'chunks';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

// Fallback in-memory store for restricted environments (e.g. sandboxed iframes without IDB permissions)
const memoryFallback = {
  docs: new Map<string, LibraryDocument>(),
  chunks: new Map<string, DocumentChunk>(),
};

/**
 * Check if IndexedDB is available and supported in current runtime
 */
export function isIndexedDbAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Open or initialize the IndexedDB database
 */
export async function getDocumentDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB is not supported or is disabled in this browser.');
  }

  dbInitPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Object Store for Document Metadata
        if (!db.objectStoreNames.contains(STORE_DOCS)) {
          const docStore = db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
          docStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
          docStore.createIndex('enabledForJarvis', 'enabledForJarvis', { unique: false });
        }

        // Object Store for Document Semantic Vector Chunks
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          const chunkStore = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id' });
          chunkStore.createIndex('docId', 'docId', { unique: false });
          chunkStore.createIndex('chunkIndex', 'chunkIndex', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
          dbInitPromise = null;
        };

        resolve(dbInstance);
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        console.warn('[IndexedDB] Database open error:', error);
        dbInitPromise = null;
        reject(error || new Error('Failed to open IndexedDB database.'));
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database open request blocked by another tab.');
      };
    } catch (err) {
      dbInitPromise = null;
      reject(err);
    }
  });

  return dbInitPromise;
}

/**
 * Get all stored documents from IndexedDB
 */
export async function getIndexedDbDocuments(): Promise<LibraryDocument[]> {
  try {
    const db = await getDocumentDb();
    return new Promise<LibraryDocument[]>((resolve, reject) => {
      const tx = db.transaction([STORE_DOCS], 'readonly');
      const store = tx.objectStore(STORE_DOCS);
      const req = store.getAll();

      req.onsuccess = () => {
        const docs = (req.result || []) as LibraryDocument[];
        // Sort descending by uploadedAt
        docs.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
        resolve(docs);
      };

      req.onerror = () => {
        reject(req.error || new Error('Failed to fetch documents from IndexedDB.'));
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Falling back to memory/local cache:', err);
    return Array.from(memoryFallback.docs.values()).sort(
      (a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0),
    );
  }
}

/**
 * Get chunks for a specific document or all documents
 */
export async function getIndexedDbChunks(docId?: string): Promise<DocumentChunk[]> {
  try {
    const db = await getDocumentDb();
    return new Promise<DocumentChunk[]>((resolve, reject) => {
      const tx = db.transaction([STORE_CHUNKS], 'readonly');
      const store = tx.objectStore(STORE_CHUNKS);

      if (docId) {
        const index = store.index('docId');
        const req = index.getAll(IDBKeyRange.only(docId));
        req.onsuccess = () => {
          const chunks = (req.result || []) as DocumentChunk[];
          chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
          resolve(chunks);
        };
        req.onerror = () => reject(req.error || new Error('Failed to get document chunks.'));
      } else {
        const req = store.getAll();
        req.onsuccess = () => {
          resolve((req.result || []) as DocumentChunk[]);
        };
        req.onerror = () => reject(req.error || new Error('Failed to get all chunks.'));
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] Chunks retrieval fallback:', err);
    const all = Array.from(memoryFallback.chunks.values());
    if (docId) {
      return all.filter((c) => c.docId === docId).sort((a, b) => a.chunkIndex - b.chunkIndex);
    }
    return all;
  }
}

/**
 * Save a document and its text chunks atomically to IndexedDB
 */
export async function saveDocumentToIndexedDb(
  doc: LibraryDocument,
  chunks: DocumentChunk[],
): Promise<void> {
  try {
    const db = await getDocumentDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_DOCS, STORE_CHUNKS], 'readwrite');

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        const err = tx.error;
        if (err && (err.name === 'QuotaExceededError' || err.message?.includes('quota'))) {
          reject(
            new Error(
              'Device storage quota exceeded for IndexedDB. Please remove unused documents to free up space.',
            ),
          );
        } else {
          reject(err || new Error('Failed to save document to IndexedDB.'));
        }
      };

      tx.onabort = () => {
        const err = tx.error;
        reject(err || new Error('Transaction aborted while saving document.'));
      };

      const docStore = tx.objectStore(STORE_DOCS);
      const chunkStore = tx.objectStore(STORE_CHUNKS);

      docStore.put(doc);

      for (const chunk of chunks) {
        chunkStore.put(chunk);
      }
    });
  } catch (err: unknown) {
    // Memory fallback if IndexedDB is blocked
    memoryFallback.docs.set(doc.id, doc);
    for (const chunk of chunks) {
      memoryFallback.chunks.set(chunk.id, chunk);
    }
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      throw new Error('Device storage quota exceeded for IndexedDB. Please free up space.');
    }
    console.warn('[IndexedDB] Saved to memory fallback:', err);
  }
}

/**
 * Toggle document enabled state in IndexedDB
 */
export async function updateDocumentInclusionInDb(
  id: string,
  enabledForJarvis: boolean,
): Promise<void> {
  try {
    const db = await getDocumentDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_DOCS], 'readwrite');
      const store = tx.objectStore(STORE_DOCS);

      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const doc = getReq.result as LibraryDocument | undefined;
        if (doc) {
          doc.enabledForJarvis = enabledForJarvis;
          store.put(doc);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to update document inclusion state.'));
    });
  } catch {
    const doc = memoryFallback.docs.get(id);
    if (doc) {
      doc.enabledForJarvis = enabledForJarvis;
    }
  }
}

/**
 * Delete a document and all its chunks from IndexedDB
 */
export async function deleteDocumentFromIndexedDb(docId: string): Promise<void> {
  try {
    const db = await getDocumentDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_DOCS, STORE_CHUNKS], 'readwrite');
      const docStore = tx.objectStore(STORE_DOCS);
      const chunkStore = tx.objectStore(STORE_CHUNKS);

      // Delete document record
      docStore.delete(docId);

      // Delete all matching chunks using docId index
      const chunkIndex = chunkStore.index('docId');
      const cursorReq = chunkIndex.openKeyCursor(IDBKeyRange.only(docId));

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          chunkStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to delete document from IndexedDB.'));
    });
  } catch {
    memoryFallback.docs.delete(docId);
    for (const [chunkId, chunk] of Array.from(memoryFallback.chunks.entries())) {
      if (chunk.docId === docId) {
        memoryFallback.chunks.delete(chunkId);
      }
    }
  }
}

/**
 * Clear all documents and chunks from IndexedDB
 */
export async function clearAllDocumentsFromIndexedDb(): Promise<void> {
  try {
    const db = await getDocumentDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_DOCS, STORE_CHUNKS], 'readwrite');
      tx.objectStore(STORE_DOCS).clear();
      tx.objectStore(STORE_CHUNKS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to clear library.'));
    });
  } catch {
    memoryFallback.docs.clear();
    memoryFallback.chunks.clear();
  }
}

/**
 * Calculate storage stats for Document Library
 */
export async function calculateDocumentStats(): Promise<DocumentLibraryStats> {
  const docs = await getIndexedDbDocuments();
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
 * Query browser navigator.storage for disk quota estimates
 */
export async function getDeviceStorageEstimate(): Promise<{
  usageBytes: number;
  quotaBytes?: number;
  percentage?: number;
}> {
  try {
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const estimate = await navigator.storage.estimate();
      const usageBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota;
      const percentage = quotaBytes ? Math.min(Math.round((usageBytes / quotaBytes) * 100), 100) : undefined;
      return { usageBytes, quotaBytes, percentage };
    }
  } catch (err) {
    console.warn('[Storage] Storage estimate unavailable:', err);
  }
  return { usageBytes: 0 };
}
