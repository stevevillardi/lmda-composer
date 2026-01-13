import { useState } from 'react';
import { FileText, Copy, Check } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InfoIcon } from '../../../constants/icons';
import { clipboardToasts } from '../../../utils/toast-utils';
import type { Logs } from '../types';

interface LogsViewerProps {
  logs: Logs;
}

export function LogsViewer({ logs }: LogsViewerProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const copyLogs = async (lines: string[], tabName: string) => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedTab(tabName);
      clipboardToasts.copied(`${tabName} logs`);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch {
      clipboardToasts.copyFailed('logs');
    }
  };

  const hasLogs = logs.wrapper.length > 0 || logs.sbproxy.length > 0 || logs.watchdog.length > 0;

  if (!hasLogs) {
    return (
      <SectionCard title="Collector Logs" icon={<FileText className="size-4" />}>
        <Empty className="border-none bg-transparent py-6 shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-muted/50">
            <InfoIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">No log data</EmptyTitle>
            <EmptyDescription className="text-xs">
              Collector logs will appear here when available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="Collector Logs" 
      icon={<FileText className="size-4" />}
      collapsible
    >
      <Tabs defaultValue="wrapper" className="w-full">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="wrapper" className="gap-2">
            wrapper.log
            <Badge variant="secondary" className="text-xs select-none">{logs.wrapper.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sbproxy" className="gap-2">
            sbproxy.log
            <Badge variant="secondary" className="text-xs select-none">{logs.sbproxy.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="watchdog" className="gap-2">
            watchdog.log
            <Badge variant="secondary" className="text-xs select-none">{logs.watchdog.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wrapper" className="mt-4">
          <LogTab 
            lines={logs.wrapper} 
            name="wrapper"
            onCopy={() => copyLogs(logs.wrapper, 'wrapper')}
            isCopied={copiedTab === 'wrapper'}
          />
        </TabsContent>

        <TabsContent value="sbproxy" className="mt-4">
          <LogTab 
            lines={logs.sbproxy} 
            name="sbproxy"
            onCopy={() => copyLogs(logs.sbproxy, 'sbproxy')}
            isCopied={copiedTab === 'sbproxy'}
          />
        </TabsContent>

        <TabsContent value="watchdog" className="mt-4">
          <LogTab 
            lines={logs.watchdog} 
            name="watchdog"
            onCopy={() => copyLogs(logs.watchdog, 'watchdog')}
            isCopied={copiedTab === 'watchdog'}
          />
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}

function LogTab({ 
  lines, 
  name, 
  onCopy, 
  isCopied 
}: { 
  lines: string[]; 
  name: string;
  onCopy: () => void;
  isCopied: boolean;
}) {
  if (lines.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No {name} log entries
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onCopy}>
          {isCopied ? (
            <>
              <Check className="mr-1.5 size-3.5 text-teal-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 size-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      <ScrollArea className="
        h-64 rounded-lg border border-border/50 bg-muted/30 backdrop-blur-sm
      ">
        <pre className="p-3 font-mono text-xs">
          {lines.map((line, index) => (
            <div 
              key={index} 
              className={
                line.includes('[ERROR]') || line.includes('[WARN]') 
                  ? 'text-red-500' 
                  : line.includes('[INFO]') 
                    ? 'text-muted-foreground' 
                    : ''
              }
            >
              {line}
            </div>
          ))}
        </pre>
      </ScrollArea>
    </div>
  );
}
