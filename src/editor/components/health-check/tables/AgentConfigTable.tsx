import { SectionCard } from '../SectionCard';
import { Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InfoIcon } from '../../../constants/icons';
import { cn } from '@/lib/utils';
import type { AgentConfigItem, DefaultConfigItem } from '../types';

interface AgentConfigTableProps {
  currentConfig: AgentConfigItem[];
  defaultConfig: DefaultConfigItem[];
  collectorSize: string;
}

const SIZE_INDEX: Record<string, number> = {
  Small: 0,
  Medium: 1,
  Large: 2,
  XL: 3,
  XXL: 4,
};

export function AgentConfigTable({ currentConfig, defaultConfig, collectorSize }: AgentConfigTableProps) {
  const sizeIndex = SIZE_INDEX[collectorSize] ?? 1;

  // Build a lookup for default values
  const defaultLookup = new Map<string, { timeout: number; threadpool: number }>();
  for (const item of defaultConfig) {
    defaultLookup.set(item.param, {
      timeout: item.timeout,
      threadpool: item.threadpools[sizeIndex],
    });
  }

  if (!currentConfig || currentConfig.length === 0) {
    return (
      <SectionCard title="Agent Configuration" icon={<Settings className="size-4" />}>
        <Empty className="border-none bg-transparent py-6 shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-muted/50">
            <InfoIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">No configuration data</EmptyTitle>
            <EmptyDescription className="text-xs">
              Agent configuration will appear here when available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="Agent Configuration (agent.conf)" 
      icon={<Settings className="size-4" />}
      collapsible
      headerAction={
        <Badge variant="secondary" className="select-none">{collectorSize}</Badge>
      }
    >
      <div className="max-h-80 overflow-auto rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Parameter</TableHead>
              <TableHead className="text-right">Threadpool</TableHead>
              <TableHead className="text-right">Timeout</TableHead>
              <TableHead className="text-right">Default TP</TableHead>
              <TableHead className="text-right">Default TO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentConfig.map((item, index) => {
              const defaults = defaultLookup.get(item.param);
              const tpDiff = defaults && item.threadpool !== null && item.threadpool !== defaults.threadpool;
              const toDiff = defaults && item.timeout !== null && item.timeout !== defaults.timeout;

              return (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">{item.param}</TableCell>
                  <TableCell className={cn(
                    "text-right tabular-nums",
                    tpDiff && "font-medium text-yellow-600"
                  )}>
                    {item.threadpool ?? '—'}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right tabular-nums",
                    toDiff && "font-medium text-yellow-600"
                  )}>
                    {item.timeout ?? '—'}
                  </TableCell>
                  <TableCell className="
                    text-right text-muted-foreground tabular-nums
                  ">
                    {defaults?.threadpool ?? '—'}
                  </TableCell>
                  <TableCell className="
                    text-right text-muted-foreground tabular-nums
                  ">
                    {defaults?.timeout ?? '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Yellow values indicate configuration differs from defaults for {collectorSize} collector.
      </p>
    </SectionCard>
  );
}
