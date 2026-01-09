/**
 * Rate Limiter Utility
 * 
 * Provides rate limit detection and exponential backoff for API calls.
 * State is persisted to chrome.storage.local to survive service worker termination.
 */

const STORAGE_KEY = 'rateLimitStates';
const PERSIST_DEBOUNCE_MS = 1000;
const MAX_STATE_AGE_MS = 5 * 60 * 1000; // 5 minutes - don't persist stale rate limits

export interface RateLimitState {
  remaining: number | null;
  limit: number | null;
  resetTime: number | null;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

const rateLimitStates: Map<string, RateLimitState> = new Map();
let persistTimeout: ReturnType<typeof setTimeout> | null = null;
let isInitialized = false;

/**
 * Initialize rate limit state from chrome.storage.local.
 * Should be called on service worker startup.
 */
export async function initRateLimitState(): Promise<void> {
  if (isInitialized) return;
  
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as Record<string, RateLimitState> | undefined;
    
    if (stored) {
      const now = Date.now();
      // Only restore non-expired entries
      for (const [portal, state] of Object.entries(stored)) {
        // Skip if resetTime has passed or is too old
        if (state.resetTime && state.resetTime > now) {
          rateLimitStates.set(portal, state);
        }
      }
    }
    
    isInitialized = true;
  } catch (error) {
    console.error('[RateLimiter] Failed to load persisted state:', error);
    isInitialized = true; // Continue without persisted state
  }
}

/**
 * Persist rate limit state to chrome.storage.local with debouncing.
 */
function schedulePersist(): void {
  if (persistTimeout) {
    clearTimeout(persistTimeout);
  }
  
  persistTimeout = setTimeout(async () => {
    persistTimeout = null;
    
    try {
      const now = Date.now();
      const toStore: Record<string, RateLimitState> = {};
      
      // Only persist entries that haven't expired and are relatively fresh
      for (const [portal, state] of rateLimitStates) {
        if (state.resetTime && state.resetTime > now && state.resetTime < now + MAX_STATE_AGE_MS) {
          toStore[portal] = state;
        }
      }
      
      if (Object.keys(toStore).length > 0) {
        await chrome.storage.local.set({ [STORAGE_KEY]: toStore });
      } else {
        // Clean up if no valid entries
        await chrome.storage.local.remove(STORAGE_KEY);
      }
    } catch (error) {
      console.error('[RateLimiter] Failed to persist state:', error);
    }
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Update rate limit state from response headers.
 */
export function updateRateLimitState(portal: string, response: Response): void {
  const remaining = response.headers.get('X-Rate-Limit-Remaining');
  const limit = response.headers.get('X-Rate-Limit-Limit');
  const reset = response.headers.get('X-Rate-Limit-Reset');
  
  if (remaining !== null || limit !== null || reset !== null) {
    rateLimitStates.set(portal, {
      remaining: remaining !== null ? parseInt(remaining, 10) : null,
      limit: limit !== null ? parseInt(limit, 10) : null,
      resetTime: reset !== null ? parseInt(reset, 10) * 1000 : null, // Convert to ms
    });
    
    // Schedule persistence
    schedulePersist();
  }
}

/**
 * Get current rate limit state for a portal.
 */
export function getRateLimitState(portal: string): RateLimitState | undefined {
  return rateLimitStates.get(portal);
}

export function clearRateLimitState(portal: string): void {
  rateLimitStates.delete(portal);
  schedulePersist();
}

/**
 * Check if we should wait before making a request.
 * Returns the number of milliseconds to wait, or 0 if no wait needed.
 */
export function getWaitTime(portal: string): number {
  const state = rateLimitStates.get(portal);
  
  if (!state) return 0;
  
  // If we're very close to the limit, preemptively wait
  if (state.remaining !== null && state.remaining <= 2) {
    if (state.resetTime !== null) {
      const waitMs = state.resetTime - Date.now();
      if (waitMs > 0) return waitMs;
    }
  }
  
  return 0;
}

/**
 * Execute a fetch with exponential backoff on rate limit errors.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  portal: string,
  retryOptions?: RetryOptions
): Promise<Response> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Check if we should wait before the request
    const preWait = getWaitTime(portal);
    if (preWait > 0) {
      await sleep(Math.min(preWait, opts.maxDelayMs));
    }
    
    try {
      const response = await fetch(url, options);
      
      // Update rate limit state from headers
      updateRateLimitState(portal, response);
      
      // If rate limited, wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const state = rateLimitStates.get(portal);
        
        let delayMs: number;
        
        if (retryAfter) {
          // Use Retry-After header if available
          delayMs = parseInt(retryAfter, 10) * 1000;
        } else if (state?.resetTime) {
          // Use reset time from headers
          delayMs = Math.max(0, state.resetTime - Date.now());
        } else {
          // Exponential backoff
          delayMs = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
        }
        
        if (attempt < opts.maxRetries) {
          await sleep(delayMs);
          continue;
        }
        
        throw new Error('Rate limit exceeded - please wait before making more requests');
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on non-rate-limit errors
      if (!lastError.message.includes('Rate limit')) {
        throw lastError;
      }
      
      // If we've exhausted retries, throw
      if (attempt >= opts.maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff for other errors
      const delayMs = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
      await sleep(delayMs);
    }
  }
  
  throw lastError ?? new Error('Request failed after all retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
