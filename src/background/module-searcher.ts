import type {
  DataPointSearchResult,
  LogicModuleInfo,
  LogicModuleType,
  ModuleSearchMatchType,
  ScriptSearchResult,
} from '@/shared/types';
import type { ModuleLoader } from './module-loader';
import { findMatchRanges, textMatches } from '@/shared/module-search-utils';

const PAGE_SIZE = 1000;

async function fetchAllModules(
  moduleLoader: ModuleLoader,
  portalId: string,
  moduleTypes: LogicModuleType[]
): Promise<LogicModuleInfo[]> {
  const modules: LogicModuleInfo[] = [];

  for (const moduleType of moduleTypes) {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await moduleLoader.fetchModules(portalId, moduleType, offset, PAGE_SIZE, '');
      if (!response.items.length) {
        break;
      }
      modules.push(...response.items);
      offset += response.items.length;
      hasMore = response.hasMore;
    }
  }

  return modules;
}

export async function searchModuleScripts(
  moduleLoader: ModuleLoader,
  portalId: string,
  query: string,
  matchType: ModuleSearchMatchType,
  caseSensitive: boolean,
  moduleTypes: LogicModuleType[]
): Promise<ScriptSearchResult[]> {
  const modules = await fetchAllModules(moduleLoader, portalId, moduleTypes);
  const results: ScriptSearchResult[] = [];

  for (const module of modules) {
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

    if (collectionMatches.length > 0 || adMatches.length > 0) {
      results.push({
        module,
        collectionMatches,
        adMatches,
      });
    }
  }

  return results;
}

export async function searchDatapoints(
  moduleLoader: ModuleLoader,
  portalId: string,
  query: string,
  matchType: ModuleSearchMatchType,
  caseSensitive: boolean
): Promise<DataPointSearchResult[]> {
  const datasources = await fetchAllModules(moduleLoader, portalId, ['datasource']);
  const results: DataPointSearchResult[] = [];

  for (const module of datasources) {
    // Note: Ghost datapoints are filtered at the API parsing level
    // LogicModuleInfo.dataPoints is already filtered
    const dataPoints = module.dataPoints || [];
    if (!dataPoints.length) {
      continue;
    }

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
  }

  return results;
}
