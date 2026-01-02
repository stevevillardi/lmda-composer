import { create } from 'zustand';
import { toast } from 'sonner';
import type { 
  Portal, 
  Collector, 
  DeviceInfo,
  DeviceProperty,
  Snippet,
  ScriptLanguage, 
  ScriptMode,
  ExecutionResult,
  ExecuteScriptRequest,
  LogicModuleType,
  LogicModuleInfo,
  FetchModulesResponse,
  FetchDevicesResponse,
  UserPreferences,
  ExecutionHistoryEntry,
  DraftScript,
  DraftTabs,
  EditorTab,
  ApiRequestSpec,
  ApiResponseSummary,
  ApiHistoryEntry,
  ApiEnvironmentState,
  ApiEnvironmentVariable,
  LineageVersion,
  FilePermissionStatus,
  CustomAppliesToFunction,
  ExecuteDebugCommandRequest,
  DebugCommandResult,
  ModuleSearchMatchType,
  ScriptSearchResult,
  DataPointSearchResult,
  ModuleSearchProgress,
  ModuleIndexInfo,
  ExecuteApiRequest,
  ExecuteApiResponse,
} from '@/shared/types';
import { DEFAULT_PREFERENCES } from '@/shared/types';
import { parseOutput, type ParseResult } from '../utils/output-parser';
import * as fileHandleStore from '../utils/file-handle-store';
import { APPLIES_TO_FUNCTIONS } from '../data/applies-to-functions';
import { DEFAULT_GROOVY_TEMPLATE, DEFAULT_POWERSHELL_TEMPLATE, getDefaultScriptTemplate } from '../config/script-templates';
import { buildApiVariableResolver } from '../utils/api-variables';
import { appendItemsWithLimit } from '../utils/api-pagination';
import type { editor } from 'monaco-editor';

const normalizeAccessGroupIds = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
      .filter((id) => typeof id === 'number' && !Number.isNaN(id))
      .sort((a, b) => a - b);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id))
      .sort((a, b) => a - b);
  }
  return [];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
};

const getModuleTabIds = (tabs: EditorTab[], tabId: string): string[] => {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab || tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType) {
    return [tabId];
  }
  return tabs
    .filter(
      (t) =>
        t.source?.type === 'module' &&
        t.source.moduleId === tab.source.moduleId &&
        t.source.moduleType === tab.source.moduleType
    )
    .map((t) => t.id);
};

const findModuleDraftForTab = (
  drafts: Record<string, EditorState['moduleDetailsDraftByTabId'][string]>,
  tabs: EditorTab[],
  tabId: string
) => {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab || tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType) {
    return null;
  }
  return (
    Object.values(drafts).find(
      (draft) =>
        draft.moduleId === tab.source?.moduleId && draft.moduleType === tab.source?.moduleType
    ) || null
  );
};

interface EditorState {
  // Portal/Collector selection
  portals: Portal[];
  selectedPortalId: string | null;
  collectors: Collector[];
  selectedCollectorId: number | null;
  
  // Device context (global defaults)
  devices: DeviceInfo[];
  isFetchingDevices: boolean;
  hostname: string;
  wildvalue: string;
  datasourceId: string;  // Datasource name or ID for batch collection
  
  // Multi-tab editor state
  tabs: EditorTab[];
  activeTabId: string | null;

  // API Explorer state
  apiHistoryByPortal: Record<string, ApiHistoryEntry[]>;
  apiEnvironmentsByPortal: Record<string, ApiEnvironmentState>;
  isExecutingApi: boolean;
  
  // Execution state
  isExecuting: boolean;
  currentExecution: ExecutionResult | null;
  parsedOutput: ParseResult | null;
  editorInstance: editor.IStandaloneCodeEditor | null;
  
  // Execution context dialog state (for Collection/Batch Collection modes)
  executionContextDialogOpen: boolean;
  pendingExecution: Omit<ExecuteScriptRequest, 'wildvalue' | 'datasourceId'> | null;
  
  // Module browser
  moduleBrowserOpen: boolean;
  selectedModuleType: LogicModuleType;
  modulesCache: Record<LogicModuleType, LogicModuleInfo[]>;
  modulesMeta: Record<LogicModuleType, { offset: number; hasMore: boolean; total: number }>;
  modulesSearch: Record<LogicModuleType, string>;
  isFetchingModules: boolean;
  selectedModule: LogicModuleInfo | null;
  moduleSearchQuery: string;

  // Module search
  moduleSearchOpen: boolean;
  moduleSearchMode: 'scripts' | 'datapoints';
  moduleSearchTerm: string;
  moduleSearchMatchType: ModuleSearchMatchType;
  moduleSearchCaseSensitive: boolean;
  moduleSearchModuleTypes: LogicModuleType[];
  isSearchingModules: boolean;
  moduleSearchProgress: ModuleSearchProgress | null;
  moduleSearchIndexInfo: ModuleIndexInfo | null;
  moduleSearchExecutionId: string | null;
  moduleScriptSearchResults: ScriptSearchResult[];
  moduleDatapointSearchResults: DataPointSearchResult[];
  moduleSearchError: string | null;
  selectedScriptSearchResult: ScriptSearchResult | null;
  selectedDatapointSearchResult: DataPointSearchResult | null;
  
  // Pending load confirmation state
  pendingModuleLoad: {
    script: string;
    language: ScriptLanguage;
    mode: ScriptMode;
  } | null;
  
  // UI state
  outputTab: 'raw' | 'parsed' | 'validation';
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  executionHistoryOpen: boolean;
  
  // Right sidebar state
  rightSidebarOpen: boolean;
  rightSidebarTab: 'properties' | 'snippets' | 'history';
  
  // Device properties state
  deviceProperties: DeviceProperty[];
  isFetchingProperties: boolean;
  propertiesSearchQuery: string;
  selectedDeviceId: number | null;
  
  // Snippet library state
  userSnippets: Snippet[];
  snippetsSearchQuery: string;
  snippetCategoryFilter: 'all' | 'template' | 'pattern';
  snippetLanguageFilter: 'all' | 'groovy' | 'powershell';
  snippetSourceFilter: 'all' | 'builtin' | 'user';
  createSnippetDialogOpen: boolean;
  editingSnippet: Snippet | null;
  
  // Cancel execution state
  currentExecutionId: string | null;
  cancelDialogOpen: boolean;
  
  // User preferences
  preferences: UserPreferences;
  
  // Execution history
  executionHistory: ExecutionHistoryEntry[];
  
  // Draft auto-save
  hasSavedDraft: boolean;
  
  // File system state (Phase 6)
  tabsNeedingPermission: FilePermissionStatus[];
  isRestoringFileHandles: boolean;
  
  // AppliesTo tester state
  appliesToTesterOpen: boolean;
  appliesToExpression: string;
  appliesToResults: Array<{ type: string; id: number; name: string }>;
  appliesToError: string | null;
  appliesToTestFrom: 'devicesGroup' | 'websiteGroup';
  isTestingAppliesTo: boolean;
  appliesToFunctionSearch: string;
  
  // Custom AppliesTo functions state
  customFunctions: CustomAppliesToFunction[];
  isLoadingCustomFunctions: boolean;
  customFunctionError: string | null;
  isCreatingFunction: boolean;
  isUpdatingFunction: boolean;
  isDeletingFunction: boolean;
  
  // Debug commands state
  debugCommandsDialogOpen: boolean;
  debugCommandResults: Record<number, DebugCommandResult>;
  isExecutingDebugCommand: boolean;
  
  // Actions
  setSelectedPortal: (portalId: string | null) => void;
  setSelectedCollector: (collectorId: number | null) => void;
  fetchDevices: () => Promise<void>;
  setHostname: (hostname: string) => void;
  setWildvalue: (wildvalue: string) => void;
  setDatasourceId: (datasourceId: string) => void;
  setLanguage: (language: ScriptLanguage, force?: boolean) => void;
  setMode: (mode: ScriptMode) => void;
  setOutputTab: (tab: 'raw' | 'parsed' | 'validation') => void;
  setEditorInstance: (editor: editor.IStandaloneCodeEditor | null) => void;
  executeScript: () => Promise<void>;
  refreshPortals: () => Promise<void>;
  refreshCollectors: () => Promise<void>;
  handlePortalDisconnected: (portalId: string, hostname: string) => void;
  clearOutput: () => void;
  
  // Parsing actions
  parseCurrentOutput: () => void;
  
  // Execution context dialog actions
  setExecutionContextDialogOpen: (open: boolean) => void;
  confirmExecutionContext: (wildvalue: string, datasourceId: string) => Promise<void>;
  cancelExecutionContextDialog: () => void;
  
  // Module browser actions
  setModuleBrowserOpen: (open: boolean) => void;
  setSelectedModuleType: (type: LogicModuleType) => void;
  fetchModules: (type: LogicModuleType, options?: { append?: boolean; search?: string; pages?: number }) => Promise<void>;
  setSelectedModule: (module: LogicModuleInfo | null) => void;
  setModuleSearchQuery: (query: string) => void;
  loadModuleScript: (script: string, language: ScriptLanguage, mode: ScriptMode) => void;
  confirmModuleLoad: () => void;
  cancelModuleLoad: () => void;

  // Module search actions
  setModuleSearchOpen: (open: boolean) => void;
  setModuleSearchMode: (mode: 'scripts' | 'datapoints') => void;
  setModuleSearchTerm: (query: string) => void;
  setModuleSearchMatchType: (matchType: ModuleSearchMatchType) => void;
  setModuleSearchCaseSensitive: (caseSensitive: boolean) => void;
  setModuleSearchModuleTypes: (moduleTypes: LogicModuleType[]) => void;
  searchModuleScripts: () => Promise<void>;
  searchDatapoints: () => Promise<void>;
  setSelectedScriptSearchResult: (result: ScriptSearchResult | null) => void;
  setSelectedDatapointSearchResult: (result: DataPointSearchResult | null) => void;
  clearModuleSearchResults: () => void;
  refreshModuleSearchIndex: () => Promise<void>;
  cancelModuleSearch: () => Promise<void>;
  
  // UI state actions
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsDialogOpen: (open: boolean) => void;
  setExecutionHistoryOpen: (open: boolean) => void;
  
  // Preferences actions
  setPreferences: (preferences: Partial<UserPreferences>) => void;
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
  
  // Execution history actions
  addToHistory: (entry: Omit<ExecutionHistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  loadHistory: () => Promise<void>;
  reloadFromHistory: (entry: ExecutionHistoryEntry) => void;

  // API Explorer actions
  openApiExplorerTab: () => string;
  updateApiTabRequest: (tabId: string, request: Partial<ApiRequestSpec>) => void;
  setApiTabResponse: (tabId: string, response: ApiResponseSummary | null) => void;
  executeApiRequest: (tabId?: string) => Promise<void>;
  addApiHistoryEntry: (portalId: string, entry: Omit<ApiHistoryEntry, 'id'>) => void;
  clearApiHistory: (portalId?: string) => void;
  loadApiHistory: () => Promise<void>;
  setApiEnvironment: (portalId: string, variables: ApiEnvironmentVariable[]) => void;
  loadApiEnvironments: () => Promise<void>;
  
  // Draft actions
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<DraftScript | DraftTabs | null>;
  clearDraft: () => Promise<void>;
  restoreDraft: (draft: DraftScript) => void;
  restoreDraftTabs: (draftTabs: DraftTabs) => void;
  
  // File export action (uses download)
  exportToFile: () => void;
  
  // Right sidebar actions
  setRightSidebarOpen: (open: boolean) => void;
  setRightSidebarTab: (tab: 'properties' | 'snippets' | 'history') => void;
  
  // Device properties actions
  fetchDeviceProperties: (deviceId: number) => Promise<void>;
  setPropertiesSearchQuery: (query: string) => void;
  clearDeviceProperties: () => void;
  insertPropertyAccess: (propertyName: string) => void;
  
  // Snippet library actions
  setSnippetsSearchQuery: (query: string) => void;
  setSnippetCategoryFilter: (filter: 'all' | 'template' | 'pattern') => void;
  setSnippetLanguageFilter: (filter: 'all' | 'groovy' | 'powershell') => void;
  setSnippetSourceFilter: (filter: 'all' | 'builtin' | 'user') => void;
  insertSnippet: (snippet: Snippet) => void;
  setCreateSnippetDialogOpen: (open: boolean) => void;
  setEditingSnippet: (snippet: Snippet | null) => void;
  createUserSnippet: (snippet: Omit<Snippet, 'id' | 'isBuiltIn'>) => void;
  updateUserSnippet: (id: string, updates: Partial<Omit<Snippet, 'id' | 'isBuiltIn'>>) => void;
  deleteUserSnippet: (id: string) => void;
  loadUserSnippets: () => Promise<void>;
  
  // Cancel execution actions
  setCancelDialogOpen: (open: boolean) => void;
  cancelExecution: () => Promise<void>;
  
  // Tab management actions
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
  setTabContextOverride: (tabId: string, override: EditorTab['contextOverride']) => void;
  openModuleScripts: (module: LogicModuleInfo, scripts: Array<{ type: 'ad' | 'collection'; content: string }>) => void;
  toggleRightSidebar: () => void;
  
  // File operations (Phase 6 - File System Access API)
  openFileFromDisk: () => Promise<void>;
  saveFile: (tabId?: string) => Promise<boolean>;
  saveFileAs: (tabId?: string) => Promise<boolean>;
  restoreFileHandles: () => Promise<void>;
  requestFilePermissions: () => Promise<void>;
  isTabDirty: (tabId: string) => boolean;
  getTabDirtyState: (tab: EditorTab) => boolean;
  
  // Welcome screen / Recent files
  recentFiles: Array<{ tabId: string; fileName: string; lastAccessed: number }>;
  isLoadingRecentFiles: boolean;
  loadRecentFiles: () => Promise<void>;
  openRecentFile: (tabId: string) => Promise<void>;
  createNewFile: () => void;
  
  // AppliesTo tester actions
  setAppliesToTesterOpen: (open: boolean) => void;
  setAppliesToExpression: (expression: string) => void;
  setAppliesToTestFrom: (testFrom: 'devicesGroup' | 'websiteGroup') => void;
  testAppliesTo: () => Promise<void>;
  clearAppliesToResults: () => void;
  setAppliesToFunctionSearch: (query: string) => void;
  
  // Custom AppliesTo functions actions
  fetchCustomFunctions: () => Promise<void>;
  createCustomFunction: (name: string, code: string, description?: string) => Promise<void>;
  updateCustomFunction: (id: number, name: string, code: string, description?: string) => Promise<void>;
  deleteCustomFunction: (id: number) => Promise<void>;
  getAllFunctions: () => Array<{ name: string; syntax: string; parameters: string; description: string; example?: string; source: 'builtin' | 'custom'; customId?: number }>;
  
  // Debug commands actions
  setDebugCommandsDialogOpen: (open: boolean) => void;
  executeDebugCommand: (portalId: string, collectorIds: number[], command: string, parameters?: Record<string, string>, positionalArgs?: string[]) => Promise<void>;
  cancelDebugCommandExecution: () => Promise<void>;
  debugCommandExecutionId: string | null;
  
  // Module commit state
  isCommittingModule: boolean;
  moduleCommitError: string | null;
  moduleCommitConfirmationOpen: boolean;
  loadedModuleForCommit: LogicModuleInfo | null;

  // Module lineage state
  moduleLineageDialogOpen: boolean;
  lineageVersions: LineageVersion[];
  isFetchingLineage: boolean;
  lineageError: string | null;
  
  // Module details state
  moduleDetailsDraftByTabId: Record<string, {
    original: Partial<{
      id: number;
      name: string;
      displayName?: string;
      description?: string;
      appliesTo?: string;
      group?: string;
      technology?: string;
      tags?: string;
      collectInterval?: number;
      accessGroupIds?: number[] | string;
      version?: number;
      enableAutoDiscovery?: boolean;
      autoDiscoveryConfig?: {
        scheduleInterval?: number;
        deleteInactiveInstance?: boolean;
        showDeletedInstanceDays?: number;
        disableInstance?: boolean;
        instanceAutoGroupMethod?: string;
        instanceAutoGroupMethodParams?: string;
        filters?: Array<{
          comment?: string;
          attribute: string;
          operation: string;
          value?: string;
        }>;
      };
    }> | null;
    draft: Partial<{
      id: number;
      name: string;
      displayName?: string;
      description?: string;
      appliesTo?: string;
      group?: string;
      technology?: string;
      tags?: string;
      collectInterval?: number;
      accessGroupIds?: number[] | string;
      version?: number;
      enableAutoDiscovery?: boolean;
      autoDiscoveryConfig?: {
        scheduleInterval?: number;
        deleteInactiveInstance?: boolean;
        showDeletedInstanceDays?: number;
        disableInstance?: boolean;
        instanceAutoGroupMethod?: string;
        instanceAutoGroupMethodParams?: string;
        filters?: Array<{
          comment?: string;
          attribute: string;
          operation: string;
          value?: string;
        }>;
      };
      dataPoints?: Array<{
        id: number;
        name: string;
        type?: number;
        description?: string;
        postProcessorMethod?: string;
        [key: string]: unknown;
      }>;
    }>;
    dirtyFields: Set<string>;
    loadedAt: number;
    tabId: string;
    moduleId: number;
    moduleType: LogicModuleType;
    version: number;
  }>;
  moduleDetailsDialogOpen: boolean;
  moduleDetailsLoading: boolean;
  moduleDetailsError: string | null;
  accessGroups: Array<{ id: number; name: string; description?: string; createdOn?: number; updatedOn?: number; createdBy?: string; tenantId?: string | null }>;
  isLoadingAccessGroups: boolean;
  
  // Module commit actions
  fetchModuleForCommit: (tabId: string) => Promise<void>;
  commitModuleScript: (tabId: string, reason?: string) => Promise<void>;
  canCommitModule: (tabId: string) => boolean;
  setModuleCommitConfirmationOpen: (open: boolean) => void;

  // Module lineage actions
  fetchLineageVersions: (tabId: string) => Promise<number>;
  setModuleLineageDialogOpen: (open: boolean) => void;
  
  // Module details actions
  setModuleDetailsDialogOpen: (open: boolean) => void;
  loadModuleDetails: (tabId: string) => Promise<void>;
  updateModuleDetailsField: (tabId: string, field: string, value: unknown) => void;
  resetModuleDetailsDraft: (tabId: string) => void;
  fetchAccessGroups: () => Promise<void>;
}

// Storage keys
const STORAGE_KEYS = {
  PREFERENCES: 'lm-ide-preferences',
  HISTORY: 'lm-ide-execution-history',
  API_HISTORY: 'lm-ide-api-history',
  API_ENVIRONMENTS: 'lm-ide-api-envs',
  DRAFT: 'lm-ide-draft',           // Legacy single-file draft
  DRAFT_TABS: 'lm-ide-draft-tabs', // Multi-tab draft
  USER_SNIPPETS: 'lm-ide-user-snippets',
} as const;

// Helper to create a default tab
function createDefaultTab(language: ScriptLanguage = 'groovy', mode: ScriptMode = 'freeform'): EditorTab {
  return {
    id: crypto.randomUUID(),
    kind: 'script',
    displayName: `Untitled.${language === 'groovy' ? 'groovy' : 'ps1'}`,
    content: getDefaultScriptTemplate(language),
    language,
    mode,
  };
}

const DEFAULT_API_REQUEST: ApiRequestSpec = {
  method: 'GET',
  path: '',
  queryParams: {},
  headerParams: {},
  body: '',
  bodyMode: 'form',
  contentType: 'application/json',
      pagination: {
        enabled: false,
        sizeParam: 'size',
        offsetParam: 'offset',
        pageSize: 25,
      },
};

function createDefaultApiTab(): EditorTab {
  return {
    id: crypto.randomUUID(),
    kind: 'api',
    displayName: 'API Request',
    content: '',
    language: 'groovy',
    mode: 'freeform',
    source: { type: 'api' },
    api: {
      request: { ...DEFAULT_API_REQUEST },
    },
  };
}

let activeDebugCommandListener: ((message: any) => boolean) | null = null;
let activeModuleSearchListener: ((message: any) => boolean) | null = null;

// No initial tab - WelcomeScreen will show instead

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  portals: [],
  selectedPortalId: null,
  collectors: [],
  selectedCollectorId: null,
  devices: [],
  isFetchingDevices: false,
  hostname: '',
  wildvalue: '',
  datasourceId: '',
  
  // Multi-tab state - starts empty, WelcomeScreen shows when no tabs
  tabs: [],
  activeTabId: null,

  // API Explorer state
  apiHistoryByPortal: {},
  apiEnvironmentsByPortal: {},
  isExecutingApi: false,
  
  isExecuting: false,
  currentExecution: null,
  parsedOutput: null,
  editorInstance: null,
  executionContextDialogOpen: false,
  pendingExecution: null,
  moduleBrowserOpen: false,
  selectedModuleType: 'datasource',
  modulesCache: {
    datasource: [],
    configsource: [],
    topologysource: [],
    propertysource: [],
    logsource: [],
    diagnosticsource: [],
    eventsource: [],
  },
  modulesMeta: {
    datasource: { offset: 0, hasMore: true, total: 0 },
    configsource: { offset: 0, hasMore: true, total: 0 },
    topologysource: { offset: 0, hasMore: true, total: 0 },
    propertysource: { offset: 0, hasMore: true, total: 0 },
    logsource: { offset: 0, hasMore: true, total: 0 },
    diagnosticsource: { offset: 0, hasMore: true, total: 0 },
    eventsource: { offset: 0, hasMore: true, total: 0 },
  },
  modulesSearch: {
    datasource: '',
    configsource: '',
    topologysource: '',
    propertysource: '',
    logsource: '',
    diagnosticsource: '',
    eventsource: '',
  },
  isFetchingModules: false,
  selectedModule: null,
  moduleSearchQuery: '',
  moduleSearchOpen: false,
  moduleSearchMode: 'scripts',
  moduleSearchTerm: '',
  moduleSearchMatchType: 'substring',
  moduleSearchCaseSensitive: false,
  moduleSearchModuleTypes: [
    'datasource',
    'configsource',
    'topologysource',
    'propertysource',
    'logsource',
    'diagnosticsource',
    'eventsource',
  ],
  isSearchingModules: false,
  moduleSearchProgress: null,
  moduleSearchIndexInfo: null,
  moduleSearchExecutionId: null,
  moduleScriptSearchResults: [],
  moduleDatapointSearchResults: [],
  moduleSearchError: null,
  selectedScriptSearchResult: null,
  selectedDatapointSearchResult: null,
  pendingModuleLoad: null,
  outputTab: 'raw',
  commandPaletteOpen: false,
  settingsDialogOpen: false,
  executionHistoryOpen: false,
  
  // Right sidebar initial state
  rightSidebarOpen: true,
  rightSidebarTab: 'properties',
  
  // Device properties initial state
  deviceProperties: [],
  isFetchingProperties: false,
  propertiesSearchQuery: '',
  selectedDeviceId: null,
  
  // Snippet library initial state
  userSnippets: [],
  snippetsSearchQuery: '',
  snippetCategoryFilter: 'all',
  snippetLanguageFilter: 'all',
  snippetSourceFilter: 'all',
  createSnippetDialogOpen: false,
  editingSnippet: null,
  
  // Cancel execution initial state
  currentExecutionId: null,
  cancelDialogOpen: false,
  
  preferences: DEFAULT_PREFERENCES,
  executionHistory: [],
  hasSavedDraft: false,
  
  // File system initial state
  tabsNeedingPermission: [],
  isRestoringFileHandles: false,
  
  // AppliesTo tester initial state
  appliesToTesterOpen: false,
  appliesToExpression: '',
  appliesToResults: [],
  appliesToError: null,
  appliesToTestFrom: 'devicesGroup',
  isTestingAppliesTo: false,
  appliesToFunctionSearch: '',
  
  // Custom AppliesTo functions initial state
  customFunctions: [],
  isLoadingCustomFunctions: false,
  customFunctionError: null,
  isCreatingFunction: false,
  isUpdatingFunction: false,
  isDeletingFunction: false,
  
  // Module commit initial state
  isCommittingModule: false,
  moduleCommitError: null,
  moduleCommitConfirmationOpen: false,
  loadedModuleForCommit: null,

  // Module lineage initial state
  moduleLineageDialogOpen: false,
  lineageVersions: [],
  isFetchingLineage: false,
  lineageError: null,
  
  // Module details initial state
  moduleDetailsDraftByTabId: {},
  moduleDetailsDialogOpen: false,
  moduleDetailsLoading: false,
  moduleDetailsError: null,
  accessGroups: [],
  isLoadingAccessGroups: false,
  
  // Debug commands initial state
  debugCommandsDialogOpen: false,
  debugCommandResults: {},
  isExecutingDebugCommand: false,
  debugCommandExecutionId: null,
  
  // Welcome screen / Recent files state
  recentFiles: [],
  isLoadingRecentFiles: false,

  // Actions
  setSelectedPortal: (portalId) => {
    set({ 
      selectedPortalId: portalId, 
      selectedCollectorId: null, 
      collectors: [],
      devices: [],
      isFetchingDevices: false,
      hostname: '',
      // Clear module cache when portal changes
      modulesCache: {
        datasource: [],
        configsource: [],
        topologysource: [],
        propertysource: [],
        logsource: [],
        diagnosticsource: [],
        eventsource: [],
      },
      modulesMeta: {
        datasource: { offset: 0, hasMore: true, total: 0 },
        configsource: { offset: 0, hasMore: true, total: 0 },
        topologysource: { offset: 0, hasMore: true, total: 0 },
        propertysource: { offset: 0, hasMore: true, total: 0 },
        logsource: { offset: 0, hasMore: true, total: 0 },
        diagnosticsource: { offset: 0, hasMore: true, total: 0 },
        eventsource: { offset: 0, hasMore: true, total: 0 },
      },
      modulesSearch: {
        datasource: '',
        configsource: '',
        topologysource: '',
        propertysource: '',
        logsource: '',
        diagnosticsource: '',
        eventsource: '',
      },
      moduleSearchIndexInfo: null,
    });
    if (portalId) {
      get().refreshCollectors();
    }
  },

  setSelectedCollector: (collectorId) => {
    set({ 
      selectedCollectorId: collectorId,
      devices: [],
      isFetchingDevices: false,
      hostname: '',
    });
    // Fetch devices when collector changes
    if (collectorId) {
      get().fetchDevices();
    }
  },

  fetchDevices: async () => {
    const { selectedPortalId, selectedCollectorId } = get();
    if (!selectedPortalId || !selectedCollectorId) return;

    const fetchingPortal = selectedPortalId;
    const fetchingCollector = selectedCollectorId;

    set({ isFetchingDevices: true });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEVICES',
        payload: { 
          portalId: selectedPortalId, 
          collectorId: selectedCollectorId 
        },
      });

      if (response?.type === 'DEVICES_UPDATE') {
        const currentPortal = get().selectedPortalId;
        const currentCollector = get().selectedCollectorId;
        if (currentPortal !== fetchingPortal || currentCollector !== fetchingCollector) {
          return;
        }
        const fetchResponse = response.payload as FetchDevicesResponse;
        
        // Check for error in response (portal tabs may be stale)
        if (fetchResponse.error) {
          console.warn('Device fetch returned error:', fetchResponse.error);
          // Could show a toast notification here in the future
          set({ devices: [], isFetchingDevices: false });
          return;
        }
        
        set({ devices: fetchResponse.items, isFetchingDevices: false });
      } else {
        console.error('Failed to fetch devices:', response);
        set({ devices: [], isFetchingDevices: false });
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      set({ devices: [], isFetchingDevices: false });
    }
  },

  setHostname: (hostname) => {
    set({ hostname });
    
    // Auto-fetch device properties when a device is selected
    if (hostname) {
      const { devices } = get();
      const device = devices.find(d => d.name === hostname);
      if (device) {
        get().fetchDeviceProperties(device.id);
      }
    } else {
      // Clear properties when hostname is cleared
      get().clearDeviceProperties();
    }
  },

  setWildvalue: (wildvalue) => {
    set({ wildvalue });
  },

  setDatasourceId: (datasourceId) => {
    set({ datasourceId });
  },

  setLanguage: (language, force = false) => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;
    
    // If same language, do nothing
    if (language === activeTab.language) return;
    
    // Normalize scripts for comparison (trim whitespace, normalize line endings)
    const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
    const isDefaultGroovy = normalize(activeTab.content) === normalize(DEFAULT_GROOVY_TEMPLATE);
    const isDefaultPowershell = normalize(activeTab.content) === normalize(DEFAULT_POWERSHELL_TEMPLATE);
    
    // Determine new content
    let newContent = activeTab.content;
    let newDisplayName = activeTab.displayName;
    
    // Switch templates if:
    // - force is true (user confirmed reset)
    // - script is a default template
    if (force || isDefaultGroovy || isDefaultPowershell) {
      newContent = language === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE;
      // Update display name extension if it's an untitled file
      // Match both "Untitled.ext" and "Untitled N.ext" patterns
      const untitledMatch = activeTab.displayName.match(/^(Untitled(?:\s+\d+)?)\.(groovy|ps1)$/);
      if (untitledMatch) {
        newDisplayName = `${untitledMatch[1]}.${language === 'groovy' ? 'groovy' : 'ps1'}`;
      }
    }
    
    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, language, content: newContent, displayName: newDisplayName }
          : t
      ),
    });
  },

  setMode: (mode) => {
    const { tabs, activeTabId, outputTab } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;
    
    // Clear parsed output and switch to raw tab if in freeform mode
    const updates: Partial<EditorState> = { parsedOutput: null };
    if (mode === 'freeform' && (outputTab === 'parsed' || outputTab === 'validation')) {
      updates.outputTab = 'raw';
    }
    
    set({
      ...updates,
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, mode }
          : t
      ),
    });
  },

  setOutputTab: (tab) => {
    set({ outputTab: tab });
  },

  setEditorInstance: (editorInstance) => {
    set({ editorInstance });
  },

  executeScript: async () => {
    const state = get();
    
    // Get active tab data directly (getters don't work on state snapshots)
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (!activeTab) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: 'No active tab',
        },
        outputTab: 'raw',
        parsedOutput: null,
      });
      return;
    }

    if (activeTab.kind === 'api') {
      return;
    }
    
    const script = activeTab.content;
    const language = activeTab.language;
    const mode = activeTab.mode;
    const selectedCollector = state.collectors.find(c => c.id === state.selectedCollectorId);
    const isWindowsCollector = selectedCollector?.arch?.toLowerCase().includes('win') ?? true;
    
    if (!state.selectedPortalId || !state.selectedCollectorId) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: 'Please select a portal and collector',
        },
        outputTab: 'raw',
        parsedOutput: null,
      });
      return;
    }

    if (language === 'powershell' && !isWindowsCollector) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: 'PowerShell execution is only supported on Windows collectors. Select a Windows collector to run this script.',
        },
        outputTab: 'raw',
        parsedOutput: null,
      });
      return;
    }

    // For Collection or Batch Collection mode, always show the execution context dialog
    // This allows users to confirm/modify wildvalue or datasource ID before each run
    if (mode === 'collection' || mode === 'batchcollection') {
      set({
        executionContextDialogOpen: true,
        pendingExecution: {
          portalId: state.selectedPortalId,
          collectorId: state.selectedCollectorId,
          script,
          language,
          mode,
          hostname: state.hostname || undefined,
        },
      });
      return;
    }

    // Generate execution ID for tracking/cancellation
    const executionId = crypto.randomUUID();
    
    // Clear previous execution and switch to raw output tab
    set({ 
      isExecuting: true, 
      currentExecution: null,
      currentExecutionId: executionId,
      parsedOutput: null,
      outputTab: 'raw',
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_SCRIPT',
        payload: {
          portalId: state.selectedPortalId,
          collectorId: state.selectedCollectorId,
          script,
          language,
          mode,
          executionId,
          hostname: state.hostname || undefined,
          wildvalue: state.wildvalue || undefined,
          datasourceId: state.datasourceId || undefined,
        },
      });

      if (response?.type === 'EXECUTION_UPDATE') {
        const execution = response.payload as ExecutionResult;
        set({ currentExecution: execution, isExecuting: false });
        
        // Add to history
        const selectedCollector = get().collectors.find(c => c.id === state.selectedCollectorId);
        get().addToHistory({
          portal: state.selectedPortalId,
          collector: selectedCollector?.description || `Collector ${state.selectedCollectorId}`,
          collectorId: state.selectedCollectorId,
          hostname: state.hostname || undefined,
          language,
          mode,
          script,
          output: execution.rawOutput,
          status: execution.status === 'complete' ? 'success' : 'error',
          duration: execution.duration,
        });
        
        // Auto-parse output if not in freeform mode and execution succeeded
        if (mode !== 'freeform' && execution.status === 'complete' && execution.rawOutput) {
          get().parseCurrentOutput();
        }
      } else if (response?.type === 'ERROR') {
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: response.payload?.message ?? 'Unknown error from service worker',
          },
          isExecuting: false,
        });
      } else {
        // Unexpected response format
        console.error('Unexpected response from EXECUTE_SCRIPT:', response);
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: 'Unexpected response from execution service',
          },
          isExecuting: false,
        });
      }
    } catch (error) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        isExecuting: false,
      });
    }
  },

  refreshPortals: async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'DISCOVER_PORTALS' });
      if (response?.payload) {
        set({ portals: response.payload });
        
        // Auto-select first portal if none selected
        const state = get();
        if (!state.selectedPortalId && response.payload.length > 0) {
          set({ selectedPortalId: response.payload[0].id });
          get().refreshCollectors();
        }
      }
    } catch (error) {
      console.error('Failed to refresh portals:', error);
    }
  },

  refreshCollectors: async () => {
    const { selectedPortalId } = get();
    if (!selectedPortalId) return;

    const fetchingForPortal = selectedPortalId;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_COLLECTORS',
        payload: { portalId: selectedPortalId },
      });
      
      // Prevent race conditions when portal changes while fetching
      const currentPortal = get().selectedPortalId;
      if (currentPortal !== fetchingForPortal) return;
      
      if (response?.payload) {
        set({ collectors: response.payload });
      }
    } catch {
      // Silently handle - collectors will remain empty
    }
  },

  handlePortalDisconnected: (portalId: string, hostname: string) => {
    const { selectedPortalId, portals } = get();
    
    // Remove the disconnected portal from the list
    const updatedPortals = portals.filter(p => p.id !== portalId);
    
    // If the disconnected portal was selected, clear the selection
    if (selectedPortalId === portalId) {
      set({
        portals: updatedPortals,
        selectedPortalId: null,
        selectedCollectorId: null,
        collectors: [],
        devices: [],
        isFetchingDevices: false,
        hostname: '',
        // Clear module cache since it was for this portal
        modulesCache: {
          datasource: [],
          configsource: [],
          topologysource: [],
          propertysource: [],
          logsource: [],
          diagnosticsource: [],
          eventsource: [],
        },
        modulesMeta: {
          datasource: { offset: 0, hasMore: true, total: 0 },
          configsource: { offset: 0, hasMore: true, total: 0 },
          topologysource: { offset: 0, hasMore: true, total: 0 },
          propertysource: { offset: 0, hasMore: true, total: 0 },
          logsource: { offset: 0, hasMore: true, total: 0 },
          diagnosticsource: { offset: 0, hasMore: true, total: 0 },
          eventsource: { offset: 0, hasMore: true, total: 0 },
        },
        modulesSearch: {
          datasource: '',
          configsource: '',
          topologysource: '',
          propertysource: '',
          logsource: '',
          diagnosticsource: '',
          eventsource: '',
        },
        moduleSearchIndexInfo: null,
      });
      
      // Show toast notification for the disconnected portal
      toast.warning(`Portal disconnected: ${hostname}`, {
        description: 'Open a LogicMonitor tab to reconnect.',
        duration: 8000,
      });
    } else {
      // Just update the portals list
      set({ portals: updatedPortals });
      
      // Show a less intrusive notification
      toast.info(`Portal disconnected: ${hostname}`, {
        duration: 5000,
      });
    }
  },

  clearOutput: () => {
    set({ currentExecution: null, parsedOutput: null });
  },

  // Parse the current execution output based on mode
  parseCurrentOutput: () => {
    const { currentExecution, tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    const mode = activeTab?.mode ?? 'freeform';
    
    if (!currentExecution?.rawOutput || mode === 'freeform') {
      set({ parsedOutput: null });
      return;
    }
    
    const result = parseOutput(currentExecution.rawOutput, mode);
    set({ parsedOutput: result });
  },

  // Execution context dialog actions
  setExecutionContextDialogOpen: (open) => {
    set({ executionContextDialogOpen: open });
  },

  confirmExecutionContext: async (wildvalue: string, datasourceId: string) => {
    const { pendingExecution } = get();
    if (!pendingExecution) return;

    const executionId = crypto.randomUUID();

    // Close dialog and store values
    set({ 
      executionContextDialogOpen: false, 
      wildvalue: wildvalue || get().wildvalue,
      datasourceId: datasourceId || get().datasourceId,
      pendingExecution: null,
    });

    // Now execute with the context values
    set({ 
      isExecuting: true, 
      currentExecution: null,
      currentExecutionId: executionId,
      parsedOutput: null,
      outputTab: 'raw',
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_SCRIPT',
        payload: {
          ...pendingExecution,
          executionId,
          wildvalue: wildvalue || undefined,
          datasourceId: datasourceId || undefined,
        },
      });

      if (response?.type === 'EXECUTION_UPDATE') {
        const execution = response.payload as ExecutionResult;
        set({ currentExecution: execution, isExecuting: false });
        
        // Add to history
        const selectedCollector = get().collectors.find(c => c.id === pendingExecution.collectorId);
        get().addToHistory({
          portal: pendingExecution.portalId,
          collector: selectedCollector?.description || `Collector ${pendingExecution.collectorId}`,
          collectorId: pendingExecution.collectorId,
          hostname: pendingExecution.hostname || undefined,
          language: pendingExecution.language,
          mode: pendingExecution.mode,
          script: pendingExecution.script,
          output: execution.rawOutput,
          status: execution.status === 'complete' ? 'success' : 'error',
          duration: execution.duration,
        });
        
        // Auto-parse output
        if (execution.status === 'complete' && execution.rawOutput) {
          get().parseCurrentOutput();
        }
      } else if (response?.type === 'ERROR') {
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: response.payload?.message ?? 'Unknown error from service worker',
          },
          isExecuting: false,
        });
      } else {
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: 'Unexpected response from execution service',
          },
          isExecuting: false,
        });
      }
    } catch (error) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        isExecuting: false,
      });
    }
  },

  cancelExecutionContextDialog: () => {
    set({ 
      executionContextDialogOpen: false, 
      pendingExecution: null,
    });
  },

  // Module browser actions
  setModuleBrowserOpen: (open) => {
    set({ moduleBrowserOpen: open });
    // Fetch modules for the selected type when opening
    if (open) {
      const { selectedModuleType, modulesCache, selectedPortalId } = get();
      if (selectedPortalId && modulesCache[selectedModuleType].length === 0) {
        get().fetchModules(selectedModuleType, { append: false, pages: 3, search: '' });
      }
    } else {
      // Clear selection when closing
      set({ selectedModule: null, moduleSearchQuery: '' });
    }
  },

  setSelectedModuleType: (type) => {
    set({ selectedModuleType: type, selectedModule: null });
    const { modulesCache, selectedPortalId } = get();
    // Fetch if cache is empty for this type
    if (selectedPortalId && modulesCache[type].length === 0) {
      get().fetchModules(type, { append: false, pages: 3, search: '' });
    }
  },

  fetchModules: async (type, options) => {
    const { selectedPortalId, modulesMeta, modulesSearch } = get();
    if (!selectedPortalId) return;

    const pages = Math.max(1, options?.pages ?? 1);
    if (pages > 1 && !options?.append) {
      for (let i = 0; i < pages; i++) {
        await get().fetchModules(type, {
          append: i > 0,
          search: options?.search ?? '',
          pages: 1,
        });
      }
      return;
    }

    const append = options?.append ?? false;
    const search = options?.search ?? modulesSearch[type];
    const currentMeta = modulesMeta[type];
    const offset = append ? currentMeta.offset : 0;

    set({ isFetchingModules: true });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULES',
        payload: {
          portalId: selectedPortalId,
          moduleType: type,
          offset,
          size: 1000,
          search: search || undefined,
        },
      });

      if (response?.type === 'MODULES_FETCHED') {
        const fetchResponse = response.payload as FetchModulesResponse;
        set((state) => {
          const existing = append ? state.modulesCache[type] : [];
          const merged = new Map<number, LogicModuleInfo>();
          for (const item of existing) merged.set(item.id, item);
          for (const item of fetchResponse.items) merged.set(item.id, item);

          const nextOffset = offset + fetchResponse.items.length;

          return {
            modulesCache: {
              ...state.modulesCache,
              [type]: Array.from(merged.values()),
            },
            modulesMeta: {
              ...state.modulesMeta,
              [type]: {
                offset: nextOffset,
                hasMore: fetchResponse.hasMore,
                total: fetchResponse.total,
              },
            },
            modulesSearch: {
              ...state.modulesSearch,
              [type]: search,
            },
            isFetchingModules: false,
          };
        });
      } else {
        console.error('Failed to fetch modules:', response);
        set({ isFetchingModules: false });
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
      set({ isFetchingModules: false });
    }
  },

  setSelectedModule: (module) => {
    set({ selectedModule: module });
  },

  setModuleSearchQuery: (query) => {
    set({ moduleSearchQuery: query });
  },

  loadModuleScript: (script, language, mode) => {
    const { selectedModule } = get();
    
    // Create a new tab for the loaded script
    const moduleName = selectedModule?.name || 'Module';
    const extension = language === 'groovy' ? 'groovy' : 'ps1';
    const modeLabel = mode === 'ad' ? 'ad' : mode === 'batchcollection' ? 'batch' : 'collection';
    const displayName = `${moduleName}/${modeLabel}.${extension}`;
    
    // Determine script type from mode
    const scriptType: 'collection' | 'ad' = mode === 'ad' ? 'ad' : 'collection';
    
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName,
      content: script,
      language,
      mode,
      originalContent: script, // Store original content for dirty detection
      source: selectedModule ? {
        type: 'module',
        moduleId: selectedModule.id,
        moduleName: selectedModule.name,
        moduleType: selectedModule.moduleType,
        scriptType,
        lineageId: selectedModule.lineageId,
      } : undefined,
    };
    
    const { tabs } = get();
    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
      moduleBrowserOpen: false,
      selectedModule: null,
      moduleSearchQuery: '',
      pendingModuleLoad: null,
    });
  },

  confirmModuleLoad: () => {
    const { pendingModuleLoad, selectedModule } = get();
    if (!pendingModuleLoad) return;

    // Create a new tab for the loaded script
    const moduleName = selectedModule?.name || 'Module';
    const extension = pendingModuleLoad.language === 'groovy' ? 'groovy' : 'ps1';
    const modeLabel = pendingModuleLoad.mode === 'ad' ? 'ad' : pendingModuleLoad.mode === 'batchcollection' ? 'batch' : 'collection';
    const displayName = `${moduleName}/${modeLabel}.${extension}`;
    
    // Determine script type from mode
    const scriptType: 'collection' | 'ad' = pendingModuleLoad.mode === 'ad' ? 'ad' : 'collection';
    
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName,
      content: pendingModuleLoad.script,
      language: pendingModuleLoad.language,
      mode: pendingModuleLoad.mode,
      originalContent: pendingModuleLoad.script, // Store original content for dirty detection
      source: selectedModule ? {
        type: 'module',
        moduleId: selectedModule.id,
        moduleName: selectedModule.name,
        moduleType: selectedModule.moduleType,
        scriptType,
        lineageId: selectedModule.lineageId,
      } : undefined,
    };
    
    const { tabs } = get();
    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
      pendingModuleLoad: null,
      moduleBrowserOpen: false,
      selectedModule: null,
      moduleSearchQuery: '',
    });
  },

  cancelModuleLoad: () => {
    set({ pendingModuleLoad: null });
  },

  // Module search actions
  setModuleSearchOpen: (open) => {
    set({ moduleSearchOpen: open });
    if (!open) {
      set({
        moduleSearchTerm: '',
        moduleSearchError: null,
        moduleScriptSearchResults: [],
        moduleDatapointSearchResults: [],
        selectedScriptSearchResult: null,
        selectedDatapointSearchResult: null,
        isSearchingModules: false,
        moduleSearchProgress: null,
        moduleSearchExecutionId: null,
      });
    }
  },

  setModuleSearchMode: (mode) => {
    set({
      moduleSearchMode: mode,
      moduleSearchError: null,
      moduleScriptSearchResults: [],
      moduleDatapointSearchResults: [],
      selectedScriptSearchResult: null,
      selectedDatapointSearchResult: null,
      moduleSearchProgress: null,
    });
  },

  setModuleSearchTerm: (query) => {
    set({ moduleSearchTerm: query });
  },

  setModuleSearchMatchType: (matchType) => {
    set({ moduleSearchMatchType: matchType });
  },

  setModuleSearchCaseSensitive: (caseSensitive) => {
    set({ moduleSearchCaseSensitive: caseSensitive });
  },

  setModuleSearchModuleTypes: (moduleTypes) => {
    set({ moduleSearchModuleTypes: moduleTypes });
  },

  searchModuleScripts: async () => {
    const {
      selectedPortalId,
      moduleSearchTerm,
      moduleSearchMatchType,
      moduleSearchCaseSensitive,
      moduleSearchModuleTypes,
    } = get();
    if (!selectedPortalId) return;

    const trimmedQuery = moduleSearchTerm.trim();
    const previousSearchId = get().moduleSearchExecutionId;
    if (previousSearchId) {
      void chrome.runtime.sendMessage({
        type: 'CANCEL_MODULE_SEARCH',
        payload: { searchId: previousSearchId },
      }).catch(() => {
        // Ignore cancellation errors
      });
    }
    if (!trimmedQuery) {
      set({
        moduleScriptSearchResults: [],
        selectedScriptSearchResult: null,
        moduleSearchError: null,
        isSearchingModules: false,
        moduleSearchProgress: null,
      });
      return;
    }

    const searchId = crypto.randomUUID();
    set({
      isSearchingModules: true,
      moduleSearchError: null,
      moduleSearchExecutionId: searchId,
      moduleSearchProgress: { searchId, stage: 'searching', processed: 0, matched: 0 },
    });

    if (activeModuleSearchListener) {
      chrome.runtime.onMessage.removeListener(activeModuleSearchListener);
    }

    activeModuleSearchListener = (message: any) => {
      if (message.type === 'MODULE_SEARCH_PROGRESS' && message.payload?.searchId === searchId) {
        set({ moduleSearchProgress: message.payload as ModuleSearchProgress });
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(activeModuleSearchListener);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_MODULE_SCRIPTS',
        payload: {
          portalId: selectedPortalId,
          query: trimmedQuery,
          matchType: moduleSearchMatchType,
          caseSensitive: moduleSearchCaseSensitive,
          moduleTypes: moduleSearchModuleTypes,
          searchId,
        },
      });

      const stillActive = get().moduleSearchExecutionId === searchId;
      if (!stillActive) {
        return;
      }

      if (response?.type === 'MODULE_SCRIPT_SEARCH_RESULTS') {
        const results = response.payload.results as ScriptSearchResult[];
        set({
          moduleScriptSearchResults: results,
          selectedScriptSearchResult: results[0] || null,
          isSearchingModules: false,
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
          moduleSearchIndexInfo: response.payload.indexInfo ?? null,
        });
      } else {
        const errorMessage = response?.payload?.error || 'Failed to search modules';
        set({
          moduleSearchError: errorMessage,
          isSearchingModules: false,
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
        });
      }
    } catch (error) {
      set({
        moduleSearchError: error instanceof Error ? error.message : 'Failed to search modules',
        isSearchingModules: false,
        moduleSearchProgress: null,
        moduleSearchExecutionId: null,
      });
    } finally {
      if (activeModuleSearchListener) {
        chrome.runtime.onMessage.removeListener(activeModuleSearchListener);
        activeModuleSearchListener = null;
      }
    }
  },

  searchDatapoints: async () => {
    const {
      selectedPortalId,
      moduleSearchTerm,
      moduleSearchMatchType,
      moduleSearchCaseSensitive,
    } = get();
    if (!selectedPortalId) return;

    const trimmedQuery = moduleSearchTerm.trim();
    const previousSearchId = get().moduleSearchExecutionId;
    if (previousSearchId) {
      void chrome.runtime.sendMessage({
        type: 'CANCEL_MODULE_SEARCH',
        payload: { searchId: previousSearchId },
      }).catch(() => {
        // Ignore cancellation errors
      });
    }
    if (!trimmedQuery) {
      set({
        moduleDatapointSearchResults: [],
        selectedDatapointSearchResult: null,
        moduleSearchError: null,
        isSearchingModules: false,
        moduleSearchProgress: null,
      });
      return;
    }

    const searchId = crypto.randomUUID();
    set({
      isSearchingModules: true,
      moduleSearchError: null,
      moduleSearchExecutionId: searchId,
      moduleSearchProgress: { searchId, stage: 'searching', processed: 0, matched: 0 },
    });

    if (activeModuleSearchListener) {
      chrome.runtime.onMessage.removeListener(activeModuleSearchListener);
    }

    activeModuleSearchListener = (message: any) => {
      if (message.type === 'MODULE_SEARCH_PROGRESS' && message.payload?.searchId === searchId) {
        set({ moduleSearchProgress: message.payload as ModuleSearchProgress });
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(activeModuleSearchListener);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_DATAPOINTS',
        payload: {
          portalId: selectedPortalId,
          query: trimmedQuery,
          matchType: moduleSearchMatchType,
          caseSensitive: moduleSearchCaseSensitive,
          searchId,
        },
      });

      const stillActive = get().moduleSearchExecutionId === searchId;
      if (!stillActive) {
        return;
      }

      if (response?.type === 'DATAPOINT_SEARCH_RESULTS') {
        const results = response.payload.results as DataPointSearchResult[];
        set({
          moduleDatapointSearchResults: results,
          selectedDatapointSearchResult: results[0] || null,
          isSearchingModules: false,
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
          moduleSearchIndexInfo: response.payload.indexInfo ?? null,
        });
      } else {
        const errorMessage = response?.payload?.error || 'Failed to search datapoints';
        set({
          moduleSearchError: errorMessage,
          isSearchingModules: false,
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
        });
      }
    } catch (error) {
      set({
        moduleSearchError: error instanceof Error ? error.message : 'Failed to search datapoints',
        isSearchingModules: false,
        moduleSearchProgress: null,
        moduleSearchExecutionId: null,
      });
    } finally {
      if (activeModuleSearchListener) {
        chrome.runtime.onMessage.removeListener(activeModuleSearchListener);
        activeModuleSearchListener = null;
      }
    }
  },

  setSelectedScriptSearchResult: (result) => {
    set({ selectedScriptSearchResult: result });
  },

  setSelectedDatapointSearchResult: (result) => {
    set({ selectedDatapointSearchResult: result });
  },

  clearModuleSearchResults: () => {
    set({
      moduleScriptSearchResults: [],
      moduleDatapointSearchResults: [],
      selectedScriptSearchResult: null,
      selectedDatapointSearchResult: null,
      moduleSearchError: null,
      moduleSearchProgress: null,
    });
  },

  refreshModuleSearchIndex: async () => {
    const { selectedPortalId } = get();
    if (!selectedPortalId) return;

    const previousSearchId = get().moduleSearchExecutionId;
    if (previousSearchId) {
      void chrome.runtime.sendMessage({
        type: 'CANCEL_MODULE_SEARCH',
        payload: { searchId: previousSearchId },
      }).catch(() => {
        // Ignore cancellation errors
      });
    }

    const searchId = crypto.randomUUID();
    set({
      moduleSearchProgress: { searchId, stage: 'indexing', processed: 0 },
      moduleSearchExecutionId: searchId,
      moduleSearchError: null,
    });

    if (activeModuleSearchListener) {
      chrome.runtime.onMessage.removeListener(activeModuleSearchListener);
    }

    activeModuleSearchListener = (message: any) => {
      if (message.type === 'MODULE_SEARCH_PROGRESS' && message.payload?.searchId === searchId) {
        set({ moduleSearchProgress: message.payload as ModuleSearchProgress });
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(activeModuleSearchListener);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REFRESH_MODULE_INDEX',
        payload: { portalId: selectedPortalId, searchId },
      });

      if (response?.type === 'MODULE_INDEX_REFRESHED') {
        set({
          moduleSearchIndexInfo: response.payload as ModuleIndexInfo,
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
        });
        toast.success('Module search index refreshed');
      } else if (response?.type === 'MODULE_SCRIPT_SEARCH_ERROR') {
        set({
          moduleSearchError: response.payload?.error || 'Failed to refresh module index',
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
        });
      } else {
        set({
          moduleSearchError: 'Failed to refresh module index',
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
        });
      }
    } catch (error) {
      set({
        moduleSearchError: error instanceof Error ? error.message : 'Failed to refresh module index',
        moduleSearchProgress: null,
        moduleSearchExecutionId: null,
      });
    } finally {
      if (activeModuleSearchListener) {
        chrome.runtime.onMessage.removeListener(activeModuleSearchListener);
        activeModuleSearchListener = null;
      }
    }
  },

  cancelModuleSearch: async () => {
    const { moduleSearchExecutionId } = get();
    if (!moduleSearchExecutionId) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'CANCEL_MODULE_SEARCH',
        payload: { searchId: moduleSearchExecutionId },
      });
    } catch (error) {
      console.error('Failed to cancel module search:', error);
    } finally {
      set({
        isSearchingModules: false,
        moduleSearchExecutionId: null,
        moduleSearchProgress: null,
      });
      if (activeModuleSearchListener) {
        chrome.runtime.onMessage.removeListener(activeModuleSearchListener);
        activeModuleSearchListener = null;
      }
    }
  },

  // UI state actions
  setCommandPaletteOpen: (open) => {
    set({ commandPaletteOpen: open });
  },

  setSettingsDialogOpen: (open) => {
    set({ settingsDialogOpen: open });
  },

  setExecutionHistoryOpen: (open) => {
    set({ executionHistoryOpen: open });
  },

  // Preferences actions
  setPreferences: (newPreferences) => {
    set((state) => ({
      preferences: { ...state.preferences, ...newPreferences },
    }));
    // Auto-save preferences
    get().savePreferences();
  },

  loadPreferences: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES);
      const storedPrefs = result[STORAGE_KEYS.PREFERENCES] as Partial<UserPreferences> | undefined;
      if (storedPrefs) {
        const mergedPrefs = { ...DEFAULT_PREFERENCES, ...storedPrefs };
        
        // Check if editor is in initial state (using default template)
        const { tabs, activeTabId } = get();
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab?.kind === 'api') {
          set({ preferences: mergedPrefs });
          return;
        }
        const currentScript = activeTab?.content ?? '';
        
        const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
        const isDefaultGroovy = normalize(currentScript) === normalize(DEFAULT_GROOVY_TEMPLATE);
        const isDefaultPowershell = normalize(currentScript) === normalize(DEFAULT_POWERSHELL_TEMPLATE);
        const isInitialState = isDefaultGroovy || isDefaultPowershell;
        
        // Apply default language/mode from preferences if in initial state
        if (isInitialState && activeTabId) {
          const newLanguage = mergedPrefs.defaultLanguage;
          const newMode = mergedPrefs.defaultMode;
          const newScript = newLanguage === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE;
          const extension = newLanguage === 'groovy' ? '.groovy' : '.ps1';
          
          // Update the active tab with new language, mode, and content
          set({ 
            preferences: mergedPrefs,
            tabs: tabs.map(t => 
              t.id === activeTabId
                ? { 
                    ...t, 
                    language: newLanguage, 
                    mode: newMode, 
                    content: newScript,
                    displayName: t.displayName.replace(/\.(groovy|ps1)$/, extension),
                  }
                : t
            ),
          });
        } else {
          set({ preferences: mergedPrefs });
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  },

  savePreferences: async () => {
    try {
      const { preferences } = get();
      await chrome.storage.local.set({ [STORAGE_KEYS.PREFERENCES]: preferences });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  },

  // Execution history actions
  addToHistory: (entry) => {
    const { executionHistory, preferences } = get();
    const newEntry: ExecutionHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    // Add to beginning, limit to max size
    const updatedHistory = [newEntry, ...executionHistory].slice(0, preferences.maxHistorySize);
    set({ executionHistory: updatedHistory });
    
    // Persist to storage
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updatedHistory }).catch(console.error);
  },

  clearHistory: () => {
    set({ executionHistory: [] });
    chrome.storage.local.remove(STORAGE_KEYS.HISTORY).catch(console.error);
  },

  loadHistory: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
      const storedHistory = result[STORAGE_KEYS.HISTORY] as ExecutionHistoryEntry[] | undefined;
      if (storedHistory) {
        set({ executionHistory: storedHistory });
      }
    } catch (error) {
      console.error('Failed to load execution history:', error);
    }
  },

  reloadFromHistory: (entry) => {
    const extension = entry.language === 'groovy' ? 'groovy' : 'ps1';
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const displayName = `History ${timestamp}.${extension}`;
    
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName,
      content: entry.script,
      language: entry.language,
      mode: entry.mode,
      source: {
        type: 'history',
      },
      contextOverride: entry.hostname ? {
        hostname: entry.hostname,
        collectorId: entry.collectorId,
      } : undefined,
    };
    
    const { tabs } = get();
    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
      hostname: entry.hostname || '',
      executionHistoryOpen: false,
    });
  },

  // API Explorer actions
  openApiExplorerTab: () => {
    const { tabs } = get();
    const newTab = createDefaultApiTab();
    const baseName = 'API Request';
    let displayName = baseName;
    let counter = 2;
    while (tabs.some(tab => tab.displayName === displayName)) {
      displayName = `${baseName} ${counter}`;
      counter += 1;
    }
    newTab.displayName = displayName;
    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
    });
    return newTab.id;
  },

  updateApiTabRequest: (tabId, request) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(tab => {
        if (tab.id !== tabId || tab.kind !== 'api') return tab;
        const currentRequest = { ...DEFAULT_API_REQUEST, ...(tab.api?.request ?? {}) };
        return {
          ...tab,
          api: {
            ...(tab.api ?? { request: currentRequest }),
            request: {
              ...currentRequest,
              ...request,
            },
          },
        };
      }),
    });
  },

  setApiTabResponse: (tabId, response) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(tab => {
        if (tab.id !== tabId || tab.kind !== 'api') return tab;
        return {
          ...tab,
          api: {
            ...(tab.api ?? { request: DEFAULT_API_REQUEST }),
            response: response ?? undefined,
          },
        };
      }),
    });
  },

  executeApiRequest: async (tabId) => {
    const { tabs, activeTabId, selectedPortalId, preferences, apiEnvironmentsByPortal } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return;

    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab || tab.kind !== 'api' || !tab.api) return;

    if (!selectedPortalId) {
      toast.error('Select a portal to send API requests.');
      return;
    }

    const request = tab.api.request;
    const envVars = apiEnvironmentsByPortal[selectedPortalId]?.variables ?? [];
    const resolveValue = buildApiVariableResolver(envVars);

    const baseRequest: ApiRequestSpec = { ...DEFAULT_API_REQUEST, ...request };
    const resolvedRequest: ApiRequestSpec = {
      ...baseRequest,
      path: resolveValue(baseRequest.path),
      body: resolveValue(baseRequest.body),
      queryParams: Object.fromEntries(
        Object.entries(baseRequest.queryParams).map(([key, value]) => [key, resolveValue(value)])
      ),
      headerParams: Object.fromEntries(
        Object.entries(baseRequest.headerParams).map(([key, value]) => [key, resolveValue(value)])
      ),
    };

    set({ isExecutingApi: true });
    const startedAt = Date.now();

    const executeSingle = async (req: ApiRequestSpec): Promise<ExecuteApiResponse> => {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_API_REQUEST',
        payload: {
          portalId: selectedPortalId,
          method: req.method,
          path: req.path,
          queryParams: req.queryParams,
          headerParams: req.headerParams,
          body: req.body,
          contentType: req.contentType,
        } satisfies ExecuteApiRequest,
      });

      if (response?.type === 'API_RESPONSE') {
        return response.payload as ExecuteApiResponse;
      }
      if (response?.type === 'ERROR') {
        throw new Error(response.payload?.message ?? 'API request failed.');
      }
      throw new Error('Unexpected response from API executor.');
    };

    try {
      let finalPayload: ExecuteApiResponse | null = null;
      let finalBody = '';

      let truncationReason: string | undefined;
      let truncationMeta: ApiResponseSummary['truncationMeta'];

      if (resolvedRequest.pagination.enabled) {
        const sizeParam = resolvedRequest.pagination.sizeParam || 'size';
        const offsetParam = resolvedRequest.pagination.offsetParam || 'offset';
        const pageSize = Math.max(25, resolvedRequest.pagination.pageSize || 25);
        const maxPages = 50;
        let offset = 0;
        let total: number | null = null;
        const capEnabled = preferences.apiResponseSizeLimit > 0;
        const limit = capEnabled ? preferences.apiResponseSizeLimit : Number.POSITIVE_INFINITY;
        let aggregationState = { items: [] as unknown[], estimatedBytes: 0, truncated: false };
        let pagesFetched = 0;

        for (let page = 0; page < maxPages; page += 1) {
          const pagedRequest: ApiRequestSpec = {
            ...resolvedRequest,
            queryParams: {
              ...resolvedRequest.queryParams,
              [sizeParam]: String(pageSize),
              [offsetParam]: String(offset),
            },
          };

          const payload = await executeSingle(pagedRequest);
          finalPayload = payload;
          finalBody = payload.body;
          pagesFetched += 1;

          let parsed: any;
          try {
            parsed = JSON.parse(payload.body);
          } catch {
            break;
          }

          const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed?.data) ? parsed.data : null;
          if (!items) {
            break;
          }

          if (capEnabled) {
            aggregationState = appendItemsWithLimit(aggregationState, items, limit);
          } else {
            aggregationState.items.push(...items);
          }
          if (typeof parsed?.total === 'number') {
            total = parsed.total;
          }

          if (aggregationState.truncated) {
            truncationReason = 'size_limit';
            break;
          }

          if (items.length < pageSize) {
            break;
          }

          offset += pageSize;
          if (total !== null && offset >= total) {
            break;
          }
        }

        if (finalPayload && aggregationState.items.length > 0) {
          if (!truncationReason && pagesFetched >= maxPages) {
            const hasMorePages = total !== null ? offset < total : true;
            if (hasMorePages) {
              truncationReason = 'max_pages';
            }
          }
          if (truncationReason) {
            truncationMeta = {
              itemsFetched: aggregationState.items.length,
              pagesFetched,
              limit: preferences.apiResponseSizeLimit,
            };
          }

          const aggregated = {
            items: aggregationState.items,
            total: total ?? aggregationState.items.length,
            pageSize,
            pages: Math.ceil((total ?? aggregationState.items.length) / pageSize),
            ...(truncationReason ? {
              _meta: {
                truncated: true,
                reason: truncationReason,
                itemsFetched: aggregationState.items.length,
                pagesFetched,
                limit: preferences.apiResponseSizeLimit,
              },
            } : {}),
          };
          finalBody = JSON.stringify(aggregated, null, 2);
        }
      } else {
        finalPayload = await executeSingle(resolvedRequest);
        finalBody = finalPayload.body;
      }

      if (!finalPayload) {
        throw new Error('No API response received.');
      }

      let jsonPreview: unknown | undefined;
      try {
        const parsed = JSON.parse(finalBody);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed)) {
            jsonPreview = parsed.slice(0, 20);
          } else {
            jsonPreview = Object.fromEntries(Object.entries(parsed).slice(0, 50));
          }
        }
      } catch {
        jsonPreview = undefined;
      }

      const limit = preferences.apiResponseSizeLimit;
      const trimmedBody = limit > 0 && finalBody.length > limit
        ? finalBody.slice(0, limit)
        : finalBody;

      let effectiveTruncationReason = truncationReason;
      let effectiveTruncationMeta = truncationMeta;
      if (!effectiveTruncationReason && limit > 0 && finalBody.length > limit) {
        effectiveTruncationReason = 'size_limit';
        effectiveTruncationMeta = undefined;
      }

      const summary: ApiResponseSummary = {
        status: finalPayload.status,
        headers: finalPayload.headers,
        body: trimmedBody,
        jsonPreview,
        durationMs: Date.now() - startedAt,
        timestamp: Date.now(),
        truncated: Boolean(effectiveTruncationReason),
        truncationReason: effectiveTruncationReason,
        truncationMeta: effectiveTruncationMeta,
      };

      set({
        tabs: tabs.map(t => 
          t.id === targetTabId
            ? {
              ...t,
              api: {
                ...(t.api ?? { request }),
                response: summary,
              },
            }
            : t
        ),
      });

      get().addApiHistoryEntry(selectedPortalId, {
        portalId: selectedPortalId,
        request: resolvedRequest,
        response: summary,
      });
    } catch (error) {
      console.error('Failed to execute API request:', error);
      toast.error(error instanceof Error ? error.message : 'API request failed.');
    } finally {
      set({ isExecutingApi: false });
    }
  },

  addApiHistoryEntry: (portalId, entry) => {
    const { apiHistoryByPortal, preferences } = get();
    const existing = apiHistoryByPortal[portalId] ?? [];
    const newEntry: ApiHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      portalId,
    };
    const updatedPortalHistory = [newEntry, ...existing].slice(0, preferences.apiHistoryLimit);
    const updatedHistory = {
      ...apiHistoryByPortal,
      [portalId]: updatedPortalHistory,
    };
    set({ apiHistoryByPortal: updatedHistory });
    chrome.storage.local.set({ [STORAGE_KEYS.API_HISTORY]: updatedHistory }).catch(console.error);
  },

  clearApiHistory: (portalId) => {
    const { apiHistoryByPortal } = get();
    if (portalId) {
      const updated = { ...apiHistoryByPortal };
      delete updated[portalId];
      set({ apiHistoryByPortal: updated });
      chrome.storage.local.set({ [STORAGE_KEYS.API_HISTORY]: updated }).catch(console.error);
      return;
    }
    set({ apiHistoryByPortal: {} });
    chrome.storage.local.remove(STORAGE_KEYS.API_HISTORY).catch(console.error);
  },

  loadApiHistory: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.API_HISTORY);
      const stored = result[STORAGE_KEYS.API_HISTORY] as Record<string, ApiHistoryEntry[]> | undefined;
      if (stored) {
        set({ apiHistoryByPortal: stored });
      }
    } catch (error) {
      console.error('Failed to load API history:', error);
    }
  },

  setApiEnvironment: (portalId, variables) => {
    const envState: ApiEnvironmentState = {
      portalId,
      variables,
      lastModified: Date.now(),
    };
    const updated = {
      ...get().apiEnvironmentsByPortal,
      [portalId]: envState,
    };
    set({ apiEnvironmentsByPortal: updated });
    chrome.storage.local.set({ [STORAGE_KEYS.API_ENVIRONMENTS]: updated }).catch(console.error);
  },

  loadApiEnvironments: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.API_ENVIRONMENTS);
      const stored = result[STORAGE_KEYS.API_ENVIRONMENTS] as Record<string, ApiEnvironmentState> | undefined;
      if (stored) {
        set({ apiEnvironmentsByPortal: stored });
      }
    } catch (error) {
      console.error('Failed to load API environments:', error);
    }
  },

  // Draft actions
  saveDraft: async () => {
    try {
      const { tabs, activeTabId, hasSavedDraft } = get();
      
      // Normalize for comparison
      const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
      
      // Check if all tabs are default templates (nothing to save)
      const hasApiTabs = tabs.some(tab => tab.kind === 'api');
      const hasNonDefaultContent = hasApiTabs || tabs.some(tab => {
        if (tab.kind === 'api') return false;
        const normalizedContent = normalize(tab.content);
        const isDefaultGroovy = normalizedContent === normalize(DEFAULT_GROOVY_TEMPLATE);
        const isDefaultPowershell = normalizedContent === normalize(DEFAULT_POWERSHELL_TEMPLATE);
        return !isDefaultGroovy && !isDefaultPowershell;
      });
      
      // Skip saving if all tabs are default templates
      if (!hasNonDefaultContent && tabs.length <= 1) {
        // If there was a saved draft, clear it since we're back to default
        if (hasSavedDraft) {
          await chrome.storage.local.remove(STORAGE_KEYS.DRAFT_TABS);
          await chrome.storage.local.remove(STORAGE_KEYS.DRAFT);
          set({ hasSavedDraft: false });
        }
        return;
      }
      
      const draftTabs: DraftTabs = {
        tabs,
        activeTabId,
        lastModified: Date.now(),
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.DRAFT_TABS]: draftTabs });
      set({ hasSavedDraft: true });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  },

  loadDraft: async () => {
    try {
      // First try to load multi-tab draft
      const tabsResult = await chrome.storage.local.get(STORAGE_KEYS.DRAFT_TABS);
      if (tabsResult[STORAGE_KEYS.DRAFT_TABS]) {
        const draftTabs = tabsResult[STORAGE_KEYS.DRAFT_TABS] as DraftTabs;
        set({ hasSavedDraft: true });
        return draftTabs; // Return for dialog, don't auto-restore
      }
      
      // Fall back to legacy single-file draft
      const result = await chrome.storage.local.get(STORAGE_KEYS.DRAFT);
      if (result[STORAGE_KEYS.DRAFT]) {
        set({ hasSavedDraft: true });
        return result[STORAGE_KEYS.DRAFT] as DraftScript;
      }
      return null;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  },

  clearDraft: async () => {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.DRAFT);
      await chrome.storage.local.remove(STORAGE_KEYS.DRAFT_TABS);
      set({ hasSavedDraft: false });
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  },

  restoreDraft: (draft) => {
    // Create a tab from the legacy draft format
    const extension = draft.language === 'groovy' ? 'groovy' : 'ps1';
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName: `Recovered.${extension}`,
      content: draft.script,
      language: draft.language,
      mode: draft.mode,
    };
    
    set({
      tabs: [newTab],
      activeTabId: newTab.id,
      hostname: draft.hostname || '',
      hasSavedDraft: true, // Mark as having saved draft so auto-save will update it
    });
    // Don't call clearDraft here - let the auto-save overwrite instead
    // This prevents race conditions where clear happens before save
  },
  
  restoreDraftTabs: (draftTabs) => {
    set({
      tabs: draftTabs.tabs,
      activeTabId: draftTabs.activeTabId,
      hasSavedDraft: true, // Mark as having saved draft so auto-save will update it
    });
    // Don't call clearDraft here - let the auto-save overwrite instead
  },

  // File export action (uses download)
  exportToFile: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    const extension = activeTab.language === 'groovy' ? '.groovy' : '.ps1';
    const baseName = activeTab.displayName.replace(/\.(groovy|ps1)$/, '');
    const fileName = `${baseName}${extension}`;

    const blob = new Blob([activeTab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Right sidebar actions
  setRightSidebarOpen: (open) => {
    set({ rightSidebarOpen: open });
  },

  setRightSidebarTab: (tab) => {
    set({ rightSidebarTab: tab });
  },

  // Device properties actions
  fetchDeviceProperties: async (deviceId) => {
    const { selectedPortalId } = get();
    if (!selectedPortalId) return;

    const fetchingPortal = selectedPortalId;
    const fetchingDevice = deviceId;

    set({ isFetchingProperties: true, selectedDeviceId: deviceId });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEVICE_PROPERTIES',
        payload: { portalId: selectedPortalId, deviceId },
      });

      const current = get();
      if (current.selectedPortalId !== fetchingPortal || current.selectedDeviceId !== fetchingDevice) {
        return;
      }

      if (response?.type === 'DEVICE_PROPERTIES_LOADED') {
        set({ deviceProperties: response.payload, isFetchingProperties: false });
      } else {
        console.error('Failed to fetch device properties:', response);
        set({ deviceProperties: [], isFetchingProperties: false });
      }
    } catch (error) {
      console.error('Error fetching device properties:', error);
      const current = get();
      if (current.selectedPortalId !== fetchingPortal || current.selectedDeviceId !== fetchingDevice) {
        return;
      }
      set({ deviceProperties: [], isFetchingProperties: false });
    }
  },

  setPropertiesSearchQuery: (query) => {
    set({ propertiesSearchQuery: query });
  },

  clearDeviceProperties: () => {
    set({ deviceProperties: [], selectedDeviceId: null, propertiesSearchQuery: '', isFetchingProperties: false });
  },

  insertPropertyAccess: (propertyName) => {
    const { tabs, activeTabId, editorInstance } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    const accessorBase = activeTab.language === 'groovy' 
      ? `hostProps.get("${propertyName}")`
      : `$${propertyName
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .replace(/^(\d)/, '_$1')} = "##${propertyName.toUpperCase()}##"`;
    const accessor = `\n${accessorBase}`;
    
    if (editorInstance) {
      const selections = editorInstance.getSelections() ?? [];
      const targetSelections = selections.length > 0 ? selections : [editorInstance.getSelection()].filter(Boolean);
      if (targetSelections.length > 0) {
        editorInstance.executeEdits(
          'property-access',
          targetSelections.map((selection) => ({
            range: selection!,
            text: accessor,
            forceMoveMarkers: true,
          }))
        );
        editorInstance.focus();
        return;
      }
    }

    set({
      tabs: tabs.map(t =>
        t.id === activeTabId
          ? { ...t, content: t.content + '\n' + accessor }
          : t
      ),
    });
  },

  // Snippet library actions
  setSnippetsSearchQuery: (query) => {
    set({ snippetsSearchQuery: query });
  },

  setSnippetCategoryFilter: (filter) => {
    set({ snippetCategoryFilter: filter });
  },

  setSnippetLanguageFilter: (filter) => {
    set({ snippetLanguageFilter: filter });
  },

  setSnippetSourceFilter: (filter) => {
    set({ snippetSourceFilter: filter });
  },

  insertSnippet: (snippet) => {
    const { tabs, activeTabId, editorInstance } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    if (snippet.category === 'template') {
      // Templates replace the entire script
      const newLanguage = snippet.language === 'both' ? activeTab.language : snippet.language as 'groovy' | 'powershell';
      set({
        tabs: tabs.map(t => 
          t.id === activeTabId 
            ? { ...t, content: snippet.code, language: newLanguage }
            : t
        ),
      });
    } else {
      if (editorInstance) {
        const selections = editorInstance.getSelections() ?? [];
        const targetSelections = selections.length > 0 ? selections : [editorInstance.getSelection()].filter(Boolean);
        if (targetSelections.length > 0) {
          editorInstance.executeEdits(
            'snippet',
            targetSelections.map((selection) => ({
              range: selection!,
              text: snippet.code,
              forceMoveMarkers: true,
            }))
          );
          editorInstance.focus();
          return;
        }
      }

      set({
        tabs: tabs.map(t =>
          t.id === activeTabId
            ? { ...t, content: t.content + '\n\n' + snippet.code }
            : t
        ),
      });
    }
  },

  setCreateSnippetDialogOpen: (open) => {
    set({ createSnippetDialogOpen: open });
    if (!open) {
      set({ editingSnippet: null });
    }
  },

  setEditingSnippet: (snippet) => {
    set({ editingSnippet: snippet, createSnippetDialogOpen: snippet !== null });
  },

  createUserSnippet: (snippetData) => {
    const { userSnippets } = get();
    const newSnippet: Snippet = {
      ...snippetData,
      id: crypto.randomUUID(),
      isBuiltIn: false,
    };
    const updatedSnippets = [...userSnippets, newSnippet];
    set({ userSnippets: updatedSnippets, createSnippetDialogOpen: false });
    
    // Persist to storage
    chrome.storage.local.set({ [STORAGE_KEYS.USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  updateUserSnippet: (id, updates) => {
    const { userSnippets } = get();
    const updatedSnippets = userSnippets.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    set({ userSnippets: updatedSnippets, createSnippetDialogOpen: false, editingSnippet: null });
    
    // Persist to storage
    chrome.storage.local.set({ [STORAGE_KEYS.USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  deleteUserSnippet: (id) => {
    const { userSnippets } = get();
    const updatedSnippets = userSnippets.filter(s => s.id !== id);
    set({ userSnippets: updatedSnippets });
    
    // Persist to storage
    chrome.storage.local.set({ [STORAGE_KEYS.USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  loadUserSnippets: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_SNIPPETS);
      const storedSnippets = result[STORAGE_KEYS.USER_SNIPPETS] as Snippet[] | undefined;
      if (storedSnippets) {
        set({ userSnippets: storedSnippets });
      }
    } catch (error) {
      console.error('Failed to load user snippets:', error);
    }
  },

  // Cancel execution actions
  setCancelDialogOpen: (open) => {
    set({ cancelDialogOpen: open });
  },

  cancelExecution: async () => {
    const { currentExecutionId } = get();
    if (!currentExecutionId) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CANCEL_EXECUTION',
        payload: { executionId: currentExecutionId },
      });

      if (response?.success) {
        set({ 
          isExecuting: false, 
          cancelDialogOpen: false,
          currentExecution: {
            id: currentExecutionId,
            status: 'cancelled',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: 'Execution cancelled by user',
          },
        });
      }
    } catch (error) {
      console.error('Failed to cancel execution:', error);
    }
    
    set({ cancelDialogOpen: false });
  },

  // Tab management actions
  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId) ?? null;
  },

  openTab: (tabData) => {
    const id = tabData.id || crypto.randomUUID();
    const newTab: EditorTab = {
      id,
      kind: tabData.kind ?? 'script',
      displayName: tabData.displayName,
      content: tabData.content,
      language: tabData.language,
      mode: tabData.mode,
      source: tabData.source,
      contextOverride: tabData.contextOverride,
      api: tabData.api,
    };
    
    const { tabs } = get();
    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
    });
    
    return id;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, tabsNeedingPermission } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    
    // NOTE: We intentionally do NOT delete file handles when closing tabs.
    // This allows them to persist in "Recent Files" for the WelcomeScreen.
    // Handles are only deleted when opening a recent file that no longer exists.
    
    // Remove from permission-needed list if present
    const newTabsNeedingPermission = tabsNeedingPermission.filter(t => t.tabId !== tabId);
    
    // If we're closing the active tab, switch to another one
    let newActiveTabId: string | null = activeTabId;
    if (tabId === activeTabId) {
      if (newTabs.length === 0) {
        // No tabs left - WelcomeScreen will show
        newActiveTabId = null;
      } else {
        const targetKind = tab.kind ?? 'script';
        let nextTabId: string | null = null;

        // Prefer same-kind tab to the left
        for (let i = tabIndex - 1; i >= 0; i -= 1) {
          const candidate = tabs[i];
          if (candidate.id !== tabId && (candidate.kind ?? 'script') === targetKind) {
            nextTabId = candidate.id;
            break;
          }
        }

        // Otherwise, prefer same-kind tab to the right
        if (!nextTabId) {
          for (let i = tabIndex + 1; i < tabs.length; i += 1) {
            const candidate = tabs[i];
            if (candidate.id !== tabId && (candidate.kind ?? 'script') === targetKind) {
              nextTabId = candidate.id;
              break;
            }
          }
        }

        // Fallback: first available tab
        newActiveTabId = nextTabId ?? newTabs[0].id;
      }
    }
    
    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
      tabsNeedingPermission: newTabsNeedingPermission,
    });
  },

  closeOtherTabs: (tabId) => {
    const { tabs } = get();
    const tabToKeep = tabs.find(t => t.id === tabId);
    if (!tabToKeep) return;

    const targetKind = tabToKeep.kind ?? 'script';
    const remainingTabs = tabs.filter(t => (t.kind ?? 'script') !== targetKind || t.id === tabId);

    set({
      tabs: remainingTabs,
      activeTabId: tabId,
    });
  },

  closeAllTabs: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) {
      set({
        tabs: [],
        activeTabId: null,
      });
      return;
    }

    const targetKind = activeTab.kind ?? 'script';
    const remainingTabs = tabs.filter(t => (t.kind ?? 'script') !== targetKind);
    const nextActive = remainingTabs[0]?.id ?? null;

    set({
      tabs: remainingTabs,
      activeTabId: nextActive,
    });
  },

  setActiveTab: (tabId) => {
    const { tabs } = get();
    if (tabs.some(t => t.id === tabId)) {
      set({ activeTabId: tabId });
    }
  },

  renameTab: (tabId, newName) => {
    const { tabs } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // Ensure name has appropriate extension
    let displayName = newName.trim();
    if (!displayName) return;
    
    // Add extension if missing for script tabs
    if (tab.kind !== 'api' && !displayName.endsWith('.groovy') && !displayName.endsWith('.ps1')) {
      displayName += tab.language === 'groovy' ? '.groovy' : '.ps1';
    }
    
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, displayName }
          : t
      ),
    });
  },

  updateTabContent: (tabId, content) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, content }
          : t
      ),
    });
  },

  updateActiveTabContent: (content) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, content }
          : t
      ),
    });
  },

  setActiveTabLanguage: (language) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, language }
          : t
      ),
    });
  },

  setActiveTabMode: (mode) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, mode }
          : t
      ),
    });
  },

  setTabContextOverride: (tabId, override) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, contextOverride: override }
          : t
      ),
    });
  },

  openModuleScripts: (module, scripts) => {
    const { tabs } = get();
    const extension = module.scriptType === 'powerShell' ? 'ps1' : 'groovy';
    const language: ScriptLanguage = module.scriptType === 'powerShell' ? 'powershell' : 'groovy';
    
    const newTabs: EditorTab[] = scripts.map(script => {
      const scriptType: 'collection' | 'ad' = script.type === 'ad' ? 'ad' : 'collection';
      return {
        id: crypto.randomUUID(),
        displayName: `${module.name}/${script.type}.${extension}`,
        content: script.content,
        language,
        mode: script.type === 'ad' ? 'ad' as ScriptMode : (module.collectMethod === 'batchscript' ? 'batchcollection' : 'collection') as ScriptMode,
        originalContent: script.content, // Store original content for dirty detection
        source: {
          type: 'module' as const,
          moduleId: module.id,
          moduleName: module.name,
          moduleType: module.moduleType,
          scriptType,
          lineageId: module.lineageId,
        },
      };
    });
    
    // Add all new tabs and activate the first one
    set({
      tabs: [...tabs, ...newTabs],
      activeTabId: newTabs[0]?.id ?? get().activeTabId,
      moduleBrowserOpen: false,
      selectedModule: null,
      moduleSearchQuery: '',
    });
  },

  toggleRightSidebar: () => {
    set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen }));
  },

  // File operations (Phase 6 - File System Access API)
  openFileFromDisk: async () => {
    // Check if File System Access API is supported
    if (!fileHandleStore.isFileSystemAccessSupported()) {
      // Fallback to input element for unsupported browsers
      return new Promise<void>((resolve) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.groovy,.ps1,.txt';
        
        fileInput.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            resolve();
            return;
          }
          
          const content = await file.text();
          const fileName = file.name;
          const isGroovy = fileName.endsWith('.groovy');
          
          const newTab: EditorTab = {
            id: crypto.randomUUID(),
            displayName: fileName,
            content,
            language: isGroovy ? 'groovy' : 'powershell',
            mode: 'freeform',
            originalContent: content,
            hasFileHandle: false,
            isLocalFile: true,
            source: { type: 'file' },
          };
          
          set({
            tabs: [...get().tabs, newTab],
            activeTabId: newTab.id,
          });
          resolve();
        };
        
        fileInput.click();
      });
    }

    try {
      // Use File System Access API
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Script Files',
            accept: {
              'text/plain': ['.groovy', '.ps1', '.txt'],
            },
          },
        ],
        multiple: false,
      });
      
      // Read file content
      const file = await handle.getFile();
      const content = await file.text();
      const fileName = file.name;
      const isGroovy = fileName.endsWith('.groovy');
      
      // Generate tab ID
      const tabId = crypto.randomUUID();
      
      // Store handle in IndexedDB
      await fileHandleStore.saveHandle(tabId, handle, fileName);
      
      // Create new tab
      const newTab: EditorTab = {
        id: tabId,
        displayName: fileName,
        content,
        language: isGroovy ? 'groovy' : 'powershell',
        mode: 'freeform',
        originalContent: content,
        hasFileHandle: true,
        isLocalFile: true,
        source: { type: 'file' },
      };
      
      set({
        tabs: [...get().tabs, newTab],
        activeTabId: tabId,
      });
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Error opening file:', error);
      }
    }
  },

  saveFile: async (tabId?: string) => {
    const { tabs, activeTabId } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return false;
    
    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab) return false;

    try {
      // Check for existing handle
      const handle = await fileHandleStore.getHandle(targetTabId);
      
      if (handle) {
        // Check permission
        const permission = await fileHandleStore.queryPermission(handle);
        
        if (permission === 'granted') {
          // Direct save to existing file
          await fileHandleStore.writeToHandle(handle, tab.content);
          
          // Update lastAccessed timestamp for recent files
          await fileHandleStore.saveHandle(targetTabId, handle, tab.displayName);
          
          // Update originalContent to mark as clean
          // If this was a module tab being saved, convert it to a file tab
          set({
            tabs: tabs.map(t => 
              t.id === targetTabId 
                ? { 
                    ...t, 
                    originalContent: tab.content,
                    source: t.source?.type === 'module' ? { type: 'file' } : t.source,
                  }
                : t
            ),
          });
          return true;
        } else if (permission === 'prompt') {
          // Need to request permission
          const granted = await fileHandleStore.requestPermission(handle);
          if (granted) {
            await fileHandleStore.writeToHandle(handle, tab.content);
            
            // Update lastAccessed timestamp for recent files
            await fileHandleStore.saveHandle(targetTabId, handle, tab.displayName);
            
            set({
              tabs: tabs.map(t => 
                t.id === targetTabId 
                  ? { 
                      ...t, 
                      originalContent: tab.content,
                      source: t.source?.type === 'module' ? { type: 'file' } : t.source,
                    }
                  : t
              ),
            });
            return true;
          }
        }
        
        // Permission denied - fall through to Save As
      }
      
      // No handle or permission denied - trigger Save As
      return await get().saveFileAs(targetTabId);
    } catch (error) {
      console.error('Error saving file:', error);
      // Fall back to Save As on error
      return await get().saveFileAs(targetTabId);
    }
  },

  saveFileAs: async (tabId?: string) => {
    const { tabs, activeTabId } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return false;
    
    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab) return false;

    // Check if File System Access API is supported
    if (!fileHandleStore.isFileSystemAccessSupported()) {
      // Fallback to download
      get().exportToFile();
      return true;
    }

    try {
      const extension = tab.language === 'groovy' ? '.groovy' : '.ps1';
      const baseName = tab.displayName.replace(/\.(groovy|ps1)$/, '');
      const suggestedName = baseName + extension;
      
      // Show save picker
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Script Files',
            accept: tab.language === 'groovy' 
              ? { 'text/plain': ['.groovy'] }
              : { 'text/plain': ['.ps1'] },
          },
        ],
      });
      
      // Write content
      await fileHandleStore.writeToHandle(handle, tab.content);
      
      // Store new handle in IndexedDB
      await fileHandleStore.saveHandle(targetTabId, handle, handle.name);
      
      // Update tab state
      set({
        tabs: tabs.map(t => 
          t.id === targetTabId 
            ? { 
                ...t, 
                displayName: handle.name,
                originalContent: tab.content,
                hasFileHandle: true,
                isLocalFile: true,
                source: { type: 'file' }, // Change from 'module' to 'file' when saved locally
              }
            : t
        ),
      });
      
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error in Save As:', error);
      }
      return false;
    }
  },

  restoreFileHandles: async () => {
    set({ isRestoringFileHandles: true });
    
    try {
      const { tabs } = get();
      const storedHandles = await fileHandleStore.getAllHandles();
      const needsPermission: FilePermissionStatus[] = [];
      
      // Check permission for each handle that matches a currently open tab
      // NOTE: We do NOT delete handles for tabs that don't exist - those are
      // needed for the recent files list. Cleanup is handled by cleanupOldHandles()
      // in file-handle-store.ts based on age and count limits.
      for (const [tabId, record] of storedHandles) {
        // Only process handles for tabs that are currently open
        const tabExists = tabs.some(t => t.id === tabId);
        if (!tabExists) {
          // Skip handles for closed tabs - keep them for recent files
          continue;
        }
        
        const permission = await fileHandleStore.queryPermission(record.handle);
        
        if (permission === 'prompt') {
          needsPermission.push({
            tabId,
            fileName: record.fileName,
            state: 'prompt',
          });
        } else if (permission === 'denied') {
          // Update tab to reflect no handle access
          set({
            tabs: get().tabs.map(t => 
              t.id === tabId 
                ? { ...t, hasFileHandle: false }
                : t
            ),
          });
        }
        // If granted, handle is ready to use - no action needed
      }
      
      set({ 
        tabsNeedingPermission: needsPermission,
        isRestoringFileHandles: false,
      });
    } catch (error) {
      console.error('Error restoring file handles:', error);
      set({ isRestoringFileHandles: false });
    }
  },

  requestFilePermissions: async () => {
    const { tabsNeedingPermission, tabs } = get();
    const stillNeedsPermission: FilePermissionStatus[] = [];
    
    for (const status of tabsNeedingPermission) {
      try {
        const handle = await fileHandleStore.getHandle(status.tabId);
        if (!handle) continue;
        
        const granted = await fileHandleStore.requestPermission(handle);
        
        if (granted) {
          // Optionally re-read file content to check for external changes
          try {
            const newContent = await fileHandleStore.readFromHandle(handle);
            const tab = tabs.find(t => t.id === status.tabId);
            
            if (tab && tab.originalContent !== newContent) {
              // File was modified externally - update originalContent
              // Keep user's current edits, but update the baseline
              set({
                tabs: get().tabs.map(t => 
                  t.id === status.tabId 
                    ? { ...t, originalContent: newContent, hasFileHandle: true }
                    : t
                ),
              });
            } else {
              // Just mark as having handle
              set({
                tabs: get().tabs.map(t => 
                  t.id === status.tabId 
                    ? { ...t, hasFileHandle: true }
                    : t
                ),
              });
            }
          } catch {
            // File might have been deleted - just mark handle as available
            set({
              tabs: get().tabs.map(t => 
                t.id === status.tabId 
                  ? { ...t, hasFileHandle: true }
                  : t
              ),
            });
          }
        } else {
          stillNeedsPermission.push(status);
        }
      } catch {
        stillNeedsPermission.push(status);
      }
    }
    
    set({ tabsNeedingPermission: stillNeedsPermission });
  },

  isTabDirty: (tabId: string) => {
    const tab = get().tabs.find(t => t.id === tabId);
    if (!tab) return false;
    return get().getTabDirtyState(tab);
  },

  getTabDirtyState: (tab: EditorTab) => {
    if (tab.kind === 'api') {
      return false;
    }

    // New file without originalContent is always "dirty" (never saved)
    if (tab.originalContent === undefined) {
      return true;
    }
    
    // Compare current content to original
    return tab.content !== tab.originalContent;
  },

  // Welcome screen actions
  loadRecentFiles: async () => {
    set({ isLoadingRecentFiles: true });
    try {
      const recentFiles = await fileHandleStore.getRecentHandles(10);
      set({ recentFiles, isLoadingRecentFiles: false });
    } catch (error) {
      console.error('Failed to load recent files:', error);
      set({ recentFiles: [], isLoadingRecentFiles: false });
    }
  },

  openRecentFile: async (tabId: string) => {
    try {
      const handle = await fileHandleStore.getHandle(tabId);
      if (!handle) {
        console.warn('File handle not found for tabId:', tabId);
        // Remove from recent files since handle is gone
        await fileHandleStore.deleteHandle(tabId);
        get().loadRecentFiles();
        return;
      }

      // Check permission
      let permission = await fileHandleStore.queryPermission(handle);
      if (permission !== 'granted') {
        permission = (await fileHandleStore.requestPermission(handle)) ? 'granted' : 'denied';
      }

      if (permission !== 'granted') {
        console.warn('Permission denied for file:', handle.name);
        return;
      }

      // Read file content
      const content = await fileHandleStore.readFromHandle(handle);
      const fileName = handle.name;
      const language: ScriptLanguage = fileName.endsWith('.ps1') ? 'powershell' : 'groovy';

      // Update lastAccessed
      await fileHandleStore.saveHandle(tabId, handle, fileName);

      // Create new tab with the file content
      const newTab: EditorTab = {
        id: tabId, // Reuse the same tabId so handle mapping is preserved
        displayName: fileName,
        content,
        language,
        mode: 'freeform',
        originalContent: content,
        hasFileHandle: true,
        isLocalFile: true,
      };

      set({
        tabs: [...get().tabs, newTab],
        activeTabId: tabId,
      });
    } catch (error) {
      console.error('Failed to open recent file:', error);
    }
  },

  createNewFile: () => {
    const { preferences } = get();
    const language = preferences.defaultLanguage || 'groovy';
    const mode = preferences.defaultMode || 'freeform';
    const newTab = createDefaultTab(language, mode);
    
    set({
      tabs: [...get().tabs, newTab],
      activeTabId: newTab.id,
    });
  },
  
  // AppliesTo tester actions
  setAppliesToTesterOpen: (open: boolean) => {
    set({ appliesToTesterOpen: open });
    // Clear error when opening
    if (open) {
      set({ appliesToError: null });
    }
  },
  
  setAppliesToExpression: (expression: string) => {
    set({ appliesToExpression: expression });
  },
  
  setAppliesToTestFrom: (testFrom: 'devicesGroup' | 'websiteGroup') => {
    set({ appliesToTestFrom: testFrom });
  },
  
  testAppliesTo: async () => {
    const { selectedPortalId, appliesToExpression, appliesToTestFrom } = get();
    
    if (!selectedPortalId) {
      set({ appliesToError: 'Please select a portal first' });
      return;
    }
    
    if (!appliesToExpression.trim()) {
      set({ appliesToError: 'Please enter an AppliesTo expression' });
      return;
    }
    
    set({ isTestingAppliesTo: true, appliesToError: null, appliesToResults: [] });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_APPLIES_TO',
        payload: {
          portalId: selectedPortalId,
          currentAppliesTo: appliesToExpression,
          testFrom: appliesToTestFrom,
        },
      });
      
      if (response?.type === 'APPLIES_TO_RESULT') {
        set({ 
          appliesToResults: response.payload.currentMatches || [],
          appliesToError: response.payload.warnMessage || null,
          isTestingAppliesTo: false,
        });
      } else if (response?.type === 'APPLIES_TO_ERROR') {
        set({ 
          appliesToError: response.payload.errorMessage,
          appliesToResults: [],
          isTestingAppliesTo: false,
        });
      } else {
        set({ 
          appliesToError: 'Unknown error occurred',
          isTestingAppliesTo: false,
        });
      }
    } catch (error) {
      set({ 
        appliesToError: error instanceof Error ? error.message : 'Failed to test AppliesTo',
        isTestingAppliesTo: false,
      });
    }
  },
  
  clearAppliesToResults: () => {
    set({ 
      appliesToResults: [],
      appliesToError: null,
    });
  },
  
  setAppliesToFunctionSearch: (query: string) => {
    set({ appliesToFunctionSearch: query });
  },
  
  // Custom AppliesTo functions actions
  fetchCustomFunctions: async () => {
    const { selectedPortalId } = get();
    
    if (!selectedPortalId) {
      set({ customFunctionError: 'Please select a portal first' });
      return;
    }
    
    set({ isLoadingCustomFunctions: true, customFunctionError: null });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_CUSTOM_FUNCTIONS',
        payload: { portalId: selectedPortalId },
      });
      
      if (response?.type === 'CUSTOM_FUNCTIONS_LOADED') {
        set({ 
          customFunctions: response.payload,
          isLoadingCustomFunctions: false,
        });
      } else if (response?.type === 'CUSTOM_FUNCTION_ERROR') {
        set({ 
          customFunctionError: response.payload.error,
          isLoadingCustomFunctions: false,
        });
      } else {
        set({ 
          customFunctionError: 'Unknown error occurred',
          isLoadingCustomFunctions: false,
        });
      }
    } catch (error) {
      set({ 
        customFunctionError: error instanceof Error ? error.message : 'Failed to fetch custom functions',
        isLoadingCustomFunctions: false,
      });
    }
  },
  
  createCustomFunction: async (name: string, code: string, description?: string) => {
    const { selectedPortalId } = get();
    
    if (!selectedPortalId) {
      throw new Error('Please select a portal first');
    }
    
    set({ isCreatingFunction: true, customFunctionError: null });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_CUSTOM_FUNCTION',
        payload: { portalId: selectedPortalId, name, code, description },
      });
      
      if (response?.type === 'CUSTOM_FUNCTION_CREATED') {
        set({ 
          customFunctions: [...get().customFunctions, response.payload],
          isCreatingFunction: false,
        });
      } else if (response?.type === 'CUSTOM_FUNCTION_ERROR') {
        const error = response.payload.error;
        set({ 
          customFunctionError: error,
          isCreatingFunction: false,
        });
        throw new Error(error);
      } else {
        const error = 'Unknown error occurred';
        set({ 
          customFunctionError: error,
          isCreatingFunction: false,
        });
        throw new Error(error);
      }
    } catch (error) {
      set({ isCreatingFunction: false });
      throw error;
    }
  },
  
  updateCustomFunction: async (id: number, name: string, code: string, description?: string) => {
    const { selectedPortalId } = get();
    
    if (!selectedPortalId) {
      throw new Error('Please select a portal first');
    }
    
    set({ isUpdatingFunction: true, customFunctionError: null });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_CUSTOM_FUNCTION',
        payload: { portalId: selectedPortalId, functionId: id, name, code, description },
      });
      
      if (response?.type === 'CUSTOM_FUNCTION_UPDATED') {
        set({ 
          customFunctions: get().customFunctions.map(f => 
            f.id === id ? response.payload : f
          ),
          isUpdatingFunction: false,
        });
      } else if (response?.type === 'CUSTOM_FUNCTION_ERROR') {
        const error = response.payload.error;
        set({ 
          customFunctionError: error,
          isUpdatingFunction: false,
        });
        throw new Error(error);
      } else {
        const error = 'Unknown error occurred';
        set({ 
          customFunctionError: error,
          isUpdatingFunction: false,
        });
        throw new Error(error);
      }
    } catch (error) {
      set({ isUpdatingFunction: false });
      throw error;
    }
  },
  
  deleteCustomFunction: async (id: number) => {
    const { selectedPortalId } = get();
    
    if (!selectedPortalId) {
      throw new Error('Please select a portal first');
    }
    
    set({ isDeletingFunction: true, customFunctionError: null });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_CUSTOM_FUNCTION',
        payload: { portalId: selectedPortalId, functionId: id },
      });
      
      if (response?.type === 'CUSTOM_FUNCTION_DELETED') {
        set({ 
          customFunctions: get().customFunctions.filter(f => f.id !== id),
          isDeletingFunction: false,
        });
      } else if (response?.type === 'CUSTOM_FUNCTION_ERROR') {
        const error = response.payload.error;
        set({ 
          customFunctionError: error,
          isDeletingFunction: false,
        });
        throw new Error(error);
      } else {
        const error = 'Unknown error occurred';
        set({ 
          customFunctionError: error,
          isDeletingFunction: false,
        });
        throw new Error(error);
      }
    } catch (error) {
      set({ isDeletingFunction: false });
      throw error;
    }
  },
  
  setModuleCommitConfirmationOpen: (open: boolean) => {
    set({ moduleCommitConfirmationOpen: open });
    if (!open) {
      set({ loadedModuleForCommit: null, moduleCommitError: null });
    }
  },

  setModuleLineageDialogOpen: (open: boolean) => {
    set({ moduleLineageDialogOpen: open });
    if (!open) {
      set({ lineageVersions: [], lineageError: null });
    }
  },

  // Module details actions
  setModuleDetailsDialogOpen: (open: boolean) => {
    set({ moduleDetailsDialogOpen: open });
    if (!open) {
      set({ moduleDetailsError: null });
    }
  },

  loadModuleDetails: async (tabId: string) => {
    const { tabs, selectedPortalId } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab || !selectedPortalId) {
      set({ moduleDetailsError: 'Tab not found or portal not selected' });
      return;
    }

    if (tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType) {
      set({ moduleDetailsError: 'Tab is not a module tab' });
      return;
    }

    const existingDraft = findModuleDraftForTab(get().moduleDetailsDraftByTabId, tabs, tabId);
    if (existingDraft) {
      set({
        moduleDetailsDraftByTabId: {
          ...get().moduleDetailsDraftByTabId,
          [tabId]: {
            ...existingDraft,
            dirtyFields: new Set(existingDraft.dirtyFields),
            tabId,
          },
        },
      });
      return;
    }

    set({ moduleDetailsLoading: true, moduleDetailsError: null });

    try {
      // Get portal info for CSRF token
      const portal = get().portals.find(p => p.id === selectedPortalId);
      if (!portal) {
        throw new Error('Portal not found');
      }

      // Get current tab for CSRF token
      const currentTabs = await chrome.tabs.query({ url: `https://${portal.hostname}/*` });
      if (currentTabs.length === 0) {
        throw new Error('No LogicMonitor tab found');
      }
      const lmTab = currentTabs[0];
      if (!lmTab.id) {
        throw new Error('Invalid tab ID');
      }

      // Get CSRF token from portal manager
      // Fetch module details
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULE_DETAILS',
        payload: {
          portalId: selectedPortalId,
          moduleType: tab.source.moduleType,
          moduleId: tab.source.moduleId,
          tabId: lmTab.id,
        },
      });

      if (response?.type === 'MODULE_DETAILS_FETCHED') {
        const module = response.payload.module;
        
        // Extract metadata fields only
        const metadata = {
          id: module.id,
          name: module.name || '',
          displayName: module.displayName,
          description: module.description,
          appliesTo: module.appliesTo,
          group: module.group,
          technology: module.technology,
          tags: module.tags,
          collectInterval: module.collectInterval,
          accessGroupIds: module.accessGroupIds,
          version: module.version,
          enableAutoDiscovery: module.enableAutoDiscovery,
          autoDiscoveryConfig: module.autoDiscoveryConfig,
          dataPoints: module.dataPoints || [],
        };

        // Initialize draft
        const draft = { ...metadata };
        const dirtyFields = new Set<string>();

        const moduleTabIds = getModuleTabIds(get().tabs, tabId);
        const updatedDrafts = { ...get().moduleDetailsDraftByTabId };
        moduleTabIds.forEach((id) => {
          updatedDrafts[id] = {
            original: metadata,
            draft,
            dirtyFields: new Set(dirtyFields),
            loadedAt: Date.now(),
            tabId: id,
            moduleId: tab.source.moduleId,
            moduleType: tab.source.moduleType,
            version: module.version || 0,
          };
        });

        set({
          moduleDetailsDraftByTabId: updatedDrafts,
          moduleDetailsLoading: false,
        });
      } else if (response?.type === 'MODULE_DETAILS_ERROR') {
        const error = response.payload.error || 'Failed to fetch module details';
        set({ moduleDetailsError: error, moduleDetailsLoading: false });
      } else {
        set({ moduleDetailsError: 'Unknown error occurred', moduleDetailsLoading: false });
      }
    } catch (error) {
      console.error('[loadModuleDetails] Error:', error);
      set({ 
        moduleDetailsError: error instanceof Error ? error.message : 'Failed to load module details',
        moduleDetailsLoading: false,
      });
    }
  },

  updateModuleDetailsField: (tabId: string, field: string, value: unknown) => {
    const draft = get().moduleDetailsDraftByTabId[tabId];
    if (!draft) return;

    const normalizedValue = field === 'accessGroupIds' ? normalizeAccessGroupIds(value) : value;
    const newDraft = { ...draft.draft, [field]: normalizedValue };
    const newDirtyFields = new Set(draft.dirtyFields);
    
    // Check if value changed from original
    const originalValue = draft.original?.[field as keyof typeof draft.original];
    let isDirty = false;
    if (field === 'accessGroupIds') {
      const originalIds = normalizeAccessGroupIds(originalValue);
      const currentIds = normalizeAccessGroupIds(normalizedValue);
      isDirty = !deepEqual(originalIds, currentIds);
    } else if (field === 'autoDiscoveryConfig') {
      isDirty = !deepEqual(originalValue, normalizedValue);
    } else {
      isDirty = !Object.is(originalValue, normalizedValue);
    }

    if (isDirty) {
      newDirtyFields.add(field);
    } else {
      newDirtyFields.delete(field);
    }

    const moduleTabIds = getModuleTabIds(get().tabs, tabId);
    const updatedDrafts = { ...get().moduleDetailsDraftByTabId };
    moduleTabIds.forEach((id) => {
      updatedDrafts[id] = {
        ...draft,
        draft: newDraft,
        dirtyFields: new Set(newDirtyFields),
        tabId: id,
      };
    });

    set({ moduleDetailsDraftByTabId: updatedDrafts });
  },

  resetModuleDetailsDraft: (tabId: string) => {
    const draft = get().moduleDetailsDraftByTabId[tabId];
    if (!draft) return;

    const moduleTabIds = getModuleTabIds(get().tabs, tabId);
    const updatedDrafts = { ...get().moduleDetailsDraftByTabId };
    moduleTabIds.forEach((id) => {
      updatedDrafts[id] = {
        ...draft,
        draft: draft.original ? { ...draft.original } : {},
        dirtyFields: new Set<string>(),
        tabId: id,
      };
    });

    set({ moduleDetailsDraftByTabId: updatedDrafts });
  },

  fetchAccessGroups: async () => {
    const { selectedPortalId } = get();
    
    if (!selectedPortalId) {
      set({ moduleDetailsError: 'Please select a portal first' });
      return;
    }

    set({ isLoadingAccessGroups: true });

    try {
      // Get portal info
      const portal = get().portals.find(p => p.id === selectedPortalId);
      if (!portal) {
        throw new Error('Portal not found');
      }

      // Get current tab for CSRF token
      const currentTabs = await chrome.tabs.query({ url: `https://${portal.hostname}/*` });
      if (currentTabs.length === 0) {
        throw new Error('No LogicMonitor tab found');
      }
      const lmTab = currentTabs[0];
      if (!lmTab.id) {
        throw new Error('Invalid tab ID');
      }

      // Get CSRF token from portal manager
      // Fetch access groups
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_ACCESS_GROUPS',
        payload: {
          portalId: selectedPortalId,
          tabId: lmTab.id,
        },
      });

      if (response?.type === 'ACCESS_GROUPS_FETCHED') {
        set({ 
          accessGroups: response.payload.accessGroups || [],
          isLoadingAccessGroups: false,
        });
      } else if (response?.type === 'ACCESS_GROUPS_ERROR') {
        const error = response.payload.error || 'Failed to fetch access groups';
        set({ moduleDetailsError: error, isLoadingAccessGroups: false });
      } else {
        set({ moduleDetailsError: 'Unknown error occurred', isLoadingAccessGroups: false });
      }
    } catch (error) {
      console.error('[fetchAccessGroups] Error:', error);
      set({ 
        moduleDetailsError: error instanceof Error ? error.message : 'Failed to fetch access groups',
        isLoadingAccessGroups: false,
      });
    }
  },

  canCommitModule: (tabId: string) => {
    const tab = get().tabs.find(t => t.id === tabId);
    if (!tab) return false;
    if (tab.source?.type !== 'module') return false;
    if (!get().selectedPortalId) return false;
    
    // Check for script changes
    const hasScriptChanges = get().getTabDirtyState(tab);
    
    // Check for module details changes
    const moduleDetailsDraft = get().moduleDetailsDraftByTabId[tabId];
    const hasModuleDetailsChanges = moduleDetailsDraft && moduleDetailsDraft.dirtyFields.size > 0;
    
    // Can commit if either scripts or module details have changes
    return hasScriptChanges || hasModuleDetailsChanges;
  },

  fetchModuleForCommit: async (tabId: string) => {
    const { tabs, selectedPortalId } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab || !selectedPortalId) {
      throw new Error('Tab not found or portal not selected');
    }
    
    if (tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType || !tab.source.scriptType) {
      throw new Error('Tab is not a module tab');
    }
    
    set({ moduleCommitError: null });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId: selectedPortalId,
          moduleType: tab.source.moduleType,
          moduleId: tab.source.moduleId,
        },
      });
      
      if (response?.type === 'MODULE_FETCHED') {
        // Extract module info from the fetched module
        const module = response.payload;
        
        // Extract the current script from the module based on type and script type
        let currentScript = '';
        if (tab.source.scriptType === 'ad') {
          currentScript = module.autoDiscoveryConfig?.method?.groovyScript || '';
        } else {
          // Collection script
          if (
            tab.source.moduleType === 'propertysource' ||
            tab.source.moduleType === 'diagnosticsource' ||
            tab.source.moduleType === 'eventsource'
          ) {
            currentScript = module.groovyScript || '';
          } else if (tab.source.moduleType === 'logsource') {
            currentScript = module.collectionAttribute?.script?.embeddedContent
              || module.collectionAttribute?.groovyScript
              || '';
          } else {
            // DataSource, ConfigSource, TopologySource
            currentScript = module.collectorAttribute?.groovyScript || '';
          }
        }
        
        // Check for conflicts: compare fetched script with original content
        const originalContent = tab.originalContent || '';
        const hasConflict = originalContent.trim() !== currentScript.trim();
        
        // Normalize scriptType - API may return different casings
        const rawScriptType = module.scriptType || module.collectorAttribute?.scriptType || 'embed';
        const normalizedScriptType = rawScriptType.toLowerCase() === 'powershell' ? 'powerShell' : 'embed';
        
        const moduleInfo: LogicModuleInfo = {
          id: module.id,
          name: module.name,
          displayName: module.displayName || module.name,
          moduleType: tab.source.moduleType!,
          appliesTo: module.appliesTo || '',
          collectMethod: module.collectMethod || 'script',
          hasAutoDiscovery: !!module.enableAutoDiscovery,
          scriptType: normalizedScriptType,
        };
        
        // Store conflict info in a way that can be accessed by the dialog
        // We'll pass this through the moduleInfo or a separate state
        set({ 
          loadedModuleForCommit: moduleInfo,
          // Store conflict info - we'll need to extend LogicModuleInfo or use a separate state
        });
        
        // If there's a conflict, update the originalContent to the current server state
        // so the user can see what changed
        if (hasConflict && currentScript !== originalContent) {
          // Update the tab's originalContent to reflect server state
          set({
            tabs: tabs.map(t =>
              t.id === tabId
                ? { ...t, originalContent: currentScript }
                : t
            ),
          });
        }
      } else if (response?.type === 'MODULE_ERROR') {
        const error = response.payload.error || 'Failed to fetch module';
        const errorCode = response.payload.code;
        
        // Handle specific error cases
        if (errorCode === 404) {
          throw new Error('Module not found. It may have been deleted.');
        } else if (errorCode === 403) {
          throw new Error('CSRF token expired. Please refresh the page.');
        } else if (errorCode === 401) {
          throw new Error('Session expired. Please log in to LogicMonitor.');
        }
        
        set({ moduleCommitError: error });
        throw new Error(error);
      } else {
        throw new Error('Unknown error occurred');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch module';
      set({ moduleCommitError: errorMessage });
      throw error;
    }
  },

  commitModuleScript: async (tabId: string, reason?: string) => {
    const { tabs, selectedPortalId, moduleDetailsDraftByTabId } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab || !selectedPortalId) {
      throw new Error('Tab not found or portal not selected');
    }
    
    if (tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType || !tab.source.scriptType) {
      throw new Error('Tab is not a module tab');
    }
    
    set({ isCommittingModule: true, moduleCommitError: null });
    
    try {
      // Check if there are module details changes
      const moduleDetailsDraft = moduleDetailsDraftByTabId[tabId];
      const hasModuleDetailsChanges = moduleDetailsDraft && moduleDetailsDraft.dirtyFields.size > 0;
      
      // Check if script has changes
      const hasScriptChanges = tab.content !== tab.originalContent;
      
      if (!hasScriptChanges && !hasModuleDetailsChanges) {
        throw new Error('No changes to commit');
      }

      // Build module details payload if there are changes
      let moduleDetailsPayload: Partial<{
        name: string;
        displayName?: string;
        description?: string;
        appliesTo?: string;
        group?: string;
        technology?: string;
        tags?: string;
        collectInterval?: number;
        accessGroupIds?: number[] | string;
        enableAutoDiscovery?: boolean;
        autoDiscoveryConfig?: {
          scheduleInterval?: number;
          deleteInactiveInstance?: boolean;
          showDeletedInstanceDays?: number;
          disableInstance?: boolean;
          instanceAutoGroupMethod?: string;
          instanceAutoGroupMethodParams?: string;
          filters?: Array<{
            comment?: string;
            attribute: string;
            operation: string;
            value?: string;
          }>;
        };
      }> | undefined;

      if (hasModuleDetailsChanges && moduleDetailsDraft) {
        // Import buildModuleDetailsPatchPayload from module-api
        // For now, build it inline
        const payload: Record<string, unknown> = {};
        for (const field of moduleDetailsDraft.dirtyFields) {
          const draftValue = moduleDetailsDraft.draft[field as keyof typeof moduleDetailsDraft.draft];
          const originalValue = moduleDetailsDraft.original?.[field as keyof typeof moduleDetailsDraft.original];
          
          if (draftValue !== originalValue) {
            if (field === 'accessGroupIds') {
              if (Array.isArray(draftValue)) {
                payload.accessGroupIds = draftValue;
              } else if (typeof draftValue === 'string') {
                payload.accessGroupIds = draftValue;
              }
            } else if (field === 'autoDiscoveryConfig') {
              // For nested objects, include the entire object if any field changed
              payload.autoDiscoveryConfig = draftValue;
            } else {
              payload[field] = draftValue;
            }
          }
        }
        moduleDetailsPayload = payload;
      }

      const trimmedReason = reason?.trim();
      const limitedReason = trimmedReason ? trimmedReason.slice(0, 4096) : undefined;
      const response = await chrome.runtime.sendMessage({
        type: 'COMMIT_MODULE_SCRIPT',
        payload: {
          portalId: selectedPortalId,
          moduleType: tab.source.moduleType,
          moduleId: tab.source.moduleId,
          scriptType: tab.source.scriptType,
          newScript: hasScriptChanges ? tab.content : undefined,
          moduleDetails: moduleDetailsPayload,
          reason: limitedReason,
        },
      });
      
      if (response?.type === 'MODULE_COMMITTED') {
        // Update originalContent to reflect the committed state
        const updatedTabs = tabs.map(t => 
          t.id === tabId 
            ? { ...t, originalContent: t.content }
            : t
        );
        
        // Clear module details draft if committed
        const updatedDrafts = { ...moduleDetailsDraftByTabId };
        const moduleTabIds = getModuleTabIds(tabs, tabId);
        if (hasModuleDetailsChanges && moduleDetailsDraft) {
          // Update original to match draft after successful commit across module tabs
          moduleTabIds.forEach((id) => {
            updatedDrafts[id] = {
              ...moduleDetailsDraft,
              original: moduleDetailsDraft.draft,
              dirtyFields: new Set<string>(),
              tabId: id,
            };
          });
        }
        
        set({
          tabs: updatedTabs,
          moduleDetailsDraftByTabId: updatedDrafts,
          isCommittingModule: false,
          moduleCommitConfirmationOpen: false,
          loadedModuleForCommit: null,
        });
        toast.success('Changes committed to module successfully');
      } else if (response?.type === 'MODULE_ERROR') {
        const error = response.payload.error || 'Failed to commit module script';
        set({ 
          moduleCommitError: error,
          isCommittingModule: false,
        });
        throw new Error(error);
      } else {
        const error = 'Unknown error occurred';
        set({ 
          moduleCommitError: error,
          isCommittingModule: false,
        });
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to commit module script';
      set({ 
        moduleCommitError: errorMessage,
        isCommittingModule: false,
      });
      throw error;
    }
  },

  fetchLineageVersions: async (tabId: string): Promise<number> => {
    const { tabs, selectedPortalId } = get();
    const tab = tabs.find(t => t.id === tabId);

    if (!tab || !selectedPortalId) {
      throw new Error('Tab not found or portal not selected');
    }

    if (tab.source?.type !== 'module' || !tab.source.moduleType || !tab.source.lineageId) {
      throw new Error('Lineage is only available for LMX-loaded modules');
    }

    set({ isFetchingLineage: true, lineageError: null });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_LINEAGE_VERSIONS',
        payload: {
          portalId: selectedPortalId,
          moduleType: tab.source.moduleType,
          lineageId: tab.source.lineageId,
        },
      });

      if (response?.type === 'LINEAGE_VERSIONS_FETCHED') {
        const versions = response.payload.versions || [];
        set({
          lineageVersions: versions,
          isFetchingLineage: false,
        });
        return versions.length;
      } else if (response?.type === 'LINEAGE_ERROR') {
        const error = response.payload.error || 'Failed to fetch lineage versions';
        set({ lineageError: error, isFetchingLineage: false });
        throw new Error(error);
      } else {
        const error = 'Unknown error occurred';
        set({ lineageError: error, isFetchingLineage: false });
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch lineage versions';
      set({ lineageError: errorMessage, isFetchingLineage: false });
      throw error;
    }
    return 0;
  },

  getAllFunctions: () => {
    const { customFunctions } = get();
    
    // Convert custom functions to AppliesToFunction format
    const customAsFunctions = customFunctions.map(cf => ({
      name: cf.name,
      syntax: `${cf.name}()`, // Custom functions are called like built-in functions
      parameters: '', // Custom functions don't have documented parameters
      description: cf.description || `Custom function: ${cf.name}`,
      example: undefined,
      source: 'custom' as const,
      customId: cf.id,
    }));
    
    // Convert built-in functions to include source
    const builtinAsFunctions = APPLIES_TO_FUNCTIONS.map((bf: { name: string; syntax: string; parameters: string; description: string; example?: string }) => ({
      ...bf,
      source: 'builtin' as const,
      customId: undefined,
    }));
    
    return [...builtinAsFunctions, ...customAsFunctions];
  },

  // Debug commands actions
  setDebugCommandsDialogOpen: (open: boolean) => {
    set({ debugCommandsDialogOpen: open });
    if (!open) {
      // Clear results when closing
      set({ debugCommandResults: {}, isExecutingDebugCommand: false, debugCommandExecutionId: null });
    }
  },

  executeDebugCommand: async (portalId: string, collectorIds: number[], command: string, parameters?: Record<string, string>, positionalArgs?: string[]) => {
    const executionId = crypto.randomUUID();
    set({ isExecutingDebugCommand: true, debugCommandResults: {}, debugCommandExecutionId: executionId });

    const request: ExecuteDebugCommandRequest = {
      portalId,
      collectorIds,
      command,
      parameters,
      positionalArgs,
    };

    // Set up message listener for progress updates and completion
    if (activeDebugCommandListener) {
      chrome.runtime.onMessage.removeListener(activeDebugCommandListener);
    }

    const progressListener = (message: any) => {
      // Only handle messages for this execution
      if (message.executionId && message.executionId !== executionId) {
        return false;
      }

      if (message.type === 'DEBUG_COMMAND_UPDATE') {
        // Progress updates - could show progress in UI if needed
        // For now, we just track execution state
      } else if (message.type === 'DEBUG_COMMAND_COMPLETE') {
        set({
          debugCommandResults: message.payload.results,
          isExecutingDebugCommand: false,
          debugCommandExecutionId: null,
        });
        chrome.runtime.onMessage.removeListener(progressListener);
        activeDebugCommandListener = null;
      } else if (message.type === 'ERROR' && message.payload.code === 'DEBUG_COMMAND_ERROR') {
        set({
          isExecutingDebugCommand: false,
          debugCommandExecutionId: null,
        });
        chrome.runtime.onMessage.removeListener(progressListener);
        activeDebugCommandListener = null;
        toast.error('Debug command execution failed', {
          description: message.payload.message,
        });
      }
      return false; // Don't keep channel open
    };

    activeDebugCommandListener = progressListener;
    chrome.runtime.onMessage.addListener(progressListener);

    try {
      // Send execution request with executionId
      // Note: The service worker will send messages back via onMessage
      await chrome.runtime.sendMessage({
        type: 'EXECUTE_DEBUG_COMMAND',
        payload: { ...request, executionId },
      });
    } catch (error) {
      set({ isExecutingDebugCommand: false, debugCommandExecutionId: null });
      chrome.runtime.onMessage.removeListener(progressListener);
      activeDebugCommandListener = null;
      toast.error('Failed to execute debug command', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  cancelDebugCommandExecution: async () => {
    const { debugCommandExecutionId } = get();
    if (!debugCommandExecutionId) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'CANCEL_DEBUG_COMMAND',
        payload: { executionId: debugCommandExecutionId },
      });
      set({
        isExecutingDebugCommand: false,
        debugCommandExecutionId: null,
      });
      if (activeDebugCommandListener) {
        chrome.runtime.onMessage.removeListener(activeDebugCommandListener);
        activeDebugCommandListener = null;
      }
      toast.info('Debug command execution cancelled');
    } catch (error) {
      toast.error('Failed to cancel debug command', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
}));
