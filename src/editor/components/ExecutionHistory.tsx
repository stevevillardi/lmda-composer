import { useEffect } from 'react';
import {
  Clock,
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  FileCode,
  Server,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ExecutionHistoryEntry } from '@/shared/types';

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function getModeLabel(mode: string): string {
  switch (mode) {
    case 'ad': return 'AD';
    case 'collection': return 'Collection';
    case 'batchcollection': return 'Batch';
    case 'freeform': return 'Freeform';
    default: return mode;
  }
}

interface HistoryItemProps {
  entry: ExecutionHistoryEntry;
  onReload: () => void;
}

function HistoryItem({ entry, onReload }: HistoryItemProps) {
  return (
    <div 
      className="group p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {entry.status === 'success' ? (
            <CheckCircle2 className="size-4 text-green-500 shrink-0" />
          ) : (
            <XCircle className="size-4 text-red-500 shrink-0" />
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {entry.hostname || 'No hostname'}
              </span>
              <Badge variant="secondary" className="text-xs shrink-0">
                {entry.language === 'groovy' ? 'Groovy' : 'PowerShell'}
              </Badge>
              <Badge variant="outline" className="text-xs shrink-0">
                {getModeLabel(entry.mode)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Server className="size-3" />
              <span className="truncate">{entry.collector}</span>
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={onReload}
        >
          <Play className="size-3 mr-1" />
          Load
        </Button>
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="size-3" />
          <span>{formatTimestamp(entry.timestamp)}</span>
        </div>
        <span>•</span>
        <span>{formatDuration(entry.duration)}</span>
        {entry.output && (
          <>
            <span>•</span>
            <span>{entry.output.split('\n').length} lines</span>
          </>
        )}
      </div>

      {entry.output && (
        <div className="mt-2 p-2 rounded bg-muted/50 font-mono text-xs text-muted-foreground max-h-20 overflow-hidden">
          <pre className="whitespace-pre-wrap break-all line-clamp-3">
            {entry.output.slice(0, 200)}
            {entry.output.length > 200 && '...'}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ExecutionHistory() {
  const {
    executionHistoryOpen,
    setExecutionHistoryOpen,
    executionHistory,
    loadHistory,
    clearHistory,
    reloadFromHistory,
  } = useEditorStore();

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleReload = (entry: ExecutionHistoryEntry) => {
    reloadFromHistory(entry);
  };

  return (
    <Sheet open={executionHistoryOpen} onOpenChange={setExecutionHistoryOpen}>
      <SheetContent className="w-[450px] sm:w-[540px] px-2">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileCode className="size-5" />
            Execution History
          </SheetTitle>
          <SheetDescription>
            View and reload previous script executions.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">
            {executionHistory.length} execution{executionHistory.length !== 1 ? 's' : ''}
          </span>
          {executionHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <Separator />

        <ScrollArea className="h-[calc(100vh-220px)] mt-4 -ml-2">
          {executionHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground pl-2">
              <Clock className="size-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">No execution history</p>
              <p className="text-xs mt-1">
                Run a script to see it appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pl-2 pr-4">
              {executionHistory.map((entry) => (
                <HistoryItem 
                  key={entry.id} 
                  entry={entry} 
                  onReload={() => handleReload(entry)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

