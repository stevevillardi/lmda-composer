/**
 * Debug API Client
 * 
 * Handles communication with LogicMonitor's Debug API for script execution.
 * Scripts are executed on collectors and results are polled asynchronously.
 */

import { API_VERSION, EXECUTION_POLL_INTERVAL_MS, EXECUTION_MAX_ATTEMPTS } from '@/shared/types';
import { fetchWithRetry, updateRateLimitState } from './rate-limiter';

// ============================================================================
// Types
// ============================================================================

export interface PollResult {
  status: 'pending' | 'complete' | 'error';
  output?: string;
  errorMessage?: string;
}

interface DebugExecuteResponse {
  sessionId: string;
}

interface DebugPollResponse {
  output?: string;
  sessionId?: string;
}

// ============================================================================
// Debug API Functions
// ============================================================================

/**
 * Execute a debug command on a collector.
 * Returns a sessionId that can be used to poll for results.
 */
export async function executeDebugCommand(
  portal: string,
  collectorId: number,
  cmdline: string,
  csrfToken: string
): Promise<string> {
  const url = `https://${portal}/santaba/rest/debug/?collectorId=${collectorId}`;
  
  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'X-version': API_VERSION,
      },
      credentials: 'include',
      body: JSON.stringify({ cmdline }),
    },
    portal
  );

  // Update rate limit state
  updateRateLimitState(portal, response);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('CSRF token expired or invalid');
    }
    if (response.status === 401) {
      throw new Error('Session expired - please log in to LogicMonitor');
    }
    throw new Error(`Debug API error: ${response.status} ${response.statusText}`);
  }

  const data: DebugExecuteResponse = await response.json();
  
  if (!data.sessionId) {
    throw new Error('No sessionId returned from debug API');
  }

  return data.sessionId;
}

/**
 * Poll for the result of a debug command.
 * Returns the current status and output if complete.
 */
export async function pollDebugResult(
  portal: string,
  collectorId: number,
  sessionId: string,
  csrfToken: string
): Promise<PollResult> {
  const url = `https://${portal}/santaba/rest/debug/${sessionId}?collectorId=${collectorId}`;
  
  const response = await fetchWithRetry(
    url,
    {
      method: 'GET',
      headers: {
        'X-CSRF-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'X-version': API_VERSION,
      },
      credentials: 'include',
    },
    portal
  );

  // Update rate limit state
  updateRateLimitState(portal, response);

  // 202 Accepted = still running
  if (response.status === 202) {
    return { status: 'pending' };
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('CSRF token expired or invalid');
    }
    if (response.status === 401) {
      throw new Error('Session expired - please log in to LogicMonitor');
    }
    return {
      status: 'error',
      errorMessage: `Poll failed: ${response.status} ${response.statusText}`,
    };
  }

  const data: DebugPollResponse = await response.json();
  
  return {
    status: 'complete',
    output: data.output ?? '',
  };
}

export interface ExecuteAndPollOptions {
  onProgress?: (attempt: number, maxAttempts: number) => void;
  abortSignal?: AbortSignal;
}

/**
 * Execute a command and poll until complete or timeout.
 * Returns the final output or throws on error/timeout.
 * Supports cancellation via AbortSignal.
 */
export async function executeAndPoll(
  portal: string,
  collectorId: number,
  cmdline: string,
  csrfToken: string,
  options?: ExecuteAndPollOptions
): Promise<string> {
  const { onProgress, abortSignal } = options ?? {};
  
  // Check if already aborted
  if (abortSignal?.aborted) {
    throw new Error('Execution cancelled');
  }
  
  // Execute the command
  const sessionId = await executeDebugCommand(portal, collectorId, cmdline, csrfToken);

  // Poll for results
  for (let attempt = 1; attempt <= EXECUTION_MAX_ATTEMPTS; attempt++) {
    // Check for cancellation before each poll
    if (abortSignal?.aborted) {
      throw new Error('Execution cancelled');
    }
    
    onProgress?.(attempt, EXECUTION_MAX_ATTEMPTS);
    
    const result = await pollDebugResult(portal, collectorId, sessionId, csrfToken);
    
    if (result.status === 'complete') {
      return result.output ?? '';
    }
    
    if (result.status === 'error') {
      throw new Error(result.errorMessage ?? 'Execution failed');
    }
    
    // Still pending, wait before next poll (with cancellation support)
    await sleepWithAbort(EXECUTION_POLL_INTERVAL_MS, abortSignal);
  }

  throw new Error(`Execution timed out after ${EXECUTION_MAX_ATTEMPTS} seconds`);
}

// ============================================================================
// Command Builders
// ============================================================================

/**
 * Groovy preamble that sets up hostProps, instanceProps, datasourceinstanceProps, and taskProps.
 * Uses base64-encoded values which are replaced before execution.
 * 
 * Variables provided:
 * - hostProps: Device properties from CollectorDb
 * - instanceProps: Instance properties including wildvalue
 * - datasourceinstanceProps: All instances for batch collection (from getDatasourceInstanceProps)
 * - taskProps: Task configuration with default pollinterval
 */
const GROOVY_PREAMBLE = `import com.santaba.agent.collector3.CollectorDb;
def hostProps = [:];
def instanceProps = [:];
def datasourceinstanceProps = [:];
def taskProps = ["pollinterval": "180"];
try {
  def collectorDb = CollectorDb.getInstance();
  def hostname = new String("##HOSTNAMEBASE64##".decodeBase64());
  def host = collectorDb.getHost(hostname);
  if (host != null) {
    hostProps = host.getProperties();
    instanceProps["wildvalue"] = new String("##WILDVALUEBASE64##".decodeBase64());
    def dsId = new String("##DATASOURCEIDBASE64##".decodeBase64());
    if (dsId) {
      def dsParam = dsId.isInteger() ? dsId.toInteger() : dsId;
      datasourceinstanceProps = collectorDb.getDatasourceInstanceProps(hostname, dsParam);
    }
  }
} catch(Exception e) {};
`;

/**
 * Build a Groovy debug command line.
 * If hostname is provided, prepends preamble that sets up hostProps via CollectorDb.
 * 
 * @param script The Groovy script to execute
 * @param hostname Optional hostname for hostProps lookup
 * @param wildvalue Optional wildvalue for instanceProps
 * @param datasourceId Optional datasource name or ID for batch collection
 */
export function buildGroovyCommand(
  script: string, 
  hostname?: string, 
  wildvalue?: string,
  datasourceId?: string
): string {
  let finalScript = script;
  
  if (hostname) {
    // Prepend the preamble and substitute base64-encoded values
    const hostnameBase64 = btoa(hostname);
    const wildvalueBase64 = btoa(wildvalue || '');
    const datasourceIdBase64 = btoa(datasourceId || '');
    
    const preamble = GROOVY_PREAMBLE
      .replace('##HOSTNAMEBASE64##', hostnameBase64)
      .replace('##WILDVALUEBASE64##', wildvalueBase64)
      .replace('##DATASOURCEIDBASE64##', datasourceIdBase64);
    
    finalScript = preamble + script;
  }
  
  // hostId is always null - we use the preamble approach instead
  return `!groovy hostId=null \n${finalScript}`;
}

/**
 * Build a PowerShell debug command line.
 * @param script The PowerShell script to execute
 */
export function buildPowerShellCommand(script: string): string {
  return `!posh \n${script}`;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Sleep with support for AbortSignal cancellation.
 * Throws if aborted during sleep.
 */
function sleepWithAbort(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new Error('Execution cancelled'));
      return;
    }
    
    const timeoutId = setTimeout(resolve, ms);
    
    const abortHandler = () => {
      clearTimeout(timeoutId);
      reject(new Error('Execution cancelled'));
    };
    
    abortSignal?.addEventListener('abort', abortHandler, { once: true });
  });
}

