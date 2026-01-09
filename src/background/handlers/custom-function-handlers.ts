/**
 * Handlers for custom AppliesTo function messages.
 */

import type { HandlerContext, SendResponse } from './types';
import {
  fetchCustomFunctions,
  createCustomFunction,
  updateCustomFunction,
  deleteCustomFunction,
} from '../applies-to-functions-api';

export async function handleFetchCustomFunctions(
  payload: { portalId: string },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    if (!portal) {
      sendResponse({ 
        type: 'CUSTOM_FUNCTION_ERROR', 
        payload: { error: 'Portal not found', code: 404 } 
      });
      return;
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
}

export async function handleCreateCustomFunction(
  payload: { portalId: string; name: string; code: string; description?: string },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, name, code, description } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    if (!portal) {
      sendResponse({ 
        type: 'CUSTOM_FUNCTION_ERROR', 
        payload: { error: 'Portal not found', code: 404 } 
      });
      return;
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
}

export async function handleUpdateCustomFunction(
  payload: { portalId: string; functionId: number; name: string; code: string; description?: string },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, functionId, name, code, description } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    if (!portal) {
      sendResponse({ 
        type: 'CUSTOM_FUNCTION_ERROR', 
        payload: { error: 'Portal not found', code: 404 } 
      });
      return;
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
}

export async function handleDeleteCustomFunction(
  payload: { portalId: string; functionId: number },
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, functionId } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    if (!portal) {
      sendResponse({ 
        type: 'CUSTOM_FUNCTION_ERROR', 
        payload: { error: 'Portal not found', code: 404 } 
      });
      return;
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
}

