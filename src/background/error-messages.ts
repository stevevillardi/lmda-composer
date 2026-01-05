/**
 * Centralized error message utilities for user-friendly error handling.
 * Provides context-aware error messages that help users understand issues
 * and take appropriate action.
 */

export type ErrorContext = 
  | 'collector-debug' 
  | 'applies-to-functions' 
  | 'api-general';

/**
 * Get a user-friendly 403 error message based on the operation context.
 * 
 * @param context - The type of operation that failed
 * @returns A descriptive error message with actionable guidance
 */
export function get403ErrorMessage(context: ErrorContext): string {
  switch (context) {
    case 'collector-debug':
      return [
        'Access denied. This could be due to:',
        '• Your session has expired - try refreshing the LogicMonitor portal',
        '• You don\'t have permission to run collector debug commands',
        '• Collector Debug is disabled in your portal (Settings > Security > Enable Collector Debug)',
      ].join('\n');

    case 'applies-to-functions':
      return [
        'Access denied. This could be due to:',
        '• Your session has expired - try refreshing the LogicMonitor portal',
        '• You don\'t have permission to manage custom AppliesTo functions',
      ].join('\n');

    case 'api-general':
      return 'Session authentication failed. Please refresh your LogicMonitor portal and try again.';

    default:
      return 'Access denied. Please ensure you are logged into LogicMonitor and have the required permissions.';
  }
}

/**
 * Get a user-friendly 401 error message (session expired).
 */
export function get401ErrorMessage(): string {
  return 'Session expired - please log in to LogicMonitor';
}

/**
 * Get a user-friendly message when CSRF token refresh fails.
 */
export function getCsrfRefreshFailedMessage(): string {
  return 'Session authentication failed. Please refresh your LogicMonitor portal and try again.';
}

/**
 * Get a user-friendly message when no CSRF token is available.
 */
export function getNoCsrfTokenMessage(): string {
  return 'No session token available - please ensure you are logged into the LogicMonitor portal';
}

