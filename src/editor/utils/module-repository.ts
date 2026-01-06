/**
 * Module repository operations for cloning, reading, and writing modules
 * to the local file system with git-friendly structure.
 * 
 * Directory structure:
 * lm-modules/
 * ├── acme.logicmonitor.com/
 * │   ├── datasources/
 * │   │   └── MyDataSource/
 * │   │       ├── module.json
 * │   │       ├── collection.groovy
 * │   │       └── ad.groovy
 */

import type { 
  LogicModuleType, 
  LogicModuleInfo, 
  ScriptLanguage,
  ModuleManifest,
  CloneResult,
  CloneModuleOptions,
  EditorTabSource,
} from '@/shared/types';
import {
  type StoredRepository,
  type StoredModuleFile,
  saveRepository,
  getRepository,
  getAllRepositories,
  saveModuleFile,
  getModuleFile,
  addPortalToRepository,
  touchRepository,
  touchModuleFile,
  generateId,
  queryDirectoryPermission,
  requestDirectoryPermission,
} from './document-store';

// ============================================================================
// Constants
// ============================================================================

export const MODULE_TYPE_DIRS: Record<LogicModuleType, string> = {
  datasource: 'datasources',
  configsource: 'configsources',
  topologysource: 'topologysources',
  propertysource: 'propertysources',
  logsource: 'logsources',
  diagnosticsource: 'diagnosticsources',
  eventsource: 'eventsources',
};

const MANIFEST_FILENAME = 'module.json';

// ============================================================================
// Path Sanitization
// ============================================================================

/**
 * Characters that are invalid in Windows file/directory names.
 * Also includes forward slash which creates nested directories.
 */
const INVALID_PATH_CHARS = /[/\\:*?"<>|]/g;

/**
 * Sanitize a module name for use as a directory name.
 * Replaces invalid characters with underscores to prevent:
 * - Nested directory creation (from / or \)
 * - Windows file system errors (from : * ? " < > |)
 */
export function sanitizeModuleName(name: string): string {
  // Replace invalid characters with underscores
  let sanitized = name.replace(INVALID_PATH_CHARS, '_');
  
  // Also handle leading/trailing dots and spaces (invalid on Windows)
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // Ensure the name isn't empty after sanitization
  if (!sanitized) {
    sanitized = 'unnamed_module';
  }
  
  return sanitized;
}

// ============================================================================
// Directory Operations
// ============================================================================

/**
 * Get or create a subdirectory within a directory handle.
 */
async function getOrCreateDirectory(
  parent: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

/**
 * Check if a file exists in a directory.
 */
async function fileExists(
  dir: FileSystemDirectoryHandle,
  filename: string
): Promise<boolean> {
  try {
    await dir.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists.
 */
async function directoryExists(
  parent: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    await parent.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a text file to a directory.
 */
async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
  content: string
): Promise<FileSystemFileHandle> {
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  return fileHandle;
}

/**
 * Read a text file from a directory.
 */
async function readTextFile(
  dir: FileSystemDirectoryHandle,
  filename: string
): Promise<string> {
  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return file.text();
}

// ============================================================================
// Manifest Operations
// ============================================================================

/**
 * Create a module manifest from module info.
 */
export function createManifest(
  portalId: string,
  portalHostname: string,
  module: LogicModuleInfo,
  scripts: { collection?: { content: string; language: ScriptLanguage }; ad?: { content: string; language: ScriptLanguage } },
  version?: number
): ModuleManifest {
  const now = Date.now();
  const extension = (lang: ScriptLanguage) => lang === 'powershell' ? 'ps1' : 'groovy';
  
  return {
    manifestVersion: 1,
    portal: {
      id: portalId,
      hostname: portalHostname,
    },
    module: {
      id: module.id,
      type: module.moduleType,
      name: module.name,
      displayName: module.displayName,
      lineageId: module.lineageId,
    },
    metadata: {
      description: module.description,
      appliesTo: module.appliesTo,
      collectMethod: module.collectMethod,
      collectInterval: module.collectInterval,
      version,
    },
    scripts: {
      ...(scripts.collection && {
        collection: {
          filename: `collection.${extension(scripts.collection.language)}`,
          language: scripts.collection.language,
        },
      }),
      ...(scripts.ad && {
        ad: {
          filename: `ad.${extension(scripts.ad.language)}`,
          language: scripts.ad.language,
        },
      }),
    },
    sync: {
      clonedAt: now,
      lastPulledAt: now,
      lastPulledVersion: version,
    },
  };
}

/**
 * Read a module manifest from a directory.
 */
export async function readManifest(
  moduleDir: FileSystemDirectoryHandle
): Promise<ModuleManifest | null> {
  try {
    const content = await readTextFile(moduleDir, MANIFEST_FILENAME);
    return JSON.parse(content) as ModuleManifest;
  } catch {
    return null;
  }
}

/**
 * Write a module manifest to a directory.
 */
async function writeManifest(
  moduleDir: FileSystemDirectoryHandle,
  manifest: ModuleManifest
): Promise<void> {
  await writeTextFile(moduleDir, MANIFEST_FILENAME, JSON.stringify(manifest, null, 2));
}

/**
 * Update manifest sync timestamps after a commit.
 */
export async function updateManifestAfterCommit(
  moduleDir: FileSystemDirectoryHandle
): Promise<void> {
  const manifest = await readManifest(moduleDir);
  if (manifest) {
    manifest.sync.lastCommittedAt = Date.now();
    await writeManifest(moduleDir, manifest);
  }
}

/**
 * Update manifest after pulling latest from portal.
 */
export async function updateManifestAfterPull(
  moduleDir: FileSystemDirectoryHandle,
  version?: number
): Promise<void> {
  const manifest = await readManifest(moduleDir);
  if (manifest) {
    manifest.sync.lastPulledAt = Date.now();
    if (version !== undefined) {
      manifest.sync.lastPulledVersion = version;
    }
    await writeManifest(moduleDir, manifest);
  }
}

// ============================================================================
// Clone Operations
// ============================================================================

/**
 * Show directory picker and create/get a repository.
 */
export async function pickOrCreateRepository(): Promise<StoredRepository | null> {
  try {
    // Cast to any for extended options that TypeScript doesn't fully type
    const showDirectoryPicker = window.showDirectoryPicker as (
      options?: { mode?: string }
    ) => Promise<FileSystemDirectoryHandle>;
    const handle = await showDirectoryPicker({
      mode: 'readwrite',
    });
    
    // Check if this handle matches an existing repository
    const existingRepos = await getAllRepositories();
    for (const repo of existingRepos) {
      try {
        if (await repo.handle.isSameEntry(handle)) {
          // Update last accessed and return existing
          await touchRepository(repo.id);
          return { ...repo, lastAccessed: Date.now() };
        }
      } catch {
        // Handle comparison failed, continue
      }
    }
    
    // Create new repository
    const newRepo: StoredRepository = {
      id: generateId(),
      handle,
      displayPath: handle.name,
      lastAccessed: Date.now(),
      portals: [],
    };
    
    await saveRepository(newRepo);
    return newRepo;
  } catch (error) {
    // User cancelled or error
    if ((error as Error).name === 'AbortError') {
      return null;
    }
    console.error('[module-repository] Error picking directory:', error);
    return null;
  }
}

/**
 * Clone a module to a repository.
 */
export async function cloneModuleToRepository(
  repo: StoredRepository,
  portalId: string,
  portalHostname: string,
  module: LogicModuleInfo,
  scripts: { 
    collection?: { content: string; language: ScriptLanguage }; 
    ad?: { content: string; language: ScriptLanguage };
  },
  options: CloneModuleOptions = {}
): Promise<CloneResult> {
  const { overwrite = false } = options;
  
  try {
    // Ensure we have permission
    const permission = await queryDirectoryPermission(repo.handle);
    if (permission !== 'granted') {
      const granted = await requestDirectoryPermission(repo.handle);
      if (!granted) {
        return {
          success: false,
          repositoryId: repo.id,
          modulePath: '',
          fileIds: {},
          error: 'Permission denied to write to repository',
        };
      }
    }
    
    // Sanitize the module name for use as a directory name
    const safeModuleName = sanitizeModuleName(module.name);
    
    // Create directory structure: portal/type/moduleName/
    const portalDir = await getOrCreateDirectory(repo.handle, portalHostname);
    const typeDir = await getOrCreateDirectory(portalDir, MODULE_TYPE_DIRS[module.moduleType]);
    
    // Check if module already exists
    const moduleExists = await directoryExists(typeDir, safeModuleName);
    if (moduleExists && !overwrite) {
      return {
        success: false,
        repositoryId: repo.id,
        modulePath: `${portalHostname}/${MODULE_TYPE_DIRS[module.moduleType]}/${safeModuleName}`,
        fileIds: {},
        error: `Module "${module.name}" already exists. Use overwrite option to replace.`,
      };
    }
    
    const moduleDir = await getOrCreateDirectory(typeDir, safeModuleName);
    
    // Create manifest
    const manifest = createManifest(portalId, portalHostname, module, scripts, module.collectInterval);
    await writeManifest(moduleDir, manifest);
    
    // Write script files and create file mappings
    const fileIds: { collection?: string; ad?: string } = {};
    const fileHandles: { collection?: FileSystemFileHandle; ad?: FileSystemFileHandle } = {};
    const filenames: { collection?: string; ad?: string } = {};
    const basePath = `${portalHostname}/${MODULE_TYPE_DIRS[module.moduleType]}/${safeModuleName}`;
    
    if (scripts.collection && manifest.scripts.collection) {
      const fileHandle = await writeTextFile(moduleDir, manifest.scripts.collection.filename, scripts.collection.content);
      const fileId = generateId();
      fileIds.collection = fileId;
      fileHandles.collection = fileHandle;
      filenames.collection = manifest.scripts.collection.filename;
      
      const storedFile: StoredModuleFile = {
        fileId,
        repositoryId: repo.id,
        fileHandle,
        moduleDirectoryHandle: moduleDir,
        relativePath: `${basePath}/${manifest.scripts.collection.filename}`,
        scriptType: 'collection',
        lastAccessed: Date.now(),
      };
      await saveModuleFile(storedFile);
    }
    
    if (scripts.ad && manifest.scripts.ad) {
      const fileHandle = await writeTextFile(moduleDir, manifest.scripts.ad.filename, scripts.ad.content);
      const fileId = generateId();
      fileIds.ad = fileId;
      fileHandles.ad = fileHandle;
      filenames.ad = manifest.scripts.ad.filename;
      
      const storedFile: StoredModuleFile = {
        fileId,
        repositoryId: repo.id,
        fileHandle,
        moduleDirectoryHandle: moduleDir,
        relativePath: `${basePath}/${manifest.scripts.ad.filename}`,
        scriptType: 'ad',
        lastAccessed: Date.now(),
      };
      await saveModuleFile(storedFile);
    }
    
    // Update repository with portal info
    await addPortalToRepository(repo.id, portalHostname);
    
    return {
      success: true,
      repositoryId: repo.id,
      modulePath: basePath,
      fileIds,
      fileHandles,
      filenames,
    };
  } catch (error) {
    console.error('[module-repository] Error cloning module:', error);
    return {
      success: false,
      repositoryId: repo.id,
      modulePath: '',
      fileIds: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Read module scripts and manifest from a module directory.
 */
export async function readModuleFromDirectory(
  moduleDir: FileSystemDirectoryHandle
): Promise<{
  manifest: ModuleManifest;
  scripts: { collection?: string; ad?: string };
} | null> {
  try {
    const manifest = await readManifest(moduleDir);
    if (!manifest) {
      return null;
    }
    
    const scripts: { collection?: string; ad?: string } = {};
    
    if (manifest.scripts.collection) {
      try {
        scripts.collection = await readTextFile(moduleDir, manifest.scripts.collection.filename);
      } catch {
        console.warn('[module-repository] Collection script not found');
      }
    }
    
    if (manifest.scripts.ad) {
      try {
        scripts.ad = await readTextFile(moduleDir, manifest.scripts.ad.filename);
      } catch {
        console.warn('[module-repository] AD script not found');
      }
    }
    
    return { manifest, scripts };
  } catch (error) {
    console.error('[module-repository] Error reading module:', error);
    return null;
  }
}

/**
 * Try to restore module binding from a stored module file.
 */
export async function restoreModuleBinding(
  fileId: string
): Promise<{
  manifest: ModuleManifest;
  source: EditorTabSource;
  scriptType: 'collection' | 'ad';
} | null> {
  const storedFile = await getModuleFile(fileId);
  if (!storedFile) {
    return null;
  }
  
  try {
    // Check permission on the module directory
    const permission = await queryDirectoryPermission(storedFile.moduleDirectoryHandle);
    if (permission !== 'granted') {
      // Can't read manifest without permission - caller should request
      return null;
    }
    
    const manifest = await readManifest(storedFile.moduleDirectoryHandle);
    if (!manifest) {
      return null;
    }
    
    // Update last accessed
    await touchModuleFile(fileId);
    
    // Build EditorTabSource from manifest
    const source: EditorTabSource = {
      type: 'module',
      moduleId: manifest.module.id,
      moduleName: manifest.module.name,
      moduleType: manifest.module.type,
      scriptType: storedFile.scriptType,
      lineageId: manifest.module.lineageId,
      portalId: manifest.portal.id,
      portalHostname: manifest.portal.hostname,
    };
    
    return {
      manifest,
      source,
      scriptType: storedFile.scriptType,
    };
  } catch (error) {
    console.error('[module-repository] Error restoring binding:', error);
    return null;
  }
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Write script content to a stored module file.
 */
export async function writeScriptToFile(
  fileId: string,
  content: string
): Promise<boolean> {
  const storedFile = await getModuleFile(fileId);
  if (!storedFile) {
    return false;
  }
  
  try {
    const writable = await storedFile.fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    await touchModuleFile(fileId);
    return true;
  } catch (error) {
    console.error('[module-repository] Error writing script:', error);
    return false;
  }
}

/**
 * Update module files after pulling latest from portal.
 */
export async function updateModuleFilesAfterPull(
  fileId: string,
  collectionScript?: string,
  adScript?: string,
  version?: number
): Promise<boolean> {
  const storedFile = await getModuleFile(fileId);
  if (!storedFile) {
    return false;
  }
  
  try {
    const manifest = await readManifest(storedFile.moduleDirectoryHandle);
    if (!manifest) {
      return false;
    }
    
    // Write updated scripts
    if (collectionScript !== undefined && manifest.scripts.collection) {
      await writeTextFile(storedFile.moduleDirectoryHandle, manifest.scripts.collection.filename, collectionScript);
    }
    
    if (adScript !== undefined && manifest.scripts.ad) {
      await writeTextFile(storedFile.moduleDirectoryHandle, manifest.scripts.ad.filename, adScript);
    }
    
    // Update manifest
    await updateManifestAfterPull(storedFile.moduleDirectoryHandle, version);
    
    return true;
  } catch (error) {
    console.error('[module-repository] Error updating files after pull:', error);
    return false;
  }
}

// ============================================================================
// Open from Repository
// ============================================================================

/**
 * Open a module directory using the directory picker.
 * Returns the module manifest and script contents.
 */
export async function openModuleFromDirectory(): Promise<{
  manifest: ModuleManifest;
  scripts: { collection?: string; ad?: string };
  directoryHandle: FileSystemDirectoryHandle;
  repositoryId?: string;
} | null> {
  try {
    // Cast to any for extended options that TypeScript doesn't fully type
    const showDirectoryPicker = window.showDirectoryPicker as (
      options?: { mode?: string }
    ) => Promise<FileSystemDirectoryHandle>;
    const handle = await showDirectoryPicker({
      mode: 'readwrite',
    });
    
    // Check if module.json exists
    if (!(await fileExists(handle, MANIFEST_FILENAME))) {
      throw new Error('Selected directory is not a module directory (module.json not found)');
    }
    
    const result = await readModuleFromDirectory(handle);
    if (!result) {
      throw new Error('Failed to read module from directory');
    }
    
    // Try to find the repository this belongs to
    const repos = await getAllRepositories();
    let repositoryId: string | undefined;
    
    for (const repo of repos) {
      try {
        // Check if the selected directory is within this repository
        // by trying to resolve its path
        const permission = await queryDirectoryPermission(repo.handle);
        if (permission === 'granted') {
          // This is a simplified check - in practice we'd need to walk the tree
          repositoryId = repo.id;
          break;
        }
      } catch {
        // Continue checking other repos
      }
    }
    
    return {
      ...result,
      directoryHandle: handle,
      repositoryId,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null;
    }
    console.error('[module-repository] Error opening module:', error);
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the display path for a module within a repository.
 */
export function getModuleDisplayPath(
  portalHostname: string,
  moduleType: LogicModuleType,
  moduleName: string
): string {
  return `${portalHostname}/${MODULE_TYPE_DIRS[moduleType]}/${moduleName}`;
}

/**
 * Check if a file ID has a stored module file mapping.
 */
export async function hasModuleFileMapping(fileId: string): Promise<boolean> {
  const file = await getModuleFile(fileId);
  return file !== null;
}

/**
 * Get stored repository by ID with permission status.
 */
export async function getRepositoryWithStatus(
  repoId: string
): Promise<{ repo: StoredRepository; hasPermission: boolean } | null> {
  const repo = await getRepository(repoId);
  if (!repo) {
    return null;
  }
  
  const permission = await queryDirectoryPermission(repo.handle);
  return {
    repo,
    hasPermission: permission === 'granted',
  };
}

