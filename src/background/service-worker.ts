import { PortalManager } from './portal-manager';
import { ScriptExecutor, type ExecutorContext } from './script-executor';
import { ModuleLoader } from './module-loader';
import type { 
  EditorToSWMessage, 
  ContentToSWMessage,
  DeviceContext,
  ExecuteScriptRequest,
  FetchModulesRequest,
  FetchDevicesRequest,
  FetchDeviceByIdRequest,
  FetchDevicePropertiesRequest,
  TestAppliesToRequest,
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

/**
 * Validate that a message sender is trusted.
 * Only accept messages from:
 * - Our own extension (editor window)
 * - LogicMonitor pages (content scripts)
 */
function isValidSender(sender: chrome.runtime.MessageSender): boolean {
  // Messages from our own extension (editor window)
  if (sender.id === chrome.runtime.id) {
    return true;
  }
  
  // Messages from content scripts on LogicMonitor pages
  if (sender.url) {
    try {
      const url = new URL(sender.url);
      // Allow logicmonitor.com and our extension URLs
      if (url.hostname.endsWith('logicmonitor.com') || 
          url.protocol === 'chrome-extension:') {
        return true;
      }
    } catch {
      // Invalid URL, reject
      return false;
    }
  }
  
  // Reject all other sources
  console.warn('Rejected message from untrusted sender:', sender);
  return false;
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

      case 'CANCEL_EXECUTION': {
        const { executionId } = message.payload;
        const cancelled = scriptExecutor.cancelExecution(executionId);
        sendResponse({ success: cancelled });
        break;
      }

      case 'FETCH_MODULES': {
        const { portalId, moduleType } = message.payload as FetchModulesRequest;
        const response = await moduleLoader.fetchModules(portalId, moduleType);
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

// Open the editor in a new tab
async function openEditorWindow(context?: DeviceContext) {
  const url = new URL(chrome.runtime.getURL('src/editor/index.html'));
  
  if (context) {
    if (context.portalId) url.searchParams.set('portal', context.portalId);
    if (context.resourceId) url.searchParams.set('resourceId', context.resourceId.toString());
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

// Handle extension icon click
chrome.action.onClicked.addListener(async () => {
  await openEditorWindow();
});

// Handle tab updates for portal detection
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('logicmonitor.com')) {
    await portalManager.discoverPortals();
  }
});

// Handle tab removal - clean up stale tab IDs from portals
chrome.tabs.onRemoved.addListener((tabId) => {
  portalManager.handleTabRemoved(tabId);
});
