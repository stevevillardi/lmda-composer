/**
 * Script Executor
 * 
 * Orchestrates the full script execution flow:
 * - Groovy: Direct execution with hostId for hostProps
 * - PowerShell: Property prefetch → token substitution → execute
 */

import type { ExecuteScriptRequest, ExecutionResult } from '@/shared/types';
import { executeAndPoll, buildGroovyCommand, buildPowerShellCommand } from './debug-api';
import { hasTokens, substituteTokens, substituteWithEmpty, type SubstitutionResult } from './token-substitutor';
import { fetchDeviceProperties } from './property-prefetcher';

// ============================================================================
// Types
// ============================================================================

export interface ExecutorContext {
  /** Get CSRF token for a portal */
  getCsrfToken: (portalId: string) => string | null;
  /** Refresh CSRF token for a portal (called on 403) */
  refreshCsrfToken: (portalId: string) => Promise<string | null>;
  /** Re-discover all portals (called when portal/token not found) */
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

// ============================================================================
// Script Executor Class
// ============================================================================

export class ScriptExecutor {
  private context: ExecutorContext;
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  
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
      console.log(`Execution ${executionId} cancelled`);
      return true;
    }
    console.warn(`No active execution found with ID ${executionId}`);
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
    const executionId = crypto.randomUUID();
    
    // Check for concurrent execution
    if (this.activeExecutions.size > 0) {
      const activeId = this.getActiveExecutionId();
      console.warn(`Concurrent execution rejected - execution ${activeId} already in progress`);
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
          console.log('CSRF token expired, refreshing and retrying...');
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
          // Substitute tokens with property values
          internals.substitutionResult = substituteTokens(request.script, prefetchResult.properties);
          scriptToExecute = internals.substitutionResult.script;
          
          console.log(`Token substitution: ${internals.substitutionResult.substitutions.length} replaced, ${internals.substitutionResult.missing.length} missing`);
        } else {
          // Prefetch failed - substitute with empty strings and warn
          internals.prefetchError = prefetchResult.error;
          internals.substitutionResult = substituteWithEmpty(request.script);
          scriptToExecute = internals.substitutionResult.script;
          
          console.warn('Property prefetch failed, using empty substitutions:', prefetchResult.error);
        }
      } else {
        // No hostname provided - substitute with empty strings
        internals.substitutionResult = substituteWithEmpty(request.script);
        scriptToExecute = internals.substitutionResult.script;
        
        console.log('No hostname provided, substituting all tokens with empty strings');
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
    if (csrfToken) {
      console.log('Using cached CSRF token');
      return csrfToken;
    }
    
    // Level 2: Try to refresh token for this portal
    console.log('No cached CSRF token, attempting refresh...');
    csrfToken = await this.context.refreshCsrfToken(portalId);
    if (csrfToken) {
      console.log('CSRF token refreshed successfully');
      return csrfToken;
    }
    
    // Level 3: Re-discover all portals (portal might have been removed from map)
    console.log('CSRF refresh failed, re-discovering portals...');
    await this.context.discoverPortals();
    
    // Try to get token again after discovery
    csrfToken = this.context.getCsrfToken(portalId);
    if (csrfToken) {
      console.log('CSRF token acquired after portal re-discovery');
      return csrfToken;
    }
    
    console.warn('Failed to acquire CSRF token after all attempts');
    return null;
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
}

