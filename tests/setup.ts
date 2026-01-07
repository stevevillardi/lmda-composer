/**
 * Global test setup file for Vitest.
 * 
 * This file runs before all tests and provides:
 * - Chrome API mocks
 * - Jest-DOM matchers for React Testing Library
 * - Common test utilities
 */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// =============================================================================
// Chrome API Mocks
// =============================================================================

/**
 * Mock Chrome runtime API.
 * Individual tests can override specific methods as needed.
 */
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    getManifest: vi.fn(() => ({
      version: '1.0.0',
      name: 'LMDA Composer Test',
    })),
    sendMessage: vi.fn(() => Promise.resolve({})),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
    },
    lastError: null,
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn(() => Promise.resolve({})),
    get: vi.fn(() => Promise.resolve(null)),
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve()),
    },
    sync: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve()),
    },
  },
  cookies: {
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
  },
};

// Install Chrome mock globally
(globalThis as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Reset all Chrome API mocks to their default state.
 * Call this in beforeEach() to ensure clean state between tests.
 */
export function resetChromeMocks(): void {
  vi.clearAllMocks();
  mockChrome.runtime.lastError = null;
}

/**
 * Configure chrome.runtime.sendMessage to return a specific response.
 */
export function mockSendMessageResponse<T>(response: T): void {
  mockChrome.runtime.sendMessage.mockResolvedValueOnce(response);
}

/**
 * Configure chrome.runtime.sendMessage to reject with an error.
 */
export function mockSendMessageError(error: Error | string): void {
  const err = typeof error === 'string' ? new Error(error) : error;
  mockChrome.runtime.sendMessage.mockRejectedValueOnce(err);
}

/**
 * Get the mock Chrome object for direct manipulation in tests.
 */
export function getChromeMock(): typeof mockChrome {
  return mockChrome;
}

// =============================================================================
// Global Test Lifecycle
// =============================================================================

// Note: Individual test files should use beforeEach/afterEach for cleanup.
// This setup file only provides the baseline mocks.

