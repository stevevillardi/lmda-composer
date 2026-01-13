import type {
  DataPointSearchResult,
  LogicModuleInfo,
  LogicModuleType,
  ModuleSearchMatchType,
  ModuleIndexInfo,
  ModuleSearchProgress,
  ScriptSearchResult,
} from '@/shared/types';
import { ALL_LOGIC_MODULE_TYPES } from '@/shared/logic-modules';
import { findMatchRanges, textMatches } from '@/shared/module-search-utils';

/**
 * Check if the query matches the module name or displayName.
 */
function matchesModuleName(
  module: LogicModuleInfo,
  query: string,
  matchType: ModuleSearchMatchType,
  caseSensitive: boolean
): boolean {
  return (
    textMatches(module.name || '', query, matchType, caseSensitive) ||
    textMatches(module.displayName || '', query, matchType, caseSensitive)
  );
}
import type { ModuleLoader } from './module-loader';

const DB_NAME = 'lm-ide-module-index';
const DB_VERSION = 1;
const MODULE_STORE = 'modules';
const META_STORE = 'portal-meta';
const INDEX_TTL_MS = 24 * 60 * 60 * 1000;
const PROGRESS_BATCH_SIZE = 50;

interface ModuleIndexRecord {
  key: string;
  portalId: string;
  moduleType: LogicModuleType;
  moduleId: number;
  module: LogicModuleInfo;
  indexedAt: number;
}

interface PortalIndexMeta {
  portalId: string;
  indexedAt: number;
  moduleCount: number;
}

interface ProgressOptions {
  onProgress?: (progress: ModuleSearchProgress) => void;
  searchId: string;
  abortSignal?: AbortSignal;
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
      if (!db.objectStoreNames.contains(MODULE_STORE)) {
        const store = db.createObjectStore(MODULE_STORE, { keyPath: 'key' });
        store.createIndex('portalId', 'portalId', { unique: false });
        store.createIndex('portalType', ['portalId', 'moduleType'], { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'portalId' });
      }
    };
  });

  return dbPromise;
}

export async function getIndexInfo(portalId: string): Promise<ModuleIndexInfo> {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const transaction = db.transaction(META_STORE, 'readonly');
    const store = transaction.objectStore(META_STORE);
    const request = store.get(portalId);

    request.onsuccess = () => {
      const meta = request.result as PortalIndexMeta | undefined;
      const indexedAt = meta?.indexedAt ?? null;
      const moduleCount = meta?.moduleCount ?? 0;
      const isStale = indexedAt ? Date.now() - indexedAt > INDEX_TTL_MS : true;
      resolve({ portalId, indexedAt, moduleCount, isStale });
    };

    request.onerror = () => resolve({ portalId, indexedAt: null, moduleCount: 0, isStale: true });
  });
}

async function clearPortalIndex(db: IDBDatabase, portalId: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(MODULE_STORE, 'readwrite');
    const store = transaction.objectStore(MODULE_STORE);
    const index = store.index('portalId');
    const range = IDBKeyRange.only(portalId);
    const request = index.openCursor(range);

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    request.onerror = () => resolve();
  });
}

async function writePortalMeta(
  db: IDBDatabase,
  portalId: string,
  moduleCount: number,
  indexedAt: number
): Promise<void> {
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(META_STORE, 'readwrite');
    const store = transaction.objectStore(META_STORE);
    store.put({ portalId, indexedAt, moduleCount } satisfies PortalIndexMeta);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

async function storeModules(
  db: IDBDatabase,
  portalId: string,
  moduleType: LogicModuleType,
  modules: LogicModuleInfo[],
  indexedAt: number
): Promise<void> {
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(MODULE_STORE, 'readwrite');
    const store = transaction.objectStore(MODULE_STORE);
    for (const module of modules) {
      const record: ModuleIndexRecord = {
        key: `${portalId}:${moduleType}:${module.id}`,
        portalId,
        moduleType,
        moduleId: module.id,
        module,
        indexedAt,
      };
      store.put(record);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

function throwIfAborted(abortSignal?: AbortSignal) {
  if (abortSignal?.aborted) {
    throw new Error('Search cancelled');
  }
}

export async function rebuildModuleIndex(
  portalId: string,
  moduleLoader: ModuleLoader,
  options: ProgressOptions
): Promise<ModuleIndexInfo> {
  const { onProgress, searchId, abortSignal } = options;
  const db = await openDatabase();
  const indexedAt = Date.now();

  await clearPortalIndex(db, portalId);

  let totalProcessed = 0;
  let expectedTotal = 0;

  for (const moduleType of ALL_LOGIC_MODULE_TYPES) {
    let offset = 0;
    let hasMore = true;
    let expectedForType: number | null = null;

    while (hasMore) {
      throwIfAborted(abortSignal);
      const response = await moduleLoader.fetchModules(portalId, moduleType, offset, undefined, '');
      if (expectedForType === null) {
        expectedForType = response.total;
        expectedTotal += response.total;
      }

      if (!response.items.length) {
        break;
      }

      await storeModules(db, portalId, moduleType, response.items, indexedAt);
      totalProcessed += response.items.length;
      offset += response.items.length;
      hasMore = response.hasMore;

      if (onProgress && totalProcessed % PROGRESS_BATCH_SIZE === 0) {
        onProgress({
          searchId,
          stage: 'indexing',
          processed: totalProcessed,
          total: expectedTotal || undefined,
          moduleType,
        });
      }
    }
  }

  await writePortalMeta(db, portalId, totalProcessed, indexedAt);

  onProgress?.({
    searchId,
    stage: 'indexing',
    processed: totalProcessed,
    total: expectedTotal || undefined,
  });

  return {
    portalId,
    indexedAt,
    moduleCount: totalProcessed,
    isStale: false,
  };
}

export async function searchModuleScriptsFromIndex(
  portalId: string,
  moduleTypes: LogicModuleType[],
  query: string,
  matchType: ModuleSearchMatchType,
  caseSensitive: boolean,
  options: ProgressOptions
): Promise<ScriptSearchResult[]> {
  const { onProgress, searchId, abortSignal } = options;
  const db = await openDatabase();
  const results: ScriptSearchResult[] = [];
  let processed = 0;
  let matched = 0;

  for (const moduleType of moduleTypes) {
    throwIfAborted(abortSignal);
    const transaction = db.transaction(MODULE_STORE, 'readonly');
    const store = transaction.objectStore(MODULE_STORE);
    const index = store.index('portalType');
    const range = IDBKeyRange.only([portalId, moduleType]);

    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) {
          resolve();
          return;
        }

        if (abortSignal?.aborted) {
          resolve();
          return;
        }

        try {
          const record = cursor.value as ModuleIndexRecord;
          const module = record.module;
          const collectionMatches = findMatchRanges(
            module.collectionScript || '',
            query,
            matchType,
            caseSensitive
          );
          const adMatches = findMatchRanges(
            module.adScript || '',
            query,
            matchType,
            caseSensitive
          );

          // Check if name/displayName matches
          const hasNameMatch = matchesModuleName(module, query, matchType, caseSensitive);
          const hasScriptMatch = collectionMatches.length > 0 || adMatches.length > 0;

          processed += 1;

          if (hasScriptMatch || hasNameMatch) {
            matched += 1;
            results.push({
              module,
              collectionMatches,
              adMatches,
              // Only set nameMatch if matched by name but NOT by script content
              nameMatch: hasNameMatch && !hasScriptMatch,
            });
          }

          if (onProgress && processed % PROGRESS_BATCH_SIZE === 0) {
            onProgress({
              searchId,
              stage: 'searching',
              processed,
              matched,
              moduleType,
            });
          }
        } catch (error) {
          reject(error);
          return;
        }

        cursor.continue();
      };

      request.onerror = () => reject(request.error ?? new Error('Failed to search module scripts'));
    });

    throwIfAborted(abortSignal);
  }

  onProgress?.({
    searchId,
    stage: 'searching',
    processed,
    matched,
  });

  return results;
}

export async function searchDatapointsFromIndex(
  portalId: string,
  query: string,
  matchType: ModuleSearchMatchType,
  caseSensitive: boolean,
  options: ProgressOptions
): Promise<DataPointSearchResult[]> {
  const { onProgress, searchId, abortSignal } = options;
  const db = await openDatabase();
  const results: DataPointSearchResult[] = [];
  let processed = 0;
  let matched = 0;

  throwIfAborted(abortSignal);
  const transaction = db.transaction(MODULE_STORE, 'readonly');
  const store = transaction.objectStore(MODULE_STORE);
  const index = store.index('portalType');
  const range = IDBKeyRange.only([portalId, 'datasource']);

  await new Promise<void>((resolve, reject) => {
    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result as IDBCursorWithValue | null;
      if (!cursor) {
        resolve();
        return;
      }

      if (abortSignal?.aborted) {
        resolve();
        return;
      }

      try {
        const record = cursor.value as ModuleIndexRecord;
        const module = record.module;
        // Note: Ghost datapoints are filtered at the API parsing level, not here
        // LogicModuleInfo.dataPoints is already filtered
        const dataPoints = module.dataPoints || [];
        processed += 1;

        for (const dataPoint of dataPoints) {
          const nameMatch = textMatches(dataPoint.name || '', query, matchType, caseSensitive);
          const descriptionMatch = textMatches(
            dataPoint.description || '',
            query,
            matchType,
            caseSensitive
          );
          if (!nameMatch && !descriptionMatch) {
            continue;
          }

          matched += 1;
          results.push({
            moduleId: module.id,
            moduleName: module.name,
            moduleDisplayName: module.displayName || module.name,
            appliesTo: module.appliesTo || '',
            collectInterval: module.collectInterval,
            dataPoint: {
              id: dataPoint.id,
              name: dataPoint.name,
              description: dataPoint.description || '',
              alertForNoData: dataPoint.alertForNoData,
              alertExpr: dataPoint.alertExpr,
              alertTransitionInterval: dataPoint.alertTransitionInterval,
              alertClearTransitionInterval: dataPoint.alertClearTransitionInterval,
            },
            matchedFields: {
              name: nameMatch,
              description: descriptionMatch,
            },
          });
        }

        if (onProgress && processed % PROGRESS_BATCH_SIZE === 0) {
          onProgress({
            searchId,
            stage: 'searching',
            processed,
            matched,
          });
        }
      } catch (error) {
        reject(error);
        return;
      }

      cursor.continue();
    };

    request.onerror = () => reject(request.error ?? new Error('Failed to search datapoints'));
  });

  throwIfAborted(abortSignal);

  onProgress?.({
    searchId,
    stage: 'searching',
    processed,
    matched,
  });

  return results;
}
