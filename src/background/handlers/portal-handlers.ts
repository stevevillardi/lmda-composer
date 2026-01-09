/**
 * Handlers for portal-related messages.
 */

import type { HandlerContext, SendResponse } from './types';
import type { 
  FetchDevicesRequest, 
  FetchDeviceByIdRequest, 
  FetchDevicePropertiesRequest,
  DeviceContext,
} from '@/shared/types';

export async function handleDiscoverPortals(
  _payload: undefined,
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const portals = await portalManager.discoverPortals();
  sendResponse({ type: 'PORTALS_UPDATE', payload: portals });
}

export function handleCsrfToken(
  payload: { portalId: string; token: string },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, token } = payload;
  portalManager.receiveCsrfTokenFromContentScript(portalId, token)
    .then(() => sendResponse({ success: true }))
    .catch(() => sendResponse({ success: true }));
}

export async function handleGetCollectors(
  payload: { portalId: string },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId } = payload;
  const collectors = await portalManager.getCollectors(portalId);
  sendResponse({ type: 'COLLECTORS_UPDATE', payload: collectors });
}

export async function handleGetDevices(
  payload: FetchDevicesRequest,
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, collectorId } = payload;
  const response = await portalManager.getDevices(portalId, collectorId);
  sendResponse({ type: 'DEVICES_UPDATE', payload: response });
}

export async function handleGetDeviceById(
  payload: FetchDeviceByIdRequest,
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, resourceId } = payload;
  const device = await portalManager.getDeviceById(portalId, resourceId);
  if (device) {
    sendResponse({ type: 'DEVICE_BY_ID_LOADED', payload: device });
  } else {
    sendResponse({ type: 'ERROR', payload: { code: 'DEVICE_NOT_FOUND', message: `Device ${resourceId} not found` } });
  }
}

export async function handleGetDeviceProperties(
  payload: FetchDevicePropertiesRequest,
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, deviceId } = payload;
  const properties = await portalManager.getDeviceProperties(portalId, deviceId);
  sendResponse({ type: 'DEVICE_PROPERTIES_LOADED', payload: properties });
}

export async function handleOpenEditor(
  payload: DeviceContext | undefined,
  sendResponse: SendResponse,
  _context: HandlerContext
) {
  await openEditorWindow(payload);
  sendResponse({ success: true });
}

// Helper function for opening editor window
async function openEditorWindow(context?: DeviceContext) {
  const url = new URL(chrome.runtime.getURL('src/editor/index.html'));
  
  if (context) {
    if (context.portalId) url.searchParams.set('portal', context.portalId);
    if (context.resourceId) url.searchParams.set('resourceId', context.resourceId.toString());
    if (context.dataSourceId) url.searchParams.set('dataSourceId', context.dataSourceId.toString());
    if (context.collectMethod) url.searchParams.set('collectMethod', context.collectMethod);
    if (context.moduleType && context.moduleId) {
      url.searchParams.set('moduleType', context.moduleType);
      url.searchParams.set('moduleId', context.moduleId.toString());
    }
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

export { openEditorWindow };

