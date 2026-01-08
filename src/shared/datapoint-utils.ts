/**
 * Datapoint utilities for filtering and validation.
 */

/**
 * Filters out "ghost" datapoints that are not actually usable.
 * Ghost datapoints have no rawDataFieldName AND postProcessorMethod is "none".
 * These appear in the API response but serve no functional purpose.
 * 
 * Valid datapoints need EITHER:
 * - A raw data source (output, exitCode, responseTime), OR
 * - A complex expression that derives from other datapoints (postProcessorMethod === 'expression')
 * 
 * @param datapoints Array of datapoints to filter
 * @returns Filtered array with ghost datapoints removed
 */
export function filterValidDatapoints<T>(datapoints: T[]): T[] {
  if (!Array.isArray(datapoints)) {
    return [];
  }
  
  return datapoints.filter(dp => {
    // Access fields dynamically to work with any datapoint-like object
    const dpObj = dp as Record<string, unknown>;
    const rawDataFieldName = dpObj.rawDataFieldName as string | null | undefined;
    const postProcessorMethod = dpObj.postProcessorMethod as string | undefined;
    
    const hasNoRawField = !rawDataFieldName || rawDataFieldName === '';
    const isNoneMethod = postProcessorMethod === 'none';
    
    // Exclude if BOTH conditions are true (ghost datapoint)
    return !(hasNoRawField && isNoneMethod);
  });
}

/**
 * Checks if a datapoint is a "complex" type (expression-based).
 * Complex datapoints derive their value from other datapoints using expressions.
 */
export function isComplexDatapoint(postProcessorMethod: string | undefined): boolean {
  return postProcessorMethod === 'expression';
}

/**
 * Gets the default rawDataFieldName based on postProcessorMethod.
 * Expression datapoints don't use rawDataFieldName.
 */
export function getDefaultRawDataFieldName(postProcessorMethod: string): string {
  if (postProcessorMethod === 'expression') {
    return '';
  }
  return 'output';
}
