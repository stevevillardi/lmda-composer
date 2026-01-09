import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SectionCard } from '../SectionCard';
import { Package, CheckCircle } from 'lucide-react';
import type { TopModuleItem } from '../types';

interface TopModulesChartProps {
  data: TopModuleItem[];
}

// Direct color values for charts - works in both light and dark mode
const COLORS = [
  '#3b82f6', // blue-500
  '#22c55e', // green-500
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
  fullName: string;
  devices: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }> }) {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-md p-2 shadow-md">
      <p className="text-sm font-medium text-popover-foreground">{data.fullName}</p>
      <p className="text-sm text-muted-foreground">{data.devices} devices</p>
    </div>
  );
}

export function TopModulesChart({ data }: TopModulesChartProps) {
  if (!data || data.length === 0) {
    return (
      <SectionCard title="Top Failing Modules" icon={<Package className="size-4" />}>
        <div className="flex items-center justify-center py-8 text-muted-foreground select-none">
          <CheckCircle className="size-5 mr-2 text-teal-500" />
          <span className="text-sm">No failing modules detected</span>
        </div>
      </SectionCard>
    );
  }

  // Take top 10
  const chartData: ChartDataItem[] = data.slice(0, 10).map(item => ({
    name: item.module.length > 25 ? item.module.slice(0, 25) + '...' : item.module,
    fullName: item.module,
    devices: item.deviceCount,
  }));

  return (
    <SectionCard title="Top Failing Modules" icon={<Package className="size-4" />}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" stroke="currentColor" opacity={0.5} />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={150}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              stroke="currentColor"
              opacity={0.5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="devices" radius={[0, 4, 4, 0]}>
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
