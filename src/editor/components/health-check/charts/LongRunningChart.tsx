import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SectionCard } from '../SectionCard';
import { Timer } from 'lucide-react';
import { SuccessIcon } from '../../../constants/icons';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { LongRunningItem } from '../types';

interface LongRunningChartProps {
  data: LongRunningItem[];
}

// Direct color values for charts - works in both light and dark mode
const COLORS = [
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
  '#6366f1', // indigo-500
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface ChartDataItem {
  name: string;
  device: string;
  module: string;
  type: string;
  timeMs: number;
  timeFormatted: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }> }) {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover p-2 shadow-md">
      <p className="text-sm font-medium text-popover-foreground">{data.device}</p>
      <p className="text-sm text-muted-foreground">{data.module}</p>
      <p className="text-sm text-muted-foreground">{data.type} - {data.timeFormatted}</p>
    </div>
  );
}

export function LongRunningChart({ data }: LongRunningChartProps) {
  if (!data || data.length === 0) {
    return (
      <SectionCard title="Long Running Tasks" icon={<Timer className="size-4" />}>
        <Empty className="h-64 border-none bg-transparent shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-teal-500/10">
            <SuccessIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">No long-running tasks</EmptyTitle>
            <EmptyDescription className="text-xs">
              All tasks completed within normal thresholds.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  // Take top 10
  const chartData: ChartDataItem[] = data.slice(0, 10).map(item => ({
    name: `${item.device.slice(0, 15)} - ${item.module.slice(0, 20)}`,
    device: item.device,
    module: item.module,
    type: item.type,
    timeMs: item.timeMs,
    timeFormatted: formatDuration(item.timeMs),
  }));

  return (
    <SectionCard title="Longest Running Collections" icon={<Timer className="size-4" />}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis 
              type="number" 
              tickFormatter={(value: number) => formatDuration(value)}
              stroke="currentColor"
              opacity={0.5}
            />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={180}
              tick={{ fontSize: 10, fill: 'currentColor' }}
              stroke="currentColor"
              opacity={0.5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="timeMs" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
