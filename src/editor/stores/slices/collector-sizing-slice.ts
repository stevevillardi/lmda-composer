/**
 * Collector Sizing slice - manages state for the collector sizing calculator.
 * This is a standalone utility workspace that calculates collector requirements
 * based on device counts, log sources, and netflow configurations.
 */

import type { StateCreator } from 'zustand';
import {
  type DeviceConfig,
  type LogConfig,
  type TrapConfig,
  type FlowConfig,
  type MethodWeights,
  type SiteCalculationResult,
  type CollectorCapacities,
  type CollectorSize,
  type DeviceTypeDefaults,
  calculateSiteRecommendations,
  aggregateSiteRecommendations,
  createDefaultDevices,
  createDefaultLogs,
  createDefaultTraps,
  createDefaultFlows,
  createDefaultMethodWeights,
  createDefaultCollectorCapacities,
  createDefaultDeviceTypeDefaults,
} from '../../utils/collector-calculations';

// ============================================================================
// Types
// ============================================================================

export interface Site {
  id: string;
  name: string;
  devices: Record<string, DeviceConfig>;
  logs: Record<string, LogConfig>;
  traps: Record<string, TrapConfig>;
  flows: Record<string, FlowConfig>;
  isExpanded: boolean;
  activeTab: 'devices' | 'logs' | 'recommendations';
  // Calculated results (cached)
  calculationResult: SiteCalculationResult | null;
}

export type ForcedCollectorSize = 'auto' | CollectorSize;

export interface CollectorSizingConfig {
  maxLoadPercent: number;
  methodWeights: MethodWeights;
  collectorCapacities: CollectorCapacities;
  deviceDefaults: DeviceTypeDefaults;
  pollingFailover: boolean;
  logsFailover: boolean;
  showAdvancedDetails: boolean;
  forcedCollectorSize: ForcedCollectorSize;
}

export interface CollectorSizingSliceState {
  // Sites (multi-site support)
  sites: Site[];

  // Global configuration
  collectorSizingConfig: CollectorSizingConfig;

  // UI state
  activeSiteId: string | null;
  collectorSizingSettingsOpen: boolean;

  // Persistence tracking
  collectorSizingIsDirty: boolean;
  collectorSizingLastSaved: number | null;

  // Aggregated results across all sites
  aggregatedResults: SiteCalculationResult | null;
}

export interface CollectorSizingSliceActions {
  // Site management
  addSite: (name?: string) => string;
  removeSite: (siteId: string) => void;
  renameSite: (siteId: string, name: string) => void;
  toggleSiteExpanded: (siteId: string) => void;
  setSiteActiveTab: (siteId: string, tab: 'devices' | 'logs' | 'recommendations') => void;

  // Device configuration
  updateDeviceCount: (siteId: string, deviceType: string, count: number) => void;

  // Log/Trap/Flow configuration
  updateLogCount: (siteId: string, logType: string, count: number) => void;
  updateTrapCount: (siteId: string, trapType: string, count: number) => void;
  updateFlowCount: (siteId: string, flowType: string, count: number) => void;

  // Global configuration
  setMaxLoadPercent: (percent: number) => void;
  setMethodWeight: (method: keyof MethodWeights, weight: number) => void;
  addMethodWeight: (method: string, weight: number) => void;
  deleteMethodWeight: (method: string) => void;
  setPollingFailover: (enabled: boolean) => void;
  setLogsFailover: (enabled: boolean) => void;
  setShowAdvancedDetails: (show: boolean) => void;
  resetMethodWeightsToDefault: () => void;

  // Collector capacities configuration
  setCollectorCapacity: (
    size: CollectorSize,
    field: 'weight' | 'eps' | 'fps',
    value: number
  ) => void;
  resetCollectorCapacitiesToDefault: () => void;

  // Device defaults configuration
  setDeviceDefaultInstances: (deviceType: string, instances: number) => void;
  setDeviceDefaultMethod: (deviceType: string, method: string, ratio: number) => void;
  deleteDeviceDefaultMethod: (deviceType: string, method: string) => void;
  addDeviceType: (
    name: string,
    icon: string,
    instances: number,
    methods: Record<string, number>
  ) => void;
  deleteDeviceType: (deviceType: string) => void;
  resetDeviceDefaultsToDefault: () => void;

  // Forced collector size
  setForcedCollectorSize: (size: ForcedCollectorSize) => void;

  // UI state
  setActiveSiteId: (siteId: string | null) => void;
  setCollectorSizingSettingsOpen: (open: boolean) => void;

  // Calculations
  recalculateSite: (siteId: string) => void;
  recalculateAllSites: () => void;

  // Persistence
  loadCollectorSizingState: () => Promise<void>;
  saveCollectorSizingState: () => Promise<void>;
  resetCollectorSizing: () => void;
}

export interface CollectorSizingSlice
  extends CollectorSizingSliceState,
    CollectorSizingSliceActions {}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'lmda-collector-sizing-state';

const DEFAULT_CONFIG: CollectorSizingConfig = {
  maxLoadPercent: 85,
  methodWeights: createDefaultMethodWeights(),
  collectorCapacities: createDefaultCollectorCapacities(),
  deviceDefaults: createDefaultDeviceTypeDefaults(),
  pollingFailover: false,
  logsFailover: false,
  showAdvancedDetails: true,
  forcedCollectorSize: 'auto',
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `site-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createNewSite(name: string): Site {
  return {
    id: generateId(),
    name,
    devices: createDefaultDevices(),
    logs: createDefaultLogs(),
    traps: createDefaultTraps(),
    flows: createDefaultFlows(),
    isExpanded: true,
    activeTab: 'devices',
    calculationResult: null,
  };
}

function calculateSiteResults(
  site: Site,
  config: CollectorSizingConfig
): SiteCalculationResult {
  return calculateSiteRecommendations(
    site.devices,
    site.logs,
    site.traps,
    site.flows,
    {
      maxLoadPercent: config.maxLoadPercent,
      methodWeights: config.methodWeights,
      pollingFailover: config.pollingFailover,
      logsFailover: config.logsFailover,
      collectorCapacities: config.collectorCapacities,
      forcedCollectorSize: config.forcedCollectorSize,
    }
  );
}

// Debounce helper for persistence
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(saveFunc: () => Promise<void>, delay = 1000) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    void saveFunc();
  }, delay);
}

// ============================================================================
// Initial State
// ============================================================================

export const collectorSizingSliceInitialState: CollectorSizingSliceState = {
  sites: [],
  collectorSizingConfig: DEFAULT_CONFIG,
  activeSiteId: null,
  collectorSizingSettingsOpen: false,
  collectorSizingIsDirty: false,
  collectorSizingLastSaved: null,
  aggregatedResults: null,
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createCollectorSizingSlice: StateCreator<
  CollectorSizingSlice,
  [],
  [],
  CollectorSizingSlice
> = (set, get) => ({
  ...collectorSizingSliceInitialState,

  // Site management
  addSite: (name) => {
    const siteName = name ?? `Site ${get().sites.length + 1}`;
    const newSite = createNewSite(siteName);

    set((state) => ({
      sites: [...state.sites, newSite],
      activeSiteId: newSite.id,
      collectorSizingIsDirty: true,
    }));

    // Recalculate and persist
    get().recalculateSite(newSite.id);
    debouncedSave(() => get().saveCollectorSizingState());

    return newSite.id;
  },

  removeSite: (siteId) => {
    set((state) => {
      const newSites = state.sites.filter((s) => s.id !== siteId);
      const newActiveSiteId =
        state.activeSiteId === siteId
          ? newSites[0]?.id ?? null
          : state.activeSiteId;

      return {
        sites: newSites,
        activeSiteId: newActiveSiteId,
        collectorSizingIsDirty: true,
      };
    });

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  renameSite: (siteId, name) => {
    set((state) => ({
      sites: state.sites.map((s) =>
        s.id === siteId ? { ...s, name } : s
      ),
      collectorSizingIsDirty: true,
    }));

    debouncedSave(() => get().saveCollectorSizingState());
  },

  toggleSiteExpanded: (siteId) => {
    set((state) => ({
      sites: state.sites.map((s) =>
        s.id === siteId ? { ...s, isExpanded: !s.isExpanded } : s
      ),
    }));
  },

  setSiteActiveTab: (siteId, tab) => {
    set((state) => ({
      sites: state.sites.map((s) =>
        s.id === siteId ? { ...s, activeTab: tab } : s
      ),
    }));
  },

  // Device configuration
  updateDeviceCount: (siteId, deviceType, count) => {
    set((state) => ({
      sites: state.sites.map((s) =>
        s.id === siteId
          ? {
              ...s,
              devices: {
                ...s.devices,
                [deviceType]: {
                  ...s.devices[deviceType],
                  count: Math.max(0, count),
                },
              },
            }
          : s
      ),
      collectorSizingIsDirty: true,
    }));

    get().recalculateSite(siteId);
    debouncedSave(() => get().saveCollectorSizingState());
  },

  // Log/Trap/Flow configuration
  updateLogCount: (siteId, logType, count) => {
    set((state) => ({
      sites: state.sites.map((s) =>
        s.id === siteId
          ? {
              ...s,
              logs: {
                ...s.logs,
                [logType]: {
                  ...s.logs[logType],
                  count: Math.max(0, count),
                },
              },
            }
          : s
      ),
      collectorSizingIsDirty: true,
    }));

    get().recalculateSite(siteId);
    debouncedSave(() => get().saveCollectorSizingState());
  },

  updateTrapCount: (siteId, trapType, count) => {
    set((state) => ({
      sites: state.sites.map((s) =>
        s.id === siteId
          ? {
              ...s,
              traps: {
                ...s.traps,
                [trapType]: {
                  ...s.traps[trapType],
                  count: Math.max(0, count),
                },
              },
            }
          : s
      ),
      collectorSizingIsDirty: true,
    }));

    get().recalculateSite(siteId);
    debouncedSave(() => get().saveCollectorSizingState());
  },

  updateFlowCount: (siteId, flowType, count) => {
    set((state) => ({
      sites: state.sites.map((s) =>
        s.id === siteId
          ? {
              ...s,
              flows: {
                ...s.flows,
                [flowType]: {
                  ...s.flows[flowType],
                  count: Math.max(0, count),
                },
              },
            }
          : s
      ),
      collectorSizingIsDirty: true,
    }));

    get().recalculateSite(siteId);
    debouncedSave(() => get().saveCollectorSizingState());
  },

  // Global configuration
  setMaxLoadPercent: (percent) => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        maxLoadPercent: Math.min(100, Math.max(50, percent)),
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  setMethodWeight: (method, weight) => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        methodWeights: {
          ...state.collectorSizingConfig.methodWeights,
          [method]: Math.max(0.1, weight),
        },
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  setPollingFailover: (enabled) => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        pollingFailover: enabled,
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  setLogsFailover: (enabled) => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        logsFailover: enabled,
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  setShowAdvancedDetails: (show) => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        showAdvancedDetails: show,
      },
    }));

    debouncedSave(() => get().saveCollectorSizingState());
  },

  resetMethodWeightsToDefault: () => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        methodWeights: createDefaultMethodWeights(),
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  addMethodWeight: (method, weight) => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        methodWeights: {
          ...state.collectorSizingConfig.methodWeights,
          [method]: Math.max(0.1, weight),
        } as MethodWeights,
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  deleteMethodWeight: (method) => {
    set((state) => {
      const newWeights = { ...state.collectorSizingConfig.methodWeights };
      delete (newWeights as Record<string, number>)[method];
      return {
        collectorSizingConfig: {
          ...state.collectorSizingConfig,
          methodWeights: newWeights,
        },
        collectorSizingIsDirty: true,
      };
    });

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  // Collector capacities configuration
  setCollectorCapacity: (size, field, value) => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        collectorCapacities: {
          ...state.collectorSizingConfig.collectorCapacities,
          [size]: {
            ...state.collectorSizingConfig.collectorCapacities[size],
            [field]: Math.max(0, value),
          },
        },
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  resetCollectorCapacitiesToDefault: () => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        collectorCapacities: createDefaultCollectorCapacities(),
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  // Device defaults configuration
  setDeviceDefaultInstances: (deviceType, instances) => {
    set((state) => {
      const deviceDefaults = state.collectorSizingConfig.deviceDefaults;
      if (!deviceDefaults[deviceType]) return state;

      const updatedDefaults = {
        ...deviceDefaults,
        [deviceType]: {
          ...deviceDefaults[deviceType],
          instances: Math.max(0, instances),
        },
      };

      // Also update all sites with this device type
      const updatedSites = state.sites.map((site) => ({
        ...site,
        devices: {
          ...site.devices,
          [deviceType]: site.devices[deviceType]
            ? {
                ...site.devices[deviceType],
                instances: Math.max(0, instances),
              }
            : site.devices[deviceType],
        },
      }));

      return {
        collectorSizingConfig: {
          ...state.collectorSizingConfig,
          deviceDefaults: updatedDefaults,
        },
        sites: updatedSites,
        collectorSizingIsDirty: true,
      };
    });

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  setDeviceDefaultMethod: (deviceType, method, ratio) => {
    set((state) => {
      const deviceDefaults = state.collectorSizingConfig.deviceDefaults;
      if (!deviceDefaults[deviceType]) return state;

      const updatedMethods = {
        ...deviceDefaults[deviceType].methods,
        [method]: Math.max(0, Math.min(1, ratio)),
      };

      const updatedDefaults = {
        ...deviceDefaults,
        [deviceType]: {
          ...deviceDefaults[deviceType],
          methods: updatedMethods,
        },
      };

      // Also update all sites with this device type
      const updatedSites = state.sites.map((site) => ({
        ...site,
        devices: {
          ...site.devices,
          [deviceType]: site.devices[deviceType]
            ? {
                ...site.devices[deviceType],
                methods: updatedMethods,
              }
            : site.devices[deviceType],
        },
      }));

      return {
        collectorSizingConfig: {
          ...state.collectorSizingConfig,
          deviceDefaults: updatedDefaults,
        },
        sites: updatedSites,
        collectorSizingIsDirty: true,
      };
    });

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  deleteDeviceDefaultMethod: (deviceType, method) => {
    set((state) => {
      const deviceDefaults = state.collectorSizingConfig.deviceDefaults;
      if (!deviceDefaults[deviceType]) return state;

      const updatedMethods = { ...deviceDefaults[deviceType].methods };
      delete updatedMethods[method];

      // Redistribute weight to remaining methods if any exist
      const remainingMethods = Object.keys(updatedMethods);
      if (remainingMethods.length > 0) {
        const deletedWeight = deviceDefaults[deviceType].methods[method] ?? 0;
        const weightPerMethod = deletedWeight / remainingMethods.length;
        remainingMethods.forEach((m) => {
          updatedMethods[m] += weightPerMethod;
        });
      }

      const updatedDefaults = {
        ...deviceDefaults,
        [deviceType]: {
          ...deviceDefaults[deviceType],
          methods: updatedMethods,
        },
      };

      // Also update all sites with this device type
      const updatedSites = state.sites.map((site) => ({
        ...site,
        devices: {
          ...site.devices,
          [deviceType]: site.devices[deviceType]
            ? {
                ...site.devices[deviceType],
                methods: updatedMethods,
              }
            : site.devices[deviceType],
        },
      }));

      return {
        collectorSizingConfig: {
          ...state.collectorSizingConfig,
          deviceDefaults: updatedDefaults,
        },
        sites: updatedSites,
        collectorSizingIsDirty: true,
      };
    });

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  addDeviceType: (name, icon, instances, methods) => {
    set((state) => {
      const updatedDefaults = {
        ...state.collectorSizingConfig.deviceDefaults,
        [name]: { icon, instances, methods },
      };

      // Also add to all sites
      const newDeviceConfig: DeviceConfig = {
        count: 0,
        instances,
        methods,
        icon,
      };

      const updatedSites = state.sites.map((site) => ({
        ...site,
        devices: {
          ...site.devices,
          [name]: newDeviceConfig,
        },
      }));

      return {
        collectorSizingConfig: {
          ...state.collectorSizingConfig,
          deviceDefaults: updatedDefaults,
        },
        sites: updatedSites,
        collectorSizingIsDirty: true,
      };
    });

    debouncedSave(() => get().saveCollectorSizingState());
  },

  deleteDeviceType: (deviceType) => {
    set((state) => {
      const updatedDefaults = { ...state.collectorSizingConfig.deviceDefaults };
      delete updatedDefaults[deviceType];

      // Also remove from all sites
      const updatedSites = state.sites.map((site) => {
        const updatedDevices = { ...site.devices };
        delete updatedDevices[deviceType];
        return { ...site, devices: updatedDevices };
      });

      return {
        collectorSizingConfig: {
          ...state.collectorSizingConfig,
          deviceDefaults: updatedDefaults,
        },
        sites: updatedSites,
        collectorSizingIsDirty: true,
      };
    });

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  resetDeviceDefaultsToDefault: () => {
    set((state) => {
      const newDefaults = createDefaultDeviceTypeDefaults();

      // Also reset all sites to use the default device types
      const updatedSites = state.sites.map((site) => ({
        ...site,
        devices: createDefaultDevices(),
      }));

      return {
        collectorSizingConfig: {
          ...state.collectorSizingConfig,
          deviceDefaults: newDefaults,
        },
        sites: updatedSites,
        collectorSizingIsDirty: true,
      };
    });

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  // Forced collector size
  setForcedCollectorSize: (size) => {
    set((state) => ({
      collectorSizingConfig: {
        ...state.collectorSizingConfig,
        forcedCollectorSize: size,
      },
      collectorSizingIsDirty: true,
    }));

    get().recalculateAllSites();
    debouncedSave(() => get().saveCollectorSizingState());
  },

  // UI state
  setActiveSiteId: (siteId) => {
    set({ activeSiteId: siteId });
  },

  setCollectorSizingSettingsOpen: (open) => {
    set({ collectorSizingSettingsOpen: open });
  },

  // Calculations
  recalculateSite: (siteId) => {
    const { sites, collectorSizingConfig } = get();
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    const result = calculateSiteResults(site, collectorSizingConfig);

    set((state) => ({
      sites: state.sites.map((s) =>
        s.id === siteId ? { ...s, calculationResult: result } : s
      ),
    }));

    // Update aggregated results
    const allResults = get()
      .sites.map((s) => s.calculationResult)
      .filter((r): r is SiteCalculationResult => r !== null);

    set({
      aggregatedResults:
        allResults.length > 0
          ? aggregateSiteRecommendations(allResults, collectorSizingConfig.collectorCapacities)
          : null,
    });
  },

  recalculateAllSites: () => {
    const { sites, collectorSizingConfig } = get();

    const updatedSites = sites.map((site) => ({
      ...site,
      calculationResult: calculateSiteResults(site, collectorSizingConfig),
    }));

    set({ sites: updatedSites });

    // Update aggregated results
    const allResults = updatedSites
      .map((s) => s.calculationResult)
      .filter((r): r is SiteCalculationResult => r !== null);

    set({
      aggregatedResults:
        allResults.length > 0
          ? aggregateSiteRecommendations(allResults, collectorSizingConfig.collectorCapacities)
          : null,
    });
  },

  // Persistence
  loadCollectorSizingState: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] as Partial<CollectorSizingSliceState> | undefined;

      if (stored) {
        // Merge stored state with defaults (to handle schema changes)
        const config: CollectorSizingConfig = {
          ...DEFAULT_CONFIG,
          ...(stored.collectorSizingConfig ?? {}),
          methodWeights: {
            ...DEFAULT_CONFIG.methodWeights,
            ...(stored.collectorSizingConfig?.methodWeights ?? {}),
          },
          collectorCapacities: {
            ...DEFAULT_CONFIG.collectorCapacities,
            ...(stored.collectorSizingConfig?.collectorCapacities ?? {}),
          },
          deviceDefaults: {
            ...DEFAULT_CONFIG.deviceDefaults,
            ...(stored.collectorSizingConfig?.deviceDefaults ?? {}),
          },
        };

        set({
          sites: stored.sites ?? [],
          collectorSizingConfig: config,
          activeSiteId: stored.activeSiteId ?? null,
          collectorSizingLastSaved: stored.collectorSizingLastSaved ?? null,
          collectorSizingIsDirty: false,
        });

        // Recalculate all sites after loading
        get().recalculateAllSites();
      }
    } catch (error) {
      console.error('Failed to load collector sizing state:', error);
    }
  },

  saveCollectorSizingState: async () => {
    try {
      const { sites, collectorSizingConfig, activeSiteId } = get();

      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          sites,
          collectorSizingConfig,
          activeSiteId,
          collectorSizingLastSaved: Date.now(),
        },
      });

      set({
        collectorSizingIsDirty: false,
        collectorSizingLastSaved: Date.now(),
      });
    } catch (error) {
      console.error('Failed to save collector sizing state:', error);
    }
  },

  resetCollectorSizing: () => {
    set({
      ...collectorSizingSliceInitialState,
      collectorSizingIsDirty: true,
    });

    debouncedSave(() => get().saveCollectorSizingState());
  },
});
