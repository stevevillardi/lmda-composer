import { PortalManager } from './portal-manager';
import { ScriptExecutor, type ExecutorContext } from './script-executor';
import { ApiExecutor } from './api-executor';
import { ModuleLoader } from './module-loader';
import {
  getIndexInfo,
  rebuildModuleIndex,
  searchDatapointsFromIndex,
  searchModuleScriptsFromIndex,
} from './module-search-index';
import { isValidSender } from './sender-validation';
import { clearRateLimitState } from './rate-limiter';
import {
  fetchCustomFunctions,
  createCustomFunction,
  updateCustomFunction,
  deleteCustomFunction,
} from './applies-to-functions-api';
import {
  fetchModuleById,
  commitModuleScript,
  fetchLineageVersions,
  fetchModuleDetails,
  fetchAccessGroups,
} from './module-api';
import type { 
  EditorToSWMessage, 
  ContentToSWMessage,
  DeviceContext,
  ExecuteScriptRequest,
  ExecuteApiRequest,
  FetchModulesRequest,
  FetchDevicesRequest,
  FetchDeviceByIdRequest,
  FetchDevicePropertiesRequest,
  TestAppliesToRequest,
  ExecuteDebugCommandRequest,
  SearchModuleScriptsRequest,
  SearchDatapointsRequest,
  LogicModuleType,
  ModuleIndexInfo,
  ModuleSearchProgress,
  RefreshModuleIndexRequest,
} from '@/shared/types';

// Initialize managers
const portalManager = new PortalManager();
const moduleLoader = new ModuleLoader(portalManager);

// Load persisted portal state on service worker startup
portalManager.initialize().catch((err) => {
  console.error('Failed to initialize PortalManager:', err);
});

// Create executor context that bridges to PortalManager
const executorContext: ExecutorContext = {
  getCsrfToken: (portalId: string) => portalManager.getCsrfToken(portalId),
  refreshCsrfToken: (portalId: string) => portalManager.refreshCsrfTokenForPortal(portalId),
  discoverPortals: async () => { await portalManager.discoverPortals(); },
};

const scriptExecutor = new ScriptExecutor(executorContext);
const apiExecutor = new ApiExecutor(executorContext);

const activeModuleSearches = new Map<string, AbortController>();
const ACTION_ICON_PATHS = {
  16: 'src/assets/icon16.png',
  48: 'src/assets/icon48.png',
  128: 'src/assets/icon128.png',
};

async function ensureActionIcon(): Promise<void> {
  try {
    await chrome.action.setIcon({ path: ACTION_ICON_PATHS });
  } catch (error) {
    console.warn('Failed to set action icon:', error);
  }
}

function sendModuleSearchProgress(progress: ModuleSearchProgress) {
  chrome.runtime.sendMessage({
    type: 'MODULE_SEARCH_PROGRESS',
    payload: progress,
  }).catch(() => {
    // Ignore errors if no listener (editor window might be closed)
  });
}

// Handle messages from content scripts and editor
chrome.runtime.onMessage.addListener((
  message: EditorToSWMessage | ContentToSWMessage,
  sender,
  sendResponse
) => {
  // Validate sender before processing
  if (!isValidSender(sender)) {
    sendResponse({ 
      type: 'ERROR', 
      payload: { code: 'UNAUTHORIZED', message: 'Message rejected: untrusted sender' } 
    });
    return true;
  }
  
  handleMessage(message, sendResponse);
  return true; // Keep the message channel open for async response
});

async function handleMessage(
  message: EditorToSWMessage | ContentToSWMessage,
  sendResponse: (response: unknown) => void
) {
  try {
    switch (message.type) {
      case 'DISCOVER_PORTALS': {
        const portals = await portalManager.discoverPortals();
        sendResponse({ type: 'PORTALS_UPDATE', payload: portals });
        break;
      }

      case 'CSRF_TOKEN': {
        const { portalId, token } = message.payload;
        portalManager.updateCsrfToken(portalId, token);
        sendResponse({ success: true });
        break;
      }

      case 'OPEN_EDITOR': {
        const context = (message as ContentToSWMessage).payload as DeviceContext | undefined;
        await openEditorWindow(context);
        sendResponse({ success: true });
        break;
      }

      case 'GET_COLLECTORS': {
        const { portalId } = message.payload;
        const collectors = await portalManager.getCollectors(portalId);
        sendResponse({ type: 'COLLECTORS_UPDATE', payload: collectors });
        break;
      }

      case 'GET_DEVICES': {
        const { portalId, collectorId } = message.payload as FetchDevicesRequest;
        const response = await portalManager.getDevices(portalId, collectorId);
        sendResponse({ type: 'DEVICES_UPDATE', payload: response });
        break;
      }

      case 'GET_DEVICE_BY_ID': {
        const { portalId, resourceId } = message.payload as FetchDeviceByIdRequest;
        const device = await portalManager.getDeviceById(portalId, resourceId);
        if (device) {
          sendResponse({ type: 'DEVICE_BY_ID_LOADED', payload: device });
        } else {
          sendResponse({ type: 'ERROR', payload: { code: 'DEVICE_NOT_FOUND', message: `Device ${resourceId} not found` } });
        }
        break;
      }

      case 'GET_DEVICE_PROPERTIES': {
        const { portalId, deviceId } = message.payload as FetchDevicePropertiesRequest;
        const properties = await portalManager.getDeviceProperties(portalId, deviceId);
        sendResponse({ type: 'DEVICE_PROPERTIES_LOADED', payload: properties });
        break;
      }

      case 'EXECUTE_SCRIPT': {
        const request = message.payload as ExecuteScriptRequest;
        const result = await scriptExecutor.execute(request);
        sendResponse({ type: 'EXECUTION_UPDATE', payload: result });
        break;
      }

      case 'EXECUTE_API_REQUEST': {
        const request = message.payload as ExecuteApiRequest;
        const result = await apiExecutor.execute(request);
        sendResponse({ type: 'API_RESPONSE', payload: result });
        break;
      }

      case 'CANCEL_EXECUTION': {
        const { executionId } = message.payload;
        const cancelled = scriptExecutor.cancelExecution(executionId);
        sendResponse({ success: cancelled });
        break;
      }

      case 'FETCH_MODULES': {
        const { portalId, moduleType, offset, size, search } = message.payload as FetchModulesRequest;
        const response = await moduleLoader.fetchModules(portalId, moduleType, offset, size, search);
        sendResponse({ type: 'MODULES_FETCHED', payload: response });
        break;
      }

      case 'TEST_APPLIES_TO': {
        const { portalId, currentAppliesTo, testFrom } = message.payload as TestAppliesToRequest;
        const response = await portalManager.testAppliesTo(portalId, currentAppliesTo, testFrom);
        if (response.result) {
          sendResponse({ type: 'APPLIES_TO_RESULT', payload: response.result });
        } else if (response.error) {
          sendResponse({ type: 'APPLIES_TO_ERROR', payload: response.error });
        } else {
          sendResponse({ type: 'ERROR', payload: { code: 'UNKNOWN', message: 'Unknown error testing AppliesTo' } });
        }
        break;
      }

      case 'FETCH_CUSTOM_FUNCTIONS': {
        const { portalId } = message.payload as { portalId: string };
        try {
          const portal = portalManager.getPortal(portalId);
          if (!portal) {
            sendResponse({ 
              type: 'CUSTOM_FUNCTION_ERROR', 
              payload: { error: 'Portal not found', code: 404 } 
            });
            break;
          }
          const csrfToken = await portalManager.getCsrfToken(portalId);
          const functions = await fetchCustomFunctions(portal.hostname, csrfToken);
          sendResponse({ type: 'CUSTOM_FUNCTIONS_LOADED', payload: functions });
        } catch (error) {
          sendResponse({ 
            type: 'CUSTOM_FUNCTION_ERROR', 
            payload: { 
              error: error instanceof Error ? error.message : 'Failed to fetch custom functions',
              code: 500
            } 
          });
        }
        break;
      }

      case 'CREATE_CUSTOM_FUNCTION': {
        const { portalId, name, code, description } = message.payload as { 
          portalId: string; 
          name: string; 
          code: string; 
          description?: string;
        };
        try {
          const portal = portalManager.getPortal(portalId);
          if (!portal) {
            sendResponse({ 
              type: 'CUSTOM_FUNCTION_ERROR', 
              payload: { error: 'Portal not found', code: 404 } 
            });
            break;
          }
          const csrfToken = await portalManager.getCsrfToken(portalId);
          const createdFunction = await createCustomFunction(portal.hostname, csrfToken, { name, code, description });
          sendResponse({ type: 'CUSTOM_FUNCTION_CREATED', payload: createdFunction });
        } catch (error) {
          sendResponse({ 
            type: 'CUSTOM_FUNCTION_ERROR', 
            payload: { 
              error: error instanceof Error ? error.message : 'Failed to create custom function',
              code: 500
            } 
          });
        }
        break;
      }

      case 'UPDATE_CUSTOM_FUNCTION': {
        const { portalId, functionId, name, code, description } = message.payload as { 
          portalId: string; 
          functionId: number; 
          name: string; 
          code: string; 
          description?: string;
        };
        try {
          const portal = portalManager.getPortal(portalId);
          if (!portal) {
            sendResponse({ 
              type: 'CUSTOM_FUNCTION_ERROR', 
              payload: { error: 'Portal not found', code: 404 } 
            });
            break;
          }
          const csrfToken = await portalManager.getCsrfToken(portalId);
          const updatedFunction = await updateCustomFunction(portal.hostname, csrfToken, functionId, { name, code, description });
          sendResponse({ type: 'CUSTOM_FUNCTION_UPDATED', payload: updatedFunction });
        } catch (error) {
          sendResponse({ 
            type: 'CUSTOM_FUNCTION_ERROR', 
            payload: { 
              error: error instanceof Error ? error.message : 'Failed to update custom function',
              code: 500
            } 
          });
        }
        break;
      }

      case 'DELETE_CUSTOM_FUNCTION': {
        const { portalId, functionId } = message.payload as { portalId: string; functionId: number };
        try {
          const portal = portalManager.getPortal(portalId);
          if (!portal) {
            sendResponse({ 
              type: 'CUSTOM_FUNCTION_ERROR', 
              payload: { error: 'Portal not found', code: 404 } 
            });
            break;
          }
          const csrfToken = await portalManager.getCsrfToken(portalId);
          await deleteCustomFunction(portal.hostname, csrfToken, functionId);
          sendResponse({ type: 'CUSTOM_FUNCTION_DELETED', payload: { functionId } });
        } catch (error) {
          sendResponse({ 
            type: 'CUSTOM_FUNCTION_ERROR', 
            payload: { 
              error: error instanceof Error ? error.message : 'Failed to delete custom function',
              code: 500
            } 
          });
        }
        break;
      }

      case 'EXECUTE_DEBUG_COMMAND': {
        const request = message.payload as ExecuteDebugCommandRequest & { executionId?: string };
        const executionId = request.executionId || crypto.randomUUID();
        
        // Execute debug command asynchronously and send progress updates
        scriptExecutor.executeDebugCommand(
          { ...request, executionId },
          (collectorId, attempt, maxAttempts) => {
            // Send progress update
            chrome.runtime.sendMessage({
              type: 'DEBUG_COMMAND_UPDATE',
              payload: { collectorId, attempt, maxAttempts },
              executionId
            }).catch(() => {
              // Ignore errors if no listener (editor window might be closed)
            });
          },
          () => {
            // Individual collector complete - we'll send final complete message when all done
          }
        ).then((results) => {
          // Send final results
          chrome.runtime.sendMessage({
            type: 'DEBUG_COMMAND_COMPLETE',
            payload: { results },
            executionId
          }).catch(() => {
            // Ignore errors if no listener
          });
        }).catch((error) => {
          chrome.runtime.sendMessage({
            type: 'ERROR',
            payload: {
              code: 'DEBUG_COMMAND_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error executing debug command'
            },
            executionId
          }).catch(() => {
            // Ignore errors if no listener
          });
        });
        
        sendResponse({ success: true, executionId });
        return true;
      }

      case 'CANCEL_DEBUG_COMMAND': {
        const { executionId } = message.payload as { executionId: string };
        const cancelled = scriptExecutor.cancelDebugExecution(executionId);
        sendResponse({ success: cancelled });
        break;
      }

      case 'FETCH_MODULE': {
        const { portalId, moduleType, moduleId } = message.payload as { 
          portalId: string; 
          moduleType: LogicModuleType; 
          moduleId: number;
        };
        try {
          const portal = portalManager.getPortal(portalId);
          const tabId = await portalManager.getValidTabIdForPortal(portalId);
          if (!portal || !tabId) {
            sendResponse({ 
              type: 'MODULE_ERROR', 
              payload: { error: 'Portal not found or no tabs available', code: 404 } 
            });
            break;
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
        break;
      }

      case 'FETCH_LINEAGE_VERSIONS': {
        const { portalId, moduleType, lineageId } = message.payload as {
          portalId: string;
          moduleType: LogicModuleType;
          lineageId: string;
        };
        try {
          const portal = portalManager.getPortal(portalId);
          const tabId = await portalManager.getValidTabIdForPortal(portalId);
          if (!portal || !tabId) {
            sendResponse({
              type: 'LINEAGE_ERROR',
              payload: { error: 'Portal not found or no tabs available', code: 404 },
            });
            break;
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
        break;
      }

      case 'SEARCH_MODULE_SCRIPTS': {
        const { portalId, query, matchType, caseSensitive, moduleTypes, searchId, forceReindex } =
          message.payload as SearchModuleScriptsRequest;
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
        break;
      }

      case 'SEARCH_DATAPOINTS': {
        const { portalId, query, matchType, caseSensitive, searchId, forceReindex } =
          message.payload as SearchDatapointsRequest;
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
        break;
      }

      case 'CANCEL_MODULE_SEARCH': {
        const { searchId } = message.payload as { searchId: string };
        const execution = activeModuleSearches.get(searchId);
        if (execution) {
          execution.abort();
          activeModuleSearches.delete(searchId);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
        break;
      }

      case 'REFRESH_MODULE_INDEX': {
        const { portalId, searchId } = message.payload as RefreshModuleIndexRequest;
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
        break;
      }

      case 'FETCH_MODULE_DETAILS': {
        const { portalId, moduleType, moduleId, tabId } = message.payload as {
          portalId: string;
          moduleType: LogicModuleType;
          moduleId: number;
          tabId: number;
        };
        try {
          const portal = portalManager.getPortal(portalId);
          if (!portal) {
            sendResponse({
              type: 'MODULE_DETAILS_ERROR',
              payload: { error: 'Portal not found', code: 404 },
            });
            break;
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
        break;
      }

      case 'FETCH_ACCESS_GROUPS': {
        const { portalId, tabId } = message.payload as {
          portalId: string;
          tabId: number;
        };
        try {
          const portal = portalManager.getPortal(portalId);
          if (!portal) {
            sendResponse({
              type: 'ACCESS_GROUPS_ERROR',
              payload: { error: 'Portal not found', code: 404 },
            });
            break;
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
        break;
      }

      case 'COMMIT_MODULE_SCRIPT': {
        const { portalId, moduleType, moduleId, scriptType, newScript, moduleDetails, reason } = message.payload as { 
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
          }>;
          reason?: string;
        };
        console.log(`[SW] COMMIT_MODULE_SCRIPT: portalId=${portalId}, moduleType=${moduleType}, moduleId=${moduleId}, scriptType=${scriptType}, hasScriptChanges=${newScript !== undefined}, hasModuleDetails=${!!moduleDetails}, hasReason=${!!reason}`);
        try {
          const portal = portalManager.getPortal(portalId);
          const tabId = await portalManager.getValidTabIdForPortal(portalId);
          if (!portal || !tabId) {
            console.error(`[SW] Portal not found or no tabs: portalId=${portalId}, tabIds=${portal?.tabIds.length || 0}`);
            sendResponse({ 
              type: 'MODULE_ERROR', 
              payload: { error: 'Portal not found or no tabs available', code: 404 } 
            });
            break;
          }
          console.log(`[SW] Portal found, tabIds:`, portal.tabIds);
          const csrfToken = await portalManager.getCsrfToken(portalId);
          console.log(`[SW] CSRF token:`, csrfToken ? 'present' : 'missing');
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
          console.log(`[SW] Commit result:`, result);
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
        break;
      }

      default:
        console.warn('Unknown message type:', message);
        sendResponse({ type: 'ERROR', payload: { code: 'UNKNOWN_MESSAGE', message: 'Unknown message type' } });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ 
      type: 'ERROR', 
      payload: { 
        code: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      } 
    });
  }
}

function openOnboardingPage() {
  const url = chrome.runtime.getURL('src/onboarding/index.html');
  chrome.tabs.create({ url, active: true });
}

// Open the editor in a new tab
async function openEditorWindow(context?: DeviceContext) {
  const url = new URL(chrome.runtime.getURL('src/editor/index.html'));
  
  if (context) {
    if (context.portalId) url.searchParams.set('portal', context.portalId);
    if (context.resourceId) url.searchParams.set('resourceId', context.resourceId.toString());
    if (context.dataSourceId) url.searchParams.set('dataSourceId', context.dataSourceId.toString());
    if (context.collectMethod) url.searchParams.set('collectMethod', context.collectMethod);
  }

  // Check if there's already an LogicMonitor IDE tab open
  const existingTabs = await chrome.tabs.query({ 
    url: chrome.runtime.getURL('src/editor/index.html') + '*' 
  });

  if (existingTabs.length > 0 && existingTabs[0].id) {
    // Update the existing tab's URL with new context (this triggers re-read of params)
    // Then focus it
    await chrome.tabs.update(existingTabs[0].id, { 
      url: url.toString(),
      active: true 
    });
    if (existingTabs[0].windowId) {
      await chrome.windows.update(existingTabs[0].windowId, { focused: true });
    }
  } else {
    // Open in a new tab
    await chrome.tabs.create({
      url: url.toString(),
      active: true,
    });
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureActionIcon();
  if (details.reason === 'install') {
    openOnboardingPage();
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureActionIcon();
});

// Handle extension icon click
chrome.action.onClicked.addListener(async () => {
  await openEditorWindow();
});

// Handle tab updates for portal detection
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  try {
    const url = tab.url ? new URL(tab.url) : null;
    if (url?.hostname.endsWith('.logicmonitor.com')) {
      await portalManager.discoverPortals();
    }
  } catch {
    // Ignore invalid URLs
  }
});

// Handle tab removal - clean up stale tab IDs from portals
chrome.tabs.onRemoved.addListener((tabId) => {
  const { deletedPortal } = portalManager.handleTabRemoved(tabId);
  
  // If a portal was deleted (lost all tabs), notify the editor
  if (deletedPortal) {
    clearRateLimitState(deletedPortal.hostname);
    chrome.runtime.sendMessage({
      type: 'PORTAL_DISCONNECTED',
      payload: {
        portalId: deletedPortal.id,
        hostname: deletedPortal.hostname,
      },
    }).catch(() => {
      // Ignore errors if no listener (editor window might be closed)
    });
  }
});
