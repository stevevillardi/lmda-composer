/**
 * Execution slice - manages script execution state.
 * 
 * Handles script execution, output parsing, execution history,
 * and execution context dialogs.
 */

import type { StateCreator } from 'zustand';
import type { 
  ExecutionResult, 
  ExecutionHistoryEntry, 
  ExecuteScriptRequest,
  EditorTab,
  EditorTabSource,
  Collector,
  DeviceInfo,
  Portal,
  UserPreferences,
} from '@/shared/types';
import { EXECUTE_SCRIPT_TIMEOUT_MS } from '@/shared/types';
import type { ParseResult } from '../../utils/output-parser';
import type { editor } from 'monaco-editor';
import { parseOutput } from '../../utils/output-parser';
import { getPortalBindingStatus } from '../../utils/portal-binding';
import { normalizeMode } from '../../utils/mode-utils';
import { createHistoryDocument } from '../../utils/document-helpers';
import { sendMessage } from '../../utils/chrome-messaging';

// ============================================================================
// Types
// ============================================================================

const STORAGE_KEY_HISTORY = 'editor_execution_history';

/**
 * State managed by the execution slice.
 */
export interface ExecutionSliceState {
  isExecuting: boolean;
  /** Per-tab execution results keyed by tab ID */
  executionResultsByTabId: Record<string, ExecutionResult>;
  /** Per-tab parsed output keyed by tab ID */
  parsedOutputByTabId: Record<string, ParseResult>;
  /** Which tab triggered the currently running execution */
  executingTabId: string | null;
  editorInstance: editor.IStandaloneCodeEditor | null;
  
  // Execution context dialog state (for Collection/Batch Collection modes)
  executionContextDialogOpen: boolean;
  pendingExecution: Omit<ExecuteScriptRequest, 'wildvalue' | 'datasourceId'> | null;
  
  // Cancel execution state
  currentExecutionId: string | null;
  cancelDialogOpen: boolean;
  
  // Execution history
  executionHistory: ExecutionHistoryEntry[];
}

/**
 * Actions provided by the execution slice.
 */
export interface ExecutionSliceActions {
  setEditorInstance: (editor: editor.IStandaloneCodeEditor | null) => void;
  executeScript: () => Promise<void>;
  parseCurrentOutput: () => void;
  clearOutput: () => void;
  /** Clean up execution data for a specific tab (used on tab close) */
  clearTabExecution: (tabId: string) => void;
  
  // Execution context dialog actions
  setExecutionContextDialogOpen: (open: boolean) => void;
  confirmExecutionContext: (wildvalue: string, datasourceId: string) => Promise<void>;
  cancelExecutionContextDialog: () => void;
  
  // Cancel execution actions
  setCancelDialogOpen: (open: boolean) => void;
  cancelExecution: () => Promise<void>;
  
  // Execution history actions
  addToHistory: (entry: Omit<ExecutionHistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  loadHistory: () => Promise<void>;
  reloadFromHistory: (entry: ExecutionHistoryEntry) => void;
  reloadFromHistoryWithoutBinding: (entry: ExecutionHistoryEntry) => void;
}

/**
 * Combined slice interface.
 */
export interface ExecutionSlice extends ExecutionSliceState, ExecutionSliceActions {}

/**
 * Dependencies from other slices needed by ExecutionSlice.
 */
export interface ExecutionSliceDependencies {
  // From TabsSlice
  tabs: EditorTab[];
  activeTabId: string | null;
  openTab: (tabData: Partial<EditorTab> & Pick<EditorTab, 'displayName' | 'content' | 'language' | 'mode'>) => string;
  
  // From PortalSlice
  selectedPortalId: string | null;
  selectedCollectorId: number | null;
  collectors: Collector[];
  devices: DeviceInfo[];
  hostname: string;
  wildvalue: string;
  datasourceId: string;
  portals: Portal[];
  
  // From UISlice
  outputTab: string;
  preferences: UserPreferences;
  executionHistoryOpen: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

export const executionSliceInitialState: ExecutionSliceState = {
  isExecuting: false,
  executionResultsByTabId: {},
  parsedOutputByTabId: {},
  executingTabId: null,
  editorInstance: null,
  
  // Execution context dialog state
  executionContextDialogOpen: false,
  pendingExecution: null,
  
  // Cancel execution state
  currentExecutionId: null,
  cancelDialogOpen: false,
  
  // Execution history
  executionHistory: [],
};

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Creates the execution slice.
 */
export const createExecutionSlice: StateCreator<
  ExecutionSlice & ExecutionSliceDependencies,
  [],
  [],
  ExecutionSlice
> = (set, get) => ({
  ...executionSliceInitialState,

  setEditorInstance: (editorInstance) => {
    set({ editorInstance });
  },

  executeScript: async () => {
    const state = get();
    
    // Get active tab data directly
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    const tabId = state.activeTabId;
    
    if (!activeTab || !tabId) {
      if (tabId) {
        set((prev) => ({
          executionResultsByTabId: {
            ...prev.executionResultsByTabId,
            [tabId]: {
              id: crypto.randomUUID(),
              status: 'error',
              rawOutput: '',
              duration: 0,
              startTime: Date.now(),
              error: 'No active tab',
            },
          },
          outputTab: 'raw',
        } as Partial<ExecutionSlice & ExecutionSliceDependencies>));
      }
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
    
    /** Helper to set an error result for the current tab */
    const setTabError = (error: string) => {
      set((prev) => {
        const { [tabId]: _removedParsed, ...restParsed } = prev.parsedOutputByTabId;
        return {
          executionResultsByTabId: {
            ...prev.executionResultsByTabId,
            [tabId]: {
              id: crypto.randomUUID(),
              status: 'error' as const,
              rawOutput: '',
              duration: 0,
              startTime: Date.now(),
              error,
            },
          },
          parsedOutputByTabId: restParsed,
          outputTab: 'raw',
        } as Partial<ExecutionSlice & ExecutionSliceDependencies>;
      });
    };
    
    if (!state.selectedPortalId || !state.selectedCollectorId) {
      setTabError('Please select a portal and collector');
      return;
    }

    let executionPortalId = state.selectedPortalId;
    if (activeTab.source?.type === 'module') {
      const binding = getPortalBindingStatus(activeTab, state.selectedPortalId, state.portals);
      if (!binding.isActive || !binding.portalId) {
        setTabError(binding.reason || 'The bound portal is not active for this tab.');
        return;
      }
      executionPortalId = binding.portalId;
    }

    if (language === 'powershell' && !isWindowsCollector) {
      setTabError('PowerShell execution is only supported on Windows collectors. Select a Windows collector to run this script.');
      return;
    }

    // For Collection or Batch Collection mode with Groovy, show the execution context dialog
    if ((mode === 'collection' || mode === 'batchcollection') && language === 'groovy') {
      const pendingDevice = state.hostname 
        ? state.devices.find(d => d.name === state.hostname) 
        : undefined;
      
      set({
        executionContextDialogOpen: true,
        pendingExecution: {
          portalId: executionPortalId,
          collectorId: state.selectedCollectorId,
          script,
          language,
          mode,
          hostname: state.hostname || undefined,
          deviceId: pendingDevice?.id,
        },
      });
      return;
    }

    // Generate execution ID for tracking/cancellation
    const executionId = crypto.randomUUID();
    
    // Clear previous execution for this tab and switch to raw output tab
    set((prev) => {
      const { [tabId]: _removedExec, ...restExec } = prev.executionResultsByTabId;
      const { [tabId]: _removedParsed, ...restParsed } = prev.parsedOutputByTabId;
      return {
        isExecuting: true,
        executingTabId: tabId,
        currentExecutionId: executionId,
        executionResultsByTabId: restExec,
        parsedOutputByTabId: restParsed,
        outputTab: 'raw',
      } as Partial<ExecutionSlice & ExecutionSliceDependencies>;
    });

    try {
      const selectedDevice = state.hostname 
        ? state.devices.find(d => d.name === state.hostname) 
        : undefined;
      
      const result = await sendMessage({
        type: 'EXECUTE_SCRIPT',
        payload: {
          portalId: executionPortalId,
          collectorId: state.selectedCollectorId,
          script,
          language,
          mode,
          executionId,
          hostname: state.hostname || undefined,
          deviceId: selectedDevice?.id,
          wildvalue: state.wildvalue || undefined,
          datasourceId: state.datasourceId || undefined,
        },
      }, EXECUTE_SCRIPT_TIMEOUT_MS);

      if (result.ok) {
        const execution = result.data as ExecutionResult;
        set((prev) => ({
          executionResultsByTabId: {
            ...prev.executionResultsByTabId,
            [tabId]: execution,
          },
          isExecuting: false,
          executingTabId: null,
        }));
        
        // Add to history
        const collectorDesc = get().collectors.find(c => c.id === state.selectedCollectorId);
        
        // Build module source info if this is a module-bound tab
        const moduleSource = activeTab.source?.type === 'module' && 
          activeTab.source.moduleId && 
          activeTab.source.moduleName && 
          activeTab.source.moduleType && 
          activeTab.source.scriptType && 
          activeTab.source.portalId && 
          activeTab.source.portalHostname
          ? {
              moduleId: activeTab.source.moduleId,
              moduleName: activeTab.source.moduleName,
              moduleType: activeTab.source.moduleType,
              scriptType: activeTab.source.scriptType,
              lineageId: activeTab.source.lineageId,
              portalId: activeTab.source.portalId,
              portalHostname: activeTab.source.portalHostname,
            }
          : undefined;
        
        get().addToHistory({
          portal: executionPortalId,
          collector: collectorDesc?.description || `Collector ${state.selectedCollectorId}`,
          collectorId: state.selectedCollectorId,
          hostname: state.hostname || undefined,
          language,
          mode,
          script,
          output: execution.rawOutput,
          status: execution.status === 'complete' ? 'success' : 'error',
          duration: execution.duration,
          tabDisplayName: activeTab.displayName,
          moduleSource,
        });
        
        // Auto-parse output if not in freeform mode and execution succeeded
        if (mode !== 'freeform' && execution.status === 'complete' && execution.rawOutput) {
          get().parseCurrentOutput();
        }
      } else {
        set((prev) => ({
          executionResultsByTabId: {
            ...prev.executionResultsByTabId,
            [tabId]: {
              id: crypto.randomUUID(),
              status: 'error' as const,
              rawOutput: '',
              duration: 0,
              startTime: Date.now(),
              error: result.error || 'Unknown error from service worker',
            },
          },
          isExecuting: false,
          executingTabId: null,
        }));
      }
    } catch (error) {
      set((prev) => ({
        executionResultsByTabId: {
          ...prev.executionResultsByTabId,
          [tabId]: {
            id: crypto.randomUUID(),
            status: 'error' as const,
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        isExecuting: false,
        executingTabId: null,
      }));
    }
  },

  clearOutput: () => {
    const { activeTabId } = get();
    if (!activeTabId) return;
    set((prev) => {
      const { [activeTabId]: _removedExec, ...restExec } = prev.executionResultsByTabId;
      const { [activeTabId]: _removedParsed, ...restParsed } = prev.parsedOutputByTabId;
      return {
        executionResultsByTabId: restExec,
        parsedOutputByTabId: restParsed,
      };
    });
  },

  clearTabExecution: (tabId: string) => {
    set((prev) => {
      const { [tabId]: _removedExec, ...restExec } = prev.executionResultsByTabId;
      const { [tabId]: _removedParsed, ...restParsed } = prev.parsedOutputByTabId;
      return {
        executionResultsByTabId: restExec,
        parsedOutputByTabId: restParsed,
      };
    });
  },

  parseCurrentOutput: () => {
    const { executionResultsByTabId, tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    const mode = activeTab?.mode ?? 'freeform';
    const currentExecution = activeTabId ? executionResultsByTabId[activeTabId] : undefined;
    
    if (!currentExecution?.rawOutput || mode === 'freeform') {
      if (activeTabId) {
        set((prev) => {
          const { [activeTabId]: _removed, ...rest } = prev.parsedOutputByTabId;
          return { parsedOutputByTabId: rest };
        });
      }
      return;
    }
    
    const result = parseOutput(currentExecution.rawOutput, {
      mode,
      moduleType: activeTab?.source?.moduleType,
      scriptType: activeTab?.source?.scriptType,
    });
    if (result && activeTabId) {
      set((prev) => ({
        parsedOutputByTabId: {
          ...prev.parsedOutputByTabId,
          [activeTabId]: result,
        },
      }));
    } else if (activeTabId) {
      set((prev) => {
        const { [activeTabId]: _removed, ...rest } = prev.parsedOutputByTabId;
        return { parsedOutputByTabId: rest };
      });
    }
  },

  // Execution context dialog actions
  setExecutionContextDialogOpen: (open) => {
    set({ executionContextDialogOpen: open });
  },

  confirmExecutionContext: async (wildvalue: string, datasourceId: string) => {
    const { pendingExecution, activeTabId } = get();
    if (!pendingExecution || !activeTabId) return;

    const tabId = activeTabId;
    const executionId = crypto.randomUUID();

    // Close dialog and store values
    set({ 
      executionContextDialogOpen: false, 
      wildvalue: wildvalue || get().wildvalue,
      datasourceId: datasourceId || get().datasourceId,
      pendingExecution: null,
    } as Partial<ExecutionSlice & ExecutionSliceDependencies>);

    // Now execute with the context values - clear this tab's previous results
    set((prev) => {
      const { [tabId]: _removedExec, ...restExec } = prev.executionResultsByTabId;
      const { [tabId]: _removedParsed, ...restParsed } = prev.parsedOutputByTabId;
      return {
        isExecuting: true,
        executingTabId: tabId,
        currentExecutionId: executionId,
        executionResultsByTabId: restExec,
        parsedOutputByTabId: restParsed,
        outputTab: 'raw',
      } as Partial<ExecutionSlice & ExecutionSliceDependencies>;
    });

    try {
      const result = await sendMessage({
        type: 'EXECUTE_SCRIPT',
        payload: {
          ...pendingExecution,
          executionId,
          wildvalue: wildvalue || undefined,
          datasourceId: datasourceId || undefined,
        },
      }, EXECUTE_SCRIPT_TIMEOUT_MS);

      if (result.ok) {
        const execution = result.data as ExecutionResult;
        set((prev) => ({
          executionResultsByTabId: {
            ...prev.executionResultsByTabId,
            [tabId]: execution,
          },
          isExecuting: false,
          executingTabId: null,
        }));
        
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
      } else {
        set((prev) => ({
          executionResultsByTabId: {
            ...prev.executionResultsByTabId,
            [tabId]: {
              id: crypto.randomUUID(),
              status: 'error' as const,
              rawOutput: '',
              duration: 0,
              startTime: Date.now(),
              error: result.error || 'Unknown error from service worker',
            },
          },
          isExecuting: false,
          executingTabId: null,
        }));
      }
    } catch (error) {
      set((prev) => ({
        executionResultsByTabId: {
          ...prev.executionResultsByTabId,
          [tabId]: {
            id: crypto.randomUUID(),
            status: 'error' as const,
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        isExecuting: false,
        executingTabId: null,
      }));
    }
  },

  cancelExecutionContextDialog: () => {
    set({ 
      executionContextDialogOpen: false, 
      pendingExecution: null,
    });
  },

  // Cancel execution actions
  setCancelDialogOpen: (open) => {
    set({ cancelDialogOpen: open });
  },

  cancelExecution: async () => {
    const { currentExecutionId, executingTabId } = get();
    if (!currentExecutionId) return;

    const result = await sendMessage({
        type: 'CANCEL_EXECUTION',
        payload: { executionId: currentExecutionId },
      });

    if (result.ok && executingTabId) {
        set((prev) => ({
          isExecuting: false,
          executingTabId: null,
          cancelDialogOpen: false,
          executionResultsByTabId: {
            ...prev.executionResultsByTabId,
            [executingTabId]: {
              id: currentExecutionId,
              status: 'cancelled' as const,
              rawOutput: '',
              duration: 0,
              startTime: Date.now(),
              error: 'Execution cancelled by user',
            },
          },
        }));
    } else if (result.ok) {
        set({ 
          isExecuting: false, 
          executingTabId: null,
          cancelDialogOpen: false,
        });
    } else {
      console.error('Failed to cancel execution:', result.error);
    }
    
    set({ cancelDialogOpen: false });
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
    chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: updatedHistory }).catch(console.error);
  },

  clearHistory: () => {
    set({ executionHistory: [] });
    chrome.storage.local.remove(STORAGE_KEY_HISTORY).catch(console.error);
  },

  loadHistory: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_HISTORY);
      const storedHistory = result[STORAGE_KEY_HISTORY] as ExecutionHistoryEntry[] | undefined;
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
    
    // Use module name if module-bound, otherwise use tab display name or fallback to timestamp
    const displayName = entry.moduleSource
      ? `${entry.moduleSource.moduleName} (${entry.moduleSource.scriptType === 'ad' ? 'AD' : 'Collection'}).${extension}`
      : entry.tabDisplayName || `History ${timestamp}.${extension}`;
    
    // Build source info: restore module binding if present, otherwise mark as history
    const source: EditorTabSource = entry.moduleSource
      ? {
          type: 'module',
          moduleId: entry.moduleSource.moduleId,
          moduleName: entry.moduleSource.moduleName,
          moduleType: entry.moduleSource.moduleType,
          scriptType: entry.moduleSource.scriptType,
          lineageId: entry.moduleSource.lineageId,
          portalId: entry.moduleSource.portalId,
          portalHostname: entry.moduleSource.portalHostname,
        }
      : { type: 'history' };
    
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName,
      content: entry.script,
      language: entry.language,
      mode: normalizeMode(entry.mode),
      source,
      contextOverride: entry.hostname ? {
        hostname: entry.hostname,
        collectorId: entry.collectorId,
      } : undefined,
      document: createHistoryDocument(),
    };
    
    // Use openTab from TabsSlice for consistency
    get().openTab(newTab);
    
    // Set hostname and close history dialog
    set({ 
      hostname: entry.hostname || '',
      executionHistoryOpen: false,
    } as Partial<ExecutionSlice & ExecutionSliceDependencies>);
  },

  reloadFromHistoryWithoutBinding: (entry) => {
    const extension = entry.language === 'groovy' ? 'groovy' : 'ps1';
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    
    // Use tab display name or fallback to timestamp (ignore module binding)
    const displayName = entry.tabDisplayName || `History ${timestamp}.${extension}`;
    
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName,
      content: entry.script,
      language: entry.language,
      mode: normalizeMode(entry.mode),
      source: { type: 'history' }, // Always mark as history, no module binding
      contextOverride: entry.hostname ? {
        hostname: entry.hostname,
        collectorId: entry.collectorId,
      } : undefined,
      document: createHistoryDocument(),
    };
    
    // Use openTab from TabsSlice for consistency
    get().openTab(newTab);
    
    // Set hostname and close history dialog
    set({ 
      hostname: entry.hostname || '',
      executionHistoryOpen: false,
    } as Partial<ExecutionSlice & ExecutionSliceDependencies>);
  },
});
