import { create } from 'zustand';
import { toast } from 'sonner';
import type { 
  Portal, 
  Snippet,
  ScriptLanguage, 
  ScriptMode,
  // NOTE: ExecutionResult, ExecuteScriptRequest, ExecutionHistoryEntry now come from ExecutionSlice
  LogicModuleType,
  LogicModuleInfo,
  FetchModulesResponse,
  DraftScript,
  DraftTabs,
  EditorTab,
  EditorTabSource,
  ApiRequestSpec,
  ApiResponseSummary,
  ApiHistoryEntry,
  ApiEnvironmentState,
  // NOTE: ApiEnvironmentVariable now comes from APISlice
  LineageVersion,
  FilePermissionStatus,
  ExecuteDebugCommandRequest,
  ModuleSearchMatchType,
  ScriptSearchResult,
  DataPointSearchResult,
  ModuleSearchProgress,
  ModuleIndexInfo,
  ExecuteApiRequest,
  ExecuteApiResponse,
  // NOTE: DeviceProperty, CustomAppliesToFunction, DebugCommandResult, 
  // ModuleSnippetInfo, ModuleSnippetsCacheMeta now come from ToolsSlice
} from '@/shared/types';
import { createUISlice, type UISlice, uiSliceInitialState } from './slices/ui-slice';
import { createPortalSlice, type PortalSlice, portalSliceInitialState } from './slices/portal-slice';
import { createTabsSlice, type TabsSlice, tabsSliceInitialState } from './slices/tabs-slice';
import { type ToolsSlice, toolsSliceInitialState } from './slices/tools-slice';
import { type APISlice, apiSliceInitialState } from './slices/api-slice';
import { createExecutionSlice, type ExecutionSlice, executionSliceInitialState } from './slices/execution-slice';
import {
  isFileDirty as isFileDirtyHelper,
  hasPortalChanges as hasPortalChangesHelper,
  getDocumentType,
} from '../utils/document-helpers';
// NOTE: DEFAULT_PREFERENCES moved to ui-slice.ts
// NOTE: parseOutput, ParseResult moved to execution-slice.ts
import * as documentStore from '../utils/document-store';
import { APPLIES_TO_FUNCTIONS } from '../data/applies-to-functions';
import { DEFAULT_GROOVY_TEMPLATE, DEFAULT_POWERSHELL_TEMPLATE } from '../config/script-templates';
import { generateModuleSnippetImport } from '../data/module-snippet-import';
import { buildApiVariableResolver } from '../utils/api-variables';
import { appendItemsWithLimit } from '../utils/api-pagination';
import { getPortalBindingStatus } from '../utils/portal-binding';
import { getExtensionForLanguage, getLanguageFromFilename } from '../utils/file-extensions';
import { normalizeMode } from '../utils/mode-utils';
import { MODULE_TYPE_SCHEMAS, getSchemaFieldName } from '@/shared/module-type-schemas';
// NOTE: editor type from monaco-editor now used in ExecutionSlice

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

const ensurePortalBindingActive = (
  tab: EditorTab,
  selectedPortalId: string | null,
  portals: Portal[]
) => {
  const binding = getPortalBindingStatus(tab, selectedPortalId, portals);
  if (!binding.isActive) {
    throw new Error(binding.reason || 'Portal is not active for this tab.');
  }
  return binding;
};

const getModuleTabIds = (tabs: EditorTab[], tabId: string): string[] => {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab || tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType) {
    return [tabId];
  }
  const source = tab.source;
  const portalId = source.portalId;
  return tabs
    .filter(
      (t) =>
        t.source?.type === 'module' &&
        t.source.moduleId === source.moduleId &&
        t.source.moduleType === source.moduleType &&
        t.source.portalId === portalId
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
        draft.moduleId === tab.source?.moduleId &&
        draft.moduleType === tab.source?.moduleType &&
        draft.portalId === tab.source?.portalId
    ) || null
  );
};

interface EditorState extends UISlice, PortalSlice, TabsSlice, ToolsSlice, APISlice, ExecutionSlice {
  // NOTE: Portal/Collector selection and Device context now come from PortalSlice
  // (portals, selectedPortalId, collectors, selectedCollectorId, devices, 
  //  isFetchingDevices, hostname, wildvalue, datasourceId)
  
  // NOTE: Tab state (tabs, activeTabId, tabsNeedingPermission, isRestoringFileHandles,
  // hasSavedDraft, recentFiles, isLoadingRecentFiles) and core tab actions now come from TabsSlice
  
  // NOTE: Tools state (deviceProperties, isFetchingProperties, propertiesSearchQuery, selectedDeviceId,
  // userSnippets, snippetsSearchQuery, snippetCategoryFilter, snippetLanguageFilter, snippetSourceFilter,
  // editingSnippet, appliesToExpression, appliesToResults, appliesToError, appliesToTestFrom,
  // isTestingAppliesTo, appliesToFunctionSearch, customFunctions, isLoadingCustomFunctions,
  // customFunctionError, isCreatingFunction, isUpdatingFunction, isDeletingFunction,
  // debugCommandResults, isExecutingDebugCommand, moduleSnippets, moduleSnippetsCacheMeta,
  // moduleSnippetsLoading, selectedModuleSnippet, moduleSnippetSource, moduleSnippetSourceLoading,
  // moduleSnippetsSearchQuery, cachedSnippetVersions, moduleLineageDialogOpen, lineageVersions,
  // isLoadingLineage, lineageError, selectedLineageVersion, moduleDetailsDraftByTabId,
  // moduleDetailsDialogOpen, moduleDetailsLoading, moduleDetailsError, accessGroups,
  // isLoadingAccessGroups) now come from ToolsSlice

  // NOTE: API Explorer state (apiHistoryByPortal, apiEnvironmentsByPortal, isExecutingApi)
  // now comes from APISlice
  
  // NOTE: Execution state (isExecuting, currentExecution, parsedOutput, editorInstance,
  // executionContextDialogOpen, pendingExecution, currentExecutionId, cancelDialogOpen,
  // executionHistory) and execution actions (setEditorInstance, executeScript, clearOutput,
  // parseCurrentOutput, setExecutionContextDialogOpen, confirmExecutionContext, 
  // cancelExecutionContextDialog, setCancelDialogOpen, cancelExecution, addToHistory,
  // clearHistory, loadHistory, reloadFromHistory, reloadFromHistoryWithoutBinding)
  // now come from ExecutionSlice
  
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
  
  // NOTE: UI state (outputTab, commandPaletteOpen, settingsDialogOpen, executionHistoryOpen, 
  // rightSidebarOpen, rightSidebarTab, preferences) now comes from UISlice
  
  // NOTE: createSnippetDialogOpen, appliesToTesterOpen, debugCommandsDialogOpen,
  // moduleSnippetsDialogOpen now come from ToolsSlice
  
  // NOTE: hasSavedDraft, tabsNeedingPermission, isRestoringFileHandles now come from TabsSlice
  
  // Actions
  // NOTE: Portal actions (setSelectedPortal, switchToPortalWithContext, setSelectedCollector,
  // fetchDevices, setHostname, setWildvalue, setDatasourceId, refreshPortals, refreshCollectors,
  // handlePortalDisconnected) now come from PortalSlice
  setLanguage: (language: ScriptLanguage, force?: boolean) => void;
  setMode: (mode: ScriptMode) => void;
  // NOTE: setOutputTab now comes from UISlice
  
  // NOTE: Execution actions (setEditorInstance, executeScript, clearOutput, parseCurrentOutput,
  // setExecutionContextDialogOpen, confirmExecutionContext, cancelExecutionContextDialog)
  // now come from ExecutionSlice
  
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
  
  // NOTE: UI state actions (setCommandPaletteOpen, setSettingsDialogOpen, setExecutionHistoryOpen)
  // and Preferences actions (setPreferences, loadPreferences, savePreferences) now come from UISlice
  
  // NOTE: Execution history actions (addToHistory, clearHistory, loadHistory, reloadFromHistory,
  // reloadFromHistoryWithoutBinding) now come from ExecutionSlice

  // NOTE: API Explorer actions (openApiExplorerTab, updateApiTabRequest, setApiTabResponse,
  // executeApiRequest, addApiHistoryEntry, clearApiHistory, loadApiHistory, setApiEnvironment,
  // loadApiEnvironments) now come from APISlice
  
  // Draft actions
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<DraftScript | DraftTabs | null>;
  clearDraft: () => Promise<void>;
  restoreDraft: (draft: DraftScript) => void;
  restoreDraftTabs: (draftTabs: DraftTabs) => void;
  
  // File export action (uses download)
  exportToFile: () => void;
  
  // NOTE: Right sidebar actions (setRightSidebarOpen, setRightSidebarTab) now come from UISlice
  
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
  
  // NOTE: Cancel execution actions (setCancelDialogOpen, cancelExecution) now come from ExecutionSlice
  
  // NOTE: Core tab management actions (getActiveTab, openTab, closeTab, closeOtherTabs, closeAllTabs,
  // setActiveTab, renameTab, updateTabContent, updateActiveTabContent, setActiveTabLanguage,
  // setActiveTabMode, setTabContextOverride, createNewFile, getUniqueUntitledName) now come from TabsSlice
  
  // Module-specific tab actions (has portal dependencies)
  openModuleScripts: (module: LogicModuleInfo, scripts: Array<{ type: 'ad' | 'collection'; content: string }>) => void;
  // NOTE: toggleRightSidebar now comes from UISlice
  
  // File operations (Phase 6 - File System Access API)
  // These remain here due to complexity and dependencies
  openFileFromDisk: () => Promise<void>;
  openModuleFromRepository: () => Promise<void>;
  saveFile: (tabId?: string) => Promise<boolean>;
  saveFileAs: (tabId?: string) => Promise<boolean>;
  restoreFileHandles: () => Promise<void>;
  requestFilePermissions: () => Promise<void>;
  isTabDirty: (tabId: string) => boolean;
  getTabDirtyState: (tab: EditorTab) => boolean;
  
  // Welcome screen / Recent files
  // NOTE: recentFiles, isLoadingRecentFiles now come from TabsSlice
  loadRecentFiles: () => Promise<void>;
  openRecentFile: (tabId: string) => Promise<void>;
  
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
  
  // Module Snippets actions
  setModuleSnippetsDialogOpen: (open: boolean) => void;
  fetchModuleSnippets: () => Promise<void>;
  loadModuleSnippetsFromCache: () => Promise<void>;
  selectModuleSnippet: (name: string, version: string) => void;
  fetchModuleSnippetSource: (name: string, version: string) => Promise<void>;
  insertModuleSnippetImport: (name: string, version: string) => void;
  setModuleSnippetsSearchQuery: (query: string) => void;
  clearModuleSnippetsCache: () => Promise<void>;
  
  // Module commit state
  isCommittingModule: boolean;
  moduleCommitError: string | null;
  moduleCommitConfirmationOpen: boolean;
  loadedModuleForCommit: LogicModuleInfo | null;
  moduleCommitConflict: { hasConflict: boolean; message?: string; portalVersion?: number } | null;

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
      alertSubjectTemplate?: string;
      alertBodyTemplate?: string;
      alertLevel?: string;
      clearAfterAck?: boolean;
      alertEffectiveIval?: number;
      enableAutoDiscovery?: boolean;
      autoDiscoveryConfig?: {
        scheduleInterval?: number;
        persistentInstance?: boolean;
        deleteInactiveInstance?: boolean;
        showDeletedInstanceDays?: number;
        disableInstance?: boolean;
        instanceAutoGroupMethod?: string;
        instanceAutoGroupMethodParams?: string;
        method?: {
          name?: string;
          type?: string;
          winScript?: string | null;
          winCmdline?: string | null;
          linuxCmdline?: string | null;
          linuxScript?: string | null;
          groovyScript?: string | null;
        };
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
      alertSubjectTemplate?: string;
      alertBodyTemplate?: string;
      alertLevel?: string;
      clearAfterAck?: boolean;
      alertEffectiveIval?: number;
      enableAutoDiscovery?: boolean;
      autoDiscoveryConfig?: {
        scheduleInterval?: number;
        persistentInstance?: boolean;
        deleteInactiveInstance?: boolean;
        showDeletedInstanceDays?: number;
        disableInstance?: boolean;
        instanceAutoGroupMethod?: string;
        instanceAutoGroupMethodParams?: string;
        method?: {
          name?: string;
          type?: string;
          winScript?: string | null;
          winCmdline?: string | null;
          linuxCmdline?: string | null;
          linuxScript?: string | null;
          groovyScript?: string | null;
        };
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
      configChecks?: Array<{
        id: number;
        name: string;
        description?: string;
        alertLevel?: number;
        type?: string;
        ackClearAlert?: boolean;
        alertEffectiveIval?: number;
        alertTransitionInterval?: number;
        script?: unknown;
        originId?: string | null;
        [key: string]: unknown;
      }>;
    }>;
    dirtyFields: Set<string>;
    loadedAt: number;
    tabId: string;
    moduleId: number;
    moduleType: LogicModuleType;
    portalId?: string;
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
  
  // Save options dialog (for portal documents)
  saveOptionsDialogOpen: boolean;
  saveOptionsDialogTabId: string | null;
  setSaveOptionsDialogOpen: (open: boolean, tabId?: string) => void;
  
  // Module clone to repository actions
  cloneModuleDialogOpen: boolean;
  setCloneModuleDialogOpen: (open: boolean) => void;
  cloneModuleToRepository: (tabId: string, repositoryId: string | null, overwrite?: boolean) => Promise<import('@/shared/types').CloneResult>;
  canCloneModule: (tabId: string) => boolean;
  
  // Pull latest from portal actions
  pullLatestDialogOpen: boolean;
  isPullingLatest: boolean;
  setPullLatestDialogOpen: (open: boolean) => void;
  pullLatestFromPortal: (tabId: string) => Promise<{ success: boolean; error?: string }>;
  canPullLatest: (tabId: string) => boolean;
  
  // Repository browser
  repositoryBrowserOpen: boolean;
  setRepositoryBrowserOpen: (open: boolean) => void;

  // Module lineage actions
  fetchLineageVersions: (tabId: string) => Promise<number>;
  setModuleLineageDialogOpen: (open: boolean) => void;
  
  // Module details actions
  setModuleDetailsDialogOpen: (open: boolean) => void;
  loadModuleDetails: (tabId: string) => Promise<void>;
  updateModuleDetailsField: (tabId: string, field: string, value: unknown) => void;
  resetModuleDetailsDraft: (tabId: string) => void;
  fetchAccessGroups: (tabId: string) => Promise<void>;
  createLocalCopyFromTab: (tabId: string, options?: { activate?: boolean }) => string | null;
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
  LAST_CONTEXT: 'lm-ide-last-context', // Last selected portal/collector/device
} as const;

// NOTE: LastContextState, persistContext, loadLastContext moved to portal-slice.ts
// NOTE: createDefaultTab moved to tabs-slice.ts

function getUniqueUntitledName(tabs: EditorTab[], language: ScriptLanguage): string {
  const extension = language === 'groovy' ? 'groovy' : 'ps1';
  let counter = 0;
  let displayName = `Untitled.${extension}`;
  while (tabs.some((tab) => tab.displayName === displayName)) {
    counter += 1;
    displayName = `Untitled ${counter}.${extension}`;
  }
  return displayName;
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
  // Portal slice initial state (spread from portalSliceInitialState)
  ...portalSliceInitialState,
  
  // Tabs slice initial state (spread from tabsSliceInitialState)
  ...tabsSliceInitialState,

  // API slice initial state (spread from apiSliceInitialState)
  ...apiSliceInitialState,
  
  // Execution slice initial state (spread from executionSliceInitialState)
  ...executionSliceInitialState,
  
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
  
  // UI slice initial state (spread from uiSliceInitialState)
  ...uiSliceInitialState,
  
  // Tools slice initial state (spread from toolsSliceInitialState)
  ...toolsSliceInitialState,
  
  // NOTE: createSnippetDialogOpen, appliesToTesterOpen, debugCommandsDialogOpen,
  // moduleSnippetsDialogOpen now come from toolsSliceInitialState
  
  // NOTE: preferences now comes from uiSliceInitialState spread above
  // NOTE: Execution state (isExecuting, currentExecution, parsedOutput, editorInstance,
  // executionContextDialogOpen, pendingExecution, currentExecutionId, cancelDialogOpen,
  // executionHistory) now come from executionSliceInitialState
  // NOTE: hasSavedDraft, tabsNeedingPermission, isRestoringFileHandles now come from tabsSliceInitialState
  
  // Module commit initial state
  isCommittingModule: false,
  moduleCommitError: null,
  moduleCommitConfirmationOpen: false,
  loadedModuleForCommit: null,
  moduleCommitConflict: null,
  
  // Save options dialog initial state
  saveOptionsDialogOpen: false,
  saveOptionsDialogTabId: null,
  
  // Module clone to repository initial state
  cloneModuleDialogOpen: false,
  
  // Pull latest initial state
  pullLatestDialogOpen: false,
  isPullingLatest: false,
  
  // Repository browser initial state
  repositoryBrowserOpen: false,

  // NOTE: Module lineage, module details, debug commands, module snippets
  // state now comes from toolsSliceInitialState spread above
  
  // NOTE: recentFiles, isLoadingRecentFiles now come from tabsSliceInitialState

  // Portal slice actions - spread from createPortalSlice
  ...createPortalSlice(set, get, {} as any),

  // Tabs slice actions - spread from createTabsSlice
  ...createTabsSlice(set, get, {} as any),

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
    if (mode === 'freeform' && (outputTab === 'parsed' || outputTab === 'validation' || outputTab === 'graph')) {
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

  // NOTE: setOutputTab now comes from createUISlice spread below
  
  // NOTE: Execution actions (setEditorInstance, executeScript, clearOutput, parseCurrentOutput,
  // setExecutionContextDialogOpen, confirmExecutionContext, cancelExecutionContextDialog) 
  // now come from createExecutionSlice spread below

  // NOTE: refreshPortals, refreshCollectors, handlePortalDisconnected now come from createPortalSlice spread above

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
        if (!get().modulesMeta[type].hasMore) {
          break;
        }
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
        toast.error('Failed to load modules', {
          description: 'Unable to fetch modules from the portal',
        });
        set({ isFetchingModules: false });
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
      toast.error('Failed to load modules', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
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
    const { selectedModule, selectedPortalId, portals } = get();
    const portal = portals.find((entry) => entry.id === selectedPortalId);
    
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
        portalId: selectedPortalId || undefined,
        portalHostname: portal?.hostname,
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
    const { pendingModuleLoad, selectedModule, selectedPortalId, portals } = get();
    if (!pendingModuleLoad) return;
    const portal = portals.find((entry) => entry.id === selectedPortalId);

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
        portalId: selectedPortalId || undefined,
        portalHostname: portal?.hostname,
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

  // UI state actions - spread from createUISlice
  ...createUISlice(set, get, {} as any),

  // Execution state and actions - spread from createExecutionSlice
  ...createExecutionSlice(set, get, {} as any),

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
      mode: normalizeMode(draft.mode),
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
    // Normalize any legacy mode values to valid modes
    const normalizedTabs = draftTabs.tabs.map(tab => ({
      ...tab,
      mode: normalizeMode(tab.mode),
    }));
    
    set({
      tabs: normalizedTabs,
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
    
    const extension = getExtensionForLanguage(activeTab.language);
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

  // NOTE: Right sidebar actions (setRightSidebarOpen, setRightSidebarTab) now come from createUISlice spread above

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
        toast.error('Failed to load properties', {
          description: 'Unable to fetch device properties',
        });
        set({ deviceProperties: [], isFetchingProperties: false });
      }
    } catch (error) {
      console.error('Error fetching device properties:', error);
      const current = get();
      if (current.selectedPortalId !== fetchingPortal || current.selectedDeviceId !== fetchingDevice) {
        return;
      }
      toast.error('Failed to load properties', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
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

  // NOTE: Cancel execution actions (setCancelDialogOpen, cancelExecution) 
  // now come from createExecutionSlice spread above

  // NOTE: Core tab management actions (getActiveTab, openTab, closeTab, closeOtherTabs, closeAllTabs,
  // setActiveTab, renameTab, updateTabContent, updateActiveTabContent, setActiveTabLanguage,
  // setActiveTabMode, setTabContextOverride) now come from createTabsSlice spread above

  openModuleScripts: (module, scripts) => {
    const { tabs, selectedPortalId, portals } = get();
    const extension = module.scriptType === 'powerShell' ? 'ps1' : 'groovy';
    const language: ScriptLanguage = module.scriptType === 'powerShell' ? 'powershell' : 'groovy';
    const portal = portals.find((entry) => entry.id === selectedPortalId);
    
    // Determine the appropriate mode based on module type, script type and collect method
    // Note: The parser uses source.moduleType for specialized validation within 'collection' mode
    const getModeForScript = (scriptType: 'ad' | 'collection'): ScriptMode => {
      // AD scripts always use 'ad' mode
      if (scriptType === 'ad') return 'ad';
      
      // Batch scripts (datasource/configsource only)
      if (module.collectMethod === 'batchscript') {
        return 'batchcollection';
      }
      
      // All collection scripts use 'collection' mode
      // The parser will use moduleType from tab.source for specialized parsing
      // (topology, event, property, log, config all parse within 'collection' mode)
      return 'collection';
    };
    
    const newTabs: EditorTab[] = scripts.map(script => {
      const scriptType: 'collection' | 'ad' = script.type === 'ad' ? 'ad' : 'collection';
      return {
        id: crypto.randomUUID(),
        displayName: `${module.name}/${script.type}.${extension}`,
        content: script.content,
        language,
        mode: getModeForScript(scriptType),
        originalContent: script.content, // Store original content for dirty detection
        source: {
          type: 'module' as const,
          moduleId: module.id,
          moduleName: module.name,
          moduleType: module.moduleType,
          scriptType,
          lineageId: module.lineageId,
          portalId: selectedPortalId || undefined,
          portalHostname: portal?.hostname,
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

  // NOTE: toggleRightSidebar now comes from createUISlice spread above

  // File operations (Phase 6 - File System Access API)
  openFileFromDisk: async () => {
    // Check if File System Access API is supported
    if (!documentStore.isFileSystemAccessSupported()) {
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
      await documentStore.saveFileHandle(tabId, handle, fileName);
      
      // Try to restore module binding from stored module files
      let source: EditorTabSource = { type: 'file' };
      let displayName = fileName;
      let mode: ScriptMode = 'freeform';
      
      try {
        const { restoreModuleBinding } = await import('../utils/module-repository');
        const binding = await restoreModuleBinding(tabId);
        
        if (binding) {
          source = binding.source;
          displayName = `${binding.manifest.module.name}/${binding.scriptType === 'ad' ? 'AD' : 'Collection'}`;
          mode = binding.scriptType === 'ad' ? 'ad' : 'collection';
          
          toast.success('Module binding restored', {
            description: `Linked to ${binding.manifest.portal.hostname} - ${binding.manifest.module.name}`,
          });
        }
      } catch (bindError) {
        // Binding restoration failed - continue as regular file
        console.debug('[openFileFromDisk] Could not restore module binding:', bindError);
      }
      
      // Create new tab
      const newTab: EditorTab = {
        id: tabId,
        displayName,
        content,
        language: isGroovy ? 'groovy' : 'powershell',
        mode,
        originalContent: content,
        hasFileHandle: true,
        isLocalFile: true,
        source,
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

  openModuleFromRepository: async () => {
    try {
      const { openModuleFromDirectory, MODULE_TYPE_DIRS } = await import('../utils/module-repository');
      const { saveModuleFile, generateId } = await import('../utils/document-store');
      
      const result = await openModuleFromDirectory();
      if (!result) {
        // User cancelled
        return;
      }
      
      const { manifest, scripts, directoryHandle } = result;
      const { tabs, portals } = get();
      
      // Check if the portal is connected
      const matchingPortal = portals.find(p => p.hostname === manifest.portal.hostname);
      const isPortalConnected = !!matchingPortal;
      
      // Create tabs for each script
      const newTabs: EditorTab[] = [];
      
      // Determine repository ID
      // Note: When opening from a module directory directly (not from repo browser), 
      // we may not have a repository ID. In this case, we don't create a fake repository
      // entry since we only have the module directory handle, not the repo root.
      // The files will still be tracked individually.
      const repositoryId = result.repositoryId || '';
      
      if (scripts.collection && manifest.scripts.collection) {
        const tabId = generateId();
        
        // Store file mapping
        const fileHandle = await directoryHandle.getFileHandle(manifest.scripts.collection.filename);
        await saveModuleFile({
          fileId: tabId,
          repositoryId,
          fileHandle,
          moduleDirectoryHandle: directoryHandle,
          relativePath: `${manifest.portal.hostname}/${MODULE_TYPE_DIRS[manifest.module.type]}/${manifest.module.name}/${manifest.scripts.collection.filename}`,
          scriptType: 'collection',
          lastAccessed: Date.now(),
        });
        
        // Store in file handle store for save operations
        await documentStore.saveFileHandle(tabId, fileHandle, manifest.scripts.collection.filename);
        
        const source: EditorTabSource = {
          type: 'module',
          moduleId: manifest.module.id,
          moduleName: manifest.module.name,
          moduleType: manifest.module.type,
          scriptType: 'collection',
          lineageId: manifest.module.lineageId,
          portalId: manifest.portal.id,
          portalHostname: manifest.portal.hostname,
        };
        
        newTabs.push({
          id: tabId,
          displayName: `${manifest.module.name}/Collection`,
          content: scripts.collection,
          language: manifest.scripts.collection.language,
          mode: 'collection',
          originalContent: scripts.collection,
          portalContent: scripts.collection, // Assume file content matches portal on open
          hasFileHandle: true,
          isLocalFile: true,
          source,
        });
      }
      
      if (scripts.ad && manifest.scripts.ad) {
        const tabId = generateId();
        
        // Store file mapping
        const fileHandle = await directoryHandle.getFileHandle(manifest.scripts.ad.filename);
        await saveModuleFile({
          fileId: tabId,
          repositoryId,
          fileHandle,
          moduleDirectoryHandle: directoryHandle,
          relativePath: `${manifest.portal.hostname}/${MODULE_TYPE_DIRS[manifest.module.type]}/${manifest.module.name}/${manifest.scripts.ad.filename}`,
          scriptType: 'ad',
          lastAccessed: Date.now(),
        });
        
        // Store in file handle store for save operations
        await documentStore.saveFileHandle(tabId, fileHandle, manifest.scripts.ad.filename);
        
        const source: EditorTabSource = {
          type: 'module',
          moduleId: manifest.module.id,
          moduleName: manifest.module.name,
          moduleType: manifest.module.type,
          scriptType: 'ad',
          lineageId: manifest.module.lineageId,
          portalId: manifest.portal.id,
          portalHostname: manifest.portal.hostname,
        };
        
        newTabs.push({
          id: tabId,
          displayName: `${manifest.module.name}/AD`,
          content: scripts.ad,
          language: manifest.scripts.ad.language,
          mode: 'ad',
          originalContent: scripts.ad,
          portalContent: scripts.ad, // Assume file content matches portal on open
          hasFileHandle: true,
          isLocalFile: true,
          source,
        });
      }
      
      if (newTabs.length === 0) {
        toast.warning('No scripts found in module', {
          description: 'The selected module directory does not contain any script files.',
        });
        return;
      }
      
      // Add tabs and activate the first one
      set({
        tabs: [...tabs, ...newTabs],
        activeTabId: newTabs[0].id,
      });
      
      const scriptCount = newTabs.length;
      if (isPortalConnected) {
        toast.success(`Opened ${scriptCount} script${scriptCount > 1 ? 's' : ''} from repository`, {
          description: `${manifest.module.name} - linked to ${manifest.portal.hostname}`,
        });
      } else {
        toast.warning(`Opened ${scriptCount} script${scriptCount > 1 ? 's' : ''} from repository`, {
          description: `${manifest.module.name} - portal ${manifest.portal.hostname} not connected. Connect to the portal to commit changes.`,
        });
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      console.error('[openModuleFromRepository] Error:', error);
      toast.error('Failed to open module', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  saveFile: async (tabId?: string) => {
    const { tabs, activeTabId } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return false;
    
    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab) return false;

    // Check if this is a portal document without a file handle
    // If so, show the save options dialog instead of direct save
    const docType = getDocumentType(tab);
    if (docType === 'portal') {
      // Show save options dialog for portal documents
      get().setSaveOptionsDialogOpen(true, targetTabId);
      return false;
    }

    try {
      // Check for existing handle
      const handle = await documentStore.getFileHandle(targetTabId);
      
      if (handle) {
        // Check permission
        const permission = await documentStore.queryFilePermission(handle);
        
        if (permission === 'granted') {
          // Direct save to existing file
          await documentStore.writeToHandle(handle, tab.content);
          
          // Update lastAccessed timestamp for recent files
          await documentStore.saveFileHandle(targetTabId, handle, tab.displayName);
          
          // Update originalContent to mark as clean
          // Keep module source if tab is a cloned local file (isLocalFile: true)
          // Otherwise convert module tabs to file tabs when saved locally
          set({
            tabs: tabs.map(t => 
              t.id === targetTabId 
                ? { 
                    ...t, 
                    originalContent: tab.content,
                    // Preserve module binding for cloned files, convert to file otherwise
                    source: t.source?.type === 'module' && !t.isLocalFile 
                      ? { type: 'file' } 
                      : t.source,
                  }
                : t
            ),
          });
          return true;
        } else if (permission === 'prompt') {
          // Need to request permission
          const granted = await documentStore.requestFilePermission(handle);
          if (granted) {
            await documentStore.writeToHandle(handle, tab.content);
            
            // Update lastAccessed timestamp for recent files
            await documentStore.saveFileHandle(targetTabId, handle, tab.displayName);
            
            set({
              tabs: tabs.map(t => 
                t.id === targetTabId 
                  ? { 
                      ...t, 
                      originalContent: tab.content,
                      // Preserve module binding for cloned files, convert to file otherwise
                      source: t.source?.type === 'module' && !t.isLocalFile 
                        ? { type: 'file' } 
                        : t.source,
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
    if (!documentStore.isFileSystemAccessSupported()) {
      // Fallback to download
      get().exportToFile();
      return true;
    }

    try {
      const extension = getExtensionForLanguage(tab.language);
      const baseName = tab.displayName.replace(/\.(groovy|ps1)$/, '');
      const suggestedName = baseName + extension;
      
      // Show save picker
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Script Files',
            accept: { 'text/plain': [extension] },
          },
        ],
      });
      
      // Write content
      await documentStore.writeToHandle(handle, tab.content);
      
      // Store new handle in IndexedDB
      await documentStore.saveFileHandle(targetTabId, handle, handle.name);
      
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
      const storedHandles = await documentStore.getAllFileHandles();
      const needsPermission: FilePermissionStatus[] = [];
      
      // Check permission for each handle that matches a currently open tab
      // NOTE: We do NOT delete handles for tabs that don't exist - those are
      // needed for the recent files list. Cleanup is handled by cleanupOldHandles()
      // in document-store.ts based on age and count limits.
      for (const [tabId, record] of storedHandles) {
        // Only process handles for tabs that are currently open
        const tabExists = tabs.some(t => t.id === tabId);
        if (!tabExists) {
          // Skip handles for closed tabs - keep them for recent files
          continue;
        }
        
        const permission = await documentStore.queryFilePermission(record.handle);
        
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
        const handle = await documentStore.getFileHandle(status.tabId);
        if (!handle) continue;
        
        const granted = await documentStore.requestFilePermission(handle);
        
        if (granted) {
          // Optionally re-read file content to check for external changes
          try {
            const newContent = await documentStore.readFromHandle(handle);
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
    // Use the unified document helper for dirty state detection
    // This handles both new DocumentState and legacy fields
    return isFileDirtyHelper(tab);
  },

  // Welcome screen actions
  loadRecentFiles: async () => {
    set({ isLoadingRecentFiles: true });
    try {
      const recentFiles = await documentStore.getRecentFileHandles(10);
      
      // Enrich recent files with repository/module info
      const { getModuleFile } = await import('../utils/document-store');
      const { readManifest } = await import('../utils/module-repository');
      
      const enrichedFiles = await Promise.all(
        recentFiles.map(async (file) => {
          try {
            const moduleFile = await getModuleFile(file.tabId);
            if (moduleFile) {
              const manifest = await readManifest(moduleFile.moduleDirectoryHandle);
              if (manifest) {
                return {
                  ...file,
                  isRepositoryModule: true,
                  moduleName: manifest.module.name,
                  scriptType: moduleFile.scriptType,
                  portalHostname: manifest.portal.hostname,
                };
              }
            }
          } catch {
            // Ignore errors - just return the file without module info
          }
          return file;
        })
      );
      
      set({ recentFiles: enrichedFiles, isLoadingRecentFiles: false });
    } catch (error) {
      console.error('Failed to load recent files:', error);
      set({ recentFiles: [], isLoadingRecentFiles: false });
    }
  },

  openRecentFile: async (tabId: string) => {
    try {
      const handle = await documentStore.getFileHandle(tabId);
      if (!handle) {
        console.warn('File handle not found for tabId:', tabId);
        // Remove from recent files since handle is gone
        await documentStore.deleteFileHandle(tabId);
        get().loadRecentFiles();
        return;
      }

      // Check permission
      let permission = await documentStore.queryFilePermission(handle);
      if (permission !== 'granted') {
        permission = (await documentStore.requestFilePermission(handle)) ? 'granted' : 'denied';
      }

      if (permission !== 'granted') {
        console.warn('Permission denied for file:', handle.name);
        return;
      }

      // Read file content
      const content = await documentStore.readFromHandle(handle);
      const fileName = handle.name;
      const language: ScriptLanguage = getLanguageFromFilename(fileName);

      // Update lastAccessed
      await documentStore.saveFileHandle(tabId, handle, fileName);

      // Check if this is a repository-backed module file
      let newTab: EditorTab;
      
      try {
        const { getModuleFile } = await import('../utils/document-store');
        const { readManifest } = await import('../utils/module-repository');
        
        const moduleFile = await getModuleFile(tabId);
        if (moduleFile) {
          // This is a repository-backed module - load the manifest
          const manifest = await readManifest(moduleFile.moduleDirectoryHandle);
          if (manifest) {
            const source: EditorTabSource = {
              type: 'module',
              moduleId: manifest.module.id,
              moduleName: manifest.module.name,
              moduleType: manifest.module.type,
              scriptType: moduleFile.scriptType,
              lineageId: manifest.module.lineageId,
              portalId: manifest.portal.id,
              portalHostname: manifest.portal.hostname,
            };
            
            newTab = {
              id: tabId,
              displayName: `${manifest.module.name}/${moduleFile.scriptType === 'ad' ? 'AD' : 'Collection'}`,
              content,
              language: manifest.scripts[moduleFile.scriptType]?.language || language,
              mode: moduleFile.scriptType === 'ad' ? 'ad' : 'collection',
              originalContent: content,
              portalContent: content, // Assume file content matches portal on open
              hasFileHandle: true,
              isLocalFile: true,
              source,
            };
          } else {
            // Manifest not found, fall back to regular file
            newTab = {
              id: tabId,
              displayName: fileName,
              content,
              language,
              mode: 'freeform',
              originalContent: content,
              hasFileHandle: true,
              isLocalFile: true,
            };
          }
        } else {
          // Not a module file, create regular file tab
          newTab = {
            id: tabId,
            displayName: fileName,
            content,
            language,
            mode: 'freeform',
            originalContent: content,
            hasFileHandle: true,
            isLocalFile: true,
          };
        }
      } catch (moduleError) {
        console.warn('Could not check for module file:', moduleError);
        // Fall back to regular file tab
        newTab = {
          id: tabId,
          displayName: fileName,
          content,
          language,
          mode: 'freeform',
          originalContent: content,
          hasFileHandle: true,
          isLocalFile: true,
        };
      }

      set({
        tabs: [...get().tabs, newTab],
        activeTabId: tabId,
      });
    } catch (error) {
      console.error('Failed to open recent file:', error);
    }
  },

  // NOTE: createNewFile now comes from createTabsSlice spread above

  createLocalCopyFromTab: (tabId: string, options) => {
    const { tabs } = get();
    const tab = tabs.find((entry) => entry.id === tabId);
    if (!tab || tab.kind === 'api') return null;

    const displayName = getUniqueUntitledName(tabs, tab.language);
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      kind: 'script',
      displayName,
      content: tab.content,
      language: tab.language,
      mode: tab.mode,
      originalContent: tab.content,
      isLocalFile: true,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: options?.activate === false ? get().activeTabId : newTab.id,
    });

    return newTab.id;
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
      set({ loadedModuleForCommit: null, moduleCommitError: null, moduleCommitConflict: null });
    }
  },

  // Save options dialog actions
  setSaveOptionsDialogOpen: (open: boolean, tabId?: string) => {
    set({ 
      saveOptionsDialogOpen: open,
      saveOptionsDialogTabId: open ? (tabId ?? null) : null,
    });
  },

  // Module clone to repository actions
  setCloneModuleDialogOpen: (open: boolean) => {
    set({ cloneModuleDialogOpen: open });
  },

  canCloneModule: (tabId: string) => {
    const { tabs } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return false;
    
    // Must be a module tab with valid source info
    if (tab.source?.type !== 'module') return false;
    if (!tab.source.moduleId || !tab.source.moduleType) return false;
    if (!tab.source.portalId || !tab.source.portalHostname) return false;
    
    // Must have content to clone
    if (!tab.content || tab.content.trim().length === 0) return false;
    
    return true;
  },

  cloneModuleToRepository: async (tabId: string, repositoryId: string | null, overwrite = false) => {
    const { tabs } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab || tab.source?.type !== 'module') {
      return {
        success: false,
        repositoryId: repositoryId || '',
        modulePath: '',
        fileIds: {},
        error: 'Tab is not a module tab',
      };
    }
    
    const source = tab.source;
    if (!source.moduleId || !source.moduleType || !source.portalId || !source.portalHostname) {
      return {
        success: false,
        repositoryId: repositoryId || '',
        modulePath: '',
        fileIds: {},
        error: 'Module source information is incomplete',
      };
    }
    
    // Dynamic import to avoid circular dependencies
    const { 
      pickOrCreateRepository, 
      cloneModuleToRepository: cloneToRepo,
      getRepositoryWithStatus,
    } = await import('../utils/module-repository');
    
    try {
      // Get or create repository
      let repo;
      if (repositoryId) {
        const repoStatus = await getRepositoryWithStatus(repositoryId);
        if (!repoStatus) {
          return {
            success: false,
            repositoryId,
            modulePath: '',
            fileIds: {},
            error: 'Repository not found',
          };
        }
        repo = repoStatus.repo;
      } else {
        // Pick a new directory
        repo = await pickOrCreateRepository();
        if (!repo) {
          return {
            success: false,
            repositoryId: '',
            modulePath: '',
            fileIds: {},
            error: 'No directory selected',
          };
        }
      }
      
      // Build module info from tab source
      const moduleInfo = {
        id: source.moduleId,
        name: source.moduleName || tab.displayName.split('/')[0],
        displayName: source.moduleName || tab.displayName.split('/')[0],
        moduleType: source.moduleType,
        appliesTo: '',
        collectMethod: 'script',
        hasAutoDiscovery: source.scriptType === 'ad' || tabs.some(
          t => t.source?.moduleId === source.moduleId && 
               t.source?.moduleType === source.moduleType &&
               t.source?.scriptType === 'ad'
        ),
        scriptType: tab.language === 'powershell' ? 'powerShell' : 'embed',
        lineageId: source.lineageId,
      } as import('@/shared/types').LogicModuleInfo;
      
      // Gather scripts from all tabs for this module
      const scripts: { 
        collection?: { content: string; language: import('@/shared/types').ScriptLanguage }; 
        ad?: { content: string; language: import('@/shared/types').ScriptLanguage };
      } = {};
      
      // Find all tabs for this module
      const moduleTabs = tabs.filter(
        t => t.source?.type === 'module' &&
             t.source.moduleId === source.moduleId &&
             t.source.moduleType === source.moduleType &&
             t.source.portalId === source.portalId
      );
      
      for (const moduleTab of moduleTabs) {
        if (moduleTab.source?.scriptType === 'collection') {
          scripts.collection = { content: moduleTab.content, language: moduleTab.language };
        } else if (moduleTab.source?.scriptType === 'ad') {
          scripts.ad = { content: moduleTab.content, language: moduleTab.language };
        }
      }
      
      // If no scripts found from other tabs, use current tab
      if (!scripts.collection && !scripts.ad) {
        if (source.scriptType === 'collection') {
          scripts.collection = { content: tab.content, language: tab.language };
        } else if (source.scriptType === 'ad') {
          scripts.ad = { content: tab.content, language: tab.language };
        }
      }
      
      // Clone to repository
      const result = await cloneToRepo(
        repo,
        source.portalId,
        source.portalHostname,
        moduleInfo,
        scripts,
        { overwrite }
      );
      
      // Update tab file handles if successful
      if (result.success && result.fileHandles && result.filenames) {
        // Re-read tabs from state to avoid overwriting concurrent changes
        const currentTabs = get().tabs;
        const updatedTabs: EditorTab[] = [];
        
        for (const t of currentTabs) {
          if (t.source?.type === 'module' &&
              t.source.moduleId === source.moduleId &&
              t.source.moduleType === source.moduleType &&
              t.source.portalId === source.portalId) {
            const scriptType = t.source.scriptType;
            const fileHandle = scriptType === 'ad' ? result.fileHandles.ad : result.fileHandles.collection;
            const filename = scriptType === 'ad' ? result.filenames.ad : result.filenames.collection;
            
            if (fileHandle && filename) {
              // Save file handle to document-store for save operations
              await documentStore.saveFileHandle(t.id, fileHandle, filename);
              
              updatedTabs.push({
                ...t,
                hasFileHandle: true,
                isLocalFile: true,
                // Update display name to show the filename from repo
                displayName: `${source.moduleName || t.displayName.split('/')[0]}/${scriptType === 'ad' ? 'AD' : 'Collection'}`,
                // Track portal content separately for commit detection
                // This represents what's currently on the portal
                portalContent: t.originalContent ?? t.content,
              });
              continue;
            }
          }
          updatedTabs.push(t);
        }
        set({ tabs: updatedTabs });
      }
      
      return result;
    } catch (error) {
      console.error('[cloneModuleToRepository] Error:', error);
      return {
        success: false,
        repositoryId: repositoryId || '',
        modulePath: '',
        fileIds: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  // Pull latest from portal actions
  setPullLatestDialogOpen: (open: boolean) => {
    set({ pullLatestDialogOpen: open });
  },

  canPullLatest: (tabId: string) => {
    const { tabs, portals } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return false;
    
    // Must be a module tab with source info
    if (tab.source?.type !== 'module') return false;
    if (!tab.source.moduleId || !tab.source.moduleType) return false;
    if (!tab.source.portalId || !tab.source.portalHostname) return false;
    
    // Portal must be connected and active
    const portal = portals.find(p => p.id === tab.source?.portalId);
    if (!portal) return false;
    
    // Must have the source portal selected or be able to reach it
    return portal.status === 'active';
  },

  pullLatestFromPortal: async (tabId: string) => {
    const { tabs, portals } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab || tab.source?.type !== 'module') {
      return { success: false, error: 'Tab is not a module tab' };
    }
    
    const source = tab.source;
    if (!source.moduleId || !source.moduleType || !source.portalId) {
      return { success: false, error: 'Module source information is incomplete' };
    }
    
    const portal = portals.find(p => p.id === source.portalId);
    if (!portal) {
      return { success: false, error: `Portal ${source.portalHostname} not found` };
    }
    
    set({ isPullingLatest: true });
    
    try {
      // Get current tab for CSRF token
      const currentTabs = await chrome.tabs.query({ url: `https://${portal.hostname}/*` });
      if (currentTabs.length === 0) {
        set({ isPullingLatest: false });
        return { success: false, error: 'No LogicMonitor tab found for this portal' };
      }
      const lmTab = currentTabs[0];
      if (!lmTab.id) {
        set({ isPullingLatest: false });
        return { success: false, error: 'Invalid browser tab ID' };
      }
      
      // Fetch latest module from portal
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId: source.portalId,
          moduleType: source.moduleType,
          moduleId: source.moduleId,
        },
      });
      
      if (response?.type === 'MODULE_FETCHED') {
        const module = response.payload;
        
        // Extract script content
        let scriptContent: string | undefined;
        const scriptType = source.scriptType || 'collection';
        
        if (scriptType === 'collection') {
          // Collection script location varies by module type
          if (source.moduleType === 'propertysource' || source.moduleType === 'diagnosticsource') {
            scriptContent = module.groovyScript || module.linuxScript || module.windowsScript;
          } else if (source.moduleType === 'eventsource') {
            scriptContent = module.groovyScript || module.script;
          } else if (source.moduleType === 'logsource') {
            // LogSource has a unique script structure
            scriptContent = module.collectionAttribute?.script?.embeddedContent ||
                           module.collectionAttribute?.groovyScript ||
                           module.collectorAttribute?.groovyScript;
          } else {
            // DataSource, ConfigSource, TopologySource and others
            scriptContent = module.collectorAttribute?.groovyScript ||
                           module.collectorAttribute?.linuxScript ||
                           module.collectorAttribute?.windowsScript;
          }
        } else if (scriptType === 'ad') {
          // Active Discovery script
          scriptContent = module.autoDiscoveryConfig?.method?.groovyScript ||
                         module.autoDiscoveryConfig?.method?.linuxScript ||
                         module.autoDiscoveryConfig?.method?.winScript;
        }
        
        if (scriptContent === undefined) {
          set({ isPullingLatest: false });
          return { success: false, error: 'Could not extract script from module' };
        }
        
        // Update the tab content
        const updatedTabs = tabs.map(t => 
          t.id === tabId 
            ? { 
                ...t, 
                content: scriptContent!,
                originalContent: scriptContent!,
                // Update portalContent for cloned files (tracks what's on portal for commit detection)
                portalContent: t.isLocalFile ? scriptContent! : t.portalContent,
              }
            : t
        );
        
        set({ tabs: updatedTabs, isPullingLatest: false });
        
        // Update local files if this is a repository-backed tab
        if (tab.hasFileHandle && tab.isLocalFile) {
          try {
            const { getModuleFile } = await import('../utils/document-store');
            const { updateModuleFilesAfterPull } = await import('../utils/module-repository');
            
            const storedFile = await getModuleFile(tabId);
            if (storedFile) {
              await updateModuleFilesAfterPull(
                tabId,
                scriptType === 'collection' ? scriptContent : undefined,
                scriptType === 'ad' ? scriptContent : undefined,
                module.version
              );
            }
          } catch (fileError) {
            console.warn('[pullLatestFromPortal] Could not update local files:', fileError);
            // Don't fail the pull - just warn
          }
        }
        
        toast.success('Pulled latest from portal', {
          description: `Updated ${source.moduleName || 'module'} ${scriptType === 'ad' ? 'AD' : 'collection'} script`,
        });
        
        return { success: true };
      } else if (response?.type === 'MODULE_ERROR') {
        const error = response.payload.error || 'Failed to fetch module';
        set({ isPullingLatest: false });
        return { success: false, error };
      } else {
        set({ isPullingLatest: false });
        return { success: false, error: 'Unexpected response from portal' };
      }
    } catch (error) {
      console.error('[pullLatestFromPortal] Error:', error);
      set({ isPullingLatest: false });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  setModuleLineageDialogOpen: (open: boolean) => {
    set({ moduleLineageDialogOpen: open });
    if (!open) {
      set({ lineageVersions: [], lineageError: null });
    }
  },

  // Repository browser
  setRepositoryBrowserOpen: (open: boolean) => {
    set({ repositoryBrowserOpen: open });
  },

  // Module details actions
  setModuleDetailsDialogOpen: (open: boolean) => {
    set({ moduleDetailsDialogOpen: open });
    if (!open) {
      set({ moduleDetailsError: null });
    }
  },

  loadModuleDetails: async (tabId: string) => {
    const { tabs, selectedPortalId, portals } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) {
      set({ moduleDetailsError: 'Tab not found' });
      return;
    }

    if (tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType) {
      set({ moduleDetailsError: 'Tab is not a module tab' });
      return;
    }
    const source = tab.source;
    const moduleType = source.moduleType!;
    const moduleId = source.moduleId!;

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
      const binding = ensurePortalBindingActive(tab, selectedPortalId, portals);
      // Get portal info for CSRF token
      const portal = portals.find(p => p.id === binding.portalId);
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
          portalId: binding.portalId,
          moduleType,
          moduleId,
          tabId: lmTab.id,
        },
      });

      if (response?.type === 'MODULE_DETAILS_FETCHED') {
        const module = response.payload.module;
        const schema = MODULE_TYPE_SCHEMAS[moduleType];
        const intervalField = schema.intervalField || 'collectInterval';
        const intervalValue =
          module[intervalField as keyof typeof module] ??
          module.collectInterval ??
          module[getSchemaFieldName(schema, 'collectInterval') as keyof typeof module];
        const collectIntervalValue =
          schema.intervalFormat === 'object' && typeof intervalValue === 'object' && intervalValue
            ? (intervalValue as { offset?: number }).offset
            : intervalValue;
        const appliesToValue = module[getSchemaFieldName(schema, 'appliesTo') as keyof typeof module];
        const technologyValue = module[getSchemaFieldName(schema, 'technology') as keyof typeof module];
        const displayNameValue = module[getSchemaFieldName(schema, 'displayName') as keyof typeof module];
        const descriptionValue = module[getSchemaFieldName(schema, 'description') as keyof typeof module];
        const groupValue = module[getSchemaFieldName(schema, 'group') as keyof typeof module];
        const tagsValue = module[getSchemaFieldName(schema, 'tags') as keyof typeof module];
        const dataPoints = schema.readOnlyList === 'datapoints' ? module.dataPoints || [] : [];
        const configChecks = schema.readOnlyList === 'configChecks' ? module.configChecks || [] : [];
        const autoDiscoveryConfig = schema.autoDiscoveryDefaults
          ? {
              ...schema.autoDiscoveryDefaults,
              ...(module.autoDiscoveryConfig || {}),
              method: {
                ...(module.autoDiscoveryConfig?.method || {}),
              },
            }
          : module.autoDiscoveryConfig;
        
        // Extract metadata fields only
        const metadata = {
          id: module.id,
          name: module.name || '',
          displayName: displayNameValue,
          description: descriptionValue,
          appliesTo: appliesToValue,
          group: groupValue,
          technology: technologyValue,
          tags: tagsValue,
          collectInterval: collectIntervalValue,
          accessGroupIds: module.accessGroupIds,
          version: module.version,
          enableAutoDiscovery: module.enableAutoDiscovery,
          autoDiscoveryConfig,
          dataPoints,
          configChecks,
          alertSubjectTemplate: module.alertSubjectTemplate,
          alertBodyTemplate: module.alertBodyTemplate,
          alertLevel: module.alertLevel,
          clearAfterAck: module.clearAfterAck,
          alertEffectiveIval: module.alertEffectiveIval,
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
            moduleId,
            moduleType,
            portalId: source.portalId,
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

  fetchAccessGroups: async (tabId: string) => {
    const { tabs, selectedPortalId, portals } = get();
    const tab = tabs.find((entry) => entry.id === tabId);
    if (!tab || tab.source?.type !== 'module') {
      set({ moduleDetailsError: 'Tab not found or not a module tab' });
      return;
    }

    set({ isLoadingAccessGroups: true });

    try {
      const binding = ensurePortalBindingActive(tab, selectedPortalId, portals);
      const portal = portals.find((entry) => entry.id === binding.portalId);
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
          portalId: binding.portalId,
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
    const { tabs, selectedPortalId, portals } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return false;
    if (tab.source?.type !== 'module') return false;
    const binding = getPortalBindingStatus(tab, selectedPortalId, portals);
    if (!binding.isActive) return false;
    
    // Use unified helper to check for portal changes
    const hasScriptChanges = hasPortalChangesHelper(tab);
    
    // Check for module details changes
    const moduleDetailsDraft = get().moduleDetailsDraftByTabId[tabId];
    const hasModuleDetailsChanges = moduleDetailsDraft && moduleDetailsDraft.dirtyFields.size > 0;
    
    // Can commit (push to portal) if either scripts or module details have changes
    return hasScriptChanges || hasModuleDetailsChanges;
  },

  fetchModuleForCommit: async (tabId: string) => {
    const { tabs, selectedPortalId, portals } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab) {
      throw new Error('Tab not found');
    }
    
    if (tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType || !tab.source.scriptType) {
      throw new Error('Tab is not a module tab');
    }

    const binding = ensurePortalBindingActive(tab, selectedPortalId, portals);
    
    set({ moduleCommitError: null });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId: binding.portalId,
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
            moduleCommitConflict: hasConflict ? {
            hasConflict: true,
            message: 'The module has been modified in the portal since you last pulled. Your local copy may not include the latest changes.',
            portalVersion: module.version,
          } : { hasConflict: false },
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
    const { tabs, selectedPortalId, portals, moduleDetailsDraftByTabId } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab) {
      throw new Error('Tab not found');
    }
    
    if (tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType || !tab.source.scriptType) {
      throw new Error('Tab is not a module tab');
    }

    const binding = ensurePortalBindingActive(tab, selectedPortalId, portals);
    
    set({ isCommittingModule: true, moduleCommitError: null });
    
    try {
      // Check if there are module details changes
      const moduleDetailsDraft = moduleDetailsDraftByTabId[tabId];
      const hasModuleDetailsChanges = moduleDetailsDraft && moduleDetailsDraft.dirtyFields.size > 0;
      
      // Check if script has changes compared to portal
      // For cloned files, use portalContent (what's on the portal)
      // For non-cloned files, use originalContent
      const compareContent = (tab.isLocalFile && tab.portalContent !== undefined) 
        ? tab.portalContent 
        : tab.originalContent;
      const hasScriptChanges = tab.content !== compareContent;
      
      if (!hasScriptChanges && !hasModuleDetailsChanges) {
        throw new Error('No changes to push');
      }

      // Build module details payload if there are changes
      let moduleDetailsPayload: Partial<{
        name: string;
        displayName?: string;
        description?: string;
        appliesTo?: string;
        group?: string;
        technology?: string;
        tags?: string | string[];
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
        const schema = MODULE_TYPE_SCHEMAS[tab.source.moduleType];
        const payload: Record<string, unknown> = {};
        for (const field of moduleDetailsDraft.dirtyFields) {
          const draftValue = moduleDetailsDraft.draft[field as keyof typeof moduleDetailsDraft.draft];
          const originalValue = moduleDetailsDraft.original?.[field as keyof typeof moduleDetailsDraft.original];
          const actualField = getSchemaFieldName(schema, field);
          
          if (!Object.is(draftValue, originalValue)) {
            if (field === 'accessGroupIds') {
              if (Array.isArray(draftValue)) {
                payload.accessGroupIds = draftValue;
              } else if (typeof draftValue === 'string') {
                payload.accessGroupIds = draftValue;
              }
            } else if (field === 'autoDiscoveryConfig') {
              const draftConfig = isPlainObject(draftValue) ? draftValue : {};
              const baseConfig = schema.autoDiscoveryDefaults
                ? { ...schema.autoDiscoveryDefaults, ...draftConfig }
                : draftConfig;
              payload.autoDiscoveryConfig = baseConfig;
            } else if (field === 'tags' && tab.source.moduleType === 'logsource') {
              const tagsText = Array.isArray(draftValue) ? draftValue.join(',') : String(draftValue ?? '');
              const tagsArray = tagsText
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
              payload.tags = tagsArray;
            } else if (field === 'collectInterval' && schema.intervalFormat === 'object' && actualField === 'collectionInterval') {
              payload.collectionInterval = {
                units: 'SECONDS',
                offset: draftValue,
              };
            } else {
              payload[actualField] = draftValue;
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
          portalId: binding.portalId,
          moduleType: tab.source.moduleType,
          moduleId: tab.source.moduleId,
          scriptType: tab.source.scriptType,
          newScript: hasScriptChanges ? tab.content : undefined,
          moduleDetails: moduleDetailsPayload,
          reason: limitedReason,
        },
      });
      
      if (response?.type === 'MODULE_COMMITTED') {
        // Update originalContent and portalContent to reflect the committed state
        const updatedTabs = tabs.map(t => 
          t.id === tabId 
            ? { 
                ...t, 
                originalContent: t.content,
                // Update portalContent for cloned files (portal now has this content)
                portalContent: t.isLocalFile ? t.content : t.portalContent,
              }
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
        toast.success('Changes pushed to portal successfully');
      } else if (response?.type === 'MODULE_ERROR') {
        const error = response.payload.error || 'Failed to push changes to portal';
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to push changes to portal';
      set({ 
        moduleCommitError: errorMessage,
        isCommittingModule: false,
      });
      throw error;
    }
  },

  fetchLineageVersions: async (tabId: string): Promise<number> => {
    const { tabs, selectedPortalId, portals } = get();
    const tab = tabs.find(t => t.id === tabId);

    if (!tab) {
      throw new Error('Tab not found');
    }

    if (tab.source?.type !== 'module' || !tab.source.moduleType || !tab.source.lineageId) {
      throw new Error('Lineage is only available for LMX-loaded modules');
    }

    const binding = ensurePortalBindingActive(tab, selectedPortalId, portals);

    set({ isFetchingLineage: true, lineageError: null });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_LINEAGE_VERSIONS',
        payload: {
          portalId: binding.portalId,
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

  // Module Snippets actions
  setModuleSnippetsDialogOpen: (open: boolean) => {
    set({ moduleSnippetsDialogOpen: open });
    if (open) {
      // Load from cache when opening
      get().loadModuleSnippetsFromCache();
    } else {
      // Clear selection when closing
      set({ selectedModuleSnippet: null, moduleSnippetSource: null, moduleSnippetsSearchQuery: '' });
    }
  },

  loadModuleSnippetsFromCache: async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MODULE_SNIPPETS_CACHE',
      });
      if (response?.type === 'MODULE_SNIPPETS_CACHE' && response.payload) {
        set({
          moduleSnippets: response.payload.snippets,
          moduleSnippetsCacheMeta: response.payload.meta,
          cachedSnippetVersions: new Set(response.payload.cachedSourceKeys || []),
        });
      }
    } catch (error) {
      console.error('Failed to load module snippets from cache:', error);
    }
  },

  fetchModuleSnippets: async () => {
    const { selectedPortalId, selectedCollectorId } = get();
    
    if (!selectedPortalId || !selectedCollectorId) {
      toast.error('No portal or collector selected', {
        description: 'Please select a portal and collector first.',
      });
      return;
    }

    set({ moduleSnippetsLoading: true });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULE_SNIPPETS',
        payload: { portalId: selectedPortalId, collectorId: selectedCollectorId },
      });

      if (response?.type === 'MODULE_SNIPPETS_FETCHED') {
        set({
          moduleSnippets: response.payload.snippets,
          moduleSnippetsCacheMeta: response.payload.meta,
          moduleSnippetsLoading: false,
        });
        toast.success('Module snippets loaded', {
          description: `Found ${response.payload.snippets.length} module snippets.`,
        });
      } else if (response?.type === 'MODULE_SNIPPETS_ERROR') {
        set({ moduleSnippetsLoading: false });
        toast.error('Failed to fetch module snippets', {
          description: response.payload.error,
        });
      } else {
        set({ moduleSnippetsLoading: false });
      }
    } catch (error) {
      set({ moduleSnippetsLoading: false });
      toast.error('Failed to fetch module snippets', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  selectModuleSnippet: (name: string, version: string) => {
    set({ 
      selectedModuleSnippet: { name, version },
      moduleSnippetSource: null,
    });
    // Automatically fetch source when selecting
    get().fetchModuleSnippetSource(name, version);
  },

  fetchModuleSnippetSource: async (name: string, version: string) => {
    const { selectedPortalId, selectedCollectorId } = get();
    
    if (!selectedPortalId || !selectedCollectorId) {
      toast.error('No portal or collector selected');
      return;
    }

    set({ moduleSnippetSourceLoading: true });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULE_SNIPPET_SOURCE',
        payload: { portalId: selectedPortalId, collectorId: selectedCollectorId, name, version },
      });

      if (response?.type === 'MODULE_SNIPPET_SOURCE_FETCHED') {
        const { cachedSnippetVersions } = get();
        const newCached = new Set(cachedSnippetVersions);
        newCached.add(`${name}:${version}`);
        set({
          moduleSnippetSource: response.payload.code,
          moduleSnippetSourceLoading: false,
          cachedSnippetVersions: newCached,
        });
      } else if (response?.type === 'MODULE_SNIPPETS_ERROR') {
        set({ moduleSnippetSourceLoading: false });
        toast.error('Failed to fetch snippet source', {
          description: response.payload.error,
        });
      } else {
        set({ moduleSnippetSourceLoading: false });
      }
    } catch (error) {
      set({ moduleSnippetSourceLoading: false });
      toast.error('Failed to fetch snippet source', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  insertModuleSnippetImport: (name: string, version: string) => {
    const { tabs, activeTabId, editorInstance, openTab } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Generate the import boilerplate
    const importCode = generateModuleSnippetImport(name, version);

    // If no tab exists, create a new groovy file with the import
    if (!activeTab || tabs.length === 0) {
      openTab({
        displayName: 'Untitled.groovy',
        content: importCode,
        language: 'groovy',
        mode: 'freeform',
      });
      set({ moduleSnippetsDialogOpen: false });
      toast.success('Import inserted', {
        description: `Created new file with ${name} import`,
      });
      return;
    }

    if (editorInstance) {
      // Insert at cursor position or at the beginning of the file
      const position = editorInstance.getPosition();
      if (position) {
        editorInstance.executeEdits('module-snippet-import', [{
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: importCode,
          forceMoveMarkers: true,
        }]);
        // Move cursor to end of inserted text
        const lines = importCode.split('\n');
        const newLineNumber = position.lineNumber + lines.length - 1;
        const newColumn = lines.length > 1 ? lines[lines.length - 1].length + 1 : position.column + lines[0].length;
        editorInstance.setPosition({ lineNumber: newLineNumber, column: newColumn });
        editorInstance.focus();
      }
    } else {
      // Fallback: prepend to content
      set({
        tabs: tabs.map(t =>
          t.id === activeTabId
            ? { ...t, content: importCode + '\n' + t.content }
            : t
        ),
      });
    }

    // Close the dialog after successful insert
    set({ moduleSnippetsDialogOpen: false });

    toast.success('Import inserted', {
      description: `Added import for ${name}`,
    });
  },

  setModuleSnippetsSearchQuery: (query: string) => {
    set({ moduleSnippetsSearchQuery: query });
  },

  clearModuleSnippetsCache: async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_MODULE_SNIPPETS_CACHE',
      });
      set({
        moduleSnippets: [],
        moduleSnippetsCacheMeta: null,
        selectedModuleSnippet: null,
        moduleSnippetSource: null,
        cachedSnippetVersions: new Set<string>(),
      });
      toast.success('Module snippets cache cleared');
    } catch (error) {
      toast.error('Failed to clear cache', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
}));
