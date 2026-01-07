/**
 * Tests for chrome-messaging utility.
 * 
 * Tests type guards, message sending, and response validation.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { 
  sendMessage,
  sendMessageOrThrow,
  sendMessageIgnoreError,
  isErrorResponse,
  hasPayload,
  isPlainObject,
  isValidResponse,
  isPortalArray,
  isCollectorArray,
  isModuleDetailsPayload,
  isAccessGroupsPayload,
  isExecutionResult,
  isErrorPayload,
  validateResponse,
} from '../../src/editor/utils/chrome-messaging';
import { resetChromeMocks, getChromeMock } from '../setup';

describe('chrome-messaging', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  // ===========================================================================
  // Type Guards - isPlainObject
  // ===========================================================================
  describe('isPlainObject', () => {
    it('returns true for plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ foo: 'bar' })).toBe(true);
      expect(isPlainObject({ nested: { value: 1 } })).toBe(true);
    });

    it('returns false for null', () => {
      expect(isPlainObject(null)).toBe(false);
    });

    it('returns false for arrays', () => {
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject([1, 2, 3])).toBe(false);
    });

    it('returns false for primitives', () => {
      expect(isPlainObject(undefined)).toBe(false);
      expect(isPlainObject('string')).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject(true)).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - isValidResponse
  // ===========================================================================
  describe('isValidResponse', () => {
    it('returns true for valid response objects', () => {
      expect(isValidResponse({ type: 'TEST', payload: {} })).toBe(true);
      expect(isValidResponse({ type: 'SUCCESS', payload: null })).toBe(true);
      expect(isValidResponse({ type: 'DATA', payload: [1, 2, 3] })).toBe(true);
    });

    it('returns false when type is missing or not a string', () => {
      expect(isValidResponse({ payload: {} })).toBe(false);
      expect(isValidResponse({ type: 123, payload: {} })).toBe(false);
    });

    it('returns false when payload is missing', () => {
      expect(isValidResponse({ type: 'TEST' })).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isValidResponse(null)).toBe(false);
      expect(isValidResponse('string')).toBe(false);
      expect(isValidResponse([])).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - isErrorResponse
  // ===========================================================================
  describe('isErrorResponse', () => {
    it('identifies error responses', () => {
      expect(isErrorResponse({ type: 'ERROR', payload: { code: 'E1', message: 'Test' } })).toBe(true);
    });

    it('rejects non-error responses', () => {
      expect(isErrorResponse({ type: 'SUCCESS', payload: {} })).toBe(false);
      expect(isErrorResponse({ type: 'error' })).toBe(false); // lowercase
      expect(isErrorResponse(null)).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - hasPayload
  // ===========================================================================
  describe('hasPayload', () => {
    it('returns true when payload exists', () => {
      expect(hasPayload({ payload: {} })).toBe(true);
      expect(hasPayload({ payload: 'data' })).toBe(true);
      expect(hasPayload({ payload: 0 })).toBe(true); // falsy but present
      expect(hasPayload({ payload: false })).toBe(true);
    });

    it('returns false for null/undefined payload', () => {
      expect(hasPayload({ payload: null })).toBe(false);
      expect(hasPayload({ payload: undefined })).toBe(false);
      expect(hasPayload({})).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - isPortalArray
  // ===========================================================================
  describe('isPortalArray', () => {
    it('validates portal array structure', () => {
      expect(isPortalArray([
        { id: 'p1', hostname: 'test.logicmonitor.com' },
        { id: 'p2', hostname: 'demo.logicmonitor.com' },
      ])).toBe(true);
    });

    it('rejects invalid portal arrays', () => {
      expect(isPortalArray([])).toBe(true); // Empty is valid
      expect(isPortalArray([{ id: 'p1' }])).toBe(false); // Missing hostname
      expect(isPortalArray([{ id: 1, hostname: 'test.com' }])).toBe(false); // id must be string
      expect(isPortalArray('not an array')).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - isCollectorArray
  // ===========================================================================
  describe('isCollectorArray', () => {
    it('validates collector array structure', () => {
      expect(isCollectorArray([
        { id: 1, description: 'Collector 1' },
        { id: 2, description: 'Collector 2' },
      ])).toBe(true);
    });

    it('rejects invalid collector arrays', () => {
      expect(isCollectorArray([{ id: 'str', description: 'Test' }])).toBe(false); // id must be number
      expect(isCollectorArray([{ id: 1 }])).toBe(false); // Missing description
      expect(isCollectorArray({})).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - isModuleDetailsPayload
  // ===========================================================================
  describe('isModuleDetailsPayload', () => {
    it('validates module details payload', () => {
      expect(isModuleDetailsPayload({ module: { id: 1, name: 'Test' } })).toBe(true);
      expect(isModuleDetailsPayload({ module: {} })).toBe(true);
    });

    it('rejects invalid payloads', () => {
      expect(isModuleDetailsPayload({})).toBe(false);
      expect(isModuleDetailsPayload({ module: null })).toBe(false);
      expect(isModuleDetailsPayload({ module: [] })).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - isAccessGroupsPayload
  // ===========================================================================
  describe('isAccessGroupsPayload', () => {
    it('validates access groups payload', () => {
      expect(isAccessGroupsPayload({ 
        accessGroups: [{ id: 1, name: 'Admin' }, { id: 2, name: 'User' }] 
      })).toBe(true);
    });

    it('rejects invalid payloads', () => {
      expect(isAccessGroupsPayload({})).toBe(false);
      expect(isAccessGroupsPayload({ accessGroups: 'not array' })).toBe(false);
      expect(isAccessGroupsPayload({ accessGroups: [{ id: 'str', name: 'Test' }] })).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - isExecutionResult
  // ===========================================================================
  describe('isExecutionResult', () => {
    it('validates execution result payload', () => {
      expect(isExecutionResult({ status: 'success' })).toBe(true);
      expect(isExecutionResult({ status: 'error', output: 'Error text', exitCode: 1 })).toBe(true);
    });

    it('rejects invalid payloads', () => {
      expect(isExecutionResult({})).toBe(false);
      expect(isExecutionResult({ status: 123 })).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards - isErrorPayload
  // ===========================================================================
  describe('isErrorPayload', () => {
    it('validates error payloads', () => {
      expect(isErrorPayload({ error: 'Something went wrong' })).toBe(true);
      expect(isErrorPayload({ error: 'Failed', code: 500 })).toBe(true);
      expect(isErrorPayload({ error: 'Failed', code: 'NOT_FOUND' })).toBe(true);
    });

    it('rejects invalid payloads', () => {
      expect(isErrorPayload({})).toBe(false);
      expect(isErrorPayload({ error: 123 })).toBe(false);
    });
  });

  // ===========================================================================
  // validateResponse
  // ===========================================================================
  describe('validateResponse', () => {
    it('extracts payload for matching type', () => {
      const response = { type: 'SUCCESS', payload: { data: 'test' } };
      const result = validateResponse(response, 'SUCCESS');
      expect(result).toEqual({ data: 'test' });
    });

    it('returns null for non-matching type', () => {
      const response = { type: 'DIFFERENT', payload: {} };
      expect(validateResponse(response, 'SUCCESS')).toBeNull();
    });

    it('uses custom validator when provided', () => {
      const response = { type: 'MODULES', payload: { module: { id: 1 } } };
      expect(validateResponse(response, 'MODULES', isModuleDetailsPayload)).toEqual({ module: { id: 1 } });
      
      const invalidResponse = { type: 'MODULES', payload: {} };
      expect(validateResponse(invalidResponse, 'MODULES', isModuleDetailsPayload)).toBeNull();
    });
  });

  // ===========================================================================
  // sendMessage
  // ===========================================================================
  describe('sendMessage', () => {
    it('returns ok: true with data on success', async () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockResolvedValueOnce({ 
        type: 'PORTALS_UPDATE', 
        payload: [{ id: 'p1', hostname: 'test.logicmonitor.com' }] 
      });

      const result = await sendMessage({ type: 'DISCOVER_PORTALS' });
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([{ id: 'p1', hostname: 'test.logicmonitor.com' }]);
      }
    });

    it('returns ok: false when no response', async () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockResolvedValueOnce(undefined);

      const result = await sendMessage({ type: 'DISCOVER_PORTALS' });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NO_RESPONSE');
      }
    });

    it('handles ERROR response type', async () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockResolvedValueOnce({ 
        type: 'ERROR', 
        payload: { code: 'AUTH_FAILED', message: 'Not authenticated' } 
      });

      const result = await sendMessage({ type: 'DISCOVER_PORTALS' });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Not authenticated');
        expect(result.code).toBe('AUTH_FAILED');
      }
    });

    it('handles specific error response types', async () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockResolvedValueOnce({ 
        type: 'APPLIES_TO_ERROR', 
        payload: { error: 'Invalid expression' } 
      });

      const result = await sendMessage({ type: 'TEST_APPLIES_TO', payload: { expression: 'bad' } } as any);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Invalid expression');
      }
    });

    it('handles exceptions', async () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Network error'));

      const result = await sendMessage({ type: 'DISCOVER_PORTALS' });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Network error');
        expect(result.code).toBe('EXCEPTION');
      }
    });
  });

  // ===========================================================================
  // sendMessageOrThrow
  // ===========================================================================
  describe('sendMessageOrThrow', () => {
    it('returns data on success', async () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockResolvedValueOnce({ 
        type: 'PORTALS_UPDATE', 
        payload: [{ id: 'p1', hostname: 'test.com' }] 
      });

      const data = await sendMessageOrThrow({ type: 'DISCOVER_PORTALS' });
      expect(data).toEqual([{ id: 'p1', hostname: 'test.com' }]);
    });

    it('throws on error', async () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockResolvedValueOnce({ 
        type: 'ERROR', 
        payload: { code: 'FAILED', message: 'Something failed' } 
      });

      await expect(sendMessageOrThrow({ type: 'DISCOVER_PORTALS' }))
        .rejects.toThrow('Something failed');
    });
  });

  // ===========================================================================
  // sendMessageIgnoreError
  // ===========================================================================
  describe('sendMessageIgnoreError', () => {
    it('sends message without waiting for response', () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockResolvedValueOnce({});

      // Should not throw or return anything
      sendMessageIgnoreError({ type: 'CANCEL_EXECUTION' } as any);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('silently ignores errors', () => {
      const chrome = getChromeMock();
      chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Failed'));

      // Should not throw
      expect(() => {
        sendMessageIgnoreError({ type: 'CANCEL_EXECUTION' } as any);
      }).not.toThrow();
    });
  });
});

