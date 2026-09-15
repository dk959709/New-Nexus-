import type { GeneratedImageItem } from '@/types';

const DB_NAME = 'nexus_jarvis_images_v1';
const DB_VERSION = 1;
const STORE_IMAGES = 'generated_images';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

// Fallback in-memory store for restricted sandbox environments
const memoryFallback = new Map<string, GeneratedImageItem>();

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
 * Open or initialize the IndexedDB database for Generated Images
 */
export async function getImageDb(): Promise<IDBDatabase> {
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

        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          const store = db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('seed', 'seed', { unique: false });
          store.createIndex('providerName', 'providerName', { unique: false });
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
        console.warn('[ImageIndexedDB] Database open error:', error);
        dbInitPromise = null;
        reject(error || new Error('Failed to open image IndexedDB database.'));
      };

      request.onblocked = () => {
        console.warn('[ImageIndexedDB] Database open request blocked by another tab.');
      };
    } catch (err) {
      dbInitPromise = null;
      reject(err);
    }
  });

  return dbInitPromise;
}

/**
 * Get all stored generated images from IndexedDB, sorted by newest first
 */
export async function getStoredGeneratedImages(): Promise<GeneratedImageItem[]> {
  try {
    const db = await getImageDb();
    return new Promise<GeneratedImageItem[]>((resolve, reject) => {
      const tx = db.transaction([STORE_IMAGES], 'readonly');
      const store = tx.objectStore(STORE_IMAGES);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result || []) as GeneratedImageItem[];
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(items);
      };

      req.onerror = () => {
        reject(req.error || new Error('Failed to fetch generated images from IndexedDB.'));
      };
    });
  } catch (err) {
    console.warn('[ImageIndexedDB] Falling back to memory cache:', err);
    return Array.from(memoryFallback.values()).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
  }
}

/**
 * Save a generated image item to IndexedDB
 */
export async function saveGeneratedImageToIndexedDb(item: GeneratedImageItem): Promise<void> {
  try {
    const db = await getImageDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_IMAGES], 'readwrite');

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        const err = tx.error;
        if (err && (err.name === 'QuotaExceededError' || err.message?.includes('quota'))) {
          reject(
            new Error(
              'Device storage quota exceeded for IndexedDB. Please clear old image history to free up space.'
            )
          );
        } else {
          reject(err || new Error('Failed to save image to IndexedDB.'));
        }
      };

      tx.onabort = () => {
        const err = tx.error;
        reject(err || new Error('Transaction aborted while saving image.'));
      };

      const store = tx.objectStore(STORE_IMAGES);
      store.put(item);
    });
  } catch (err: unknown) {
    memoryFallback.set(item.id, item);
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      throw new Error('Device storage quota exceeded. Please clear image history.');
    }
    console.warn('[ImageIndexedDB] Saved to memory fallback:', err);
  }
}

/**
 * Delete a specific generated image by ID
 */
export async function deleteGeneratedImageFromIndexedDb(id: string): Promise<void> {
  try {
    const db = await getImageDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_IMAGES], 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error(`Failed to delete image with ID ${id}`));
    });
  } catch (err) {
    memoryFallback.delete(id);
    console.warn('[ImageIndexedDB] Deleted from memory fallback:', err);
  }
}

/**
 * Clear all generated images from IndexedDB
 */
export async function clearAllGeneratedImagesFromIndexedDb(): Promise<void> {
  try {
    const db = await getImageDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_IMAGES], 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to clear generated images.'));
    });
  } catch (err) {
    memoryFallback.clear();
    console.warn('[ImageIndexedDB] Cleared memory fallback:', err);
  }
}
