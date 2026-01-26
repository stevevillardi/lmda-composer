/**
 * CollectorSizeSelect - Dropdown to select collector sizing mode.
 * Allows forcing a specific collector size or using auto-sizing.
 */

import { Zap, Server } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import type { ForcedCollectorSize } from '../../stores/slices/collector-sizing-slice';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';

const COLLECTOR_SIZES = ['SMALL', 'MEDIUM', 'LARGE', 'XL', 'XXL'] as const;

function getDisplayValue(value: ForcedCollectorSize) {
  if (value === 'auto') {
    return (
      <div className="flex items-center gap-2">
        <Zap className="size-3.5 text-primary" />
        <span>Auto Size Collector</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Server className="size-3.5 text-muted-foreground" />
      <span>Force {value} Collector</span>
    </div>
  );
}

export function CollectorSizeSelect() {
  const { collectorSizingConfig, setForcedCollectorSize } = useEditorStore();
  const { forcedCollectorSize } = collectorSizingConfig;

  const handleChange = (value: string | null) => {
    if (value) {
      setForcedCollectorSize(value as ForcedCollectorSize);
    }
  };

  return (
    <Select value={forcedCollectorSize} onValueChange={handleChange}>
      <SelectTrigger className="h-8! w-[200px] text-xs">
        {getDisplayValue(forcedCollectorSize)}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-[10px]">Sizing Mode</SelectLabel>
          <SelectItem value="auto">
            <div className="flex items-center gap-2">
              <Zap className="size-3.5 text-primary" />
              <span>Auto Size Collector</span>
            </div>
          </SelectItem>
          {COLLECTOR_SIZES.map((size) => (
            <SelectItem key={size} value={size}>
              <div className="flex items-center gap-2">
                <Server className="size-3.5 text-muted-foreground" />
                <span>Force {size} Collector</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
