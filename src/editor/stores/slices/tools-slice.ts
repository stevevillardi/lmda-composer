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
} from '@/shared/types';

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
  editingSnippet: Snippet | null;
  
  // AppliesTo tester
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
  debugCommandResults: Record<number, DebugCommandResult>;
  isExecutingDebugCommand: boolean;
  
  // Module Snippets
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
  isLoadingLineage: boolean;
  lineageError: string | null;
  selectedLineageVersion: LineageVersion | null;
  
  // Module details
  moduleDetailsSheetOpen: boolean;
  moduleDetailsSheetTabId: string | null;
  moduleDetailsDraftByTabId: Record<string, {
    portalId: string;
    moduleId: number;
    moduleType: string;
    fields: Record<string, unknown>;
  }>;
  isLoadingModuleDetails: boolean;
  isSavingModuleDetails: boolean;
  moduleDetailsError: string | null;
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
  setEditingSnippet: (snippet: Snippet | null) => void;
  createUserSnippet: (snippet: Omit<Snippet, 'id' | 'isBuiltIn'>) => void;
  updateUserSnippet: (id: string, updates: Partial<Omit<Snippet, 'id' | 'isBuiltIn'>>) => void;
  deleteUserSnippet: (id: string) => void;
  loadUserSnippets: () => Promise<void>;
  
  // AppliesTo tester
  setAppliesToExpression: (expression: string) => void;
  setAppliesToTestFrom: (from: 'devicesGroup' | 'websiteGroup') => void;
  setAppliesToFunctionSearch: (search: string) => void;
  testAppliesTo: () => Promise<void>;
  clearAppliesToResults: () => void;
  insertAppliesToFunction: (func: CustomAppliesToFunction) => void;
  
  // Custom AppliesTo functions
  loadCustomFunctions: () => Promise<void>;
  createCustomFunction: (func: Omit<CustomAppliesToFunction, 'id'>) => Promise<void>;
  updateCustomFunction: (id: number, updates: Partial<Omit<CustomAppliesToFunction, 'id'>>) => Promise<void>;
  deleteCustomFunction: (id: number) => Promise<void>;
  
  // Debug commands
  executeDebugCommand: (collectorId: number, command: string) => Promise<void>;
  clearDebugResults: () => void;
  
  // Module Snippets
  loadModuleSnippets: () => Promise<void>;
  setSelectedModuleSnippet: (snippet: { name: string; version: string } | null) => void;
  loadModuleSnippetSource: (name: string, version: string) => Promise<void>;
  setModuleSnippetsSearchQuery: (query: string) => void;
  insertModuleSnippet: (name: string, version: string) => void;
  
  // Module lineage
  setModuleLineageDialogOpen: (open: boolean) => void;
  loadModuleLineage: (tabId: string) => Promise<void>;
  setSelectedLineageVersion: (version: LineageVersion | null) => void;
  openLineageVersion: (version: LineageVersion, tabId: string) => Promise<void>;
  restoreLineageVersion: (version: LineageVersion, tabId: string) => Promise<void>;
  
  // Module details
  setModuleDetailsSheetOpen: (open: boolean) => void;
  setModuleDetailsSheetTabId: (tabId: string | null) => void;
  loadModuleDetails: (tabId: string) => Promise<void>;
  updateModuleDetailsDraft: (tabId: string, field: string, value: unknown) => void;
  saveModuleDetails: (tabId: string) => Promise<void>;
  discardModuleDetailsDraft: (tabId: string) => void;
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
  editingSnippet: null,
  
  // AppliesTo tester
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
  debugCommandResults: {},
  isExecutingDebugCommand: false,
  
  // Module Snippets
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
  isLoadingLineage: false,
  lineageError: null,
  selectedLineageVersion: null,
  
  // Module details
  moduleDetailsSheetOpen: false,
  moduleDetailsSheetTabId: null,
  moduleDetailsDraftByTabId: {},
  isLoadingModuleDetails: false,
  isSavingModuleDetails: false,
  moduleDetailsError: null,
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
  setEditingSnippet: (snippet) => set({ editingSnippet: snippet }),
  createUserSnippet: () => { /* Implemented in editor-store.ts */ },
  updateUserSnippet: () => { /* Implemented in editor-store.ts */ },
  deleteUserSnippet: () => { /* Implemented in editor-store.ts */ },
  loadUserSnippets: async () => { /* Implemented in editor-store.ts */ },
  
  setAppliesToExpression: (expression) => set({ appliesToExpression: expression }),
  setAppliesToTestFrom: (from) => set({ appliesToTestFrom: from }),
  setAppliesToFunctionSearch: (search) => set({ appliesToFunctionSearch: search }),
  testAppliesTo: async () => { /* Implemented in editor-store.ts */ },
  clearAppliesToResults: () => set({ appliesToResults: [], appliesToError: null }),
  insertAppliesToFunction: () => { /* Implemented in editor-store.ts */ },
  
  loadCustomFunctions: async () => { /* Implemented in editor-store.ts */ },
  createCustomFunction: async () => { /* Implemented in editor-store.ts */ },
  updateCustomFunction: async () => { /* Implemented in editor-store.ts */ },
  deleteCustomFunction: async () => { /* Implemented in editor-store.ts */ },
  
  executeDebugCommand: async () => { /* Implemented in editor-store.ts */ },
  clearDebugResults: () => set({ debugCommandResults: {} }),
  
  loadModuleSnippets: async () => { /* Implemented in editor-store.ts */ },
  setSelectedModuleSnippet: (snippet) => set({ selectedModuleSnippet: snippet }),
  loadModuleSnippetSource: async () => { /* Implemented in editor-store.ts */ },
  setModuleSnippetsSearchQuery: (query) => set({ moduleSnippetsSearchQuery: query }),
  insertModuleSnippet: () => { /* Implemented in editor-store.ts */ },
  
  setModuleLineageDialogOpen: (open) => set({ moduleLineageDialogOpen: open }),
  loadModuleLineage: async () => { /* Implemented in editor-store.ts */ },
  setSelectedLineageVersion: (version) => set({ selectedLineageVersion: version }),
  openLineageVersion: async () => { /* Implemented in editor-store.ts */ },
  restoreLineageVersion: async () => { /* Implemented in editor-store.ts */ },
  
  setModuleDetailsSheetOpen: (open) => set({ moduleDetailsSheetOpen: open }),
  setModuleDetailsSheetTabId: (tabId) => set({ moduleDetailsSheetTabId: tabId }),
  loadModuleDetails: async () => { /* Implemented in editor-store.ts */ },
  updateModuleDetailsDraft: () => { /* Implemented in editor-store.ts */ },
  saveModuleDetails: async () => { /* Implemented in editor-store.ts */ },
  discardModuleDetailsDraft: () => { /* Implemented in editor-store.ts */ },
});

