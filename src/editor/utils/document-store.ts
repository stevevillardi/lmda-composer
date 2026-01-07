/**
 * Unified IndexedDB-based storage for document handles and metadata.
 * 
 * Database: lm-ide-documents
 * Object Stores:
 * - file-handles: FileSystemFileHandle objects for local file access
 * - recent-documents: Unified recent documents list with access history
 */

import type { 
  DocumentType,
  RecentDocument,
  DraftTabs,
} from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Stored file handle record.
 */
export interface StoredFileHandle {
  /** Unique ID (maps to tab ID when opened) */
  id: string;
  /** The FileSystemFileHandle object */
  handle: FileSystemFileHandle;
  /** Display name of the file */
  fileName: string;
  /** Last access timestamp */
  lastAccessed: number;
}


/**
 * Stored recent document entry (persisted to IndexedDB).
 */
export interface StoredRecentDocument {
  /** Unique ID */
  id: string;
  /** Document type */
  type: DocumentType;
  /** Display name */
  displayName: string;
  /** Last access timestamp */
  lastAccessed: number;
  /** File name (for local types) */
  fileName?: string;
  /** Portal hostname (for portal types) */
  portalHostname?: string;
  /** Module name (for portal types) */
  moduleName?: string;
  /** Script type (for portal types) */
  scriptType?: 'collection' | 'ad';
  /** Dedupe key - file path or portal+module+script identity */
  dedupeKey: string;
}

// ============================================================================
// Database Configuration
// ============================================================================

const DB_NAME = 'lm-ide-documents';
const DB_VERSION = 2;

const STORES = {
  FILE_HANDLES: 'file-handles',
  RECENT_DOCUMENTS: 'recent-documents',
  TAB_DRAFTS: 'tab-drafts',
} as const;

// Key for the single draft entry in the tab-drafts store
const DRAFTS_KEY = 'current-drafts';

// Cleanup limits
const MAX_FILE_HANDLES = 50;
const MAX_RECENT_DOCUMENTS = 30;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let dbPromise: Promise<IDBDatabase> | null = null;

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Open the unified IndexedDB database, creating it if needed.
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('[document-store] Failed to open IndexedDB:', request.error);
      dbPromise = null;
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create file-handles store
      if (!db.objectStoreNames.contains(STORES.FILE_HANDLES)) {
        const store = db.createObjectStore(STORES.FILE_HANDLES, { keyPath: 'id' });
        store.createIndex('fileName', 'fileName', { unique: false });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
      
      // Create recent-documents store
      if (!db.objectStoreNames.contains(STORES.RECENT_DOCUMENTS)) {
        const store = db.createObjectStore(STORES.RECENT_DOCUMENTS, { keyPath: 'id' });
        store.createIndex('dedupeKey', 'dedupeKey', { unique: true });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      
      // Create tab-drafts store (v2)
      if (!db.objectStoreNames.contains(STORES.TAB_DRAFTS)) {
        db.createObjectStore(STORES.TAB_DRAFTS, { keyPath: 'id' });
      }
    };
  });
  
  return dbPromise;
}

// ============================================================================
// File Handle Operations
// ============================================================================

/**
 * Save a file handle to IndexedDB.
 */
export async function saveFileHandle(
  id: string, 
  handle: FileSystemFileHandle, 
  fileName: string
): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FILE_HANDLES, 'readwrite');
    const store = transaction.objectStore(STORES.FILE_HANDLES);
    
    const data: StoredFileHandle = {
      id,
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
 * Get a file handle from IndexedDB by ID.
 */
export async function getFileHandle(id: string): Promise<FileSystemFileHandle | undefined> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FILE_HANDLES, 'readonly');
    const store = transaction.objectStore(STORES.FILE_HANDLES);
    const request = store.get(id);
    
    request.onsuccess = () => {
      const result = request.result as StoredFileHandle | undefined;
      resolve(result?.handle);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get the full stored file handle record by ID.
 */
export async function getFileHandleRecord(id: string): Promise<StoredFileHandle | undefined> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FILE_HANDLES, 'readonly');
    const store = transaction.objectStore(STORES.FILE_HANDLES);
    const request = store.get(id);
    
    request.onsuccess = () => {
      resolve(request.result as StoredFileHandle | undefined);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a file handle from IndexedDB.
 */
export async function deleteFileHandle(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FILE_HANDLES, 'readwrite');
    const store = transaction.objectStore(STORES.FILE_HANDLES);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update the lastAccessed timestamp for a file handle.
 */
export async function touchFileHandle(id: string): Promise<void> {
  const record = await getFileHandleRecord(id);
  if (record) {
    await saveFileHandle(id, record.handle, record.fileName);
  }
}

/**
 * Get all stored file handles as a Map keyed by ID.
 */
export async function getAllFileHandles(): Promise<Map<string, StoredFileHandle>> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FILE_HANDLES, 'readonly');
    const store = transaction.objectStore(STORES.FILE_HANDLES);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result as StoredFileHandle[];
      const map = new Map<string, StoredFileHandle>();
      for (const record of results) {
        map.set(record.id, record);
      }
      resolve(map);
    };
    request.onerror = () => reject(request.error);
  });
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
 * Returns metadata only; use getFileHandle() to retrieve the actual handle.
 * Each entry is shown individually - files with the same name but different
 * locations are distinct entries (FileSystemFileHandle doesn't expose paths).
 */
export async function getRecentFileHandles(limit: number = 10): Promise<RecentFileInfo[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FILE_HANDLES, 'readonly');
    const store = transaction.objectStore(STORES.FILE_HANDLES);
    const index = store.index('lastAccessed');
    
    // Open cursor in reverse order (newest first)
    const request = index.openCursor(null, 'prev');
    const results: RecentFileInfo[] = [];
    const allRecords: StoredFileHandle[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const record = cursor.value as StoredFileHandle;
        allRecords.push(record);
        
        // Add each entry (no deduplication - different files can have same name)
        if (results.length < limit) {
          results.push({
            tabId: record.id,
            fileName: record.fileName,
            lastAccessed: record.lastAccessed,
          });
        }
        cursor.continue();
      } else {
        // Done iterating - trigger cleanup of old records
        cleanupOldFileHandles(allRecords).catch(console.error);
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clean up old file handles that exceed our limits.
 */
async function cleanupOldFileHandles(allRecords: StoredFileHandle[]): Promise<void> {
  const now = Date.now();
  const toDelete: string[] = [];
  
  allRecords.forEach((record, index) => {
    // Delete if beyond max count
    if (index >= MAX_FILE_HANDLES) {
      toDelete.push(record.id);
      return;
    }
    
    // Delete if too old
    const age = now - record.lastAccessed;
    if (age > MAX_AGE_MS) {
      toDelete.push(record.id);
    }
  });
  
  if (toDelete.length > 0) {
    console.log(`[document-store] Removing ${toDelete.length} old file handles`);
    for (const id of toDelete) {
      await deleteFileHandle(id);
    }
  }
}


// ============================================================================
// Recent Documents Operations
// ============================================================================

/**
 * Create a dedupe key for a document.
 */
export function createDedupeKey(params: {
  type: DocumentType;
  fileName?: string;
  portalHostname?: string;
  moduleName?: string;
  scriptType?: 'collection' | 'ad';
}): string {
  if (params.type === 'local' && params.fileName) {
    return `file:${params.fileName}`;
  }
  if (params.type === 'portal' && 
      params.portalHostname && params.moduleName && params.scriptType) {
    return `module:${params.portalHostname}:${params.moduleName}:${params.scriptType}`;
  }
  // Fallback to unique ID for scratch/history/api
  return `unique:${crypto.randomUUID()}`;
}

/**
 * Add or update a recent document entry.
 * Uses dedupeKey to prevent duplicates.
 */
export async function addRecentDocument(doc: Omit<StoredRecentDocument, 'lastAccessed'>): Promise<void> {
  const db = await openDatabase();
  
  // First, try to find and delete any existing entry with the same dedupeKey
  await deleteRecentDocumentByDedupeKey(doc.dedupeKey);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.RECENT_DOCUMENTS, 'readwrite');
    const store = transaction.objectStore(STORES.RECENT_DOCUMENTS);
    
    const data: StoredRecentDocument = {
      ...doc,
      lastAccessed: Date.now(),
    };
    
    const request = store.put(data);
    
    request.onsuccess = () => {
      // Trigger cleanup asynchronously
      cleanupRecentDocuments().catch(console.error);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a recent document by its dedupe key.
 */
async function deleteRecentDocumentByDedupeKey(dedupeKey: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.RECENT_DOCUMENTS, 'readwrite');
    const store = transaction.objectStore(STORES.RECENT_DOCUMENTS);
    const index = store.index('dedupeKey');
    const request = index.get(dedupeKey);
    
    request.onsuccess = () => {
      const existing = request.result as StoredRecentDocument | undefined;
      if (existing) {
        store.delete(existing.id);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get recent documents sorted by lastAccessed (most recent first).
 */
export async function getRecentDocuments(limit: number = 10): Promise<RecentDocument[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.RECENT_DOCUMENTS, 'readonly');
    const store = transaction.objectStore(STORES.RECENT_DOCUMENTS);
    const index = store.index('lastAccessed');
    
    const request = index.openCursor(null, 'prev');
    const results: RecentDocument[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        const doc = cursor.value as StoredRecentDocument;
        results.push({
          id: doc.id,
          type: doc.type,
          displayName: doc.displayName,
          lastAccessed: doc.lastAccessed,
          fileName: doc.fileName,
          portalHostname: doc.portalHostname,
          moduleName: doc.moduleName,
          scriptType: doc.scriptType,
        });
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a recent document by ID.
 */
export async function deleteRecentDocument(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.RECENT_DOCUMENTS, 'readwrite');
    const store = transaction.objectStore(STORES.RECENT_DOCUMENTS);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clean up old recent documents.
 */
async function cleanupRecentDocuments(): Promise<void> {
  const db = await openDatabase();
  const now = Date.now();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.RECENT_DOCUMENTS, 'readwrite');
    const store = transaction.objectStore(STORES.RECENT_DOCUMENTS);
    const index = store.index('lastAccessed');
    
    const request = index.openCursor(null, 'prev');
    let count = 0;
    const toDelete: string[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const doc = cursor.value as StoredRecentDocument;
        count++;
        
        // Delete if beyond max count or too old
        if (count > MAX_RECENT_DOCUMENTS || (now - doc.lastAccessed) > MAX_AGE_MS) {
          toDelete.push(doc.id);
        }
        cursor.continue();
      } else {
        // Delete all marked documents
        for (const id of toDelete) {
          store.delete(id);
        }
        resolve();
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Tab Drafts Operations (Crash Recovery)
// ============================================================================

/**
 * Stored tab drafts record (includes id field for IndexedDB keyPath).
 */
interface StoredDraftTabs {
  id: string;
  drafts: DraftTabs;
}

/**
 * Save tab drafts to IndexedDB.
 * Replaces any existing drafts with the new data.
 */
export async function saveTabDrafts(drafts: DraftTabs): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TAB_DRAFTS, 'readwrite');
    const store = transaction.objectStore(STORES.TAB_DRAFTS);
    
    const data: StoredDraftTabs = {
      id: DRAFTS_KEY,
      drafts,
    };
    
    const request = store.put(data);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load tab drafts from IndexedDB.
 * Returns null if no drafts are stored.
 */
export async function loadTabDrafts(): Promise<DraftTabs | null> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TAB_DRAFTS, 'readonly');
    const store = transaction.objectStore(STORES.TAB_DRAFTS);
    const request = store.get(DRAFTS_KEY);
    
    request.onsuccess = () => {
      const result = request.result as StoredDraftTabs | undefined;
      resolve(result?.drafts ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear tab drafts from IndexedDB.
 */
export async function clearTabDrafts(): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TAB_DRAFTS, 'readwrite');
    const store = transaction.objectStore(STORES.TAB_DRAFTS);
    const request = store.delete(DRAFTS_KEY);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if there are saved drafts in IndexedDB.
 */
export async function hasTabDrafts(): Promise<boolean> {
  const drafts = await loadTabDrafts();
  return drafts !== null && drafts.tabs.length > 0;
}

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Query permission status for a file handle.
 */
export async function queryFilePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<PermissionState> {
  try {
    const status = await handle.queryPermission({ mode });
    return status;
  } catch {
    return 'prompt';
  }
}

/**
 * Request permission for a file handle.
 * Must be called from a user gesture.
 */
export async function requestFilePermission(
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
 * Query permission status for a directory handle.
 */
export async function queryDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<PermissionState> {
  try {
    const handleWithPermission = handle as unknown as { 
      queryPermission(options?: { mode?: string }): Promise<PermissionState>;
    };
    const status = await handleWithPermission.queryPermission({ mode });
    return status;
  } catch {
    return 'prompt';
  }
}

/**
 * Request permission for a directory handle.
 * Must be called from a user gesture.
 */
export async function requestDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  try {
    const handleWithPermission = handle as unknown as { 
      requestPermission(options?: { mode?: string }): Promise<PermissionState>;
    };
    const status = await handleWithPermission.requestPermission({ mode });
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Check if a directory handle is still valid and accessible.
 */
export async function isDirectoryHandleValid(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const handleWithIteration = handle as unknown as { 
      keys(): AsyncIterableIterator<string>;
    };
    // Test if handle supports iteration by calling keys() once
    // The iterator variable is intentionally unused - we only need to verify iteration is supported
    for await (const _key of handleWithIteration.keys()) {
      break;
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// File Operations
// ============================================================================

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

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Clean up old data across all stores.
 */
export async function cleanupOldData(): Promise<void> {
  const now = Date.now();
  
  // Clean up old file handles
  const db = await openDatabase();
  const allHandles = await new Promise<StoredFileHandle[]>((resolve, reject) => {
    const transaction = db.transaction(STORES.FILE_HANDLES, 'readonly');
    const store = transaction.objectStore(STORES.FILE_HANDLES);
    const index = store.index('lastAccessed');
    const request = index.openCursor(null, 'prev');
    
    const results: StoredFileHandle[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value as StoredFileHandle);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
  
  const handlesToDelete: string[] = [];
  allHandles.forEach((handle, index) => {
    if (index >= MAX_FILE_HANDLES || (now - handle.lastAccessed) > MAX_AGE_MS) {
      handlesToDelete.push(handle.id);
    }
  });
  
  for (const id of handlesToDelete) {
    console.log(`[document-store] Removing old file handle: ${id}`);
    await deleteFileHandle(id);
  }
  
  // Clean up old recent documents
  await cleanupRecentDocuments();
}

/**
 * Clear all stored data.
 */
export async function clearAllData(): Promise<void> {
  const db = await openDatabase();
  
  const storeNames = Object.values(STORES);
  
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeNames, 'readwrite');
    
    for (const storeName of storeNames) {
      transaction.objectStore(storeName).clear();
    }
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the File System Access API is supported.
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * Check if the directory picker is supported.
 */
export function isDirectoryPickerSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

