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
  ModuleDirectoryConfig,
  CreateModuleConfig,
  CreateModuleResponse,
} from '@/shared/types';
import type { ModuleDetailsDraft, ModuleMetadata } from './tools-slice';
import { moduleToasts, portalToasts } from '../../utils/toast-utils';
import { hasPortalChanges, updateDocumentAfterPush, updateDocumentAfterPull, getOriginalContent, createPortalDocument, extractScriptFromModule, detectScriptLanguage, normalizeScriptContent, parseModuleDetailsFromResponse } from '../../utils/document-helpers';
import { getPortalBindingStatus } from '../../utils/portal-binding';
import { MODULE_TYPE_SCHEMAS, getSchemaFieldName } from '@/shared/module-type-schemas';
import { 
  isPlainObject, 
  ensurePortalBindingActive, 
  getModuleTabIds 
} from '../helpers/slice-helpers';
import { sendMessage, sendMessageIgnoreError } from '../../utils/chrome-messaging';
import * as documentStore from '../../utils/document-store';
import { getModuleScriptTemplate } from '../../config/script-templates';
import { buildModulePayload } from '../../utils/module-payload-builders';

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
  isFetchingForPull: boolean;
  scriptsForPull: Array<{
    scriptType: 'collection' | 'ad';
    fileName: string;
    language: ScriptLanguage;
    localContent: string;
    portalContent: string;
    hasChanges: boolean;
  }> | null;
  selectedScriptsForPull: Set<'collection' | 'ad'>;
  /** Module details from portal for pull comparison */
  moduleDetailsForPull: {
    portalDetails: Record<string, unknown>;
    portalVersion: number;
  } | null;
  /** Whether to include module details in pull operation */
  includeDetailsInPull: boolean;
  
  // Create module wizard
  createModuleWizardOpen: boolean;
  isCreatingModule: boolean;
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
  fetchModuleForPull: (tabId: string) => Promise<void>;
  pullLatestFromPortal: (tabId: string, selectedScripts?: Set<'collection' | 'ad'>) => Promise<{ success: boolean; error?: string }>;
  toggleScriptForPull: (scriptType: 'collection' | 'ad') => void;
  setIncludeDetailsInPull: (include: boolean) => void;
  canPullLatest: (tabId: string) => boolean;
  
  // Create module wizard actions
  setCreateModuleWizardOpen: (open: boolean) => void;
  createModule: (config: CreateModuleConfig) => Promise<void>;
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
  saveModuleDirectory: (tabId?: string) => Promise<boolean>;
  
  // From PortalSlice
  selectedPortalId: string | null;
  portals: Portal[];
  
  // From UISlice (for workspace switching)
  setActiveWorkspace: (workspace: 'script' | 'api') => void;
  
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
  isFetchingForPull: false,
  scriptsForPull: null,
  selectedScriptsForPull: new Set(),
  moduleDetailsForPull: null,
  includeDetailsInPull: true,
  
  // Create module wizard
  createModuleWizardOpen: false,
  isCreatingModule: false,
};

// ============================================================================
// Module-level state for search listener management
// ============================================================================

import { createFilteredListenerManager } from '@/editor/utils/message-listener';

// Singleton instance for module search listener management
// Filters for MODULE_SEARCH_PROGRESS messages matching the search ID
const searchListenerManager = createFilteredListenerManager<ModuleSearchProgress>(
  'MODULE_SEARCH_PROGRESS',
  (msg) => (msg.payload as { searchId?: string })?.searchId
);

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
        moduleToasts.loadFailed(result.error);
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
      set({ moduleSearchProgress: progress });
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
      set({ moduleSearchProgress: progress });
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
      set({ moduleSearchProgress: progress });
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
        moduleToasts.searchIndexRefreshed();
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
    const { tabs, selectedPortalId, portals, setActiveWorkspace } = get();
    const language: ScriptLanguage = module.scriptType === 'powerShell' ? 'powershell' : 'groovy';
    const portal = portals.find((entry) => entry.id === selectedPortalId);
    
    const newTabs: EditorTab[] = [];
    
    for (const script of scripts) {
      // Standardize naming: "ModuleName (AD)" or "ModuleName (Collection)" - no extension
      const modeLabel = script.type === 'ad' ? 'AD' : 'Collection';
      const displayName = `${module.name} (${modeLabel})`;
      
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
      // Switch to script workspace when opening module scripts
      setActiveWorkspace('script');
      
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
    
    // Get module identifier to find all related tabs
    const moduleId = tab.source.moduleId;
    const portalId = tab.source.portalId;
    
    // Find all tabs for the same module (collection and AD scripts)
    const relatedTabs = tabs.filter(t => 
      t.source?.type === 'module' &&
      t.source.moduleId === moduleId &&
      t.source.portalId === portalId
    );
    
    // Check if this is a directory-saved module
    const isDirectorySaved = !!tab.directoryHandleId || relatedTabs.some(t => !!t.directoryHandleId);
    
    // For directory-saved modules, check ALL related tabs (scripts are loaded from disk)
    // For non-directory modules, only check the ACTIVE tab (push only works for active tab)
    const hasScriptChanges = isDirectorySaved
      ? relatedTabs.some(t => hasPortalChanges(t))
      : hasPortalChanges(tab);
    
    // Check for module details changes (always check all related tabs since details are shared)
    const hasModuleDetailsChanges = relatedTabs.some(t => {
      const draft = moduleDetailsDraftByTabId[t.id];
      return draft && draft.dirtyFields.size > 0;
    });
    
    // Can commit (push to portal) if scripts or module details have changes
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
        
        // Extract the current script from the module using shared utility
        const currentScript = extractScriptFromModule(module, tab.source.moduleType!, tab.source.scriptType || 'collection');
        
        // Check for conflicts: compare portal baseline against freshly fetched portal content.
        // Use purpose='portal' to get the portal baseline, not the local file content.
        const portalBaseline = getOriginalContent(tab, 'portal') || '';
        const normalizedBaseline = normalizeScriptContent(portalBaseline);
        const normalizedPortal = normalizeScriptContent(currentScript);
        const hasConflict = normalizedBaseline !== normalizedPortal;
        
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
        if (hasConflict && currentScript !== portalBaseline) {
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
                      // Get portal collection script for comparison using shared utility
                      const portalCollectionScript = extractScriptFromModule(module, tab.source!.moduleType!, 'collection');
                      const diskHasChanges = normalizeScriptContent(collectionContent) !== normalizeScriptContent(portalCollectionScript);
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
                      // Get portal AD script for comparison using shared utility
                      const portalAdScript = extractScriptFromModule(module, tab.source!.moduleType!, 'ad');
                      const diskHasChanges = normalizeScriptContent(adContent) !== normalizeScriptContent(portalAdScript);
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
            } else if (field === 'dataPoints') {
              // Send the full dataPoints array when modified
              if (Array.isArray(draftValue)) {
                payload.dataPoints = draftValue;
              }
            } else if (field === 'configChecks') {
              // Send the full configChecks array when modified
              if (Array.isArray(draftValue)) {
                payload.configChecks = draftValue;
              }
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
                  
                  // Update module details if pushed
                  // After push, portalBaseline = what we just pushed, localDraft = undefined (no local changes)
                  if (hasModuleDetailsChanges && moduleDetailsDraft) {
                    moduleConfig.moduleDetails = {
                      portalVersion: (moduleDetailsDraft.version || 0) + 1,
                      lastPulledAt: new Date().toISOString(),
                      // The pushed values become the new portal baseline
                      portalBaseline: moduleDetailsDraft.draft as Record<string, unknown>,
                      // Clear localDraft since we just pushed everything to portal
                      localDraft: undefined,
                    };
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
        
        // Build a clear success message based on what was pushed
        let successMessage: string;
        if (scriptCount > 0 && hasModuleDetailsChanges) {
          successMessage = `${scriptCount} script${scriptCount !== 1 ? 's' : ''} and module details pushed successfully`;
        } else if (scriptCount > 0) {
          successMessage = `${scriptCount} script${scriptCount !== 1 ? 's' : ''} pushed successfully`;
        } else if (hasModuleDetailsChanges) {
          successMessage = 'Module details pushed successfully';
        } else {
          successMessage = 'Changes pushed successfully';
        }
        moduleToasts.committed(successMessage);
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
    if (open) {
      set({ pullLatestDialogOpen: open });
    } else {
      // Reset all pull state when closing
      set({ 
        pullLatestDialogOpen: open,
        scriptsForPull: null,
        selectedScriptsForPull: new Set(),
        moduleDetailsForPull: null,
        includeDetailsInPull: true,
      });
    }
  },

  toggleScriptForPull: (scriptType: 'collection' | 'ad') => {
    const { selectedScriptsForPull } = get();
    const newSet = new Set(selectedScriptsForPull);
    if (newSet.has(scriptType)) {
      newSet.delete(scriptType);
    } else {
      newSet.add(scriptType);
    }
    set({ selectedScriptsForPull: newSet });
  },

  setIncludeDetailsInPull: (include: boolean) => {
    set({ includeDetailsInPull: include });
  },

  fetchModuleForPull: async (tabId: string) => {
    const { tabs, portals } = get();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab || tab.source?.type !== 'module') {
      throw new Error('Tab is not a module tab');
    }
    
    const source = tab.source;
    if (!source.moduleId || !source.moduleType || !source.portalId) {
      throw new Error('Module source information is incomplete');
    }
    
    const portal = portals.find(p => p.id === source.portalId);
    if (!portal) {
      throw new Error(`Portal ${source.portalHostname} not found`);
    }
    
    set({ isFetchingForPull: true, scriptsForPull: null });
    
    try {
      // Fetch latest module from portal
      const result = await sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId: source.portalId,
          moduleType: source.moduleType,
          moduleId: source.moduleId,
        },
      });
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to fetch module');
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const module = result.data as any;
      
      // Find all related tabs for this module
      const relatedTabs = tabs.filter(t => 
        t.source?.type === 'module' &&
        t.source.moduleId === source.moduleId &&
        t.source.portalId === source.portalId
      );
      
      const scripts: ModuleSliceState['scriptsForPull'] = [];
      
      // Extract scripts using shared utility
      const collectionContent = extractScriptFromModule(module, source.moduleType!, 'collection');
      const collectionLanguage: ScriptLanguage = detectScriptLanguage(module);
      const adContent = extractScriptFromModule(module, source.moduleType!, 'ad');
      
      // Find local content for collection script
      const collectionTab = relatedTabs.find(t => t.source?.scriptType === 'collection');
      if (collectionContent || collectionTab) {
        const localContent = collectionTab?.content || '';
        const hasChanges = localContent !== collectionContent;
        scripts.push({
          scriptType: 'collection',
          fileName: `collection.${collectionLanguage === 'powershell' ? 'ps1' : 'groovy'}`,
          language: collectionLanguage,
          localContent,
          portalContent: collectionContent,
          hasChanges,
        });
      }
      
      // Find local content for AD script
      const adTab = relatedTabs.find(t => t.source?.scriptType === 'ad');
      if (adContent || adTab) {
        const localContent = adTab?.content || '';
        const hasChanges = localContent !== adContent;
        scripts.push({
          scriptType: 'ad',
          fileName: 'ad.groovy',
          language: 'groovy',
          localContent,
          portalContent: adContent,
          hasChanges,
        });
      }
      
      // Pre-select scripts that have changes
      const selectedScripts = new Set<'collection' | 'ad'>();
      scripts.forEach(s => {
        if (s.hasChanges) {
          selectedScripts.add(s.scriptType);
        }
      });
      
      // Parse module details for pull
      const schema = MODULE_TYPE_SCHEMAS[source.moduleType!];
      const portalDetails = parseModuleDetailsFromResponse(module, schema, getSchemaFieldName);
      
      set({
        isFetchingForPull: false,
        scriptsForPull: scripts.length > 0 ? scripts : null,
        selectedScriptsForPull: selectedScripts,
        moduleDetailsForPull: {
          portalDetails: portalDetails as unknown as Record<string, unknown>,
          portalVersion: portalDetails.version,
        },
      });
    } catch (error) {
      set({ isFetchingForPull: false });
      throw error;
    }
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

  pullLatestFromPortal: async (tabId: string, selectedScripts?: Set<'collection' | 'ad'>) => {
    const { tabs, portals, scriptsForPull, moduleDetailsForPull, includeDetailsInPull, moduleDetailsDraftByTabId } = get();
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
    
    // Use selected scripts from argument or dialog state
    const scriptsToPull = selectedScripts || get().selectedScriptsForPull;
    
    // Allow pulling if either scripts are selected OR module details are selected
    const hasScriptsToSync = scriptsToPull.size > 0;
    const hasDetailsToSync = includeDetailsInPull && moduleDetailsForPull !== null;
    
    if (!hasScriptsToSync && !hasDetailsToSync) {
      return { success: false, error: 'No scripts or module details selected to pull' };
    }
    
    set({ isPullingLatest: true });
    
    try {
      // Find all related tabs for this module
      const relatedTabs = tabs.filter(t => 
        t.source?.type === 'module' &&
        t.source.moduleId === source.moduleId &&
        t.source.portalId === source.portalId
      );
      
      // Use already fetched scripts if available, otherwise fetch fresh
      let scriptData = scriptsForPull;
      
      if (!scriptData) {
        // Fetch fresh from portal
        const result = await sendMessage({
          type: 'FETCH_MODULE',
          payload: {
            portalId: source.portalId,
            moduleType: source.moduleType,
            moduleId: source.moduleId,
          },
        });
        
        if (!result.ok) {
          set({ isPullingLatest: false });
          return { success: false, error: result.error || 'Failed to fetch module' };
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const module = result.data as any;
        
        // Build script data from fresh fetch
        scriptData = [];
        
        // Extract scripts using shared utility
        const collectionContent = extractScriptFromModule(module, source.moduleType!, 'collection');
        const collectionLanguage = detectScriptLanguage(module);
        const adContent = extractScriptFromModule(module, source.moduleType!, 'ad');
        
        if (collectionContent) {
          scriptData.push({
            scriptType: 'collection' as const,
            fileName: `collection.${collectionLanguage === 'powershell' ? 'ps1' : 'groovy'}`,
            language: collectionLanguage,
            localContent: '',
            portalContent: collectionContent,
            hasChanges: true,
          });
        }
        
        if (adContent) {
          scriptData.push({
            scriptType: 'ad' as const,
            fileName: 'ad.groovy',
            language: 'groovy' as ScriptLanguage,
            localContent: '',
            portalContent: adContent,
            hasChanges: true,
          });
        }
      }
      
      // Update tabs with pulled content
      let updatedTabs = [...tabs];
      let pulledCount = 0;
      
      for (const scriptType of scriptsToPull) {
        const script = scriptData?.find(s => s.scriptType === scriptType);
        if (!script) continue;
        
        const relatedTab = relatedTabs.find(t => t.source?.scriptType === scriptType);
        if (relatedTab) {
          updatedTabs = updatedTabs.map(t => 
            t.id === relatedTab.id 
              ? { 
                  ...t, 
                  content: script.portalContent,
                  document: t.document ? updateDocumentAfterPull(t.document, script.portalContent) : t.document,
                }
              : t
          );
          pulledCount++;
        }
      }
      
      // Handle directory-saved modules - update files on disk
      const directoryHandleId = tab.directoryHandleId || relatedTabs.find(t => t.directoryHandleId)?.directoryHandleId;
      if (directoryHandleId) {
        try {
          const storedDir = await documentStore.getDirectoryHandleRecord(directoryHandleId);
          
          if (storedDir) {
            const writePermission = await documentStore.requestDirectoryPermission(storedDir.handle, 'readwrite');
            
            if (writePermission) {
              // Read current module.json
              const configJson = await documentStore.readFileFromDirectory(storedDir.handle, 'module.json');
              if (configJson) {
                const config = JSON.parse(configJson) as ModuleDirectoryConfig;
                
                for (const scriptType of scriptsToPull) {
                  const script = scriptData?.find(s => s.scriptType === scriptType);
                  if (!script) continue;
                  
                  let scriptConfig = config.scripts[scriptType];
                  
                  // If script doesn't exist in config, create a new entry
                  if (!scriptConfig) {
                    // Determine filename based on language
                    const ext = script.language === 'powershell' ? 'ps1' : 'groovy';
                    const fileName = `${scriptType}.${ext}`;
                    
                    scriptConfig = {
                      fileName,
                      language: script.language,
                      mode: scriptType === 'ad' ? 'ad' : 'collection',
                      portalChecksum: '',
                      diskChecksum: '',
                    };
                    config.scripts[scriptType] = scriptConfig;
                  }
                  
                  // Write updated script to disk
                  await documentStore.writeFileToDirectory(storedDir.handle, scriptConfig.fileName, script.portalContent);
                  
                  // Update checksums in config
                  const newChecksum = await documentStore.computeChecksum(script.portalContent);
                  scriptConfig.portalChecksum = newChecksum;
                  scriptConfig.diskChecksum = newChecksum;
                }
                
                // Update module details in module.json if pulling details
                // After pull, portalBaseline = new portal values, localDraft = undefined (no local changes)
                if (includeDetailsInPull && moduleDetailsForPull) {
                  config.moduleDetails = {
                    portalVersion: moduleDetailsForPull.portalVersion,
                    lastPulledAt: new Date().toISOString(),
                    portalBaseline: moduleDetailsForPull.portalDetails,
                    // Clear localDraft since we're syncing to portal state
                    localDraft: undefined,
                  };
                }
                
                // Save updated module.json
                await documentStore.writeFileToDirectory(storedDir.handle, 'module.json', JSON.stringify(config, null, 2));
              }
            }
          }
        } catch {
          // Continue - tab content was updated even if directory update failed
        }
      }
      
      // Update module details drafts if pulling details
      const updatedModuleDetailsDrafts = { ...moduleDetailsDraftByTabId };
      if (includeDetailsInPull && moduleDetailsForPull) {
        const relatedTabIds = relatedTabs.map(t => t.id);
        for (const relatedTabId of relatedTabIds) {
          const existingDraft = moduleDetailsDraftByTabId[relatedTabId];
          if (existingDraft) {
            // Merge: keep user's dirty fields that don't conflict, update original baseline
            const newOriginal = moduleDetailsForPull.portalDetails as Partial<ModuleMetadata>;
            const newDraft = { ...existingDraft.draft };
            const newDirtyFields = new Set<string>();
            
            // Check each dirty field - if user's value differs from new portal value, keep it dirty
            for (const field of existingDraft.dirtyFields) {
              const userValue = existingDraft.draft[field as keyof typeof existingDraft.draft];
              const portalValue = newOriginal[field as keyof typeof newOriginal];
              if (userValue !== portalValue) {
                newDirtyFields.add(field);
              }
            }
            
            // Update non-dirty fields to portal values
            for (const [key, value] of Object.entries(newOriginal)) {
              if (!newDirtyFields.has(key)) {
                (newDraft as Record<string, unknown>)[key] = value;
              }
            }
            
            updatedModuleDetailsDrafts[relatedTabId] = {
              ...existingDraft,
              original: newOriginal,
              draft: newDraft,
              dirtyFields: newDirtyFields,
              loadedAt: Date.now(),
              version: moduleDetailsForPull.portalVersion,
            };
          } else {
            // No existing draft - create fresh one
            const newDetails = moduleDetailsForPull.portalDetails as Partial<ModuleMetadata>;
            updatedModuleDetailsDrafts[relatedTabId] = {
              original: newDetails,
              draft: { ...newDetails },
              dirtyFields: new Set(),
              loadedAt: Date.now(),
              tabId: relatedTabId,
              moduleId: source.moduleId,
              moduleType: source.moduleType,
              portalId: source.portalId,
              version: moduleDetailsForPull.portalVersion,
            };
          }
        }
      }
      
      set({ 
        tabs: updatedTabs, 
        moduleDetailsDraftByTabId: updatedModuleDetailsDrafts,
        isPullingLatest: false,
        pullLatestDialogOpen: false,
        scriptsForPull: null,
        selectedScriptsForPull: new Set(),
        moduleDetailsForPull: null,
      } as Partial<ModuleSlice & ModuleSliceDependencies>);
      
      // Build success message based on what was pulled
      const parts: string[] = [];
      if (pulledCount > 0) {
        parts.push(`${pulledCount} script${pulledCount !== 1 ? 's' : ''}`);
      }
      if (includeDetailsInPull && moduleDetailsForPull) {
        parts.push('module details');
      }
      
      portalToasts.pulledLatest(parts, source.moduleName || 'module');
      
      return { success: true };
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
  // Create Module Wizard Actions
  // ==========================================================================

  setCreateModuleWizardOpen: (open: boolean) => {
    set({ createModuleWizardOpen: open });
  },

  createModule: async (config) => {
    const { selectedPortalId, portals, tabs } = get();
    
    if (!selectedPortalId) {
      throw new Error('No portal connected');
    }
    
    const portal = portals.find(p => p.id === selectedPortalId);
    if (!portal) {
      throw new Error('Portal not found');
    }
    
    set({ isCreatingModule: true });
    
    try {
      // Build the API payload using dedicated builder for this module type
      const modulePayload = buildModulePayload(config);
      
      // Send the create request
      const result = await sendMessage({
        type: 'CREATE_MODULE' as const,
        payload: {
          portalId: selectedPortalId,
          moduleType: config.moduleType,
          modulePayload,
        },
      });
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to create module');
      }
      
      const createdModule = result.data as CreateModuleResponse;
      
      // Create tabs for the new module using centralized templates
      const collectionContent = getModuleScriptTemplate(config.moduleType, config.collectionLanguage, 'collection');
      
      const collectionMode: ScriptMode = config.useBatchScript ? 'batchcollection' : 'collection';
      const collectionExtension = config.collectionLanguage === 'groovy' ? 'groovy' : 'ps1';
      const collectionDisplayName = `${config.name}/${collectionMode === 'batchcollection' ? 'batch' : 'collection'}.${collectionExtension}`;
      
      // Create collection tab
      const collectionTab: EditorTab = {
        id: crypto.randomUUID(),
        displayName: collectionDisplayName,
        content: collectionContent,
        language: config.collectionLanguage,
        mode: collectionMode,
        source: {
          type: 'module',
          moduleId: createdModule.moduleId,
          moduleName: config.name,
          moduleType: config.moduleType,
          scriptType: 'collection',
          portalId: selectedPortalId,
          portalHostname: createdModule.portalHostname,
        },
        document: createPortalDocument(
          selectedPortalId,
          createdModule.portalHostname,
          createdModule.moduleId,
          config.moduleType,
          config.name,
          'collection',
          collectionContent
        ),
      };
      
      const newTabs: EditorTab[] = [collectionTab];
      
      // Create AD tab if multi-instance
      if (config.hasMultiInstances && config.adLanguage) {
        const adContent = getModuleScriptTemplate(config.moduleType, config.adLanguage, 'ad');
        
        const adExtension = config.adLanguage === 'groovy' ? 'groovy' : 'ps1';
        const adDisplayName = `${config.name}/ad.${adExtension}`;
        
        const adTab: EditorTab = {
          id: crypto.randomUUID(),
          displayName: adDisplayName,
          content: adContent,
          language: config.adLanguage,
          mode: 'ad',
          source: {
            type: 'module',
            moduleId: createdModule.moduleId,
            moduleName: config.name,
            moduleType: config.moduleType,
            scriptType: 'ad',
            portalId: selectedPortalId,
            portalHostname: createdModule.portalHostname,
          },
          document: createPortalDocument(
            selectedPortalId,
            createdModule.portalHostname,
            createdModule.moduleId,
            config.moduleType,
            config.name,
            'ad',
            adContent
          ),
        };
        
        newTabs.push(adTab);
      }
      
      // Add tabs and activate the first one
      set({
        tabs: [...tabs, ...newTabs],
        activeTabId: collectionTab.id,
        isCreatingModule: false,
        createModuleWizardOpen: false,
      } as Partial<ModuleSlice & ModuleSliceDependencies>);
      
      // If user wants to initialize a local directory, trigger the directory picker
      if (config.initializeLocalDirectory) {
        const { saveModuleDirectory } = get();
        // Call saveModuleDirectory with the collection tab ID
        // This opens the native directory picker and saves the module structure
        await saveModuleDirectory(collectionTab.id);
      }
      
    } catch (error) {
      set({ isCreatingModule: false });
      throw error;
    }
  },

});
