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
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  defaultMode: 'freeform',
  defaultLanguage: 'groovy',
  maxHistorySize: 50,
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

export type EditorTabSourceType = 'module' | 'file' | 'new' | 'history';

export interface EditorTabSource {
  type: EditorTabSourceType;
  moduleId?: number;
  moduleName?: string;
  moduleType?: LogicModuleType;
  scriptType?: 'collection' | 'ad';
  lineageId?: string;
}

export interface EditorTabContextOverride {
  hostname?: string;
  collectorId?: number;
}

export interface EditorTab {
  id: string;
  displayName: string;
  content: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  source?: EditorTabSource;
  contextOverride?: EditorTabContextOverride;
  
  // File system support (Phase 6)
  /** Content when file was opened or last saved (for dirty detection) */
  originalContent?: string;
  /** Whether this tab has a persisted file handle in IndexedDB */
  hasFileHandle?: boolean;
  /** Distinguishes local files from modules, new files, history entries */
  isLocalFile?: boolean;
}

// Multi-tab Draft Auto-save
export interface DraftTabs {
  tabs: EditorTab[];
  activeTabId: string | null;
  lastModified: number;
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

export type ScriptMode = 'ad' | 'collection' | 'batchcollection' | 'freeform';

export interface ExecuteScriptRequest {
  portalId: string;
  collectorId: number;
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  hostname?: string;
  deviceId?: number;
  wildvalue?: string;
  datasourceId?: string;  // Datasource name (e.g., "snmp64_If-") or numeric ID for batch collection
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
  moduleType: LogicModuleType;
  appliesTo: string;
  collectMethod: string;
  hasAutoDiscovery: boolean;
  scriptType: ScriptType;
  lineageId?: string;
  // Script content (for preview)
  collectionScript?: string;
  adScript?: string;
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
  linuxScript: string;
  windowsScript: string;
}

export interface ADMethod {
  name: string;
  type: string;
  groovyScript: string | null;
  linuxScript: string | null;
  winScript: string | null;
}

export interface AutoDiscoveryConfig {
  scheduleInterval: number;
  method: ADMethod;
}

export interface DataPoint {
  id: number;
  name: string;
  dataType: number;
  description: string;
  postProcessorMethod: string;
  postProcessorParam: string;
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

// Message Types

export interface FetchModulesRequest {
  portalId: string;
  moduleType: LogicModuleType;
  offset?: number;
  size?: number;
}

export interface FetchModulesResponse {
  items: LogicModuleInfo[];
  total: number;
  hasMore: boolean;
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
  | { type: 'OPEN_EDITOR'; payload?: DeviceContext };

export type SWToEditorMessage =
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
  | { type: 'MODULE_FETCHED'; payload: any } // Full module object from API
  | { type: 'MODULE_COMMITTED'; payload: { moduleId: number; moduleType: LogicModuleType } }
  | { type: 'MODULE_ERROR'; payload: { error: string; code?: number } }
  | { type: 'LINEAGE_VERSIONS_FETCHED'; payload: { versions: LineageVersion[] } }
  | { type: 'LINEAGE_ERROR'; payload: { error: string; code?: number } }
  | { type: 'PORTAL_DISCONNECTED'; payload: { portalId: string; hostname: string } }
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
