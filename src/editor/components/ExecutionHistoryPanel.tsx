import {
  Clock,
  Play,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Server,
} from 'lucide-react';
import { useState } from 'react';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { ExecutionHistoryEntry } from '@/shared/types';
import { ExecutionHistoryDetailsDialog } from './ExecutionHistoryDetailsDialog';
import { formatDuration, formatTimestamp, getModeLabel } from './execution-history-utils';

interface HistoryItemProps {
  entry: ExecutionHistoryEntry;
  onReload: () => void;
  onView: () => void;
}

function HistoryItem({ entry, onReload, onView }: HistoryItemProps) {
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
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onView}
          >
            <Eye className="size-3 mr-1" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onReload}
          >
            <Play className="size-3 mr-1" />
            Load
          </Button>
        </div>
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ExecutionHistoryEntry | null>(null);

  const handleReload = (entry: ExecutionHistoryEntry) => {
    reloadFromHistory(entry);
  };

  const handleView = (entry: ExecutionHistoryEntry) => {
    setSelectedEntry(entry);
    setDetailsOpen(true);
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
              onView={() => handleView(entry)}
            />
          ))}
        </div>
      </div>
      <ExecutionHistoryDetailsDialog
        open={detailsOpen}
        entry={selectedEntry}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedEntry(null);
        }}
        onLoad={handleReload}
      />
    </div>
  );
}
