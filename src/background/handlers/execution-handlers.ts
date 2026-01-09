/**
 * Handlers for script and API execution messages.
 */

import type { HandlerContext, SendResponse } from './types';
import type { 
  ExecuteScriptRequest, 
  ExecuteApiRequest,
  ExecuteDebugCommandRequest,
  TestAppliesToRequest,
} from '@/shared/types';

export async function handleExecuteScript(
  payload: ExecuteScriptRequest,
  sendResponse: SendResponse,
  { scriptExecutor }: HandlerContext
) {
  const result = await scriptExecutor.execute(payload);
  sendResponse({ type: 'EXECUTION_UPDATE', payload: result });
}

export async function handleExecuteApiRequest(
  payload: ExecuteApiRequest,
  sendResponse: SendResponse,
  { apiExecutor }: HandlerContext
) {
  const result = await apiExecutor.execute(payload);
  sendResponse({ type: 'API_RESPONSE', payload: result });
}

export function handleCancelExecution(
  payload: { executionId: string },
  sendResponse: SendResponse,
  { scriptExecutor }: HandlerContext
) {
  const { executionId } = payload;
  const cancelled = scriptExecutor.cancelExecution(executionId);
  sendResponse({ success: cancelled });
}

export async function handleTestAppliesTo(
  payload: TestAppliesToRequest,
  sendResponse: SendResponse,
  { portalManager }: HandlerContext
) {
  const { portalId, currentAppliesTo, testFrom } = payload;
  const response = await portalManager.testAppliesTo(portalId, currentAppliesTo, testFrom);
  if (response.result) {
    sendResponse({ type: 'APPLIES_TO_RESULT', payload: response.result });
  } else if (response.error) {
    sendResponse({ type: 'APPLIES_TO_ERROR', payload: response.error });
  } else {
    sendResponse({ type: 'ERROR', payload: { code: 'UNKNOWN', message: 'Unknown error testing AppliesTo' } });
  }
}

export function handleExecuteDebugCommand(
  payload: ExecuteDebugCommandRequest & { executionId?: string },
  sendResponse: SendResponse,
  { scriptExecutor }: HandlerContext
) {
  const executionId = payload.executionId || crypto.randomUUID();
  
  // Execute debug command asynchronously and send progress updates
  scriptExecutor.executeDebugCommand(
    { ...payload, executionId },
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
}

export function handleCancelDebugCommand(
  payload: { executionId: string },
  sendResponse: SendResponse,
  { scriptExecutor }: HandlerContext
) {
  const { executionId } = payload;
  const cancelled = scriptExecutor.cancelDebugExecution(executionId);
  sendResponse({ success: cancelled });
}

