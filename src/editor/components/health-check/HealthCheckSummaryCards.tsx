import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  HardDrive,
  Server,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { HealthCheckData } from './types';

/** Format platform name with proper casing (linux -> Linux) */
function formatPlatform(platform: string): string {
  if (!platform) return 'N/A';
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
}

interface HealthCheckSummaryCardsProps {
  data: HealthCheckData;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'error' | 'success';
  subValue?: string;
}

function MetricCard({ label, value, icon, variant = 'default', subValue }: MetricCardProps) {
  const variantStyles = {
    default: 'border-border',
    warning: 'border-yellow-500/50 bg-yellow-500/5',
    error: 'border-red-500/50 bg-red-500/5',
    success: 'border-teal-500/50 bg-teal-500/5',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    success: 'text-teal-500',
  };

  return (
    <Card className={cn('transition-colors', variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground select-none">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground select-none">{subValue}</p>
            )}
          </div>
          <div className={cn('rounded-lg bg-muted/50 p-2 select-none', iconStyles[variant])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthCheckSummaryCards({ data }: HealthCheckSummaryCardsProps) {
  const { collectorInfo, taskSummary, meta, totalInstances } = data;

  // Calculate total failing threads
  const totalFailingThreads = taskSummary.tlist + taskSummary.adlist + 
    taskSummary.splist + taskSummary.tplist + taskSummary.aplist;

  // Determine severity based on failing thread count
  const getThreadVariant = (count: number): MetricCardProps['variant'] => {
    if (count === 0) return 'success';
    if (count < 10) return 'warning';
    return 'error';
  };

  // Determine run time variant
  const getRunTimeVariant = (seconds: number): MetricCardProps['variant'] => {
    if (seconds < 5) return 'success';
    if (seconds < 10) return 'warning';
    return 'error';
  };

  const sizeColors: Record<string, string> = {
    Small: 'bg-cyan-500',
    Medium: 'bg-teal-500',
    Large: 'bg-yellow-500',
    XL: 'bg-yellow-700',
    XXL: 'bg-red-500',
    Unknown: 'bg-gray-500',
  };

  return (
    <div className="space-y-4">
      {/* Collector info row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Server className="size-5 text-muted-foreground" />
          <span className="font-semibold">{collectorInfo.description || collectorInfo.hostname}</span>
        </div>
        <Badge variant="outline" className="font-mono select-none">
          ID: {collectorInfo.id}
        </Badge>
        <Badge className={cn('text-white select-none', sizeColors[collectorInfo.size] || sizeColors.Unknown)}>
          {collectorInfo.size}
        </Badge>
        {collectorInfo.version && (
          <Badge variant="secondary" className="select-none">v{collectorInfo.version}</Badge>
        )}
        {collectorInfo.platform && (
          <Badge variant="outline" className="select-none">{formatPlatform(collectorInfo.platform)}</Badge>
        )}
      </div>

      {/* Metric cards grid */}
      <div className="
        grid grid-cols-2 gap-4
        md:grid-cols-3
        lg:grid-cols-5
      ">
        <MetricCard
          label="Failing Threads"
          value={totalFailingThreads}
          icon={<AlertTriangle className="size-5" />}
          variant={getThreadVariant(totalFailingThreads)}
          subValue={meta.showOKonly ? 'Showing OK only' : 'Showing failures'}
        />
        
        <MetricCard
          label="Total Instances"
          value={totalInstances.toLocaleString()}
          icon={<Activity className="size-5" />}
        />
        
        <MetricCard
          label="Debug Run Time"
          value={`${meta.debugRunSeconds}s`}
          icon={<Clock className="size-5" />}
          variant={getRunTimeVariant(meta.debugRunSeconds)}
          subValue={meta.debugRunSeconds > 5 ? 'Check collector load' : 'Normal'}
        />
        
        <MetricCard
          label="JVM Memory"
          value={collectorInfo.jvmMemory || 'N/A'}
          icon={<Cpu className="size-5" />}
          subValue={collectorInfo.jvmMemoryMB ? `${collectorInfo.jvmMemoryMB} MB` : undefined}
        />
        
        <MetricCard
          label="Physical Memory"
          value={collectorInfo.physicalMemory || 'N/A'}
          icon={<HardDrive className="size-5" />}
        />
      </div>
    </div>
  );
}

