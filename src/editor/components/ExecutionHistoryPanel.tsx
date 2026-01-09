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
import { useEditorStore } from '../stores/editor-store';
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
import { formatDuration, formatTimestamp, getModeLabel } from './execution-history-utils';
import {
  CollectionIcon,
  ConfigSourceIcon,
  EventSourceIcon,
  TopologySourceIcon,
  PropertySourceIcon,
  LogSourceIcon,
} from '../constants/icons';

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
  
  return (
    <div 
      className="group p-2 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-colors select-none"
    >
      {/* Row 1: Primary identifier + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {entry.status === 'success' ? (
            <CheckCircle2 className="size-3.5 text-teal-500 shrink-0" />
          ) : (
            <XCircle className="size-3.5 text-red-500 shrink-0" />
          )}
          {isModuleBound && ModuleIcon ? (
            <ModuleIcon className="size-3.5 shrink-0" />
          ) : (
            <SquareTerminal className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="font-medium text-xs truncate">
            {primaryName}
          </span>
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

      {/* Row 2: Execution context (hostname) */}
      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
        <TestTubeDiagonal className="size-2.5 shrink-0" />
        <span className="truncate">{entry.hostname || 'No hostname'}</span>
      </div>

      {/* Row 3: Collector */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Server className="size-2.5 shrink-0" />
        <span className="truncate">via {entry.collector}</span>
      </div>

      {/* Row 4: Metadata badges (portal link for module-bound, language, mode) */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {isModuleBound && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
            <Link className="size-2.5" />
            {entry.moduleSource!.portalHostname}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] h-4 px-1">
          {entry.language === 'groovy' ? 'Groovy' : 'PS'}
        </Badge>
        <Badge variant="outline" className="text-[10px] h-4 px-1">
          {getModeLabel(entry.mode)}
        </Badge>
      </div>

      {/* Row 5: Timestamp */}
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
            <AlertDialogAction onClick={handleLoadWithoutBinding} variant="secondary" className="gap-2">
              <FileCode className="size-4" />
              Load as Local
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
