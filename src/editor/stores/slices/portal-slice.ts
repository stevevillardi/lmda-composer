/**
 * Portal slice - manages portal, collector, and device context.
 */

import { toast } from 'sonner';
import type { StateCreator } from 'zustand';
import type { 
  Portal, 
  Collector, 
  DeviceInfo,
  LogicModuleType,
} from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

/**
 * State managed by the portal slice.
 */
export interface PortalSliceState {
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
}

/**
 * Actions provided by the portal slice.
 */
export interface PortalSliceActions {
  setSelectedPortal: (portalId: string | null) => void;
  switchToPortalWithContext: (portalId: string, context?: { collectorId?: number; hostname?: string }) => Promise<void>;
  setSelectedCollector: (collectorId: number | null) => void;
  fetchDevices: () => Promise<void>;
  setHostname: (hostname: string) => void;
  setWildvalue: (wildvalue: string) => void;
  setDatasourceId: (datasourceId: string) => void;
  refreshPortals: () => Promise<void>;
  refreshCollectors: () => Promise<void>;
  handlePortalDisconnected: (portalId: string, hostname: string) => void;
}

/**
 * Combined slice interface.
 */
export interface PortalSlice extends PortalSliceState, PortalSliceActions {}

// ============================================================================
// Dependencies - state accessed from other slices
// ============================================================================

/**
 * State from other slices that the portal slice needs to access.
 */
interface PortalSliceDependencies {
  // From module slice - portal change clears module cache
  modulesCache: Record<LogicModuleType, unknown[]>;
  modulesMeta: Record<LogicModuleType, { offset: number; hasMore: boolean; total: number }>;
  modulesSearch: Record<LogicModuleType, string>;
  moduleSearchIndexInfo: unknown;
  
  // From device properties slice
  fetchDeviceProperties: (deviceId: number) => void;
  clearDeviceProperties: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_LAST_CONTEXT = 'lm-ide-last-context';

// Interface for persisted context
interface LastContextState {
  portalId: string | null;
  collectorId: number | null;
  hostname: string;
}

// Debounced context persistence
let contextPersistTimeout: ReturnType<typeof setTimeout> | null = null;
const CONTEXT_PERSIST_DELAY = 1000; // 1 second debounce

function persistContext(context: LastContextState) {
  if (contextPersistTimeout) {
    clearTimeout(contextPersistTimeout);
  }
  contextPersistTimeout = setTimeout(() => {
    chrome.storage.local.set({ [STORAGE_KEY_LAST_CONTEXT]: context }).catch(console.error);
  }, CONTEXT_PERSIST_DELAY);
}

async function loadLastContext(): Promise<LastContextState | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_LAST_CONTEXT);
    return result[STORAGE_KEY_LAST_CONTEXT] as LastContextState | null;
  } catch {
    return null;
  }
}

// ============================================================================
// Initial State
// ============================================================================

export const portalSliceInitialState: PortalSliceState = {
  portals: [],
  selectedPortalId: null,
  collectors: [],
  selectedCollectorId: null,
  devices: [],
  isFetchingDevices: false,
  hostname: '',
  wildvalue: '',
  datasourceId: '',
};

// ============================================================================
// Helper - creates empty module state for portal changes
// ============================================================================

function createEmptyModuleState() {
  return {
    modulesCache: {
      datasource: [],
      configsource: [],
      topologysource: [],
      propertysource: [],
      logsource: [],
      diagnosticsource: [],
      eventsource: [],
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
    moduleSearchIndexInfo: null,
  };
}

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Creates the portal slice.
 */
export const createPortalSlice: StateCreator<
  PortalSlice & PortalSliceDependencies,
  [],
  [],
  PortalSlice
> = (set, get) => ({
  ...portalSliceInitialState,

  setSelectedPortal: (portalId) => {
    set({ 
      selectedPortalId: portalId, 
      selectedCollectorId: null, 
      collectors: [],
      devices: [],
      isFetchingDevices: false,
      hostname: '',
      // Clear module cache when portal changes
      ...createEmptyModuleState(),
    });
    if (portalId) {
      get().refreshCollectors();
    }
    // Persist context (null out collector/hostname when portal changes)
    persistContext({ portalId, collectorId: null, hostname: '' });
  },

  switchToPortalWithContext: async (portalId, context) => {
    // Switch portal first (this clears collectors, devices, etc.)
    set({ 
      selectedPortalId: portalId, 
      selectedCollectorId: null, 
      collectors: [],
      devices: [],
      isFetchingDevices: false,
      hostname: '',
      // Clear module cache when portal changes
      ...createEmptyModuleState(),
    });

    // Fetch collectors for the new portal
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_COLLECTORS',
        payload: { portalId },
      });
      
      // Prevent race conditions when portal changes while fetching
      const currentPortal = get().selectedPortalId;
      if (currentPortal !== portalId) return;
      
      if (response?.payload) {
        const collectors = response.payload as Collector[];
        set({ collectors });
        
        // Try to restore the specific collector from context
        let selectedCollector: Collector | null = null;
        if (context?.collectorId) {
          selectedCollector = collectors.find(c => c.id === context.collectorId) || null;
        }
        
        // If requested collector not found, fall back to first non-down collector
        if (!selectedCollector && collectors.length > 0) {
          selectedCollector = collectors.find(c => !c.isDown) || collectors[0];
        }
        
        if (selectedCollector) {
          set({ selectedCollectorId: selectedCollector.id });
          
          // Fetch devices for the selected collector
          await get().fetchDevices();
          
          // Restore hostname if provided and devices are loaded
          if (context?.hostname) {
            const { devices } = get();
            const device = devices.find(d => d.name === context.hostname);
            if (device) {
              set({ hostname: context.hostname });
              get().fetchDeviceProperties(device.id);
            }
          }
          
          // Persist the restored context
          persistContext({ 
            portalId, 
            collectorId: selectedCollector.id, 
            hostname: context?.hostname || '' 
          });
        }
      }
    } catch {
      // Silently handle - collectors will remain empty
    }
  },

  setSelectedCollector: (collectorId) => {
    const { selectedPortalId } = get();
    set({ 
      selectedCollectorId: collectorId,
      devices: [],
      isFetchingDevices: false,
      hostname: '',
    });
    // Persist context
    persistContext({ portalId: selectedPortalId, collectorId, hostname: '' });
    // Fetch devices when collector changes
    if (collectorId) {
      get().fetchDevices();
    }
  },

  fetchDevices: async () => {
    const { selectedPortalId, selectedCollectorId } = get();
    if (!selectedPortalId || !selectedCollectorId) return;

    const fetchingPortal = selectedPortalId;
    const fetchingCollector = selectedCollectorId;

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
        const currentPortal = get().selectedPortalId;
        const currentCollector = get().selectedCollectorId;
        if (currentPortal !== fetchingPortal || currentCollector !== fetchingCollector) {
          return;
        }
        const fetchResponse = response.payload;
        
        // Check for error in response (portal tabs may be stale)
        if (fetchResponse.error) {
          console.warn('Device fetch returned error:', fetchResponse.error);
          set({ devices: [], isFetchingDevices: false });
          return;
        }
        
        set({ devices: fetchResponse.items, isFetchingDevices: false });
      } else {
        console.error('Failed to fetch devices:', response);
        set({ devices: [], isFetchingDevices: false });
      }
    } catch (error) {
      // Check if portal/collector changed during fetch - discard stale errors
      const current = get();
      if (current.selectedPortalId !== fetchingPortal || 
          current.selectedCollectorId !== fetchingCollector) {
        return;
      }
      console.error('Error fetching devices:', error);
      toast.error('Failed to load devices', {
        description: 'Check that you are connected to the portal',
      });
      set({ devices: [], isFetchingDevices: false });
    }
  },

  setHostname: (hostname) => {
    const { selectedPortalId, selectedCollectorId } = get();
    set({ hostname });
    
    // Persist context
    persistContext({ portalId: selectedPortalId, collectorId: selectedCollectorId, hostname });
    
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

  refreshPortals: async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'DISCOVER_PORTALS' });
      if (response?.payload) {
        const portals = response.payload as Portal[];
        set({ portals });
        
        const state = get();
        
        // Try to restore last context if no portal selected
        if (!state.selectedPortalId && portals.length > 0) {
          const lastContext = await loadLastContext();
          
          // Check if last portal is still available
          const lastPortal = lastContext?.portalId 
            ? portals.find(p => p.id === lastContext.portalId)
            : null;
          
          if (lastPortal) {
            // Restore last portal
            set({ selectedPortalId: lastPortal.id });
            
            // Refresh collectors, then try to restore collector and hostname
            const collectorsResponse = await chrome.runtime.sendMessage({
              type: 'GET_COLLECTORS',
              payload: { portalId: lastPortal.id },
            });
            
            if (collectorsResponse?.payload && lastContext) {
              const collectors = collectorsResponse.payload as Collector[];
              set({ collectors });
              
              // Check if last collector is still available
              const lastCollector = lastContext.collectorId
                ? collectors.find(c => c.id === lastContext.collectorId)
                : null;
              
              if (lastCollector) {
                set({ selectedCollectorId: lastCollector.id });
                
                // Restore hostname if it was set
                if (lastContext.hostname) {
                  set({ hostname: lastContext.hostname });
                }
                
                // Fetch devices for the restored collector
                get().fetchDevices();
              }
            }
          } else {
            // Fallback to first available portal
            set({ selectedPortalId: portals[0].id });
            get().refreshCollectors();
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh portals:', error);
      toast.error('Failed to refresh portals', {
        description: 'Make sure you have a LogicMonitor portal tab open',
      });
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
        const collectors = response.payload as Collector[];
        set({ collectors });
        
        // Auto-select first collector if none selected and collectors are available
        const { selectedCollectorId } = get();
        if (!selectedCollectorId && collectors.length > 0) {
          // Find the first non-down collector, or just use the first one
          const activeCollector = collectors.find(c => !c.isDown) || collectors[0];
          set({ selectedCollectorId: activeCollector.id });
          
          // Persist context with the auto-selected collector
          persistContext({ portalId: selectedPortalId, collectorId: activeCollector.id, hostname: '' });
          
          // Fetch devices for the auto-selected collector
          get().fetchDevices();
        }
      }
    } catch {
      // Silently handle - collectors will remain empty
    }
  },

  handlePortalDisconnected: (portalId: string, hostname: string) => {
    const { selectedPortalId, portals } = get();
    
    // Remove the disconnected portal from the list
    const updatedPortals = portals.filter(p => p.id !== portalId);
    
    // If the disconnected portal was selected, clear the selection
    if (selectedPortalId === portalId) {
      set({
        portals: updatedPortals,
        selectedPortalId: null,
        selectedCollectorId: null,
        collectors: [],
        devices: [],
        isFetchingDevices: false,
        hostname: '',
        // Clear module cache since it was for this portal
        ...createEmptyModuleState(),
      });
      
      // Show toast notification for the disconnected portal
      toast.warning(`Portal disconnected: ${hostname}`, {
        description: 'Open a LogicMonitor tab to reconnect.',
        duration: 8000,
      });
    } else {
      // Just update the portals list
      set({ portals: updatedPortals });
      
      // Show a less intrusive notification
      toast.info(`Portal disconnected: ${hostname}`, {
        duration: 5000,
      });
    }
  },
});

