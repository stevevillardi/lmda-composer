import { create } from 'zustand';
import { toast } from 'sonner';
import type { 
  Portal, 
  Collector, 
  DeviceInfo,
  DeviceProperty,
  Snippet,
  ScriptLanguage, 
  ScriptMode,
  ExecutionResult,
  ExecuteScriptRequest,
  LogicModuleType,
  LogicModuleInfo,
  FetchModulesResponse,
  FetchDevicesResponse,
  UserPreferences,
  ExecutionHistoryEntry,
  DraftScript,
  DraftTabs,
  EditorTab,
  FilePermissionStatus,
  CustomAppliesToFunction,
  ExecuteDebugCommandRequest,
  DebugCommandResult,
} from '@/shared/types';
import { DEFAULT_PREFERENCES } from '@/shared/types';
import { parseOutput, type ParseResult } from '../utils/output-parser';
import * as fileHandleStore from '../utils/file-handle-store';
import { APPLIES_TO_FUNCTIONS } from '../data/applies-to-functions';

interface EditorState {
  // Portal/Collector selection
  portals: Portal[];
  selectedPortalId: string | null;
  collectors: Collector[];
  selectedCollectorId: number | null;
  
  // Device context (global defaults)
  devices: DeviceInfo[];
  isFetchingDevices: boolean;
  hostname: string;
  wildvalue: string;
  datasourceId: string;  // Datasource name or ID for batch collection
  
  // Multi-tab editor state
  tabs: EditorTab[];
  activeTabId: string | null;
  
  // Legacy single-script getters (computed from active tab)
  // These are kept for backward compatibility
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  
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
  
  // Right sidebar state
  rightSidebarOpen: boolean;
  rightSidebarTab: 'properties' | 'snippets' | 'history';
  
  // Device properties state
  deviceProperties: DeviceProperty[];
  isFetchingProperties: boolean;
  propertiesSearchQuery: string;
  selectedDeviceId: number | null;
  
  // Snippet library state
  userSnippets: Snippet[];
  snippetsSearchQuery: string;
  snippetCategoryFilter: 'all' | 'template' | 'pattern';
  snippetLanguageFilter: 'all' | 'groovy' | 'powershell';
  snippetSourceFilter: 'all' | 'builtin' | 'user';
  createSnippetDialogOpen: boolean;
  editingSnippet: Snippet | null;
  
  // Cancel execution state
  currentExecutionId: string | null;
  cancelDialogOpen: boolean;
  
  // User preferences
  preferences: UserPreferences;
  
  // Execution history
  executionHistory: ExecutionHistoryEntry[];
  
  // Draft auto-save
  hasSavedDraft: boolean;
  
  // File system state (Phase 6)
  tabsNeedingPermission: FilePermissionStatus[];
  isRestoringFileHandles: boolean;
  
  // AppliesTo tester state
  appliesToTesterOpen: boolean;
  appliesToExpression: string;
  appliesToResults: Array<{ type: string; id: number; name: string }>;
  appliesToError: string | null;
  appliesToTestFrom: 'devicesGroup' | 'websiteGroup';
  isTestingAppliesTo: boolean;
  appliesToFunctionSearch: string;
  
  // Custom AppliesTo functions state
  customFunctions: CustomAppliesToFunction[];
  isLoadingCustomFunctions: boolean;
  customFunctionError: string | null;
  isCreatingFunction: boolean;
  isUpdatingFunction: boolean;
  isDeletingFunction: boolean;
  
  // Debug commands state
  debugCommandsDialogOpen: boolean;
  debugCommandResults: Record<number, DebugCommandResult>;
  isExecutingDebugCommand: boolean;
  
  // Actions
  setSelectedPortal: (portalId: string | null) => void;
  setSelectedCollector: (collectorId: number | null) => void;
  fetchDevices: () => Promise<void>;
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
  loadDraft: () => Promise<DraftScript | DraftTabs | null>;
  clearDraft: () => Promise<void>;
  restoreDraft: (draft: DraftScript) => void;
  restoreDraftTabs: (draftTabs: DraftTabs) => void;
  
  // File export action (uses download)
  exportToFile: () => void;
  
  // Right sidebar actions
  setRightSidebarOpen: (open: boolean) => void;
  setRightSidebarTab: (tab: 'properties' | 'snippets' | 'history') => void;
  
  // Device properties actions
  fetchDeviceProperties: (deviceId: number) => Promise<void>;
  setPropertiesSearchQuery: (query: string) => void;
  clearDeviceProperties: () => void;
  insertPropertyAccess: (propertyName: string) => void;
  
  // Snippet library actions
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
  
  // Cancel execution actions
  setCancelDialogOpen: (open: boolean) => void;
  cancelExecution: () => Promise<void>;
  
  // Tab management actions
  getActiveTab: () => EditorTab | null;
  openTab: (tab: Omit<EditorTab, 'id'> & { id?: string }) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, newName: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  updateActiveTabContent: (content: string) => void;
  setActiveTabLanguage: (language: ScriptLanguage) => void;
  setActiveTabMode: (mode: ScriptMode) => void;
  setTabContextOverride: (tabId: string, override: EditorTab['contextOverride']) => void;
  openModuleScripts: (module: LogicModuleInfo, scripts: Array<{ type: 'ad' | 'collection'; content: string }>) => void;
  toggleRightSidebar: () => void;
  
  // File operations (Phase 6 - File System Access API)
  openFileFromDisk: () => Promise<void>;
  saveFile: (tabId?: string) => Promise<boolean>;
  saveFileAs: (tabId?: string) => Promise<boolean>;
  restoreFileHandles: () => Promise<void>;
  requestFilePermissions: () => Promise<void>;
  isTabDirty: (tabId: string) => boolean;
  getTabDirtyState: (tab: EditorTab) => boolean;
  
  // Welcome screen / Recent files
  recentFiles: Array<{ tabId: string; fileName: string; lastAccessed: number }>;
  isLoadingRecentFiles: boolean;
  loadRecentFiles: () => Promise<void>;
  openRecentFile: (tabId: string) => Promise<void>;
  createNewFile: () => void;
  
  // AppliesTo tester actions
  setAppliesToTesterOpen: (open: boolean) => void;
  setAppliesToExpression: (expression: string) => void;
  setAppliesToTestFrom: (testFrom: 'devicesGroup' | 'websiteGroup') => void;
  testAppliesTo: () => Promise<void>;
  clearAppliesToResults: () => void;
  setAppliesToFunctionSearch: (query: string) => void;
  
  // Custom AppliesTo functions actions
  fetchCustomFunctions: () => Promise<void>;
  createCustomFunction: (name: string, code: string, description?: string) => Promise<void>;
  updateCustomFunction: (id: number, name: string, code: string, description?: string) => Promise<void>;
  deleteCustomFunction: (id: number) => Promise<void>;
  getAllFunctions: () => Array<{ name: string; syntax: string; parameters: string; description: string; example?: string; source: 'builtin' | 'custom'; customId?: number }>;
  
  // Debug commands actions
  setDebugCommandsDialogOpen: (open: boolean) => void;
  executeDebugCommand: (portalId: string, collectorIds: number[], command: string, parameters?: Record<string, string>) => Promise<void>;
  cancelDebugCommandExecution: () => Promise<void>;
  debugCommandExecutionId: string | null;
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
  DRAFT: 'lm-ide-draft',           // Legacy single-file draft
  DRAFT_TABS: 'lm-ide-draft-tabs', // Multi-tab draft
  USER_SNIPPETS: 'lm-ide-user-snippets',
} as const;

// Helper to create a default tab
function createDefaultTab(language: ScriptLanguage = 'groovy', mode: ScriptMode = 'freeform'): EditorTab {
  return {
    id: crypto.randomUUID(),
    displayName: `Untitled.${language === 'groovy' ? 'groovy' : 'ps1'}`,
    content: language === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE,
    language,
    mode,
  };
}

// No initial tab - WelcomeScreen will show instead

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
  
  // Multi-tab state - starts empty, WelcomeScreen shows when no tabs
  tabs: [],
  activeTabId: null,
  
  // Computed getters from active tab (for backward compatibility)
  get script() {
    const activeTab = get().tabs.find(t => t.id === get().activeTabId);
    return activeTab?.content ?? DEFAULT_GROOVY_TEMPLATE;
  },
  get language() {
    const activeTab = get().tabs.find(t => t.id === get().activeTabId);
    return activeTab?.language ?? 'groovy';
  },
  get mode() {
    const activeTab = get().tabs.find(t => t.id === get().activeTabId);
    return activeTab?.mode ?? 'freeform';
  },
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
  
  // Right sidebar initial state
  rightSidebarOpen: true,
  rightSidebarTab: 'properties',
  
  // Device properties initial state
  deviceProperties: [],
  isFetchingProperties: false,
  propertiesSearchQuery: '',
  selectedDeviceId: null,
  
  // Snippet library initial state
  userSnippets: [],
  snippetsSearchQuery: '',
  snippetCategoryFilter: 'all',
  snippetLanguageFilter: 'all',
  snippetSourceFilter: 'all',
  createSnippetDialogOpen: false,
  editingSnippet: null,
  
  // Cancel execution initial state
  currentExecutionId: null,
  cancelDialogOpen: false,
  
  preferences: DEFAULT_PREFERENCES,
  executionHistory: [],
  hasSavedDraft: false,
  
  // File system initial state
  tabsNeedingPermission: [],
  isRestoringFileHandles: false,
  
  // AppliesTo tester initial state
  appliesToTesterOpen: false,
  appliesToExpression: '',
  appliesToResults: [],
  appliesToError: null,
  appliesToTestFrom: 'devicesGroup',
  isTestingAppliesTo: false,
  appliesToFunctionSearch: '',
  
  // Custom AppliesTo functions initial state
  customFunctions: [],
  isLoadingCustomFunctions: false,
  customFunctionError: null,
  isCreatingFunction: false,
  isUpdatingFunction: false,
  isDeletingFunction: false,
  
  // Debug commands initial state
  debugCommandsDialogOpen: false,
  debugCommandResults: {},
  isExecutingDebugCommand: false,
  debugCommandExecutionId: null,
  
  // Welcome screen / Recent files state
  recentFiles: [],
  isLoadingRecentFiles: false,

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
        
        // Check for error in response (portal tabs may be stale)
        if (fetchResponse.error) {
          console.warn('Device fetch returned error:', fetchResponse.error);
          // Could show a toast notification here in the future
          set({ devices: [], isFetchingDevices: false });
          return;
        }
        
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

  setHostname: (hostname) => {
    set({ hostname });
    
    // Auto-fetch device properties when a device is selected
    if (hostname) {
      const { devices } = get();
      const device = devices.find(d => d.name === hostname);
      if (device) {
        get().fetchDeviceProperties(device.id);
      }
    } else {
      // Clear properties when hostname is cleared
      get().clearDeviceProperties();
    }
  },

  setWildvalue: (wildvalue) => {
    set({ wildvalue });
  },

  setDatasourceId: (datasourceId) => {
    set({ datasourceId });
  },

  setScript: (newScript) => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    // Only update if the script actually changed
    if (newScript !== activeTab.content) {
      set({
        tabs: tabs.map(t => 
          t.id === activeTabId 
            ? { ...t, content: newScript }
            : t
        ),
      });
    }
  },

  setLanguage: (language, force = false) => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    // If same language, do nothing
    if (language === activeTab.language) return;
    
    // Normalize scripts for comparison (trim whitespace, normalize line endings)
    const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
    const isDefaultGroovy = normalize(activeTab.content) === normalize(DEFAULT_GROOVY_TEMPLATE);
    const isDefaultPowershell = normalize(activeTab.content) === normalize(DEFAULT_POWERSHELL_TEMPLATE);
    
    // Determine new content
    let newContent = activeTab.content;
    let newDisplayName = activeTab.displayName;
    
    // Switch templates if:
    // - force is true (user confirmed reset)
    // - script is a default template
    if (force || isDefaultGroovy || isDefaultPowershell) {
      newContent = language === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE;
      // Update display name extension if it's an untitled file
      // Match both "Untitled.ext" and "Untitled N.ext" patterns
      const untitledMatch = activeTab.displayName.match(/^(Untitled(?:\s+\d+)?)\.(groovy|ps1)$/);
      if (untitledMatch) {
        newDisplayName = `${untitledMatch[1]}.${language === 'groovy' ? 'groovy' : 'ps1'}`;
      }
    }
    
    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, language, content: newContent, displayName: newDisplayName }
          : t
      ),
    });
  },

  setMode: (mode) => {
    const { tabs, activeTabId, outputTab } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    // Clear parsed output and switch to raw tab if in freeform mode
    const updates: Partial<EditorState> = { parsedOutput: null };
    if (mode === 'freeform' && (outputTab === 'parsed' || outputTab === 'validation')) {
      updates.outputTab = 'raw';
    }
    
    set({
      ...updates,
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, mode }
          : t
      ),
    });
  },

  setOutputTab: (tab) => {
    set({ outputTab: tab });
  },

  executeScript: async () => {
    const state = get();
    
    // Get active tab data directly (getters don't work on state snapshots)
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (!activeTab) {
      set({
        currentExecution: {
          id: crypto.randomUUID(),
          status: 'error',
          rawOutput: '',
          duration: 0,
          startTime: Date.now(),
          error: 'No active tab',
        },
        outputTab: 'raw',
        parsedOutput: null,
      });
      return;
    }
    
    const script = activeTab.content;
    const language = activeTab.language;
    const mode = activeTab.mode;
    
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
    if (mode === 'collection' || mode === 'batchcollection') {
      set({
        executionContextDialogOpen: true,
        pendingExecution: {
          portalId: state.selectedPortalId,
          collectorId: state.selectedCollectorId,
          script,
          language,
          mode,
          hostname: state.hostname || undefined,
        },
      });
      return;
    }

    // Generate execution ID for tracking/cancellation
    const executionId = crypto.randomUUID();
    
    // Clear previous execution and switch to raw output tab
    set({ 
      isExecuting: true, 
      currentExecution: null,
      currentExecutionId: executionId,
      parsedOutput: null,
      outputTab: 'raw',
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_SCRIPT',
        payload: {
          portalId: state.selectedPortalId,
          collectorId: state.selectedCollectorId,
          script,
          language,
          mode,
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
          language,
          mode,
          script,
          output: execution.rawOutput,
          status: execution.status === 'complete' ? 'success' : 'error',
          duration: execution.duration,
        });
        
        // Auto-parse output if not in freeform mode and execution succeeded
        if (mode !== 'freeform' && execution.status === 'complete' && execution.rawOutput) {
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
    if (!selectedPortalId) return;

    const fetchingForPortal = selectedPortalId;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_COLLECTORS',
        payload: { portalId: selectedPortalId },
      });
      
      // Prevent race conditions when portal changes while fetching
      const currentPortal = get().selectedPortalId;
      if (currentPortal !== fetchingForPortal) return;
      
      if (response?.payload) {
        set({ collectors: response.payload });
      }
    } catch {
      // Silently handle - collectors will remain empty
    }
  },

  clearOutput: () => {
    set({ currentExecution: null, parsedOutput: null });
  },

  // Parse the current execution output based on mode
  parseCurrentOutput: () => {
    const { currentExecution, tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    const mode = activeTab?.mode ?? 'freeform';
    
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
    const { selectedModule } = get();
    
    // Create a new tab for the loaded script
    const moduleName = selectedModule?.name || 'Module';
    const extension = language === 'groovy' ? 'groovy' : 'ps1';
    const modeLabel = mode === 'ad' ? 'ad' : mode === 'batchcollection' ? 'batch' : 'collection';
    const displayName = `${moduleName}/${modeLabel}.${extension}`;
    
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
    });
  },

  confirmModuleLoad: () => {
    const { pendingModuleLoad, selectedModule } = get();
    if (!pendingModuleLoad) return;

    // Create a new tab for the loaded script
    const moduleName = selectedModule?.name || 'Module';
    const extension = pendingModuleLoad.language === 'groovy' ? 'groovy' : 'ps1';
    const modeLabel = pendingModuleLoad.mode === 'ad' ? 'ad' : pendingModuleLoad.mode === 'batchcollection' ? 'batch' : 'collection';
    const displayName = `${moduleName}/${modeLabel}.${extension}`;
    
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
        
        // Check if editor is in initial state (using default template)
        const { tabs, activeTabId } = get();
        const activeTab = tabs.find(t => t.id === activeTabId);
        const currentScript = activeTab?.content ?? '';
        
        const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
        const isDefaultGroovy = normalize(currentScript) === normalize(DEFAULT_GROOVY_TEMPLATE);
        const isDefaultPowershell = normalize(currentScript) === normalize(DEFAULT_POWERSHELL_TEMPLATE);
        const isInitialState = isDefaultGroovy || isDefaultPowershell;
        
        // Apply default language/mode from preferences if in initial state
        if (isInitialState && activeTabId) {
          const newLanguage = mergedPrefs.defaultLanguage;
          const newMode = mergedPrefs.defaultMode;
          const newScript = newLanguage === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE;
          const extension = newLanguage === 'groovy' ? '.groovy' : '.ps1';
          
          // Update the active tab with new language, mode, and content
          set({ 
            preferences: mergedPrefs,
            tabs: tabs.map(t => 
              t.id === activeTabId
                ? { 
                    ...t, 
                    language: newLanguage, 
                    mode: newMode, 
                    content: newScript,
                    displayName: t.displayName.replace(/\.(groovy|ps1)$/, extension),
                  }
                : t
            ),
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
    const extension = entry.language === 'groovy' ? 'groovy' : 'ps1';
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const displayName = `History ${timestamp}.${extension}`;
    
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName,
      content: entry.script,
      language: entry.language,
      mode: entry.mode,
      source: {
        type: 'history',
      },
      contextOverride: entry.hostname ? {
        hostname: entry.hostname,
        collectorId: entry.collectorId,
      } : undefined,
    };
    
    const { tabs } = get();
    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
      hostname: entry.hostname || '',
      executionHistoryOpen: false,
    });
  },

  // Draft actions
  saveDraft: async () => {
    try {
      const { tabs, activeTabId, hasSavedDraft } = get();
      
      // Normalize for comparison
      const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
      
      // Check if all tabs are default templates (nothing to save)
      const hasNonDefaultContent = tabs.some(tab => {
        const normalizedContent = normalize(tab.content);
        const isDefaultGroovy = normalizedContent === normalize(DEFAULT_GROOVY_TEMPLATE);
        const isDefaultPowershell = normalizedContent === normalize(DEFAULT_POWERSHELL_TEMPLATE);
        return !isDefaultGroovy && !isDefaultPowershell;
      });
      
      // Skip saving if all tabs are default templates
      if (!hasNonDefaultContent && tabs.length <= 1) {
        // If there was a saved draft, clear it since we're back to default
        if (hasSavedDraft) {
          await chrome.storage.local.remove(STORAGE_KEYS.DRAFT_TABS);
          await chrome.storage.local.remove(STORAGE_KEYS.DRAFT);
          set({ hasSavedDraft: false });
        }
        return;
      }
      
      const draftTabs: DraftTabs = {
        tabs,
        activeTabId,
        lastModified: Date.now(),
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.DRAFT_TABS]: draftTabs });
      set({ hasSavedDraft: true });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  },

  loadDraft: async () => {
    try {
      // First try to load multi-tab draft
      const tabsResult = await chrome.storage.local.get(STORAGE_KEYS.DRAFT_TABS);
      if (tabsResult[STORAGE_KEYS.DRAFT_TABS]) {
        const draftTabs = tabsResult[STORAGE_KEYS.DRAFT_TABS] as DraftTabs;
        set({ hasSavedDraft: true });
        return draftTabs; // Return for dialog, don't auto-restore
      }
      
      // Fall back to legacy single-file draft
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
      await chrome.storage.local.remove(STORAGE_KEYS.DRAFT_TABS);
      set({ hasSavedDraft: false });
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  },

  restoreDraft: (draft) => {
    // Create a tab from the legacy draft format
    const extension = draft.language === 'groovy' ? 'groovy' : 'ps1';
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName: `Recovered.${extension}`,
      content: draft.script,
      language: draft.language,
      mode: draft.mode,
    };
    
    set({
      tabs: [newTab],
      activeTabId: newTab.id,
      hostname: draft.hostname || '',
      hasSavedDraft: true, // Mark as having saved draft so auto-save will update it
    });
    // Don't call clearDraft here - let the auto-save overwrite instead
    // This prevents race conditions where clear happens before save
  },
  
  restoreDraftTabs: (draftTabs) => {
    set({
      tabs: draftTabs.tabs,
      activeTabId: draftTabs.activeTabId,
      hasSavedDraft: true, // Mark as having saved draft so auto-save will update it
    });
    // Don't call clearDraft here - let the auto-save overwrite instead
  },

  // File export action (uses download)
  exportToFile: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    const extension = activeTab.language === 'groovy' ? '.groovy' : '.ps1';
    const baseName = activeTab.displayName.replace(/\.(groovy|ps1)$/, '');
    const fileName = `${baseName}${extension}`;

    const blob = new Blob([activeTab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Right sidebar actions
  setRightSidebarOpen: (open) => {
    set({ rightSidebarOpen: open });
  },

  setRightSidebarTab: (tab) => {
    set({ rightSidebarTab: tab });
  },

  // Device properties actions
  fetchDeviceProperties: async (deviceId) => {
    const { selectedPortalId } = get();
    if (!selectedPortalId) return;

    set({ isFetchingProperties: true, selectedDeviceId: deviceId });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEVICE_PROPERTIES',
        payload: { portalId: selectedPortalId, deviceId },
      });

      if (response?.type === 'DEVICE_PROPERTIES_LOADED') {
        set({ deviceProperties: response.payload, isFetchingProperties: false });
      } else {
        console.error('Failed to fetch device properties:', response);
        set({ deviceProperties: [], isFetchingProperties: false });
      }
    } catch (error) {
      console.error('Error fetching device properties:', error);
      set({ deviceProperties: [], isFetchingProperties: false });
    }
  },

  setPropertiesSearchQuery: (query) => {
    set({ propertiesSearchQuery: query });
  },

  clearDeviceProperties: () => {
    set({ deviceProperties: [], selectedDeviceId: null, propertiesSearchQuery: '' });
  },

  insertPropertyAccess: (propertyName) => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    const accessor = activeTab.language === 'groovy' 
      ? `hostProps.get("${propertyName}")`
      : `"##${propertyName.toUpperCase()}##"`;
    
    // For now, append to the end of the script
    // In the future, this could insert at cursor position via Monaco API
    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, content: t.content + '\n' + accessor }
          : t
      ),
    });
  },

  // Snippet library actions
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
    const { tabs, activeTabId } = get();
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
      });
    } else {
      // Patterns insert at end (could be at cursor in future)
      set({
        tabs: tabs.map(t => 
          t.id === activeTabId 
            ? { ...t, content: t.content + '\n\n' + snippet.code }
            : t
        ),
      });
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
    chrome.storage.local.set({ [STORAGE_KEYS.USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  updateUserSnippet: (id, updates) => {
    const { userSnippets } = get();
    const updatedSnippets = userSnippets.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    set({ userSnippets: updatedSnippets, createSnippetDialogOpen: false, editingSnippet: null });
    
    // Persist to storage
    chrome.storage.local.set({ [STORAGE_KEYS.USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  deleteUserSnippet: (id) => {
    const { userSnippets } = get();
    const updatedSnippets = userSnippets.filter(s => s.id !== id);
    set({ userSnippets: updatedSnippets });
    
    // Persist to storage
    chrome.storage.local.set({ [STORAGE_KEYS.USER_SNIPPETS]: updatedSnippets }).catch(console.error);
  },

  loadUserSnippets: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_SNIPPETS);
      const storedSnippets = result[STORAGE_KEYS.USER_SNIPPETS] as Snippet[] | undefined;
      if (storedSnippets) {
        set({ userSnippets: storedSnippets });
      }
    } catch (error) {
      console.error('Failed to load user snippets:', error);
    }
  },

  // Cancel execution actions
  setCancelDialogOpen: (open) => {
    set({ cancelDialogOpen: open });
  },

  cancelExecution: async () => {
    const { currentExecutionId } = get();
    if (!currentExecutionId) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CANCEL_EXECUTION',
        payload: { executionId: currentExecutionId },
      });

      if (response?.success) {
        set({ 
          isExecuting: false, 
          cancelDialogOpen: false,
          currentExecution: {
            id: currentExecutionId,
            status: 'cancelled',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: 'Execution cancelled by user',
          },
        });
      }
    } catch (error) {
      console.error('Failed to cancel execution:', error);
    }
    
    set({ cancelDialogOpen: false });
  },

  // Tab management actions
  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId) ?? null;
  },

  openTab: (tabData) => {
    const id = tabData.id || crypto.randomUUID();
    const newTab: EditorTab = {
      id,
      displayName: tabData.displayName,
      content: tabData.content,
      language: tabData.language,
      mode: tabData.mode,
      source: tabData.source,
      contextOverride: tabData.contextOverride,
    };
    
    const { tabs } = get();
    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
    });
    
    return id;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, tabsNeedingPermission } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    
    // NOTE: We intentionally do NOT delete file handles when closing tabs.
    // This allows them to persist in "Recent Files" for the WelcomeScreen.
    // Handles are only deleted when opening a recent file that no longer exists.
    
    // Remove from permission-needed list if present
    const newTabsNeedingPermission = tabsNeedingPermission.filter(t => t.tabId !== tabId);
    
    // If we're closing the active tab, switch to another one
    let newActiveTabId: string | null = activeTabId;
    if (tabId === activeTabId) {
      if (newTabs.length === 0) {
        // No tabs left - WelcomeScreen will show
        newActiveTabId = null;
      } else {
        // Switch to the tab to the left, or the first tab if we're at the start
        const newIndex = Math.max(0, tabIndex - 1);
        newActiveTabId = newTabs[newIndex].id;
      }
    }
    
    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
      tabsNeedingPermission: newTabsNeedingPermission,
    });
  },

  closeOtherTabs: (tabId) => {
    const { tabs } = get();
    const tabToKeep = tabs.find(t => t.id === tabId);
    if (!tabToKeep) return;
    
    set({
      tabs: [tabToKeep],
      activeTabId: tabId,
    });
  },

  closeAllTabs: () => {
    // Clear all tabs - WelcomeScreen will show
    set({
      tabs: [],
      activeTabId: null,
    });
  },

  setActiveTab: (tabId) => {
    const { tabs } = get();
    if (tabs.some(t => t.id === tabId)) {
      set({ activeTabId: tabId });
    }
  },

  renameTab: (tabId, newName) => {
    const { tabs } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // Ensure name has appropriate extension
    let displayName = newName.trim();
    if (!displayName) return;
    
    // Add extension if missing
    if (!displayName.endsWith('.groovy') && !displayName.endsWith('.ps1')) {
      displayName += tab.language === 'groovy' ? '.groovy' : '.ps1';
    }
    
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, displayName }
          : t
      ),
    });
  },

  updateTabContent: (tabId, content) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, content }
          : t
      ),
    });
  },

  updateActiveTabContent: (content) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, content }
          : t
      ),
    });
  },

  setActiveTabLanguage: (language) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, language }
          : t
      ),
    });
  },

  setActiveTabMode: (mode) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, mode }
          : t
      ),
    });
  },

  setTabContextOverride: (tabId, override) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, contextOverride: override }
          : t
      ),
    });
  },

  openModuleScripts: (module, scripts) => {
    const { tabs } = get();
    const extension = module.scriptType === 'powerShell' ? 'ps1' : 'groovy';
    const language: ScriptLanguage = module.scriptType === 'powerShell' ? 'powershell' : 'groovy';
    
    const newTabs: EditorTab[] = scripts.map(script => ({
      id: crypto.randomUUID(),
      displayName: `${module.name}/${script.type}.${extension}`,
      content: script.content,
      language,
      mode: script.type === 'ad' ? 'ad' as ScriptMode : (module.collectMethod === 'batchscript' ? 'batchcollection' : 'collection') as ScriptMode,
      source: {
        type: 'module' as const,
        moduleId: module.id,
        moduleName: module.name,
      },
    }));
    
    // Add all new tabs and activate the first one
    set({
      tabs: [...tabs, ...newTabs],
      activeTabId: newTabs[0]?.id ?? get().activeTabId,
      moduleBrowserOpen: false,
      selectedModule: null,
      moduleSearchQuery: '',
    });
  },

  toggleRightSidebar: () => {
    set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen }));
  },

  // File operations (Phase 6 - File System Access API)
  openFileFromDisk: async () => {
    // Check if File System Access API is supported
    if (!fileHandleStore.isFileSystemAccessSupported()) {
      // Fallback to input element for unsupported browsers
      return new Promise<void>((resolve) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.groovy,.ps1,.txt';
        
        fileInput.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            resolve();
            return;
          }
          
          const content = await file.text();
          const fileName = file.name;
          const isGroovy = fileName.endsWith('.groovy');
          
          const newTab: EditorTab = {
            id: crypto.randomUUID(),
            displayName: fileName,
            content,
            language: isGroovy ? 'groovy' : 'powershell',
            mode: 'freeform',
            originalContent: content,
            hasFileHandle: false,
            isLocalFile: true,
            source: { type: 'file' },
          };
          
          set({
            tabs: [...get().tabs, newTab],
            activeTabId: newTab.id,
          });
          resolve();
        };
        
        fileInput.click();
      });
    }

    try {
      // Use File System Access API
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Script Files',
            accept: {
              'text/plain': ['.groovy', '.ps1', '.txt'],
            },
          },
        ],
        multiple: false,
      });
      
      // Read file content
      const file = await handle.getFile();
      const content = await file.text();
      const fileName = file.name;
      const isGroovy = fileName.endsWith('.groovy');
      
      // Generate tab ID
      const tabId = crypto.randomUUID();
      
      // Store handle in IndexedDB
      await fileHandleStore.saveHandle(tabId, handle, fileName);
      
      // Create new tab
      const newTab: EditorTab = {
        id: tabId,
        displayName: fileName,
        content,
        language: isGroovy ? 'groovy' : 'powershell',
        mode: 'freeform',
        originalContent: content,
        hasFileHandle: true,
        isLocalFile: true,
        source: { type: 'file' },
      };
      
      set({
        tabs: [...get().tabs, newTab],
        activeTabId: tabId,
      });
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Error opening file:', error);
      }
    }
  },

  saveFile: async (tabId?: string) => {
    const { tabs, activeTabId } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return false;
    
    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab) return false;

    try {
      // Check for existing handle
      const handle = await fileHandleStore.getHandle(targetTabId);
      
      if (handle) {
        // Check permission
        const permission = await fileHandleStore.queryPermission(handle);
        
        if (permission === 'granted') {
          // Direct save to existing file
          await fileHandleStore.writeToHandle(handle, tab.content);
          
          // Update lastAccessed timestamp for recent files
          await fileHandleStore.saveHandle(targetTabId, handle, tab.displayName);
          
          // Update originalContent to mark as clean
          set({
            tabs: tabs.map(t => 
              t.id === targetTabId 
                ? { ...t, originalContent: tab.content }
                : t
            ),
          });
          return true;
        } else if (permission === 'prompt') {
          // Need to request permission
          const granted = await fileHandleStore.requestPermission(handle);
          if (granted) {
            await fileHandleStore.writeToHandle(handle, tab.content);
            
            // Update lastAccessed timestamp for recent files
            await fileHandleStore.saveHandle(targetTabId, handle, tab.displayName);
            
            set({
              tabs: tabs.map(t => 
                t.id === targetTabId 
                  ? { ...t, originalContent: tab.content }
                  : t
              ),
            });
            return true;
          }
        }
        
        // Permission denied - fall through to Save As
      }
      
      // No handle or permission denied - trigger Save As
      return await get().saveFileAs(targetTabId);
    } catch (error) {
      console.error('Error saving file:', error);
      // Fall back to Save As on error
      return await get().saveFileAs(targetTabId);
    }
  },

  saveFileAs: async (tabId?: string) => {
    const { tabs, activeTabId } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return false;
    
    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab) return false;

    // Check if File System Access API is supported
    if (!fileHandleStore.isFileSystemAccessSupported()) {
      // Fallback to download
      get().exportToFile();
      return true;
    }

    try {
      const extension = tab.language === 'groovy' ? '.groovy' : '.ps1';
      const baseName = tab.displayName.replace(/\.(groovy|ps1)$/, '');
      const suggestedName = baseName + extension;
      
      // Show save picker
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Script Files',
            accept: tab.language === 'groovy' 
              ? { 'text/plain': ['.groovy'] }
              : { 'text/plain': ['.ps1'] },
          },
        ],
      });
      
      // Write content
      await fileHandleStore.writeToHandle(handle, tab.content);
      
      // Store new handle in IndexedDB
      await fileHandleStore.saveHandle(targetTabId, handle, handle.name);
      
      // Update tab state
      set({
        tabs: tabs.map(t => 
          t.id === targetTabId 
            ? { 
                ...t, 
                displayName: handle.name,
                originalContent: tab.content,
                hasFileHandle: true,
                isLocalFile: true,
              }
            : t
        ),
      });
      
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error in Save As:', error);
      }
      return false;
    }
  },

  restoreFileHandles: async () => {
    set({ isRestoringFileHandles: true });
    
    try {
      const { tabs } = get();
      const storedHandles = await fileHandleStore.getAllHandles();
      const needsPermission: FilePermissionStatus[] = [];
      
      // Check permission for each handle
      for (const [tabId, record] of storedHandles) {
        // Only process handles for tabs that still exist
        const tabExists = tabs.some(t => t.id === tabId);
        if (!tabExists) {
          // Clean up orphaned handle
          await fileHandleStore.deleteHandle(tabId);
          continue;
        }
        
        const permission = await fileHandleStore.queryPermission(record.handle);
        
        if (permission === 'prompt') {
          needsPermission.push({
            tabId,
            fileName: record.fileName,
            state: 'prompt',
          });
        } else if (permission === 'denied') {
          // Update tab to reflect no handle access
          set({
            tabs: get().tabs.map(t => 
              t.id === tabId 
                ? { ...t, hasFileHandle: false }
                : t
            ),
          });
        }
        // If granted, handle is ready to use - no action needed
      }
      
      set({ 
        tabsNeedingPermission: needsPermission,
        isRestoringFileHandles: false,
      });
    } catch (error) {
      console.error('Error restoring file handles:', error);
      set({ isRestoringFileHandles: false });
    }
  },

  requestFilePermissions: async () => {
    const { tabsNeedingPermission, tabs } = get();
    const stillNeedsPermission: FilePermissionStatus[] = [];
    
    for (const status of tabsNeedingPermission) {
      try {
        const handle = await fileHandleStore.getHandle(status.tabId);
        if (!handle) continue;
        
        const granted = await fileHandleStore.requestPermission(handle);
        
        if (granted) {
          // Optionally re-read file content to check for external changes
          try {
            const newContent = await fileHandleStore.readFromHandle(handle);
            const tab = tabs.find(t => t.id === status.tabId);
            
            if (tab && tab.originalContent !== newContent) {
              // File was modified externally - update originalContent
              // Keep user's current edits, but update the baseline
              set({
                tabs: get().tabs.map(t => 
                  t.id === status.tabId 
                    ? { ...t, originalContent: newContent, hasFileHandle: true }
                    : t
                ),
              });
            } else {
              // Just mark as having handle
              set({
                tabs: get().tabs.map(t => 
                  t.id === status.tabId 
                    ? { ...t, hasFileHandle: true }
                    : t
                ),
              });
            }
          } catch {
            // File might have been deleted - just mark handle as available
            set({
              tabs: get().tabs.map(t => 
                t.id === status.tabId 
                  ? { ...t, hasFileHandle: true }
                  : t
              ),
            });
          }
        } else {
          stillNeedsPermission.push(status);
        }
      } catch {
        stillNeedsPermission.push(status);
      }
    }
    
    set({ tabsNeedingPermission: stillNeedsPermission });
  },

  isTabDirty: (tabId: string) => {
    const tab = get().tabs.find(t => t.id === tabId);
    if (!tab) return false;
    return get().getTabDirtyState(tab);
  },

  getTabDirtyState: (tab: EditorTab) => {
    // New file without originalContent is always "dirty" (never saved)
    if (tab.originalContent === undefined) {
      return true;
    }
    
    // Compare current content to original
    return tab.content !== tab.originalContent;
  },

  // Welcome screen actions
  loadRecentFiles: async () => {
    set({ isLoadingRecentFiles: true });
    try {
      const recentFiles = await fileHandleStore.getRecentHandles(10);
      set({ recentFiles, isLoadingRecentFiles: false });
    } catch (error) {
      console.error('Failed to load recent files:', error);
      set({ recentFiles: [], isLoadingRecentFiles: false });
    }
  },

  openRecentFile: async (tabId: string) => {
    try {
      const handle = await fileHandleStore.getHandle(tabId);
      if (!handle) {
        console.warn('File handle not found for tabId:', tabId);
        // Remove from recent files since handle is gone
        await fileHandleStore.deleteHandle(tabId);
        get().loadRecentFiles();
        return;
      }

      // Check permission
      let permission = await fileHandleStore.queryPermission(handle);
      if (permission !== 'granted') {
        permission = (await fileHandleStore.requestPermission(handle)) ? 'granted' : 'denied';
      }

      if (permission !== 'granted') {
        console.warn('Permission denied for file:', handle.name);
        return;
      }

      // Read file content
      const content = await fileHandleStore.readFromHandle(handle);
      const fileName = handle.name;
      const language: ScriptLanguage = fileName.endsWith('.ps1') ? 'powershell' : 'groovy';

      // Update lastAccessed
      await fileHandleStore.saveHandle(tabId, handle, fileName);

      // Create new tab with the file content
      const newTab: EditorTab = {
        id: tabId, // Reuse the same tabId so handle mapping is preserved
        displayName: fileName,
        content,
        language,
        mode: 'freeform',
        originalContent: content,
        hasFileHandle: true,
        isLocalFile: true,
      };

      set({
        tabs: [...get().tabs, newTab],
        activeTabId: tabId,
      });
    } catch (error) {
      console.error('Failed to open recent file:', error);
    }
  },

  createNewFile: () => {
    const { preferences } = get();
    const language = preferences.defaultLanguage || 'groovy';
    const mode = preferences.defaultMode || 'freeform';
    const newTab = createDefaultTab(language, mode);
    
    set({
      tabs: [...get().tabs, newTab],
      activeTabId: newTab.id,
    });
  },
  
  // AppliesTo tester actions
  setAppliesToTesterOpen: (open: boolean) => {
    set({ appliesToTesterOpen: open });
    // Clear error when opening
    if (open) {
      set({ appliesToError: null });
    }
  },
  
  setAppliesToExpression: (expression: string) => {
    set({ appliesToExpression: expression });
  },
  
  setAppliesToTestFrom: (testFrom: 'devicesGroup' | 'websiteGroup') => {
    set({ appliesToTestFrom: testFrom });
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
  
  setAppliesToFunctionSearch: (query: string) => {
    set({ appliesToFunctionSearch: query });
  },
  
  // Custom AppliesTo functions actions
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
      syntax: `${cf.name}()`, // Custom functions are called like built-in functions
      parameters: '', // Custom functions don't have documented parameters
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

  // Debug commands actions
  setDebugCommandsDialogOpen: (open: boolean) => {
    set({ debugCommandsDialogOpen: open });
    if (!open) {
      // Clear results when closing
      set({ debugCommandResults: {}, isExecutingDebugCommand: false, debugCommandExecutionId: null });
    }
  },

  executeDebugCommand: async (portalId: string, collectorIds: number[], command: string, parameters?: Record<string, string>) => {
    const executionId = crypto.randomUUID();
    set({ isExecutingDebugCommand: true, debugCommandResults: {}, debugCommandExecutionId: executionId });

    const request: ExecuteDebugCommandRequest = {
      portalId,
      collectorIds,
      command,
      parameters,
    };

    // Set up message listener for progress updates and completion
    const progressListener = (message: any) => {
      // Only handle messages for this execution
      if (message.executionId && message.executionId !== executionId) {
        return false;
      }

      if (message.type === 'DEBUG_COMMAND_UPDATE') {
        // Progress updates - could show progress in UI if needed
        // For now, we just track execution state
      } else if (message.type === 'DEBUG_COMMAND_COMPLETE') {
        set({
          debugCommandResults: message.payload.results,
          isExecutingDebugCommand: false,
          debugCommandExecutionId: null,
        });
        chrome.runtime.onMessage.removeListener(progressListener);
      } else if (message.type === 'ERROR' && message.payload.code === 'DEBUG_COMMAND_ERROR') {
        set({
          isExecutingDebugCommand: false,
          debugCommandExecutionId: null,
        });
        chrome.runtime.onMessage.removeListener(progressListener);
        toast.error('Debug command execution failed', {
          description: message.payload.message,
        });
      }
      return false; // Don't keep channel open
    };

    chrome.runtime.onMessage.addListener(progressListener);

    try {
      // Send execution request with executionId
      // Note: The service worker will send messages back via onMessage
      await chrome.runtime.sendMessage({
        type: 'EXECUTE_DEBUG_COMMAND',
        payload: { ...request, executionId },
      });
    } catch (error) {
      set({ isExecutingDebugCommand: false, debugCommandExecutionId: null });
      chrome.runtime.onMessage.removeListener(progressListener);
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
      toast.info('Debug command execution cancelled');
    } catch (error) {
      toast.error('Failed to cancel debug command', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
}));

