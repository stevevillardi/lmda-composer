/**
 * Integration test framework types.
 * These types define the structure for running end-to-end tests against a real LogicMonitor portal.
 */

import type { LogicModuleType, CreateModulePayload } from '@/shared/types';
import type { sendMessage } from '../chrome-messaging';

/**
 * Script language variants for testing.
 */
export type ScriptVariant = 'groovy' | 'powershell' | 'batchscript';

/**
 * Module configuration variants for testing.
 */
export type ModuleVariant = ScriptVariant | 'with-ad' | 'with-datapoints' | 'with-config-checks' | 'with-filters' | 'with-log-fields' | 'with-resource-mappings';

/**
 * Test execution status.
 */
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Result of a single test case.
 */
export interface TestResult {
  testId: string;
  testName: string;
  status: TestStatus;
  duration: number;
  error?: string;
  details?: string;
  /** ID of created module (for debugging failed tests) */
  moduleId?: number;
  /** Stack trace if available */
  stack?: string;
  /** Raw API request payload (for debugging) */
  requestPayload?: unknown;
  /** Raw API response (for debugging) */
  apiResponse?: unknown;
}

/**
 * Result of an entire test suite run.
 */
export interface TestSuiteResult {
  suiteId: string;
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  cleanupSuccessful: boolean;
  cleanupErrors?: string[];
}

/**
 * Context passed to each test case during execution.
 */
export interface TestContext {
  /** Portal ID to use for API calls */
  portalId: string;
  /** Portal hostname for display purposes */
  portalHostname: string;
  /** Function to send messages to the service worker */
  sendMessage: typeof sendMessage;
  /** Track created module IDs for cleanup */
  createdModuleIds: Map<LogicModuleType, number[]>;
  /** Register a module for cleanup */
  registerModuleForCleanup: (moduleType: LogicModuleType, moduleId: number) => void;
  /** Log a message to the test output */
  log: (message: string) => void;
  /** Capture API request payload for debugging */
  captureRequest: (payload: unknown) => void;
  /** Capture API response for debugging */
  captureResponse: (response: unknown) => void;
}

/**
 * A single test case definition.
 */
export interface TestCase {
  /** Unique identifier for this test */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this test validates */
  description: string;
  /** Module type being tested */
  moduleType: LogicModuleType;
  /** Optional variant (e.g., 'groovy', 'powershell', 'with-ad') */
  variant?: ModuleVariant;
  /** Tags for filtering tests */
  tags?: string[];
  /** The test implementation */
  run: (context: TestContext) => Promise<void>;
  /** Optional setup before the test */
  setup?: (context: TestContext) => Promise<void>;
  /** Optional teardown after the test (runs even if test fails) */
  teardown?: (context: TestContext) => Promise<void>;
}

/**
 * A group of related test cases.
 */
export interface TestSuite {
  /** Unique identifier for this suite */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of this test suite */
  description: string;
  /** Module type this suite tests */
  moduleType: LogicModuleType;
  /** The test cases in this suite */
  tests: TestCase[];
  /** Optional setup before the entire suite */
  beforeAll?: (context: TestContext) => Promise<void>;
  /** Optional teardown after the entire suite */
  afterAll?: (context: TestContext) => Promise<void>;
}

/**
 * Options for running tests.
 */
export interface TestRunOptions {
  /** Portal ID to test against */
  portalId: string;
  /** Portal hostname */
  portalHostname: string;
  /** Specific test IDs to run (runs all if not specified) */
  testIds?: string[];
  /** Specific module types to test (tests all if not specified) */
  moduleTypes?: LogicModuleType[];
  /** Skip cleanup after tests (useful for debugging) */
  skipCleanup?: boolean;
  /** Abort signal to cancel the test run */
  abortSignal?: AbortSignal;
  /** Callback for real-time progress updates */
  onProgress?: (progress: TestRunProgress) => void;
  /** Callback for individual test completion */
  onTestComplete?: (result: TestResult) => void;
}

/**
 * Progress update during a test run.
 */
export interface TestRunProgress {
  /** Current phase of the test run */
  phase: 'setup' | 'running' | 'cleanup' | 'complete';
  /** Total number of tests */
  totalTests: number;
  /** Number of tests completed */
  completedTests: number;
  /** Currently running test name */
  currentTest?: string;
  /** Current test status */
  currentTestStatus?: TestStatus;
}

/**
 * Payload template for creating test modules.
 */
export interface TestModulePayload {
  moduleType: LogicModuleType;
  variant?: ModuleVariant;
  payload: CreateModulePayload;
  /** Expected script content after creation */
  expectedScript?: string;
}

/**
 * Assertion failure error for test cases.
 */
export class AssertionError extends Error {
  constructor(
    message: string,
    public expected?: unknown,
    public actual?: unknown
  ) {
    super(message);
    this.name = 'AssertionError';
  }
}
