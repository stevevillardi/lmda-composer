/**
 * Assertion helpers for integration tests.
 */

import { AssertionError } from './test-types';

/**
 * Asserts that a condition is true.
 */
export function assertTrue(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message || 'Expected condition to be true');
  }
}

/**
 * Asserts that a condition is false.
 */
export function assertFalse(condition: boolean, message?: string): void {
  if (condition) {
    throw new AssertionError(message || 'Expected condition to be false');
  }
}

/**
 * Asserts that two values are equal (using strict equality).
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
      expected,
      actual
    );
  }
}

/**
 * Asserts that two values are not equal.
 */
export function assertNotEqual<T>(actual: T, notExpected: T, message?: string): void {
  if (actual === notExpected) {
    throw new AssertionError(
      message || `Expected value to not equal ${JSON.stringify(notExpected)}`,
      `not ${JSON.stringify(notExpected)}`,
      actual
    );
  }
}

/**
 * Asserts that a value is defined (not null or undefined).
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new AssertionError(
      message || 'Expected value to be defined',
      'defined value',
      value
    );
  }
}

/**
 * Asserts that a value is null or undefined.
 */
export function assertUndefined(value: unknown, message?: string): void {
  if (value !== null && value !== undefined) {
    throw new AssertionError(
      message || 'Expected value to be null or undefined',
      'null or undefined',
      value
    );
  }
}

/**
 * Asserts that two objects are deeply equal.
 */
export function assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  const actualJson = JSON.stringify(actual, null, 2);
  const expectedJson = JSON.stringify(expected, null, 2);
  
  if (actualJson !== expectedJson) {
    throw new AssertionError(
      message || `Objects are not deeply equal.\nExpected:\n${expectedJson}\n\nActual:\n${actualJson}`,
      expected,
      actual
    );
  }
}

/**
 * Asserts that an array contains a specific item.
 */
export function assertContains<T>(array: T[], item: T, message?: string): void {
  if (!array.includes(item)) {
    throw new AssertionError(
      message || `Expected array to contain ${JSON.stringify(item)}`,
      `array containing ${JSON.stringify(item)}`,
      array
    );
  }
}

/**
 * Asserts that an array has a specific length.
 */
export function assertLength(array: unknown[], expectedLength: number, message?: string): void {
  if (array.length !== expectedLength) {
    throw new AssertionError(
      message || `Expected array length ${expectedLength} but got ${array.length}`,
      expectedLength,
      array.length
    );
  }
}

/**
 * Asserts that a string contains a substring.
 */
export function assertStringContains(str: string, substring: string, message?: string): void {
  if (!str.includes(substring)) {
    throw new AssertionError(
      message || `Expected string to contain "${substring}"`,
      `string containing "${substring}"`,
      str
    );
  }
}

/**
 * Asserts that an object has a specific property.
 */
export function assertHasProperty<T extends object>(
  obj: T,
  property: string,
  message?: string
): void {
  if (!(property in obj)) {
    throw new AssertionError(
      message || `Expected object to have property "${property}"`,
      `object with property "${property}"`,
      obj
    );
  }
}

/**
 * Asserts that an object property has a specific value.
 */
export function assertPropertyEquals<T extends object>(
  obj: T,
  property: keyof T,
  expectedValue: unknown,
  message?: string
): void {
  const actualValue = obj[property];
  if (actualValue !== expectedValue) {
    throw new AssertionError(
      message || `Expected ${String(property)} to be ${JSON.stringify(expectedValue)} but got ${JSON.stringify(actualValue)}`,
      expectedValue,
      actualValue
    );
  }
}

/**
 * Asserts that a number is greater than another.
 */
export function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new AssertionError(
      message || `Expected ${actual} to be greater than ${expected}`,
      `> ${expected}`,
      actual
    );
  }
}

/**
 * Asserts that an API result was successful.
 */
export function assertApiSuccess(
  result: { ok: boolean; error?: string; data?: unknown },
  message?: string
): asserts result is { ok: true; data: unknown } {
  if (!result.ok) {
    throw new AssertionError(
      message || `API call failed: ${result.error || 'Unknown error'}`,
      'successful API response',
      result
    );
  }
}

/**
 * Asserts that a module was created successfully.
 */
export function assertModuleCreated(
  result: { ok: boolean; error?: string; data?: { moduleId?: number } },
  message?: string
): asserts result is { ok: true; data: { moduleId: number } } {
  assertApiSuccess(result, message || 'Module creation failed');
  
  if (!result.data || typeof result.data.moduleId !== 'number') {
    throw new AssertionError(
      message || 'Module creation did not return a module ID',
      'response with moduleId',
      result.data
    );
  }
}

/**
 * Asserts that module details match expected values.
 */
export function assertModuleDetails(
  module: Record<string, unknown>,
  expected: Record<string, unknown>,
  fieldsToCheck: string[],
  message?: string
): void {
  for (const field of fieldsToCheck) {
    const actualValue = module[field];
    const expectedValue = expected[field];
    
    // Handle array comparison
    if (Array.isArray(expectedValue) && Array.isArray(actualValue)) {
      const actualJson = JSON.stringify(actualValue);
      const expectedJson = JSON.stringify(expectedValue);
      if (actualJson !== expectedJson) {
        throw new AssertionError(
          message || `Field "${field}" mismatch.\nExpected: ${expectedJson}\nActual: ${actualJson}`,
          expectedValue,
          actualValue
        );
      }
    } else if (actualValue !== expectedValue) {
      throw new AssertionError(
        message || `Field "${field}" expected ${JSON.stringify(expectedValue)} but got ${JSON.stringify(actualValue)}`,
        expectedValue,
        actualValue
      );
    }
  }
}

/**
 * Waits for a condition to become true.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met within timeout' } = options;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new AssertionError(message);
}
