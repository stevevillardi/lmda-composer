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
import { sendMessage } from '../../utils/chrome-messaging';
import * as documentStore from '../../utils/document-store';
import { EDITABLE_MODULE_DETAILS_FIELDS } from '../../utils/document-helpers';
import type { ModuleDirectoryConfig } from '@/shared/types';

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

import { MessageListenerManager } from '@/editor/utils/message-listener';

interface DebugCommandMessage {
  type: string;
  executionId?: string;
  payload?: unknown;
}

/**
 * Specialized listener manager for debug commands.
 * Handles complete, update, and error message types.
 */
class DebugCommandListenerManager extends MessageListenerManager<DebugCommandMessage> {
  /**
   * Starts listening for debug command updates for a specific execution.
   */
  startWithCallbacks(
    executionId: string,
    callbacks: {
      onComplete: (results: Record<number, DebugCommandResult>) => void;
      onError: (message: string) => void;
    }
  ): void {
    this.start(executionId, (message) => {
      // Only handle messages for this execution
      if (message.executionId && message.executionId !== executionId) {
        return;
      }

      if (message.type === 'DEBUG_COMMAND_COMPLETE') {
        callbacks.onComplete((message.payload as { results: Record<number, DebugCommandResult> }).results);
        return true; // Signal cleanup
      } else if (message.type === 'ERROR' && (message.payload as { code?: string })?.code === 'DEBUG_COMMAND_ERROR') {
        callbacks.onError((message.payload as { message?: string })?.message || 'Debug command failed');
        return true; // Signal cleanup
      }
      // DEBUG_COMMAND_UPDATE is for progress - no action needed currently
    });
  }
}

// Singleton instance for debug command listener management
const debugCommandListenerManager = new DebugCommandListenerManager();

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
export interface ModuleMetadata {
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
  /** Conflict state when portal details differ from local baseline */
  moduleDetailsConflict: {
    hasConflict: boolean;
    message?: string;
    portalVersion?: number;
    conflictingFields?: string[];
  } | null;
  /** Is a background refresh in progress to check for conflicts */
  isRefreshingModuleDetails: boolean;
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
  loadModuleDetails: (tabId: string, forceRefresh?: boolean) => Promise<void>;
  refreshModuleDetailsBaseline: (tabId: string) => Promise<void>;
  clearModuleDetailsConflict: () => void;
  resolveModuleDetailsConflict: (tabId: string, resolution: 'keep-local' | 'use-portal') => Promise<void>;
  updateModuleDetailsField: (tabId: string, field: string, value: unknown) => Promise<void>;
  resetModuleDetailsDraft: (tabId: string) => void;
  persistModuleDetailsToDirectory: (tabId: string) => Promise<boolean>;
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
  moduleDetailsConflict: null,
  isRefreshingModuleDetails: false,
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

    const result = await sendMessage({
        type: 'GET_DEVICE_PROPERTIES',
        payload: { portalId: selectedPortalId, deviceId },
      });

      const current = get();
      if (current.selectedPortalId !== fetchingPortal || current.selectedDeviceId !== fetchingDevice) {
        return;
      }

    if (result.ok) {
      set({ deviceProperties: result.data as DeviceProperty[], isFetchingProperties: false });
      } else {
      console.error('Failed to fetch device properties:', result.error);
        toast.error('Failed to load properties', {
        description: result.error || 'Unable to fetch device properties',
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
    
    const result = await sendMessage({
        type: 'TEST_APPLIES_TO',
        payload: {
          portalId: selectedPortalId,
          currentAppliesTo: appliesToExpression,
          testFrom: appliesToTestFrom,
        },
      });
      
    if (result.ok) {
      const payload = result.data as { currentMatches?: Array<{ type: string; id: number; name: string }>; warnMessage?: string };
        set({ 
        appliesToResults: payload.currentMatches || [],
        appliesToError: payload.warnMessage || null,
          isTestingAppliesTo: false,
        });
    } else {
        set({ 
        appliesToError: result.error || 'Failed to test AppliesTo',
          appliesToResults: [],
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
    
    const result = await sendMessage({
        type: 'FETCH_CUSTOM_FUNCTIONS',
        payload: { portalId: selectedPortalId },
      });
      
    if (result.ok) {
        set({ 
        customFunctions: result.data as CustomAppliesToFunction[],
          isLoadingCustomFunctions: false,
        });
      } else {
        set({ 
        customFunctionError: result.error || 'Failed to fetch custom functions',
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
    
    const result = await sendMessage({
        type: 'CREATE_CUSTOM_FUNCTION',
        payload: { portalId: selectedPortalId, name, code, description },
      });
      
    if (result.ok) {
        set({ 
        customFunctions: [...get().customFunctions, result.data as CustomAppliesToFunction],
          isCreatingFunction: false,
        });
      } else {
        set({ 
        customFunctionError: result.error,
          isCreatingFunction: false,
        });
      throw new Error(result.error);
    }
  },

  updateCustomFunction: async (id: number, name: string, code: string, description?: string) => {
    const { selectedPortalId } = get();
    
    if (!selectedPortalId) {
      throw new Error('Please select a portal first');
    }
    
    set({ isUpdatingFunction: true, customFunctionError: null });
    
    const result = await sendMessage({
        type: 'UPDATE_CUSTOM_FUNCTION',
        payload: { portalId: selectedPortalId, functionId: id, name, code, description },
      });
      
    if (result.ok) {
        set({ 
          customFunctions: get().customFunctions.map(f => 
          f.id === id ? (result.data as CustomAppliesToFunction) : f
          ),
          isUpdatingFunction: false,
        });
      } else {
        set({ 
        customFunctionError: result.error,
          isUpdatingFunction: false,
        });
      throw new Error(result.error);
    }
  },

  deleteCustomFunction: async (id: number) => {
    const { selectedPortalId } = get();
    
    if (!selectedPortalId) {
      throw new Error('Please select a portal first');
    }
    
    set({ isDeletingFunction: true, customFunctionError: null });
    
    const result = await sendMessage({
        type: 'DELETE_CUSTOM_FUNCTION',
        payload: { portalId: selectedPortalId, functionId: id },
      });
      
    if (result.ok) {
        set({ 
          customFunctions: get().customFunctions.filter(f => f.id !== id),
          isDeletingFunction: false,
        });
      } else {
        set({ 
        customFunctionError: result.error,
          isDeletingFunction: false,
        });
      throw new Error(result.error);
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

    // Use managed listener for proper cleanup
    debugCommandListenerManager.startWithCallbacks(executionId, {
      onComplete: (results) => {
        set({
          debugCommandResults: results,
          isExecutingDebugCommand: false,
          debugCommandExecutionId: null,
        });
      },
      onError: (message) => {
        set({
          isExecutingDebugCommand: false,
          debugCommandExecutionId: null,
        });
        toast.error('Debug command execution failed', {
          description: message,
        });
      },
    });

    const result = await sendMessage({
        type: 'EXECUTE_DEBUG_COMMAND',
        payload: { ...request, executionId },
      });
    
    if (!result.ok) {
      set({ isExecutingDebugCommand: false, debugCommandExecutionId: null });
      debugCommandListenerManager.cleanup();
      toast.error('Failed to execute debug command', {
        description: result.error,
      });
    }
  },

  cancelDebugCommandExecution: async () => {
    const { debugCommandExecutionId } = get();
    if (!debugCommandExecutionId) {
      return;
    }

    const result = await sendMessage({
        type: 'CANCEL_DEBUG_COMMAND',
        payload: { executionId: debugCommandExecutionId },
      });
    
    if (result.ok) {
      set({
        isExecutingDebugCommand: false,
        debugCommandExecutionId: null,
      });
      debugCommandListenerManager.cleanup();
      toast.info('Debug command execution cancelled');
    } else {
      toast.error('Failed to cancel debug command', {
        description: result.error,
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
    const result = await sendMessage({
        type: 'GET_MODULE_SNIPPETS_CACHE',
      });
    
    if (result.ok && result.data) {
      const payload = result.data as { snippets: ModuleSnippetInfo[]; meta: ModuleSnippetsCacheMeta; cachedSourceKeys?: string[] };
        set({
        moduleSnippets: payload.snippets,
        moduleSnippetsCacheMeta: payload.meta,
        cachedSnippetVersions: new Set(payload.cachedSourceKeys || []),
        });
    } else if (!result.ok) {
      console.error('Failed to load module snippets from cache:', result.error);
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

    const result = await sendMessage({
        type: 'FETCH_MODULE_SNIPPETS',
        payload: { portalId: selectedPortalId, collectorId: selectedCollectorId },
      });

    if (result.ok) {
      const payload = result.data as { snippets: ModuleSnippetInfo[]; meta: ModuleSnippetsCacheMeta };
        set({
        moduleSnippets: payload.snippets,
        moduleSnippetsCacheMeta: payload.meta,
          moduleSnippetsLoading: false,
        });
        toast.success('Module snippets loaded', {
        description: `Found ${payload.snippets.length} module snippets.`,
        });
      } else {
      set({ moduleSnippetsLoading: false });
      toast.error('Failed to fetch module snippets', {
        description: result.error,
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

    const result = await sendMessage({
        type: 'FETCH_MODULE_SNIPPET_SOURCE',
        payload: { portalId: selectedPortalId, collectorId: selectedCollectorId, name, version },
      });

    if (result.ok) {
        const { cachedSnippetVersions } = get();
        const newCached = new Set(cachedSnippetVersions);
        newCached.add(`${name}:${version}`);
        set({
        moduleSnippetSource: (result.data as { code: string }).code,
          moduleSnippetSourceLoading: false,
          cachedSnippetVersions: newCached,
        });
      } else {
      set({ moduleSnippetSourceLoading: false });
      toast.error('Failed to fetch snippet source', {
        description: result.error,
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
    const result = await sendMessage({
        type: 'CLEAR_MODULE_SNIPPETS_CACHE',
      });
    
    if (result.ok) {
      set({
        moduleSnippets: [],
        moduleSnippetsCacheMeta: null,
        selectedModuleSnippet: null,
        moduleSnippetSource: null,
        cachedSnippetVersions: new Set<string>(),
      });
      toast.success('Module snippets cache cleared');
    } else {
      toast.error('Failed to clear cache', {
        description: result.error,
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

    const result = await sendMessage({
        type: 'FETCH_LINEAGE_VERSIONS',
        payload: {
          portalId: binding.portalId,
          moduleType: tab.source.moduleType,
          lineageId: tab.source.lineageId,
        },
      });

    if (result.ok) {
      const versions = (result.data as { versions?: LineageVersion[] }).versions || [];
        set({
          lineageVersions: versions,
          isFetchingLineage: false,
        });
        return versions.length;
      } else {
      set({ lineageError: result.error, isFetchingLineage: false });
      throw new Error(result.error);
    }
  },

  // =====================
  // Module Details
  // =====================

  setModuleDetailsDialogOpen: (open: boolean) => {
    set({ moduleDetailsDialogOpen: open });
    if (!open) {
      set({ moduleDetailsError: null, moduleDetailsConflict: null });
    }
  },

  loadModuleDetails: async (tabId: string, forceRefresh?: boolean) => {
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
    if (existingDraft && !forceRefresh) {
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

      // Service worker validates tab ID using portalManager.getValidTabIdForPortal()
      const result = await sendMessage({
        type: 'FETCH_MODULE_DETAILS',
        payload: {
          portalId: binding.portalId,
          moduleType,
          moduleId,
        },
      });

      if (result.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const module = (result.data as { module: any }).module;
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
      } else {
        set({ moduleDetailsError: result.error || 'Failed to fetch module details', moduleDetailsLoading: false });
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

  clearModuleDetailsConflict: () => {
    set({ moduleDetailsConflict: null });
  },

  refreshModuleDetailsBaseline: async (tabId: string) => {
    const { tabs, selectedPortalId, portals, moduleDetailsDraftByTabId } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || tab.source?.type !== 'module') return;

    const source = tab.source;
    if (!source.moduleId || !source.moduleType || !source.portalId) return;

    const existingDraft = moduleDetailsDraftByTabId[tabId];
    if (!existingDraft) return;

    set({ isRefreshingModuleDetails: true });

    try {
      const binding = ensurePortalBindingActive(tab, selectedPortalId, portals);

      const result = await sendMessage({
        type: 'FETCH_MODULE_DETAILS',
        payload: {
          portalId: binding.portalId,
          moduleType: source.moduleType,
          moduleId: source.moduleId,
        },
      });

      if (result.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const module = (result.data as { module: any }).module;
        const portalVersion = module.version || 0;

        // Compare portal version with our stored baseline
        if (portalVersion !== existingDraft.version) {
          // Find which fields differ using the shared editable fields list
          const conflictingFields: string[] = [];
          
          for (const { key } of EDITABLE_MODULE_DETAILS_FIELDS) {
            const originalValue = existingDraft.original?.[key as keyof typeof existingDraft.original];
            const portalValue = module[key];
            // Handle array comparisons (like accessGroupIds)
            const originalStr = JSON.stringify(originalValue);
            const portalStr = JSON.stringify(portalValue);
            if (originalStr !== portalStr) {
              conflictingFields.push(key);
            }
          }

          if (conflictingFields.length > 0) {
            set({
              moduleDetailsConflict: {
                hasConflict: true,
                message: 'Module details have been modified in the portal since you last opened them.',
                portalVersion,
                conflictingFields,
              },
              isRefreshingModuleDetails: false,
            });
            return;
          }
        }

        set({ moduleDetailsConflict: null, isRefreshingModuleDetails: false });
      } else {
        set({ isRefreshingModuleDetails: false });
      }
    } catch (error) {
      console.error('[refreshModuleDetailsBaseline] Error:', error);
      set({ isRefreshingModuleDetails: false });
    }
  },

  resolveModuleDetailsConflict: async (tabId: string, resolution: 'keep-local' | 'use-portal') => {
    const { tabs, selectedPortalId, portals, moduleDetailsDraftByTabId } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || tab.source?.type !== 'module') return;

    const source = tab.source;
    if (!source.moduleId || !source.moduleType || !source.portalId) return;

    if (resolution === 'keep-local') {
      // Just clear the conflict, keep local changes
      set({ moduleDetailsConflict: null });
      return;
    }

    // Use portal version - fetch fresh and replace local draft
    set({ moduleDetailsLoading: true, moduleDetailsConflict: null });

    try {
      const binding = ensurePortalBindingActive(tab, selectedPortalId, portals);

      const result = await sendMessage({
        type: 'FETCH_MODULE_DETAILS',
        payload: {
          portalId: binding.portalId,
          moduleType: source.moduleType,
          moduleId: source.moduleId,
        },
      });

      if (result.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const module = (result.data as { module: any }).module;
        const schema = MODULE_TYPE_SCHEMAS[source.moduleType!];
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

        const metadata: Partial<ModuleMetadata> = {
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

        const moduleTabIds = getModuleTabIds(tabs, tabId);
        const updatedDrafts = { ...moduleDetailsDraftByTabId };
        moduleTabIds.forEach((id) => {
          updatedDrafts[id] = {
            original: metadata,
            draft: { ...metadata },
            dirtyFields: new Set<string>(),
            loadedAt: Date.now(),
            tabId: id,
            moduleId: source.moduleId!,
            moduleType: source.moduleType!,
            portalId: source.portalId,
            version: module.version || 0,
          };
        });

        set({
          moduleDetailsDraftByTabId: updatedDrafts,
          moduleDetailsLoading: false,
        });
        
        toast.success('Module details refreshed from portal');
      } else {
        set({ 
          moduleDetailsError: result.error || 'Failed to fetch module details', 
          moduleDetailsLoading: false,
        });
      }
    } catch (error) {
      console.error('[resolveModuleDetailsConflict] Error:', error);
      set({
        moduleDetailsError: error instanceof Error ? error.message : 'Failed to refresh module details',
        moduleDetailsLoading: false,
      });
    }
  },

  persistModuleDetailsToDirectory: async (tabId: string) => {
    const { tabs, moduleDetailsDraftByTabId } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab) {
      return false;
    }
    
    // Only persist if tab has a directory handle
    if (!tab.directoryHandleId) {
      return false;
    }
    
    const draft = moduleDetailsDraftByTabId[tabId];
    if (!draft || draft.dirtyFields.size === 0) {
      return false;
    }
    
    try {
      // Get directory handle from IndexedDB
      const record = await documentStore.getDirectoryHandleRecord(tab.directoryHandleId);
      if (!record) {
        return false;
      }
      
      const dirHandle = record.handle;
      
      // Request permission
      let permission = await documentStore.queryDirectoryPermission(dirHandle);
      if (permission !== 'granted') {
        permission = (await documentStore.requestDirectoryPermission(dirHandle)) ? 'granted' : 'denied';
      }
      
      if (permission !== 'granted') {
        toast.error('Permission denied', { description: 'Could not write to module directory.' });
        return false;
      }
      
      // Read existing module.json
      const configJson = await documentStore.readFileFromDirectory(dirHandle, 'module.json');
      if (!configJson) {
        return false;
      }
      
      let config: ModuleDirectoryConfig;
      try {
        config = JSON.parse(configJson) as ModuleDirectoryConfig;
      } catch {
        return false;
      }
      
      // Update module details with draft values
      // portalBaseline stays the same, localDraft gets updated with user's changes
      const existingBaseline = config.moduleDetails?.portalBaseline || draft.original || {};
      const existingLocalDraft = config.moduleDetails?.localDraft || { ...existingBaseline };
      const updatedLocalDraft = { ...existingLocalDraft };
      
      // Only update the fields that were changed
      for (const field of draft.dirtyFields) {
        updatedLocalDraft[field] = draft.draft[field as keyof typeof draft.draft];
      }
      
      config.moduleDetails = {
        portalVersion: draft.version,
        lastPulledAt: config.moduleDetails?.lastPulledAt || new Date().toISOString(),
        portalBaseline: existingBaseline,
        // Store localDraft since user has made changes
        localDraft: updatedLocalDraft,
      };
      
      // Write updated module.json
      await documentStore.writeFileToDirectory(
        dirHandle,
        'module.json',
        JSON.stringify(config, null, 2)
      );
      
      toast.success('Module details saved', { description: 'Changes persisted to module directory.' });
      return true;
    } catch (error) {
      console.error('persistModuleDetailsToDirectory error:', error);
      toast.error('Failed to save', { description: 'Could not persist module details to directory.' });
      return false;
    }
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

      // Service worker validates tab ID using portalManager.getValidTabIdForPortal()
      const result = await sendMessage({
        type: 'FETCH_ACCESS_GROUPS',
        payload: {
          portalId: binding.portalId,
        },
      });

      if (result.ok) {
        const payload = result.data as { accessGroups?: Array<{ id: number; name: string }> };
        set({
          accessGroups: payload.accessGroups || [],
          isLoadingAccessGroups: false,
        });
      } else {
        set({
          moduleDetailsError: result.error || 'Failed to fetch access groups',
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
