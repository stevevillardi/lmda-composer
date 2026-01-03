import { SectionCard } from '../SectionCard';
import { Server, Info } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { HostStatItem } from '../types';

interface HostStatsTableProps {
  data: HostStatItem[];
}

export function HostStatsTable({ data }: HostStatsTableProps) {
  if (!data || data.length === 0) {
    return (
      <SectionCard title="Devices by Task Count" icon={<Server className="size-4" />}>
        <div className="flex items-center justify-center py-8 text-muted-foreground select-none">
          <Info className="size-5 mr-2 opacity-50" />
          <span className="text-sm">No host data available</span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="Devices by Task Count" 
      icon={<Server className="size-4" />}
      collapsible
    >
      <div className="max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hostname</TableHead>
              <TableHead className="text-right">Data Tasks</TableHead>
              <TableHead className="text-right">Event Tasks</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-mono text-sm max-w-[200px]">
                  <Tooltip>
                    <TooltipTrigger className="block truncate cursor-default text-left">
                      {item.host}
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-mono text-xs">{item.host}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.dataTask}</TableCell>
                <TableCell className="text-right tabular-nums">{item.eventTask}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {item.dataTask + item.eventTask}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

