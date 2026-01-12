/**
 * Handlers for module-related messages.
 */

import type { HandlerContext, SendResponse } from './types';
import type { 
  FetchModulesRequest,
  LogicModuleType,
  SearchModuleScriptsRequest,
  SearchDatapointsRequest,
  RefreshModuleIndexRequest,
  ModuleIndexInfo,
  ModuleSearchProgress,
} from '@/shared/types';
import {
  fetchModuleById,
  commitModuleScript,
  fetchLineageVersions,
  fetchModuleDetails,
  fetchAccessGroups,
  createModule,
} from '../module-api';
import {
  getIndexInfo,
  rebuildModuleIndex,
  searchDatapointsFromIndex,
  searchModuleScriptsFromIndex,
} from '../module-search-index';

function sendModuleSearchProgress(progress: ModuleSearchProgress) {
  chrome.runtime.sendMessage({
    type: 'MODULE_SEARCH_PROGRESS',
    payload: progress,
  }).catch(() => {
    // Ignore errors if no listener (editor window might be closed)
  });
}

export async function handleFetchModules(
  payload: FetchModulesRequest,
  sendResponse: SendResponse,
  { moduleLoader }: HandlerContext
) {
  const { portalId, moduleType, offset, size, search } = payload;
  const response = await moduleLoader.fetchModules(portalId, moduleType, offset, size, search);
  sendResponse({ type: 'MODULES_FETCHED', payload: response });
}

export async function handleFetchModule(
  payload: { portalId: string; moduleType: LogicModuleType; moduleId: number },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, moduleType, moduleId } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    const tabId = await portalManager.getValidTabIdForPortal(portalId);
    if (!portal || !tabId) {
      sendResponse({ 
        type: 'MODULE_ERROR', 
        payload: { error: 'Portal not found or no tabs available', code: 404 } 
      });
      return;
    }
    const csrfToken = await portalManager.getCsrfToken(portalId);
    const module = await fetchModuleById(portal.hostname, csrfToken, moduleType, moduleId, tabId);
    if (module) {
      sendResponse({ type: 'MODULE_FETCHED', payload: module });
    } else {
      sendResponse({ 
        type: 'MODULE_ERROR', 
        payload: { error: 'Module not found', code: 404 } 
      });
    }
  } catch (error) {
    sendResponse({ 
      type: 'MODULE_ERROR', 
      payload: { 
        error: error instanceof Error ? error.message : 'Failed to fetch module',
        code: 500
      } 
    });
  }
}

export async function handleFetchLineageVersions(
  payload: { portalId: string; moduleType: LogicModuleType; lineageId: string },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, moduleType, lineageId } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    const tabId = await portalManager.getValidTabIdForPortal(portalId);
    if (!portal || !tabId) {
      sendResponse({
        type: 'LINEAGE_ERROR',
        payload: { error: 'Portal not found or no tabs available', code: 404 },
      });
      return;
    }
    const csrfToken = await portalManager.getCsrfToken(portalId);
    const versions = await fetchLineageVersions(
      portal.hostname,
      csrfToken,
      moduleType,
      lineageId,
      tabId
    );
    if (versions) {
      sendResponse({ type: 'LINEAGE_VERSIONS_FETCHED', payload: { versions } });
    } else {
      sendResponse({
        type: 'LINEAGE_ERROR',
        payload: { error: 'Failed to fetch lineage versions', code: 500 },
      });
    }
  } catch (error) {
    sendResponse({
      type: 'LINEAGE_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to fetch lineage versions',
        code: 500,
      },
    });
  }
}

export async function handleFetchModuleDetails(
  payload: { portalId: string; moduleType: LogicModuleType; moduleId: number; tabId?: number },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, moduleType, moduleId } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    // Use validated tab ID from portal manager instead of trusting frontend
    const tabId = await portalManager.getValidTabIdForPortal(portalId);
    if (!portal || !tabId) {
      sendResponse({
        type: 'MODULE_DETAILS_ERROR',
        payload: { error: 'Portal not found or no valid tab available', code: 404 },
      });
      return;
    }
    const csrfToken = await portalManager.getCsrfToken(portalId);
    const module = await fetchModuleDetails(
      portal.hostname,
      csrfToken,
      moduleType,
      moduleId,
      tabId
    );
    if (module) {
      sendResponse({ type: 'MODULE_DETAILS_FETCHED', payload: { module } });
    } else {
      sendResponse({
        type: 'MODULE_DETAILS_ERROR',
        payload: { error: 'Module not found', code: 404 },
      });
    }
  } catch (error) {
    sendResponse({
      type: 'MODULE_DETAILS_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to fetch module details',
        code: 500,
      },
    });
  }
}

export async function handleFetchAccessGroups(
  payload: { portalId: string; tabId?: number },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    // Use validated tab ID from portal manager instead of trusting frontend
    const tabId = await portalManager.getValidTabIdForPortal(portalId);
    if (!portal || !tabId) {
      sendResponse({
        type: 'ACCESS_GROUPS_ERROR',
        payload: { error: 'Portal not found or no valid tab available', code: 404 },
      });
      return;
    }
    const csrfToken = await portalManager.getCsrfToken(portalId);
    const accessGroups = await fetchAccessGroups(
      portal.hostname,
      csrfToken,
      tabId
    );
    sendResponse({ type: 'ACCESS_GROUPS_FETCHED', payload: { accessGroups } });
  } catch (error) {
    sendResponse({
      type: 'ACCESS_GROUPS_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to fetch access groups',
        code: 500,
      },
    });
  }
}

export async function handleCommitModuleScript(
  payload: { 
    portalId: string; 
    moduleType: LogicModuleType; 
    moduleId: number;
    scriptType: 'collection' | 'ad';
    newScript?: string;
    moduleDetails?: Partial<{
      name: string;
      displayName?: string;
      description?: string;
      appliesTo?: string;
      group?: string;
      technology?: string;
      tags?: string | string[];
      collectInterval?: number;
      accessGroupIds?: number[] | string;
      // DataSource specific fields
      dataPoints?: Array<{
        id: number;
        name: string;
        type?: number;
        description?: string;
        postProcessorMethod?: string;
        alertForNoData?: number | boolean;
        alertExpr?: string;
        alertTransitionInterval?: number;
        alertClearTransitionInterval?: number;
        [key: string]: unknown;
      }>;
      autoDiscoveryConfig?: Record<string, unknown>;
      // ConfigSource specific fields
      configChecks?: Array<{
        id?: number;
        name: string;
        type?: string;
        description?: string;
        alertLevel?: number;
        ackClearAlert?: boolean;
        alertEffectiveIval?: number;
        alertTransitionInterval?: number;
        script?: Record<string, unknown>;
        [key: string]: unknown;
      }>;
      // LogSource specific fields
      filters?: Array<{
        id?: string;
        index?: string;
        attribute: string;
        operator: string;
        value?: string;
        comment?: string;
        include?: string;
      }>;
      logFields?: Array<{
        id?: string;
        key: string;
        method: string;
        value: string;
        comment?: string;
      }>;
      resourceMapping?: Array<{
        id?: string;
        index?: string | number;
        key: string;
        method: string;
        value: string;
        comment?: string;
      }>;
      collectionAttribute?: {
        script?: { embeddedContent?: string; type?: string };
        resourceMappingOp?: string;
        filterOp?: string | null;
      };
    }>;
    reason?: string;
  },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, moduleType, moduleId, scriptType, newScript, moduleDetails, reason } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    const tabId = await portalManager.getValidTabIdForPortal(portalId);
    if (!portal || !tabId) {
      console.error(`[SW] Portal not found or no tabs: portalId=${portalId}, tabIds=${portal?.tabIds.length || 0}`);
      sendResponse({ 
        type: 'MODULE_ERROR', 
        payload: { error: 'Portal not found or no tabs available', code: 404 } 
      });
      return;
    }
    const csrfToken = await portalManager.getCsrfToken(portalId);
    const result = await commitModuleScript(
      portal.hostname, 
      csrfToken, 
      moduleType, 
      moduleId, 
      scriptType, 
      newScript,
      tabId,
      moduleDetails,
      reason
    );
    if (result.success) {
      sendResponse({ type: 'MODULE_COMMITTED', payload: { moduleId, moduleType } });
    } else {
      sendResponse({ 
        type: 'MODULE_ERROR', 
        payload: { 
          error: result.error || 'Failed to commit module script',
          code: 500
        } 
      });
    }
  } catch (error) {
    console.error(`[SW] Error in COMMIT_MODULE_SCRIPT:`, error);
    sendResponse({ 
      type: 'MODULE_ERROR', 
      payload: { 
        error: error instanceof Error ? error.message : 'Failed to commit module script',
        code: 500
      } 
    });
  }
}

export async function handleSearchModuleScripts(
  payload: SearchModuleScriptsRequest,
  sendResponse: SendResponse,
  { moduleLoader, activeModuleSearches }: HandlerContext
) {
  const { portalId, query, matchType, caseSensitive, moduleTypes, searchId, forceReindex } = payload;
  const executionId = searchId || crypto.randomUUID();
  const existing = activeModuleSearches.get(executionId);
  if (existing) {
    existing.abort();
    activeModuleSearches.delete(executionId);
  }
  const abortController = new AbortController();
  activeModuleSearches.set(executionId, abortController);

  try {
    let indexInfo: ModuleIndexInfo = await getIndexInfo(portalId);
    if (!indexInfo.indexedAt || forceReindex) {
      indexInfo = await rebuildModuleIndex(portalId, moduleLoader, {
        searchId: executionId,
        abortSignal: abortController.signal,
        onProgress: sendModuleSearchProgress,
      });
    }

    const results = await searchModuleScriptsFromIndex(
      portalId,
      moduleTypes,
      query,
      matchType,
      caseSensitive,
      {
        searchId: executionId,
        abortSignal: abortController.signal,
        onProgress: sendModuleSearchProgress,
      }
    );
    sendResponse({ type: 'MODULE_SCRIPT_SEARCH_RESULTS', payload: { results, indexInfo } });
  } catch (error) {
    sendResponse({
      type: 'MODULE_SCRIPT_SEARCH_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to search module scripts',
        code: 500,
      },
    });
  } finally {
    activeModuleSearches.delete(executionId);
  }
}

export async function handleSearchDatapoints(
  payload: SearchDatapointsRequest,
  sendResponse: SendResponse,
  { moduleLoader, activeModuleSearches }: HandlerContext
) {
  const { portalId, query, matchType, caseSensitive, searchId, forceReindex } = payload;
  const executionId = searchId || crypto.randomUUID();
  const existing = activeModuleSearches.get(executionId);
  if (existing) {
    existing.abort();
    activeModuleSearches.delete(executionId);
  }
  const abortController = new AbortController();
  activeModuleSearches.set(executionId, abortController);

  try {
    let indexInfo: ModuleIndexInfo = await getIndexInfo(portalId);
    if (!indexInfo.indexedAt || forceReindex) {
      indexInfo = await rebuildModuleIndex(portalId, moduleLoader, {
        searchId: executionId,
        abortSignal: abortController.signal,
        onProgress: sendModuleSearchProgress,
      });
    }

    const results = await searchDatapointsFromIndex(
      portalId,
      query,
      matchType,
      caseSensitive,
      {
        searchId: executionId,
        abortSignal: abortController.signal,
        onProgress: sendModuleSearchProgress,
      }
    );
    sendResponse({ type: 'DATAPOINT_SEARCH_RESULTS', payload: { results, indexInfo } });
  } catch (error) {
    sendResponse({
      type: 'DATAPOINT_SEARCH_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to search datapoints',
        code: 500,
      },
    });
  } finally {
    activeModuleSearches.delete(executionId);
  }
}

export function handleCancelModuleSearch(
  payload: { searchId: string },
  sendResponse: SendResponse,
  { activeModuleSearches }: HandlerContext
) {
  const { searchId } = payload;
  const execution = activeModuleSearches.get(searchId);
  if (execution) {
    execution.abort();
    activeModuleSearches.delete(searchId);
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false });
  }
}

export async function handleRefreshModuleIndex(
  payload: RefreshModuleIndexRequest,
  sendResponse: SendResponse,
  { moduleLoader, activeModuleSearches }: HandlerContext
) {
  const { portalId, searchId } = payload;
  const executionId = searchId || crypto.randomUUID();
  const existing = activeModuleSearches.get(executionId);
  if (existing) {
    existing.abort();
    activeModuleSearches.delete(executionId);
  }
  const abortController = new AbortController();
  activeModuleSearches.set(executionId, abortController);
  try {
    const indexInfo = await rebuildModuleIndex(portalId, moduleLoader, {
      searchId: executionId,
      abortSignal: abortController.signal,
      onProgress: sendModuleSearchProgress,
    });
    sendResponse({ type: 'MODULE_INDEX_REFRESHED', payload: indexInfo });
  } catch (error) {
    sendResponse({
      type: 'MODULE_SCRIPT_SEARCH_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to refresh module index',
        code: 500,
      },
    });
  } finally {
    activeModuleSearches.delete(executionId);
  }
}


export async function handleCreateModule(
  payload: { 
    portalId: string; 
    moduleType: LogicModuleType; 
    modulePayload: import('@/shared/types').CreateModulePayload;
  },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, moduleType, modulePayload } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    const tabId = await portalManager.getValidTabIdForPortal(portalId);
    if (!portal || !tabId) {
      console.error(`[SW] Portal not found or no tabs: portalId=${portalId}, tabIds=${portal?.tabIds.length || 0}`);
      sendResponse({ 
        type: 'MODULE_CREATE_ERROR', 
        payload: { error: 'Portal not found or no tabs available', code: 404 } 
      });
      return;
    }
    const csrfToken = await portalManager.getCsrfToken(portalId);
    const result = await createModule(
      portal.hostname, 
      csrfToken, 
      moduleType,
      modulePayload,
      tabId
    );
    if (result.success && result.moduleId) {
      sendResponse({ 
        type: 'MODULE_CREATED', 
        payload: { 
          moduleId: result.moduleId, 
          moduleName: result.moduleName,
          moduleType,
          portalId,
          portalHostname: portal.hostname,
        } 
      });
    } else {
      sendResponse({ 
        type: 'MODULE_CREATE_ERROR', 
        payload: { 
          error: result.error || 'Failed to create module',
          code: 500
        } 
      });
    }
  } catch (error) {
    console.error(`[SW] Error in CREATE_MODULE:`, error);
    sendResponse({ 
      type: 'MODULE_CREATE_ERROR', 
      payload: { 
        error: error instanceof Error ? error.message : 'Failed to create module',
        code: 500
      } 
    });
  }
}
