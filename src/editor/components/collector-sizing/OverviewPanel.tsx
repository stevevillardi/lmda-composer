/**
 * OverviewPanel - Summary view showing totals and per-site breakdown.
 */

import { Server, FileText, Activity, Cpu, MemoryStick, HardDrive, MapPin, Monitor, Database, Info } from 'lucide-react';
import type { Site } from '../../stores/slices/collector-sizing-slice';
import type { SiteCalculationResult, CollectorRecommendation } from '../../utils/collector-calculations';
import {
  getLoadStatus,
  formatLoad,
  formatNumber,
  formatGB,
  formatBps,
  getAggregatedDeviceSummary,
  getAggregatedLogsGBPerDay,
  getAggregatedNetflowGBPerDayRange,
  getAggregatedNetflowBps,
  getAggregatedEPSBreakdown,
  getAggregatedFPS,
  NETFLOW_BYTES_PER_FLOW_MIN,
  NETFLOW_BYTES_PER_FLOW_MAX,
} from '../../utils/collector-calculations';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface OverviewPanelProps {
  sites: Site[];
  aggregatedResults: SiteCalculationResult | null;
  showAdvancedDetails?: boolean;
}

export function OverviewPanel({ sites, aggregatedResults, showAdvancedDetails = false }: OverviewPanelProps) {
  const hasAnyRecommendation =
    aggregatedResults?.polling ||
    aggregatedResults?.logs ||
    aggregatedResults?.netflow;

  if (!hasAnyRecommendation) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex w-full max-w-md flex-col items-center rounded-lg border-2 border-dashed border-border/60 bg-muted/5 px-8 py-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
            <Server className="size-6 text-muted-foreground/60" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-foreground">No Recommendations Yet</h3>
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            Add devices or log sources to your sites to see collector recommendations.
          </p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalPollingCollectors = aggregatedResults?.polling?.count ?? 0;
  const totalLogsCollectors = aggregatedResults?.logs?.count ?? 0;
  const totalNetflowCollectors = aggregatedResults?.netflow?.count ?? 0;
  const totalCollectors = totalPollingCollectors + totalLogsCollectors + totalNetflowCollectors;

  // Calculate aggregated details for advanced view
  const aggregatedDeviceSummary = showAdvancedDetails ? getAggregatedDeviceSummary(sites) : null;
  const aggregatedLogsGB = showAdvancedDetails ? getAggregatedLogsGBPerDay(sites) : 0;
  const aggregatedNetflowGBRange = showAdvancedDetails ? getAggregatedNetflowGBPerDayRange(sites) : { min: 0, max: 0 };
  const aggregatedNetflowBps = showAdvancedDetails ? getAggregatedNetflowBps(sites) : 0;
  const aggregatedEPSBreakdown = showAdvancedDetails ? getAggregatedEPSBreakdown(sites) : null;
  const aggregatedFPS = showAdvancedDetails ? getAggregatedFPS(sites) : 0;

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Header */}
      <div className="border-b border-border bg-secondary/30 px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">Overview</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Total collector requirements across all {sites.length} site{sites.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {/* Total Summary Cards */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Server className="size-3.5" />
              Total Collectors Required
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryCard
                title="Polling"
                icon={<Server className="size-4" />}
                recommendation={aggregatedResults?.polling ?? null}
                loadType="weight"
              />
              <SummaryCard
                title="Logs & Traps"
                icon={<FileText className="size-4" />}
                recommendation={aggregatedResults?.logs ?? null}
                loadType="eps"
              />
              <SummaryCard
                title="NetFlow"
                icon={<Activity className="size-4" />}
                recommendation={aggregatedResults?.netflow ?? null}
                loadType="fps"
              />
            </div>
          </div>

          {/* Total Resources */}
          <div className="rounded-lg border border-border/40 bg-card/20 p-4">
            <h4 className="mb-3 text-xs font-medium text-muted-foreground">
              Total Resource Requirements
            </h4>
            <div className="grid gap-4 sm:grid-cols-4">
              <ResourceStat
                icon={<Server className="size-4" />}
                label="Total Collectors"
                value={totalCollectors}
              />
              <ResourceStat
                icon={<Cpu className="size-4" />}
                label="Total vCPUs"
                value={calculateTotalResource(aggregatedResults, 'cpu')}
              />
              <ResourceStat
                icon={<MemoryStick className="size-4" />}
                label="Total Memory"
                value={`${calculateTotalResource(aggregatedResults, 'memory')} GB`}
              />
              <ResourceStat
                icon={<HardDrive className="size-4" />}
                label="Total Disk"
                value={`${calculateTotalResource(aggregatedResults, 'disk')} GB`}
              />
            </div>
          </div>

          {/* Advanced Details - Aggregated Summary */}
          {showAdvancedDetails && (
            <AggregatedDetailsSummary
              deviceSummary={aggregatedDeviceSummary}
              logsGBPerDay={aggregatedLogsGB}
              epsBreakdown={aggregatedEPSBreakdown}
              netflowGBPerDayRange={aggregatedNetflowGBRange}
              netflowBps={aggregatedNetflowBps}
              totalFPS={aggregatedFPS}
              hasPolling={!!aggregatedResults?.polling}
              hasLogs={!!aggregatedResults?.logs}
              hasNetflow={!!aggregatedResults?.netflow}
            />
          )}

          <Separator />

          {/* Per-Site Breakdown */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <MapPin className="size-3.5" />
              Per-Site Breakdown
            </h3>
            <div className="space-y-2">
              {sites.map((site) => (
                <SiteBreakdownRow key={site.id} site={site} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface SummaryCardProps {
  title: string;
  icon: React.ReactNode;
  recommendation: CollectorRecommendation | null;
  loadType: 'weight' | 'eps' | 'fps';
}

function SummaryCard({ title, icon, recommendation, loadType }: SummaryCardProps) {
  if (!recommendation) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border/40 bg-muted/5 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="mt-3 text-center text-xs text-muted-foreground/60">
          Not required, based on current design
        </div>
      </div>
    );
  }

  const loadStatus = getLoadStatus(recommendation.utilizationPercent);

  const statusColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const statusBgColors = {
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };

  const loadLabel = {
    weight: 'Load',
    eps: 'EPS',
    fps: 'FPS',
  };

  return (
    <div className="rounded-lg border border-border/40 bg-card/20 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            statusBgColors[loadStatus.color]
          )}
        >
          {loadStatus.label}
        </span>
      </div>

      {/* Main Stats */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{recommendation.count}</span>
        <span className="text-sm text-muted-foreground">× {recommendation.size}</span>
      </div>

      {/* Utilization Bar */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Utilization</span>
          <span className="font-medium text-foreground">
            {recommendation.utilizationPercent.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
          <div
            className={cn('h-full transition-all', statusColors[loadStatus.color])}
            style={{ width: `${Math.min(100, recommendation.utilizationPercent)}%` }}
          />
        </div>
      </div>

      {/* Load Details */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {loadLabel[loadType]}: {formatLoad(recommendation.totalLoad)}
        </span>
        <span>Cap: {formatLoad(recommendation.maxCapacity)}</span>
      </div>
    </div>
  );
}

interface ResourceStatProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}

function ResourceStat({ icon, label, value }: ResourceStatProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      <div>
        <div className="text-lg font-semibold text-foreground">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

interface SiteBreakdownRowProps {
  site: Site;
}

function SiteBreakdownRow({ site }: SiteBreakdownRowProps) {
  const result = site.calculationResult;
  const hasRecommendation = result?.polling || result?.logs || result?.netflow;

  const totalDevices = Object.values(site.devices).reduce(
    (sum, d) => sum + d.count,
    0
  );

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/20 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <MapPin className="size-3.5 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">{site.name}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{totalDevices} devices</div>
      </div>

      {hasRecommendation ? (
        <div className="flex shrink-0 items-center gap-4 text-xs">
          {result?.polling && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Server className="size-3.5" />
              <span className="font-medium text-foreground">
                {result.polling.count}× {result.polling.size}
              </span>
            </div>
          )}
          {result?.logs && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="size-3.5" />
              <span className="font-medium text-foreground">
                {result.logs.count}× {result.logs.size}
              </span>
            </div>
          )}
          {result?.netflow && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="size-3.5" />
              <span className="font-medium text-foreground">
                {result.netflow.count}× {result.netflow.size}
              </span>
            </div>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">No collectors needed</span>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function calculateTotalResource(
  result: SiteCalculationResult | null,
  resource: 'cpu' | 'memory' | 'disk'
): number {
  if (!result) return 0;

  let total = 0;

  if (result.polling) {
    total += result.polling.count * parseInt(result.polling.requirements[resource], 10);
  }
  if (result.logs) {
    total += result.logs.count * parseInt(result.logs.requirements[resource], 10);
  }
  if (result.netflow) {
    total += result.netflow.count * parseInt(result.netflow.requirements[resource], 10);
  }

  return total;
}

// ============================================================================
// Aggregated Details Summary
// ============================================================================

import type { DeviceSummary } from '../../utils/collector-calculations';

interface AggregatedDetailsSummaryProps {
  deviceSummary: DeviceSummary | null;
  logsGBPerDay: number;
  epsBreakdown: { logsEPS: number; trapsEPS: number; totalEPS: number } | null;
  netflowGBPerDayRange: { min: number; max: number };
  netflowBps: number;
  totalFPS: number;
  hasPolling: boolean;
  hasLogs: boolean;
  hasNetflow: boolean;
}

function AggregatedDetailsSummary({
  deviceSummary,
  logsGBPerDay,
  epsBreakdown,
  netflowGBPerDayRange,
  netflowBps,
  totalFPS,
  hasPolling,
  hasLogs,
  hasNetflow,
}: AggregatedDetailsSummaryProps) {
  const totalIngestionMin = logsGBPerDay + netflowGBPerDayRange.min;
  const totalIngestionMax = logsGBPerDay + netflowGBPerDayRange.max;
  const hasIngestion = totalIngestionMax > 0;
  const hasNetflowData = netflowGBPerDayRange.max > 0;

  return (
    <div className="rounded-lg border border-border/40 bg-card/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Database className="size-4 text-muted-foreground" />
        <h4 className="text-xs font-medium text-foreground">Aggregated Summary</h4>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Device Summary */}
        {hasPolling && deviceSummary && deviceSummary.totalDevices > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Monitor className="size-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">Devices</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Devices:</span>
                <span className="font-medium text-foreground">
                  {formatNumber(deviceSummary.totalDevices)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Instances:</span>
                <span className="font-medium text-foreground">
                  {formatNumber(deviceSummary.totalInstances)}
                </span>
              </div>
              {Object.keys(deviceSummary.methodBreakdown).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(deviceSummary.methodBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([method, percent]) => (
                      <span
                        key={method}
                        className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {method} {percent.toFixed(0)}%
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs/Traps Summary */}
        {hasLogs && epsBreakdown && epsBreakdown.totalEPS > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">Logs/Traps</span>
            </div>
            <div className="space-y-1 text-xs">
              {epsBreakdown.logsEPS > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Logs:</span>
                  <span className="font-medium text-foreground">
                    ~{formatNumber(Math.round(epsBreakdown.logsEPS))} events/sec
                  </span>
                </div>
              )}
              {epsBreakdown.trapsEPS > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Traps:</span>
                  <span className="font-medium text-foreground">
                    ~{formatNumber(Math.round(epsBreakdown.trapsEPS))} events/sec
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/30 pt-1">
                <span className="text-muted-foreground">Estimated Ingestion:</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  ~{formatGB(logsGBPerDay)}/day
                </span>
              </div>
            </div>
          </div>
        )}

        {/* NetFlow Summary */}
        {hasNetflow && hasNetflowData && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Activity className="size-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">NetFlow</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Flows:</span>
                <span className="font-medium text-foreground">
                  ~{formatNumber(Math.round(totalFPS))} flows/sec
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Throughput:</span>
                <span className="font-medium text-foreground">~{formatBps(netflowBps)}</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-1">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Estimated Ingestion:
                  <Tooltip>
                    <TooltipTrigger
                      render={<Info className="size-3 cursor-help text-muted-foreground/60" />}
                    />
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      <p>
                        NetFlow record sizes can vary greatly, typically between {NETFLOW_BYTES_PER_FLOW_MIN}-{NETFLOW_BYTES_PER_FLOW_MAX} bytes
                        depending on template configuration and fields exported.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  ~{formatGB(netflowGBPerDayRange.min)}-{formatGB(netflowGBPerDayRange.max)}/day
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Total Ingestion */}
      {hasIngestion && (
        <div className="mt-4 border-t border-border/30 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total Estimated Ingestion:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {hasNetflowData ? (
                <>~{formatGB(totalIngestionMin)}-{formatGB(totalIngestionMax)}/day</>
              ) : (
                <>~{formatGB(logsGBPerDay)}/day</>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
