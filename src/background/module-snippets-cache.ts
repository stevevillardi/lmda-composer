/**
 * IndexedDB cache for LogicMonitor Module Snippets
 * 
 * This cache stores:
 * 1. Snippet list metadata (names, versions, descriptions) - global, 24hr TTL
 * 2. Individual snippet source code - keyed by name+version, indefinite TTL
 * 
 * Module Snippets are portal-agnostic (same across all portals), so we store them globally.
 */

import type { ModuleSnippetInfo, ModuleSnippetSource, ModuleSnippetsCacheMeta } from '@/shared/types';

const DB_NAME = 'lm-ide-module-snippets';
const DB_VERSION = 1;
const SNIPPETS_STORE = 'snippets';
const SOURCE_STORE = 'sources';
const META_STORE = 'meta';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SnippetRecord {
  name: string;
  snippet: ModuleSnippetInfo;
}

interface SourceRecord {
  key: string; // name:version
  source: ModuleSnippetSource;
}

interface MetaRecord {
  id: 'global';
  meta: ModuleSnippetsCacheMeta;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      
      // Store for snippet list metadata
      if (!db.objectStoreNames.contains(SNIPPETS_STORE)) {
        db.createObjectStore(SNIPPETS_STORE, { keyPath: 'name' });
      }
      
      // Store for individual snippet source code
      if (!db.objectStoreNames.contains(SOURCE_STORE)) {
        db.createObjectStore(SOURCE_STORE, { keyPath: 'key' });
      }
      
      // Store for cache metadata
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
}

/**
 * Get the cache metadata (when was it last fetched, from which collector)
 */
export async function getCacheMeta(): Promise<ModuleSnippetsCacheMeta | null> {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const transaction = db.transaction(META_STORE, 'readonly');
    const store = transaction.objectStore(META_STORE);
    const request = store.get('global');

    request.onsuccess = () => {
      const record = request.result as MetaRecord | undefined;
      resolve(record?.meta ?? null);
    };

    request.onerror = () => resolve(null);
  });
}

/**
 * Check if the cache is stale (older than 24 hours)
 */
export async function isCacheStale(): Promise<boolean> {
  const meta = await getCacheMeta();
  if (!meta) return true;
  return Date.now() - meta.fetchedAt > CACHE_TTL_MS;
}

/**
 * Get all cached snippets
 */
export async function getCachedSnippets(): Promise<ModuleSnippetInfo[]> {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const transaction = db.transaction(SNIPPETS_STORE, 'readonly');
    const store = transaction.objectStore(SNIPPETS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result as SnippetRecord[];
      resolve(records.map(r => r.snippet));
    };

    request.onerror = () => resolve([]);
  });
}

/**
 * Get the full cache (snippets + meta + cached source keys) if it exists and is not stale
 */
export async function getCache(): Promise<{ snippets: ModuleSnippetInfo[]; meta: ModuleSnippetsCacheMeta; cachedSourceKeys: string[] } | null> {
  const meta = await getCacheMeta();
  if (!meta) return null;
  
  const snippets = await getCachedSnippets();
  if (snippets.length === 0) return null;
  
  const cachedSourceKeys = await getCachedSourceKeys();
  
  return { snippets, meta, cachedSourceKeys };
}

/**
 * Save snippets to the cache
 */
export async function saveSnippets(
  snippets: ModuleSnippetInfo[],
  meta: ModuleSnippetsCacheMeta
): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SNIPPETS_STORE, META_STORE], 'readwrite');
    
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
    
    // Clear existing snippets
    const snippetsStore = transaction.objectStore(SNIPPETS_STORE);
    snippetsStore.clear();
    
    // Add new snippets
    for (const snippet of snippets) {
      const record: SnippetRecord = { name: snippet.name, snippet };
      snippetsStore.add(record);
    }
    
    // Save metadata
    const metaStore = transaction.objectStore(META_STORE);
    const metaRecord: MetaRecord = { id: 'global', meta };
    metaStore.put(metaRecord);
  });
}

/**
 * Get cached source code for a specific snippet version
 */
export async function getCachedSource(name: string, version: string): Promise<ModuleSnippetSource | null> {
  const db = await openDatabase();
  const key = `${name}:${version}`;
  
  return new Promise((resolve) => {
    const transaction = db.transaction(SOURCE_STORE, 'readonly');
    const store = transaction.objectStore(SOURCE_STORE);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as SourceRecord | undefined;
      resolve(record?.source ?? null);
    };

    request.onerror = () => resolve(null);
  });
}

/**
 * Get all cached source keys (name:version format)
 */
export async function getCachedSourceKeys(): Promise<string[]> {
  const db = await openDatabase();
  
  return new Promise((resolve) => {
    const transaction = db.transaction(SOURCE_STORE, 'readonly');
    const store = transaction.objectStore(SOURCE_STORE);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      resolve(request.result as string[]);
    };

    request.onerror = () => resolve([]);
  });
}

/**
 * Save source code for a specific snippet version
 */
export async function saveSource(source: ModuleSnippetSource): Promise<void> {
  const db = await openDatabase();
  const key = `${source.name}:${source.version}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SOURCE_STORE, 'readwrite');
    const store = transaction.objectStore(SOURCE_STORE);
    const record: SourceRecord = { key, source };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all cached data (snippets, sources, and metadata)
 */
export async function clearCache(): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SNIPPETS_STORE, SOURCE_STORE, META_STORE], 'readwrite');
    
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
    
    transaction.objectStore(SNIPPETS_STORE).clear();
    transaction.objectStore(SOURCE_STORE).clear();
    transaction.objectStore(META_STORE).clear();
  });
}

/**
 * Parse raw snippet data from the collector API response into ModuleSnippetInfo[]
 * The API returns individual entries for each version, we group them by name
 */
export function parseSnippetResponse(rawSnippets: Array<{
  name: string;
  version: string;
  language: string;
  description?: string;
}>): ModuleSnippetInfo[] {
  // Group by name
  const grouped = new Map<string, {
    versions: string[];
    language: string;
    description?: string;
  }>();
  
  for (const raw of rawSnippets) {
    const existing = grouped.get(raw.name);
    if (existing) {
      existing.versions.push(raw.version);
    } else {
      grouped.set(raw.name, {
        versions: [raw.version],
        language: raw.language,
        description: raw.description,
      });
    }
  }
  
  // Convert to ModuleSnippetInfo[]
  const snippets: ModuleSnippetInfo[] = [];
  
  for (const [name, data] of grouped) {
    // Sort versions descending (latest first)
    const sortedVersions = data.versions.sort((a, b) => {
      const aParts = a.split('.').map(p => parseInt(p, 10) || 0);
      const bParts = b.split('.').map(p => parseInt(p, 10) || 0);
      
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] ?? 0;
        const bVal = bParts[i] ?? 0;
        if (aVal !== bVal) return bVal - aVal;
      }
      return 0;
    });
    
    snippets.push({
      name,
      versions: sortedVersions,
      latestVersion: sortedVersions[0] ?? '0.0.0',
      language: data.language === 'powershell' ? 'powershell' : 'groovy',
      description: data.description,
    });
  }
  
  // Sort by name
  return snippets.sort((a, b) => a.name.localeCompare(b.name));
}

