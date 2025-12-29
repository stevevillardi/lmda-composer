import {
  Clock,
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  Server,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
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
    case 'ad': return 'Active Discovery';
    case 'collection': return 'Collection';
    case 'batchcollection': return 'Batch Collection';
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
      className="group p-2 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {entry.status === 'success' ? (
            <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          ) : (
            <XCircle className="size-3.5 text-red-500 shrink-0" />
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-xs truncate">
              {entry.hostname || 'No hostname'}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Server className="size-2.5" />
              <span className="truncate">{entry.collector}</span>
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-6 px-2 text-xs"
          onClick={onReload}
        >
          <Play className="size-3 mr-1" />
          Load
        </Button>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <Badge variant="secondary" className="text-[10px] h-4 px-1">
          {entry.language === 'groovy' ? 'Groovy' : 'PS'}
        </Badge>
        <Badge variant="outline" className="text-[10px] h-4 px-1">
          {getModeLabel(entry.mode)}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="size-2.5" />
          <span>{formatTimestamp(entry.timestamp)}</span>
        </div>
        <span>•</span>
        <span>{formatDuration(entry.duration)}</span>
      </div>

      {entry.output && (
        <div className="mt-1.5 p-1.5 rounded bg-muted/50 font-mono text-[10px] text-muted-foreground max-h-12 overflow-hidden">
          <pre className="whitespace-pre-wrap break-all line-clamp-2">
            {entry.output.slice(0, 100)}
            {entry.output.length > 100 && '...'}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ExecutionHistoryPanel() {
  const {
    executionHistory,
    clearHistory,
    reloadFromHistory,
  } = useEditorStore();

  const handleReload = (entry: ExecutionHistoryEntry) => {
    reloadFromHistory(entry);
  };

  // Empty state
  if (executionHistory.length === 0) {
    return (
      <Empty className="h-full border-0 flex items-center justify-center">
        <EmptyMedia variant="icon">
          <Clock />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No History</EmptyTitle>
          <EmptyDescription>
            Run a script to see it appear here
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with count and clear button */}
      <div className="flex items-center justify-between p-2 border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground">
          {executionHistory.length} execution{executionHistory.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearHistory}
          className="text-destructive hover:text-destructive h-6 px-2 text-xs"
        >
          <Trash2 className="size-3 mr-1" />
          Clear
        </Button>
      </div>

      {/* History list - scrollable */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex flex-col gap-2 p-2">
          {executionHistory.map((entry) => (
            <HistoryItem 
              key={entry.id} 
              entry={entry} 
              onReload={() => handleReload(entry)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

