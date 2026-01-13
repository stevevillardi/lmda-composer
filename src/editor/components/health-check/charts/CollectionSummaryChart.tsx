import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SectionCard } from '../SectionCard';
import { BarChart3 } from 'lucide-react';
import { SuccessIcon } from '../../../constants/icons';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { CollectionSummaryItem } from '../types';

interface CollectionSummaryChartProps {
  data: CollectionSummaryItem[];
}

// Direct color values for charts - works in both light and dark mode
const COLORS = [
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

interface ChartDataItem {
  name: string;
  threads: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }> }) {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover p-2 shadow-md">
      <p className="text-sm font-medium text-popover-foreground">{data.name}</p>
      <p className="text-sm text-muted-foreground">{data.threads} threads</p>
    </div>
  );
}

export function CollectionSummaryChart({ data }: CollectionSummaryChartProps) {
  if (!data || data.length === 0) {
    return (
      <SectionCard title="Collection Summary" icon={<BarChart3 className="size-4" />}>
        <Empty className="h-64 border-none bg-transparent shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-muted/50">
            <SuccessIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">No collection data</EmptyTitle>
            <EmptyDescription className="text-xs">
              No failing collection threads detected.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  // Sort by threads descending and take top 10
  const chartData: ChartDataItem[] = [...data]
    .sort((a, b) => b.threads - a.threads)
    .slice(0, 10)
    .map(item => ({
      name: item.type.replace('collector.', '').replace('.', ' '),
      threads: item.threads,
    }));

  return (
    <SectionCard title="Failing Threads by Collection Type" icon={<BarChart3 className="size-4" />}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" stroke="currentColor" opacity={0.5} />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={120}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              stroke="currentColor"
              opacity={0.5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="threads" radius={[0, 4, 4, 0]}>
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
