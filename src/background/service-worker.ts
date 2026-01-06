import { PortalManager } from './portal-manager';
import { ScriptExecutor, type ExecutorContext } from './script-executor';
import { ApiExecutor } from './api-executor';
import { ModuleLoader } from './module-loader';
import { isValidSender } from './sender-validation';
import { clearRateLimitState } from './rate-limiter';
// Initialize the health check script
import './health-check-script';
import type { 
  EditorToSWMessage, 
  ContentToSWMessage,
} from '@/shared/types';

// Import handlers
import {
  type HandlerContext,
  // Portal handlers
  handleDiscoverPortals,
  handleCsrfToken,
  handleGetCollectors,
  handleGetDevices,
  handleGetDeviceById,
  handleGetDeviceProperties,
  handleOpenEditor,
  openEditorWindow,
  // Execution handlers
  handleExecuteScript,
  handleExecuteApiRequest,
  handleCancelExecution,
  handleTestAppliesTo,
  handleExecuteDebugCommand,
  handleCancelDebugCommand,
  // Module handlers
  handleFetchModules,
  handleFetchModule,
  handleFetchLineageVersions,
  handleFetchModuleDetails,
  handleFetchAccessGroups,
  handleCommitModuleScript,
  handleSearchModuleScripts,
  handleSearchDatapoints,
  handleCancelModuleSearch,
  handleRefreshModuleIndex,
  // Custom function handlers
  handleFetchCustomFunctions,
  handleCreateCustomFunction,
  handleUpdateCustomFunction,
  handleDeleteCustomFunction,
  // Snippets handlers
  handleGetModuleSnippetsCache,
  handleClearModuleSnippetsCache,
  handleFetchModuleSnippets,
  handleFetchModuleSnippetSource,
} from './handlers';

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

// Active module searches for cancellation
const activeModuleSearches = new Map<string, AbortController>();

// Handler context for all message handlers
const handlerContext: HandlerContext = {
  portalManager,
  scriptExecutor,
  apiExecutor,
  moduleLoader,
  activeModuleSearches,
};

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
      // Portal handlers
      case 'DISCOVER_PORTALS':
        await handleDiscoverPortals(undefined, sendResponse, handlerContext);
        break;

      case 'CSRF_TOKEN':
        handleCsrfToken(message.payload, sendResponse, handlerContext);
        break;

      case 'OPEN_EDITOR':
        await handleOpenEditor((message as ContentToSWMessage).payload, sendResponse, handlerContext);
        break;

      case 'GET_COLLECTORS':
        await handleGetCollectors(message.payload, sendResponse, handlerContext);
        break;

      case 'GET_DEVICES':
        await handleGetDevices(message.payload, sendResponse, handlerContext);
        break;

      case 'GET_DEVICE_BY_ID':
        await handleGetDeviceById(message.payload, sendResponse, handlerContext);
        break;

      case 'GET_DEVICE_PROPERTIES':
        await handleGetDeviceProperties(message.payload, sendResponse, handlerContext);
        break;

      // Execution handlers
      case 'EXECUTE_SCRIPT':
        await handleExecuteScript(message.payload, sendResponse, handlerContext);
        break;

      case 'EXECUTE_API_REQUEST':
        await handleExecuteApiRequest(message.payload, sendResponse, handlerContext);
        break;

      case 'CANCEL_EXECUTION':
        handleCancelExecution(message.payload, sendResponse, handlerContext);
        break;

      case 'TEST_APPLIES_TO':
        await handleTestAppliesTo(message.payload, sendResponse, handlerContext);
        break;

      case 'EXECUTE_DEBUG_COMMAND':
        handleExecuteDebugCommand(message.payload, sendResponse, handlerContext);
        break;

      case 'CANCEL_DEBUG_COMMAND':
        handleCancelDebugCommand(message.payload, sendResponse, handlerContext);
        break;

      // Module handlers
      case 'FETCH_MODULES':
        await handleFetchModules(message.payload, sendResponse, handlerContext);
        break;

      case 'FETCH_MODULE':
        await handleFetchModule(message.payload, sendResponse, handlerContext);
        break;

      case 'FETCH_LINEAGE_VERSIONS':
        await handleFetchLineageVersions(message.payload, sendResponse, handlerContext);
        break;

      case 'FETCH_MODULE_DETAILS':
        await handleFetchModuleDetails(message.payload, sendResponse, handlerContext);
        break;

      case 'FETCH_ACCESS_GROUPS':
        await handleFetchAccessGroups(message.payload, sendResponse, handlerContext);
        break;

      case 'COMMIT_MODULE_SCRIPT':
        await handleCommitModuleScript(message.payload, sendResponse, handlerContext);
        break;

      case 'SEARCH_MODULE_SCRIPTS':
        await handleSearchModuleScripts(message.payload, sendResponse, handlerContext);
        break;

      case 'SEARCH_DATAPOINTS':
        await handleSearchDatapoints(message.payload, sendResponse, handlerContext);
        break;

      case 'CANCEL_MODULE_SEARCH':
        handleCancelModuleSearch(message.payload, sendResponse, handlerContext);
        break;

      case 'REFRESH_MODULE_INDEX':
        await handleRefreshModuleIndex(message.payload, sendResponse, handlerContext);
        break;

      // Custom function handlers
      case 'FETCH_CUSTOM_FUNCTIONS':
        await handleFetchCustomFunctions(message.payload, sendResponse, handlerContext);
        break;

      case 'CREATE_CUSTOM_FUNCTION':
        await handleCreateCustomFunction(message.payload, sendResponse, handlerContext);
        break;

      case 'UPDATE_CUSTOM_FUNCTION':
        await handleUpdateCustomFunction(message.payload, sendResponse, handlerContext);
        break;

      case 'DELETE_CUSTOM_FUNCTION':
        await handleDeleteCustomFunction(message.payload, sendResponse, handlerContext);
        break;

      // Snippets handlers
      case 'GET_MODULE_SNIPPETS_CACHE':
        await handleGetModuleSnippetsCache(undefined, sendResponse, handlerContext);
        break;

      case 'CLEAR_MODULE_SNIPPETS_CACHE':
        await handleClearModuleSnippetsCache(undefined, sendResponse, handlerContext);
        break;

      case 'FETCH_MODULE_SNIPPETS':
        await handleFetchModuleSnippets(message.payload, sendResponse, handlerContext);
        break;

      case 'FETCH_MODULE_SNIPPET_SOURCE':
        await handleFetchModuleSnippetSource(message.payload, sendResponse, handlerContext);
        break;

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
