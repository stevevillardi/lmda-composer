# LM IDE - Data Models & Types

## Overview

This document defines all TypeScript interfaces and types used throughout the LM IDE extension. These serve as the contract between components.

---

## Core Types

### Portal

Represents a LogicMonitor portal instance.

```typescript
interface Portal {
  /** Unique identifier (hostname) */
  id: string;
  
  /** Full hostname, e.g., "acme.logicmonitor.com" */
  hostname: string;
  
  /** Display name extracted from page or derived from hostname */
  displayName: string;
  
  /** Current CSRF token for this portal */
  csrfToken: string | null;
  
  /** When the CSRF token was last refreshed */
  csrfTokenTimestamp: number | null;
  
  /** Tab IDs associated with this portal */
  tabIds: number[];
  
  /** Portal session status */
  status: PortalStatus;
}

type PortalStatus = 
  | 'active'      // Valid session, ready to use
  | 'expired'     // Session expired, needs re-auth
  | 'unknown';    // Status not yet determined
```

---

### Collector

Represents a LogicMonitor collector.

```typescript
interface Collector {
  /** Collector ID */
  id: number;
  
  /** Collector description/name */
  description: string;
  
  /** Collector hostname */
  hostname: string;
  
  /** Collector status code (0=OK, 1=Warning, 2=Critical, 3=Dead) */
  statusCode: number;
  
  /** Human-readable status */
  status: CollectorStatus;
  
  /** Collector group ID */
  groupId: number;
  
  /** Collector group name */
  groupName: string;
  
  /** Platform (linux64, win64, etc.) */
  platform: string;
  
  /** Number of devices on this collector */
  deviceCount: number;
  
  /** Whether collector is down */
  isDown: boolean;
  
  /** Portal this collector belongs to */
  portalId: string;
}

type CollectorStatus = 
  | 'ok'        // Status code 0
  | 'warning'   // Status code 1
  | 'critical'  // Status code 2
  | 'dead';     // Status code 3

function mapStatusCode(code: number): CollectorStatus {
  switch (code) {
    case 0: return 'ok';
    case 1: return 'warning';
    case 2: return 'critical';
    case 3: return 'dead';
    default: return 'dead';
  }
}
```

---

### Device

Represents a LogicMonitor device/resource.

```typescript
interface Device {
  /** Device ID */
  id: number;
  
  /** Internal name */
  name: string;
  
  /** Display name */
  displayName: string;
  
  /** Preferred collector ID */
  preferredCollectorId: number;
  
  /** All device properties merged */
  properties: Record<string, string>;
  
  /** Portal this device belongs to */
  portalId: string;
}

interface DeviceProperty {
  name: string;
  value: string;
  source: 'system' | 'custom' | 'inherited' | 'auto';
}
```

---

### LogicModule

Represents a DataSource, PropertySource, EventSource, or ConfigSource.

```typescript
interface LogicModule {
  /** Module ID */
  id: number;
  
  /** Module name (unique identifier) */
  name: string;
  
  /** Display name */
  displayName: string;
  
  /** Module type */
  type: LogicModuleType;
  
  /** AppliesTo expression */
  appliesTo: string;
  
  /** Collection method */
  collectMethod: CollectMethod;
  
  /** Whether it has multiple instances */
  hasMultiInstances: boolean;
  
  /** Collection interval in seconds */
  collectInterval: number;
  
  /** Whether AD is enabled */
  enableAutoDiscovery: boolean;
  
  /** Active Discovery configuration */
  autoDiscoveryConfig: AutoDiscoveryConfig | null;
  
  /** Collector attribute containing scripts */
  collectorAttribute: CollectorAttribute;
  
  /** Datapoints (for DataSources) */
  dataPoints: DataPoint[];
}

type LogicModuleType = 
  | 'datasource'
  | 'propertysource'
  | 'eventsource'
  | 'configsource';

type CollectMethod = 
  | 'script'        // Single script per instance
  | 'batchscript'   // One script for all instances
  | 'snmp'
  | 'wmi'
  | 'jdbc'
  | 'jmx'
  | 'perfmon'
  | 'webpage'
  | 'dns'
  | 'internal';

type ScriptType = 'embed' | 'powerShell' | 'file';

interface CollectorAttribute {
  name: string;
  /** The script content (may be Groovy OR PowerShell - check scriptType!) */
  groovyScript: string;
  /** Identifies actual language: "embed" = Groovy, "powerShell" = PowerShell */
  scriptType: ScriptType;
  linuxScript: string;
  windowsScript: string;
  linuxCmdline: string;
  windowsCmdline: string;
}

interface ADMethod {
  name: string;        // "ad_script", "ad_snmp", etc.
  type: string;        // "embeded", "file"
  groovyScript: string | null;
  linuxScript: string | null;
  winScript: string | null;
}

interface AutoDiscoveryConfig {
  scheduleInterval: number;
  method: ADMethod;
  persistentInstance: boolean;
  disableInstance: boolean;
  deleteInactiveInstance: boolean;
}

interface DataPoint {
  id: number;
  name: string;
  dataType: number;
  description: string;
  postProcessorMethod: string;   // "namevalue", "regex", etc.
  postProcessorParam: string;    // Extraction pattern
  alertExpr: string;
  alertForNoData: number;
}

/** Helper to extract the correct script from a LogicModule */
interface ExtractedScripts {
  collection: string | null;
  ad: string | null;
  language: 'groovy' | 'powershell' | 'linux' | 'windows';
}

function extractScripts(module: LogicModule): ExtractedScripts {
  const attr = module.collectorAttribute;
  
  // Determine language
  let language: ExtractedScripts['language'] = 'groovy';
  if (attr.scriptType === 'powerShell') {
    language = 'powershell';
  } else if (attr.linuxScript) {
    language = 'linux';
  } else if (attr.windowsScript) {
    language = 'windows';
  }
  
  // Extract collection script
  const collection = attr.groovyScript || attr.linuxScript || attr.windowsScript || null;
  
  // Extract AD script
  const adMethod = module.autoDiscoveryConfig?.method;
  const ad = adMethod?.groovyScript || adMethod?.linuxScript || adMethod?.winScript || null;
  
  return { collection, ad, language };
}
```

---

## Execution Types

### Script Execution Request

```typescript
interface ExecuteScriptRequest {
  /** Target portal */
  portalId: string;
  
  /** Target collector ID */
  collectorId: number;
  
  /** Script content */
  script: string;
  
  /** Script language */
  language: ScriptLanguage;
  
  /** Execution mode */
  mode: ScriptMode;
  
  /** Target device hostname (optional) */
  hostname?: string;
  
  /** Device ID for hostId parameter (optional) */
  deviceId?: number;
  
  /** WildValue for instance context (optional) */
  wildvalue?: string;
}

type ScriptLanguage = 'groovy' | 'powershell';

type ScriptMode = 
  | 'ad'              // Active Discovery - validate ##instance## format
  | 'collection'      // Collection (script method) - validate datapoint=value format
  | 'batchcollection' // Collection (batchscript method) - validate wildvalue.datapoint=value format
  | 'freeform';       // No validation, raw output
```

---

### Execution Result

```typescript
interface ExecutionResult {
  /** Unique execution ID */
  id: string;
  
  /** Execution status */
  status: ExecutionStatus;
  
  /** Raw output from script */
  rawOutput: string;
  
  /** Parsed output (based on mode) */
  parsedOutput?: ParsedOutput;
  
  /** Validation results */
  validation: ValidationResult[];
  
  /** Execution duration in milliseconds */
  duration: number;
  
  /** Timestamp when execution started */
  startTime: number;
  
  /** Error message if status is 'error' */
  error?: string;
}

type ExecutionStatus = 
  | 'pending'     // Submitted, waiting for start
  | 'running'     // Currently executing
  | 'complete'    // Finished successfully
  | 'error'       // Finished with error
  | 'timeout'     // Execution timed out
  | 'cancelled';  // User cancelled
```

---

### Parsed Output

```typescript
type ParsedOutput = 
  | ADParsedOutput 
  | CollectionParsedOutput;

interface ADParsedOutput {
  type: 'ad';
  instances: ADInstance[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

interface ADInstance {
  /** Instance ID (wildvalue) */
  id: string;
  
  /** Instance name (wildalias) */
  name: string;
  
  /** Instance description */
  description?: string;
  
  /** Instance-level properties */
  properties?: Record<string, string>;
  
  /** Raw line from output */
  rawLine: string;
  
  /** Line number in output */
  lineNumber: number;
  
  /** Whether this instance is valid */
  isValid: boolean;
  
  /** Validation errors for this instance */
  errors: ValidationError[];
}

interface CollectionParsedOutput {
  type: 'collection';
  datapoints: CollectionDatapoint[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

interface CollectionDatapoint {
  /** Datapoint name */
  name: string;
  
  /** Datapoint value (numeric) */
  value: number;
  
  /** Raw value string */
  rawValue: string;
  
  /** Raw line from output */
  rawLine: string;
  
  /** Line number in output */
  lineNumber: number;
  
  /** Whether this datapoint is valid */
  isValid: boolean;
  
  /** Validation errors */
  errors: ValidationError[];
}
```

---

### Validation

```typescript
interface ValidationResult {
  /** Overall validation passed */
  isValid: boolean;
  
  /** Number of errors */
  errorCount: number;
  
  /** Number of warnings */
  warningCount: number;
  
  /** All validation messages */
  messages: ValidationMessage[];
}

interface ValidationMessage {
  /** Severity level */
  severity: ValidationSeverity;
  
  /** Message text */
  message: string;
  
  /** Line number (if applicable) */
  line?: number;
  
  /** Column number (if applicable) */
  column?: number;
  
  /** Rule that triggered this message */
  rule: string;
}

type ValidationSeverity = 'error' | 'warning' | 'info';

interface ValidationError {
  severity: ValidationSeverity;
  message: string;
  rule: string;
}
```

---

## Editor State

### Zustand Store Interface

```typescript
interface EditorStore {
  // === Target Selection ===
  portals: Portal[];
  selectedPortalId: string | null;
  collectors: Collector[];
  selectedCollectorId: number | null;
  hostname: string;
  wildvalue: string;
  
  // === Editor State ===
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  isDirty: boolean;
  
  // === Execution State ===
  isExecuting: boolean;
  currentExecution: ExecutionResult | null;
  executionHistory: ExecutionHistoryEntry[];
  
  // === Module Browser ===
  moduleSearchQuery: string;
  moduleSearchResults: LogicModule[];
  isSearching: boolean;
  loadedModule: LogicModule | null;
  
  // === UI State ===
  isContextPanelOpen: boolean;
  isOutputPanelOpen: boolean;
  isModuleBrowserOpen: boolean;
  outputTab: 'raw' | 'parsed' | 'validation';
  
  // === Actions ===
  setSelectedPortal: (portalId: string) => void;
  setSelectedCollector: (collectorId: number) => void;
  setHostname: (hostname: string) => void;
  setWildvalue: (wildvalue: string) => void;
  setScript: (script: string) => void;
  setLanguage: (language: ScriptLanguage) => void;
  setMode: (mode: ScriptMode) => void;
  executeScript: () => Promise<void>;
  cancelExecution: () => void;
  searchModules: (query: string) => Promise<void>;
  loadModule: (moduleId: number, scriptType: 'ad' | 'collection') => Promise<void>;
  refreshPortals: () => Promise<void>;
  refreshCollectors: () => Promise<void>;
}
```

---

### Execution History

```typescript
interface ExecutionHistoryEntry {
  id: string;
  timestamp: number;
  portal: string;
  collector: string;
  hostname?: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  script: string;
  output: string;
  status: 'success' | 'error';
  duration: number;
}
```

---

## Message Types

### Chrome Extension Messages

```typescript
// Messages from Editor to Service Worker
type EditorToSWMessage =
  | { type: 'DISCOVER_PORTALS' }
  | { type: 'GET_COLLECTORS'; payload: { portalId: string } }
  | { type: 'EXECUTE_SCRIPT'; payload: ExecuteScriptRequest }
  | { type: 'CANCEL_EXECUTION'; payload: { executionId: string } }
  | { type: 'SEARCH_MODULES'; payload: { portalId: string; query: string } }
  | { type: 'LOAD_MODULE'; payload: { portalId: string; moduleId: number } }
  | { type: 'GET_DEVICE'; payload: { portalId: string; hostname: string } };

// Messages from Service Worker to Editor
type SWToEditorMessage =
  | { type: 'PORTALS_UPDATE'; payload: Portal[] }
  | { type: 'COLLECTORS_UPDATE'; payload: Collector[] }
  | { type: 'EXECUTION_UPDATE'; payload: ExecutionResult }
  | { type: 'MODULES_UPDATE'; payload: LogicModule[] }
  | { type: 'MODULE_LOADED'; payload: LogicModule }
  | { type: 'DEVICE_LOADED'; payload: Device }
  | { type: 'ERROR'; payload: { code: string; message: string } };

// Messages from Content Script to Service Worker
type ContentToSWMessage =
  | { type: 'CSRF_TOKEN'; payload: { portalId: string; token: string } }
  | { type: 'OPEN_EDITOR'; payload: DeviceContext };

interface DeviceContext {
  portalId: string;
  hostname?: string;
  deviceId?: number;
  collectorId?: number;
}
```

---

## Persistence Types

### Chrome Storage Schema

```typescript
interface StoredState {
  // Cached portals (may be stale)
  portals: Portal[];
  
  // Cached collectors per portal
  collectors: Record<string, Collector[]>;
  
  // User preferences
  preferences: UserPreferences;
  
  // Execution history
  executionHistory: ExecutionHistoryEntry[];
  
  // Draft scripts (auto-save)
  drafts: Record<string, DraftScript>;
}

interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  defaultMode: ScriptMode;
  defaultLanguage: ScriptLanguage;
  maxHistorySize: number;
}

interface DraftScript {
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  hostname?: string;
  lastModified: number;
}
```

---

## Validation Rules

### AD Instance Validation Rules

```typescript
const AD_VALIDATION_RULES = {
  INSTANCE_ID_REQUIRED: {
    rule: 'INSTANCE_ID_REQUIRED',
    severity: 'error' as const,
    message: 'Instance ID is required',
    validate: (instance: ADInstance) => instance.id.length > 0
  },
  INSTANCE_ID_MAX_LENGTH: {
    rule: 'INSTANCE_ID_MAX_LENGTH',
    severity: 'error' as const,
    message: 'Instance ID exceeds 1024 character limit',
    validate: (instance: ADInstance) => instance.id.length <= 1024
  },
  INSTANCE_ID_INVALID_CHARS: {
    rule: 'INSTANCE_ID_INVALID_CHARS',
    severity: 'error' as const,
    message: 'Instance ID contains invalid characters (=, :, \\, #, space)',
    validate: (instance: ADInstance) => !/[=:\\\# ]/.test(instance.id)
  },
  INSTANCE_NAME_MAX_LENGTH: {
    rule: 'INSTANCE_NAME_MAX_LENGTH',
    severity: 'warning' as const,
    message: 'Instance name exceeds 255 character limit',
    validate: (instance: ADInstance) => instance.name.length <= 255
  }
};
```

### Collection Datapoint Validation Rules

```typescript
const COLLECTION_VALIDATION_RULES = {
  VALUE_REQUIRED: {
    rule: 'VALUE_REQUIRED',
    severity: 'error' as const,
    message: 'Datapoint value is required',
    validate: (dp: CollectionDatapoint) => dp.rawValue.length > 0
  },
  VALUE_NUMERIC: {
    rule: 'VALUE_NUMERIC',
    severity: 'error' as const,
    message: 'Datapoint value must be numeric',
    validate: (dp: CollectionDatapoint) => !isNaN(dp.value)
  },
  NAME_VALID_CHARS: {
    rule: 'NAME_VALID_CHARS',
    severity: 'warning' as const,
    message: 'Datapoint name contains unusual characters',
    validate: (dp: CollectionDatapoint) => /^[\w.-]+$/.test(dp.name)
  }
};
```

---

## Constants

```typescript
// API Constants
const API_VERSION = '3';
const CSRF_FETCH_HEADER = 'Fetch';
const MAX_SCRIPT_LENGTH = 64000;

// Polling Constants
const EXECUTION_POLL_INTERVAL_MS = 1000;
const EXECUTION_MAX_ATTEMPTS = 120;  // 2 minutes
const CSRF_REFRESH_INTERVAL_MS = 10 * 60 * 1000;  // 10 minutes

// UI Constants
const MAX_HISTORY_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const MIN_WINDOW_WIDTH = 800;
const MIN_WINDOW_HEIGHT = 600;

// Collector Status
const COLLECTOR_STATUS_MAP = {
  0: 'ok',
  1: 'warning',
  2: 'critical',
  3: 'dead'
} as const;
```

