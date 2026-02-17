/**
 * Debug API Client
 * 
 * Handles communication with LogicMonitor's Debug API for script execution.
 * Scripts are executed on collectors and results are polled asynchronously.
 */

import { API_VERSION, EXECUTION_POLL_INTERVAL_MS, EXECUTION_MAX_ATTEMPTS } from '@/shared/types';
import { fetchWithRetry, updateRateLimitState } from './rate-limiter';
import { get403ErrorMessage, get401ErrorMessage } from './error-messages';

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
  cmdline?: string | null;  // null means command is complete
}

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
      throw new Error(get403ErrorMessage('collector-debug'));
    }
    if (response.status === 401) {
      throw new Error(get401ErrorMessage());
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
      throw new Error(get403ErrorMessage('collector-debug'));
    }
    if (response.status === 401) {
      throw new Error(get401ErrorMessage());
    }
    return {
      status: 'error',
      errorMessage: `Poll failed: ${response.status} ${response.statusText}`,
    };
  }

  const data: DebugPollResponse = await response.json();
  
  // Status 200 with output means command completed
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
  
  return `!groovy hostId=null \n${finalScript}`;
}

/**
 * Build a PowerShell debug command line.
 * 
 * @param script The PowerShell script to execute
 * @param hostId Optional device ID for server-side token substitution.
 *               When provided, the collector substitutes ##TOKEN## patterns
 *               without exposing values in audit logs.
 */
export function buildPowerShellCommand(script: string, hostId?: number): string {
  const hostIdParam = hostId ? ` hostId=${hostId}` : '';
  return `!posh${hostIdParam}\n${script}`;
}

/**
 * Build the Collector Health Check command.
 * This embeds a comprehensive Groovy script that analyzes collector health
 * and returns structured JSON data.
 */
export function buildHealthCheckCommand(): string {
  // Import the health check script dynamically to avoid circular dependencies
  // The script is defined in health-check-script.ts
  return `!groovy hostId=null \n${getHealthCheckScript()}`;
}

// Health check script getter - will be populated by the script module
let _healthCheckScript: string | null = null;

export function setHealthCheckScript(script: string): void {
  _healthCheckScript = script;
}

export function getHealthCheckScript(): string {
  if (!_healthCheckScript) {
    throw new Error('Health check script not initialized');
  }
  return _healthCheckScript;
}

/**
 * Build a debug command string with optional parameters.
 * Parameters are formatted as key=value pairs.
 * 
 * @param command The base command (e.g., "!adlist")
 * @param parameters Optional parameters as key-value pairs
 * @returns Complete command string (e.g., "!adlist type=get method=ad_snmp")
 */
export function buildDebugCommand(
  command: string,
  parameters?: Record<string, string>,
  positionalArgs?: string[]
): string {
  const args: string[] = [];

  // Key=value options come first (e.g. version=v3 auth=MD5)
  if (parameters) {
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null && value !== '') {
        const needsQuoting = /[\s"\\]/.test(value);
        const formattedValue = needsQuoting
          ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
          : value;
        args.push(`${key}=${formattedValue}`);
      }
    }
  }

  // Positional args come last (e.g. <host> <oid>)
  if (positionalArgs && positionalArgs.length > 0) {
    for (const value of positionalArgs) {
      const needsQuoting = /[\s"\\]/.test(value);
      const formattedValue = needsQuoting
        ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
        : value;
      args.push(formattedValue);
    }
  }

  if (args.length === 0) {
    return command;
  }

  return `${command} ${args.join(' ')}`;
}

export interface MultiCollectorResult {
  collectorId: number;
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

export interface ExecuteOnMultipleCollectorsOptions extends ExecuteAndPollOptions {
  onCollectorProgress?: (collectorId: number, attempt: number, maxAttempts: number) => void;
  onCollectorComplete?: (collectorId: number, result: MultiCollectorResult) => void;
}

/**
 * Execute a debug command on multiple collectors in parallel.
 * Returns a map of collectorId -> result.
 * 
 * @param portal Portal hostname
 * @param collectorIds Array of collector IDs to execute on
 * @param cmdline The command line to execute
 * @param csrfToken CSRF token for authentication
 * @param options Optional execution options including progress callbacks
 * @returns Map of collectorId -> execution result
 */
export async function executeOnMultipleCollectors(
  portal: string,
  collectorIds: number[],
  cmdline: string,
  csrfToken: string,
  options?: ExecuteOnMultipleCollectorsOptions
): Promise<Map<number, MultiCollectorResult>> {
  const { onCollectorProgress, onCollectorComplete, abortSignal } = options ?? {};
  const results = new Map<number, MultiCollectorResult>();

  // Execute on all collectors in parallel
  const executions = collectorIds.map(async (collectorId) => {
    const startTime = Date.now();
    
    try {
      // Check for cancellation
      if (abortSignal?.aborted) {
        const result: MultiCollectorResult = {
          collectorId,
          success: false,
          error: 'Execution cancelled',
          duration: Date.now() - startTime
        };
        results.set(collectorId, result);
        onCollectorComplete?.(collectorId, result);
        return;
      }

      // Create collector-specific progress callback
      const collectorProgressCallback = (attempt: number, maxAttempts: number) => {
        onCollectorProgress?.(collectorId, attempt, maxAttempts);
        options?.onProgress?.(attempt, maxAttempts);
      };

      // Execute and poll
      const output = await executeAndPoll(
        portal,
        collectorId,
        cmdline,
        csrfToken,
        {
          ...options,
          onProgress: collectorProgressCallback,
          abortSignal
        }
      );

      const duration = Date.now() - startTime;
      const result: MultiCollectorResult = {
        collectorId,
        success: true,
        output,
        duration
      };
      
      results.set(collectorId, result);
      onCollectorComplete?.(collectorId, result);
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: MultiCollectorResult = {
        collectorId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
      
      results.set(collectorId, result);
      onCollectorComplete?.(collectorId, result);
    }
  });

  // Wait for all executions to complete
  await Promise.allSettled(executions);

  return results;
}

/**
 * Sleep with support for AbortSignal cancellation.
 */
function sleepWithAbort(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new Error('Execution cancelled'));
      return;
    }
    
    const abortHandler = () => {
      clearTimeout(timeoutId);
      abortSignal?.removeEventListener('abort', abortHandler);
      reject(new Error('Execution cancelled'));
    };
    
    const timeoutId = setTimeout(() => {
      abortSignal?.removeEventListener('abort', abortHandler);
      resolve();
    }, ms);
    
    abortSignal?.addEventListener('abort', abortHandler);
  });
}
