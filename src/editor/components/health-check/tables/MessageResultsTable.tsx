import { SectionCard } from '../SectionCard';
import { MessageSquare, CheckCircle } from 'lucide-react';
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
import type { TopMessages } from '../types';

interface MessageResultsTableProps {
  data: TopMessages;
}

export function MessageResultsTable({ data }: MessageResultsTableProps) {
  const hasData = data.tlist.length > 0 || data.adlist.length > 0 || data.tplist.length > 0;

  if (!hasData) {
    return (
      <SectionCard title="Top Message Results" icon={<MessageSquare className="size-4" />}>
        <div className="flex items-center justify-center py-8 text-muted-foreground select-none">
          <CheckCircle className="size-5 mr-2 text-green-500" />
          <span className="text-sm">No error messages detected</span>
        </div>
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
        <TabsList>
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
      <div className="flex items-center justify-center py-8 text-muted-foreground select-none">
        <CheckCircle className="size-4 mr-2 text-green-500" />
        <span className="text-sm">No messages</span>
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Count</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="tabular-nums font-medium">{item.count}</TableCell>
              <TableCell className="text-sm font-mono max-w-md">
                <Tooltip>
                  <TooltipTrigger className="block truncate cursor-default text-left">
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

