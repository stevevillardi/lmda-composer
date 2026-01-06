/**
 * Tools slice - manages AppliesTo tester, debug commands, snippets, device properties,
 * module snippets, module lineage, and module details.
 * 
 * This slice handles various "tool" functionality within the editor.
 */

import type { StateCreator } from 'zustand';
import { toast } from 'sonner';
import type { editor } from 'monaco-editor';
import type { 
  Snippet,
  DeviceProperty,
  CustomAppliesToFunction,
  DebugCommandResult,
  ModuleSnippetInfo,
  ModuleSnippetsCacheMeta,
  LineageVersion,
  LogicModuleType,
  EditorTab,
  Portal,
  ExecuteDebugCommandRequest,
} from '@/shared/types';
import { APPLIES_TO_FUNCTIONS } from '../../data/applies-to-functions';
import { MODULE_TYPE_SCHEMAS, getSchemaFieldName } from '@/shared/module-type-schemas';
import { generateModuleSnippetImport } from '../../data/module-snippet-import';
import { 
  deepEqual, 
  ensurePortalBindingActive, 
  getModuleTabIds,
  normalizeAccessGroupIds,
} from '../helpers/slice-helpers';

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_USER_SNIPPETS = 'lm-ide-user-snippets';


const findModuleDraftForTab = (
  drafts: Record<string, ModuleDetailsDraft>,
  tabs: EditorTab[],
  tabId: string
): ModuleDetailsDraft | null => {
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

// Module-scoped listener for debug commands
// Message type is dynamic based on executionId, so we use a generic handler
let activeDebugCommandListener: ((message: { type: string; executionId?: string; payload?: unknown }) => boolean) | null = null;

// ============================================================================
// Module Details Draft Type
// ============================================================================

/**
 * Represents the auto-discovery configuration for a module.
 */
interface AutoDiscoveryConfig {
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
}

/**
 * Represents a datapoint configuration.
 */
interface DataPointConfig {
  id: number;
  name: string;
  type?: number;
  description?: string;
  postProcessorMethod?: string;
  [key: string]: unknown;
}

/**
 * Represents a config check configuration.
 */
interface ConfigCheckConfig {
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
}

/**
 * Represents the module metadata that can be edited.
 */
interface ModuleMetadata {
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
  autoDiscoveryConfig?: AutoDiscoveryConfig;
  dataPoints?: DataPointConfig[];
  configChecks?: ConfigCheckConfig[];
}

/**
 * Represents a module details draft for a tab.
 */
export interface ModuleDetailsDraft {
  original: Partial<ModuleMetadata> | null;
  draft: Partial<ModuleMetadata>;
  dirtyFields: Set<string>;
  loadedAt: number;
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
  portalId?: string;
  version: number;
}

// ============================================================================
// Types
// ============================================================================

/**
 * State managed by the tools slice.
 */
export interface ToolsSliceState {
  // Device properties
  deviceProperties: DeviceProperty[];
  isFetchingProperties: boolean;
  propertiesSearchQuery: string;
  selectedDeviceId: number | null;
  
  // Snippet library
  userSnippets: Snippet[];
  snippetsSearchQuery: string;
  snippetCategoryFilter: 'all' | 'template' | 'pattern';
  snippetLanguageFilter: 'all' | 'groovy' | 'powershell';
  snippetSourceFilter: 'all' | 'builtin' | 'user';
  createSnippetDialogOpen: boolean;
  editingSnippet: Snippet | null;
  
  // AppliesTo tester
  appliesToTesterOpen: boolean;
  appliesToExpression: string;
  appliesToResults: Array<{ type: string; id: number; name: string }>;
  appliesToError: string | null;
  appliesToTestFrom: 'devicesGroup' | 'websiteGroup';
  isTestingAppliesTo: boolean;
  appliesToFunctionSearch: string;
  
  // Custom AppliesTo functions
  customFunctions: CustomAppliesToFunction[];
  isLoadingCustomFunctions: boolean;
  customFunctionError: string | null;
  isCreatingFunction: boolean;
  isUpdatingFunction: boolean;
  isDeletingFunction: boolean;
  
  // Debug commands
  debugCommandsDialogOpen: boolean;
  debugCommandResults: Record<number, DebugCommandResult>;
  isExecutingDebugCommand: boolean;
  debugCommandExecutionId: string | null;
  
  // Module Snippets
  moduleSnippetsDialogOpen: boolean;
  moduleSnippets: ModuleSnippetInfo[];
  moduleSnippetsCacheMeta: ModuleSnippetsCacheMeta | null;
  moduleSnippetsLoading: boolean;
  selectedModuleSnippet: { name: string; version: string } | null;
  moduleSnippetSource: string | null;
  moduleSnippetSourceLoading: boolean;
  moduleSnippetsSearchQuery: string;
  cachedSnippetVersions: Set<string>;
  
  // Module lineage
  moduleLineageDialogOpen: boolean;
  lineageVersions: LineageVersion[];
  isFetchingLineage: boolean;
  lineageError: string | null;
  
  // Module details
  moduleDetailsDraftByTabId: Record<string, ModuleDetailsDraft>;
  moduleDetailsDialogOpen: boolean;
  moduleDetailsLoading: boolean;
  moduleDetailsError: string | null;
  accessGroups: Array<{ id: number; name: string; description?: string; createdOn?: number; updatedOn?: number; createdBy?: string; tenantId?: string | null }>;
  isLoadingAccessGroups: boolean;
}

/**
 * Actions provided by the tools slice.
 */
export interface ToolsSliceActions {
  // Device properties
  fetchDeviceProperties: (deviceId: number) => Promise<void>;
  setPropertiesSearchQuery: (query: string) => void;
  clearDeviceProperties: () => void;
  insertPropertyAccess: (propertyName: string) => void;
  
  // Snippet library
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
  
  // AppliesTo tester
  setAppliesToTesterOpen: (open: boolean) => void;
  setAppliesToExpression: (expression: string) => void;
  setAppliesToTestFrom: (from: 'devicesGroup' | 'websiteGroup') => void;
  setAppliesToFunctionSearch: (search: string) => void;
  testAppliesTo: () => Promise<void>;
  clearAppliesToResults: () => void;
  
  // Custom AppliesTo functions
  fetchCustomFunctions: () => Promise<void>;
  createCustomFunction: (name: string, code: string, description?: string) => Promise<void>;
  updateCustomFunction: (id: number, name: string, code: string, description?: string) => Promise<void>;
  deleteCustomFunction: (id: number) => Promise<void>;
  getAllFunctions: () => Array<{ name: string; syntax: string; parameters: string; description: string; example?: string; source: 'builtin' | 'custom'; customId?: number }>;
  
  // Debug commands
  setDebugCommandsDialogOpen: (open: boolean) => void;
  executeDebugCommand: (portalId: string, collectorIds: number[], command: string, parameters?: Record<string, string>, positionalArgs?: string[]) => Promise<void>;
  cancelDebugCommandExecution: () => Promise<void>;
  
  // Module Snippets
  setModuleSnippetsDialogOpen: (open: boolean) => void;
  fetchModuleSnippets: () => Promise<void>;
  loadModuleSnippetsFromCache: () => Promise<void>;
  selectModuleSnippet: (name: string, version: string) => void;
  fetchModuleSnippetSource: (name: string, version: string) => Promise<void>;
  insertModuleSnippetImport: (name: string, version: string) => void;
  setModuleSnippetsSearchQuery: (query: string) => void;
  clearModuleSnippetsCache: () => Promise<void>;
  
  // Module lineage
  setModuleLineageDialogOpen: (open: boolean) => void;
  fetchLineageVersions: (tabId: string) => Promise<number>;
  
  // Module details
  setModuleDetailsDialogOpen: (open: boolean) => void;
  loadModuleDetails: (tabId: string) => Promise<void>;
  updateModuleDetailsField: (tabId: string, field: string, value: unknown) => Promise<void>;
  resetModuleDetailsDraft: (tabId: string) => void;
  fetchAccessGroups: (tabId: string) => Promise<void>;
}

/**
 * Combined slice interface.
 */
export interface ToolsSlice extends ToolsSliceState, ToolsSliceActions {}

/**
 * Dependencies from other slices that ToolsSlice needs access to.
 */
export interface ToolsSliceDependencies {
  // From TabsSlice
  tabs: EditorTab[];
  activeTabId: string | null;
  openTab: (tabData: Partial<EditorTab> & { displayName: string; content: string; language: string; mode: string }) => string;
  // From PortalSlice
  selectedPortalId: string | null;
  portals: Portal[];
  selectedCollectorId: number | null;
  // From ExecutionSlice
  editorInstance: editor.IStandaloneCodeEditor | null;
}

// ============================================================================
// Initial State
// ============================================================================

export const toolsSliceInitialState: ToolsSliceState = {
  // Device properties
  deviceProperties: [],
  isFetchingProperties: false,
  propertiesSearchQuery: '',
  selectedDeviceId: null,
  
  // Snippet library
  userSnippets: [],
  snippetsSearchQuery: '',
  snippetCategoryFilter: 'all',
  snippetLanguageFilter: 'all',
  snippetSourceFilter: 'all',
  createSnippetDialogOpen: false,
  editingSnippet: null,
  
  // AppliesTo tester
  appliesToTesterOpen: false,
  appliesToExpression: '',
  appliesToResults: [],
  appliesToError: null,
  appliesToTestFrom: 'devicesGroup',
  isTestingAppliesTo: false,
  appliesToFunctionSearch: '',
  
  // Custom functions
  customFunctions: [],
  isLoadingCustomFunctions: false,
  customFunctionError: null,
  isCreatingFunction: false,
  isUpdatingFunction: false,
  isDeletingFunction: false,
  
  // Debug commands
  debugCommandsDialogOpen: false,
  debugCommandResults: {},
  isExecutingDebugCommand: false,
  debugCommandExecutionId: null,
  
  // Module Snippets
  moduleSnippetsDialogOpen: false,
  moduleSnippets: [],
  moduleSnippetsCacheMeta: null,
  moduleSnippetsLoading: false,
  selectedModuleSnippet: null,
  moduleSnippetSource: null,
  moduleSnippetSourceLoading: false,
  moduleSnippetsSearchQuery: '',
  cachedSnippetVersions: new Set(),
  
  // Module lineage
  moduleLineageDialogOpen: false,
  lineageVersions: [],
  isFetchingLineage: false,
  lineageError: null,
  
  // Module details
  moduleDetailsDraftByTabId: {},
  moduleDetailsDialogOpen: false,
  moduleDetailsLoading: false,
  moduleDetailsError: null,
  accessGroups: [],
  isLoadingAccessGroups: false,
};

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Creates the tools slice with full implementations.
 */
export const createToolsSlice: StateCreator<
  ToolsSlice & ToolsSliceDependencies,
  [],
  [],
  ToolsSlice
> = (set, get) => ({
  ...toolsSliceInitialState,

  // =====================
  // Device Properties
  // =====================

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
    } as Partial<ToolsSlice & ToolsSliceDependencies>);
  },

  // =====================
  // Snippet Library
  // =====================

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
      } as Partial<ToolsSlice & ToolsSliceDependencies>);
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
      } as Partial<ToolsSlice & ToolsSliceDependencies>);
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
    chrome.storage.local.set({ [STORAGE_KEY_USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  updateUserSnippet: (id, updates) => {
    const { userSnippets } = get();
    const updatedSnippets = userSnippets.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    set({ userSnippets: updatedSnippets, createSnippetDialogOpen: false, editingSnippet: null });
    
    // Persist to storage
    chrome.storage.local.set({ [STORAGE_KEY_USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  deleteUserSnippet: (id) => {
    const { userSnippets } = get();
    const updatedSnippets = userSnippets.filter(s => s.id !== id);
    set({ userSnippets: updatedSnippets });
    
    // Persist to storage
    chrome.storage.local.set({ [STORAGE_KEY_USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  loadUserSnippets: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_USER_SNIPPETS);
      const storedSnippets = result[STORAGE_KEY_USER_SNIPPETS] as Snippet[] | undefined;
      if (storedSnippets) {
        set({ userSnippets: storedSnippets });
      }
    } catch (error) {
      console.error('Failed to load user snippets:', error);
    }
  },

  // =====================
  // AppliesTo Tester
  // =====================

  setAppliesToTesterOpen: (open) => {
    set({ appliesToTesterOpen: open });
  },

  setAppliesToExpression: (expression) => {
    set({ appliesToExpression: expression });
  },

  setAppliesToTestFrom: (from) => {
    set({ appliesToTestFrom: from });
  },

  setAppliesToFunctionSearch: (search) => {
    set({ appliesToFunctionSearch: search });
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

  // =====================
  // Custom AppliesTo Functions
  // =====================

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

  getAllFunctions: () => {
    const { customFunctions } = get();
    
    // Convert custom functions to AppliesToFunction format
    const customAsFunctions = customFunctions.map(cf => ({
      name: cf.name,
      syntax: `${cf.name}()`,
      parameters: '',
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

  // =====================
  // Debug Commands
  // =====================

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

    const progressListener = (message: { type: string; executionId?: string; payload?: unknown }) => {
      // Only handle messages for this execution
      if (message.executionId && message.executionId !== executionId) {
        return false;
      }

      if (message.type === 'DEBUG_COMMAND_UPDATE') {
        // Progress updates - could show progress in UI if needed
      } else if (message.type === 'DEBUG_COMMAND_COMPLETE') {
        set({
          debugCommandResults: (message.payload as { results: Record<number, DebugCommandResult> }).results,
          isExecutingDebugCommand: false,
          debugCommandExecutionId: null,
        });
        chrome.runtime.onMessage.removeListener(progressListener);
        activeDebugCommandListener = null;
      } else if (message.type === 'ERROR' && (message.payload as { code?: string })?.code === 'DEBUG_COMMAND_ERROR') {
        set({
          isExecutingDebugCommand: false,
          debugCommandExecutionId: null,
        });
        chrome.runtime.onMessage.removeListener(progressListener);
        activeDebugCommandListener = null;
        toast.error('Debug command execution failed', {
          description: (message.payload as { message?: string })?.message,
        });
      }
      return false;
    };

    activeDebugCommandListener = progressListener;
    chrome.runtime.onMessage.addListener(progressListener);

    try {
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

  // =====================
  // Module Snippets
  // =====================

  setModuleSnippetsDialogOpen: (open: boolean) => {
    set({ moduleSnippetsDialogOpen: open });
    if (open) {
      get().loadModuleSnippetsFromCache();
    } else {
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

    const importCode = generateModuleSnippetImport(name, version);

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
        const lines = importCode.split('\n');
        const newLineNumber = position.lineNumber + lines.length - 1;
        const newColumn = lines.length > 1 ? lines[lines.length - 1].length + 1 : position.column + lines[0].length;
        editorInstance.setPosition({ lineNumber: newLineNumber, column: newColumn });
        editorInstance.focus();
      }
    } else {
      set({
        tabs: tabs.map(t =>
          t.id === activeTabId
            ? { ...t, content: importCode + '\n' + t.content }
            : t
        ),
      } as Partial<ToolsSlice & ToolsSliceDependencies>);
    }

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

  // =====================
  // Module Lineage
  // =====================

  setModuleLineageDialogOpen: (open: boolean) => {
    set({ moduleLineageDialogOpen: open });
    if (!open) {
      set({ lineageVersions: [], lineageError: null });
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
  },

  // =====================
  // Module Details
  // =====================

  setModuleDetailsDialogOpen: (open: boolean) => {
    set({ moduleDetailsDialogOpen: open });
    if (!open) {
      set({ moduleDetailsError: null });
    }
  },

  loadModuleDetails: async (tabId: string) => {
    const { tabs, selectedPortalId, portals, moduleDetailsDraftByTabId } = get();
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

    const existingDraft = findModuleDraftForTab(moduleDetailsDraftByTabId, tabs, tabId);
    if (existingDraft) {
      set({
        moduleDetailsDraftByTabId: {
          ...moduleDetailsDraftByTabId,
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
      const portal = portals.find(p => p.id === binding.portalId);
      if (!portal) {
        throw new Error('Portal not found');
      }

      const currentTabs = await chrome.tabs.query({ url: `https://${portal.hostname}/*` });
      if (currentTabs.length === 0) {
        throw new Error('No LogicMonitor tab found');
      }
      const lmTab = currentTabs[0];
      if (!lmTab.id) {
        throw new Error('Invalid tab ID');
      }

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

        const draft = { ...metadata };
        const dirtyFields = new Set<string>();

        const moduleTabIds = getModuleTabIds(tabs, tabId);
        const updatedDrafts = { ...moduleDetailsDraftByTabId };
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

  updateModuleDetailsField: async (tabId: string, field: string, value: unknown) => {
    const { tabs, moduleDetailsDraftByTabId } = get();
    const draft = moduleDetailsDraftByTabId[tabId];
    if (!draft) return;

    const normalizedValue = field === 'accessGroupIds' ? normalizeAccessGroupIds(value) : value;
    const newDraft = { ...draft.draft, [field]: normalizedValue };
    const newDirtyFields = new Set(draft.dirtyFields);
    
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

    const moduleTabIds = getModuleTabIds(tabs, tabId);
    const updatedDrafts = { ...moduleDetailsDraftByTabId };
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
    const { tabs, moduleDetailsDraftByTabId } = get();
    const draft = moduleDetailsDraftByTabId[tabId];
    if (!draft) return;

    const moduleTabIds = getModuleTabIds(tabs, tabId);
    const updatedDrafts = { ...moduleDetailsDraftByTabId };
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

      const currentTabs = await chrome.tabs.query({ url: `https://${portal.hostname}/*` });
      if (currentTabs.length === 0) {
        throw new Error('No LogicMonitor tab found');
      }
      const lmTab = currentTabs[0];
      if (!lmTab.id) {
        throw new Error('Invalid tab ID');
      }

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
        set({
          moduleDetailsError: response.payload.error || 'Failed to fetch access groups',
          isLoadingAccessGroups: false,
        });
      } else {
        set({
          moduleDetailsError: 'Unknown error occurred',
          isLoadingAccessGroups: false,
        });
      }
    } catch (error) {
      console.error('[fetchAccessGroups] Error:', error);
      set({
        moduleDetailsError: error instanceof Error ? error.message : 'Failed to fetch access groups',
        isLoadingAccessGroups: false,
      });
    }
  },
});
