import { PortalManager } from './portal-manager';
import type { 
  EditorToSWMessage, 
  ContentToSWMessage,
  DeviceContext 
} from '@/shared/types';

// Initialize managers
const portalManager = new PortalManager();

// Handle messages from content scripts and editor
chrome.runtime.onMessage.addListener((
  message: EditorToSWMessage | ContentToSWMessage,
  _sender,
  sendResponse
) => {
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
        console.log('GET_COLLECTORS request for portal:', portalId);
        const collectors = await portalManager.getCollectors(portalId);
        console.log('GET_COLLECTORS response:', collectors.length, 'collectors');
        sendResponse({ type: 'COLLECTORS_UPDATE', payload: collectors });
        break;
      }

      case 'EXECUTE_SCRIPT': {
        // TODO: Implement in Phase 2
        sendResponse({ type: 'ERROR', payload: { code: 'NOT_IMPLEMENTED', message: 'Execute script not yet implemented' } });
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
    if (context.hostname) url.searchParams.set('host', context.hostname);
    if (context.deviceId) url.searchParams.set('deviceId', context.deviceId.toString());
    if (context.collectorId) url.searchParams.set('collectorId', context.collectorId.toString());
  }

  // Check if there's already an LM IDE tab open
  const existingTabs = await chrome.tabs.query({ 
    url: chrome.runtime.getURL('src/editor/index.html') + '*' 
  });

  if (existingTabs.length > 0 && existingTabs[0].id) {
    // Focus the existing tab
    await chrome.tabs.update(existingTabs[0].id, { active: true });
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

console.log('LM IDE Service Worker initialized');
