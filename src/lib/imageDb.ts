/**
 * IndexedDB helper for Assistant Generated Images
 * Database: "nexus-images-db"
 * Store: "images"
 * Key: short unique ID (string)
 * Value: base64 imageData (string)
 */

const DB_NAME = 'nexus-images-db';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDbAvailable(): boolean {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return false;
  }
  return true;
}

function getDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => {
          resolve(req.result);
        };
        req.onerror = () => {
          dbPromise = null;
          reject(req.error || new Error('Failed to open IndexedDB'));
        };
      } catch (err) {
        dbPromise = null;
        reject(err);
      }
    });
  }
  return dbPromise;
}

/**
 * Save image base64 data to IndexedDB
 */
export async function saveImageToDb(id: string, imageData: string): Promise<boolean> {
  if (!id || !imageData || !isIndexedDbAvailable()) return false;
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(imageData, id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch (err) {
    console.warn('[imageDb] saveImageToDb failed:', err);
    return false;
  }
}

/**
 * Load image base64 data from IndexedDB
 */
export async function loadImageFromDb(id: string): Promise<string | null> {
  if (!id || !isIndexedDbAvailable()) return null;
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          const val = req.result;
          resolve(typeof val === 'string' ? val : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch (err) {
    console.warn('[imageDb] loadImageFromDb failed:', err);
    return null;
  }
}

/**
 * Delete image data from IndexedDB
 */
export async function deleteImageFromDb(id: string): Promise<boolean> {
  if (!id || !isIndexedDbAvailable()) return false;
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch (err) {
    console.warn('[imageDb] deleteImageFromDb failed:', err);
    return false;
  }
}
