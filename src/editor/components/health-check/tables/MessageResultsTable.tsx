import { SectionCard } from '../SectionCard';
import { MessageSquare } from 'lucide-react';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { SuccessIcon } from '../../../constants/icons';
import type { TopMessages } from '../types';

interface MessageResultsTableProps {
  data: TopMessages;
}

export function MessageResultsTable({ data }: MessageResultsTableProps) {
  const hasData = data.tlist.length > 0 || data.adlist.length > 0 || data.tplist.length > 0;

  if (!hasData) {
    return (
      <SectionCard title="Top Message Results" icon={<MessageSquare className="size-4" />}>
        <Empty className="border-none bg-transparent py-6 shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-teal-500/10">
            <SuccessIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">No error messages</EmptyTitle>
            <EmptyDescription className="text-xs">
              All tasks completed without errors.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="Top Message Results" 
      icon={<MessageSquare className="size-4" />}
      collapsible
    >
      <Tabs defaultValue="tlist" className="w-full">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="tlist" className="gap-2">
            tlist
            <Badge variant="secondary" className="text-xs select-none">{data.tlist.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="adlist" className="gap-2">
            adlist
            <Badge variant="secondary" className="text-xs select-none">{data.adlist.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tplist" className="gap-2">
            tplist
            <Badge variant="secondary" className="text-xs select-none">{data.tplist.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tlist" className="mt-4">
          <MessageTable messages={data.tlist} />
        </TabsContent>

        <TabsContent value="adlist" className="mt-4">
          <MessageTable messages={data.adlist} />
        </TabsContent>

        <TabsContent value="tplist" className="mt-4">
          <MessageTable messages={data.tplist} />
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}

function MessageTable({ messages }: { messages: { message: string; count: number }[] }) {
  if (messages.length === 0) {
    return (
      <Empty className="border-none bg-transparent py-6 shadow-none">
        <EmptyMedia variant="icon" className="mx-auto mb-3 bg-teal-500/10">
          <SuccessIcon className="size-4" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-sm font-medium">No messages</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-20">Count</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium tabular-nums">{item.count}</TableCell>
              <TableCell className="max-w-md font-mono text-sm">
                <Tooltip>
                  <TooltipTrigger className="
                    block cursor-default truncate text-left
                  ">
                    {item.message}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-lg">
                    <p className="font-mono text-xs break-all">{item.message}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
