import type { ScriptMode, LogicModuleType } from '@/shared/types';

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
  isJsonFormat?: boolean;
}

// Topology Source types
export interface TopologyVertex {
  id: string;
  name?: string;
  type?: string;
  properties?: Record<string, unknown>;
  issues: ValidationIssue[];
}

export interface TopologyHealthMetric {
  Tx?: Record<string, string>;
  Rx?: Record<string, string>;
}

export interface TopologyHealthData {
  Utilization?: TopologyHealthMetric;
  'Packet Loss'?: TopologyHealthMetric;
  Throughput?: TopologyHealthMetric;
}

export interface TopologyEdge {
  from: string;
  to: string;
  type?: string;
  displayType?: string;
  fromInstance?: string;
  toInstance?: string;
  fromInstanceEdgeType?: string;
  toInstanceEdgeType?: string;
  instanceEdgeType?: string;
  healthData?: TopologyHealthData;
  metaData?: Record<string, string>;
  metricReportingNode?: string;
  issues: ValidationIssue[];
}

export interface TopologyParseResult {
  type: 'topology';
  vertices: TopologyVertex[];
  edges: TopologyEdge[];
  unparsedLines: UnparsedLine[];
  summary: ParseSummary;
}

// Event Source types
export interface EventEntry {
  happenedOn?: string;
  severity?: string;
  message?: string;
  source?: string;
  properties?: Record<string, unknown>;
  issues: ValidationIssue[];
  lineNumber: number;
  rawLine: string;
}

export interface EventParseResult {
  type: 'event';
  events: EventEntry[];
  unparsedLines: UnparsedLine[];
  summary: ParseSummary;
}

// Property Source types
export interface PropertyEntry {
  name: string;
  value: string;
  issues: ValidationIssue[];
  lineNumber: number;
  rawLine: string;
}

export interface PropertyParseResult {
  type: 'property';
  properties: PropertyEntry[];
  unparsedLines: UnparsedLine[];
  summary: ParseSummary;
}

// Log Source types
export interface LogEntry {
  timestamp?: string;
  message: string;
  issues: ValidationIssue[];
  lineNumber: number;
  rawLine: string;
}

export interface LogParseResult {
  type: 'log';
  entries: LogEntry[];
  unparsedLines: UnparsedLine[];
  summary: ParseSummary;
}

// Config Source types (non-batch collection output)
export interface ConfigParseResult {
  type: 'config';
  content: string;
  issues: ValidationIssue[];
  summary: ParseSummary;
}

// Script execution error result
export interface ScriptErrorParseResult {
  type: 'script_error';
  errorMessage: string;
  output: string;
  issues: ValidationIssue[];
  summary: ParseSummary;
}

export interface UnparsedLine {
  lineNumber: number;
  content: string;
  reason: string;
}

export type ParseResult = 
  | ADParseResult 
  | CollectionParseResult 
  | TopologyParseResult
  | EventParseResult
  | PropertyParseResult
  | LogParseResult
  | ConfigParseResult
  | ScriptErrorParseResult;

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
      // Skip empty pairs or pairs containing only # characters (e.g., trailing ######)
      const trimmedPair = pair.trim();
      if (!trimmedPair || /^#+$/.test(trimmedPair)) {
        continue;
      }
      
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        const key = pair.substring(0, eqIndex);
        const value = pair.substring(eqIndex + 1);
        instance.properties[key] = value;
      } else {
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
// Collection Parser (with JSON BatchScript support)
// ============================================================================

interface BatchScriptJSONData {
  data: Record<string, {
    values?: Record<string, number | string>;
    configuration?: string;
  }>;
}

function tryParseBatchScriptJSON(output: string): CollectionParseResult | null {
  const trimmed = output.trim();
  if (!trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as BatchScriptJSONData;
    
    if (!parsed.data || typeof parsed.data !== 'object') {
      return null;
    }

    const datapoints: CollectionDatapoint[] = [];
    
    for (const [wildvalue, instanceData] of Object.entries(parsed.data)) {
      // Handle DataSource BatchScript format: { values: { metric: value } }
      if (instanceData?.values && typeof instanceData.values === 'object') {
        for (const [metric, value] of Object.entries(instanceData.values)) {
          const issues: ValidationIssue[] = [];
          let numValue: number | null = null;
          
          // Validate wildvalue
          if (AD_INVALID_ID_CHARS.test(wildvalue)) {
            issues.push({
              severity: 'error',
              message: 'Wildvalue contains invalid characters (spaces, =, :, \\, or #)',
              lineNumber: 1,
              field: 'wildvalue',
            });
          }
          
          if (wildvalue.length > AD_MAX_ID_LENGTH) {
            issues.push({
              severity: 'error',
              message: `Wildvalue exceeds maximum length of ${AD_MAX_ID_LENGTH} characters`,
              lineNumber: 1,
              field: 'wildvalue',
            });
          }
          
          // Validate numeric value
          if (typeof value === 'number') {
            numValue = value;
          } else if (typeof value === 'string') {
            const parsedNum = parseFloat(value);
            if (isNaN(parsedNum)) {
              issues.push({
                severity: 'error',
                message: `Value "${value}" is not a valid number`,
                lineNumber: 1,
                field: 'value',
              });
            } else {
              numValue = parsedNum;
            }
          } else {
            issues.push({
              severity: 'error',
              message: `Value must be a number, got ${typeof value}`,
              lineNumber: 1,
              field: 'value',
            });
          }
          
          datapoints.push({
            name: metric,
            value: numValue,
            rawValue: String(value),
            wildvalue,
            issues,
            lineNumber: 1,
            rawLine: `${wildvalue}.${metric}=${value}`,
          });
        }
      }
      // Handle ConfigSource BatchScript format: { configuration: "..." }
      else if (instanceData?.configuration !== undefined) {
        const issues: ValidationIssue[] = [];
        
        // Validate wildvalue
        if (/[:\#\\\s]/.test(wildvalue)) {
          issues.push({
            severity: 'error',
            message: `Wildvalue "${wildvalue}" contains invalid characters (:, #, \\, or space)`,
            lineNumber: 1,
            field: 'wildvalue',
          });
        }
        
        const config = instanceData.configuration;
        if (typeof config !== 'string') {
          issues.push({
            severity: 'error',
            message: `Configuration must be a string, got ${typeof config}`,
            lineNumber: 1,
            field: 'value',
          });
        } else if (!config.trim()) {
          issues.push({
            severity: 'warning',
            message: 'Configuration is empty',
            lineNumber: 1,
            field: 'value',
          });
        }
        
        // Represent config as a "datapoint" for unified display
        datapoints.push({
          name: 'configuration',
          value: null, // Non-numeric
          rawValue: typeof config === 'string' ? config : String(config),
          wildvalue,
          issues,
          lineNumber: 1,
          rawLine: `${wildvalue}.configuration=${typeof config === 'string' ? config.substring(0, 50) + '...' : config}`,
        });
      }
    }
    
    const summary: ParseSummary = {
      total: datapoints.length,
      valid: datapoints.filter(d => d.issues.filter(i => i.severity === 'error').length === 0).length,
      errors: datapoints.reduce((sum, d) => sum + d.issues.filter(i => i.severity === 'error').length, 0),
      warnings: datapoints.reduce((sum, d) => sum + d.issues.filter(i => i.severity === 'warning').length, 0),
    };
    
    return {
      type: 'batchcollection',
      datapoints,
      unparsedLines: [],
      summary,
      isJsonFormat: true,
    };
  } catch {
    return null;
  }
}

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
  const isBatchMode = mode === 'batchcollection';
  
  // For batch mode, try JSON format first
  if (isBatchMode) {
    const jsonResult = tryParseBatchScriptJSON(output);
    if (jsonResult) {
      return jsonResult;
    }
  }
  
  const lines = output.split('\n');
  const datapoints: CollectionDatapoint[] = [];
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
// Topology Source Parser
// ============================================================================

function parseTopologyOutput(output: string): TopologyParseResult {
  const vertices: TopologyVertex[] = [];
  const edges: TopologyEdge[] = [];
  const unparsedLines: UnparsedLine[] = [];
  
  try {
    const parsed = JSON.parse(output.trim());
    
    // Parse vertices
    if (Array.isArray(parsed.vertices)) {
      for (const v of parsed.vertices) {
        const vertex: TopologyVertex = {
          id: v.id || v.name || 'unknown',
          name: v.name,
          type: v.type,
          properties: v.properties,
          issues: [],
        };
        
        // Validate vertex
        if (!v.id && !v.name) {
          vertex.issues.push({
            severity: 'error',
            message: 'Vertex must have an id or name',
            lineNumber: 1,
          });
        }
        
        vertices.push(vertex);
      }
    }
    
    // Parse edges
    if (Array.isArray(parsed.edges)) {
      for (const e of parsed.edges) {
        const edge: TopologyEdge = {
          from: e.from || '',
          to: e.to || '',
          type: e.type,
          displayType: e.displayType,
          fromInstance: e.fromInstance,
          toInstance: e.toInstance,
          fromInstanceEdgeType: e.fromInstanceEdgeType,
          toInstanceEdgeType: e.toInstanceEdgeType,
          instanceEdgeType: e.instanceEdgeType,
          healthData: e.fromHealthData || e.toHealthData,
          metaData: e.metaData,
          metricReportingNode: e.metricReportingNode,
          issues: [],
        };
        
        // Validate edge
        if (!e.from) {
          edge.issues.push({
            severity: 'error',
            message: 'Edge must have a "from" field',
            lineNumber: 1,
          });
        }
        if (!e.to) {
          edge.issues.push({
            severity: 'error',
            message: 'Edge must have a "to" field',
            lineNumber: 1,
          });
        }
        
        edges.push(edge);
      }
    }
    
    // Check for required arrays
    if (!parsed.vertices) {
      unparsedLines.push({
        lineNumber: 1,
        content: output.substring(0, 100),
        reason: 'Missing "vertices" array in topology output',
      });
    }
    if (!parsed.edges) {
      unparsedLines.push({
        lineNumber: 1,
        content: output.substring(0, 100),
        reason: 'Missing "edges" array in topology output',
      });
    }
  } catch (e) {
    unparsedLines.push({
      lineNumber: 1,
      content: output.substring(0, 100) + (output.length > 100 ? '...' : ''),
      reason: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`,
    });
  }
  
  const allIssues = [...vertices.flatMap(v => v.issues), ...edges.flatMap(e => e.issues)];
  
  return {
    type: 'topology',
    vertices,
    edges,
    unparsedLines,
    summary: {
      total: vertices.length + edges.length,
      valid: vertices.filter(v => v.issues.length === 0).length + edges.filter(e => e.issues.length === 0).length,
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
    },
  };
}

// ============================================================================
// Event Source Parser
// ============================================================================

function parseEventOutput(output: string): EventParseResult {
  const events: EventEntry[] = [];
  const unparsedLines: UnparsedLine[] = [];
  
  try {
    const parsed = JSON.parse(output.trim());
    
    // Events can be a direct array or nested under "events" key
    const eventArray = Array.isArray(parsed) ? parsed : (parsed.events || []);
    
    if (!Array.isArray(eventArray)) {
      unparsedLines.push({
        lineNumber: 1,
        content: output.substring(0, 100),
        reason: 'Expected an array of events',
      });
    } else {
      for (let i = 0; i < eventArray.length; i++) {
        const e = eventArray[i];
        const event: EventEntry = {
          happenedOn: e.happenedOn || e.timestamp,
          severity: e.severity,
          message: e.message,
          source: e.source,
          properties: e.properties,
          issues: [],
          lineNumber: i + 1,
          rawLine: JSON.stringify(e),
        };
        
        // Validate event
        if (!event.message && !event.happenedOn) {
          event.issues.push({
            severity: 'warning',
            message: 'Event should have a message or timestamp',
            lineNumber: i + 1,
          });
        }
        
        // Validate severity if present
        if (event.severity) {
          const validSeverities = ['critical', 'error', 'warn', 'info', 'debug'];
          if (!validSeverities.includes(event.severity.toLowerCase())) {
            event.issues.push({
              severity: 'warning',
              message: `Unknown severity "${event.severity}". Expected: ${validSeverities.join(', ')}`,
              lineNumber: i + 1,
            });
          }
        }
        
        events.push(event);
      }
    }
  } catch (e) {
    unparsedLines.push({
      lineNumber: 1,
      content: output.substring(0, 100) + (output.length > 100 ? '...' : ''),
      reason: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`,
    });
  }
  
  return {
    type: 'event',
    events,
    unparsedLines,
    summary: {
      total: events.length,
      valid: events.filter(e => e.issues.filter(i => i.severity === 'error').length === 0).length,
      errors: events.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'error').length, 0),
      warnings: events.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'warning').length, 0),
    },
  };
}

// ============================================================================
// Property Source Parser
// ============================================================================

function parsePropertyOutput(output: string): PropertyParseResult {
  const properties: PropertyEntry[] = [];
  const unparsedLines: UnparsedLine[] = [];
  const lines = output.split('\n');
  const seenProperties = new Set<string>();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Skip comment lines
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      unparsedLines.push({
        lineNumber,
        content: line,
        reason: 'Comment line',
      });
      continue;
    }
    
    // Property format: name=value
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) {
      unparsedLines.push({
        lineNumber,
        content: line,
        reason: 'Does not match property format (missing = delimiter)',
      });
      continue;
    }
    
    const name = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);
    
    const property: PropertyEntry = {
      name,
      value,
      issues: [],
      lineNumber,
      rawLine: line,
    };
    
    // Validate property name
    if (!name) {
      property.issues.push({
        severity: 'error',
        message: 'Property name cannot be empty',
        lineNumber,
        field: 'name',
      });
    } else if (!/^[a-zA-Z_][\w.-]*$/.test(name)) {
      property.issues.push({
        severity: 'warning',
        message: `Property name "${name}" contains non-standard characters`,
        lineNumber,
        field: 'name',
      });
    }
    
    // Check for duplicates
    if (seenProperties.has(name)) {
      property.issues.push({
        severity: 'warning',
        message: `Duplicate property name "${name}"`,
        lineNumber,
        field: 'name',
      });
    }
    seenProperties.add(name);
    
    properties.push(property);
  }
  
  return {
    type: 'property',
    properties,
    unparsedLines,
    summary: {
      total: properties.length,
      valid: properties.filter(p => p.issues.filter(i => i.severity === 'error').length === 0).length,
      errors: properties.reduce((sum, p) => sum + p.issues.filter(i => i.severity === 'error').length, 0),
      warnings: properties.reduce((sum, p) => sum + p.issues.filter(i => i.severity === 'warning').length, 0),
    },
  };
}

// ============================================================================
// Log Source Parser
// ============================================================================

function parseLogOutput(output: string): LogParseResult {
  const entries: LogEntry[] = [];
  const unparsedLines: UnparsedLine[] = [];
  
  // Try JSON format first
  try {
    const parsed = JSON.parse(output.trim());
    const logArray = Array.isArray(parsed) ? parsed : (parsed.logs || parsed.entries || []);
    
    if (Array.isArray(logArray)) {
      for (let i = 0; i < logArray.length; i++) {
        const log = logArray[i];
        const entry: LogEntry = {
          timestamp: log.timestamp || log.time,
          message: typeof log === 'string' ? log : (log.message || log.msg || JSON.stringify(log)),
          issues: [],
          lineNumber: i + 1,
          rawLine: typeof log === 'string' ? log : JSON.stringify(log),
        };
        
        // Validate timestamp format if present
        if (entry.timestamp && isNaN(Date.parse(entry.timestamp))) {
          entry.issues.push({
            severity: 'warning',
            message: `Timestamp "${entry.timestamp}" may not be in a standard format`,
            lineNumber: i + 1,
          });
        }
        
        entries.push(entry);
      }
      
      return {
        type: 'log',
        entries,
        unparsedLines,
        summary: {
          total: entries.length,
          valid: entries.filter(e => e.issues.filter(i => i.severity === 'error').length === 0).length,
          errors: entries.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'error').length, 0),
          warnings: entries.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'warning').length, 0),
        },
      };
    }
  } catch {
    // Not JSON, try line-by-line parsing
  }
  
  // Line-by-line parsing for plain text logs
  const lines = output.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const entry: LogEntry = {
      message: trimmed,
      issues: [],
      lineNumber: i + 1,
      rawLine: line,
    };
    
    // Try to extract timestamp from common formats
    const timestampMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[.\d]*Z?)\s+(.*)$/);
    if (timestampMatch) {
      entry.timestamp = timestampMatch[1];
      entry.message = timestampMatch[2];
    }
    
    entries.push(entry);
  }
  
  return {
    type: 'log',
    entries,
    unparsedLines,
    summary: {
      total: entries.length,
      valid: entries.filter(e => e.issues.filter(i => i.severity === 'error').length === 0).length,
      errors: entries.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'error').length, 0),
      warnings: entries.reduce((sum, e) => sum + e.issues.filter(i => i.severity === 'warning').length, 0),
    },
  };
}

// ============================================================================
// Config Source Parser (non-batch)
// ============================================================================

function parseConfigOutput(output: string): ConfigParseResult {
  const issues: ValidationIssue[] = [];
  
  // ConfigSource (non-batch) outputs raw configuration text
  // We just validate it's not empty
  if (!output.trim()) {
    issues.push({
      severity: 'warning',
      message: 'Configuration output is empty',
      lineNumber: 1,
    });
  }
  
  return {
    type: 'config',
    content: output,
    issues,
    summary: {
      total: 1,
      valid: issues.filter(i => i.severity === 'error').length === 0 ? 1 : 0,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
    },
  };
}

// ============================================================================
// Script Execution Error Detection
// ============================================================================

/**
 * Detects if the output contains a script execution error.
 * LogicMonitor returns errors in the format:
 * "Error when executing the script - <error message>"
 * or
 * "Error when executing the script -\noutput:\n<output>"
 */
function detectScriptError(output: string): ScriptErrorParseResult | null {
  const trimmed = output.trim();
  
  // Check for script execution error pattern
  const errorMatch = trimmed.match(/^Error when executing the script\s*[-–—]\s*(.*?)(?:\noutput:\n([\s\S]*))?$/is);
  
  if (errorMatch) {
    const errorMessage = errorMatch[1]?.trim() || 'Unknown error';
    const scriptOutput = errorMatch[2]?.trim() || '';
    
    const issues: ValidationIssue[] = [{
      severity: 'error',
      message: `Script execution failed: ${errorMessage}`,
      lineNumber: 1,
    }];
    
    return {
      type: 'script_error',
      errorMessage,
      output: scriptOutput,
      issues,
      summary: {
        total: 1,
        valid: 0,
        errors: 1,
        warnings: 0,
      },
    };
  }
  
  // Also check for common error patterns at the start
  if (trimmed.startsWith('Error:') || trimmed.startsWith('ERROR:')) {
    const errorMessage = trimmed.substring(trimmed.indexOf(':') + 1).trim().split('\n')[0];
    
    return {
      type: 'script_error',
      errorMessage,
      output: trimmed,
      issues: [{
        severity: 'error',
        message: `Script error: ${errorMessage}`,
        lineNumber: 1,
      }],
      summary: {
        total: 1,
        valid: 0,
        errors: 1,
        warnings: 0,
      },
    };
  }
  
  return null;
}

// ============================================================================
// Main Parser Entry Point
// ============================================================================

/**
 * Normalizes script execution output by stripping the standard header format:
 * - "returns X" line (exit code)
 * - "output:" label line
 * - Warning lines like "[Warning: ...]"
 * - Leading empty lines
 */
function normalizeScriptOutput(output: string): string {
  const lines = output.split('\n');
  const outputLines: string[] = [];
  let skipHeader = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (skipHeader) {
      // Skip warning lines
      if (trimmed.startsWith('[Warning:')) {
        continue;
      }
      // Skip empty lines at the beginning
      if (trimmed === '') {
        continue;
      }
      // Skip "returns X" line (exit code)
      if (/^returns\s+\d+$/i.test(trimmed)) {
        continue;
      }
      // Skip "output:" label line
      if (/^output:$/i.test(trimmed)) {
        continue;
      }
      // Found actual content, stop skipping
      skipHeader = false;
    }
    
    outputLines.push(line);
  }
  
  return outputLines.join('\n');
}

/**
 * Options for parsing output
 */
export interface ParseOptions {
  /** The user-selected script mode */
  mode: ScriptMode;
  /** The module type (used for specialized parsing within collection mode) */
  moduleType?: LogicModuleType;
  /** The script type within the module */
  scriptType?: 'ad' | 'collection';
}

/**
 * Parse script output with mode and optional module type for specialized validation
 */
export function parseOutput(output: string, options: ParseOptions): ParseResult | null;
/**
 * @deprecated Use parseOutput(output, options) instead
 */
export function parseOutput(output: string, mode: ScriptMode): ParseResult | null;
export function parseOutput(output: string, modeOrOptions: ScriptMode | ParseOptions): ParseResult | null {
  // Handle both old and new API
  const options: ParseOptions = typeof modeOrOptions === 'string' 
    ? { mode: modeOrOptions } 
    : modeOrOptions;
  
  const { mode, moduleType, scriptType } = options;

  // For freeform mode, no parsing
  if (mode === 'freeform') {
    return null;
  }
  
  // Check for script execution errors first (before normalization)
  const scriptError = detectScriptError(output);
  if (scriptError) {
    return scriptError;
  }
  
  // Normalize the output by stripping header lines
  const cleanOutput = normalizeScriptOutput(output);
  
  // AD mode - always use AD parser
  if (mode === 'ad') {
    return parseADOutput(cleanOutput);
  }
  
  // Batch collection mode
  if (mode === 'batchcollection') {
    return parseCollectionOutput(cleanOutput, 'batchcollection');
  }
  
  // Collection mode - use specialized parser based on module type
  if (mode === 'collection' && moduleType && scriptType === 'collection') {
    switch (moduleType) {
      case 'topologysource':
        return parseTopologyOutput(cleanOutput);
      case 'eventsource':
        return parseEventOutput(cleanOutput);
      case 'propertysource':
        return parsePropertyOutput(cleanOutput);
      case 'logsource':
        return parseLogOutput(cleanOutput);
      case 'configsource':
        // Non-batch configsource
        return parseConfigOutput(cleanOutput);
      case 'datasource':
      default:
        // Standard collection (key=value)
        return parseCollectionOutput(cleanOutput, 'collection');
    }
  }
  
  // Default to standard collection parser
  return parseCollectionOutput(cleanOutput, 'collection');
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
  switch (result.type) {
    case 'ad':
      return result.instances.flatMap(i => i.issues);
    case 'collection':
    case 'batchcollection':
      return result.datapoints.flatMap(d => d.issues);
    case 'topology':
      return [...result.vertices.flatMap(v => v.issues), ...result.edges.flatMap(e => e.issues)];
    case 'event':
      return result.events.flatMap(e => e.issues);
    case 'property':
      return result.properties.flatMap(p => p.issues);
    case 'log':
      return result.entries.flatMap(e => e.issues);
    case 'config':
    case 'script_error':
      return result.issues;
    default:
      return [];
  }
}

export function getIssuesBySeverity(
  result: ParseResult, 
  severity: ValidationSeverity
): ValidationIssue[] {
  return getAllIssues(result).filter(i => i.severity === severity);
}
