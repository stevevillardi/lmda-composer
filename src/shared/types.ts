export interface Portal {
  id: string;
  hostname: string;
  displayName: string;
  csrfToken: string | null;
  csrfTokenTimestamp: number | null;
  tabIds: number[];
  status: PortalStatus;
}

export type PortalStatus = 'active' | 'expired' | 'unknown';

export interface Collector {
  id: number;
  description: string;
  hostname: string;
  status: number;
  isDown: boolean;
  collectorGroupName: string;
  arch?: string;
}

// Lightweight device info for dropdown display
export interface DeviceInfo {
  id: number;
  name: string;
  displayName: string;
  currentCollectorId: number;
  hostStatus: string; // "normal" = online, anything else = offline/issue
}

// Device property for the properties panel
export interface DeviceProperty {
  name: string;
  value: string;
  type: 'system' | 'custom' | 'inherited' | 'auto';
}

// Snippet for the snippet library
export interface Snippet {
  id: string;
  name: string;
  description: string;
  language: 'groovy' | 'powershell' | 'both';
  category: 'template' | 'pattern';
  tags: string[];
  code: string;
  isBuiltIn: boolean;
}

// Module Snippets (LogicMonitor's reusable server-side modules like lm.emit, cisco.meraki, etc.)
export interface ModuleSnippetInfo {
  name: string;
  versions: string[];
  latestVersion: string;
  language: 'groovy' | 'powershell';
  description?: string;
}

export interface ModuleSnippetSource {
  name: string;
  version: string;
  code: string;
  fetchedAt: number;
}

export interface ModuleSnippetsCacheMeta {
  fetchedAt: number;
  fetchedFromPortal: string;
  fetchedFromCollector: number;
  collectorDescription: string;
}

export interface FetchDevicesRequest {
  portalId: string;
  collectorId: number;
}

export interface FetchDevicesResponse {
  items: DeviceInfo[];
  total: number;
  error?: string;
}

// User Preferences

export interface UserPreferences {
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

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  defaultMode: 'freeform',
  defaultLanguage: 'groovy',
  maxHistorySize: 50,
  apiHistoryLimit: 10,
  apiResponseSizeLimit: 250000,
};

// Execution History

export interface ExecutionHistoryEntry {
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
  /** Tab display name for meaningful identification in history */
  tabDisplayName?: string;
  /** Module binding info (present if executed from a module-bound tab) */
  moduleSource?: {
    moduleId: number;
    moduleName: string;
    moduleType: LogicModuleType;
    scriptType: 'collection' | 'ad';
    lineageId?: string;
    portalId: string;
    portalHostname: string;
  };
}

// Draft Auto-save

export interface DraftScript {
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  hostname?: string;
  lastModified: number;
}

// Multi-file Editor Tabs

export type EditorTabSourceType = 'module' | 'file' | 'new' | 'history' | 'api';

export interface EditorTabSource {
  type: EditorTabSourceType;
  moduleId?: number;
  moduleName?: string;
  moduleType?: LogicModuleType;
  scriptType?: 'collection' | 'ad';
  lineageId?: string;
  portalId?: string;
  portalHostname?: string;
}

export interface EditorTabContextOverride {
  hostname?: string;
  collectorId?: number;
}

export interface EditorTab {
  id: string;
  kind?: 'script' | 'api';
  displayName: string;
  content: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  source?: EditorTabSource;
  contextOverride?: EditorTabContextOverride;
  api?: ApiTabState;
  
  /** Unified document state - determines document type and stores saved content */
  document?: DocumentState;
  
  /** 
   * ID used to look up the file handle in IndexedDB.
   * Separate from tab.id to support scenarios like language change where the
   * old file remains in recent files while the tab gets a new handle for the new file.
   */
  fileHandleId?: string;
  
  /**
   * ID used to look up the directory handle in IndexedDB.
   * Present when this tab is part of a module saved to a local directory.
   */
  directoryHandleId?: string;
}

// ============================================================================
// Unified Document Model
// ============================================================================

/**
 * Document type discriminator - determines what operations are available
 */
export type DocumentType = 
  | 'scratch'      // New unsaved file (no file handle, no portal binding)
  | 'local'        // Plain local file (has file handle, no portal binding)
  | 'portal'       // Imported from portal (no file handle, has portal binding)
  | 'history'      // Readonly history entry
  | 'api';         // API explorer tab

/**
 * File state for documents backed by local files
 */
export interface FileState {
  /** Reference to IndexedDB handle */
  handleId: string;
  /** Content when last saved to disk - for dirty detection */
  lastSavedContent: string;
  /** Timestamp of last save */
  lastSavedAt?: number;
  /** File name on disk */
  fileName?: string;
}

/**
 * Portal binding for documents linked to a LogicMonitor module
 */
export interface PortalBinding {
  /** Portal ID (internal) */
  id: string;
  /** Portal hostname (e.g., "acme.logicmonitor.com") */
  hostname: string;
  /** Module ID in portal */
  moduleId: number;
  /** Module type */
  moduleType: LogicModuleType;
  /** Technical module name */
  moduleName: string;
  /** Which script this document represents */
  scriptType: 'collection' | 'ad';
  /** For lineage version history */
  lineageId?: string;
  /** Content as it exists on the portal - for push detection */
  lastKnownContent: string;
  /** When last pulled from portal */
  lastPulledAt?: number;
  /** Portal version number at last pull */
  lastPulledVersion?: number;
  /** When last pushed to portal */
  lastPushedAt?: number;
}

/**
 * Unified document state - single source of truth for document lifecycle
 */
export interface DocumentState {
  /** Document type - determines available operations */
  type: DocumentType;
  
  /** File state (present for 'local' type) */
  file?: FileState;
  
  /** Portal binding (present for 'portal' type) */
  portal?: PortalBinding;
}

/**
 * Recent document entry for the unified recent documents list
 */
export interface RecentDocument {
  /** Unique document ID (maps to tab ID for opened documents) */
  id: string;
  /** Document type at time of last access */
  type: DocumentType;
  /** Display name */
  displayName: string;
  /** Last access timestamp */
  lastAccessed: number;
  /** File name (for local types) */
  fileName?: string;
  /** For portal types */
  portalHostname?: string;
  /** For portal types */
  moduleName?: string;
  /** For portal types */
  scriptType?: 'collection' | 'ad';
}

// ============================================================================
// Module Directory Configuration (module.json)
// ============================================================================

/**
 * Script metadata stored in module.json
 */
export interface ModuleDirectoryScript {
  /** File name on disk (e.g., "collection.groovy" or "ad.ps1") */
  fileName: string;
  /** Script language */
  language: ScriptLanguage;
  /** Script mode */
  mode: ScriptMode;
  /** SHA-256 checksum of portal content at last sync (for push detection) */
  portalChecksum: string;
  /** SHA-256 checksum of disk content at last sync (for external change detection) */
  diskChecksum?: string;
}

/**
 * Module directory configuration file (module.json)
 * Stored at the root of the module directory.
 */
export interface ModuleDirectoryConfig {
  /** Schema version for future compatibility */
  version: 1;
  
  /** Portal binding information */
  portalBinding: {
    /** Portal ID (internal) */
    portalId: string;
    /** Portal hostname (e.g., "acme.logicmonitor.com") */
    portalHostname: string;
    /** Module ID in portal */
    moduleId: number;
    /** Module type (DataSource, ConfigSource, etc.) */
    moduleType: LogicModuleType;
    /** Technical module name */
    moduleName: string;
    /** Lineage ID for version history */
    lineageId?: string;
  };
  
  /** Script file mappings */
  scripts: {
    collection?: ModuleDirectoryScript;
    ad?: ModuleDirectoryScript;
  };
  
  /** Module details snapshot (for push operations) */
  moduleDetails?: {
    /** Portal version number at last sync */
    portalVersion: number;
    /** When last pulled from portal */
    lastPulledAt: string;
    /** 
     * Baseline values from portal at last sync.
     * Used to detect what user has changed vs portal state.
     * Analogous to portalChecksum for scripts.
     */
    portalBaseline: Record<string, unknown>;
    /**
     * User's local draft values (only stored if different from portalBaseline).
     * Analogous to diskChecksum for scripts.
     * If undefined, localDraft equals portalBaseline.
     */
    localDraft?: Record<string, unknown>;
  };
  
  /** When this directory was last synced (push or pull) */
  lastSyncedAt: string;
}

// Multi-tab Draft Auto-save

/**
 * Serializable version of ModuleDetailsDraft for storage in IndexedDB.
 * Uses array instead of Set for dirtyFields since Sets can't be serialized.
 */
export interface SerializableModuleDetailsDraft {
  original: Record<string, unknown> | null;
  draft: Record<string, unknown>;
  dirtyFields: string[];  // Serialized from Set<string>
  loadedAt: number;
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
  portalId?: string;
  version: number;
}

export interface DraftTabs {
  tabs: EditorTab[];
  activeTabId: string | null;
  lastModified: number;
  /** Module details drafts indexed by tab ID (serializable format) */
  moduleDetailsDrafts?: Record<string, SerializableModuleDetailsDraft>;
  /** Active workspace (script or api) at time of save */
  activeWorkspace?: 'script' | 'api';
}

// API Explorer

export type ApiRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestSpec {
  method: ApiRequestMethod;
  path: string;
  queryParams: Record<string, string>;
  headerParams: Record<string, string>;
  body: string;
  bodyMode: 'form' | 'raw';
  contentType: 'application/json';
  pagination: {
    enabled: boolean;
    sizeParam: string;
    offsetParam: string;
    pageSize: number;
  };
}

export interface ApiResponseSummary {
  status: number;
  headers: Record<string, string>;
  body: string;
  jsonPreview?: unknown;
  durationMs: number;
  timestamp: number;
  truncated?: boolean;
  truncationReason?: string;
  truncationMeta?: {
    itemsFetched?: number;
    pagesFetched?: number;
    limit?: number;
  };
}

export interface ApiHistoryEntry {
  id: string;
  portalId: string;
  request: ApiRequestSpec;
  response: ApiResponseSummary;
}

export interface ApiEnvironmentVariable {
  key: string;
  value: string;
}

export interface ApiEnvironmentState {
  portalId: string;
  variables: ApiEnvironmentVariable[];
  lastModified: number;
}

export interface ApiTabState {
  endpointId?: string;
  request: ApiRequestSpec;
  response?: ApiResponseSummary;
}

// File Handle Persistence (Phase 6)
export interface FileHandleRecord {
  /** Tab ID (primary key) */
  tabId: string;
  /** The FileSystemFileHandle object - stored in IndexedDB */
  handle: FileSystemFileHandle;
  /** Display name of the file */
  fileName: string;
  /** Last access timestamp */
  lastAccessed: number;
}

export type FilePermissionState = 'granted' | 'denied' | 'prompt';

export interface FilePermissionStatus {
  tabId: string;
  fileName: string;
  state: FilePermissionState;
}

// Script Execution

export type ScriptLanguage = 'groovy' | 'powershell';

export type ScriptMode = 
  | 'freeform'           // No parsing - raw output
  | 'ad'                 // Active Discovery (DataSource/ConfigSource)
  | 'collection'         // Collection (all module types except batch)
  | 'batchcollection';   // BatchScript (DataSource/ConfigSource)

export interface ExecuteScriptRequest {
  portalId: string;
  collectorId: number;
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  executionId?: string;
  hostname?: string;
  deviceId?: number;
  wildvalue?: string;
  datasourceId?: string;  // Datasource name (e.g., "snmp64_If-") or numeric ID for batch collection
}

export interface ExecuteApiRequest {
  portalId: string;
  method: ApiRequestMethod;
  path: string;
  queryParams?: Record<string, string>;
  headerParams?: Record<string, string>;
  body?: string;
  contentType?: string;
}

export interface ExecuteApiResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'complete'
  | 'error'
  | 'timeout'
  | 'cancelled';

export interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  rawOutput: string;
  duration: number;
  startTime: number;
  error?: string;
}

// LogicModules

export type LogicModuleType = 
  | 'datasource'
  | 'configsource'
  | 'topologysource'
  | 'propertysource'
  | 'logsource'
  | 'diagnosticsource'
  | 'eventsource';

// Lightweight module info for list display (before fetching full details)
export interface LogicModuleInfo {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  moduleType: LogicModuleType;
  appliesTo: string;
  collectMethod: string;
  collectInterval?: number;
  hasAutoDiscovery: boolean;
  scriptType: ScriptType;
  lineageId?: string;
  // Script content (for preview)
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
  // EventSource specific: collector type (e.g., "scriptevent" for script-based)
  collector?: string;
}

export type CollectMethod = 
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

export type ScriptType = 'embed' | 'powerShell' | 'file';

export interface CollectorAttribute {
  name: string;
  groovyScript: string;
  scriptType: ScriptType;
}

export interface ADMethod {
  name: string;
  type: string;
  groovyScript: string | null;
}

export interface AutoDiscoveryConfig {
  scheduleInterval: number;
  method: ADMethod;
}

/**
 * Status display name entry for gauge datapoints.
 */
export interface StatusDisplayName {
  id?: number;
  datapointId?: number;
  statusDisplayName: string;
  operator: 'EQ' | 'NEQ' | 'GTE' | 'LTE' | 'GT' | 'LT';
  metricValue: number;
}

/**
 * Full datapoint configuration.
 * Used for editing and committing datapoint changes.
 */
export interface DataPoint {
  /** Datapoint ID - undefined for new datapoints */
  id?: number;
  /** DataSource ID - provided for existing datapoints */
  dataSourceId?: number;
  /** Datapoint name (required) */
  name: string;
  /** Description */
  description: string;
  /** Metric type: 1=counter, 2=gauge, 3=derive */
  type: number;
  /** Data value type: Always 7 (double) for scripted modules */
  dataType: number;
  /** Max digits - always 4, legacy field */
  maxDigits: number;
  /** Post processor method: namevalue, expression, none, json, regex, etc. */
  postProcessorMethod: string;
  /** Post processor parameter (key, expression, path, etc.) */
  postProcessorParam: string;
  /** Raw data field: 'output', 'exitCode', 'responseTime', or empty for expressions */
  rawDataFieldName: string;
  /** Min value for datapoint range (empty string for no limit) */
  minValue: string;
  /** Max value for datapoint range (empty string for no limit) */
  maxValue: string;
  /** Alert for no data: 0=no alert, 1=no alert, 2=warn, 3=error, 4=critical */
  alertForNoData: number;
  /** Alert threshold expression (e.g., '> 60 80 90') */
  alertExpr: string;
  /** Alert threshold history note */
  alertExprNote: string;
  /** Alert subject template */
  alertSubject: string;
  /** Alert body template */
  alertBody: string;
  /** Poll cycles before alert triggers */
  alertTransitionInterval: number;
  /** Poll cycles before alert clears */
  alertClearTransitionInterval: number;
  // Preserved but not editable in this phase
  /** Origin ID for tracking */
  originId?: string;
  /** Anomaly alert suppression - not editable */
  enableAnomalyAlertSuppression?: string;
  /** AD advanced setting enabled - not editable */
  adAdvSettingEnabled?: boolean;
  /** Warning AD advanced setting - not editable */
  warnAdAdvSetting?: string;
  /** Error AD advanced setting - not editable */
  errorAdAdvSetting?: string;
  /** Critical AD advanced setting - not editable */
  criticalAdAdvSetting?: string;
  /** User param 1 - not used */
  userParam1?: string;
  /** User param 2 - not used */
  userParam2?: string;
  /** User param 3 - not used */
  userParam3?: string;
  /** Status display names for gauge datapoints */
  statusDisplayNames?: StatusDisplayName[];
}

export type ModuleSearchMatchType = 'substring' | 'exact' | 'regex';

export interface ScriptMatchRange {
  line: number;
  startColumn: number;
  endColumn: number;
}

export interface ScriptSearchResult {
  module: LogicModuleInfo;
  collectionMatches: ScriptMatchRange[];
  adMatches: ScriptMatchRange[];
  /** True if matched by module name/displayName only (no script content matches) */
  nameMatch?: boolean;
}

export interface DataPointSearchResult {
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

export interface LogicModule {
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

// ============================================================================
// ConfigCheck Types (for ConfigSource modules)
// ============================================================================

/**
 * Diff check configuration for 'ignore' type config checks.
 * Defines which lines/patterns to exclude from change detection.
 */
export interface DiffCheckConfig {
  ignore_line_with_regex?: string[];
  ignore_line_start_with?: string[];
  ignore_blank_lines?: boolean;
  ignore_space?: boolean;
  ignore_line_contain?: string[];
}

/**
 * Value check configuration for 'missing' and 'value' type config checks.
 */
export interface ValueCheckConfig {
  variable: string;
  must: ValueCheckMust[];
}

/**
 * Condition for value checks - can be missing, value_change, or range comparison.
 */
export type ValueCheckMust = 
  | { missing: Record<string, never> }
  | { value_change: Record<string, never> }
  | { range: { gt?: string; lt?: string; gte?: string; lte?: string; ne?: string; eq?: string } };

/**
 * Script configuration for config checks.
 * The structure varies based on the config check type.
 */
export interface ConfigCheckScript {
  /** Always 'arbitrary' - not UI-exposed */
  format: 'arbitrary';
  /** Groovy script code - for type='groovy' */
  groovy?: string;
  /** Diff exclusion rules - for type='ignore' */
  diff_check?: DiffCheckConfig;
  /** Fetch check config - for type='fetch', always { fetch: 0 } */
  fetch_check?: { fetch: 0 };
  /** Value/missing check config - for type='missing' or type='value' */
  value_check?: ValueCheckConfig;
}

/**
 * Config check type identifiers.
 */
export type ConfigCheckType = 'ignore' | 'groovy' | 'fetch' | 'missing' | 'value';

/**
 * Full ConfigCheck definition for ConfigSource modules.
 */
export interface ConfigCheck {
  /** Config check ID - undefined for new checks */
  id?: number;
  /** ConfigSource ID - provided for existing checks */
  configSourceId?: number;
  /** Check name (required) */
  name: string;
  /** Description */
  description: string;
  /** Check type */
  type: ConfigCheckType;
  /** Alert level: 1=none, 2=warn, 3=error, 4=critical */
  alertLevel: number;
  /** Clear alert on acknowledgement */
  ackClearAlert: boolean;
  /** Clear after N minutes, 0=never */
  alertEffectiveIval: number;
  /** Transition interval - always 0, not UI-exposed */
  alertTransitionInterval: number;
  /** Script/check configuration */
  script: ConfigCheckScript;
  /** Origin ID for tracking */
  originId?: string | null;
}

// Message Types

export interface FetchModulesRequest {
  portalId: string;
  moduleType: LogicModuleType;
  offset?: number;
  size?: number;
  search?: string;
}

export interface FetchModulesResponse {
  items: LogicModuleInfo[];
  total: number;
  hasMore: boolean;
}

export interface SearchModuleScriptsRequest {
  portalId: string;
  query: string;
  matchType: ModuleSearchMatchType;
  caseSensitive: boolean;
  moduleTypes: LogicModuleType[];
  searchId?: string;
  forceReindex?: boolean;
}

export interface SearchModuleScriptsResponse {
  results: ScriptSearchResult[];
  indexInfo?: ModuleIndexInfo;
}

export interface SearchDatapointsRequest {
  portalId: string;
  query: string;
  matchType: ModuleSearchMatchType;
  caseSensitive: boolean;
  searchId?: string;
  forceReindex?: boolean;
}

export interface SearchDatapointsResponse {
  results: DataPointSearchResult[];
  indexInfo?: ModuleIndexInfo;
}

export interface ModuleIndexInfo {
  portalId: string;
  indexedAt: number | null;
  moduleCount: number;
  isStale: boolean;
}

export interface ModuleSearchProgress {
  searchId: string;
  stage: 'indexing' | 'searching';
  processed: number;
  total?: number;
  matched?: number;
  moduleType?: LogicModuleType;
}

export interface RefreshModuleIndexRequest {
  portalId: string;
  searchId?: string;
}

export interface FetchDeviceByIdRequest {
  portalId: string;
  resourceId: number;
}

export interface FetchDeviceByIdResponse {
  id: number;
  name: string;
  displayName: string;
  currentCollectorId: number;
}

export interface FetchDevicePropertiesRequest {
  portalId: string;
  deviceId: number;
}

export interface LineageVersion {
  id: string;
  name: string;
  displayName?: string;
  version?: string;
  updatedAtMS?: number;
  createdAtMS?: number;
  commitMessage?: string;
  authorUsername?: string;
  isLatest?: boolean;
  collectionScript?: string;
  adScript?: string;
}

export type EditorToSWMessage =
  | { type: 'DISCOVER_PORTALS' }
  | { type: 'GET_COLLECTORS'; payload: { portalId: string } }
  | { type: 'GET_DEVICES'; payload: FetchDevicesRequest }
  | { type: 'GET_DEVICE_BY_ID'; payload: FetchDeviceByIdRequest }
  | { type: 'GET_DEVICE_PROPERTIES'; payload: FetchDevicePropertiesRequest }
  | { type: 'EXECUTE_SCRIPT'; payload: ExecuteScriptRequest }
  | { type: 'EXECUTE_API_REQUEST'; payload: ExecuteApiRequest }
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
  | { type: 'COMMIT_MODULE_SCRIPT'; payload: { portalId: string; moduleType: LogicModuleType; moduleId: number; scriptType: 'collection' | 'ad'; newScript?: string; moduleDetails?: Record<string, unknown>; reason?: string } }
  | { type: 'FETCH_LINEAGE_VERSIONS'; payload: { portalId: string; moduleType: LogicModuleType; lineageId: string } }
  | { type: 'SEARCH_MODULE_SCRIPTS'; payload: SearchModuleScriptsRequest }
  | { type: 'SEARCH_DATAPOINTS'; payload: SearchDatapointsRequest }
  | { type: 'CANCEL_MODULE_SEARCH'; payload: { searchId: string } }
  | { type: 'REFRESH_MODULE_INDEX'; payload: RefreshModuleIndexRequest }
  | { type: 'FETCH_MODULE_DETAILS'; payload: { portalId: string; moduleType: LogicModuleType; moduleId: number } }
  | { type: 'FETCH_ACCESS_GROUPS'; payload: { portalId: string } }
  | { type: 'OPEN_EDITOR'; payload?: DeviceContext }
  | { type: 'FETCH_MODULE_SNIPPETS'; payload: { portalId: string; collectorId: number } }
  | { type: 'FETCH_MODULE_SNIPPET_SOURCE'; payload: { portalId: string; collectorId: number; name: string; version: string } }
  | { type: 'GET_MODULE_SNIPPETS_CACHE' }
  | { type: 'CLEAR_MODULE_SNIPPETS_CACHE' };

export type SWToEditorMessage =
  | { type: 'PORTALS_UPDATE'; payload: Portal[] }
  | { type: 'COLLECTORS_UPDATE'; payload: Collector[] }
  | { type: 'DEVICES_UPDATE'; payload: FetchDevicesResponse }
  | { type: 'DEVICE_BY_ID_LOADED'; payload: FetchDeviceByIdResponse }
  | { type: 'DEVICE_PROPERTIES_LOADED'; payload: DeviceProperty[] }
  | { type: 'EXECUTION_UPDATE'; payload: ExecutionResult }
  | { type: 'API_RESPONSE'; payload: ExecuteApiResponse }
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
  | { type: 'MODULE_FETCHED'; payload: any } // Full module object from API
  | { type: 'MODULE_COMMITTED'; payload: { moduleId: number; moduleType: LogicModuleType } }
  | { type: 'MODULE_ERROR'; payload: { error: string; code?: number } }
  | { type: 'MODULE_DETAILS_FETCHED'; payload: { module: any } } // Full module details object from API
  | { type: 'MODULE_DETAILS_ERROR'; payload: { error: string; code?: number } }
  | { type: 'ACCESS_GROUPS_FETCHED'; payload: { accessGroups: Array<{ id: number; name: string; description?: string; createdOn?: number; updatedOn?: number; createdBy?: string; tenantId?: string | null }> } }
  | { type: 'ACCESS_GROUPS_ERROR'; payload: { error: string; code?: number } }
  | { type: 'LINEAGE_VERSIONS_FETCHED'; payload: { versions: LineageVersion[] } }
  | { type: 'LINEAGE_ERROR'; payload: { error: string; code?: number } }
  | { type: 'MODULE_SCRIPT_SEARCH_RESULTS'; payload: SearchModuleScriptsResponse }
  | { type: 'MODULE_SCRIPT_SEARCH_ERROR'; payload: { error: string; code?: number } }
  | { type: 'DATAPOINT_SEARCH_RESULTS'; payload: SearchDatapointsResponse }
  | { type: 'DATAPOINT_SEARCH_ERROR'; payload: { error: string; code?: number } }
  | { type: 'MODULE_SEARCH_PROGRESS'; payload: ModuleSearchProgress }
  | { type: 'MODULE_INDEX_REFRESHED'; payload: ModuleIndexInfo }
  | { type: 'PORTAL_DISCONNECTED'; payload: { portalId: string; hostname: string } }
  | { type: 'MODULE_SNIPPETS_FETCHED'; payload: { snippets: ModuleSnippetInfo[]; meta: ModuleSnippetsCacheMeta } }
  | { type: 'MODULE_SNIPPET_SOURCE_FETCHED'; payload: ModuleSnippetSource }
  | { type: 'MODULE_SNIPPETS_CACHE'; payload: { snippets: ModuleSnippetInfo[]; meta: ModuleSnippetsCacheMeta; cachedSourceKeys: string[] } | null }
  | { type: 'MODULE_SNIPPETS_ERROR'; payload: { error: string; code?: number } }
  | { type: 'ERROR'; payload: { code: string; message: string } };

export type ContentToSWMessage =
  | { type: 'CSRF_TOKEN'; payload: { portalId: string; token: string } }
  | { type: 'OPEN_EDITOR'; payload: DeviceContext };

export interface DeviceContext {
  portalId: string;
  resourceId?: number;
  resourceDatasourceId?: number;
  dataSourceId?: number;
  collectMethod?: string;
  moduleId?: number;
  moduleType?: LogicModuleType;
}

// AppliesTo Tester

export interface AppliesToMatch {
  type: string;
  id: number;
  name: string;
}

export interface AppliesToTestResult {
  originalAppliesTo: string;
  currentAppliesTo: string;
  originalMatches: AppliesToMatch[];
  currentMatches: AppliesToMatch[];
  warnMessage: string;
}

export interface AppliesToTestError {
  errorMessage: string;
  errorCode: number;
  errorDetail: string | null;
}

export interface AppliesToFunction {
  name: string;
  syntax: string;
  parameters: string;
  description: string;
  example?: string;
}

export interface CustomAppliesToFunction {
  id: number;
  name: string;
  code: string;  // The AppliesTo expression
  description?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Extended function type that can be built-in or custom
export type AppliesToFunctionSource = 'builtin' | 'custom';

export interface AppliesToFunctionWithSource extends AppliesToFunction {
  source: AppliesToFunctionSource;
  customId?: number;  // ID if custom function
}

export type AppliesToTestFrom = 'devicesGroup' | 'websiteGroup';

export interface TestAppliesToRequest {
  portalId: string;
  currentAppliesTo: string;
  testFrom: AppliesToTestFrom;
}

// Debug Commands
export interface ExecuteDebugCommandRequest {
  portalId: string;
  collectorIds: number[];
  command: string;
  parameters?: Record<string, string>;
  positionalArgs?: string[];
}

export interface DebugCommandProgress {
  collectorId: number;
  attempt: number;
  maxAttempts: number;
}

export interface DebugCommandResult {
  collectorId: number;
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

export interface DebugCommandComplete {
  results: Record<number, DebugCommandResult>;
}


// Constants

export const API_VERSION = '3';
export const MAX_SCRIPT_LENGTH = 64000;
export const EXECUTION_POLL_INTERVAL_MS = 1000;
export const EXECUTION_MAX_ATTEMPTS = 120;
export const CSRF_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
