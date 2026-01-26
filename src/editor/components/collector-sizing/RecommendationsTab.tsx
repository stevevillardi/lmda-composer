/**
 * RecommendationsTab - Visual display of calculated collector recommendations for a site.
 */

import { Server, FileText, Activity, Cpu, MemoryStick, HardDrive, Monitor, Info } from 'lucide-react';
import type { Site } from '../../stores/slices/collector-sizing-slice';
import type { SiteCalculationResult, CollectorRecommendation } from '../../utils/collector-calculations';
import {
  getLoadStatus,
  formatLoad,
  formatNumber,
  getDeviceSummary,
  calculateLogsGBPerDay,
  calculateNetflowGBPerDayRange,
  calculateNetflowBps,
  getEPSBreakdown,
  calculateTotalFPS,
  formatGB,
  formatBps,
  NETFLOW_BYTES_PER_FLOW_MIN,
  NETFLOW_BYTES_PER_FLOW_MAX,
} from '../../utils/collector-calculations';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RecommendationsTabProps {
  calculationResult: SiteCalculationResult | null;
  site?: Site;
  showAdvancedDetails?: boolean;
}

export function RecommendationsTab({
  calculationResult,
  site,
  showAdvancedDetails = false,
}: RecommendationsTabProps) {
  const hasAnyRecommendation =
    calculationResult?.polling ||
    calculationResult?.logs ||
    calculationResult?.netflow;

  if (!hasAnyRecommendation) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex w-full max-w-md flex-col items-center rounded-lg border-2 border-dashed border-border/60 bg-muted/5 px-8 py-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
            <Server className="size-6 text-muted-foreground/60" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-foreground">No Recommendations Yet</h3>
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            Add devices, log sources, or NetFlow configurations to see collector recommendations.
          </p>
        </div>
      </div>
    );
  }

  // Get device summary for detailed view
  const deviceSummary = site ? getDeviceSummary(site.devices) : null;
  const epsBreakdown = site ? getEPSBreakdown(site.logs, site.traps) : null;
  const logsGBPerDay = site ? calculateLogsGBPerDay(site.logs, site.traps) : 0;
  const totalFPS = site ? calculateTotalFPS(site.flows) : 0;
  const netflowGBPerDayRange = site ? calculateNetflowGBPerDayRange(site.flows) : { min: 0, max: 0 };
  const netflowBps = site ? calculateNetflowBps(site.flows) : 0;

  return (
    <div className="space-y-4">
      {/* Recommendations Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Polling Collectors */}
        <RecommendationCard
          title="Polling Collectors"
          icon={<Server className="size-4" />}
          recommendation={calculationResult?.polling ?? null}
          loadType="weight"
        />

        {/* Logs/Traps Collectors */}
        <RecommendationCard
          title="Logs/Traps Collectors"
          icon={<FileText className="size-4" />}
          recommendation={calculationResult?.logs ?? null}
          loadType="eps"
        />

        {/* NetFlow Collectors */}
        <RecommendationCard
          title="NetFlow Collectors"
          icon={<Activity className="size-4" />}
          recommendation={calculationResult?.netflow ?? null}
          loadType="fps"
        />
      </div>

      {/* Device & Load Summary - Advanced Details */}
      {showAdvancedDetails && site && calculationResult?.polling && deviceSummary && deviceSummary.devices.length > 0 && (
        <DeviceLoadSummary deviceSummary={deviceSummary} />
      )}

      {/* Logs/Traps Summary - Advanced Details */}
      {showAdvancedDetails && site && calculationResult?.logs && epsBreakdown && epsBreakdown.totalEPS > 0 && (
        <LogsTrapsSummary epsBreakdown={epsBreakdown} gbPerDay={logsGBPerDay} />
      )}

      {/* NetFlow Summary - Advanced Details */}
      {showAdvancedDetails && site && calculationResult?.netflow && totalFPS > 0 && (
        <NetFlowSummary totalFPS={totalFPS} gbPerDayRange={netflowGBPerDayRange} bps={netflowBps} />
      )}

      {/* Total Resources Summary */}
      {hasAnyRecommendation && (
        <div className="rounded-md border border-border/40 bg-card/20 p-4">
          <h4 className="mb-3 text-xs font-medium text-muted-foreground">
            Site Resource Requirements
          </h4>
          <div className="grid gap-4 sm:grid-cols-4">
            <ResourceItem
              icon={<Server className="size-4" />}
              label="Total Collectors"
              value={
                (calculationResult?.polling?.count ?? 0) +
                (calculationResult?.logs?.count ?? 0) +
                (calculationResult?.netflow?.count ?? 0)
              }
            />
            <ResourceItem
              icon={<Cpu className="size-4" />}
              label="Total vCPUs"
              value={calculateTotalResource(calculationResult, 'cpu')}
            />
            <ResourceItem
              icon={<MemoryStick className="size-4" />}
              label="Memory (GB)"
              value={calculateTotalResource(calculationResult, 'memory')}
            />
            <ResourceItem
              icon={<HardDrive className="size-4" />}
              label="Disk (GB)"
              value={calculateTotalResource(calculationResult, 'disk')}
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
        <h4 className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">Notes</h4>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            Recommendations are based on LogicMonitor sizing guidelines and your configuration.
          </li>
          <li>Actual requirements may vary based on custom DataSources and polling intervals.</li>
          <li>For production, consider adding headroom for growth and unexpected spikes.</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface RecommendationCardProps {
  title: string;
  icon: React.ReactNode;
  recommendation: CollectorRecommendation | null;
  loadType: 'weight' | 'eps' | 'fps';
}

function RecommendationCard({ title, icon, recommendation, loadType }: RecommendationCardProps) {
  if (!recommendation) {
    return (
      <div className="rounded-md border-2 border-dashed border-border/40 bg-muted/5 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="mt-4 text-center text-xs text-muted-foreground/60">Not required, based on current design</div>
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
    <div className="rounded-md border border-border/40 bg-card/20 p-4">
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

      {/* Resource Requirements */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
        <div className="flex items-center gap-1.5 text-[10px]">
          <Cpu className="size-3 text-muted-foreground" />
          <span className="font-medium text-foreground">{recommendation.requirements.cpu}</span>
          <span className="text-muted-foreground">vCPU</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <MemoryStick className="size-3 text-muted-foreground" />
          <span className="font-medium text-foreground">{recommendation.requirements.memory}</span>
          <span className="text-muted-foreground">GB</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <HardDrive className="size-3 text-muted-foreground" />
          <span className="font-medium text-foreground">{recommendation.requirements.disk}</span>
          <span className="text-muted-foreground">GB</span>
        </div>
      </div>
    </div>
  );
}

interface ResourceItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

function ResourceItem({ icon, label, value }: ResourceItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      <div>
        <div className="text-lg font-semibold text-foreground">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
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
// Advanced Detail Components
// ============================================================================

import type { DeviceSummary } from '../../utils/collector-calculations';

interface DeviceLoadSummaryProps {
  deviceSummary: DeviceSummary;
}

function DeviceLoadSummary({ deviceSummary }: DeviceLoadSummaryProps) {
  // Get top methods (sorted by percentage)
  const topMethods = Object.entries(deviceSummary.methodBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="rounded-md border border-border/40 bg-card/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Monitor className="size-4 text-muted-foreground" />
        <h4 className="text-xs font-medium text-foreground">Device & Load Summary</h4>
      </div>

      {/* Device Type Table */}
      <div className="mb-3 overflow-hidden rounded-md border border-border/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Device Type</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Count</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Instances</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {deviceSummary.devices.slice(0, 8).map((device) => (
              <tr key={device.name} className="border-b border-border/20 last:border-0">
                <td className="px-3 py-1.5 text-foreground">{device.name}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {formatNumber(device.count)}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  × {formatNumber(device.instances)}
                </td>
                <td className="px-3 py-1.5 text-right font-medium text-foreground">
                  {formatNumber(device.totalInstances)}
                </td>
              </tr>
            ))}
            {deviceSummary.devices.length > 8 && (
              <tr className="border-b border-border/20">
                <td colSpan={4} className="px-3 py-1.5 text-center text-muted-foreground italic">
                  +{deviceSummary.devices.length - 8} more device types...
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted/20">
              <td className="px-3 py-2 font-medium text-foreground">Total</td>
              <td className="px-3 py-2 text-right font-medium text-foreground">
                {formatNumber(deviceSummary.totalDevices)}
              </td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right font-medium text-foreground">
                {formatNumber(deviceSummary.totalInstances)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Collection Methods */}
      {topMethods.length > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-medium">Collection Methods:</span>
          <div className="flex flex-wrap gap-2">
            {topMethods.map(([method, percent]) => (
              <span key={method} className="rounded bg-muted/50 px-1.5 py-0.5">
                {method} {percent.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LogsTrapsSummaryProps {
  epsBreakdown: { logsEPS: number; trapsEPS: number; totalEPS: number };
  gbPerDay: number;
}

function LogsTrapsSummary({ epsBreakdown, gbPerDay }: LogsTrapsSummaryProps) {
  return (
    <div className="rounded-md border border-border/40 bg-card/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="size-4 text-muted-foreground" />
        <h4 className="text-xs font-medium text-foreground">Logs/Traps Summary</h4>
      </div>

      <div className="space-y-2 text-xs">
        {epsBreakdown.logsEPS > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Logs:</span>
            <span className="font-medium text-foreground">
              ~{formatNumber(Math.round(epsBreakdown.logsEPS))} events/sec
            </span>
          </div>
        )}
        {epsBreakdown.trapsEPS > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Traps:</span>
            <span className="font-medium text-foreground">
              ~{formatNumber(Math.round(epsBreakdown.trapsEPS))} events/sec
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border/30 pt-2">
          <span className="text-muted-foreground">Estimated Ingestion:</span>
          <span className="font-medium text-blue-600 dark:text-blue-400">
            ~{formatGB(gbPerDay)}/day
          </span>
        </div>
      </div>
    </div>
  );
}

interface NetFlowSummaryProps {
  totalFPS: number;
  gbPerDayRange: { min: number; max: number };
  bps: number;
}

function NetFlowSummary({ totalFPS, gbPerDayRange, bps }: NetFlowSummaryProps) {
  return (
    <div className="rounded-md border border-border/40 bg-card/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="size-4 text-muted-foreground" />
        <h4 className="text-xs font-medium text-foreground">NetFlow Summary</h4>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Flows:</span>
          <span className="font-medium text-foreground">
            ~{formatNumber(Math.round(totalFPS))} flows/sec
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Throughput:</span>
          <span className="font-medium text-foreground">~{formatBps(bps)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/30 pt-2">
          <span className="flex items-center gap-1 text-muted-foreground">
            Estimated Ingestion:
            <Tooltip>
              <TooltipTrigger
                render={<Info className="size-3 cursor-help text-muted-foreground/60" />}
              />
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p>
                  NetFlow record sizes vary from {NETFLOW_BYTES_PER_FLOW_MIN}-{NETFLOW_BYTES_PER_FLOW_MAX} bytes
                  depending on template configuration and fields exported.
                </p>
              </TooltipContent>
            </Tooltip>
          </span>
          <span className="font-medium text-blue-600 dark:text-blue-400">
            ~{formatGB(gbPerDayRange.min)}-{formatGB(gbPerDayRange.max)}/day
          </span>
        </div>
      </div>
    </div>
  );
}
