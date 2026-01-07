/**
 * Module slice - manages module browser, search, commit, and pull operations.
 * 
 * This slice handles:
 * - Module browser (listing and selecting modules from portal)
 * - Module search (searching scripts and datapoints across modules)
 * - Module commit (pushing script changes back to portal)
 * - Pull latest (pulling latest module version from portal)
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
  ScriptLanguage,
  ScriptMode,
  EditorTab,
  Portal,
  FetchModulesResponse,
} from '@/shared/types';
import type { ModuleDetailsDraft } from './tools-slice';
import { toast } from 'sonner';
import { hasPortalChanges, updateDocumentAfterPush, updateDocumentAfterPull, getOriginalContent, createPortalDocument } from '../../utils/document-helpers';
import { getPortalBindingStatus } from '../../utils/portal-binding';
import { MODULE_TYPE_SCHEMAS, getSchemaFieldName } from '@/shared/module-type-schemas';
import { 
  isPlainObject, 
  ensurePortalBindingActive, 
  getModuleTabIds 
} from '../helpers/slice-helpers';
import { sendMessage, sendMessageIgnoreError } from '../../utils/chrome-messaging';
import * as documentStore from '../../utils/document-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Script from a module directory ready for commit.
 */
export interface DirectoryScriptForCommit {
  scriptType: 'collection' | 'ad';
  fileName: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  /** Current content on disk */
  diskContent: string;
  /** Checksum of portal content at last sync (from module.json) */
  portalChecksum: string;
  /** Portal content (fetched for diff display) */
  portalContent: string;
  /** Whether this script has changes from portal baseline */
  hasChanges: boolean;
}

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
  /** Directory scripts to push (when opening from saved module directory) */
  directoryScriptsForCommit: DirectoryScriptForCommit[] | null;
  /** Selected script types to include in push */
  selectedScriptsForCommit: Set<'collection' | 'ad'>;
  
  // Save options dialog (for portal documents)
  saveOptionsDialogOpen: boolean;
  saveOptionsDialogTabId: string | null;
  
  // Pull latest from portal
  pullLatestDialogOpen: boolean;
  isPullingLatest: boolean;
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
  toggleScriptForCommit: (scriptType: 'collection' | 'ad') => void;
  
  // Save options dialog
  setSaveOptionsDialogOpen: (open: boolean, tabId?: string) => void;
  
  // Pull latest from portal actions
  setPullLatestDialogOpen: (open: boolean) => void;
  pullLatestFromPortal: (tabId: string) => Promise<{ success: boolean; error?: string }>;
  canPullLatest: (tabId: string) => boolean;
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

export const emptyModuleCache = {
  datasource: [] as LogicModuleInfo[],
  configsource: [] as LogicModuleInfo[],
  topologysource: [] as LogicModuleInfo[],
  propertysource: [] as LogicModuleInfo[],
  logsource: [] as LogicModuleInfo[],
  diagnosticsource: [] as LogicModuleInfo[],
  eventsource: [] as LogicModuleInfo[],
};

export const emptyModuleMeta = {
  datasource: { offset: 0, hasMore: true, total: 0 },
  configsource: { offset: 0, hasMore: true, total: 0 },
  topologysource: { offset: 0, hasMore: true, total: 0 },
  propertysource: { offset: 0, hasMore: true, total: 0 },
  logsource: { offset: 0, hasMore: true, total: 0 },
  diagnosticsource: { offset: 0, hasMore: true, total: 0 },
  eventsource: { offset: 0, hasMore: true, total: 0 },
};

export const emptyModuleSearch = {
  datasource: '',
  configsource: '',
  topologysource: '',
  propertysource: '',
  logsource: '',
  diagnosticsource: '',
  eventsource: '',
};

/**
 * Creates a fresh copy of empty module state for portal switching.
 * Returns new objects to avoid shared references.
 */
export function createEmptyModuleState() {
  return {
    modulesCache: {
      datasource: [] as LogicModuleInfo[],
      configsource: [] as LogicModuleInfo[],
      topologysource: [] as LogicModuleInfo[],
      propertysource: [] as LogicModuleInfo[],
      logsource: [] as LogicModuleInfo[],
      diagnosticsource: [] as LogicModuleInfo[],
      eventsource: [] as LogicModuleInfo[],
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
    moduleSearchIndexInfo: null as ModuleIndexInfo | null,
  };
}

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
  directoryScriptsForCommit: null,
  selectedScriptsForCommit: new Set(),
  
  // Save options dialog
  saveOptionsDialogOpen: false,
  saveOptionsDialogTabId: null,
  
  // Clone module
  // Pull latest
  pullLatestDialogOpen: false,
  isPullingLatest: false,
};

// ============================================================================
// Module-level state for search listener management
// ============================================================================

/**
 * Manages module search progress listeners with proper cleanup.
 * Ensures listeners are always cleaned up, even on errors.
 */
class ModuleSearchListenerManager {
  private listener: ((message: unknown) => boolean) | null = null;
  private currentSearchId: string | null = null;

  /**
   * Starts listening for progress updates for a specific search.
   * Automatically cleans up any existing listener first.
   */
  start(searchId: string, onProgress: (progress: unknown) => void): void {
    // Always clean up first to prevent leaks
    this.cleanup();
    
    this.currentSearchId = searchId;
    this.listener = (message: unknown) => {
      const msg = message as { type?: string; payload?: { searchId?: string } };
      if (msg.type === 'MODULE_SEARCH_PROGRESS' && msg.payload?.searchId === searchId) {
        onProgress(msg.payload);
  }
      return false;
};

    chrome.runtime.onMessage.addListener(this.listener);
  }

  /**
   * Cleans up the current listener. Safe to call multiple times.
   */
  cleanup(): void {
    if (this.listener) {
      chrome.runtime.onMessage.removeListener(this.listener);
      this.listener = null;
    }
    this.currentSearchId = null;
  }

  /**
   * Gets the current search ID, if any.
   */
  getCurrentSearchId(): string | null {
    return this.currentSearchId;
  }
}

// Singleton instance for module search listener management
const searchListenerManager = new ModuleSearchListenerManager();

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

    // Safety limit to prevent infinite loops in case API misbehaves
    const MAX_RECURSIVE_PAGES = 10;
    const pages = Math.min(Math.max(1, options?.pages ?? 1), MAX_RECURSIVE_PAGES);
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

    const result = await sendMessage({
        type: 'FETCH_MODULES',
        payload: {
          portalId: selectedPortalId,
          moduleType: type,
          offset,
          size: 1000,
          search: search || undefined,
        },
      });

    if (result.ok) {
      const fetchResponse = result.data as FetchModulesResponse;
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
      console.error('Failed to fetch modules:', result.error);
        toast.error('Failed to load modules', {
        description: result.error || 'Unable to fetch modules from the portal',
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
      document: selectedModule && selectedPortalId && portal ? createPortalDocument(
        selectedPortalId,
        portal.hostname,
        selectedModule.id,
        selectedModule.moduleType,
        selectedModule.name,
        scriptType,
        script,
        selectedModule.lineageId
      ) : undefined,
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
      document: selectedModule && selectedPortalId && portal ? createPortalDocument(
        selectedPortalId,
        portal.hostname,
        selectedModule.id,
        selectedModule.moduleType,
        selectedModule.name,
        scriptType,
        pendingModuleLoad.script,
        selectedModule.lineageId
      ) : undefined,
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
      sendMessageIgnoreError({
        type: 'CANCEL_MODULE_SEARCH',
        payload: { searchId: previousSearchId },
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

    // Use managed listener for proper cleanup
    searchListenerManager.start(searchId, (progress) => {
      set({ moduleSearchProgress: progress as ModuleSearchProgress });
    });

    try {
      const result = await sendMessage({
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

      if (result.ok) {
        const payload = result.data as { results: ScriptSearchResult[]; indexInfo?: ModuleIndexInfo };
        set({
          moduleScriptSearchResults: payload.results,
          selectedScriptSearchResult: payload.results[0] || null,
          isSearchingModules: false,
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
          moduleSearchIndexInfo: payload.indexInfo ?? null,
        });
      } else {
        set({
          moduleSearchError: result.error || 'Failed to search modules',
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
      searchListenerManager.cleanup();
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
      sendMessageIgnoreError({
        type: 'CANCEL_MODULE_SEARCH',
        payload: { searchId: previousSearchId },
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

    // Use managed listener for proper cleanup
    searchListenerManager.start(searchId, (progress) => {
      set({ moduleSearchProgress: progress as ModuleSearchProgress });
    });

    try {
      const result = await sendMessage({
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

      if (result.ok) {
        const payload = result.data as { results: DataPointSearchResult[]; indexInfo?: ModuleIndexInfo };
        set({
          moduleDatapointSearchResults: payload.results,
          selectedDatapointSearchResult: payload.results[0] || null,
          isSearchingModules: false,
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
          moduleSearchIndexInfo: payload.indexInfo ?? null,
        });
      } else {
        set({
          moduleSearchError: result.error || 'Failed to search datapoints',
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
      searchListenerManager.cleanup();
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
      sendMessageIgnoreError({
        type: 'CANCEL_MODULE_SEARCH',
        payload: { searchId: previousSearchId },
      });
    }

    const searchId = crypto.randomUUID();
    set({
      moduleSearchProgress: { searchId, stage: 'indexing', processed: 0 },
      moduleSearchExecutionId: searchId,
      moduleSearchError: null,
    });

    // Use managed listener for proper cleanup
    searchListenerManager.start(searchId, (progress) => {
      set({ moduleSearchProgress: progress as ModuleSearchProgress });
    });

    try {
      const result = await sendMessage({
        type: 'REFRESH_MODULE_INDEX',
        payload: { portalId: selectedPortalId, searchId },
      });

      if (result.ok) {
        set({
          moduleSearchIndexInfo: result.data as ModuleIndexInfo,
          moduleSearchProgress: null,
          moduleSearchExecutionId: null,
        });
        toast.success('Module search index refreshed');
      } else {
        set({
          moduleSearchError: result.error || 'Failed to refresh module index',
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
      searchListenerManager.cleanup();
    }
  },

  cancelModuleSearch: async () => {
    const { moduleSearchExecutionId } = get();
    if (!moduleSearchExecutionId) return;

    const result = await sendMessage({
        type: 'CANCEL_MODULE_SEARCH',
        payload: { searchId: moduleSearchExecutionId },
      });
    
    if (!result.ok) {
      console.error('Failed to cancel module search:', result.error);
    }
    
      set({
        isSearchingModules: false,
        moduleSearchExecutionId: null,
        moduleSearchProgress: null,
      });
    searchListenerManager.cleanup();
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
        document: selectedPortalId && portal ? createPortalDocument(
          selectedPortalId,
          portal.hostname,
          module.id,
          module.moduleType,
          module.name,
          script.type,
          script.content,
          module.lineageId
        ) : undefined,
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
      set({ 
        loadedModuleForCommit: null, 
        moduleCommitError: null, 
        moduleCommitConflict: null,
        directoryScriptsForCommit: null,
        selectedScriptsForCommit: new Set(),
      });
    }
  },

  toggleScriptForCommit: (scriptType: 'collection' | 'ad') => {
    const { selectedScriptsForCommit } = get();
    const newSet = new Set(selectedScriptsForCommit);
    if (newSet.has(scriptType)) {
      newSet.delete(scriptType);
    } else {
      newSet.add(scriptType);
    }
    set({ selectedScriptsForCommit: newSet });
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
      const result = await sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId: binding.portalId,
          moduleType: tab.source.moduleType,
          moduleId: tab.source.moduleId,
        },
      });
      
      if (result.ok) {
        // Extract module info from the fetched module
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const module = result.data as any;
        
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
        const origContent = getOriginalContent(tab) || '';
        const hasConflict = origContent.trim() !== currentScript.trim();
        
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
        
        // If there's a conflict, update the document baseline to the current server state
        if (hasConflict && currentScript !== origContent) {
          set({
            tabs: tabs.map(t =>
              t.id === tabId
                ? { ...t, document: t.document ? updateDocumentAfterPush(t.document, currentScript) : t.document }
                : t
            ),
          } as Partial<ModuleSlice & ModuleSliceDependencies>);
        }
        
        // Check if this is a directory-saved module - if so, load all scripts from disk
        if (tab.directoryHandleId) {
          try {
            const storedDir = await documentStore.getDirectoryHandleRecord(tab.directoryHandleId);
            if (storedDir) {
              // Request permission for the directory
              const handleWithPermission = storedDir.handle as unknown as { 
                requestPermission(options?: { mode?: string }): Promise<PermissionState>;
              };
              const permissionStatus = await handleWithPermission.requestPermission({ mode: 'read' });
              if (permissionStatus === 'granted') {
                // Read module.json to get script metadata
                const moduleJsonContent = await documentStore.readFileFromDirectory(storedDir.handle, 'module.json');
                if (moduleJsonContent) {
                  const moduleConfig = JSON.parse(moduleJsonContent);
                  const directoryScripts: DirectoryScriptForCommit[] = [];
                  const selectedScripts = new Set<'collection' | 'ad'>();
                  
                  // Process collection script
                  if (moduleConfig.scripts?.collection) {
                    const collectionMeta = moduleConfig.scripts.collection;
                    const collectionContent = await documentStore.readFileFromDirectory(storedDir.handle, collectionMeta.fileName);
                    if (collectionContent !== null) {
                      // Get portal collection script for comparison
                      let portalCollectionScript = '';
                      if (
                        tab.source!.moduleType === 'propertysource' ||
                        tab.source!.moduleType === 'diagnosticsource' ||
                        tab.source!.moduleType === 'eventsource'
                      ) {
                        portalCollectionScript = module.groovyScript || '';
                      } else if (tab.source!.moduleType === 'logsource') {
                        portalCollectionScript = module.collectionAttribute?.script?.embeddedContent
                          || module.collectionAttribute?.groovyScript
                          || '';
                      } else {
                        portalCollectionScript = module.collectorAttribute?.groovyScript || '';
                      }
                      
                      const diskHasChanges = collectionContent.trim() !== portalCollectionScript.trim();
                      directoryScripts.push({
                        scriptType: 'collection',
                        fileName: collectionMeta.fileName,
                        language: collectionMeta.language || 'groovy',
                        mode: collectionMeta.mode || 'collection',
                        diskContent: collectionContent,
                        portalChecksum: collectionMeta.portalChecksum || '',
                        portalContent: portalCollectionScript,
                        hasChanges: diskHasChanges,
                      });
                      if (diskHasChanges) {
                        selectedScripts.add('collection');
                      }
                    }
                  }
                  
                  // Process AD script
                  if (moduleConfig.scripts?.ad) {
                    const adMeta = moduleConfig.scripts.ad;
                    const adContent = await documentStore.readFileFromDirectory(storedDir.handle, adMeta.fileName);
                    if (adContent !== null) {
                      const portalAdScript = module.autoDiscoveryConfig?.method?.groovyScript || '';
                      const diskHasChanges = adContent.trim() !== portalAdScript.trim();
                      directoryScripts.push({
                        scriptType: 'ad',
                        fileName: adMeta.fileName,
                        language: adMeta.language || 'groovy',
                        mode: adMeta.mode || 'ad',
                        diskContent: adContent,
                        portalChecksum: adMeta.portalChecksum || '',
                        portalContent: portalAdScript,
                        hasChanges: diskHasChanges,
                      });
                      if (diskHasChanges) {
                        selectedScripts.add('ad');
                      }
                    }
                  }
                  
                  set({
                    directoryScriptsForCommit: directoryScripts.length > 0 ? directoryScripts : null,
                    selectedScriptsForCommit: selectedScripts,
                  });
                }
              }
            }
          } catch (dirError) {
            console.error('Failed to read directory scripts:', dirError);
            // Continue without directory scripts - user can still push active tab
          }
        }
      } else {
        // Handle error response
        const errorMessage = result.error || 'Failed to fetch module';
        
        // Handle specific error cases based on error code
        if (result.code === '404') {
          throw new Error('Module not found. It may have been deleted.');
        } else if (result.code === '403') {
          throw new Error('CSRF token expired. Please refresh the page.');
        } else if (result.code === '401') {
          throw new Error('Session expired. Please log in to LogicMonitor.');
        }
        
        set({ moduleCommitError: errorMessage });
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch module';
      set({ moduleCommitError: errorMessage });
      throw error;
    }
  },

  commitModuleScript: async (tabId: string, reason?: string) => {
    const { tabs, selectedPortalId, portals, moduleDetailsDraftByTabId, directoryScriptsForCommit, selectedScriptsForCommit } = get();
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
      
      // Determine scripts to push based on whether we have directory scripts
      const isDirectoryPush = directoryScriptsForCommit && directoryScriptsForCommit.length > 0 && selectedScriptsForCommit.size > 0;
      
      // For directory push, get scripts from disk; otherwise use active tab
      let collectionScript: string | undefined;
      let adScript: string | undefined;
      let pushingCollection = false;
      let pushingAd = false;
      
      if (isDirectoryPush) {
        // Push selected scripts from directory
        for (const scriptInfo of directoryScriptsForCommit) {
          if (selectedScriptsForCommit.has(scriptInfo.scriptType)) {
            if (scriptInfo.scriptType === 'collection') {
              collectionScript = scriptInfo.diskContent;
              pushingCollection = true;
            } else if (scriptInfo.scriptType === 'ad') {
              adScript = scriptInfo.diskContent;
              pushingAd = true;
            }
          }
        }
      } else {
        // Standard push - use active tab content
        const hasScriptChanges = tab.content !== getOriginalContent(tab);
        if (hasScriptChanges) {
          if (tab.source.scriptType === 'collection') {
            collectionScript = tab.content;
            pushingCollection = true;
          } else if (tab.source.scriptType === 'ad') {
            adScript = tab.content;
            pushingAd = true;
          }
        }
      }
      
      const hasAnyScriptChanges = pushingCollection || pushingAd;
      
      if (!hasAnyScriptChanges && !hasModuleDetailsChanges) {
        throw new Error('No changes to push');
      }

      // Build module details payload if there are changes
      const schema = MODULE_TYPE_SCHEMAS[tab.source.moduleType];
      let moduleDetailsPayload: Record<string, unknown> | undefined;

      if (hasModuleDetailsChanges && moduleDetailsDraft) {
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
      
      // If pushing AD script, we must include full autoDiscoveryConfig
      // The AD script is nested inside autoDiscoveryConfig.method.groovyScript
      if (pushingAd && adScript !== undefined) {
        const existingAdConfig = moduleDetailsPayload?.autoDiscoveryConfig as Record<string, unknown> | undefined 
          || (moduleDetailsDraft?.draft?.autoDiscoveryConfig as Record<string, unknown> | undefined)
          || {};
        const existingMethod = (existingAdConfig.method || {}) as Record<string, unknown>;
        
        // Ensure we have autoDiscoveryConfig with the script in it
        moduleDetailsPayload = moduleDetailsPayload || {};
        moduleDetailsPayload.autoDiscoveryConfig = {
          ...existingAdConfig,
          method: {
            ...existingMethod,
            groovyScript: adScript,
          },
        };
      }

      const trimmedReason = reason?.trim();
      const limitedReason = trimmedReason ? trimmedReason.slice(0, 4096) : undefined;
      
      // Push the changes - we'll push collection script via newScript if applicable
      // AD script changes are included via autoDiscoveryConfig in moduleDetails
      const result = await sendMessage({
        type: 'COMMIT_MODULE_SCRIPT',
        payload: {
          portalId: binding.portalId,
          moduleType: tab.source.moduleType,
          moduleId: tab.source.moduleId,
          scriptType: pushingCollection ? 'collection' : tab.source.scriptType,
          newScript: pushingCollection ? collectionScript : undefined,
          moduleDetails: moduleDetailsPayload,
          reason: limitedReason,
        },
      });
      
      if (result.ok) {
        // Update document.portal.lastKnownContent to reflect the committed state
        const updatedTabs = tabs.map(t => {
          if (t.id === tabId) {
            return { 
              ...t, 
              document: t.document ? updateDocumentAfterPush(t.document, t.content) : t.document,
            };
          }
          // Also update other tabs from the same module/directory
          if (t.directoryHandleId === tab.directoryHandleId && t.source?.moduleId === tab.source?.moduleId) {
            // Update each tab's portal baseline if its script was pushed
            const wasScriptPushed = (t.source?.scriptType === 'collection' && pushingCollection) ||
                                    (t.source?.scriptType === 'ad' && pushingAd);
            if (wasScriptPushed && t.document) {
              return {
                ...t,
                document: updateDocumentAfterPush(t.document, t.content),
              };
            }
          }
          return t;
        });
        
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
        
        // Update module.json if this was a directory push
        if (isDirectoryPush && tab.directoryHandleId) {
          try {
            const storedDir = await documentStore.getDirectoryHandleRecord(tab.directoryHandleId);
            if (storedDir) {
              const handleWithPermission = storedDir.handle as unknown as { 
                requestPermission(options?: { mode?: string }): Promise<PermissionState>;
              };
              const permissionStatus = await handleWithPermission.requestPermission({ mode: 'readwrite' });
              if (permissionStatus === 'granted') {
                // Read current module.json
                const moduleJsonContent = await documentStore.readFileFromDirectory(storedDir.handle, 'module.json');
                if (moduleJsonContent) {
                  const moduleConfig = JSON.parse(moduleJsonContent);
                  
                  // Update checksums for pushed scripts
                  if (pushingCollection && collectionScript !== undefined && moduleConfig.scripts?.collection) {
                    moduleConfig.scripts.collection.portalChecksum = await documentStore.computeChecksum(collectionScript);
                  }
                  if (pushingAd && adScript !== undefined && moduleConfig.scripts?.ad) {
                    moduleConfig.scripts.ad.portalChecksum = await documentStore.computeChecksum(adScript);
                  }
                  
                  // Update lastSyncedAt
                  moduleConfig.lastSyncedAt = new Date().toISOString();
                  
                  // Write updated module.json
                  await documentStore.writeFileToDirectory(storedDir.handle, 'module.json', JSON.stringify(moduleConfig, null, 2));
                }
              }
            }
          } catch (updateError) {
            console.error('Failed to update module.json after push:', updateError);
            // Don't fail the push - just log the error
          }
        }
        
        set({
          tabs: updatedTabs,
          moduleDetailsDraftByTabId: updatedDrafts,
          isCommittingModule: false,
          moduleCommitConfirmationOpen: false,
          loadedModuleForCommit: null,
          directoryScriptsForCommit: null,
          selectedScriptsForCommit: new Set(),
        } as Partial<ModuleSlice & ModuleSliceDependencies>);
        
        const scriptCount = (pushingCollection ? 1 : 0) + (pushingAd ? 1 : 0);
        const detailsText = hasModuleDetailsChanges ? ' and module details' : '';
        toast.success(`${scriptCount} script${scriptCount !== 1 ? 's' : ''}${detailsText} pushed to portal successfully`);
      } else {
        set({ 
          moduleCommitError: result.error || 'Failed to push changes to portal',
          isCommittingModule: false,
        });
        throw new Error(result.error || 'Failed to push changes to portal');
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
      const result = await sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId: source.portalId,
          moduleType: source.moduleType,
          moduleId: source.moduleId,
        },
      });
      
      if (result.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const module = result.data as any;
        
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
        
        // Update the tab content and document state
        const updatedTabs = tabs.map(t => 
          t.id === tabId 
            ? { 
                ...t, 
                content: scriptContent!,
                document: t.document ? updateDocumentAfterPull(t.document, scriptContent!) : t.document,
              }
            : t
        );
        
        set({ tabs: updatedTabs, isPullingLatest: false } as Partial<ModuleSlice & ModuleSliceDependencies>);
        
        toast.success('Pulled latest from portal', {
          description: `Updated ${source.moduleName || 'module'} ${scriptType === 'ad' ? 'AD' : 'collection'} script`,
        });
        
        return { success: true };
      } else {
        set({ isPullingLatest: false });
        return { success: false, error: result.error || 'Failed to fetch module' };
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

});
