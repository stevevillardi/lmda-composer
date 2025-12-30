/**
 * Script Executor
 * 
 * Orchestrates script execution with CSRF token management and cancellation support.
 */

import type { ExecuteScriptRequest, ExecutionResult, ExecuteDebugCommandRequest, DebugCommandResult } from '@/shared/types';
import { executeAndPoll, buildGroovyCommand, buildPowerShellCommand, buildDebugCommand, executeOnMultipleCollectors } from './debug-api';
import { hasTokens, substituteTokens, substituteWithEmpty, type SubstitutionResult } from './token-substitutor';
import { fetchDeviceProperties } from './property-prefetcher';

export interface ExecutorContext {
  getCsrfToken: (portalId: string) => string | null;
  refreshCsrfToken: (portalId: string) => Promise<string | null>;
  discoverPortals: () => Promise<void>;
}

interface ExecutionInternals {
  substitutionResult?: SubstitutionResult;
  prefetchError?: string;
}

interface ActiveExecution {
  abortController: AbortController;
  startTime: number;
}

interface ActiveDebugExecution {
  abortController: AbortController;
  startTime: number;
  collectorIds: number[];
}

export class ScriptExecutor {
  private context: ExecutorContext;
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  private activeDebugExecutions: Map<string, ActiveDebugExecution> = new Map();
  
  constructor(context: ExecutorContext) {
    this.context = context;
  }

  /**
   * Cancel a running execution by its ID.
   * Returns true if the execution was found and cancelled, false otherwise.
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.abortController.abort();
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * Check if an execution is currently running.
   */
  isExecutionActive(executionId: string): boolean {
    return this.activeExecutions.has(executionId);
  }

  /**
   * Get the ID of the currently running execution (if any).
   * Returns null if no execution is running.
   */
  getActiveExecutionId(): string | null {
    const entries = Array.from(this.activeExecutions.entries());
    return entries.length > 0 ? entries[0][0] : null;
  }

  /**
   * Execute a script and return the result.
   * Only one execution can run at a time - concurrent calls will be rejected.
   */
  async execute(request: ExecuteScriptRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = request.executionId ?? crypto.randomUUID();
    
    // Check for concurrent execution
    if (this.activeExecutions.size > 0) {
      return this.errorResult(
        executionId, 
        startTime, 
        'Another script is already running. Please wait for it to complete or cancel it first.'
      );
    }
    
    const abortController = new AbortController();
    
    // Register this execution
    this.activeExecutions.set(executionId, { abortController, startTime });
    
    try {
      // Get CSRF token with multi-level fallback
      let csrfToken = await this.acquireCsrfToken(request.portalId);
      
      if (!csrfToken) {
        return this.errorResult(executionId, startTime, 'No CSRF token available - please ensure you are logged into the LogicMonitor portal');
      }

      // Execute based on language
      const internals: ExecutionInternals = {};
      let output: string;
      
      try {
        if (request.language === 'groovy') {
          output = await this.executeGroovy(request, csrfToken, abortController.signal);
        } else {
          output = await this.executePowerShell(request, csrfToken, internals, abortController.signal);
        }
      } catch (error) {
        // Check if cancelled
        if (error instanceof Error && error.message.includes('cancelled')) {
          return this.cancelledResult(executionId, startTime);
        }
        
        // Check if CSRF expired and retry once
        if (error instanceof Error && error.message.includes('CSRF')) {
          csrfToken = await this.context.refreshCsrfToken(request.portalId);
          
          if (!csrfToken) {
            return this.errorResult(executionId, startTime, 'Failed to refresh CSRF token');
          }
          
          // Retry
          if (request.language === 'groovy') {
            output = await this.executeGroovy(request, csrfToken, abortController.signal);
          } else {
            output = await this.executePowerShell(request, csrfToken, internals, abortController.signal);
          }
        } else {
          throw error;
        }
      }

      // Build result with optional warnings
      let rawOutput = output;
      
      // Add prefetch warning if applicable
      if (internals.prefetchError) {
        rawOutput = `[Warning: Property fetch failed: ${internals.prefetchError}]\n\n${output}`;
      }
      
      // Add missing tokens warning if applicable
      if (internals.substitutionResult?.missing.length) {
        const missingList = internals.substitutionResult.missing.join(', ');
        rawOutput = `[Warning: Missing properties (substituted with empty string): ${missingList}]\n\n${rawOutput}`;
      }

      return {
        id: executionId,
        status: 'complete',
        rawOutput,
        duration: Date.now() - startTime,
        startTime,
      };
    } catch (error) {
      // Check if cancelled
      if (error instanceof Error && error.message.includes('cancelled')) {
        return this.cancelledResult(executionId, startTime);
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
      return this.errorResult(executionId, startTime, errorMessage);
    } finally {
      // Clean up
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a Groovy script.
   * If hostname is provided, prepends preamble that sets up hostProps via CollectorDb.
   * If datasourceId is provided, fetches datasourceinstanceProps for batch collection.
   */
  private async executeGroovy(
    request: ExecuteScriptRequest,
    csrfToken: string,
    abortSignal: AbortSignal
  ): Promise<string> {
    // Build command - hostname enables hostProps via preamble, datasourceId enables batch collection
    const cmdline = buildGroovyCommand(
      request.script, 
      request.hostname, 
      request.wildvalue,
      request.datasourceId
    );
    
    return executeAndPoll(
      request.portalId,
      request.collectorId,
      cmdline,
      csrfToken,
      { abortSignal }
    );
  }

  /**
   * Execute a PowerShell script.
   * If tokens are found, performs property prefetch and substitution.
   */
  private async executePowerShell(
    request: ExecuteScriptRequest,
    csrfToken: string,
    internals: ExecutionInternals,
    abortSignal: AbortSignal
  ): Promise<string> {
    let scriptToExecute = request.script;
    
    // Check if script contains tokens
    if (hasTokens(request.script)) {
      if (request.hostname) {
        // Fetch properties from collector cache
        const prefetchResult = await fetchDeviceProperties(
          request.portalId,
          request.collectorId,
          request.hostname,
          csrfToken
        );
        
        if (prefetchResult.success) {
          internals.substitutionResult = substituteTokens(request.script, prefetchResult.properties);
          scriptToExecute = internals.substitutionResult.script;
        } else {
          internals.prefetchError = prefetchResult.error;
          internals.substitutionResult = substituteWithEmpty(request.script);
          scriptToExecute = internals.substitutionResult.script;
        }
      } else {
        internals.substitutionResult = substituteWithEmpty(request.script);
        scriptToExecute = internals.substitutionResult.script;
      }
    }
    
    // Build and execute command
    const cmdline = buildPowerShellCommand(scriptToExecute);
    
    return executeAndPoll(
      request.portalId,
      request.collectorId,
      cmdline,
      csrfToken,
      { abortSignal }
    );
  }

  /**
   * Acquire a CSRF token with multi-level fallback:
   * 1. Try to get cached token
   * 2. Try to refresh token for the portal
   * 3. Re-discover all portals and try again
   */
  private async acquireCsrfToken(portalId: string): Promise<string | null> {
    // Level 1: Try cached token
    let csrfToken = this.context.getCsrfToken(portalId);
    if (csrfToken) return csrfToken;
    
    // Level 2: Try to refresh token for this portal
    csrfToken = await this.context.refreshCsrfToken(portalId);
    if (csrfToken) return csrfToken;
    
    // Level 3: Re-discover all portals
    await this.context.discoverPortals();
    return this.context.getCsrfToken(portalId);
  }

  /**
   * Create an error result.
   */
  private errorResult(id: string, startTime: number, error: string): ExecutionResult {
    return {
      id,
      status: 'error',
      rawOutput: '',
      duration: Date.now() - startTime,
      startTime,
      error,
    };
  }

  /**
   * Create a cancelled result.
   */
  private cancelledResult(id: string, startTime: number): ExecutionResult {
    return {
      id,
      status: 'cancelled',
      rawOutput: '',
      duration: Date.now() - startTime,
      startTime,
      error: 'Execution was cancelled by user',
    };
  }

  /**
   * Execute a debug command on one or more collectors.
   * Supports parallel execution on multiple collectors.
   * Progress updates are sent via callback.
   */
  async executeDebugCommand(
    request: ExecuteDebugCommandRequest & { executionId?: string },
    onProgress?: (collectorId: number, attempt: number, maxAttempts: number) => void,
    onComplete?: (collectorId: number, result: DebugCommandResult) => void
  ): Promise<Record<number, DebugCommandResult>> {
    const executionId = request.executionId || crypto.randomUUID();
    const abortController = new AbortController();
    
    // Register this execution
    this.activeDebugExecutions.set(executionId, {
      abortController,
      startTime: Date.now(),
      collectorIds: request.collectorIds
    });

    try {
      // Get CSRF token (portalId is the hostname)
      let csrfToken = await this.acquireCsrfToken(request.portalId);
      if (!csrfToken) {
        throw new Error('No CSRF token available - please ensure you are logged into the LogicMonitor portal');
      }

      // Build command string
      const cmdline = buildDebugCommand(request.command, request.parameters, request.positionalArgs);

      // Execute on multiple collectors (portalId is the hostname)
      const results = await executeOnMultipleCollectors(
        request.portalId,
        request.collectorIds,
        cmdline,
        csrfToken,
        {
          onCollectorProgress: onProgress,
          onCollectorComplete: (collectorId, result) => {
            const debugResult: DebugCommandResult = {
              collectorId: result.collectorId,
              success: result.success,
              output: result.output,
              error: result.error,
              duration: result.duration
            };
            onComplete?.(collectorId, debugResult);
          },
          abortSignal: abortController.signal
        }
      );

      // Convert Map to Record for serialization
      const resultRecord: Record<number, DebugCommandResult> = {};
      for (const [collectorId, result] of results.entries()) {
        resultRecord[collectorId] = {
          collectorId: result.collectorId,
          success: result.success,
          output: result.output,
          error: result.error,
          duration: result.duration
        };
      }

      return resultRecord;
    } catch (error) {
      // Return error results for all collectors
      const errorResults: Record<number, DebugCommandResult> = {};
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      for (const collectorId of request.collectorIds) {
        errorResults[collectorId] = {
          collectorId,
          success: false,
          error: errorMessage
        };
      }
      
      return errorResults;
    } finally {
      // Clean up
      this.activeDebugExecutions.delete(executionId);
    }
  }

  /**
   * Cancel a running debug command execution.
   */
  cancelDebugExecution(executionId: string): boolean {
    const execution = this.activeDebugExecutions.get(executionId);
    if (execution) {
      execution.abortController.abort();
      this.activeDebugExecutions.delete(executionId);
      return true;
    }
    return false;
  }
}
