import { SectionCard } from '../SectionCard';
import { Server } from 'lucide-react';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InfoIcon } from '../../../constants/icons';
import type { HostStatItem } from '../types';

interface HostStatsTableProps {
  data: HostStatItem[];
}

export function HostStatsTable({ data }: HostStatsTableProps) {
  if (!data || data.length === 0) {
    return (
      <SectionCard title="Devices by Task Count" icon={<Server className="size-4" />}>
        <Empty className="border-none bg-transparent py-6 shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-muted/50">
            <InfoIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">No host data</EmptyTitle>
            <EmptyDescription className="text-xs">
              Device statistics will appear here when available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="Devices by Task Count" 
      icon={<Server className="size-4" />}
      collapsible
    >
      <div className="max-h-80 overflow-auto rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Hostname</TableHead>
              <TableHead className="text-right">Data Tasks</TableHead>
              <TableHead className="text-right">Event Tasks</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="max-w-[200px] font-mono text-sm">
                  <Tooltip>
                    <TooltipTrigger className="
                      block cursor-default truncate text-left
                    ">
                      {item.host}
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-mono text-xs">{item.host}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.dataTask}</TableCell>
                <TableCell className="text-right tabular-nums">{item.eventTask}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
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
