/**
 * TypeScript interfaces for Collector Health Check data
 */

export interface HealthCheckMeta {
  completedAt: string;
  debugRunSeconds: number;
  showOKonly: boolean;
}

export interface PortalLinks {
  configuration: string;
  events: string;
  logLevels: string;
  status: string;
}

export interface CollectorInfo {
  id: string;
  hostname: string;
  displayName: string;
  description: string;
  version: string;
  platform: string;
  size: string;
  jvmMemoryMB: number;
  jvmMemory: string | null;
  physicalMemory: string;
  company: string;
  portalLinks: PortalLinks | null;
}

export interface CollectionSummaryItem {
  type: string;
  threads: number;
}

export interface TaskSummary {
  tlist: number;
  adlist: number;
  splist: number;
  tplist: number;
  aplist: number;
}

export interface SuggestedCollectors {
  M: number;
  L: number;
  XL: number;
  XXL: number;
}

export interface TopModuleItem {
  module: string;
  deviceCount: number;
}

export interface ExcessiveInstanceItem {
  device: string;
  module: string;
  count: number;
}

export interface LongRunningItem {
  timeMs: number;
  type: string;
  device: string;
  module: string;
}

export interface MessageItem {
  message: string;
  count: number;
}

export interface TopMessages {
  tlist: MessageItem[];
  adlist: MessageItem[];
  tplist: MessageItem[];
}

export interface ProtocolLimit {
  name: string;
  limits: string[];
}

export interface CapacityLimits {
  currentSize: string;
  sizes: string[];
  cpu: string[];
  systemMemory: string[];
  jvmMemory: string[];
  protocols: ProtocolLimit[];
}

export interface DefaultConfigItem {
  param: string;
  timeout: number;
  threadpools: number[];
}

export interface TlistSummaryItem {
  type: string;
  collector: string;
  total: number;
  interval: number;
  rps: number;
}

export interface AgentConfigItem {
  param: string;
  threadpool: number | null;
  timeout: number | null;
}

export interface HostStatItem {
  host: string;
  dataTask: number;
  eventTask: number;
}

export interface ProcessItem {
  name?: string;
  pid: string;
  sessionName?: string;
  sessionNum?: string;
  memUsageKB: number;
  // Linux-specific
  tty?: string;
  stat?: string;
  time?: string;
  command?: string;
}

export interface NetflowDeviceItem {
  id: string;
  name: string;
  interfaceIdx: string | null;
  ips: string;
}

export interface AplistItem {
  id: string;
  pid: string;
  status: string;
  type: string;
  waitExec: string;
  waitMs: number;
  execMs: number;
  host: string;
  message: string;
}

export interface SplistItem {
  id: string;
  ruleId: string;
  hostname: string;
  execId: string;
  status: string;
  elapsed: number;
  propertySource: string;
}

export interface AdlistItem {
  id: string;
  lastUpdate: string;
  method: string;
  status: string;
  waitExec: string;
  execTime: number;
  hostname: string;
  datasource: string;
  message: string;
}

export interface TplistItem {
  id: string;
  lastUpdate: string;
  method: string;
  status: string;
  waitExec: string;
  execTime: number;
  hostname: string;
  datasource: string;
  message: string;
}

export interface TlistThreadItem {
  device: string;
  module: string;
  type: string;
  lastExecuteMs: number;
  additionalInstances: number;
}

export interface TlistDetailItem {
  method: string;
  threadCount: number;
  threads: TlistThreadItem[];
}

export interface AppliesToQuery {
  label: string;
  query: string;
}

export interface Logs {
  wrapper: string[];
  sbproxy: string[];
  watchdog: string[];
}

export interface HealthCheckData {
  meta: HealthCheckMeta;
  collectorInfo: CollectorInfo;
  collectionSummary: CollectionSummaryItem[];
  taskSummary: TaskSummary;
  totalInstances: number;
  suggestedCollectors: SuggestedCollectors;
  topModules: TopModuleItem[];
  excessiveInstances: ExcessiveInstanceItem[];
  longRunning: LongRunningItem[];
  topMessages: TopMessages;
  capacityLimits: CapacityLimits;
  defaultConfig: DefaultConfigItem[];
  tlistSummary: TlistSummaryItem[];
  agentConfig: AgentConfigItem[];
  hostStats: HostStatItem[];
  processes: ProcessItem[];
  netflowDevices: NetflowDeviceItem[];
  aplist: AplistItem[];
  splist: SplistItem[];
  adlist: AdlistItem[];
  tplist: TplistItem[];
  tlistDetails: TlistDetailItem[];
  appliesToQueries: AppliesToQuery[];
  logs: Logs;
}

/**
 * Parse health check JSON output from collector
 */
export function parseHealthCheckData(output: string): HealthCheckData | null {
  try {
    // Try to find JSON in the output (may have leading/trailing text)
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const data = JSON.parse(jsonMatch[0]) as HealthCheckData;
    
    // Validate required fields
    if (!data.meta || !data.collectorInfo) {
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Check if a debug command output is a health check result
 */
export function isHealthCheckOutput(output: string): boolean {
  try {
    const data = parseHealthCheckData(output);
    return data !== null && 'collectorInfo' in data && 'taskSummary' in data;
  } catch {
    return false;
  }
}

