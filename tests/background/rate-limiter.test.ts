/**
 * Tests for rate-limiter utility.
 * 
 * Tests rate limit detection, state management, and wait time calculations.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  updateRateLimitState,
  getRateLimitState,
  clearRateLimitState,
  getWaitTime,
} from '../../src/background/rate-limiter';

// Create a mock Response object with headers
function createMockResponse(headers: Record<string, string>): Response {
  return {
    headers: new Headers(headers),
  } as Response;
}

describe('rate-limiter', () => {
  const testPortal = 'test.logicmonitor.com';
  
  beforeEach(() => {
    // Clear any existing rate limit state
    clearRateLimitState(testPortal);
  });

  afterEach(() => {
    clearRateLimitState(testPortal);
  });

  // ===========================================================================
  // updateRateLimitState
  // ===========================================================================
  describe('updateRateLimitState', () => {
    it('updates state from response headers', () => {
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '100',
        'X-Rate-Limit-Limit': '500',
        'X-Rate-Limit-Reset': '1700000000',
      });

      updateRateLimitState(testPortal, response);

      const state = getRateLimitState(testPortal);
      expect(state).toBeDefined();
      expect(state?.remaining).toBe(100);
      expect(state?.limit).toBe(500);
      expect(state?.resetTime).toBe(1700000000 * 1000); // Converted to ms
    });

    it('handles partial headers', () => {
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '50',
      });

      updateRateLimitState(testPortal, response);

      const state = getRateLimitState(testPortal);
      expect(state).toBeDefined();
      expect(state?.remaining).toBe(50);
      expect(state?.limit).toBeNull();
      expect(state?.resetTime).toBeNull();
    });

    it('does nothing when no rate limit headers present', () => {
      const response = createMockResponse({});

      updateRateLimitState(testPortal, response);

      const state = getRateLimitState(testPortal);
      expect(state).toBeUndefined();
    });
  });

  // ===========================================================================
  // getRateLimitState
  // ===========================================================================
  describe('getRateLimitState', () => {
    it('returns undefined for unknown portal', () => {
      const state = getRateLimitState('unknown.logicmonitor.com');
      expect(state).toBeUndefined();
    });

    it('returns state for known portal', () => {
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '10',
        'X-Rate-Limit-Limit': '100',
      });

      updateRateLimitState(testPortal, response);
      
      const state = getRateLimitState(testPortal);
      expect(state).toBeDefined();
      expect(state?.remaining).toBe(10);
    });
  });

  // ===========================================================================
  // clearRateLimitState
  // ===========================================================================
  describe('clearRateLimitState', () => {
    it('removes state for a portal', () => {
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '100',
      });

      updateRateLimitState(testPortal, response);
      expect(getRateLimitState(testPortal)).toBeDefined();

      clearRateLimitState(testPortal);
      expect(getRateLimitState(testPortal)).toBeUndefined();
    });

    it('does nothing for unknown portal', () => {
      // Should not throw
      expect(() => clearRateLimitState('unknown.portal')).not.toThrow();
    });
  });

  // ===========================================================================
  // getWaitTime
  // ===========================================================================
  describe('getWaitTime', () => {
    it('returns 0 for unknown portal', () => {
      const waitTime = getWaitTime('unknown.logicmonitor.com');
      expect(waitTime).toBe(0);
    });

    it('returns 0 when plenty of requests remaining', () => {
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '100',
        'X-Rate-Limit-Limit': '500',
      });

      updateRateLimitState(testPortal, response);

      const waitTime = getWaitTime(testPortal);
      expect(waitTime).toBe(0);
    });

    it('returns wait time when close to limit and reset time is in future', () => {
      // Mock Date.now to have a predictable reset time
      const now = Date.now();
      const resetInFuture = now + 5000; // 5 seconds from now
      
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '1', // Close to limit
        'X-Rate-Limit-Reset': String(resetInFuture / 1000), // Convert to seconds
      });

      updateRateLimitState(testPortal, response);

      const waitTime = getWaitTime(testPortal);
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(5000);
    });

    it('returns 0 when close to limit but reset time has passed', () => {
      const pastResetTime = (Date.now() - 10000) / 1000; // 10 seconds ago
      
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '1',
        'X-Rate-Limit-Reset': String(pastResetTime),
      });

      updateRateLimitState(testPortal, response);

      const waitTime = getWaitTime(testPortal);
      expect(waitTime).toBe(0);
    });

    it('returns 0 when remaining is exactly 2 (threshold)', () => {
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '2',
        'X-Rate-Limit-Reset': String((Date.now() + 5000) / 1000),
      });

      updateRateLimitState(testPortal, response);

      const waitTime = getWaitTime(testPortal);
      // At exactly 2, it should wait (remaining <= 2)
      expect(waitTime).toBeGreaterThan(0);
    });

    it('returns 0 when remaining is 3 (above threshold)', () => {
      const response = createMockResponse({
        'X-Rate-Limit-Remaining': '3',
        'X-Rate-Limit-Reset': String((Date.now() + 5000) / 1000),
      });

      updateRateLimitState(testPortal, response);

      const waitTime = getWaitTime(testPortal);
      expect(waitTime).toBe(0);
    });
  });
});

