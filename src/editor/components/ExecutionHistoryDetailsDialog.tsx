import { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Link, TestTubeDiagonal, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useEditorStore } from '../stores/editor-store';
import type { ExecutionHistoryEntry, LogicModuleType } from '@/shared/types';
import { formatDuration, formatTimestamp, getModeLabel } from './execution-history-utils';
import { buildMonacoOptions, getMonacoTheme } from '../utils/monaco-settings';
import {
  CollectionIcon,
  ConfigSourceIcon,
  EventSourceIcon,
  TopologySourceIcon,
  PropertySourceIcon,
  LogSourceIcon,
} from '../constants/icons';

// Import the loader config to use bundled Monaco (CSP-safe)
import '../monaco-loader';

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

/** Returns a human-readable label for module types */
function getModuleTypeLabel(moduleType: LogicModuleType): string {
  switch (moduleType) {
    case 'datasource': return 'DataSource';
    case 'configsource': return 'ConfigSource';
    case 'eventsource': return 'EventSource';
    case 'topologysource': return 'TopologySource';
    case 'propertysource': return 'PropertySource';
    case 'logsource': return 'LogSource';
    case 'diagnosticsource': return 'DiagnosticSource';
    default: return moduleType;
  }
}

interface ExecutionHistoryDetailsDialogProps {
  open: boolean;
  entry: ExecutionHistoryEntry | null;
  onOpenChange: (open: boolean) => void;
  onLoad: (entry: ExecutionHistoryEntry) => void;
}

export function ExecutionHistoryDetailsDialog({
  open,
  entry,
  onOpenChange,
  onLoad,
}: ExecutionHistoryDetailsDialogProps) {
  const { preferences } = useEditorStore();

  const monacoTheme = useMemo(() => getMonacoTheme(preferences), [preferences]);

  const scriptOptions = useMemo(() => buildMonacoOptions(preferences, {
    readOnly: true,
    fontSize: 12,
    lineNumbers: 'on',
    minimap: { enabled: false },
    wordWrap: 'off',
    tabSize: 2,
    renderLineHighlight: 'none',
    padding: { top: 8, bottom: 8 },
    domReadOnly: true,
    cursorStyle: 'line-thin',
    selectionHighlight: false,
    occurrencesHighlight: 'off',
    scrollbar: { horizontal: 'auto', vertical: 'auto' },
  }), [preferences]);

  const outputOptions = useMemo(() => buildMonacoOptions(preferences, {
    readOnly: true,
    fontSize: 12,
    lineNumbers: 'off',
    minimap: { enabled: false },
    wordWrap: 'on',
    tabSize: 2,
    renderLineHighlight: 'none',
    padding: { top: 8, bottom: 8 },
    domReadOnly: true,
    cursorStyle: 'line-thin',
    selectionHighlight: false,
    occurrencesHighlight: 'off',
    scrollbar: { horizontal: 'auto', vertical: 'auto' },
  }), [preferences]);

  const monacoLanguage = entry?.language === 'groovy' ? 'groovy' : 'powershell';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl! h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          {entry?.moduleSource ? (
            <>
              {/* Module-bound script header */}
              <DialogTitle className="text-base flex items-center gap-2">
                {(() => {
                  const ModuleIcon = getModuleTypeIcon(entry.moduleSource.moduleType);
                  return <ModuleIcon className="size-5" />;
                })()}
                {entry.moduleSource.moduleName}
                <Badge variant="outline" className="text-xs font-normal ml-1">
                  {entry.moduleSource.scriptType === 'ad' ? 'Active Discovery' : 'Collection'}
                </Badge>
              </DialogTitle>
              <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-1.5">
                  <Link className="size-3" />
                  <span>{entry.moduleSource.portalHostname}</span>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{getModuleTypeLabel(entry.moduleSource.moduleType)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TestTubeDiagonal className="size-3" />
                  <span>{entry.hostname || 'No hostname'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Server className="size-3" />
                  <span>via {entry.collector}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span>{getModeLabel(entry.mode)}</span>
                  <span>•</span>
                  <span>{formatTimestamp(entry.timestamp)}</span>
                  <span>•</span>
                  <span>{formatDuration(entry.duration)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Non-module script header */}
              <DialogTitle className="text-base">
                {entry?.tabDisplayName || entry?.hostname || 'No hostname'}
              </DialogTitle>
              {entry && (
                <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-1.5">
                    <TestTubeDiagonal className="size-3" />
                    <span>{entry.hostname || 'No hostname'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Server className="size-3" />
                    <span>via {entry.collector}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span>{getModeLabel(entry.mode)}</span>
                    <span>•</span>
                    <span>{formatTimestamp(entry.timestamp)}</span>
                    <span>•</span>
                    <span>{formatDuration(entry.duration)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogHeader>

        {entry && (
          <div className="flex-1 min-h-0 p-6 pt-4 flex flex-col gap-3 bg-muted/5">
            <Tabs defaultValue="script" className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <TabsList variant="line" className="h-8 bg-transparent p-0 gap-1 border-b border-border/40 w-full justify-start rounded-none">
                  <TabsTrigger 
                    value="script" 
                    className="h-8 text-xs px-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent hover:bg-muted/30 transition-colors"
                  >
                    Script
                  </TabsTrigger>
                  <TabsTrigger 
                    value="output" 
                    className="h-8 text-xs px-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent hover:bg-muted/30 transition-colors"
                  >
                    Output
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs px-3 ml-auto shrink-0"
                  onClick={() => onLoad(entry)}
                >
                  <Play className="size-3 mr-1.5" />
                  Load Into Editor
                </Button>
              </div>
              
              <TabsContent value="script" className="mt-3 flex-1 min-h-0">
                <div className="rounded-md border border-border bg-background/50 h-full overflow-hidden shadow-sm">
                  <Editor
                    height="100%"
                    language={monacoLanguage}
                    theme={monacoTheme}
                    value={entry.script}
                    options={scriptOptions}
                    loading={
                      <div className="flex items-center justify-center h-full">
                        <div className="text-muted-foreground text-xs">Loading...</div>
                      </div>
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="output" className="mt-3 flex-1 min-h-0">
                <div className="rounded-md border border-border bg-background/50 h-full overflow-hidden shadow-sm">
                  <Editor
                    height="100%"
                    language="plaintext"
                    theme={monacoTheme}
                    value={entry.output || 'No output captured.'}
                    options={outputOptions}
                    loading={
                      <div className="flex items-center justify-center h-full">
                        <div className="text-muted-foreground text-xs">Loading...</div>
                      </div>
                    }
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
