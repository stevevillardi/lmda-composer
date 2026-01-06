/**
 * Typed Chrome messaging utility for communication between the editor and service worker.
 * 
 * This utility provides type-safe message passing with consistent error handling.
 */

import type { EditorToSWMessage, SWToEditorMessage } from '@/shared/types';

/**
 * Error response structure from the service worker.
 */
interface ErrorResponse {
  type: 'ERROR';
  payload: { code: string; message: string };
}

/**
 * Result type for message operations.
 */
export type MessageResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/**
 * Type helper to extract the response type for a given message type.
 * Maps message types to their expected response payload types.
 */
type ResponsePayloadFor<T extends EditorToSWMessage['type']> = 
  T extends 'DISCOVER_PORTALS' ? Extract<SWToEditorMessage, { type: 'PORTALS_UPDATE' }>['payload'] :
  T extends 'GET_COLLECTORS' ? Extract<SWToEditorMessage, { type: 'COLLECTORS_UPDATE' }>['payload'] :
  T extends 'GET_DEVICES' ? Extract<SWToEditorMessage, { type: 'DEVICES_UPDATE' }>['payload'] :
  T extends 'GET_DEVICE_BY_ID' ? Extract<SWToEditorMessage, { type: 'DEVICE_BY_ID_LOADED' }>['payload'] :
  T extends 'GET_DEVICE_PROPERTIES' ? Extract<SWToEditorMessage, { type: 'DEVICE_PROPERTIES_LOADED' }>['payload'] :
  T extends 'EXECUTE_SCRIPT' ? Extract<SWToEditorMessage, { type: 'EXECUTION_UPDATE' }>['payload'] :
  T extends 'EXECUTE_API_REQUEST' ? Extract<SWToEditorMessage, { type: 'API_RESPONSE' }>['payload'] :
  T extends 'FETCH_MODULES' ? Extract<SWToEditorMessage, { type: 'MODULES_FETCHED' }>['payload'] :
  T extends 'TEST_APPLIES_TO' ? Extract<SWToEditorMessage, { type: 'APPLIES_TO_RESULT' }>['payload'] :
  T extends 'FETCH_CUSTOM_FUNCTIONS' ? Extract<SWToEditorMessage, { type: 'CUSTOM_FUNCTIONS_LOADED' }>['payload'] :
  T extends 'CREATE_CUSTOM_FUNCTION' ? Extract<SWToEditorMessage, { type: 'CUSTOM_FUNCTION_CREATED' }>['payload'] :
  T extends 'UPDATE_CUSTOM_FUNCTION' ? Extract<SWToEditorMessage, { type: 'CUSTOM_FUNCTION_UPDATED' }>['payload'] :
  T extends 'DELETE_CUSTOM_FUNCTION' ? Extract<SWToEditorMessage, { type: 'CUSTOM_FUNCTION_DELETED' }>['payload'] :
  T extends 'FETCH_MODULE' ? Extract<SWToEditorMessage, { type: 'MODULE_FETCHED' }>['payload'] :
  T extends 'COMMIT_MODULE_SCRIPT' ? Extract<SWToEditorMessage, { type: 'MODULE_COMMITTED' }>['payload'] :
  T extends 'FETCH_LINEAGE_VERSIONS' ? Extract<SWToEditorMessage, { type: 'LINEAGE_VERSIONS_FETCHED' }>['payload'] :
  T extends 'FETCH_MODULE_DETAILS' ? Extract<SWToEditorMessage, { type: 'MODULE_DETAILS_FETCHED' }>['payload'] :
  T extends 'FETCH_ACCESS_GROUPS' ? Extract<SWToEditorMessage, { type: 'ACCESS_GROUPS_FETCHED' }>['payload'] :
  T extends 'FETCH_MODULE_SNIPPETS' ? Extract<SWToEditorMessage, { type: 'MODULE_SNIPPETS_FETCHED' }>['payload'] :
  T extends 'FETCH_MODULE_SNIPPET_SOURCE' ? Extract<SWToEditorMessage, { type: 'MODULE_SNIPPET_SOURCE_FETCHED' }>['payload'] :
  T extends 'GET_MODULE_SNIPPETS_CACHE' ? Extract<SWToEditorMessage, { type: 'MODULE_SNIPPETS_CACHE' }>['payload'] :
  unknown;

/**
 * Sends a typed message to the service worker and handles the response.
 * 
 * @param message - The message to send (must be a valid EditorToSWMessage)
 * @returns A result object with either the data or an error
 * 
 * @example
 * ```typescript
 * const result = await sendMessage({ type: 'DISCOVER_PORTALS' });
 * if (result.ok) {
 *   console.log('Portals:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function sendMessage<T extends EditorToSWMessage>(
  message: T
): Promise<MessageResult<ResponsePayloadFor<T['type']>>> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    
    if (!response) {
      return { 
        ok: false, 
        error: 'No response from service worker',
        code: 'NO_RESPONSE' 
      };
    }
    
    if (response.type === 'ERROR') {
      const errorResponse = response as ErrorResponse;
      return { 
        ok: false, 
        error: errorResponse.payload.message,
        code: errorResponse.payload.code 
      };
    }
    
    // Check for specific error response types
    if (response.type === 'APPLIES_TO_ERROR' || 
        response.type === 'CUSTOM_FUNCTION_ERROR' ||
        response.type === 'MODULE_SNIPPETS_ERROR') {
      return {
        ok: false,
        error: response.payload?.error || response.payload?.message || 'Unknown error',
        code: response.payload?.code?.toString()
      };
    }
    
    return { ok: true, data: response.payload };
  } catch (error) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'EXCEPTION'
    };
  }
}

/**
 * Sends a message and returns only the payload if successful.
 * Throws an error if the message fails.
 * 
 * @param message - The message to send
 * @throws Error if the message fails
 * @returns The response payload
 * 
 * @example
 * ```typescript
 * try {
 *   const portals = await sendMessageOrThrow({ type: 'DISCOVER_PORTALS' });
 *   console.log('Portals:', portals);
 * } catch (error) {
 *   console.error('Failed:', error.message);
 * }
 * ```
 */
export async function sendMessageOrThrow<T extends EditorToSWMessage>(
  message: T
): Promise<ResponsePayloadFor<T['type']>> {
  const result = await sendMessage(message);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Type guard to check if a response is an error response.
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'type' in response &&
    (response as { type: unknown }).type === 'ERROR'
  );
}

/**
 * Checks if a response payload exists (not null/undefined).
 * Useful for checking successful responses before processing.
 */
export function hasPayload<T>(response: { payload?: T }): response is { payload: T } {
  return response.payload !== undefined && response.payload !== null;
}

// ============================================================================
// Type Guards for Runtime Validation
// ============================================================================

/**
 * Validates that a value is a plain object (not null, not array).
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates that a response has the expected structure with type and payload.
 */
export function isValidResponse(response: unknown): response is { type: string; payload: unknown } {
  return (
    isPlainObject(response) &&
    typeof response.type === 'string' &&
    'payload' in response
  );
}

/**
 * Type guard for portal array responses.
 */
export function isPortalArray(payload: unknown): payload is Array<{ id: string; hostname: string }> {
  if (!Array.isArray(payload)) return false;
  return payload.every(item => 
    isPlainObject(item) && 
    typeof item.id === 'string' && 
    typeof item.hostname === 'string'
  );
}

/**
 * Type guard for collector array responses.
 */
export function isCollectorArray(payload: unknown): payload is Array<{ id: number; description: string }> {
  if (!Array.isArray(payload)) return false;
  return payload.every(item => 
    isPlainObject(item) && 
    typeof item.id === 'number' && 
    typeof item.description === 'string'
  );
}

/**
 * Type guard for module details response.
 */
export function isModuleDetailsPayload(payload: unknown): payload is { module: Record<string, unknown> } {
  return (
    isPlainObject(payload) &&
    'module' in payload &&
    isPlainObject(payload.module)
  );
}

/**
 * Type guard for access groups response.
 */
export function isAccessGroupsPayload(payload: unknown): payload is { accessGroups: Array<{ id: number; name: string }> } {
  if (!isPlainObject(payload)) return false;
  if (!('accessGroups' in payload)) return false;
  const groups = payload.accessGroups;
  if (!Array.isArray(groups)) return false;
  return groups.every(g => 
    isPlainObject(g) && 
    typeof g.id === 'number' && 
    typeof g.name === 'string'
  );
}

/**
 * Type guard for execution result response.
 */
export function isExecutionResult(payload: unknown): payload is { status: string; output?: string; exitCode?: number } {
  return (
    isPlainObject(payload) &&
    typeof payload.status === 'string'
  );
}

/**
 * Type guard for error payloads.
 */
export function isErrorPayload(payload: unknown): payload is { error: string; code?: number | string } {
  return (
    isPlainObject(payload) &&
    typeof payload.error === 'string'
  );
}

/**
 * Validates a response and extracts the payload with type safety.
 * Returns null if validation fails.
 */
export function validateResponse<T>(
  response: unknown,
  expectedType: string,
  payloadValidator?: (payload: unknown) => payload is T
): T | null {
  if (!isValidResponse(response)) return null;
  if (response.type !== expectedType) return null;
  if (payloadValidator && !payloadValidator(response.payload)) return null;
  return response.payload as T;
}

