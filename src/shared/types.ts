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
  | 'diagnosticsource';

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

export type EditorToSWMessage =
  | { type: 'DISCOVER_PORTALS' }
  | { type: 'GET_COLLECTORS'; payload: { portalId: string } }
  | { type: 'GET_DEVICES'; payload: FetchDevicesRequest }
  | { type: 'GET_DEVICE_BY_ID'; payload: FetchDeviceByIdRequest }
  | { type: 'GET_DEVICE_PROPERTIES'; payload: FetchDevicePropertiesRequest }
  | { type: 'EXECUTE_SCRIPT'; payload: ExecuteScriptRequest }
  | { type: 'CANCEL_EXECUTION'; payload: { executionId: string } }
  | { type: 'FETCH_MODULES'; payload: FetchModulesRequest }
  | { type: 'OPEN_EDITOR'; payload?: DeviceContext };

export type SWToEditorMessage =
  | { type: 'PORTALS_UPDATE'; payload: Portal[] }
  | { type: 'COLLECTORS_UPDATE'; payload: Collector[] }
  | { type: 'DEVICES_UPDATE'; payload: FetchDevicesResponse }
  | { type: 'DEVICE_BY_ID_LOADED'; payload: FetchDeviceByIdResponse }
  | { type: 'DEVICE_PROPERTIES_LOADED'; payload: DeviceProperty[] }
  | { type: 'EXECUTION_UPDATE'; payload: ExecutionResult }
  | { type: 'MODULES_FETCHED'; payload: FetchModulesResponse }
  | { type: 'ERROR'; payload: { code: string; message: string } };

export type ContentToSWMessage =
  | { type: 'CSRF_TOKEN'; payload: { portalId: string; token: string } }
  | { type: 'OPEN_EDITOR'; payload: DeviceContext };

export interface DeviceContext {
  portalId: string;
  resourceId?: number;  // Resource ID extracted from URL, used to fetch device details via API
}

// Constants

export const API_VERSION = '3';
export const MAX_SCRIPT_LENGTH = 64000;
export const EXECUTION_POLL_INTERVAL_MS = 1000;
export const EXECUTION_MAX_ATTEMPTS = 120;
export const CSRF_REFRESH_INTERVAL_MS = 10 * 60 * 1000;


