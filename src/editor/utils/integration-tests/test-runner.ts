/**
 * Test orchestrator for running integration tests sequentially.
 */

import type { LogicModuleType } from '@/shared/types';
import { sendMessage } from '../chrome-messaging';
import type {
  TestCase,
  TestSuite,
  TestContext,
  TestResult,
  TestSuiteResult,
  TestRunOptions,
  TestStatus,
} from './test-types';

/**
 * Extended context with captured request/response for debugging
 */
interface ExtendedTestContext extends TestContext {
  _lastRequest?: unknown;
  _lastResponse?: unknown;
}

/**
 * Creates a test context for running tests.
 */
function createTestContext(
  portalId: string,
  portalHostname: string,
  logs: string[]
): ExtendedTestContext {
  const createdModuleIds = new Map<LogicModuleType, number[]>();

  const context: ExtendedTestContext = {
    portalId,
    portalHostname,
    sendMessage,
    createdModuleIds,
    registerModuleForCleanup: (moduleType: LogicModuleType, moduleId: number) => {
      const existing = createdModuleIds.get(moduleType) || [];
      existing.push(moduleId);
      createdModuleIds.set(moduleType, existing);
    },
    log: (message: string) => {
      const timestamp = new Date().toISOString();
      logs.push(`[${timestamp}] ${message}`);
      console.log(`[IntegrationTest] ${message}`);
    },
    captureRequest: (payload: unknown) => {
      context._lastRequest = payload;
    },
    captureResponse: (response: unknown) => {
      context._lastResponse = response;
    },
  };

  return context;
}

/**
 * Runs a single test case.
 */
async function runTestCase(
  test: TestCase,
  context: ExtendedTestContext,
  abortSignal?: AbortSignal
): Promise<TestResult> {
  const startTime = performance.now();
  let status: TestStatus = 'running';
  let error: string | undefined;
  let stack: string | undefined;
  let moduleId: number | undefined;

  // Reset captured request/response for this test
  context._lastRequest = undefined;
  context._lastResponse = undefined;

  try {
    // Check for abort before starting
    if (abortSignal?.aborted) {
      return {
        testId: test.id,
        testName: test.name,
        status: 'skipped',
        duration: 0,
        error: 'Test run was aborted',
      };
    }

    context.log(`Starting test: ${test.name}`);

    // Run setup if provided
    if (test.setup) {
      context.log('Running test setup...');
      await test.setup(context);
    }

    // Run the test
    await test.run(context);

    status = 'passed';
    context.log(`Test passed: ${test.name}`);
  } catch (err) {
    status = 'failed';
    if (err instanceof Error) {
      error = err.message;
      stack = err.stack;
    } else {
      error = String(err);
    }
    context.log(`Test failed: ${test.name} - ${error}`);
  } finally {
    // Always run teardown if provided
    if (test.teardown) {
      try {
        context.log('Running test teardown...');
        await test.teardown(context);
      } catch (teardownErr) {
        context.log(`Teardown error: ${teardownErr instanceof Error ? teardownErr.message : String(teardownErr)}`);
      }
    }
  }

  const duration = performance.now() - startTime;

  // Get the last created module ID for this test's module type
  const moduleIds = context.createdModuleIds.get(test.moduleType);
  if (moduleIds && moduleIds.length > 0) {
    moduleId = moduleIds[moduleIds.length - 1];
  }

  return {
    testId: test.id,
    testName: test.name,
    status,
    duration,
    error,
    stack,
    moduleId,
    requestPayload: context._lastRequest,
    apiResponse: context._lastResponse,
  };
}

/**
 * Cleans up all created modules.
 */
async function cleanupModules(
  context: TestContext
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const [moduleType, moduleIds] of context.createdModuleIds) {
    for (const moduleId of moduleIds) {
      try {
        context.log(`Deleting ${moduleType} ${moduleId}...`);
        const result = await sendMessage({
          type: 'DELETE_MODULE',
          payload: {
            portalId: context.portalId,
            moduleType,
            moduleId,
          },
        });

        if (!result.ok) {
          const errorMsg = `Failed to delete ${moduleType} ${moduleId}: ${result.error}`;
          errors.push(errorMsg);
          context.log(errorMsg);
        } else {
          context.log(`Deleted ${moduleType} ${moduleId}`);
        }
      } catch (err) {
        const errorMsg = `Error deleting ${moduleType} ${moduleId}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        context.log(errorMsg);
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Runs a test suite.
 */
export async function runTestSuite(
  suite: TestSuite,
  options: TestRunOptions
): Promise<TestSuiteResult> {
  const startTime = performance.now();
  const logs: string[] = [];
  const context = createTestContext(options.portalId, options.portalHostname, logs);
  const results: TestResult[] = [];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Filter tests if specific IDs are provided
  const testsToRun = options.testIds
    ? suite.tests.filter(t => options.testIds!.includes(t.id))
    : suite.tests;

  // Report initial progress
  options.onProgress?.({
    phase: 'setup',
    totalTests: testsToRun.length,
    completedTests: 0,
  });

  // Run beforeAll if provided
  if (suite.beforeAll) {
    try {
      context.log(`Running suite setup for: ${suite.name}`);
      await suite.beforeAll(context);
    } catch (err) {
      context.log(`Suite setup failed: ${err instanceof Error ? err.message : String(err)}`);
      // Skip all tests if beforeAll fails
      for (const test of testsToRun) {
        const result: TestResult = {
          testId: test.id,
          testName: test.name,
          status: 'skipped',
          duration: 0,
          error: 'Suite setup failed',
        };
        results.push(result);
        skipped++;
        options.onTestComplete?.(result);
      }

      return {
        suiteId: suite.id,
        suiteName: suite.name,
        totalTests: testsToRun.length,
        passed,
        failed,
        skipped,
        duration: performance.now() - startTime,
        results,
        cleanupSuccessful: true,
      };
    }
  }

  // Run each test sequentially
  options.onProgress?.({
    phase: 'running',
    totalTests: testsToRun.length,
    completedTests: 0,
  });

  for (let i = 0; i < testsToRun.length; i++) {
    const test = testsToRun[i];

    // Check for abort
    if (options.abortSignal?.aborted) {
      const result: TestResult = {
        testId: test.id,
        testName: test.name,
        status: 'skipped',
        duration: 0,
        error: 'Test run was aborted',
      };
      results.push(result);
      skipped++;
      options.onTestComplete?.(result);
      continue;
    }

    options.onProgress?.({
      phase: 'running',
      totalTests: testsToRun.length,
      completedTests: i,
      currentTest: test.name,
      currentTestStatus: 'running',
    });

    const result = await runTestCase(test, context, options.abortSignal);
    results.push(result);

    if (result.status === 'passed') passed++;
    else if (result.status === 'failed') failed++;
    else skipped++;

    options.onTestComplete?.(result);

    options.onProgress?.({
      phase: 'running',
      totalTests: testsToRun.length,
      completedTests: i + 1,
      currentTest: test.name,
      currentTestStatus: result.status,
    });
  }

  // Run afterAll if provided
  if (suite.afterAll) {
    try {
      context.log(`Running suite teardown for: ${suite.name}`);
      await suite.afterAll(context);
    } catch (err) {
      context.log(`Suite teardown error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Cleanup
  options.onProgress?.({
    phase: 'cleanup',
    totalTests: testsToRun.length,
    completedTests: testsToRun.length,
  });

  let cleanupSuccessful = true;
  let cleanupErrors: string[] | undefined;

  if (!options.skipCleanup) {
    const cleanup = await cleanupModules(context);
    cleanupSuccessful = cleanup.success;
    cleanupErrors = cleanup.errors.length > 0 ? cleanup.errors : undefined;
  } else {
    context.log('Skipping cleanup (skipCleanup=true)');
  }

  options.onProgress?.({
    phase: 'complete',
    totalTests: testsToRun.length,
    completedTests: testsToRun.length,
  });

  return {
    suiteId: suite.id,
    suiteName: suite.name,
    totalTests: testsToRun.length,
    passed,
    failed,
    skipped,
    duration: performance.now() - startTime,
    results,
    cleanupSuccessful,
    cleanupErrors,
  };
}

/**
 * Runs multiple test suites.
 */
export async function runAllTestSuites(
  suites: TestSuite[],
  options: TestRunOptions
): Promise<TestSuiteResult[]> {
  // Filter by module type if specified
  const suitesToRun = options.moduleTypes
    ? suites.filter(s => options.moduleTypes!.includes(s.moduleType))
    : suites;

  const results: TestSuiteResult[] = [];

  for (const suite of suitesToRun) {
    if (options.abortSignal?.aborted) {
      break;
    }

    const result = await runTestSuite(suite, options);
    results.push(result);
  }

  return results;
}

/**
 * Aggregates results from multiple suite runs.
 */
export function aggregateResults(suiteResults: TestSuiteResult[]): {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  allCleanupSuccessful: boolean;
} {
  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let duration = 0;
  let allCleanupSuccessful = true;

  for (const result of suiteResults) {
    totalTests += result.totalTests;
    passed += result.passed;
    failed += result.failed;
    skipped += result.skipped;
    duration += result.duration;
    if (!result.cleanupSuccessful) {
      allCleanupSuccessful = false;
    }
  }

  return {
    totalTests,
    passed,
    failed,
    skipped,
    duration,
    allCleanupSuccessful,
  };
}
