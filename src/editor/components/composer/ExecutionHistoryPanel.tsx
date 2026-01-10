import {
  Clock,
  Play,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Server,
  Link,
  SquareTerminal,
  TestTubeDiagonal,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { useState } from 'react';
import { useEditorStore } from '../../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ExecutionHistoryEntry, LogicModuleType } from '@/shared/types';
import { ExecutionHistoryDetailsDialog } from './ExecutionHistoryDetailsDialog';
import { formatDuration, formatTimestamp, getModeLabel } from '../../utils/execution-history-utils';
import {
  CollectionIcon,
  ConfigSourceIcon,
  EventSourceIcon,
  TopologySourceIcon,
  PropertySourceIcon,
  LogSourceIcon,
} from '../../constants/icons';
import { cn } from '@/lib/utils';

/** Returns the appropriate module type icon component for a given LogicModuleType */
function getModuleTypeIcon(moduleType: LogicModuleType) {
  switch (moduleType) {
    case 'datasource':
      return CollectionIcon;
    case 'configsource':
      return ConfigSourceIcon;
    case 'eventsource':
      return EventSourceIcon;
    case 'topologysource':
      return TopologySourceIcon;
    case 'propertysource':
      return PropertySourceIcon;
    case 'logsource':
      return LogSourceIcon;
    default:
      return CollectionIcon;
  }
}

interface HistoryItemProps {
  entry: ExecutionHistoryEntry;
  onReload: () => void;
  onView: () => void;
}

function HistoryItem({ entry, onReload, onView }: HistoryItemProps) {
  const isModuleBound = !!entry.moduleSource;
  const ModuleIcon = isModuleBound ? getModuleTypeIcon(entry.moduleSource!.moduleType) : null;
  
  // Primary display name: module name for module-bound, tab display name for others
  const primaryName = isModuleBound
    ? entry.moduleSource!.moduleName
    : entry.tabDisplayName || entry.hostname || 'Untitled';
  
  const isSuccess = entry.status === 'success';

  return (
    <div 
      className={cn(
        `
          group relative overflow-hidden rounded-lg border p-3 transition-all
          duration-200 select-none
        `,
        `
          bg-card/40 backdrop-blur-sm
          hover:shadow-sm
        `,
        isSuccess 
          ? `
            border-border/50
            hover:border-teal-500/30
          ` 
          : `
            border-destructive/20 bg-destructive/5
            hover:border-destructive/40
          `
      )}
    >
      {/* Status Indicator Bar */}
      <div className={cn(
        "absolute top-0 bottom-0 left-0 w-1 transition-colors",
        isSuccess ? `
          bg-teal-500/50
          group-hover:bg-teal-500
        ` : `
          bg-destructive/50
          group-hover:bg-destructive
        `
      )} />

      {/* Row 1: Primary identifier + actions */}
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="flex min-w-0 items-center gap-2">
          {isModuleBound && ModuleIcon ? (
            <ModuleIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <SquareTerminal className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-xs font-medium text-foreground">
            {primaryName}
          </span>
        </div>
        
        <div className="
          flex shrink-0 items-center gap-1 opacity-0 transition-opacity
          group-hover:opacity-100
        ">
          <Button
            variant="ghost"
            size="sm"
            className="
              h-6 px-2 text-[10px]
              hover:bg-background/80
            "
            onClick={onView}
          >
            <Eye className="mr-1 size-3" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="
              h-6 px-2 text-[10px]
              hover:bg-background/80
            "
            onClick={onReload}
          >
            <Play className="mr-1 size-3" />
            Load
          </Button>
        </div>
      </div>

      {/* Row 2: Execution context (hostname) */}
      <div className="
        mt-1.5 flex items-center gap-1.5 pl-2 text-[10px] text-muted-foreground
      ">
        <TestTubeDiagonal className="size-3 shrink-0 opacity-70" />
        <span className="truncate font-mono">{entry.hostname || 'No hostname'}</span>
      </div>

      {/* Row 3: Collector */}
      <div className="
        mt-0.5 flex items-center gap-1.5 pl-2 text-[10px] text-muted-foreground
      ">
        <Server className="size-3 shrink-0 opacity-70" />
        <span className="truncate">via {entry.collector}</span>
      </div>

      {/* Row 4: Metadata badges */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-2">
        {isModuleBound && (
          <Badge variant="outline" className="
            h-4 gap-1 bg-background/50 px-1 text-[10px] font-normal
          ">
            <Link className="size-2.5 opacity-70" />
            {entry.moduleSource!.portalHostname}
          </Badge>
        )}
        <Badge variant="secondary" className="
          h-4 px-1.5 text-[10px] font-normal
        ">
          {entry.language === 'groovy' ? 'Groovy' : 'PS'}
        </Badge>
        <Badge variant="outline" className="
          h-4 bg-background/50 px-1.5 text-[10px] font-normal
        ">
          {getModeLabel(entry.mode)}
        </Badge>
      </div>

      {/* Row 5: Timestamp & Status */}
      <div className="
        mt-2 flex items-center justify-between border-t border-border/30 pt-2
        pl-2 text-[10px] text-muted-foreground
      ">
        <div className="flex items-center gap-1">
          <Clock className="size-3 opacity-70" />
          <span>{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{formatDuration(entry.duration)}</span>
          {isSuccess ? (
            <CheckCircle2 className="size-3 text-teal-500" />
          ) : (
            <XCircle className="size-3 text-destructive" />
          )}
        </div>
      </div>

      {entry.output && (
        <div className="
          mt-2 ml-2 max-h-16 overflow-hidden rounded-md border border-border/20
          bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground
        ">
          <pre className="line-clamp-3 break-all whitespace-pre-wrap">
            {entry.output.slice(0, 150)}
            {entry.output.length > 150 && '...'}
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
    reloadFromHistoryWithoutBinding,
    portals,
    selectedPortalId,
    switchToPortalWithContext,
  } = useEditorStore();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ExecutionHistoryEntry | null>(null);
  const [portalMismatchEntry, setPortalMismatchEntry] = useState<ExecutionHistoryEntry | null>(null);

  const handleReload = (entry: ExecutionHistoryEntry) => {
    // Check if this is a module-bound entry with a portal mismatch
    if (entry.moduleSource) {
      const boundPortalId = entry.moduleSource.portalId;
      
      // If portal doesn't match current selection, show confirmation dialog
      if (selectedPortalId !== boundPortalId) {
        setPortalMismatchEntry(entry);
        return;
      }
    }
    
    // No mismatch or not module-bound, load directly
    reloadFromHistory(entry);
  };

  const handleSwitchAndLoad = async () => {
    if (!portalMismatchEntry?.moduleSource) return;
    
    // Switch to the bound portal and restore collector/hostname from history entry
    await switchToPortalWithContext(portalMismatchEntry.moduleSource.portalId, {
      collectorId: portalMismatchEntry.collectorId,
      hostname: portalMismatchEntry.hostname,
    });
    
    // Load the entry with binding intact
    reloadFromHistory(portalMismatchEntry);
    setPortalMismatchEntry(null);
  };

  const handleLoadWithoutBinding = () => {
    if (!portalMismatchEntry) return;
    
    // Load as a local file (without module binding)
    reloadFromHistoryWithoutBinding(portalMismatchEntry);
    setPortalMismatchEntry(null);
  };

  const handleView = (entry: ExecutionHistoryEntry) => {
    setSelectedEntry(entry);
    setDetailsOpen(true);
  };
  
  // Check if the bound portal is available
  const mismatchPortal = portalMismatchEntry?.moduleSource
    ? portals.find(p => p.id === portalMismatchEntry.moduleSource!.portalId && p.status === 'active')
    : null;
  const canSwitchPortal = !!mismatchPortal;

  // Empty state
  if (executionHistory.length === 0) {
    return (
      <div className="flex h-full flex-col bg-muted/5">
        <Empty className="
          flex h-full flex-col justify-center border-0 bg-transparent
        ">
          <EmptyMedia variant="icon" className="mb-4 bg-muted/50">
            <Clock className="size-5 text-muted-foreground/70" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-base font-medium">No History</EmptyTitle>
            <EmptyDescription className="mt-1.5">
              Run a script to see it appear here
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-muted/5">
      {/* Header with count and clear button */}
      <div className="
        flex shrink-0 items-center justify-between border-b border-border
        bg-background p-3
      ">
        <span className="text-xs font-medium text-muted-foreground">
          {executionHistory.length} execution{executionHistory.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearHistory}
          className="
            h-7 px-2.5 text-xs text-destructive
            hover:bg-destructive/10 hover:text-destructive
          "
        >
          <Trash2 className="mr-1.5 size-3.5" />
          Clear
        </Button>
      </div>

      {/* History list - scrollable */}
      <div className="min-h-0 flex-1 overflow-auto bg-muted/5">
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
      
      {/* Portal Mismatch Dialog */}
      <AlertDialog open={!!portalMismatchEntry} onOpenChange={(open) => !open && setPortalMismatchEntry(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Portal Mismatch</AlertDialogTitle>
            <AlertDialogDescription>
              This script was executed on <strong>{portalMismatchEntry?.moduleSource?.portalHostname}</strong>, 
              but you're currently connected to a different portal.
              {canSwitchPortal 
                ? ' Would you like to switch portals or load without the module binding?'
                : ' The original portal is not available. You can load this as a local script.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {canSwitchPortal && (
              <AlertDialogAction onClick={handleSwitchAndLoad} className="gap-2">
                <RefreshCw className="size-4" />
                Switch Portal
              </AlertDialogAction>
            )}
            <AlertDialogAction onClick={handleLoadWithoutBinding} variant="secondary" className="
              gap-2
            ">
              <FileCode className="size-4" />
              Load as Local
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
