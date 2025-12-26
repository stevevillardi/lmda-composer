/**
 * Rate Limiter Utility
 * 
 * Provides rate limit detection and exponential backoff for API calls.
 * Tracks rate limit headers and automatically retries with backoff when limits are hit.
 */

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Rate Limit State
// ============================================================================

// Track rate limit state per portal
const rateLimitStates: Map<string, RateLimitState> = new Map();

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
  }
}

/**
 * Get current rate limit state for a portal.
 */
export function getRateLimitState(portal: string): RateLimitState | undefined {
  return rateLimitStates.get(portal);
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
      if (waitMs > 0) {
        console.log(`Rate limit approaching for ${portal}, waiting ${waitMs}ms`);
        return waitMs;
      }
    }
  }
  
  return 0;
}

// ============================================================================
// Retry with Exponential Backoff
// ============================================================================

/**
 * Execute a fetch with exponential backoff on rate limit errors.
 * Automatically handles 429 responses and retries with increasing delays.
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
          console.log(`Rate limited (429), retrying in ${delayMs}ms (attempt ${attempt + 1}/${opts.maxRetries})`);
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
      console.log(`Request failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${opts.maxRetries})`);
      await sleep(delayMs);
    }
  }
  
  throw lastError ?? new Error('Request failed after all retries');
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

