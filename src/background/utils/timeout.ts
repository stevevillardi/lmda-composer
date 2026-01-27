/**
 * Timeout utilities for wrapping promises with time limits.
 *
 * Used to prevent indefinite hangs when Chrome APIs block on frozen/suspended tabs.
 */

/**
 * Error thrown when a promise times out.
 */
export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with a timeout.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Optional custom error message
 * @returns The promise result or throws TimeoutError
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   someAsyncOperation(),
 *   5000,
 *   'Operation took too long'
 * );
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage ?? `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Default timeout for script execution (2.5 seconds).
 * Responsive tabs reply in milliseconds; if a tab can't respond in 2.5s,
 * it's likely frozen/suspended and unusable.
 */
export const SCRIPT_EXECUTION_TIMEOUT_MS = 2500;

/**
 * Executes a script in a tab with timeout protection.
 *
 * This is critical for preventing hangs on frozen/suspended tabs in multi-profile Chrome setups.
 * When a tab is frozen, chrome.scripting.executeScript() can hang indefinitely.
 *
 * @param tabId - The tab ID to execute the script in
 * @param options - Script injection options (without target, which is set from tabId)
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns The injection results, or null if timed out or failed
 */
export async function executeScriptWithTimeout<Args extends unknown[], Result>(
  tabId: number,
  options: {
    world?: 'MAIN' | 'ISOLATED';
    func: (...args: Args) => Result;
    args?: Args;
  },
  timeoutMs: number = SCRIPT_EXECUTION_TIMEOUT_MS
): Promise<Array<{ result: Awaited<Result> }> | null> {
  try {
    const results = await withTimeout(
      chrome.scripting.executeScript({
        target: { tabId },
        ...options,
      } as chrome.scripting.ScriptInjection<Args, Result>),
      timeoutMs,
      `Script execution timed out for tab ${tabId}`
    );
    // Cast to our simplified return type
    return results as Array<{ result: Awaited<Result> }>;
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.warn(`[Timeout] ${error.message}`);
      return null;
    }
    // Re-throw non-timeout errors for caller to handle
    throw error;
  }
}

/**
 * Checks if an error is a timeout error.
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}
