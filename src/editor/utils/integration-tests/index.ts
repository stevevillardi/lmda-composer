/**
 * Integration test framework exports.
 */

// Types
export * from './test-types';

// Assertions
export * from './assertions';

// Test data
export * from './test-data';

// Test runner
export { runTestSuite, runAllTestSuites, aggregateResults } from './test-runner';

// Test suites
export { dataSourceTestSuite } from './cases/datasource-tests';
export { configSourceTestSuite } from './cases/configsource-tests';
export { logSourceTestSuite } from './cases/logsource-tests';
export {
  propertySourceTestSuite,
  eventSourceTestSuite,
  topologySourceTestSuite,
  diagnosticSourceTestSuite,
} from './cases/other-module-tests';

import type { TestSuite } from './test-types';
import { dataSourceTestSuite } from './cases/datasource-tests';
import { configSourceTestSuite } from './cases/configsource-tests';
import { logSourceTestSuite } from './cases/logsource-tests';
import {
  propertySourceTestSuite,
  eventSourceTestSuite,
  topologySourceTestSuite,
  diagnosticSourceTestSuite,
} from './cases/other-module-tests';

/**
 * All available test suites.
 */
export const ALL_TEST_SUITES: TestSuite[] = [
  dataSourceTestSuite,
  configSourceTestSuite,
  logSourceTestSuite,
  propertySourceTestSuite,
  eventSourceTestSuite,
  topologySourceTestSuite,
  diagnosticSourceTestSuite,
];

/**
 * Get the total number of tests across all suites.
 */
export function getTotalTestCount(): number {
  return ALL_TEST_SUITES.reduce((sum, suite) => sum + suite.tests.length, 0);
}
