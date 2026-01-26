/**
 * Test helpers for collector sizing feature testing.
 *
 * Provides factory functions for creating mock data structures
 * used in collector sizing calculations and store tests.
 */
import type {
  DeviceConfig,
  LogConfig,
  TrapConfig,
  FlowConfig,
  MethodWeights,
  CollectorRecommendation,
  CollectorCapacities,
  CollectorSize,
} from '../../src/editor/utils/collector-calculations';
import type { Site, CollectorSizingConfig } from '../../src/editor/stores/slices/collector-sizing-slice';
import {
  createDefaultDevices,
  createDefaultLogs,
  createDefaultTraps,
  createDefaultFlows,
  createDefaultMethodWeights,
  createDefaultCollectorCapacities,
  createDefaultDeviceTypeDefaults,
} from '../../src/editor/utils/collector-calculations';

// =============================================================================
// Device Config Factory
// =============================================================================

interface CreateMockDeviceConfigOptions {
  count?: number;
  instances?: number;
  methods?: Record<string, number>;
  icon?: string;
}

/**
 * Create a mock DeviceConfig with sensible defaults.
 */
export function createMockDeviceConfig(
  options: CreateMockDeviceConfigOptions = {}
): DeviceConfig {
  return {
    count: options.count ?? 10,
    instances: options.instances ?? 100,
    methods: options.methods ?? { SNMPv3: 0.8, Script: 0.2 },
    icon: options.icon ?? 'Server',
  };
}

// =============================================================================
// Log Config Factory
// =============================================================================

interface CreateMockLogConfigOptions {
  name?: string;
  count?: number;
  eps?: number;
  bytes?: number;
  icon?: string;
}

/**
 * Create a mock LogConfig with sensible defaults.
 */
export function createMockLogConfig(
  options: CreateMockLogConfigOptions = {}
): LogConfig {
  return {
    name: options.name ?? 'Test Logs',
    count: options.count ?? 10,
    eps: options.eps ?? 1,
    bytes: options.bytes ?? 300,
    icon: options.icon ?? 'FileText',
  };
}

// =============================================================================
// Trap Config Factory
// =============================================================================

interface CreateMockTrapConfigOptions {
  name?: string;
  count?: number;
  eps?: number;
  bytes?: number;
  icon?: string;
}

/**
 * Create a mock TrapConfig with sensible defaults.
 */
export function createMockTrapConfig(
  options: CreateMockTrapConfigOptions = {}
): TrapConfig {
  return {
    name: options.name ?? 'SNMP Traps',
    count: options.count ?? 5,
    eps: options.eps ?? 0.01,
    bytes: options.bytes ?? 1000,
    icon: options.icon ?? 'Radio',
  };
}

// =============================================================================
// Flow Config Factory
// =============================================================================

interface CreateMockFlowConfigOptions {
  name?: string;
  count?: number;
  fps?: number;
  bytes?: number;
  icon?: string;
}

/**
 * Create a mock FlowConfig with sensible defaults.
 */
export function createMockFlowConfig(
  options: CreateMockFlowConfigOptions = {}
): FlowConfig {
  return {
    name: options.name ?? 'NetFlow Devices',
    count: options.count ?? 5,
    fps: options.fps ?? 1100,
    bytes: options.bytes ?? 1000,
    icon: options.icon ?? 'Activity',
  };
}

// =============================================================================
// Collector Recommendation Factory
// =============================================================================

interface CreateMockCollectorRecommendationOptions {
  count?: number;
  size?: CollectorSize;
  totalLoad?: number;
  maxCapacity?: number;
  utilizationPercent?: number;
  perCollectorLoad?: number;
  requirements?: {
    cpu: string;
    memory: string;
    disk: string;
  };
}

/**
 * Create a mock CollectorRecommendation with sensible defaults.
 */
export function createMockCollectorRecommendation(
  options: CreateMockCollectorRecommendationOptions = {}
): CollectorRecommendation {
  const count = options.count ?? 2;
  const totalLoad = options.totalLoad ?? 50000;
  const maxCapacity = options.maxCapacity ?? 100000;

  return {
    count,
    size: options.size ?? 'MEDIUM',
    totalLoad,
    maxCapacity,
    utilizationPercent: options.utilizationPercent ?? (totalLoad / maxCapacity) * 100,
    perCollectorLoad: options.perCollectorLoad ?? totalLoad / count,
    requirements: options.requirements ?? {
      cpu: '2',
      memory: '4',
      disk: '35',
    },
  };
}

// =============================================================================
// Site Factory
// =============================================================================

interface CreateMockSiteOptions {
  id?: string;
  name?: string;
  devices?: Record<string, DeviceConfig>;
  logs?: Record<string, LogConfig>;
  traps?: Record<string, TrapConfig>;
  flows?: Record<string, FlowConfig>;
  isExpanded?: boolean;
  activeTab?: 'devices' | 'logs' | 'recommendations';
}

let siteCounter = 0;

/**
 * Create a mock Site with sensible defaults.
 */
export function createMockSite(options: CreateMockSiteOptions = {}): Site {
  const counter = ++siteCounter;

  return {
    id: options.id ?? `site-${counter}`,
    name: options.name ?? `Site ${counter}`,
    devices: options.devices ?? createDefaultDevices(),
    logs: options.logs ?? createDefaultLogs(),
    traps: options.traps ?? createDefaultTraps(),
    flows: options.flows ?? createDefaultFlows(),
    isExpanded: options.isExpanded ?? true,
    activeTab: options.activeTab ?? 'devices',
    calculationResult: null,
  };
}

/**
 * Create a mock site with specific device counts for testing.
 */
export function createMockSiteWithDevices(
  deviceCounts: Record<string, number>,
  options: Omit<CreateMockSiteOptions, 'devices'> = {}
): Site {
  const devices = createDefaultDevices();
  for (const [deviceType, count] of Object.entries(deviceCounts)) {
    if (devices[deviceType]) {
      devices[deviceType].count = count;
    }
  }
  return createMockSite({ ...options, devices });
}

/**
 * Create a mock site with specific log counts for testing.
 */
export function createMockSiteWithLogs(
  logCounts: Record<string, number>,
  trapCounts: Record<string, number> = {},
  options: Omit<CreateMockSiteOptions, 'logs' | 'traps'> = {}
): Site {
  const logs = createDefaultLogs();
  const traps = createDefaultTraps();

  for (const [logType, count] of Object.entries(logCounts)) {
    if (logs[logType]) {
      logs[logType].count = count;
    }
  }

  for (const [trapType, count] of Object.entries(trapCounts)) {
    if (traps[trapType]) {
      traps[trapType].count = count;
    }
  }

  return createMockSite({ ...options, logs, traps });
}

/**
 * Create a mock site with specific flow counts for testing.
 */
export function createMockSiteWithFlows(
  flowCounts: Record<string, number>,
  options: Omit<CreateMockSiteOptions, 'flows'> = {}
): Site {
  const flows = createDefaultFlows();
  for (const [flowType, count] of Object.entries(flowCounts)) {
    if (flows[flowType]) {
      flows[flowType].count = count;
    }
  }
  return createMockSite({ ...options, flows });
}

// =============================================================================
// Config Factory
// =============================================================================

interface CreateMockConfigOptions {
  maxLoadPercent?: number;
  methodWeights?: Partial<MethodWeights>;
  collectorCapacities?: Partial<CollectorCapacities>;
  pollingFailover?: boolean;
  logsFailover?: boolean;
  showAdvancedDetails?: boolean;
  forcedCollectorSize?: 'auto' | CollectorSize;
}

/**
 * Create a mock CollectorSizingConfig with sensible defaults.
 */
export function createMockConfig(
  options: CreateMockConfigOptions = {}
): CollectorSizingConfig {
  return {
    maxLoadPercent: options.maxLoadPercent ?? 85,
    methodWeights: {
      ...createDefaultMethodWeights(),
      ...options.methodWeights,
    },
    collectorCapacities: {
      ...createDefaultCollectorCapacities(),
      ...options.collectorCapacities,
    } as CollectorCapacities,
    deviceDefaults: createDefaultDeviceTypeDefaults(),
    pollingFailover: options.pollingFailover ?? false,
    logsFailover: options.logsFailover ?? false,
    showAdvancedDetails: options.showAdvancedDetails ?? true,
    forcedCollectorSize: options.forcedCollectorSize ?? 'auto',
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Reset counter values between tests.
 */
export function resetSiteCounter(): void {
  siteCounter = 0;
}

/**
 * Create empty device/log/trap/flow records for edge case testing.
 */
export function createEmptyDevices(): Record<string, DeviceConfig> {
  return {};
}

export function createEmptyLogs(): Record<string, LogConfig> {
  return {};
}

export function createEmptyTraps(): Record<string, TrapConfig> {
  return {};
}

export function createEmptyFlows(): Record<string, FlowConfig> {
  return {};
}

/**
 * Create devices with zero counts for testing.
 */
export function createZeroCountDevices(): Record<string, DeviceConfig> {
  const devices = createDefaultDevices();
  for (const key of Object.keys(devices)) {
    devices[key].count = 0;
  }
  return devices;
}

/**
 * Create logs with zero counts for testing.
 */
export function createZeroCountLogs(): Record<string, LogConfig> {
  const logs = createDefaultLogs();
  for (const key of Object.keys(logs)) {
    logs[key].count = 0;
  }
  return logs;
}

/**
 * Create traps with zero counts for testing.
 */
export function createZeroCountTraps(): Record<string, TrapConfig> {
  const traps = createDefaultTraps();
  for (const key of Object.keys(traps)) {
    traps[key].count = 0;
  }
  return traps;
}

/**
 * Create flows with zero counts for testing.
 */
export function createZeroCountFlows(): Record<string, FlowConfig> {
  const flows = createDefaultFlows();
  for (const key of Object.keys(flows)) {
    flows[key].count = 0;
  }
  return flows;
}

// Re-export default creators for convenience
export {
  createDefaultDevices,
  createDefaultLogs,
  createDefaultTraps,
  createDefaultFlows,
  createDefaultMethodWeights,
  createDefaultCollectorCapacities,
  createDefaultDeviceTypeDefaults,
};
