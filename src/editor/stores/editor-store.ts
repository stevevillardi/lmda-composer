import { create } from 'zustand';
import type { 
  Portal, 
  Collector, 
  DeviceInfo,
  ScriptLanguage, 
  ScriptMode,
  ExecutionResult,
  ExecuteScriptRequest,
  LogicModuleType,
  LogicModuleInfo,
  FetchModulesResponse,
  FetchDevicesResponse,
  FetchDeviceByIdResponse,
  UserPreferences,
  ExecutionHistoryEntry,
  DraftScript,
} from '@/shared/types';
import { DEFAULT_PREFERENCES } from '@/shared/types';
import { parseOutput, type ParseResult } from '../utils/output-parser';

interface EditorState {
  // Portal/Collector selection
  portals: Portal[];
  selectedPortalId: string | null;
  collectors: Collector[];
  selectedCollectorId: number | null;
  
  // Device context
  devices: DeviceInfo[];
  isFetchingDevices: boolean;
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
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  executionHistoryOpen: boolean;
  
  // User preferences
  preferences: UserPreferences;
  
  // Execution history
  executionHistory: ExecutionHistoryEntry[];
  
  // Draft auto-save
  hasSavedDraft: boolean;
  
  // Actions
  setSelectedPortal: (portalId: string | null) => void;
  setSelectedCollector: (collectorId: number | null) => void;
  fetchDevices: () => Promise<void>;
  fetchDeviceById: (portalId: string, resourceId: number) => Promise<void>;
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
  
  // UI state actions
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsDialogOpen: (open: boolean) => void;
  setExecutionHistoryOpen: (open: boolean) => void;
  
  // Preferences actions
  setPreferences: (preferences: Partial<UserPreferences>) => void;
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
  
  // Execution history actions
  addToHistory: (entry: Omit<ExecutionHistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  loadHistory: () => Promise<void>;
  reloadFromHistory: (entry: ExecutionHistoryEntry) => void;
  
  // Draft actions
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<DraftScript | null>;
  clearDraft: () => Promise<void>;
  restoreDraft: (draft: DraftScript) => void;
  
  // File export action
  saveToFile: () => Promise<void>;
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

// Storage keys
const STORAGE_KEYS = {
  PREFERENCES: 'lm-ide-preferences',
  HISTORY: 'lm-ide-execution-history',
  DRAFT: 'lm-ide-draft',
} as const;

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  portals: [],
  selectedPortalId: null,
  collectors: [],
  selectedCollectorId: null,
  devices: [],
  isFetchingDevices: false,
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
  commandPaletteOpen: false,
  settingsDialogOpen: false,
  executionHistoryOpen: false,
  preferences: DEFAULT_PREFERENCES,
  executionHistory: [],
  hasSavedDraft: false,

  // Actions
  setSelectedPortal: (portalId) => {
    set({ 
      selectedPortalId: portalId, 
      selectedCollectorId: null, 
      collectors: [],
      devices: [],
      hostname: '',
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
    set({ 
      selectedCollectorId: collectorId,
      devices: [],
      hostname: '',
    });
    // Fetch devices when collector changes
    if (collectorId) {
      get().fetchDevices();
    }
  },

  fetchDevices: async () => {
    const { selectedPortalId, selectedCollectorId } = get();
    if (!selectedPortalId || !selectedCollectorId) return;

    set({ isFetchingDevices: true });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEVICES',
        payload: { 
          portalId: selectedPortalId, 
          collectorId: selectedCollectorId 
        },
      });

      if (response?.type === 'DEVICES_UPDATE') {
        const fetchResponse = response.payload as FetchDevicesResponse;
        set({ devices: fetchResponse.items, isFetchingDevices: false });
      } else {
        console.error('Failed to fetch devices:', response);
        set({ devices: [], isFetchingDevices: false });
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      set({ devices: [], isFetchingDevices: false });
    }
  },

  fetchDeviceById: async (portalId, resourceId) => {
    console.log('Fetching device by ID:', resourceId, 'from portal:', portalId);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEVICE_BY_ID',
        payload: { portalId, resourceId },
      });

      if (response?.type === 'DEVICE_BY_ID_LOADED') {
        const device = response.payload as FetchDeviceByIdResponse;
        console.log('Device fetched:', device.name, 'collectorId:', device.currentCollectorId);
        
        // Set the hostname from the device name
        set({ hostname: device.name });
        
        // Store the collector ID to be applied after collectors are loaded
        // The setSelectedCollector will be called from App.tsx after collectors load
        const { collectors } = get();
        if (collectors.length > 0) {
          // Collectors already loaded, set it directly
          const matchingCollector = collectors.find(c => c.id === device.currentCollectorId);
          if (matchingCollector) {
            set({ selectedCollectorId: device.currentCollectorId });
            // Fetch devices for this collector
            get().fetchDevices();
          }
        }
      } else if (response?.type === 'ERROR') {
        console.warn('Failed to fetch device:', response.payload?.message);
      }
    } catch (error) {
      console.error('Error fetching device by ID:', error);
    }
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
        
        // Add to history
        const selectedCollector = get().collectors.find(c => c.id === state.selectedCollectorId);
        get().addToHistory({
          portal: state.selectedPortalId,
          collector: selectedCollector?.description || `Collector ${state.selectedCollectorId}`,
          collectorId: state.selectedCollectorId,
          hostname: state.hostname || undefined,
          language: state.language,
          mode: state.mode,
          script: state.script,
          output: execution.rawOutput,
          status: execution.status === 'complete' ? 'success' : 'error',
          duration: execution.duration,
        });
        
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

    // Store which portal we're fetching collectors for
    const fetchingForPortal = selectedPortalId;

    try {
      console.log('Sending GET_COLLECTORS message...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_COLLECTORS',
        payload: { portalId: selectedPortalId },
      });
      console.log('GET_COLLECTORS response received:', response);
      
      // Only set collectors if we're still on the same portal
      // This prevents race conditions when portal changes while fetching
      const currentPortal = get().selectedPortalId;
      if (currentPortal !== fetchingForPortal) {
        console.log('Portal changed during fetch, discarding collectors for', fetchingForPortal);
        return;
      }
      
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

  // UI state actions
  setCommandPaletteOpen: (open) => {
    set({ commandPaletteOpen: open });
  },

  setSettingsDialogOpen: (open) => {
    set({ settingsDialogOpen: open });
  },

  setExecutionHistoryOpen: (open) => {
    set({ executionHistoryOpen: open });
  },

  // Preferences actions
  setPreferences: (newPreferences) => {
    set((state) => ({
      preferences: { ...state.preferences, ...newPreferences },
    }));
    // Auto-save preferences
    get().savePreferences();
  },

  loadPreferences: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES);
      const storedPrefs = result[STORAGE_KEYS.PREFERENCES] as Partial<UserPreferences> | undefined;
      if (storedPrefs) {
        const mergedPrefs = { ...DEFAULT_PREFERENCES, ...storedPrefs };
        
        // Check if editor is in initial state (not dirty and using default template)
        const { isDirty, script } = get();
        const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
        const isDefaultGroovy = normalize(script) === normalize(DEFAULT_GROOVY_TEMPLATE);
        const isDefaultPowershell = normalize(script) === normalize(DEFAULT_POWERSHELL_TEMPLATE);
        const isInitialState = !isDirty && (isDefaultGroovy || isDefaultPowershell);
        
        // Apply default language/mode from preferences if in initial state
        if (isInitialState) {
          const newLanguage = mergedPrefs.defaultLanguage;
          const newMode = mergedPrefs.defaultMode;
          const newScript = newLanguage === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE;
          
          set({ 
            preferences: mergedPrefs,
            language: newLanguage,
            mode: newMode,
            script: newScript,
          });
        } else {
          set({ preferences: mergedPrefs });
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  },

  savePreferences: async () => {
    try {
      const { preferences } = get();
      await chrome.storage.local.set({ [STORAGE_KEYS.PREFERENCES]: preferences });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
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
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updatedHistory }).catch(console.error);
  },

  clearHistory: () => {
    set({ executionHistory: [] });
    chrome.storage.local.remove(STORAGE_KEYS.HISTORY).catch(console.error);
  },

  loadHistory: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
      const storedHistory = result[STORAGE_KEYS.HISTORY] as ExecutionHistoryEntry[] | undefined;
      if (storedHistory) {
        set({ executionHistory: storedHistory });
      }
    } catch (error) {
      console.error('Failed to load execution history:', error);
    }
  },

  reloadFromHistory: (entry) => {
    set({
      script: entry.script,
      language: entry.language,
      mode: entry.mode,
      hostname: entry.hostname || '',
      isDirty: false,
      executionHistoryOpen: false,
    });
  },

  // Draft actions
  saveDraft: async () => {
    try {
      const { script, language, mode, hostname, hasSavedDraft } = get();
      
      // Normalize for comparison
      const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
      const normalizedScript = normalize(script);
      const isDefaultGroovy = normalizedScript === normalize(DEFAULT_GROOVY_TEMPLATE);
      const isDefaultPowershell = normalizedScript === normalize(DEFAULT_POWERSHELL_TEMPLATE);
      
      // Skip saving if script is a default template
      if (isDefaultGroovy || isDefaultPowershell) {
        // If there was a saved draft, clear it since we're back to default
        if (hasSavedDraft) {
          await chrome.storage.local.remove(STORAGE_KEYS.DRAFT);
          set({ hasSavedDraft: false });
        }
        return;
      }
      
      // Check if the script differs from the previous draft to avoid unnecessary writes
      const result = await chrome.storage.local.get(STORAGE_KEYS.DRAFT);
      const existingDraft = result[STORAGE_KEYS.DRAFT] as DraftScript | undefined;
      
      if (existingDraft) {
        const existingNormalized = normalize(existingDraft.script);
        // Skip if script content hasn't changed
        if (existingNormalized === normalizedScript && 
            existingDraft.language === language && 
            existingDraft.mode === mode &&
            (existingDraft.hostname || '') === (hostname || '')) {
          return;
        }
      }
      
      const draft: DraftScript = {
        script,
        language,
        mode,
        hostname: hostname || undefined,
        lastModified: Date.now(),
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.DRAFT]: draft });
      set({ hasSavedDraft: true });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  },

  loadDraft: async () => {
    try {
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
      set({ hasSavedDraft: false });
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  },

  restoreDraft: (draft) => {
    set({
      script: draft.script,
      language: draft.language,
      mode: draft.mode,
      hostname: draft.hostname || '',
      isDirty: false,
      hasSavedDraft: false,
    });
    // Clear the draft after restoring
    get().clearDraft();
  },

  // File export action
  saveToFile: async () => {
    const { script, language } = get();
    const extension = language === 'groovy' ? '.groovy' : '.ps1';
    const mimeType = 'text/plain';
    const fileName = `script${extension}`;

    try {
      // Try File System Access API first (modern browsers)
      if ('showSaveFilePicker' in window) {
        const handle = await (window as unknown as { showSaveFilePicker: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: language === 'groovy' ? 'Groovy Script' : 'PowerShell Script',
            accept: { [mimeType]: [extension] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(script);
        await writable.close();
      } else {
        // Fallback to download
        const blob = new Blob([script], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      // User cancelled or error
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to save file:', error);
      }
    }
  },
}));

