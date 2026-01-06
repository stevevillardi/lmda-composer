/**
 * Module slice - manages module browser, search, commit, clone, and pull operations.
 * 
 * This slice handles:
 * - Module browser (listing and selecting modules from portal)
 * - Module search (searching scripts and datapoints across modules)
 * - Module commit (pushing script changes back to portal)
 * - Module clone (cloning modules to local git repository)
 * - Pull latest (pulling latest module version from portal)
 * - Repository browser
 */

import type { StateCreator } from 'zustand';
import type { 
  LogicModuleType,
  LogicModuleInfo,
  ModuleSearchMatchType,
  ScriptSearchResult,
  DataPointSearchResult,
  ModuleSearchProgress,
  ModuleIndexInfo,
  CloneResult,
  ScriptLanguage,
  ScriptMode,
  EditorTab,
  Portal,
  FetchModulesResponse,
} from '@/shared/types';
import type { ModuleDetailsDraft } from './tools-slice';
import { toast } from 'sonner';
import { hasPortalChanges } from '../../utils/document-helpers';
import { getPortalBindingStatus } from '../../utils/portal-binding';
import { MODULE_TYPE_SCHEMAS, getSchemaFieldName } from '@/shared/module-type-schemas';
import * as documentStore from '../../utils/document-store';

// ============================================================================
// Types
// ============================================================================

/**
 * State managed by the module slice.
 */
export interface ModuleSliceState {
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
  
  // Module commit state
  isCommittingModule: boolean;
  moduleCommitError: string | null;
  moduleCommitConfirmationOpen: boolean;
  loadedModuleForCommit: LogicModuleInfo | null;
  moduleCommitConflict: { hasConflict: boolean; message?: string; portalVersion?: number } | null;
  
  // Save options dialog (for portal documents)
  saveOptionsDialogOpen: boolean;
  saveOptionsDialogTabId: string | null;
  
  // Module clone to repository
  cloneModuleDialogOpen: boolean;
  
  // Pull latest from portal
  pullLatestDialogOpen: boolean;
  isPullingLatest: boolean;
  
  // Repository browser
  repositoryBrowserOpen: boolean;
}

/**
 * Actions provided by the module slice.
 */
export interface ModuleSliceActions {
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
  
  // Module-specific tab actions (has portal dependencies)
  openModuleScripts: (module: LogicModuleInfo, scripts: Array<{ type: 'ad' | 'collection'; content: string }>) => void;
  
  // Module commit actions
  fetchModuleForCommit: (tabId: string) => Promise<void>;
  commitModuleScript: (tabId: string, reason?: string) => Promise<void>;
  canCommitModule: (tabId: string) => boolean;
  setModuleCommitConfirmationOpen: (open: boolean) => void;
  
  // Save options dialog
  setSaveOptionsDialogOpen: (open: boolean, tabId?: string) => void;
  
  // Module clone to repository actions
  setCloneModuleDialogOpen: (open: boolean) => void;
  cloneModuleToRepository: (tabId: string, repositoryId: string | null, overwrite?: boolean) => Promise<CloneResult>;
  canCloneModule: (tabId: string) => boolean;
  
  // Pull latest from portal actions
  setPullLatestDialogOpen: (open: boolean) => void;
  pullLatestFromPortal: (tabId: string) => Promise<{ success: boolean; error?: string }>;
  canPullLatest: (tabId: string) => boolean;
  
  // Repository browser
  setRepositoryBrowserOpen: (open: boolean) => void;
}

/**
 * Combined slice interface.
 */
export interface ModuleSlice extends ModuleSliceState, ModuleSliceActions {}

/**
 * Dependencies from other slices needed by ModuleSlice.
 */
export interface ModuleSliceDependencies {
  // From TabsSlice
  tabs: EditorTab[];
  activeTabId: string | null;
  openTab: (tabData: Partial<EditorTab> & Pick<EditorTab, 'displayName' | 'content' | 'language' | 'mode'>) => string;
  
  // From PortalSlice
  selectedPortalId: string | null;
  portals: Portal[];
  
  // From ToolsSlice (for commit)
  moduleDetailsDraftByTabId: Record<string, ModuleDetailsDraft>;
}

// ============================================================================
// Initial State
// ============================================================================

const emptyModuleCache = {
  datasource: [],
  configsource: [],
  topologysource: [],
  propertysource: [],
  logsource: [],
  diagnosticsource: [],
  eventsource: [],
};

const emptyModuleMeta = {
  datasource: { offset: 0, hasMore: true, total: 0 },
  configsource: { offset: 0, hasMore: true, total: 0 },
  topologysource: { offset: 0, hasMore: true, total: 0 },
  propertysource: { offset: 0, hasMore: true, total: 0 },
  logsource: { offset: 0, hasMore: true, total: 0 },
  diagnosticsource: { offset: 0, hasMore: true, total: 0 },
  eventsource: { offset: 0, hasMore: true, total: 0 },
};

const emptyModuleSearch = {
  datasource: '',
  configsource: '',
  topologysource: '',
  propertysource: '',
  logsource: '',
  diagnosticsource: '',
  eventsource: '',
};

export const moduleSliceInitialState: ModuleSliceState = {
  // Module browser
  moduleBrowserOpen: false,
  selectedModuleType: 'datasource',
  modulesCache: emptyModuleCache,
  modulesMeta: emptyModuleMeta,
  modulesSearch: emptyModuleSearch,
  isFetchingModules: false,
  selectedModule: null,
  moduleSearchQuery: '',
  
  // Module search
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
  
  // Pending load confirmation
  pendingModuleLoad: null,
  
  // Module commit state
  isCommittingModule: false,
  moduleCommitError: null,
  moduleCommitConfirmationOpen: false,
  loadedModuleForCommit: null,
  moduleCommitConflict: null,
  
  // Save options dialog
  saveOptionsDialogOpen: false,
  saveOptionsDialogTabId: null,
  
  // Clone module
  cloneModuleDialogOpen: false,
  
  // Pull latest
  pullLatestDialogOpen: false,
  isPullingLatest: false,
  
  // Repository browser
  repositoryBrowserOpen: false,
};

// ============================================================================
// Module-level state for search listener management
// ============================================================================

let activeModuleSearchListener: ((message: unknown) => boolean) | null = null;

// ============================================================================
// Helper Functions
// ============================================================================

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Creates the module slice.
 */
export const createModuleSlice: StateCreator<
  ModuleSlice & ModuleSliceDependencies,
  [],
  [],
  ModuleSlice
> = (set, get) => ({
  ...moduleSliceInitialState,

  // ==========================================================================
  // Module Browser Actions
  // ==========================================================================

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
    } as Partial<ModuleSlice & ModuleSliceDependencies>);
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
    } as Partial<ModuleSlice & ModuleSliceDependencies>);
  },

  cancelModuleLoad: () => {
    set({ pendingModuleLoad: null });
  },

  // ==========================================================================
  // Module Search Actions
  // ==========================================================================

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

    activeModuleSearchListener = (message: unknown) => {
      const msg = message as { type?: string; payload?: { searchId?: string } };
      if (msg.type === 'MODULE_SEARCH_PROGRESS' && msg.payload?.searchId === searchId) {
        set({ moduleSearchProgress: msg.payload as ModuleSearchProgress });
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

    activeModuleSearchListener = (message: unknown) => {
      const msg = message as { type?: string; payload?: { searchId?: string } };
      if (msg.type === 'MODULE_SEARCH_PROGRESS' && msg.payload?.searchId === searchId) {
        set({ moduleSearchProgress: msg.payload as ModuleSearchProgress });
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

    activeModuleSearchListener = (message: unknown) => {
      const msg = message as { type?: string; payload?: { searchId?: string } };
      if (msg.type === 'MODULE_SEARCH_PROGRESS' && msg.payload?.searchId === searchId) {
        set({ moduleSearchProgress: msg.payload as ModuleSearchProgress });
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

  // ==========================================================================
  // Module-Specific Tab Actions
  // ==========================================================================

  openModuleScripts: (module, scripts) => {
    const { tabs, selectedPortalId, portals } = get();
    const extension = module.scriptType === 'powerShell' ? 'ps1' : 'groovy';
    const language: ScriptLanguage = module.scriptType === 'powerShell' ? 'powershell' : 'groovy';
    const portal = portals.find((entry) => entry.id === selectedPortalId);
    
    const newTabs: EditorTab[] = [];
    
    for (const script of scripts) {
      const modeLabel = script.type === 'ad' ? 'AD' : 'Collection';
      const displayName = `${module.name} (${modeLabel}).${extension}`;
      
      // Determine proper mode based on script type
      const mode: ScriptMode = script.type === 'ad' ? 'ad' : 'collection';
      
      const newTab: EditorTab = {
        id: crypto.randomUUID(),
        displayName,
        content: script.content,
        language,
        mode,
        originalContent: script.content, // For dirty detection
        source: {
          type: 'module',
          moduleId: module.id,
          moduleName: module.name,
          moduleType: module.moduleType,
          scriptType: script.type,
          lineageId: module.lineageId,
          portalId: selectedPortalId || undefined,
          portalHostname: portal?.hostname,
        },
      };
      
      newTabs.push(newTab);
    }
    
    if (newTabs.length > 0) {
      set({
        tabs: [...tabs, ...newTabs],
        activeTabId: newTabs[0].id,
        moduleBrowserOpen: false,
        selectedModule: null,
        moduleSearchQuery: '',
      } as Partial<ModuleSlice & ModuleSliceDependencies>);
    }
  },

  // ==========================================================================
  // Module Commit Actions
  // ==========================================================================

  setModuleCommitConfirmationOpen: (open: boolean) => {
    set({ moduleCommitConfirmationOpen: open });
    if (!open) {
      set({ loadedModuleForCommit: null, moduleCommitError: null, moduleCommitConflict: null });
    }
  },

  canCommitModule: (tabId: string) => {
    const { tabs, selectedPortalId, portals, moduleDetailsDraftByTabId } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return false;
    if (tab.source?.type !== 'module') return false;
    const binding = getPortalBindingStatus(tab, selectedPortalId, portals);
    if (!binding.isActive) return false;
    
    // Use unified helper to check for portal changes
    const hasScriptChanges = hasPortalChanges(tab);
    
    // Check for module details changes
    const moduleDetailsDraft = moduleDetailsDraftByTabId[tabId];
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
        
        // Store conflict info
        set({ 
          loadedModuleForCommit: moduleInfo,
          moduleCommitConflict: hasConflict ? {
            hasConflict: true,
            message: 'The module has been modified in the portal since you last pulled. Your local copy may not include the latest changes.',
            portalVersion: module.version,
          } : { hasConflict: false },
        });
        
        // If there's a conflict, update the originalContent to the current server state
        if (hasConflict && currentScript !== originalContent) {
          set({
            tabs: tabs.map(t =>
              t.id === tabId
                ? { ...t, originalContent: currentScript }
                : t
            ),
          } as Partial<ModuleSlice & ModuleSliceDependencies>);
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
      let moduleDetailsPayload: Record<string, unknown> | undefined;

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
          isCommittingModule: false,
          moduleCommitConfirmationOpen: false,
          loadedModuleForCommit: null,
        } as Partial<ModuleSlice & ModuleSliceDependencies>);
        
        // Note: moduleDetailsDraftByTabId is managed by ToolsSlice
        // The caller should handle updating it if needed
        
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

  // ==========================================================================
  // Save Options Dialog
  // ==========================================================================

  setSaveOptionsDialogOpen: (open: boolean, tabId?: string) => {
    set({ 
      saveOptionsDialogOpen: open, 
      saveOptionsDialogTabId: tabId ?? null,
    });
  },

  // ==========================================================================
  // Module Clone to Repository Actions
  // ==========================================================================

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
    } = await import('../../utils/module-repository');
    
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
      } as LogicModuleInfo;
      
      // Gather scripts from all tabs for this module
      const scripts: { 
        collection?: { content: string; language: ScriptLanguage }; 
        ad?: { content: string; language: ScriptLanguage };
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
        set({ tabs: updatedTabs } as Partial<ModuleSlice & ModuleSliceDependencies>);
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

  // ==========================================================================
  // Pull Latest from Portal Actions
  // ==========================================================================

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
        
        set({ tabs: updatedTabs, isPullingLatest: false } as Partial<ModuleSlice & ModuleSliceDependencies>);
        
        // Update local files if this is a repository-backed tab
        if (tab.hasFileHandle && tab.isLocalFile) {
          try {
            const { getModuleFile } = await import('../../utils/document-store');
            const { updateModuleFilesAfterPull } = await import('../../utils/module-repository');
            
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

  // ==========================================================================
  // Repository Browser
  // ==========================================================================

  setRepositoryBrowserOpen: (open: boolean) => {
    set({ repositoryBrowserOpen: open });
  },
});
