/**
 * Injected Fetch Utilities
 * 
 * These utilities are designed to be used in functions that are injected
 * into the page context via chrome.scripting.executeScript. Since injected
 * functions run in isolation, they cannot import modules directly.
 * 
 * This file provides helper functions that can be passed as arguments to
 * injected functions, reducing code duplication while maintaining the
 * self-contained nature required for injection.
 * 
 * ## Usage Patterns
 * 
 * ### Pattern 1: Direct usage in service worker (not injected)
 * For API calls made directly from the service worker (using fetch), use the
 * standard rate-limiter.ts utilities instead.
 * 
 * ### Pattern 2: Injectable string functions
 * For injected functions, use getInjectableLmGetFunction() or
 * getInjectableLmMutateFunction() to pass a serialized helper.
 * 
 * ### Incremental Adoption
 * Existing injected functions in portal-manager.ts, module-loader.ts, and
 * module-api.ts can be gradually migrated to use these utilities. New code
 * should prefer these patterns when possible.
 * 
 * @module injected-fetch
 */

/**
 * Standard headers used for LogicMonitor API requests.
 */
export interface LmApiHeaders {
  csrfToken: string | null;
  apiVersion?: string;
}

/**
 * Options for creating an LM API request.
 */
export interface LmRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  csrfToken: string | null;
  apiVersion?: string;
  body?: unknown;
  includeXRequestedWith?: boolean;
}

/**
 * Result from an LM API request.
 */
export interface LmRequestResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  responseText?: string;
}

/**
 * Creates a configured XMLHttpRequest for LogicMonitor API calls.
 * This is a helper for use within injected functions.
 * 
 * @param url - The API endpoint URL
 * @param options - Request options
 * @returns Configured XMLHttpRequest
 */
export function createLmRequest(url: string, options: LmRequestOptions): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  xhr.open(options.method ?? 'GET', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('X-version', options.apiVersion ?? '3');
  
  if (options.csrfToken) {
    xhr.setRequestHeader('X-CSRF-Token', options.csrfToken);
  }
  
  if (options.includeXRequestedWith) {
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  }
  
  return xhr;
}

/**
 * Executes a simple GET request and returns the parsed JSON response.
 * For use within injected functions.
 * 
 * @param url - The API endpoint URL
 * @param csrfToken - CSRF token (optional)
 * @param apiVersion - API version header value (default: '3')
 */
export function lmGet<T>(
  url: string,
  csrfToken: string | null,
  apiVersion = '3'
): Promise<LmRequestResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', apiVersion);
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          resolve({ success: true, data: JSON.parse(xhr.responseText) as T });
        } catch {
          resolve({ success: false, error: 'Parse error', status: xhr.status, responseText: xhr.responseText });
        }
      } else {
        resolve({ success: false, error: `HTTP ${xhr.status}`, status: xhr.status, responseText: xhr.responseText });
      }
    };

    xhr.onerror = () => resolve({ success: false, error: 'Network error' });
    xhr.send();
  });
}

/**
 * Executes a POST/PATCH request with JSON body.
 * For use within injected functions.
 * 
 * @param url - The API endpoint URL
 * @param method - HTTP method
 * @param body - Request body (will be JSON stringified)
 * @param csrfToken - CSRF token (optional)
 * @param apiVersion - API version header value (default: '3')
 * @param includeXRequestedWith - Whether to include X-Requested-With header
 */
export function lmMutate<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body: unknown,
  csrfToken: string | null,
  apiVersion = '3',
  includeXRequestedWith = false
): Promise<LmRequestResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', apiVersion);
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    if (includeXRequestedWith) {
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = xhr.responseText ? JSON.parse(xhr.responseText) as T : undefined;
          resolve({ success: true, data });
        } catch {
          resolve({ success: true }); // Success but no parseable body
        }
      } else {
        let errorMessage = `HTTP ${xhr.status}`;
        try {
          const errorData = JSON.parse(xhr.responseText);
          if (errorData.errorMessage) {
            errorMessage = errorData.errorMessage;
          }
        } catch {
          // Keep default error message
        }
        resolve({ success: false, error: errorMessage, status: xhr.status, responseText: xhr.responseText });
      }
    };

    xhr.onerror = () => resolve({ success: false, error: 'Network error' });
    xhr.send(JSON.stringify(body));
  });
}

/**
 * Generates a stringified version of the lmGet helper function that can be
 * embedded directly in injected code. This allows the helper to be used
 * without needing module imports in the injected context.
 * 
 * @example
 * ```typescript
 * const injectedFn = (csrfToken: string, lmGetFn: string) => {
 *   const lmGet = new Function('return ' + lmGetFn)();
 *   return lmGet('/santaba/rest/...', csrfToken);
 * };
 * 
 * chrome.scripting.executeScript({
 *   target: { tabId },
 *   func: injectedFn,
 *   args: [token, getInjectableLmGetFunction()],
 *   world: 'MAIN',
 * });
 * ```
 */
export function getInjectableLmGetFunction(): string {
  return `function(url, csrfToken, apiVersion) {
    return new Promise(function(resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', apiVersion || '3');
      if (csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }
      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            resolve({ success: true, data: JSON.parse(xhr.responseText) });
          } catch (e) {
            resolve({ success: false, error: 'Parse error', status: xhr.status });
          }
        } else {
          resolve({ success: false, error: 'HTTP ' + xhr.status, status: xhr.status });
        }
      };
      xhr.onerror = function() { resolve({ success: false, error: 'Network error' }); };
      xhr.send();
    });
  }`;
}

/**
 * Generates a stringified version of the lmMutate helper function.
 * See getInjectableLmGetFunction for usage pattern.
 */
export function getInjectableLmMutateFunction(): string {
  return `function(url, method, body, csrfToken, apiVersion, includeXRequestedWith) {
    return new Promise(function(resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', apiVersion || '3');
      if (csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }
      if (includeXRequestedWith) {
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      }
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
            resolve({ success: true, data: data });
          } catch (e) {
            resolve({ success: true });
          }
        } else {
          var errorMessage = 'HTTP ' + xhr.status;
          try {
            var errorData = JSON.parse(xhr.responseText);
            if (errorData.errorMessage) errorMessage = errorData.errorMessage;
          } catch (e) {}
          resolve({ success: false, error: errorMessage, status: xhr.status });
        }
      };
      xhr.onerror = function() { resolve({ success: false, error: 'Network error' }); };
      xhr.send(JSON.stringify(body));
    });
  }`;
}

// ============================================================================
// Embedded Helper Pattern for Injected Functions
// ============================================================================

/**
 * Options for the embedded lmFetch helper used within injected functions.
 * This interface is for documentation - it cannot be imported in injected code.
 */
export interface LmFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  csrfToken?: string | null;
  body?: unknown;
  xRequestedWith?: boolean;
}

/**
 * Response from the embedded lmFetch helper.
 * This interface is for documentation - it cannot be imported in injected code.
 */
export interface LmFetchResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  text?: string;
  error?: string;
}

/**
 * Embedded lmFetch helper pattern for use inside injected functions.
 * 
 * Copy this pattern into any injected function that needs to make API calls.
 * It provides a consistent, minimal XHR wrapper that handles:
 * - Standard LM headers (Content-Type, X-version, X-CSRF-Token)
 * - JSON parsing with error handling
 * - Network error handling
 * 
 * Pattern (copy and adapt types as needed):
 * 
 *   const lmFetch = (url, opts = {}) =>
 *     new Promise((resolve) => {
 *       const xhr = new XMLHttpRequest();
 *       xhr.open(opts.method || 'GET', url, true);
 *       xhr.setRequestHeader('Content-Type', 'application/json');
 *       xhr.setRequestHeader('X-version', '3');
 *       if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
 *       if (opts.xRequestedWith) xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
 *       xhr.onload = () => {
 *         const ok = xhr.status >= 200 && xhr.status < 300;
 *         let data;
 *         try { data = JSON.parse(xhr.responseText); } catch {}
 *         resolve({ ok, status: xhr.status, data, text: xhr.responseText });
 *       };
 *       xhr.onerror = () => resolve({ ok: false, status: 0, error: 'Network error' });
 *       xhr.send(opts.body ? JSON.stringify(opts.body) : undefined);
 *     });
 * 
 * For TypeScript, add generic type parameter and type annotations as needed.
 * See portal-manager.ts, module-api.ts, and module-loader.ts for real examples.
 */
