import { SectionCard } from '../SectionCard';
import { ListTree } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { SuccessIcon } from '../../../constants/icons';
import type { AplistItem, SplistItem, AdlistItem, TplistItem } from '../types';

function EmptyTableState({ message }: { message: string }) {
  return (
    <Empty className="border-none bg-transparent py-6 shadow-none">
      <EmptyMedia variant="icon" className="mx-auto mb-3 bg-teal-500/10">
        <SuccessIcon className="size-4" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle className="text-sm font-medium">{message}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

/** Wrapper for truncated text with tooltip */
function TruncatedCell({ value, className }: { value: string; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  
  return (
    <Tooltip>
      <TooltipTrigger className={`
        block cursor-default truncate text-left
        ${className || ''}
      `}>
        {value}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-lg">
        <p className="font-mono text-xs break-all">{value}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface TaskListTablesProps {
  aplist: AplistItem[];
  splist: SplistItem[];
  adlist: AdlistItem[];
  tplist: TplistItem[];
}

export function TaskListTables({ aplist, splist, adlist, tplist }: TaskListTablesProps) {
  const hasData = aplist.length > 0 || splist.length > 0 || adlist.length > 0 || tplist.length > 0;

  if (!hasData) {
    return (
      <SectionCard title="Task Lists" icon={<ListTree className="size-4" />}>
        <Empty className="border-none bg-transparent py-6 shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-teal-500/10">
            <SuccessIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">All tasks completed successfully</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="Task Lists" 
      icon={<ListTree className="size-4" />}
      collapsible
    >
      <Tabs defaultValue="adlist" className="w-full">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="adlist" className="gap-2">
            adlist
            <Badge variant="secondary" className="text-xs select-none">{adlist.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="splist" className="gap-2">
            splist
            <Badge variant="secondary" className="text-xs select-none">{splist.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tplist" className="gap-2">
            tplist
            <Badge variant="secondary" className="text-xs select-none">{tplist.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="aplist" className="gap-2">
            aplist
            <Badge variant="secondary" className="text-xs select-none">{aplist.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="adlist" className="mt-4">
          <AdlistTable data={adlist} />
        </TabsContent>

        <TabsContent value="splist" className="mt-4">
          <SplistTable data={splist} />
        </TabsContent>

        <TabsContent value="tplist" className="mt-4">
          <TplistTable data={tplist} />
        </TabsContent>

        <TabsContent value="aplist" className="mt-4">
          <AplistTable data={aplist} />
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}

function AdlistTable({ data }: { data: AdlistItem[] }) {
  if (data.length === 0) {
    return <EmptyTableState message="No active discovery issues" />;
  }

  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Hostname</TableHead>
            <TableHead>DataSource</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Exec Time</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-sm">{item.hostname}</TableCell>
              <TableCell className="text-sm">{item.datasource}</TableCell>
              <TableCell>
                <Badge variant={item.status === 'OK' ? 'default' : 'destructive'} className="
                  select-none
                ">
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.execTime}ms</TableCell>
              <TableCell className="max-w-xs text-sm">
                <TruncatedCell value={item.message} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SplistTable({ data }: { data: SplistItem[] }) {
  if (data.length === 0) {
    return <EmptyTableState message="No property source issues" />;
  }

  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Hostname</TableHead>
            <TableHead>Property Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Elapsed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-sm">{item.hostname}</TableCell>
              <TableCell className="text-sm">{item.propertySource}</TableCell>
              <TableCell>
                <Badge variant={item.status === 'DONE' ? 'default' : 'destructive'} className="
                  select-none
                ">
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.elapsed}ms</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TplistTable({ data }: { data: TplistItem[] }) {
  if (data.length === 0) {
    return <EmptyTableState message="No topology issues" />;
  }

  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Hostname</TableHead>
            <TableHead>DataSource</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Exec Time</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-sm">{item.hostname}</TableCell>
              <TableCell className="text-sm">{item.datasource}</TableCell>
              <TableCell>
                <Badge variant={item.status === 'OK' ? 'default' : 'destructive'} className="
                  select-none
                ">
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.execTime}ms</TableCell>
              <TableCell className="max-w-xs text-sm">
                <TruncatedCell value={item.message} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AplistTable({ data }: { data: AplistItem[] }) {
  if (data.length === 0) {
    return <EmptyTableState message="No auto props issues" />;
  }

  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Host</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Exec Time</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-sm">{item.host}</TableCell>
              <TableCell className="text-sm">{item.type}</TableCell>
              <TableCell>
                <Badge variant={item.status === 'DONE' ? 'default' : 'destructive'} className="
                  select-none
                ">
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.execMs}ms</TableCell>
              <TableCell className="max-w-xs text-sm">
                <TruncatedCell value={item.message} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
