import { create } from 'zustand';
import type { 
  Portal, 
  Collector, 
  ScriptLanguage, 
  ScriptMode,
  ExecutionResult,
  LogicModule,
} from '@/shared/types';

interface EditorState {
  // Portal/Collector selection
  portals: Portal[];
  selectedPortalId: string | null;
  collectors: Collector[];
  selectedCollectorId: number | null;
  
  // Device context
  hostname: string;
  wildvalue: string;
  
  // Editor state
  script: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  isDirty: boolean;
  
  // Execution state
  isExecuting: boolean;
  currentExecution: ExecutionResult | null;
  
  // Module browser
  moduleSearchQuery: string;
  moduleSearchResults: LogicModule[];
  isSearching: boolean;
  loadedModule: LogicModule | null;
  
  // UI state
  outputTab: 'raw' | 'parsed' | 'validation';
  
  // Actions
  setSelectedPortal: (portalId: string | null) => void;
  setSelectedCollector: (collectorId: number | null) => void;
  setHostname: (hostname: string) => void;
  setWildvalue: (wildvalue: string) => void;
  setScript: (script: string) => void;
  setLanguage: (language: ScriptLanguage) => void;
  setMode: (mode: ScriptMode) => void;
  setOutputTab: (tab: 'raw' | 'parsed' | 'validation') => void;
  executeScript: () => Promise<void>;
  refreshPortals: () => Promise<void>;
  refreshCollectors: () => Promise<void>;
  clearOutput: () => void;
}

const DEFAULT_GROOVY_TEMPLATE = `import com.santaba.agent.groovyapi.expect.Expect;
import com.santaba.agent.groovyapi.snmp.Snmp;
import com.santaba.agent.groovyapi.http.*;
import com.santaba.agent.groovyapi.jmx.*;

def hostname = hostProps.get("system.hostname");

// Your script here

return 0;
`;

const DEFAULT_POWERSHELL_TEMPLATE = `# LogicMonitor PowerShell Script
# Note: Use $hostProps hashtable for device properties

$hostname = $hostProps["system.hostname"]

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
  script: DEFAULT_GROOVY_TEMPLATE,
  language: 'groovy',
  mode: 'freeform',
  isDirty: false,
  isExecuting: false,
  currentExecution: null,
  moduleSearchQuery: '',
  moduleSearchResults: [],
  isSearching: false,
  loadedModule: null,
  outputTab: 'raw',

  // Actions
  setSelectedPortal: (portalId) => {
    set({ selectedPortalId: portalId, selectedCollectorId: null, collectors: [] });
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

  setScript: (script) => {
    set({ script, isDirty: true });
  },

  setLanguage: (language) => {
    const currentScript = get().script;
    const isDefaultGroovy = currentScript === DEFAULT_GROOVY_TEMPLATE;
    const isDefaultPowershell = currentScript === DEFAULT_POWERSHELL_TEMPLATE;
    
    // If switching language and script is still default, update template
    if (isDefaultGroovy || isDefaultPowershell) {
      set({ 
        language, 
        script: language === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE 
      });
    } else {
      set({ language });
    }
  },

  setMode: (mode) => {
    set({ mode });
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
      });
      return;
    }

    set({ isExecuting: true });

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
        },
      });

      if (response.type === 'EXECUTION_UPDATE') {
        set({ currentExecution: response.payload, isExecuting: false });
      } else if (response.type === 'ERROR') {
        set({
          currentExecution: {
            id: crypto.randomUUID(),
            status: 'error',
            rawOutput: '',
            duration: 0,
            startTime: Date.now(),
            error: response.payload.message,
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
    set({ currentExecution: null });
  },
}));

