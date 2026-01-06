/**
 * IndexedDB-based storage for module repository directory handles and file mappings.
 * 
 * This store manages:
 * - Repository directory handles (for cloning modules to git repos)
 * - Module file mappings (linking script files back to their module manifests)
 * 
 * Database: lm-ide-repositories
 * Object Stores:
 * - repositories: StoredRepository records (directory handles)
 * - module-files: StoredModuleFile records (file-to-module mappings)
 */

import type { LogicModuleType, ScriptLanguage } from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Module manifest written as module.json in each module directory.
 * Contains everything needed to restore portal binding.
 */
export interface ModuleManifest {
  /** Schema version for future compatibility */
  manifestVersion: 1;
  
  /** Portal binding (required for commit back to LM) */
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
    lastCommittedAt?: number;
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

const DB_NAME = 'lm-ide-repositories';
const DB_VERSION = 1;
const REPOS_STORE = 'repositories';
const FILES_STORE = 'module-files';

// Cleanup limits
const MAX_REPOSITORIES = 10;
const MAX_MODULE_FILES = 100;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let dbPromise: Promise<IDBDatabase> | null = null;

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Open the IndexedDB database, creating it if needed.
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('[repository-store] Failed to open IndexedDB:', request.error);
      dbPromise = null;
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create repositories store
      if (!db.objectStoreNames.contains(REPOS_STORE)) {
        const reposStore = db.createObjectStore(REPOS_STORE, { keyPath: 'id' });
        reposStore.createIndex('displayPath', 'displayPath', { unique: false });
        reposStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
      
      // Create module-files store
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const filesStore = db.createObjectStore(FILES_STORE, { keyPath: 'fileId' });
        filesStore.createIndex('repositoryId', 'repositoryId', { unique: false });
        filesStore.createIndex('relativePath', 'relativePath', { unique: false });
        filesStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
    };
  });
  
  return dbPromise;
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
    const transaction = db.transaction(REPOS_STORE, 'readwrite');
    const store = transaction.objectStore(REPOS_STORE);
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
    const transaction = db.transaction(REPOS_STORE, 'readonly');
    const store = transaction.objectStore(REPOS_STORE);
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
    const transaction = db.transaction(REPOS_STORE, 'readonly');
    const store = transaction.objectStore(REPOS_STORE);
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
  const db = await openDatabase();
  
  // First, delete all module files for this repository
  await deleteModuleFilesForRepository(id);
  
  // Then delete the repository itself
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REPOS_STORE, 'readwrite');
    const store = transaction.objectStore(REPOS_STORE);
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
    const transaction = db.transaction(FILES_STORE, 'readwrite');
    const store = transaction.objectStore(FILES_STORE);
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
    const transaction = db.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
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
    const transaction = db.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
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
    const transaction = db.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
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
    const transaction = db.transaction(FILES_STORE, 'readwrite');
    const store = transaction.objectStore(FILES_STORE);
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
// Permission Helpers
// ============================================================================

/**
 * Query permission status for a directory handle.
 */
export async function queryDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<PermissionState> {
  try {
    // Cast to any because TypeScript doesn't have complete FS Access API types
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
    // Cast to any because TypeScript doesn't have complete FS Access API types
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
    // Try to iterate the directory - this will fail if handle is invalid
    // Cast to any because TypeScript doesn't have complete FS Access API types
    const handleWithIteration = handle as unknown as { 
      keys(): AsyncIterableIterator<string>;
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of handleWithIteration.keys()) {
      break; // Just need to check if iteration works
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Request permission for a file handle.
 * Must be called from a user gesture.
 */
export async function requestFilePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<boolean> {
  try {
    // Cast to any because TypeScript doesn't have complete FS Access API types
    const handleWithPermission = handle as unknown as { 
      queryPermission(options?: { mode?: string }): Promise<PermissionState>;
      requestPermission(options?: { mode?: string }): Promise<PermissionState>;
    };
    
    // First check current status
    const currentStatus = await handleWithPermission.queryPermission({ mode });
    if (currentStatus === 'granted') {
      return true;
    }
    
    // Request permission
    const status = await handleWithPermission.requestPermission({ mode });
    return status === 'granted';
  } catch {
    return false;
  }
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Clean up old repositories and module files.
 */
export async function cleanupOldData(): Promise<void> {
  const now = Date.now();
  
  // Clean up old repositories
  const repos = await getAllRepositories();
  const reposToDelete: string[] = [];
  
  repos.forEach((repo, index) => {
    // Delete if beyond max count
    if (index >= MAX_REPOSITORIES) {
      reposToDelete.push(repo.id);
      return;
    }
    // Delete if too old
    if (now - repo.lastAccessed > MAX_AGE_MS) {
      reposToDelete.push(repo.id);
    }
  });
  
  for (const id of reposToDelete) {
    console.log(`[repository-store] Removing old repository: ${id}`);
    await deleteRepository(id);
  }
  
  // Clean up orphaned module files
  const db = await openDatabase();
  const allFiles = await new Promise<StoredModuleFile[]>((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
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
  
  const validRepoIds = new Set(repos.map(r => r.id).filter(id => !reposToDelete.includes(id)));
  const filesToDelete: string[] = [];
  
  allFiles.forEach((file, index) => {
    // Delete if orphaned (repository no longer exists)
    if (!validRepoIds.has(file.repositoryId)) {
      filesToDelete.push(file.fileId);
      return;
    }
    // Delete if beyond max count
    if (index >= MAX_MODULE_FILES) {
      filesToDelete.push(file.fileId);
      return;
    }
    // Delete if too old
    if (now - file.lastAccessed > MAX_AGE_MS) {
      filesToDelete.push(file.fileId);
    }
  });
  
  for (const id of filesToDelete) {
    console.log(`[repository-store] Removing old module file: ${id}`);
    await deleteModuleFile(id);
  }
}

/**
 * Clear all stored repositories and module files.
 */
export async function clearAllData(): Promise<void> {
  const db = await openDatabase();
  
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([REPOS_STORE, FILES_STORE], 'readwrite');
    
    transaction.objectStore(REPOS_STORE).clear();
    transaction.objectStore(FILES_STORE).clear();
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the File System Access API with directory picker is supported.
 */
export function isDirectoryPickerSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Generate a unique ID for a repository or file.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

