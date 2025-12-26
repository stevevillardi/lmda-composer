import type { ScriptMode } from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  lineNumber: number;
  field?: string;
}

export interface ADInstance {
  id: string;
  name: string;
  description?: string;
  properties?: Record<string, string>;
  issues: ValidationIssue[];
  lineNumber: number;
  rawLine: string;
}

export interface CollectionDatapoint {
  name: string;
  value: number | null;
  rawValue: string;
  wildvalue?: string;
  issues: ValidationIssue[];
  lineNumber: number;
  rawLine: string;
}

export interface ParseSummary {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
}

export interface ADParseResult {
  type: 'ad';
  instances: ADInstance[];
  unparsedLines: UnparsedLine[];
  summary: ParseSummary;
}

export interface CollectionParseResult {
  type: 'collection' | 'batchcollection';
  datapoints: CollectionDatapoint[];
  unparsedLines: UnparsedLine[];
  summary: ParseSummary;
}

export interface UnparsedLine {
  lineNumber: number;
  content: string;
  reason: string;
}

export type ParseResult = ADParseResult | CollectionParseResult;

// ============================================================================
// Active Discovery Parser
// ============================================================================

const AD_INVALID_ID_CHARS = /[\s=:\\#]/;
const AD_MAX_ID_LENGTH = 1024;
const AD_MAX_NAME_LENGTH = 255;

function validateADInstance(instance: ADInstance): void {
  const { id, name, properties, lineNumber } = instance;

  // ID is required
  if (!id || id.trim().length === 0) {
    instance.issues.push({
      severity: 'error',
      message: 'Instance ID is required',
      lineNumber,
      field: 'id',
    });
  } else {
    // ID max length
    if (id.length > AD_MAX_ID_LENGTH) {
      instance.issues.push({
        severity: 'error',
        message: `Instance ID exceeds maximum length of ${AD_MAX_ID_LENGTH} characters`,
        lineNumber,
        field: 'id',
      });
    }

    // ID invalid characters
    if (AD_INVALID_ID_CHARS.test(id)) {
      instance.issues.push({
        severity: 'error',
        message: 'Instance ID contains invalid characters (spaces, =, :, \\, or #)',
        lineNumber,
        field: 'id',
      });
    }
  }

  // Name max length (warning)
  if (name && name.length > AD_MAX_NAME_LENGTH) {
    instance.issues.push({
      severity: 'warning',
      message: `Instance name exceeds recommended length of ${AD_MAX_NAME_LENGTH} characters`,
      lineNumber,
      field: 'name',
    });
  }

  // Validate properties format
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (!key || key.trim().length === 0) {
        instance.issues.push({
          severity: 'error',
          message: 'Property key cannot be empty',
          lineNumber,
          field: 'properties',
        });
      }
      if (value === undefined) {
        instance.issues.push({
          severity: 'error',
          message: `Property "${key}" is missing a value`,
          lineNumber,
          field: 'properties',
        });
      }
    }
  }
}

function parseADLine(line: string, lineNumber: number): ADInstance | null {
  // Skip empty lines and comments
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return null;
  }

  // AD format: instance_id##instance_name or
  //            instance_id##instance_name##description or
  //            instance_id##instance_name##description####auto.prop=value&prop2=value

  const instance: ADInstance = {
    id: '',
    name: '',
    issues: [],
    lineNumber,
    rawLine: line,
  };

  // Check for properties section (####)
  const propsSplit = trimmed.split('####');
  const mainPart = propsSplit[0];
  const propsPart = propsSplit[1];

  // Parse main parts (##)
  const parts = mainPart.split('##');
  
  if (parts.length >= 1) {
    instance.id = parts[0];
  }
  if (parts.length >= 2) {
    instance.name = parts[1];
  }
  if (parts.length >= 3) {
    instance.description = parts[2];
  }

  // Parse properties if present
  if (propsPart) {
    instance.properties = {};
    const propPairs = propsPart.split('&');
    for (const pair of propPairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        const key = pair.substring(0, eqIndex);
        const value = pair.substring(eqIndex + 1);
        instance.properties[key] = value;
      } else if (pair.trim()) {
        // Invalid property format
        instance.issues.push({
          severity: 'error',
          message: `Invalid property format: "${pair}" (expected key=value)`,
          lineNumber,
          field: 'properties',
        });
      }
    }
  }

  // Validate the instance
  validateADInstance(instance);

  return instance;
}

export function parseADOutput(output: string): ADParseResult {
  const lines = output.split('\n');
  const instances: ADInstance[] = [];
  const unparsedLines: UnparsedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip comment lines but track them
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      unparsedLines.push({
        lineNumber,
        content: line,
        reason: 'Comment line',
      });
      continue;
    }

    // Check if line looks like AD format (contains ##)
    if (!trimmed.includes('##')) {
      unparsedLines.push({
        lineNumber,
        content: line,
        reason: 'Does not match AD format (missing ## delimiter)',
      });
      continue;
    }

    const instance = parseADLine(line, lineNumber);
    if (instance) {
      instances.push(instance);
    }
  }

  // Calculate summary
  const summary: ParseSummary = {
    total: instances.length,
    valid: instances.filter(i => i.issues.filter(issue => issue.severity === 'error').length === 0).length,
    errors: instances.reduce((sum, i) => sum + i.issues.filter(issue => issue.severity === 'error').length, 0),
    warnings: instances.reduce((sum, i) => sum + i.issues.filter(issue => issue.severity === 'warning').length, 0),
  };

  return {
    type: 'ad',
    instances,
    unparsedLines,
    summary,
  };
}

// ============================================================================
// Collection Parser
// ============================================================================

function parseCollectionLine(
  line: string, 
  lineNumber: number, 
  isBatchMode: boolean
): CollectionDatapoint | null {
  const trimmed = line.trim();
  
  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return null;
  }

  // Collection format: datapoint=value or wildvalue.datapoint=value (for batch)
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex <= 0) {
    return null;
  }

  const key = trimmed.substring(0, eqIndex);
  const rawValue = trimmed.substring(eqIndex + 1);

  const datapoint: CollectionDatapoint = {
    name: key,
    value: null,
    rawValue,
    issues: [],
    lineNumber,
    rawLine: line,
  };

  // For batch mode, extract wildvalue prefix
  if (isBatchMode) {
    const dotIndex = key.indexOf('.');
    if (dotIndex > 0) {
      datapoint.wildvalue = key.substring(0, dotIndex);
      datapoint.name = key.substring(dotIndex + 1);
      
      // Validate wildvalue with same rules as instance ID (no spaces, =, :, \, #)
      if (AD_INVALID_ID_CHARS.test(datapoint.wildvalue)) {
        datapoint.issues.push({
          severity: 'error',
          message: 'Wildvalue contains invalid characters (spaces, =, :, \\, or #)',
          lineNumber,
          field: 'wildvalue',
        });
      }
      
      // Validate wildvalue max length (same as instance ID)
      if (datapoint.wildvalue.length > AD_MAX_ID_LENGTH) {
        datapoint.issues.push({
          severity: 'error',
          message: `Wildvalue exceeds maximum length of ${AD_MAX_ID_LENGTH} characters`,
          lineNumber,
          field: 'wildvalue',
        });
      }
    } else {
      datapoint.issues.push({
        severity: 'error',
        message: 'Batchscript output requires wildvalue prefix (format: wildvalue.datapoint=value)',
        lineNumber,
        field: 'name',
      });
    }
  }

  // Validate numeric value
  const numValue = parseFloat(rawValue);
  if (isNaN(numValue)) {
    datapoint.issues.push({
      severity: 'error',
      message: `Value "${rawValue}" is not a valid number`,
      lineNumber,
      field: 'value',
    });
  } else {
    datapoint.value = numValue;
  }

  // Validate datapoint name (basic check for valid characters)
  if (!/^[\w.-]+$/.test(datapoint.name)) {
    datapoint.issues.push({
      severity: 'warning',
      message: `Datapoint name "${datapoint.name}" contains non-standard characters`,
      lineNumber,
      field: 'name',
    });
  }

  return datapoint;
}

export function parseCollectionOutput(
  output: string, 
  mode: 'collection' | 'batchcollection'
): CollectionParseResult {
  const lines = output.split('\n');
  const datapoints: CollectionDatapoint[] = [];
  const unparsedLines: UnparsedLine[] = [];
  const isBatchMode = mode === 'batchcollection';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip comment lines but track them
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      unparsedLines.push({
        lineNumber,
        content: line,
        reason: 'Comment line',
      });
      continue;
    }

    // Check if line looks like collection format (contains =)
    if (!trimmed.includes('=')) {
      unparsedLines.push({
        lineNumber,
        content: line,
        reason: 'Does not match collection format (missing = delimiter)',
      });
      continue;
    }

    const datapoint = parseCollectionLine(line, lineNumber, isBatchMode);
    if (datapoint) {
      datapoints.push(datapoint);
    }
  }

  // Calculate summary
  const summary: ParseSummary = {
    total: datapoints.length,
    valid: datapoints.filter(d => d.issues.filter(i => i.severity === 'error').length === 0).length,
    errors: datapoints.reduce((sum, d) => sum + d.issues.filter(i => i.severity === 'error').length, 0),
    warnings: datapoints.reduce((sum, d) => sum + d.issues.filter(i => i.severity === 'warning').length, 0),
  };

  return {
    type: mode,
    datapoints,
    unparsedLines,
    summary,
  };
}

// ============================================================================
// Main Parser Entry Point
// ============================================================================

export function parseOutput(output: string, mode: ScriptMode): ParseResult | null {
  // Strip any warning lines at the beginning (from our prefetch)
  const lines = output.split('\n');
  const outputLines: string[] = [];
  let skipWarnings = true;
  
  for (const line of lines) {
    if (skipWarnings && (line.startsWith('[Warning:') || line.trim() === '')) {
      continue;
    }
    skipWarnings = false;
    outputLines.push(line);
  }
  
  const cleanOutput = outputLines.join('\n');

  switch (mode) {
    case 'ad':
      return parseADOutput(cleanOutput);
    case 'collection':
      return parseCollectionOutput(cleanOutput, 'collection');
    case 'batchcollection':
      return parseCollectionOutput(cleanOutput, 'batchcollection');
    case 'freeform':
      // Freeform mode doesn't parse
      return null;
    default:
      return null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function hasErrors(result: ParseResult): boolean {
  return result.summary.errors > 0;
}

export function hasWarnings(result: ParseResult): boolean {
  return result.summary.warnings > 0;
}

export function getAllIssues(result: ParseResult): ValidationIssue[] {
  if (result.type === 'ad') {
    return result.instances.flatMap(i => i.issues);
  }
  return result.datapoints.flatMap(d => d.issues);
}

export function getIssuesBySeverity(
  result: ParseResult, 
  severity: ValidationSeverity
): ValidationIssue[] {
  return getAllIssues(result).filter(i => i.severity === severity);
}

