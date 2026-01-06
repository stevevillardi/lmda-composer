/**
 * Tools slice - manages AppliesTo tester, debug commands, snippets, and device properties.
 * 
 * This slice is a placeholder for future extraction from editor-store.ts.
 * The actual implementation remains in editor-store.ts for now.
 */

import type { StateCreator } from 'zustand';
import type { 
  Snippet,
  DeviceProperty,
  CustomAppliesToFunction,
  DebugCommandResult,
  ModuleSnippetInfo,
  ModuleSnippetsCacheMeta,
  LineageVersion,
  LogicModuleType,
} from '@/shared/types';

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
  isFetchingLineage: boolean;  // Note: editor-store uses isFetchingLineage, not isLoadingLineage
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
  
  // Module lineage
  setModuleLineageDialogOpen: (open: boolean) => void;
  fetchLineageVersions: (tabId: string) => Promise<number>;
  
  // Module details
  setModuleDetailsDialogOpen: (open: boolean) => void;
  loadModuleDetails: (tabId: string) => Promise<void>;
  updateModuleDetailsField: (tabId: string, field: string, value: unknown) => void;
  resetModuleDetailsDraft: (tabId: string) => void;
  fetchAccessGroups: (tabId: string) => Promise<void>;
}

/**
 * Combined slice interface.
 */
export interface ToolsSlice extends ToolsSliceState, ToolsSliceActions {}

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
// Slice Creator (Placeholder)
// ============================================================================

/**
 * Creates the tools slice.
 * 
 * Note: This is a placeholder. The actual implementation is still in editor-store.ts.
 * This file defines the types and initial state for future extraction.
 */
export const createToolsSlice: StateCreator<
  ToolsSlice,
  [],
  [],
  ToolsSlice
> = (set) => ({
  ...toolsSliceInitialState,

  // Placeholder implementations - actual logic is in editor-store.ts
  fetchDeviceProperties: async () => { /* Implemented in editor-store.ts */ },
  setPropertiesSearchQuery: (query) => set({ propertiesSearchQuery: query }),
  clearDeviceProperties: () => set({ deviceProperties: [], selectedDeviceId: null }),
  insertPropertyAccess: () => { /* Implemented in editor-store.ts */ },
  
  setSnippetsSearchQuery: (query) => set({ snippetsSearchQuery: query }),
  setSnippetCategoryFilter: (filter) => set({ snippetCategoryFilter: filter }),
  setSnippetLanguageFilter: (filter) => set({ snippetLanguageFilter: filter }),
  setSnippetSourceFilter: (filter) => set({ snippetSourceFilter: filter }),
  insertSnippet: () => { /* Implemented in editor-store.ts */ },
  setCreateSnippetDialogOpen: (open) => set({ createSnippetDialogOpen: open }),
  setEditingSnippet: (snippet) => set({ editingSnippet: snippet, createSnippetDialogOpen: snippet !== null }),
  createUserSnippet: () => { /* Implemented in editor-store.ts */ },
  updateUserSnippet: () => { /* Implemented in editor-store.ts */ },
  deleteUserSnippet: () => { /* Implemented in editor-store.ts */ },
  loadUserSnippets: async () => { /* Implemented in editor-store.ts */ },
  
  setAppliesToTesterOpen: (open) => set({ appliesToTesterOpen: open }),
  setAppliesToExpression: (expression) => set({ appliesToExpression: expression }),
  setAppliesToTestFrom: (from) => set({ appliesToTestFrom: from }),
  setAppliesToFunctionSearch: (search) => set({ appliesToFunctionSearch: search }),
  testAppliesTo: async () => { /* Implemented in editor-store.ts */ },
  clearAppliesToResults: () => set({ appliesToResults: [], appliesToError: null }),
  
  fetchCustomFunctions: async () => { /* Implemented in editor-store.ts */ },
  createCustomFunction: async () => { /* Implemented in editor-store.ts */ },
  updateCustomFunction: async () => { /* Implemented in editor-store.ts */ },
  deleteCustomFunction: async () => { /* Implemented in editor-store.ts */ },
  getAllFunctions: () => [], // Implemented in editor-store.ts
  
  setDebugCommandsDialogOpen: (open) => set({ debugCommandsDialogOpen: open }),
  executeDebugCommand: async () => { /* Implemented in editor-store.ts */ },
  cancelDebugCommandExecution: async () => { /* Implemented in editor-store.ts */ },
  
  setModuleSnippetsDialogOpen: (open) => set({ moduleSnippetsDialogOpen: open }),
  fetchModuleSnippets: async () => { /* Implemented in editor-store.ts */ },
  loadModuleSnippetsFromCache: async () => { /* Implemented in editor-store.ts */ },
  selectModuleSnippet: () => { /* Implemented in editor-store.ts */ },
  fetchModuleSnippetSource: async () => { /* Implemented in editor-store.ts */ },
  insertModuleSnippetImport: () => { /* Implemented in editor-store.ts */ },
  setModuleSnippetsSearchQuery: (query) => set({ moduleSnippetsSearchQuery: query }),
  
  setModuleLineageDialogOpen: (open) => set({ moduleLineageDialogOpen: open }),
  fetchLineageVersions: async () => 0, // Implemented in editor-store.ts
  
  setModuleDetailsDialogOpen: (open) => set({ moduleDetailsDialogOpen: open }),
  loadModuleDetails: async () => { /* Implemented in editor-store.ts */ },
  updateModuleDetailsField: () => { /* Implemented in editor-store.ts */ },
  resetModuleDetailsDraft: () => { /* Implemented in editor-store.ts */ },
  fetchAccessGroups: async () => { /* Implemented in editor-store.ts */ },
});

