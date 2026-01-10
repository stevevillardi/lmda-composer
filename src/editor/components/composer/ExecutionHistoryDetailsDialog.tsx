import { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Link, TestTubeDiagonal, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useEditorStore } from '../../stores/editor-store';
import type { ExecutionHistoryEntry, LogicModuleType } from '@/shared/types';
import { formatDuration, formatTimestamp, getModeLabel } from '../../utils/execution-history-utils';
import { buildMonacoOptions, getMonacoTheme } from '../../utils/monaco-settings';
import {
  CollectionIcon,
  ConfigSourceIcon,
  EventSourceIcon,
  TopologySourceIcon,
  PropertySourceIcon,
  LogSourceIcon,
} from '../../constants/icons';

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
      <DialogContent className="flex h-[80vh] max-w-5xl! flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          {entry?.moduleSource ? (
            <>
              {/* Module-bound script header */}
              <DialogTitle className="flex items-center gap-2 text-base">
                {(() => {
                  const ModuleIcon = getModuleTypeIcon(entry.moduleSource.moduleType);
                  return <ModuleIcon className="size-5" />;
                })()}
                {entry.moduleSource.moduleName}
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {entry.moduleSource.scriptType === 'ad' ? 'Active Discovery' : 'Collection'}
                </Badge>
              </DialogTitle>
              <div className="
                mt-2 flex flex-col gap-1 text-xs text-muted-foreground
              ">
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
                <div className="mt-1 flex items-center gap-2">
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
                <div className="
                  mt-2 flex flex-col gap-1 text-xs text-muted-foreground
                ">
                  <div className="flex items-center gap-1.5">
                    <TestTubeDiagonal className="size-3" />
                    <span>{entry.hostname || 'No hostname'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Server className="size-3" />
                    <span>via {entry.collector}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
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
          <div className="
            flex min-h-0 flex-1 flex-col gap-3 bg-muted/5 p-6 pt-4
          ">
            <Tabs defaultValue="script" className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <TabsList variant="line" className="
                  h-8 w-full justify-start gap-1 rounded-none border-b
                  border-border/40 bg-transparent p-0
                ">
                  <TabsTrigger 
                    value="script" 
                    className="
                      h-8 rounded-none bg-transparent px-3 text-xs
                      transition-colors
                      hover:bg-muted/30
                      data-[state=active]:border-b-2
                      data-[state=active]:border-primary
                      data-[state=active]:shadow-none
                    "
                  >
                    Script
                  </TabsTrigger>
                  <TabsTrigger 
                    value="output" 
                    className="
                      h-8 rounded-none bg-transparent px-3 text-xs
                      transition-colors
                      hover:bg-muted/30
                      data-[state=active]:border-b-2
                      data-[state=active]:border-primary
                      data-[state=active]:shadow-none
                    "
                  >
                    Output
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="default"
                  size="sm"
                  className="ml-auto h-7 shrink-0 px-3 text-xs"
                  onClick={() => onLoad(entry)}
                >
                  <Play className="mr-1.5 size-3" />
                  Load Into Editor
                </Button>
              </div>
              
              <TabsContent value="script" className="mt-3 min-h-0 flex-1">
                <div className="
                  h-full overflow-hidden rounded-md border border-border
                  bg-background/50 shadow-sm
                ">
                  <Editor
                    height="100%"
                    language={monacoLanguage}
                    theme={monacoTheme}
                    value={entry.script}
                    options={scriptOptions}
                    loading={
                      <div className="flex h-full items-center justify-center">
                        <div className="text-xs text-muted-foreground">Loading...</div>
                      </div>
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="output" className="mt-3 min-h-0 flex-1">
                <div className="
                  h-full overflow-hidden rounded-md border border-border
                  bg-background/50 shadow-sm
                ">
                  <Editor
                    height="100%"
                    language="plaintext"
                    theme={monacoTheme}
                    value={entry.output || 'No output captured.'}
                    options={outputOptions}
                    loading={
                      <div className="flex h-full items-center justify-center">
                        <div className="text-xs text-muted-foreground">Loading...</div>
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
