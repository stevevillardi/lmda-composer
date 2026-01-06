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
  // NOTE: FetchModulesResponse moved to ModuleSlice
  DraftScript,
  DraftTabs,
  EditorTab,
  EditorTabSource,
  // NOTE: ApiRequestSpec, ApiResponseSummary, ApiHistoryEntry, ApiEnvironmentState,
  // ExecuteApiRequest, ExecuteApiResponse now come from APISlice
  LineageVersion,
  FilePermissionStatus,
  // NOTE: ExecuteDebugCommandRequest moved to tools-slice.ts
  // NOTE: ModuleSearchMatchType, ScriptSearchResult, DataPointSearchResult,
  // ModuleSearchProgress, ModuleIndexInfo now come from ModuleSlice
  // NOTE: DeviceProperty, CustomAppliesToFunction, DebugCommandResult, 
  // ModuleSnippetInfo, ModuleSnippetsCacheMeta now come from ToolsSlice
} from '@/shared/types';
import { createUISlice, type UISlice, uiSliceInitialState } from './slices/ui-slice';
import { createPortalSlice, type PortalSlice, portalSliceInitialState } from './slices/portal-slice';
import { createTabsSlice, type TabsSlice, tabsSliceInitialState } from './slices/tabs-slice';
import { createToolsSlice, type ToolsSlice, toolsSliceInitialState } from './slices/tools-slice';
import { createAPISlice, type APISlice, apiSliceInitialState } from './slices/api-slice';
import { createExecutionSlice, type ExecutionSlice, executionSliceInitialState } from './slices/execution-slice';
import { createModuleSlice, type ModuleSlice, moduleSliceInitialState } from './slices/module-slice';
import {
  isFileDirty as isFileDirtyHelper,
  hasPortalChanges as hasPortalChangesHelper,
  getDocumentType,
} from '../utils/document-helpers';
// NOTE: DEFAULT_PREFERENCES moved to ui-slice.ts
// NOTE: parseOutput, ParseResult moved to execution-slice.ts
import * as documentStore from '../utils/document-store';
// NOTE: APPLIES_TO_FUNCTIONS moved to tools-slice.ts
import { DEFAULT_GROOVY_TEMPLATE, DEFAULT_POWERSHELL_TEMPLATE } from '../config/script-templates';
// NOTE: generateModuleSnippetImport moved to tools-slice.ts
// NOTE: buildApiVariableResolver, appendItemsWithLimit moved to api-slice.ts
import { getPortalBindingStatus } from '../utils/portal-binding';
import { getExtensionForLanguage, getLanguageFromFilename } from '../utils/file-extensions';
import { normalizeMode } from '../utils/mode-utils';
import { MODULE_TYPE_SCHEMAS, getSchemaFieldName } from '@/shared/module-type-schemas';
// NOTE: editor type from monaco-editor now used in ExecutionSlice

// NOTE: normalizeAccessGroupIds moved to tools-slice.ts

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// NOTE: deepEqual moved to tools-slice.ts

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

// NOTE: findModuleDraftForTab moved to tools-slice.ts

interface EditorState extends UISlice, PortalSlice, TabsSlice, ToolsSlice, APISlice, ExecutionSlice, ModuleSlice {
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
  // executionHistory) and execution actions now come from ExecutionSlice
  
  // NOTE: Module state (moduleBrowserOpen, selectedModuleType, modulesCache, modulesMeta,
  // modulesSearch, isFetchingModules, selectedModule, moduleSearchQuery, moduleSearchOpen,
  // moduleSearchMode, moduleSearchTerm, moduleSearchMatchType, moduleSearchCaseSensitive,
  // moduleSearchModuleTypes, isSearchingModules, moduleSearchProgress, moduleSearchIndexInfo,
  // moduleSearchExecutionId, moduleScriptSearchResults, moduleDatapointSearchResults,
  // moduleSearchError, selectedScriptSearchResult, selectedDatapointSearchResult,
  // pendingModuleLoad, isCommittingModule, moduleCommitError, moduleCommitConfirmationOpen,
  // loadedModuleForCommit, moduleCommitConflict, saveOptionsDialogOpen, saveOptionsDialogTabId,
  // cloneModuleDialogOpen, pullLatestDialogOpen, isPullingLatest, repositoryBrowserOpen)
  // and module actions now come from ModuleSlice
  
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
  
  // NOTE: Module browser actions (setModuleBrowserOpen, setSelectedModuleType, fetchModules,
  // setSelectedModule, setModuleSearchQuery, loadModuleScript, confirmModuleLoad, cancelModuleLoad)
  // now come from ModuleSlice

  // NOTE: Module search actions (setModuleSearchOpen, setModuleSearchMode, setModuleSearchTerm,
  // setModuleSearchMatchType, setModuleSearchCaseSensitive, setModuleSearchModuleTypes,
  // searchModuleScripts, searchDatapoints, setSelectedScriptSearchResult, setSelectedDatapointSearchResult,
  // clearModuleSearchResults, refreshModuleSearchIndex, cancelModuleSearch) now come from ModuleSlice
  
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
  
  // NOTE: Module-specific tab actions (openModuleScripts) now come from ModuleSlice
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
  
  // NOTE: Module commit state (isCommittingModule, moduleCommitError, moduleCommitConfirmationOpen,
  // loadedModuleForCommit, moduleCommitConflict) now comes from ModuleSlice

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
  
  // NOTE: Module commit actions (fetchModuleForCommit, commitModuleScript, canCommitModule,
  // setModuleCommitConfirmationOpen) now come from ModuleSlice
  
  // NOTE: Save options dialog (saveOptionsDialogOpen, saveOptionsDialogTabId, setSaveOptionsDialogOpen)
  // now comes from ModuleSlice
  
  // NOTE: Module clone to repository actions (cloneModuleDialogOpen, setCloneModuleDialogOpen,
  // cloneModuleToRepository, canCloneModule) now come from ModuleSlice
  
  // NOTE: Pull latest from portal actions (pullLatestDialogOpen, isPullingLatest,
  // setPullLatestDialogOpen, pullLatestFromPortal, canPullLatest) now come from ModuleSlice
  
  // NOTE: Repository browser (repositoryBrowserOpen, setRepositoryBrowserOpen) now comes from ModuleSlice

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

// NOTE: DEFAULT_API_REQUEST and createDefaultApiTab moved to api-slice.ts
// NOTE: activeDebugCommandListener moved to tools-slice.ts
// NOTE: activeModuleSearchListener moved to module-slice.ts

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
  
  // Module slice initial state (spread from moduleSliceInitialState)
  ...moduleSliceInitialState,
  
  // UI slice initial state (spread from uiSliceInitialState)
  ...uiSliceInitialState,
  
  // Tools slice initial state (spread from toolsSliceInitialState)
  ...toolsSliceInitialState,
  
  // NOTE: createSnippetDialogOpen, appliesToTesterOpen, debugCommandsDialogOpen,
  // moduleSnippetsDialogOpen now come from toolsSliceInitialState
  
  // NOTE: preferences now comes from uiSliceInitialState spread above
  // NOTE: Execution state now comes from executionSliceInitialState
  // NOTE: Module state now comes from moduleSliceInitialState
  // NOTE: hasSavedDraft, tabsNeedingPermission, isRestoringFileHandles now come from tabsSliceInitialState
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

  // NOTE: Module browser actions (setModuleBrowserOpen, setSelectedModuleType, fetchModules,
  // setSelectedModule, setModuleSearchQuery, loadModuleScript, confirmModuleLoad, cancelModuleLoad)
  // now come from createModuleSlice spread below

  // NOTE: Module search actions (setModuleSearchOpen, setModuleSearchMode, setModuleSearchTerm,
  // setModuleSearchMatchType, setModuleSearchCaseSensitive, setModuleSearchModuleTypes,
  // searchModuleScripts, searchDatapoints, setSelectedScriptSearchResult, setSelectedDatapointSearchResult,
  // clearModuleSearchResults, refreshModuleSearchIndex, cancelModuleSearch) now come from createModuleSlice spread below

  // UI state actions - spread from createUISlice
  ...createUISlice(set, get, {} as any),

  // Execution state and actions - spread from createExecutionSlice
  ...createExecutionSlice(set, get, {} as any),

  // Module state and actions - spread from createModuleSlice
  ...createModuleSlice(set, get, {} as any),

  // API state and actions - spread from createAPISlice
  ...createAPISlice(set, get, {} as any),

  // Tools state and actions - spread from createToolsSlice
  ...createToolsSlice(set, get, {} as any),

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

  // NOTE: Device properties, Snippets, AppliesTo tester, Custom functions, Debug commands,
  // Module snippets, Module lineage, and Module details actions now come from createToolsSlice spread above

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
  
  // NOTE: AppliesTo tester and Custom AppliesTo functions actions now come from createToolsSlice spread above

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

  // NOTE: Module lineage and module details actions now come from createToolsSlice spread above

  // Repository browser
  setRepositoryBrowserOpen: (open: boolean) => {
    set({ repositoryBrowserOpen: open });
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

  // NOTE: fetchLineageVersions, getAllFunctions, debug commands, and module snippets actions 
  // now come from createToolsSlice spread above
}));
