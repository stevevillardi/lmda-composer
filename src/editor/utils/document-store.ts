/**
 * Unified IndexedDB-based storage for document handles and metadata.
 * 
 * This store consolidates the previous file-handle-store and repository-store
 * into a single unified storage layer.
 * 
 * Database: lm-ide-documents
 * Object Stores:
 * - file-handles: FileSystemFileHandle objects
 * - repositories: StoredRepository objects (directory handles)
 * - module-files: StoredModuleFile records (file-to-module mappings)
 * - recent-documents: Unified recent documents list
 */

import type { 
  LogicModuleType, 
  ScriptLanguage, 
  DocumentType,
  RecentDocument,
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
 * Module manifest written as module.json in each module directory.
 * Contains everything needed to restore portal binding.
 */
export interface ModuleManifest {
  /** Schema version for future compatibility */
  manifestVersion: 1;
  
  /** Portal binding (required for push back to LM) */
  portal: {
    /** Portal ID used internally */
    id: string;
    /** e.g., "acme.logicmonitor.com" */
    hostname: string;
  };
  
  /** Module identification */
  module: {
    /** Module ID in portal */
    id: number;
    /** datasource, propertysource, etc. */
    type: LogicModuleType;
    /** Technical name */
    name: string;
    /** Human-readable name */
    displayName?: string;
    /** For lineage version history */
    lineageId?: string;
  };
  
  /** Metadata snapshot (for reference, may be stale) */
  metadata: {
    description?: string;
    appliesTo?: string;
    collectMethod?: string;
    collectInterval?: number;
    /** Portal version at time of clone/pull */
    version?: number;
  };
  
  /** Script file references */
  scripts: {
    collection?: {
      /** e.g., "collection.groovy" */
      filename: string;
      language: ScriptLanguage;
    };
    ad?: {
      /** e.g., "ad.groovy" */
      filename: string;
      language: ScriptLanguage;
    };
  };
  
  /** Sync tracking */
  sync: {
    /** Timestamp: when first cloned */
    clonedAt: number;
    /** Timestamp: when last fetched from portal */
    lastPulledAt: number;
    /** Portal version number at last pull */
    lastPulledVersion?: number;
    /** Timestamp: when last pushed to portal */
    lastPushedAt?: number;
  };
}

/**
 * Persisted repository directory handle.
 */
export interface StoredRepository {
  /** UUID */
  id: string;
  /** The directory handle */
  handle: FileSystemDirectoryHandle;
  /** User-friendly path for UI display */
  displayPath: string;
  /** For sorting and cleanup */
  lastAccessed: number;
  /** Portal hostnames with modules in this repo */
  portals: string[];
}

/**
 * Maps opened files back to their module manifests for binding restoration.
 */
export interface StoredModuleFile {
  /** UUID (also used as tabId when opened) */
  fileId: string;
  /** Reference to StoredRepository */
  repositoryId: string;
  /** The script file handle */
  fileHandle: FileSystemFileHandle;
  /** Parent module directory */
  moduleDirectoryHandle: FileSystemDirectoryHandle;
  /** e.g., "acme.logicmonitor.com/datasources/MyDS/collection.groovy" */
  relativePath: string;
  /** Which script this file represents */
  scriptType: 'collection' | 'ad';
  /** For sorting and cleanup */
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
  /** File name (for local/repository) */
  fileName?: string;
  /** Portal hostname (for portal/repository) */
  portalHostname?: string;
  /** Module name (for portal/repository) */
  moduleName?: string;
  /** Script type (for portal/repository) */
  scriptType?: 'collection' | 'ad';
  /** Repository path (for repository) */
  repositoryPath?: string;
  /** Dedupe key - file path or portal+module+script identity */
  dedupeKey: string;
}

/**
 * Repository info returned to UI (without handles for safety).
 */
export interface RepositoryInfo {
  id: string;
  displayPath: string;
  lastAccessed: number;
  portals: string[];
}

// ============================================================================
// Database Configuration
// ============================================================================

const DB_NAME = 'lm-ide-documents';
const DB_VERSION = 1;

const STORES = {
  FILE_HANDLES: 'file-handles',
  REPOSITORIES: 'repositories',
  MODULE_FILES: 'module-files',
  RECENT_DOCUMENTS: 'recent-documents',
} as const;

// Cleanup limits
const MAX_FILE_HANDLES = 50;
const MAX_REPOSITORIES = 10;
const MAX_MODULE_FILES = 100;
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
      
      // Create repositories store
      if (!db.objectStoreNames.contains(STORES.REPOSITORIES)) {
        const store = db.createObjectStore(STORES.REPOSITORIES, { keyPath: 'id' });
        store.createIndex('displayPath', 'displayPath', { unique: false });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
      
      // Create module-files store
      if (!db.objectStoreNames.contains(STORES.MODULE_FILES)) {
        const store = db.createObjectStore(STORES.MODULE_FILES, { keyPath: 'fileId' });
        store.createIndex('repositoryId', 'repositoryId', { unique: false });
        store.createIndex('relativePath', 'relativePath', { unique: false });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
      
      // Create recent-documents store
      if (!db.objectStoreNames.contains(STORES.RECENT_DOCUMENTS)) {
        const store = db.createObjectStore(STORES.RECENT_DOCUMENTS, { keyPath: 'id' });
        store.createIndex('dedupeKey', 'dedupeKey', { unique: true });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        store.createIndex('type', 'type', { unique: false });
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
  /** If this is a repository-backed module file */
  isRepositoryModule?: boolean;
  /** Module name (e.g., "MyDataSource") */
  moduleName?: string;
  /** Script type for display */
  scriptType?: 'collection' | 'ad';
  /** Portal hostname for display */
  portalHostname?: string;
}

/**
 * Get recent file handles sorted by lastAccessed (most recent first).
 * Returns metadata only; use getFileHandle() to retrieve the actual handle.
 * Deduplicates by fileName - only the most recent entry for each file is returned.
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
    const seenFileNames = new Set<string>();
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const record = cursor.value as StoredFileHandle;
        allRecords.push(record);
        
        // Dedupe by fileName - only add if we haven't seen this file before
        // Since we're iterating newest first, this keeps the most recent entry
        if (!seenFileNames.has(record.fileName) && results.length < limit) {
          seenFileNames.add(record.fileName);
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
// Repository Operations
// ============================================================================

/**
 * Save a repository directory handle.
 */
export async function saveRepository(repo: StoredRepository): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.REPOSITORIES, 'readwrite');
    const store = transaction.objectStore(STORES.REPOSITORIES);
    const request = store.put(repo);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a repository by ID.
 */
export async function getRepository(id: string): Promise<StoredRepository | undefined> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.REPOSITORIES, 'readonly');
    const store = transaction.objectStore(STORES.REPOSITORIES);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result as StoredRepository | undefined);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all stored repositories sorted by lastAccessed (most recent first).
 */
export async function getAllRepositories(): Promise<StoredRepository[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.REPOSITORIES, 'readonly');
    const store = transaction.objectStore(STORES.REPOSITORIES);
    const index = store.index('lastAccessed');
    const request = index.openCursor(null, 'prev');
    
    const results: StoredRepository[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value as StoredRepository);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get repository info for UI display (without handles).
 */
export async function getRepositoryInfoList(): Promise<RepositoryInfo[]> {
  const repos = await getAllRepositories();
  return repos.map(({ id, displayPath, lastAccessed, portals }) => ({
    id,
    displayPath,
    lastAccessed,
    portals,
  }));
}

/**
 * Delete a repository and all its associated file mappings.
 */
export async function deleteRepository(id: string): Promise<void> {
  // First, delete all module files for this repository
  await deleteModuleFilesForRepository(id);
  
  const db = await openDatabase();
  
  // Then delete the repository itself
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.REPOSITORIES, 'readwrite');
    const store = transaction.objectStore(STORES.REPOSITORIES);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a repository's lastAccessed timestamp.
 */
export async function touchRepository(id: string): Promise<void> {
  const repo = await getRepository(id);
  if (repo) {
    repo.lastAccessed = Date.now();
    await saveRepository(repo);
  }
}

/**
 * Add a portal hostname to a repository's portal list.
 */
export async function addPortalToRepository(repoId: string, portalHostname: string): Promise<void> {
  const repo = await getRepository(repoId);
  if (repo && !repo.portals.includes(portalHostname)) {
    repo.portals.push(portalHostname);
    repo.lastAccessed = Date.now();
    await saveRepository(repo);
  }
}

// ============================================================================
// Module File Operations
// ============================================================================

/**
 * Save a module file mapping.
 */
export async function saveModuleFile(file: StoredModuleFile): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.MODULE_FILES, 'readwrite');
    const store = transaction.objectStore(STORES.MODULE_FILES);
    const request = store.put(file);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a module file by ID.
 */
export async function getModuleFile(fileId: string): Promise<StoredModuleFile | undefined> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.MODULE_FILES, 'readonly');
    const store = transaction.objectStore(STORES.MODULE_FILES);
    const request = store.get(fileId);
    
    request.onsuccess = () => resolve(request.result as StoredModuleFile | undefined);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Find a module file by its relative path.
 */
export async function findModuleFileByPath(relativePath: string): Promise<StoredModuleFile | undefined> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.MODULE_FILES, 'readonly');
    const store = transaction.objectStore(STORES.MODULE_FILES);
    const index = store.index('relativePath');
    const request = index.get(relativePath);
    
    request.onsuccess = () => resolve(request.result as StoredModuleFile | undefined);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all module files for a repository.
 */
export async function getModuleFilesForRepository(repositoryId: string): Promise<StoredModuleFile[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.MODULE_FILES, 'readonly');
    const store = transaction.objectStore(STORES.MODULE_FILES);
    const index = store.index('repositoryId');
    const request = index.getAll(repositoryId);
    
    request.onsuccess = () => resolve(request.result as StoredModuleFile[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a module file mapping.
 */
export async function deleteModuleFile(fileId: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.MODULE_FILES, 'readwrite');
    const store = transaction.objectStore(STORES.MODULE_FILES);
    const request = store.delete(fileId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all module files for a repository.
 */
async function deleteModuleFilesForRepository(repositoryId: string): Promise<void> {
  const files = await getModuleFilesForRepository(repositoryId);
  for (const file of files) {
    await deleteModuleFile(file.fileId);
  }
}

/**
 * Update a module file's lastAccessed timestamp.
 */
export async function touchModuleFile(fileId: string): Promise<void> {
  const file = await getModuleFile(fileId);
  if (file) {
    file.lastAccessed = Date.now();
    await saveModuleFile(file);
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
  if ((params.type === 'portal' || params.type === 'repository') && 
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
          repositoryPath: doc.repositoryPath,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of handleWithIteration.keys()) {
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
  
  // Clean up old repositories
  const repos = await getAllRepositories();
  const reposToDelete: string[] = [];
  
  repos.forEach((repo, index) => {
    if (index >= MAX_REPOSITORIES || (now - repo.lastAccessed) > MAX_AGE_MS) {
      reposToDelete.push(repo.id);
    }
  });
  
  for (const id of reposToDelete) {
    console.log(`[document-store] Removing old repository: ${id}`);
    await deleteRepository(id);
  }
  
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
  
  // Clean up orphaned module files
  const validRepoIds = new Set(repos.map(r => r.id).filter(id => !reposToDelete.includes(id)));
  const allFiles = await new Promise<StoredModuleFile[]>((resolve, reject) => {
    const transaction = db.transaction(STORES.MODULE_FILES, 'readonly');
    const store = transaction.objectStore(STORES.MODULE_FILES);
    const index = store.index('lastAccessed');
    const request = index.openCursor(null, 'prev');
    
    const results: StoredModuleFile[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value as StoredModuleFile);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
  
  const filesToDelete: string[] = [];
  allFiles.forEach((file, index) => {
    if (!validRepoIds.has(file.repositoryId) || 
        index >= MAX_MODULE_FILES || 
        (now - file.lastAccessed) > MAX_AGE_MS) {
      filesToDelete.push(file.fileId);
    }
  });
  
  for (const id of filesToDelete) {
    console.log(`[document-store] Removing old module file: ${id}`);
    await deleteModuleFile(id);
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

