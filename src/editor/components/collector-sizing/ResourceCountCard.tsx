/**
 * ResourceCountCard - Individual input card for device/log counts.
 * Compact design matching app's styling patterns.
 * Supports showing advanced details (instances, collection methods) when enabled.
 */

import {
  Server,
  Database,
  Router,
  Network,
  Shield,
  Scale,
  Activity,
  Wifi,
  HardDrive,
  Monitor,
  Terminal,
  Globe,
  Radio,
  Boxes,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Icon mapping from string names to components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Server,
  Database,
  Router,
  Network,
  Shield,
  Scale,
  Activity,
  Wifi,
  HardDrive,
  Monitor,
  Terminal,
  Globe,
  Radio,
  Boxes,
};

// Method colors for visual distinction
const METHOD_COLORS: Record<string, string> = {
  SNMPv2: 'text-green-600 dark:text-green-400',
  SNMPv3: 'text-emerald-600 dark:text-emerald-400',
  WMI: 'text-blue-600 dark:text-blue-400',
  WinRM: 'text-sky-600 dark:text-sky-400',
  Script: 'text-purple-600 dark:text-purple-400',
  HTTP: 'text-orange-600 dark:text-orange-400',
  JMX: 'text-pink-600 dark:text-pink-400',
  JDBC: 'text-yellow-600 dark:text-yellow-400',
  Perfmon: 'text-cyan-600 dark:text-cyan-400',
};

interface ResourceCountCardProps {
  name: string;
  icon: string;
  count: number;
  onChange: (count: number) => void;
  subtitle?: string;
  disabled?: boolean;
  // Advanced details props
  showAdvancedDetails?: boolean;
  methods?: Record<string, number>;
  instances?: number;
}

export function ResourceCountCard({
  name,
  icon,
  count,
  onChange,
  subtitle,
  disabled = false,
  showAdvancedDetails = false,
  methods,
  instances,
}: ResourceCountCardProps) {
  const IconComponent = ICON_MAP[icon] || Server;
  const hasValue = count > 0;
  const hasAdvancedData = methods && Object.keys(methods).length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string or valid numbers
    if (val === '') {
      onChange(0);
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0) {
        onChange(num);
      }
    }
  };

  return (
    <div
      className={cn(
        'rounded-md border transition-colors',
        hasValue
          ? 'border-primary/30 bg-primary/5'
          : 'border-border/40 bg-muted/10 hover:bg-muted/20',
        disabled && 'opacity-50'
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        {/* Icon */}
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded',
            hasValue ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
          )}
        >
          <IconComponent className="size-3.5" />
        </div>

        {/* Name */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-foreground">{name}</div>
          {subtitle && <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>}
        </div>

        {/* Count input */}
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={count || ''}
          onChange={handleChange}
          placeholder="0"
          disabled={disabled}
          className="h-7 w-16 text-right text-xs"
        />
      </div>

      {/* Advanced details section */}
      {showAdvancedDetails && hasAdvancedData && (
        <div className="border-t border-border/30 px-3 py-2">
          {/* Instances */}
          {instances !== undefined && (
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Base Instances</span>
              <span className="font-medium text-foreground">{instances}</span>
            </div>
          )}

          {/* Methods */}
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Collection Methods</span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(methods).map(([method, ratio]) => (
                <span
                  key={method}
                  className={cn(
                    'rounded bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium',
                    METHOD_COLORS[method] || 'text-foreground'
                  )}
                >
                  {method} {(ratio * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
