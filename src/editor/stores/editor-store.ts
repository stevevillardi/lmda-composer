import { create } from 'zustand';
import type { 
  Portal, 
  Collector, 
  ScriptLanguage, 
  ScriptMode,
  ExecutionResult,
  ExecuteScriptRequest,
  LogicModuleType,
  LogicModuleInfo,
  FetchModulesResponse,
} from '@/shared/types';
import { parseOutput, type ParseResult } from '../utils/output-parser';

interface EditorState {
  // Portal/Collector selection
  portals: Portal[];
  selectedPortalId: string | null;
  collectors: Collector[];
  selectedCollectorId: number | null;
  
  // Device context
  hostname: string;
  wildvalue: string;
  datasourceId: string;  // Datasource name or ID for batch collection
  
  // Editor state
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  isDirty: boolean;
  
  // Execution state
  isExecuting: boolean;
  currentExecution: ExecutionResult | null;
  parsedOutput: ParseResult | null;
  
  // Execution context dialog state (for Collection/Batch Collection modes)
  executionContextDialogOpen: boolean;
  pendingExecution: Omit<ExecuteScriptRequest, 'wildvalue' | 'datasourceId'> | null;
  
  // Module browser
  moduleBrowserOpen: boolean;
  selectedModuleType: LogicModuleType;
  modulesCache: Record<LogicModuleType, LogicModuleInfo[]>;
  isFetchingModules: boolean;
  selectedModule: LogicModuleInfo | null;
  moduleSearchQuery: string;
  
  // Pending load confirmation state
  pendingModuleLoad: {
    script: string;
    language: ScriptLanguage;
    mode: ScriptMode;
  } | null;
  
  // UI state
  outputTab: 'raw' | 'parsed' | 'validation';
  
  // Actions
  setSelectedPortal: (portalId: string | null) => void;
  setSelectedCollector: (collectorId: number | null) => void;
  setHostname: (hostname: string) => void;
  setWildvalue: (wildvalue: string) => void;
  setDatasourceId: (datasourceId: string) => void;
  setScript: (script: string) => void;
  setLanguage: (language: ScriptLanguage, force?: boolean) => void;
  setMode: (mode: ScriptMode) => void;
  setOutputTab: (tab: 'raw' | 'parsed' | 'validation') => void;
  executeScript: () => Promise<void>;
  refreshPortals: () => Promise<void>;
  refreshCollectors: () => Promise<void>;
  clearOutput: () => void;
  
  // Parsing actions
  parseCurrentOutput: () => void;
  
  // Execution context dialog actions
  setExecutionContextDialogOpen: (open: boolean) => void;
  confirmExecutionContext: (wildvalue: string, datasourceId: string) => Promise<void>;
  cancelExecutionContextDialog: () => void;
  
  // Module browser actions
  setModuleBrowserOpen: (open: boolean) => void;
  setSelectedModuleType: (type: LogicModuleType) => void;
  fetchModules: (type: LogicModuleType) => Promise<void>;
  setSelectedModule: (module: LogicModuleInfo | null) => void;
  setModuleSearchQuery: (query: string) => void;
  loadModuleScript: (script: string, language: ScriptLanguage, mode: ScriptMode) => void;
  confirmModuleLoad: () => void;
  cancelModuleLoad: () => void;
}

export const DEFAULT_GROOVY_TEMPLATE = `import com.santaba.agent.groovyapi.expect.Expect;
import com.santaba.agent.groovyapi.snmp.Snmp;
import com.santaba.agent.groovyapi.http.*;
import com.santaba.agent.groovyapi.jmx.*;

def hostname = hostProps.get("system.hostname");

// Your script here

return 0;
`;

export const DEFAULT_POWERSHELL_TEMPLATE = `# LogicMonitor PowerShell Script
# Use ##PROPERTY.NAME## tokens for device properties (e.g., ##SYSTEM.HOSTNAME##)

$hostname = "##SYSTEM.HOSTNAME##"

# Your script here

Exit 0
`;

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  portals: [],
  selectedPortalId: null,
  collectors: [],
  selectedCollectorId: null,
  hostname: '',
  wildvalue: '',
  datasourceId: '',
  script: DEFAULT_GROOVY_TEMPLATE,
  language: 'groovy',
  mode: 'freeform',
  isDirty: false,
  isExecuting: false,
  currentExecution: null,
  parsedOutput: null,
  executionContextDialogOpen: false,
  pendingExecution: null,
  moduleBrowserOpen: false,
  selectedModuleType: 'datasource',
  modulesCache: {
    datasource: [],
    configsource: [],
    topologysource: [],
    propertysource: [],
    logsource: [],
    diagnosticsource: [],
  },
  isFetchingModules: false,
  selectedModule: null,
  moduleSearchQuery: '',
  pendingModuleLoad: null,
  outputTab: 'raw',

  // Actions
  setSelectedPortal: (portalId) => {
    set({ 
      selectedPortalId: portalId, 
      selectedCollectorId: null, 
      collectors: [],
      // Clear module cache when portal changes
      modulesCache: {
        datasource: [],
        configsource: [],
        topologysource: [],
        propertysource: [],
        logsource: [],
        diagnosticsource: [],
      },
    });
    if (portalId) {
      get().refreshCollectors();
    }
  },

  setSelectedCollector: (collectorId) => {
    set({ selectedCollectorId: collectorId });
  },

  setHostname: (hostname) => {
    set({ hostname });
  },

  setWildvalue: (wildvalue) => {
    set({ wildvalue });
  },

  setDatasourceId: (datasourceId) => {
    set({ datasourceId });
  },

  setScript: (newScript) => {
    const { script: currentScript } = get();
    // Only mark as dirty if the script actually changed
    if (newScript !== currentScript) {
      set({ script: newScript, isDirty: true });
    }
  },

  setLanguage: (language, force = false) => {
    const { script, isDirty, language: currentLanguage } = get();
    
    // If same language, do nothing
    if (language === currentLanguage) return;
    
    // Normalize scripts for comparison (trim whitespace, normalize line endings)
    const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
    const isDefaultGroovy = normalize(script) === normalize(DEFAULT_GROOVY_TEMPLATE);
    const isDefaultPowershell = normalize(script) === normalize(DEFAULT_POWERSHELL_TEMPLATE);
    
    // Switch templates if:
    // - force is true (user confirmed reset)
    // - script hasn't been modified from defaults
    if (force || !isDirty || isDefaultGroovy || isDefaultPowershell) {
      set({ 
        language, 
        script: language === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE,
        isDirty: false, // Reset dirty flag when switching to template
      });
    } else {
      // Script has been modified - just change the language, keep the script
      set({ language });
    }
  },

  setMode: (mode) => {
    const { outputTab } = get();
    // Clear parsed output and switch to raw tab if in freeform mode
    const updates: Partial<EditorState> = { mode, parsedOutput: null };
    if (mode === 'freeform' && (outputTab === 'parsed' || outputTab === 'validation')) {
      updates.outputTab = 'raw';
    }
    set(updates);
  },

  setOutputTab: (tab) => {
    set({ outputTab: tab });
  },

  executeScript: async () => {
    const state = get();
    
    if (!state.selectedPortalId || !state.selectedCollectorId) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: 'Please select a portal and collector',
        },
        outputTab: 'raw',
        parsedOutput: null,
      });
      return;
    }

    // For Collection or Batch Collection mode, always show the execution context dialog
    // This allows users to confirm/modify wildvalue or datasource ID before each run
    if (state.mode === 'collection' || state.mode === 'batchcollection') {
      set({
        executionContextDialogOpen: true,
        pendingExecution: {
          portalId: state.selectedPortalId,
          collectorId: state.selectedCollectorId,
          script: state.script,
          language: state.language,
          mode: state.mode,
          hostname: state.hostname || undefined,
        },
      });
      return;
    }

    // Clear previous execution and switch to raw output tab
    set({ 
      isExecuting: true, 
      currentExecution: null,
      parsedOutput: null,
      outputTab: 'raw',
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_SCRIPT',
        payload: {
          portalId: state.selectedPortalId,
          collectorId: state.selectedCollectorId,
          script: state.script,
          language: state.language,
          mode: state.mode,
          hostname: state.hostname || undefined,
          wildvalue: state.wildvalue || undefined,
          datasourceId: state.datasourceId || undefined,
        },
      });

      if (response?.type === 'EXECUTION_UPDATE') {
        const execution = response.payload as ExecutionResult;
        set({ currentExecution: execution, isExecuting: false });
        
        // Auto-parse output if not in freeform mode and execution succeeded
        if (state.mode !== 'freeform' && execution.status === 'complete' && execution.rawOutput) {
          get().parseCurrentOutput();
        }
      } else if (response?.type === 'ERROR') {
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: response.payload?.message ?? 'Unknown error from service worker',
          },
          isExecuting: false,
        });
      } else {
        // Unexpected response format
        console.error('Unexpected response from EXECUTE_SCRIPT:', response);
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: 'Unexpected response from execution service',
          },
          isExecuting: false,
        });
      }
    } catch (error) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        isExecuting: false,
      });
    }
  },

  refreshPortals: async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'DISCOVER_PORTALS' });
      if (response?.payload) {
        set({ portals: response.payload });
        
        // Auto-select first portal if none selected
        const state = get();
        if (!state.selectedPortalId && response.payload.length > 0) {
          set({ selectedPortalId: response.payload[0].id });
          get().refreshCollectors();
        }
      }
    } catch (error) {
      console.error('Failed to refresh portals:', error);
    }
  },

  refreshCollectors: async () => {
    const { selectedPortalId } = get();
    console.log('refreshCollectors called, selectedPortalId:', selectedPortalId);
    if (!selectedPortalId) return;

    try {
      console.log('Sending GET_COLLECTORS message...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_COLLECTORS',
        payload: { portalId: selectedPortalId },
      });
      console.log('GET_COLLECTORS response received:', response);
      if (response?.payload) {
        console.log('Setting collectors:', response.payload.length);
        set({ collectors: response.payload });
      } else {
        console.warn('No payload in response:', response);
      }
    } catch (error) {
      console.error('Failed to refresh collectors:', error);
    }
  },

  clearOutput: () => {
    set({ currentExecution: null, parsedOutput: null });
  },

  // Parse the current execution output based on mode
  parseCurrentOutput: () => {
    const { currentExecution, mode } = get();
    if (!currentExecution?.rawOutput || mode === 'freeform') {
      set({ parsedOutput: null });
      return;
    }
    
    const result = parseOutput(currentExecution.rawOutput, mode);
    set({ parsedOutput: result });
  },

  // Execution context dialog actions
  setExecutionContextDialogOpen: (open) => {
    set({ executionContextDialogOpen: open });
  },

  confirmExecutionContext: async (wildvalue: string, datasourceId: string) => {
    const { pendingExecution } = get();
    if (!pendingExecution) return;

    // Close dialog and store values
    set({ 
      executionContextDialogOpen: false, 
      wildvalue: wildvalue || get().wildvalue,
      datasourceId: datasourceId || get().datasourceId,
      pendingExecution: null,
    });

    // Now execute with the context values
    set({ 
      isExecuting: true, 
      currentExecution: null,
      parsedOutput: null,
      outputTab: 'raw',
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_SCRIPT',
        payload: {
          ...pendingExecution,
          wildvalue: wildvalue || undefined,
          datasourceId: datasourceId || undefined,
        },
      });

      if (response?.type === 'EXECUTION_UPDATE') {
        const execution = response.payload as ExecutionResult;
        set({ currentExecution: execution, isExecuting: false });
        
        // Auto-parse output
        if (execution.status === 'complete' && execution.rawOutput) {
          get().parseCurrentOutput();
        }
      } else if (response?.type === 'ERROR') {
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: response.payload?.message ?? 'Unknown error from service worker',
          },
          isExecuting: false,
        });
      } else {
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: 'Unexpected response from execution service',
          },
          isExecuting: false,
        });
      }
    } catch (error) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        isExecuting: false,
      });
    }
  },

  cancelExecutionContextDialog: () => {
    set({ 
      executionContextDialogOpen: false, 
      pendingExecution: null,
    });
  },

  // Module browser actions
  setModuleBrowserOpen: (open) => {
    set({ moduleBrowserOpen: open });
    // Fetch modules for the selected type when opening
    if (open) {
      const { selectedModuleType, modulesCache, selectedPortalId } = get();
      if (selectedPortalId && modulesCache[selectedModuleType].length === 0) {
        get().fetchModules(selectedModuleType);
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
      get().fetchModules(type);
    }
  },

  fetchModules: async (type) => {
    const { selectedPortalId } = get();
    if (!selectedPortalId) return;

    set({ isFetchingModules: true });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULES',
        payload: {
          portalId: selectedPortalId,
          moduleType: type,
          offset: 0,
          size: 1000,
        },
      });

      if (response?.type === 'MODULES_FETCHED') {
        const fetchResponse = response.payload as FetchModulesResponse;
        set((state) => ({
          modulesCache: {
            ...state.modulesCache,
            [type]: fetchResponse.items,
          },
          isFetchingModules: false,
        }));
      } else {
        console.error('Failed to fetch modules:', response);
        set({ isFetchingModules: false });
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
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
    const { isDirty } = get();
    
    if (isDirty) {
      // Store pending load and wait for confirmation
      set({ pendingModuleLoad: { script, language, mode } });
    } else {
      // No unsaved changes, load directly
      set({
        script,
        language,
        mode,
        isDirty: false,
        moduleBrowserOpen: false,
        selectedModule: null,
        moduleSearchQuery: '',
      });
    }
  },

  confirmModuleLoad: () => {
    const { pendingModuleLoad } = get();
    if (!pendingModuleLoad) return;

    set({
      script: pendingModuleLoad.script,
      language: pendingModuleLoad.language,
      mode: pendingModuleLoad.mode,
      isDirty: false,
      pendingModuleLoad: null,
      moduleBrowserOpen: false,
      selectedModule: null,
      moduleSearchQuery: '',
    });
  },

  cancelModuleLoad: () => {
    set({ pendingModuleLoad: null });
  },
}));

