/**
 * Pure calculation functions for collector sizing.
 * These functions perform the sizing calculations based on device/log counts
 * and return collector recommendations.
 */

import {
  defaultDeviceTypes,
  defaultLogTypes,
  defaultTrapTypes,
  defaultFlowTypes,
  defaultMethodWeights,
  collectorCapacities as defaultCollectorCapacities,
  collectorRequirements,
} from '@/lib/collector-sizing';

// ============================================================================
// Types
// ============================================================================

export type CollectorSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL' | 'XXL';

export type MethodType = keyof typeof defaultMethodWeights;

export interface CollectorCapacities {
  SMALL: { weight: number; eps: number; fps: number };
  MEDIUM: { weight: number; eps: number; fps: number };
  LARGE: { weight: number; eps: number; fps: number };
  XL: { weight: number; eps: number; fps: number };
  XXL: { weight: number; eps: number; fps: number };
}

export interface DeviceTypeDefaults {
  [key: string]: {
    icon: string;
    instances: number;
    methods: Record<string, number>;
  };
}

export interface MethodWeights {
  SNMPv2: number;
  HTTP: number;
  JMX: number;
  SNMPv3: number;
  WMI: number;
  WinRM: number;
  JDBC: number;
  Perfmon: number;
  Script: number;
}

export interface DeviceConfig {
  count: number;
  instances: number;
  methods: Record<string, number>;
  icon: string;
}

export interface LogConfig {
  name: string;
  count: number;
  eps: number;
  bytes: number;
  icon: string;
}

export interface TrapConfig {
  name: string;
  count: number;
  eps: number;
  bytes: number;
  icon: string;
}

export interface FlowConfig {
  name: string;
  count: number;
  fps: number;
  bytes: number;
  icon: string;
}

export interface CollectorRecommendation {
  count: number;
  size: CollectorSize;
  totalLoad: number;
  maxCapacity: number;
  utilizationPercent: number;
  perCollectorLoad: number;
  requirements: {
    cpu: string;
    memory: string;
    disk: string;
  };
}

export interface SiteCalculationResult {
  polling: CollectorRecommendation | null;
  logs: CollectorRecommendation | null;
  netflow: CollectorRecommendation | null;
}

// ============================================================================
// Constants
// ============================================================================

// Collector sizes in order from smallest to largest
const COLLECTOR_SIZES: CollectorSize[] = ['SMALL', 'MEDIUM', 'LARGE', 'XL', 'XXL'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the weighted load score for a single device type
 */
export function calculateDeviceLoad(
  device: DeviceConfig,
  methodWeights: MethodWeights
): number {
  if (device.count === 0) return 0;

  const totalCount = device.count;
  let weightedMethodScore = 0;

  for (const [method, percentage] of Object.entries(device.methods)) {
    const weight = methodWeights[method as MethodType] ?? 1;
    weightedMethodScore += percentage * weight;
  }

  return totalCount * device.instances * weightedMethodScore;
}

/**
 * Calculate total polling load for all devices
 */
export function calculateTotalPollingLoad(
  devices: Record<string, DeviceConfig>,
  methodWeights: MethodWeights
): number {
  let total = 0;
  for (const device of Object.values(devices)) {
    total += calculateDeviceLoad(device, methodWeights);
  }
  return total;
}

/**
 * Calculate total EPS (events per second) for logs and traps
 */
export function calculateTotalEPS(
  logs: Record<string, LogConfig>,
  traps: Record<string, TrapConfig>
): number {
  let total = 0;

  for (const log of Object.values(logs)) {
    total += log.count * log.eps;
  }

  for (const trap of Object.values(traps)) {
    total += trap.count * trap.eps;
  }

  return total;
}

/**
 * Calculate total FPS (flows per second) for netflow
 */
export function calculateTotalFPS(flows: Record<string, FlowConfig>): number {
  let total = 0;
  for (const flow of Object.values(flows)) {
    total += flow.count * flow.fps;
  }
  return total;
}

export type ForcedCollectorSize = 'auto' | CollectorSize;

/**
 * Find the optimal collector size and count for a given load
 */
export function findOptimalCollectorConfig(
  totalLoad: number,
  maxLoadPercent: number,
  capacityKey: 'weight' | 'eps' | 'fps',
  addFailover: boolean = false,
  customCapacities?: CollectorCapacities,
  forcedSize?: ForcedCollectorSize
): CollectorRecommendation | null {
  if (totalLoad === 0) return null;

  const capacities = customCapacities ?? defaultCollectorCapacities;
  const maxLoadFactor = maxLoadPercent / 100;

  // If a specific size is forced, use only that size
  if (forcedSize && forcedSize !== 'auto') {
    const size = forcedSize;
    const capacity = capacities[size][capacityKey];
    const effectiveCapacity = capacity * maxLoadFactor;
    let collectorsNeeded = Math.ceil(totalLoad / effectiveCapacity);

    if (addFailover && collectorsNeeded > 0) {
      collectorsNeeded += 1;
    }

    const totalCapacity = collectorsNeeded * capacity;
    const utilizationPercent = (totalLoad / totalCapacity) * 100;

    return {
      count: collectorsNeeded,
      size,
      totalLoad,
      maxCapacity: totalCapacity,
      utilizationPercent,
      perCollectorLoad: totalLoad / collectorsNeeded,
      requirements: collectorRequirements[size],
    };
  }

  // Auto mode: Try each size from largest to smallest to minimize collector count
  for (let i = COLLECTOR_SIZES.length - 1; i >= 0; i--) {
    const size = COLLECTOR_SIZES[i];
    const capacity = capacities[size][capacityKey];
    const effectiveCapacity = capacity * maxLoadFactor;

    // Calculate collectors needed
    let collectorsNeeded = Math.ceil(totalLoad / effectiveCapacity);

    // Add failover collector if requested
    if (addFailover && collectorsNeeded > 0) {
      collectorsNeeded += 1;
    }

    // Calculate actual utilization with this config
    const totalCapacity = collectorsNeeded * capacity;
    const utilizationPercent = (totalLoad / totalCapacity) * 100;

    // If utilization is reasonable (not over max), this is valid
    // We accept any config where per-collector load is within limits
    const perCollectorLoad = totalLoad / collectorsNeeded;
    if (perCollectorLoad <= effectiveCapacity) {
      return {
        count: collectorsNeeded,
        size,
        totalLoad,
        maxCapacity: totalCapacity,
        utilizationPercent,
        perCollectorLoad,
        requirements: collectorRequirements[size],
      };
    }
  }

  // If even XXL isn't enough, use XXL with more collectors
  const size: CollectorSize = 'XXL';
  const capacity = capacities[size][capacityKey];
  const effectiveCapacity = capacity * maxLoadFactor;
  let collectorsNeeded = Math.ceil(totalLoad / effectiveCapacity);

  if (addFailover && collectorsNeeded > 0) {
    collectorsNeeded += 1;
  }

  const totalCapacity = collectorsNeeded * capacity;
  const utilizationPercent = (totalLoad / totalCapacity) * 100;

  return {
    count: collectorsNeeded,
    size,
    totalLoad,
    maxCapacity: totalCapacity,
    utilizationPercent,
    perCollectorLoad: totalLoad / collectorsNeeded,
    requirements: collectorRequirements[size],
  };
}

/**
 * Calculate collector recommendations for a complete site configuration
 */
export function calculateSiteRecommendations(
  devices: Record<string, DeviceConfig>,
  logs: Record<string, LogConfig>,
  traps: Record<string, TrapConfig>,
  flows: Record<string, FlowConfig>,
  config: {
    maxLoadPercent: number;
    methodWeights: MethodWeights;
    pollingFailover: boolean;
    logsFailover: boolean;
    collectorCapacities?: CollectorCapacities;
    forcedCollectorSize?: ForcedCollectorSize;
  }
): SiteCalculationResult {
  // Polling load
  const pollingLoad = calculateTotalPollingLoad(devices, config.methodWeights);
  const polling = findOptimalCollectorConfig(
    pollingLoad,
    config.maxLoadPercent,
    'weight',
    config.pollingFailover,
    config.collectorCapacities,
    config.forcedCollectorSize
  );

  // Logs/Traps load (EPS)
  const epsLoad = calculateTotalEPS(logs, traps);
  const logsResult = findOptimalCollectorConfig(
    epsLoad,
    config.maxLoadPercent,
    'eps',
    config.logsFailover,
    config.collectorCapacities,
    config.forcedCollectorSize
  );

  // NetFlow load (FPS)
  const fpsLoad = calculateTotalFPS(flows);
  const netflow = findOptimalCollectorConfig(
    fpsLoad,
    config.maxLoadPercent,
    'fps',
    false, // NetFlow doesn't typically have failover
    config.collectorCapacities,
    config.forcedCollectorSize
  );

  return { polling, logs: logsResult, netflow };
}

/**
 * Aggregate recommendations across multiple sites
 */
export function aggregateSiteRecommendations(
  siteResults: SiteCalculationResult[],
  customCapacities?: CollectorCapacities
): SiteCalculationResult {
  const capacities = customCapacities ?? defaultCollectorCapacities;
  const aggregated: SiteCalculationResult = {
    polling: null,
    logs: null,
    netflow: null,
  };

  // Sum up collectors by type
  let totalPollingCollectors = 0;
  let totalLogsCollectors = 0;
  let totalNetflowCollectors = 0;

  // Track largest size needed for each type
  let largestPollingSize: CollectorSize = 'SMALL';
  let largestLogsSize: CollectorSize = 'SMALL';
  let largestNetflowSize: CollectorSize = 'SMALL';

  // Track total loads
  let totalPollingLoad = 0;
  let totalLogsLoad = 0;
  let totalNetflowLoad = 0;

  for (const site of siteResults) {
    if (site.polling) {
      totalPollingCollectors += site.polling.count;
      totalPollingLoad += site.polling.totalLoad;
      if (COLLECTOR_SIZES.indexOf(site.polling.size) > COLLECTOR_SIZES.indexOf(largestPollingSize)) {
        largestPollingSize = site.polling.size;
      }
    }
    if (site.logs) {
      totalLogsCollectors += site.logs.count;
      totalLogsLoad += site.logs.totalLoad;
      if (COLLECTOR_SIZES.indexOf(site.logs.size) > COLLECTOR_SIZES.indexOf(largestLogsSize)) {
        largestLogsSize = site.logs.size;
      }
    }
    if (site.netflow) {
      totalNetflowCollectors += site.netflow.count;
      totalNetflowLoad += site.netflow.totalLoad;
      if (COLLECTOR_SIZES.indexOf(site.netflow.size) > COLLECTOR_SIZES.indexOf(largestNetflowSize)) {
        largestNetflowSize = site.netflow.size;
      }
    }
  }

  // Create aggregate recommendations
  if (totalPollingCollectors > 0) {
    const capacity = capacities[largestPollingSize].weight;
    aggregated.polling = {
      count: totalPollingCollectors,
      size: largestPollingSize,
      totalLoad: totalPollingLoad,
      maxCapacity: totalPollingCollectors * capacity,
      utilizationPercent: (totalPollingLoad / (totalPollingCollectors * capacity)) * 100,
      perCollectorLoad: totalPollingLoad / totalPollingCollectors,
      requirements: collectorRequirements[largestPollingSize],
    };
  }

  if (totalLogsCollectors > 0) {
    const capacity = capacities[largestLogsSize].eps;
    aggregated.logs = {
      count: totalLogsCollectors,
      size: largestLogsSize,
      totalLoad: totalLogsLoad,
      maxCapacity: totalLogsCollectors * capacity,
      utilizationPercent: (totalLogsLoad / (totalLogsCollectors * capacity)) * 100,
      perCollectorLoad: totalLogsLoad / totalLogsCollectors,
      requirements: collectorRequirements[largestLogsSize],
    };
  }

  if (totalNetflowCollectors > 0) {
    const capacity = capacities[largestNetflowSize].fps;
    aggregated.netflow = {
      count: totalNetflowCollectors,
      size: largestNetflowSize,
      totalLoad: totalNetflowLoad,
      maxCapacity: totalNetflowCollectors * capacity,
      utilizationPercent: (totalNetflowLoad / (totalNetflowCollectors * capacity)) * 100,
      perCollectorLoad: totalNetflowLoad / totalNetflowCollectors,
      requirements: collectorRequirements[largestNetflowSize],
    };
  }

  return aggregated;
}

/**
 * Get load status (healthy/moderate/high) based on utilization percent
 */
export function getLoadStatus(percent: number): {
  status: 'healthy' | 'moderate' | 'high';
  color: 'green' | 'yellow' | 'red';
  label: string;
} {
  if (percent < 65) {
    return { status: 'healthy', color: 'green', label: 'Healthy' };
  }
  if (percent < 85) {
    return { status: 'moderate', color: 'yellow', label: 'Moderate' };
  }
  return { status: 'high', color: 'red', label: 'High' };
}

/**
 * Create default device configuration from default types
 */
export function createDefaultDevices(): Record<string, DeviceConfig> {
  return JSON.parse(JSON.stringify(defaultDeviceTypes));
}

/**
 * Create default log configuration from default types
 */
export function createDefaultLogs(): Record<string, LogConfig> {
  return JSON.parse(JSON.stringify(defaultLogTypes));
}

/**
 * Create default trap configuration from default types
 */
export function createDefaultTraps(): Record<string, TrapConfig> {
  return JSON.parse(JSON.stringify(defaultTrapTypes));
}

/**
 * Create default flow configuration from default types
 */
export function createDefaultFlows(): Record<string, FlowConfig> {
  return JSON.parse(JSON.stringify(defaultFlowTypes));
}

/**
 * Create default method weights
 */
export function createDefaultMethodWeights(): MethodWeights {
  return { ...defaultMethodWeights };
}

/**
 * Create default collector capacities
 */
export function createDefaultCollectorCapacities(): CollectorCapacities {
  return JSON.parse(JSON.stringify(defaultCollectorCapacities));
}

/**
 * Create default device type defaults (instances and methods per device type)
 */
export function createDefaultDeviceTypeDefaults(): DeviceTypeDefaults {
  const defaults: DeviceTypeDefaults = {};
  for (const [key, value] of Object.entries(defaultDeviceTypes)) {
    defaults[key] = {
      icon: value.icon,
      instances: value.instances,
      methods: { ...value.methods },
    };
  }
  return defaults;
}

/**
 * Format a number for display (with commas for thousands)
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Format load value for display
 */
export function formatLoad(load: number): string {
  if (load >= 1_000_000) {
    return `${(load / 1_000_000).toFixed(1)}M`;
  }
  if (load >= 1_000) {
    return `${(load / 1_000).toFixed(1)}K`;
  }
  return load.toFixed(0);
}

// ============================================================================
// GB/day Calculation Helpers
// ============================================================================

const BYTES_PER_GB = 1024 ** 3;
const SECONDS_PER_DAY = 86400;

/**
 * Calculate estimated GB per day from logs and traps
 * Formula: GB/day = Σ(count × eps × avgBytes × 86400) / (1024³)
 */
export function calculateLogsGBPerDay(
  logs: Record<string, LogConfig>,
  traps: Record<string, TrapConfig>
): number {
  let totalBytesPerSecond = 0;

  for (const log of Object.values(logs)) {
    totalBytesPerSecond += log.count * log.eps * log.bytes;
  }

  for (const trap of Object.values(traps)) {
    totalBytesPerSecond += trap.count * trap.eps * trap.bytes;
  }

  return (totalBytesPerSecond * SECONDS_PER_DAY) / BYTES_PER_GB;
}

/**
 * Calculate estimated GB per day from netflow
 * Formula: GB/day = Σ(count × fps × avgBytes × 86400) / (1024³)
 */
export function calculateNetflowGBPerDay(
  flows: Record<string, FlowConfig>
): number {
  let totalBytesPerSecond = 0;

  for (const flow of Object.values(flows)) {
    totalBytesPerSecond += flow.count * flow.fps * flow.bytes;
  }

  return (totalBytesPerSecond * SECONDS_PER_DAY) / BYTES_PER_GB;
}

/**
 * Get EPS breakdown from logs and traps
 */
export function getEPSBreakdown(
  logs: Record<string, LogConfig>,
  traps: Record<string, TrapConfig>
): { logsEPS: number; trapsEPS: number; totalEPS: number } {
  let logsEPS = 0;
  let trapsEPS = 0;

  for (const log of Object.values(logs)) {
    logsEPS += log.count * log.eps;
  }

  for (const trap of Object.values(traps)) {
    trapsEPS += trap.count * trap.eps;
  }

  return {
    logsEPS,
    trapsEPS,
    totalEPS: logsEPS + trapsEPS,
  };
}

// ============================================================================
// Device Summary Helpers
// ============================================================================

export interface DeviceSummaryItem {
  name: string;
  count: number;
  instances: number;
  totalInstances: number;
  methods: Record<string, number>;
}

export interface DeviceSummary {
  devices: DeviceSummaryItem[];
  totalDevices: number;
  totalInstances: number;
  methodBreakdown: Record<string, number>;
}

/**
 * Get device summary with counts, instances, and method breakdown
 */
export function getDeviceSummary(
  devices: Record<string, DeviceConfig>
): DeviceSummary {
  const summary: DeviceSummaryItem[] = [];
  let totalDevices = 0;
  let totalInstances = 0;
  const methodTotals: Record<string, number> = {};

  for (const [name, device] of Object.entries(devices)) {
    const count = device.count;
    if (count === 0) continue;

    const deviceTotalInstances = count * device.instances;
    totalDevices += count;
    totalInstances += deviceTotalInstances;

    summary.push({
      name,
      count,
      instances: device.instances,
      totalInstances: deviceTotalInstances,
      methods: device.methods,
    });

    // Aggregate method weights
    for (const [method, ratio] of Object.entries(device.methods)) {
      const weightedCount = count * ratio;
      methodTotals[method] = (methodTotals[method] ?? 0) + weightedCount;
    }
  }

  // Convert method totals to percentages
  const methodBreakdown: Record<string, number> = {};
  if (totalDevices > 0) {
    for (const [method, count] of Object.entries(methodTotals)) {
      methodBreakdown[method] = (count / totalDevices) * 100;
    }
  }

  // Sort by total instances (descending)
  summary.sort((a, b) => b.totalInstances - a.totalInstances);

  return {
    devices: summary,
    totalDevices,
    totalInstances,
    methodBreakdown,
  };
}

/**
 * Get aggregated device summary across multiple sites
 */
export function getAggregatedDeviceSummary(
  sites: Array<{ devices: Record<string, DeviceConfig> }>
): DeviceSummary {
  // Merge all devices across sites
  const mergedDevices: Record<string, DeviceConfig> = {};

  for (const site of sites) {
    for (const [name, device] of Object.entries(site.devices)) {
      if (!mergedDevices[name]) {
        mergedDevices[name] = {
          count: 0,
          instances: device.instances,
          methods: device.methods,
          icon: device.icon,
        };
      }
      mergedDevices[name].count += device.count;
    }
  }

  return getDeviceSummary(mergedDevices);
}

/**
 * Get aggregated logs/traps GB/day across multiple sites
 */
export function getAggregatedLogsGBPerDay(
  sites: Array<{ logs: Record<string, LogConfig>; traps: Record<string, TrapConfig> }>
): number {
  let total = 0;
  for (const site of sites) {
    total += calculateLogsGBPerDay(site.logs, site.traps);
  }
  return total;
}

/**
 * Get aggregated netflow GB/day across multiple sites
 */
export function getAggregatedNetflowGBPerDay(
  sites: Array<{ flows: Record<string, FlowConfig> }>
): number {
  let total = 0;
  for (const site of sites) {
    total += calculateNetflowGBPerDay(site.flows);
  }
  return total;
}

/**
 * Format GB value for display
 */
export function formatGB(gb: number): string {
  if (gb >= 1000) {
    return `${(gb / 1000).toFixed(1)} TB`;
  }
  return `${gb.toFixed(1)} GB`;
}

// ============================================================================
// NetFlow Range Calculations
// ============================================================================

// NetFlow bytes per flow can vary significantly (100-250 bytes is a typical range)
export const NETFLOW_BYTES_PER_FLOW_MIN = 100;
export const NETFLOW_BYTES_PER_FLOW_MAX = 250;

/**
 * Calculate estimated netflow GB per day as a range
 * Formula: GB/day = totalFPS × bytesPerFlow × 86400 / (1024³)
 */
export function calculateNetflowGBPerDayRange(
  flows: Record<string, FlowConfig>
): { min: number; max: number } {
  const totalFPS = calculateTotalFPS(flows);

  const minBytesPerSecond = totalFPS * NETFLOW_BYTES_PER_FLOW_MIN;
  const maxBytesPerSecond = totalFPS * NETFLOW_BYTES_PER_FLOW_MAX;

  return {
    min: (minBytesPerSecond * SECONDS_PER_DAY) / BYTES_PER_GB,
    max: (maxBytesPerSecond * SECONDS_PER_DAY) / BYTES_PER_GB,
  };
}

/**
 * Calculate netflow throughput in bits per second (bps)
 * Uses the midpoint of the bytes per flow range
 */
export function calculateNetflowBps(flows: Record<string, FlowConfig>): number {
  const totalFPS = calculateTotalFPS(flows);
  const avgBytesPerFlow = (NETFLOW_BYTES_PER_FLOW_MIN + NETFLOW_BYTES_PER_FLOW_MAX) / 2;
  return totalFPS * avgBytesPerFlow * 8; // multiply by 8 to convert bytes to bits
}

/**
 * Format bits per second for display
 */
export function formatBps(bps: number): string {
  if (bps >= 1_000_000_000) {
    return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
  }
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  }
  if (bps >= 1_000) {
    return `${(bps / 1_000).toFixed(2)} Kbps`;
  }
  return `${bps.toFixed(0)} bps`;
}

/**
 * Get aggregated netflow GB/day range across multiple sites
 */
export function getAggregatedNetflowGBPerDayRange(
  sites: Array<{ flows: Record<string, FlowConfig> }>
): { min: number; max: number } {
  let minTotal = 0;
  let maxTotal = 0;
  for (const site of sites) {
    const range = calculateNetflowGBPerDayRange(site.flows);
    minTotal += range.min;
    maxTotal += range.max;
  }
  return { min: minTotal, max: maxTotal };
}

/**
 * Get aggregated netflow bps across multiple sites
 */
export function getAggregatedNetflowBps(
  sites: Array<{ flows: Record<string, FlowConfig> }>
): number {
  let total = 0;
  for (const site of sites) {
    total += calculateNetflowBps(site.flows);
  }
  return total;
}

/**
 * Get aggregated EPS breakdown across multiple sites
 */
export function getAggregatedEPSBreakdown(
  sites: Array<{ logs: Record<string, LogConfig>; traps: Record<string, TrapConfig> }>
): { logsEPS: number; trapsEPS: number; totalEPS: number } {
  let logsEPS = 0;
  let trapsEPS = 0;

  for (const site of sites) {
    const breakdown = getEPSBreakdown(site.logs, site.traps);
    logsEPS += breakdown.logsEPS;
    trapsEPS += breakdown.trapsEPS;
  }

  return {
    logsEPS,
    trapsEPS,
    totalEPS: logsEPS + trapsEPS,
  };
}

/**
 * Get aggregated FPS across multiple sites
 */
export function getAggregatedFPS(
  sites: Array<{ flows: Record<string, FlowConfig> }>
): number {
  let total = 0;
  for (const site of sites) {
    total += calculateTotalFPS(site.flows);
  }
  return total;
}
