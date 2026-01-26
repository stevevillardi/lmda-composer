/**
 * CollectorPreviewCard - Visual display of a collector recommendation.
 * Shows collector count, size, utilization, and resource requirements.
 */

import { Cpu, MemoryStick, HardDrive } from 'lucide-react';
import type { CollectorRecommendation } from '../../utils/collector-calculations';
import { getLoadStatus, formatLoad } from '../../utils/collector-calculations';
import { cn } from '@/lib/utils';

interface CollectorPreviewCardProps {
  title: string;
  icon: React.ReactNode;
  recommendation: CollectorRecommendation | null;
  loadType: 'weight' | 'eps' | 'fps';
}

export function CollectorPreviewCard({
  title,
  icon,
  recommendation,
  loadType,
}: CollectorPreviewCardProps) {
  if (!recommendation) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          No collectors needed
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
    <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          statusBgColors[loadStatus.color]
        )}>
          {loadStatus.label}
        </span>
      </div>

      {/* Main Stats */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">
          {recommendation.count}
        </span>
        <span className="text-lg text-muted-foreground">
          x {recommendation.size}
        </span>
      </div>

      {/* Utilization Bar */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Utilization</span>
          <span className="font-medium text-foreground">
            {recommendation.utilizationPercent.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted/30">
          <div
            className={cn(
              "h-full transition-all",
              statusColors[loadStatus.color]
            )}
            style={{ width: `${Math.min(100, recommendation.utilizationPercent)}%` }}
          />
        </div>
      </div>

      {/* Load Details */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{loadLabel[loadType]}: {formatLoad(recommendation.totalLoad)}</span>
        <span>Capacity: {formatLoad(recommendation.maxCapacity)}</span>
      </div>

      {/* Resource Requirements */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
        <div className="flex items-center gap-1.5">
          <Cpu className="size-3.5 text-muted-foreground" />
          <div className="text-xs">
            <span className="font-medium text-foreground">
              {recommendation.requirements.cpu}
            </span>
            <span className="text-muted-foreground"> vCPU</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <MemoryStick className="size-3.5 text-muted-foreground" />
          <div className="text-xs">
            <span className="font-medium text-foreground">
              {recommendation.requirements.memory}
            </span>
            <span className="text-muted-foreground"> GB</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <HardDrive className="size-3.5 text-muted-foreground" />
          <div className="text-xs">
            <span className="font-medium text-foreground">
              {recommendation.requirements.disk}
            </span>
            <span className="text-muted-foreground"> GB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
