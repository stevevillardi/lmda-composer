import { SectionCard } from '../SectionCard';
import { Cpu } from 'lucide-react';
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
import type { ProcessItem } from '../types';

interface ProcessListTableProps {
  data: ProcessItem[];
}

function formatMemory(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
}

export function ProcessListTable({ data }: ProcessListTableProps) {
  if (!data || data.length === 0) {
    return (
      <SectionCard title="Process List" icon={<Cpu className="size-4" />}>
        <Empty className="border-none bg-transparent py-6 shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-muted/50">
            <InfoIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">No process data</EmptyTitle>
            <EmptyDescription className="text-xs">
              Process information will appear here when available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  // Detect if Windows or Linux based on data structure
  const isWindows = data[0]?.name !== undefined;

  return (
    <SectionCard 
      title="Process List" 
      icon={<Cpu className="size-4" />}
      collapsible
    >
      <div className="max-h-80 overflow-auto rounded-lg border border-border/50">
        {isWindows ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Process Name</TableHead>
                <TableHead className="text-right">PID</TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="text-right">Memory</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">{item.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.pid}</TableCell>
                  <TableCell>{item.sessionName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMemory(item.memUsageKB)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right">PID</TableHead>
                <TableHead>TTY</TableHead>
                <TableHead>STAT</TableHead>
                <TableHead>TIME</TableHead>
                <TableHead>Command</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="text-right tabular-nums">{item.pid}</TableCell>
                  <TableCell>{item.tty}</TableCell>
                  <TableCell>{item.stat}</TableCell>
                  <TableCell>{item.time}</TableCell>
                  <TableCell className="max-w-xs font-mono text-sm">
                    <Tooltip>
                      <TooltipTrigger className="
                        block cursor-default truncate text-left
                      ">
                        {item.command}
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-lg">
                        <p className="font-mono text-xs break-all">{item.command}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </SectionCard>
  );
}
