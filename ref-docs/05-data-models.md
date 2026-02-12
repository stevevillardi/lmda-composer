# LogicMonitor IDE - Data Models & Types

## Overview

This document defines all TypeScript interfaces and types used throughout the LogicMonitor IDE extension. These serve as the contract between components.

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

Represents a LogicMonitor collector (lightweight fields used by the UI).

```typescript
interface Collector {
  id: number;
  description: string;
  hostname: string;
  /** Raw status code returned by the API */
  status: number;
  isDown: boolean;
  collectorGroupName: string;
}
```

---

### DeviceInfo

Lightweight device info used for dropdowns and lookups.

```typescript
interface DeviceInfo {
  id: number;
  name: string;
  displayName: string;
  currentCollectorId: number;
  /** "normal" = online, anything else indicates an issue */
  hostStatus: string;
}

interface DeviceProperty {
  name: string;
  value: string;
  type: 'system' | 'custom' | 'inherited' | 'auto';
}
```

---

### Snippet

Snippet definitions used by the snippet library.

```typescript
interface Snippet {
  id: string;
  name: string;
  description: string;
  language: 'groovy' | 'powershell' | 'both';
  category: 'template' | 'pattern';
  tags: string[];
  code: string;
  isBuiltIn: boolean;
}
```

---

### EditorTab

Multi-tab editing model for the editor.

```typescript
type EditorTabSourceType = 'module' | 'file' | 'new' | 'history' | 'api';

interface EditorTabSource {
  type: EditorTabSourceType;
  moduleId?: number;
  moduleName?: string;
  moduleType?: LogicModuleType;
  scriptType?: 'collection' | 'ad';
  lineageId?: string;
}

interface EditorTabContextOverride {
  hostname?: string;
  collectorId?: number;
}

interface EditorTab {
  id: string;
  kind?: 'script' | 'api';
  displayName: string;
  content: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  source?: EditorTabSource;
  contextOverride?: EditorTabContextOverride;
  api?: ApiTabState;
  document?: DocumentState;
  fileHandleId?: string;
  directoryHandleId?: string;
}

interface DraftTabs {
  tabs: EditorTab[];
  activeTabId: string | null;
  lastModified: number;
}
```

---

### LogicModule

LogicModule types used by the module browser and previews.

```typescript
type LogicModuleType =
  | 'datasource'
  | 'configsource'
  | 'topologysource'
  | 'propertysource'
  | 'logsource'
  | 'diagnosticsource'
  | 'eventsource';

type CollectMethod =
  | 'script'
  | 'batchscript'
  | 'snmp'
  | 'wmi'
  | 'jdbc'
  | 'jmx'
  | 'perfmon'
  | 'webpage'
  | 'dns'
  | 'internal';

type ScriptType = 'embed' | 'powerShell' | 'file';

// Lightweight module info for list display
interface LogicModuleInfo {
  id: number;
  name: string;
  displayName: string;
  moduleType: LogicModuleType;
  appliesTo: string;
  collectMethod: string;
  collectInterval?: number;
  hasAutoDiscovery: boolean;
  scriptType: ScriptType;
  lineageId?: string;
  collectionScript?: string;
  adScript?: string;
  dataPoints?: Array<{
    id: number;
    name: string;
    description?: string;
    alertForNoData?: number | boolean;
    alertExpr?: string;
    alertTransitionInterval?: number;
    alertClearTransitionInterval?: number;
  }>;
}

interface CollectorAttribute {
  name: string;
  groovyScript: string;
  scriptType: ScriptType;
  linuxScript: string;
  windowsScript: string;
}

interface ADMethod {
  name: string;
  type: string;
  groovyScript: string | null;
  linuxScript: string | null;
  winScript: string | null;
}

interface AutoDiscoveryConfig {
  scheduleInterval: number;
  method: ADMethod;
}

interface DataPoint {
  id: number;
  name: string;
  dataType: number;
  description: string;
  postProcessorMethod: string;
  postProcessorParam: string;
}

### Module Search

```typescript
type ModuleSearchMatchType = 'substring' | 'exact' | 'regex';

interface ScriptMatchRange {
  line: number;
  startColumn: number;
  endColumn: number;
}

interface ScriptSearchResult {
  module: LogicModuleInfo;
  collectionMatches: ScriptMatchRange[];
  adMatches: ScriptMatchRange[];
}

interface DataPointSearchResult {
  moduleId: number;
  moduleName: string;
  moduleDisplayName: string;
  appliesTo: string;
  collectInterval?: number;
  dataPoint: {
    id: number;
    name: string;
    description: string;
    alertForNoData?: number | boolean;
    alertExpr?: string;
    alertTransitionInterval?: number;
    alertClearTransitionInterval?: number;
  };
}

interface SearchModuleScriptsRequest {
  portalId: string;
  query: string;
  matchType: ModuleSearchMatchType;
  caseSensitive: boolean;
  moduleTypes: LogicModuleType[];
}

interface SearchModuleScriptsResponse {
  results: ScriptSearchResult[];
}

interface SearchDatapointsRequest {
  portalId: string;
  query: string;
  matchType: ModuleSearchMatchType;
  caseSensitive: boolean;
}

interface SearchDatapointsResponse {
  results: DataPointSearchResult[];
}
```

interface LogicModule {
  id: number;
  name: string;
  displayName: string;
  type: LogicModuleType;
  appliesTo: string;
  collectMethod: CollectMethod;
  hasMultiInstances: boolean;
  collectInterval: number;
  enableAutoDiscovery: boolean;
  autoDiscoveryConfig: AutoDiscoveryConfig | null;
  collectorAttribute: CollectorAttribute;
  dataPoints: DataPoint[];
}

/** Helper to extract the correct script from a LogicModule */
interface ExtractedScripts {
  collection: string | null;
  ad: string | null;
  language: 'groovy' | 'powershell';
}

function extractScripts(module: LogicModule): ExtractedScripts {
  const attr = module.collectorAttribute;
  const language = attr.scriptType === 'powerShell' ? 'powershell' : 'groovy';
  const collection = attr.groovyScript || null;
  const adMethod = module.autoDiscoveryConfig?.method;
  const ad = adMethod?.groovyScript || null;
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
  
  /** WildValue for instance context - used in collection mode (optional) */
  wildvalue?: string;
  
  /** DataSource ID for batch collection - fetches datasourceinstanceProps (optional) */
  datasourceId?: string;
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
type ParseResult = ADParseResult | CollectionParseResult;

interface ParseSummary {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
}

interface UnparsedLine {
  lineNumber: number;
  content: string;
  reason: string;
}

interface ADParseResult {
  type: 'ad';
  instances: ADInstance[];
  unparsedLines: UnparsedLine[];
  summary: ParseSummary;
}

interface ADInstance {
  /** Instance ID (wildvalue) */
  id: string;
  
  /** Instance name (wildalias) */
  name: string;
  
  /** Instance description */
  description?: string;
  
  /** Instance-level auto-properties (auto.prop=value format) */
  properties?: Record<string, string>;
  
  /** Validation issues for this instance */
  issues: ValidationIssue[];
  
  /** Line number in output */
  lineNumber: number;
  
  /** Raw line from output */
  rawLine: string;
}

interface CollectionParseResult {
  type: 'collection' | 'batchcollection';
  datapoints: CollectionDatapoint[];
  unparsedLines: UnparsedLine[];
  summary: ParseSummary;
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
  
  /** Wildvalue prefix for batch collection (instance ID) */
  wildvalue?: string;
  
  /** Validation errors */
  issues: ValidationIssue[];
}

interface ValidationIssue {
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  
  /** Human-readable message */
  message: string;
  
  /** Line number in output */
  lineNumber: number;
  
  /** Which field has the issue (id, name, value, wildvalue, properties) */
  field: string;
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
  datasourceId: string;
  
  // === Multi-Tab Editor State ===
  tabs: EditorTab[];
  activeTabId: string | null;
  
  // === Execution State ===
  isExecuting: boolean;
  currentExecution: ExecutionResult | null;
  parsedOutput: ParseResult | null;
  executionHistory: ExecutionHistoryEntry[];
  
  // === Execution Context Dialog ===
  executionContextDialogOpen: boolean;
  pendingExecution: Omit<ExecuteScriptRequest, 'wildvalue' | 'datasourceId'> | null;
  
  // === Module Browser ===
  moduleBrowserOpen: boolean;
  selectedModuleType: LogicModuleType;
  modulesCache: Record<LogicModuleType, LogicModuleInfo[]>;
  isFetchingModules: boolean;
  selectedModule: LogicModuleInfo | null;
  moduleSearchQuery: string;
  pendingModuleLoad: {
    script: string;
    language: ScriptLanguage;
    mode: ScriptMode;
  } | null;
  
  // === UI State ===
  outputTab: 'raw' | 'parsed' | 'validation';
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  executionHistoryOpen: boolean;
  rightSidebarOpen: boolean;
  rightSidebarTab: 'properties' | 'snippets' | 'history';
  
  // === Device Properties ===
  deviceProperties: DeviceProperty[];
  isFetchingProperties: boolean;
  propertiesSearchQuery: string;
  selectedDeviceId: number | null;
  
  // === Snippet Library ===
  userSnippets: Snippet[];
  snippetsSearchQuery: string;
  snippetCategoryFilter: 'all' | 'template' | 'pattern';
  snippetLanguageFilter: 'all' | 'groovy' | 'powershell';
  snippetSourceFilter: 'all' | 'builtin' | 'user';
  createSnippetDialogOpen: boolean;
  editingSnippet: Snippet | null;
  
  // === User Preferences ===
  preferences: UserPreferences;
  
  // === Drafts / File System ===
  hasSavedDraft: boolean;
  tabsNeedingPermission: FilePermissionStatus[];
  isRestoringFileHandles: boolean;

  // === Actions (selection) ===
  setSelectedPortal: (portalId: string | null) => void;
  setSelectedCollector: (collectorId: number | null) => void;
  setHostname: (hostname: string) => void;
  setWildvalue: (wildvalue: string) => void;
  setDatasourceId: (datasourceId: string) => void;
  setLanguage: (language: ScriptLanguage, force?: boolean) => void;
  setMode: (mode: ScriptMode) => void;
  executeScript: () => Promise<void>;
  cancelExecution: () => Promise<void>;
  parseCurrentOutput: () => void;
  
  // === Tab Management ===
  getActiveTab: () => EditorTab | null;
  openTab: (tab: Omit<EditorTab, 'id'> & { id?: string }) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, newName: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  updateActiveTabContent: (content: string) => void;
  setActiveTabLanguage: (language: ScriptLanguage) => void;
  setActiveTabMode: (mode: ScriptMode) => void;
}
```

**Active tab pattern:** UI components should derive the active tab from `tabs` + `activeTabId` (e.g., `tabs.find(t => t.id === activeTabId)`) and use that value for language/mode/content. This keeps components reactive to tab changes and avoids relying on legacy getters.

---

### Execution History

```typescript
interface ExecutionHistoryEntry {
  id: string;
  timestamp: number;
  portal: string;
  collector: string;
  collectorId: number;
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
  | { type: 'GET_DEVICES'; payload: FetchDevicesRequest }
  | { type: 'GET_DEVICE_BY_ID'; payload: FetchDeviceByIdRequest }
  | { type: 'GET_DEVICE_PROPERTIES'; payload: FetchDevicePropertiesRequest }
  | { type: 'EXECUTE_SCRIPT'; payload: ExecuteScriptRequest }
  | { type: 'CANCEL_EXECUTION'; payload: { executionId: string } }
  | { type: 'FETCH_MODULES'; payload: FetchModulesRequest }
  | { type: 'TEST_APPLIES_TO'; payload: TestAppliesToRequest }
  | { type: 'FETCH_CUSTOM_FUNCTIONS'; payload: { portalId: string } }
  | { type: 'CREATE_CUSTOM_FUNCTION'; payload: { portalId: string; name: string; code: string; description?: string } }
  | { type: 'UPDATE_CUSTOM_FUNCTION'; payload: { portalId: string; functionId: number; name: string; code: string; description?: string } }
  | { type: 'DELETE_CUSTOM_FUNCTION'; payload: { portalId: string; functionId: number } }
  | { type: 'EXECUTE_DEBUG_COMMAND'; payload: ExecuteDebugCommandRequest & { executionId?: string } }
  | { type: 'CANCEL_DEBUG_COMMAND'; payload: { executionId: string } }
  | { type: 'FETCH_MODULE'; payload: { portalId: string; moduleType: LogicModuleType; moduleId: number } }
  | { type: 'COMMIT_MODULE_SCRIPT'; payload: { portalId: string; moduleType: LogicModuleType; moduleId: number; scriptType: 'collection' | 'ad'; newScript: string } }
  | { type: 'FETCH_LINEAGE_VERSIONS'; payload: { portalId: string; moduleType: LogicModuleType; lineageId: string } }
  | { type: 'SEARCH_MODULE_SCRIPTS'; payload: SearchModuleScriptsRequest }
  | { type: 'SEARCH_DATAPOINTS'; payload: SearchDatapointsRequest }
  | { type: 'OPEN_EDITOR'; payload?: DeviceContext };

// Messages from Service Worker to Editor
type SWToEditorMessage =
  | { type: 'PORTALS_UPDATE'; payload: Portal[] }
  | { type: 'COLLECTORS_UPDATE'; payload: Collector[] }
  | { type: 'DEVICES_UPDATE'; payload: FetchDevicesResponse }
  | { type: 'DEVICE_BY_ID_LOADED'; payload: FetchDeviceByIdResponse }
  | { type: 'DEVICE_PROPERTIES_LOADED'; payload: DeviceProperty[] }
  | { type: 'EXECUTION_UPDATE'; payload: ExecutionResult }
  | { type: 'MODULES_FETCHED'; payload: FetchModulesResponse }
  | { type: 'APPLIES_TO_RESULT'; payload: AppliesToTestResult }
  | { type: 'APPLIES_TO_ERROR'; payload: AppliesToTestError }
  | { type: 'CUSTOM_FUNCTIONS_LOADED'; payload: CustomAppliesToFunction[] }
  | { type: 'CUSTOM_FUNCTION_CREATED'; payload: CustomAppliesToFunction }
  | { type: 'CUSTOM_FUNCTION_UPDATED'; payload: CustomAppliesToFunction }
  | { type: 'CUSTOM_FUNCTION_DELETED'; payload: { functionId: number } }
  | { type: 'CUSTOM_FUNCTION_ERROR'; payload: { error: string; code?: number } }
  | { type: 'DEBUG_COMMAND_UPDATE'; payload: DebugCommandProgress }
  | { type: 'DEBUG_COMMAND_COMPLETE'; payload: DebugCommandComplete }
  | { type: 'MODULE_FETCHED'; payload: any }
  | { type: 'MODULE_COMMITTED'; payload: { moduleId: number; moduleType: LogicModuleType } }
  | { type: 'MODULE_ERROR'; payload: { error: string; code?: number } }
  | { type: 'LINEAGE_VERSIONS_FETCHED'; payload: { versions: LineageVersion[] } }
  | { type: 'LINEAGE_ERROR'; payload: { error: string; code?: number } }
  | { type: 'MODULE_SCRIPT_SEARCH_RESULTS'; payload: SearchModuleScriptsResponse }
  | { type: 'MODULE_SCRIPT_SEARCH_ERROR'; payload: { error: string; code?: number } }
  | { type: 'DATAPOINT_SEARCH_RESULTS'; payload: SearchDatapointsResponse }
  | { type: 'DATAPOINT_SEARCH_ERROR'; payload: { error: string; code?: number } }
  | { type: 'PORTAL_DISCONNECTED'; payload: { portalId: string; hostname: string } }
  | { type: 'ERROR'; payload: { code: string; message: string } };

// Messages from Content Script to Service Worker
type ContentToSWMessage =
  | { type: 'CSRF_TOKEN'; payload: { portalId: string; token: string } }
  | { type: 'OPEN_EDITOR'; payload: DeviceContext };

interface DeviceContext {
  portalId: string;
  resourceId?: number;
}
```

---

## Persistence Types

### Chrome Storage Schema

The editor uses discrete keys in `chrome.storage.local` (not a single StoredState blob).

```typescript
const STORAGE_KEYS = {
  PREFERENCES: 'lm-ide-preferences',
  HISTORY: 'lm-ide-execution-history',
  DRAFT: 'lm-ide-draft',          // Legacy single-file draft
  DRAFT_TABS: 'lm-ide-draft-tabs',// Multi-tab draft
  USER_SNIPPETS: 'lm-ide-user-snippets',
} as const;

interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  defaultMode: ScriptMode;
  defaultLanguage: ScriptLanguage;
  maxHistorySize: number;
  apiHistoryLimit: number;
  apiResponseSizeLimit: number;
}

interface DraftScript {
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  hostname?: string;
  lastModified: number;
}

interface DraftTabs {
  tabs: EditorTab[];
  activeTabId: string | null;
  lastModified: number;
}
```

---

## File System Types (Phase 6)

### EditorTab Extensions

```typescript
interface EditorTab {
  // ... existing fields ...
  kind?: 'script' | 'api';
  api?: ApiTabState;
  document?: DocumentState;
  fileHandleId?: string;
  directoryHandleId?: string;
}
```

### Dirty State Computation

```typescript
function isTabDirty(tab: EditorTab): boolean {
  // Dirty state comes from unified document state.
  return tab.content !== getOriginalContent(tab);
}
```

### IndexedDB File Handle Store

```typescript
// Database: lm-ide-files
// Object Store: file-handles

interface FileHandleRecord {
  /** Tab ID (primary key) */
  tabId: string;
  
  /** The FileSystemFileHandle object */
  handle: FileSystemFileHandle;
  
  /** Display name of the file */
  fileName: string;
  
  /** Last access timestamp */
  lastAccessed: number;
}

// File Handle Store API
interface FileHandleStore {
  saveHandle(tabId: string, handle: FileSystemFileHandle, fileName: string): Promise<void>;
  getHandle(tabId: string): Promise<FileSystemFileHandle | undefined>;
  deleteHandle(tabId: string): Promise<void>;
  getAllHandles(): Promise<Map<string, FileSystemFileHandle>>;
  clearAll(): Promise<void>;
}
```

### Permission States

```typescript
type PermissionState = 'granted' | 'denied' | 'prompt';

interface FilePermissionStatus {
  tabId: string;
  fileName: string;
  state: PermissionState;
  handle: FileSystemFileHandle;
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

// Additional rules for batch collection mode
const BATCHCOLLECTION_VALIDATION_RULES = {
  WILDVALUE_REQUIRED: {
    rule: 'WILDVALUE_REQUIRED',
    severity: 'error' as const,
    message: 'Batchscript output requires wildvalue prefix (format: wildvalue.datapoint=value)',
    validate: (dp: CollectionDatapoint) => dp.wildvalue != null && dp.wildvalue.length > 0
  },
  WILDVALUE_INVALID_CHARS: {
    rule: 'WILDVALUE_INVALID_CHARS',
    severity: 'error' as const,
    message: 'Wildvalue contains invalid characters (spaces, =, :, \\, or #)',
    // Uses same regex as AD_INVALID_ID_CHARS: /[\s=:\\#]/
    validate: (dp: CollectionDatapoint) => dp.wildvalue && !/[\s=:\\#]/.test(dp.wildvalue)
  },
  WILDVALUE_MAX_LENGTH: {
    rule: 'WILDVALUE_MAX_LENGTH',
    severity: 'error' as const,
    message: 'Wildvalue exceeds 1024 character limit',
    validate: (dp: CollectionDatapoint) => dp.wildvalue && dp.wildvalue.length <= 1024
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
