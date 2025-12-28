/**
 * IndexedDB-based storage for FileSystemFileHandle objects.
 * 
 * File handles cannot be serialized to JSON, so we use IndexedDB
 * which can store structured cloneable objects like FileSystemFileHandle.
 * 
 * Database: lm-ide-files
 * Object Store: file-handles
 */

const DB_NAME = 'lm-ide-files';
const DB_VERSION = 1;
const STORE_NAME = 'file-handles';

interface StoredHandle {
  tabId: string;
  handle: FileSystemFileHandle;
  fileName: string;
  lastAccessed: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open the IndexedDB database, creating it if needed.
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create the file-handles object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'tabId' });
        store.createIndex('fileName', 'fileName', { unique: false });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
    };
  });
  
  return dbPromise;
}

/**
 * Save a file handle to IndexedDB.
 */
export async function saveHandle(
  tabId: string, 
  handle: FileSystemFileHandle, 
  fileName: string
): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const data: StoredHandle = {
      tabId,
      handle,
      fileName,
      lastAccessed: Date.now(),
    };
    
    const request = store.put(data);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a file handle from IndexedDB by tab ID.
 */
export async function getHandle(tabId: string): Promise<FileSystemFileHandle | undefined> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(tabId);
    
    request.onsuccess = () => {
      const result = request.result as StoredHandle | undefined;
      resolve(result?.handle);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get the full stored handle record by tab ID.
 */
export async function getHandleRecord(tabId: string): Promise<StoredHandle | undefined> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(tabId);
    
    request.onsuccess = () => {
      resolve(request.result as StoredHandle | undefined);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a file handle from IndexedDB.
 */
export async function deleteHandle(tabId: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(tabId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all stored file handles as a Map keyed by tabId.
 */
export async function getAllHandles(): Promise<Map<string, StoredHandle>> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result as StoredHandle[];
      const map = new Map<string, StoredHandle>();
      for (const record of results) {
        map.set(record.tabId, record);
      }
      resolve(map);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all stored file handles.
 */
export async function clearAllHandles(): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update the lastAccessed timestamp for a handle.
 */
export async function touchHandle(tabId: string): Promise<void> {
  const record = await getHandleRecord(tabId);
  if (record) {
    await saveHandle(tabId, record.handle, record.fileName);
  }
}

/**
 * Check if the File System Access API is supported.
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * Query the permission status for a file handle.
 * Returns 'granted', 'denied', or 'prompt'.
 */
export async function queryPermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<PermissionState> {
  try {
    const status = await handle.queryPermission({ mode });
    return status;
  } catch {
    // If queryPermission is not supported, assume prompt
    return 'prompt';
  }
}

/**
 * Request permission for a file handle.
 * Must be called from a user gesture (click handler, etc.).
 * Returns true if permission was granted.
 */
export async function requestPermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  try {
    const status = await handle.requestPermission({ mode });
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Write content to a file handle.
 */
export async function writeToHandle(
  handle: FileSystemFileHandle,
  content: string
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Read content from a file handle.
 */
export async function readFromHandle(
  handle: FileSystemFileHandle
): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

/**
 * Recent file info returned to UI (without the actual handle for safety).
 */
export interface RecentFileInfo {
  tabId: string;
  fileName: string;
  lastAccessed: number;
}

/**
 * Get recent file handles sorted by lastAccessed (most recent first).
 * Returns metadata only; use getHandle() to retrieve the actual handle.
 */
export async function getRecentHandles(limit: number = 10): Promise<RecentFileInfo[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('lastAccessed');
    
    // Open cursor in reverse order (newest first)
    const request = index.openCursor(null, 'prev');
    const results: RecentFileInfo[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        const record = cursor.value as StoredHandle;
        results.push({
          tabId: record.tabId,
          fileName: record.fileName,
          lastAccessed: record.lastAccessed,
        });
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

