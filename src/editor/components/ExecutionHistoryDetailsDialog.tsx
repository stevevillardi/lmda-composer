import { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEditorStore } from '../stores/editor-store';
import type { ExecutionHistoryEntry } from '@/shared/types';
import { formatDuration, formatTimestamp, getModeLabel } from './execution-history-utils';

// Import the loader config to use bundled Monaco (CSP-safe)
import '../monaco-loader';

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

  const monacoTheme = useMemo(() => {
    if (preferences.theme === 'light') return 'vs';
    if (preferences.theme === 'dark') return 'vs-dark';
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'vs';
    }
    return 'vs-dark';
  }, [preferences.theme]);

  const monacoLanguage = entry?.language === 'groovy' ? 'groovy' : 'powershell';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl! h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-base">
            {entry?.hostname || 'No hostname'}
          </DialogTitle>
          {entry && (
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
              <span>{entry.collector}</span>
              <span>•</span>
              <span>{getModeLabel(entry.mode)}</span>
              <span>•</span>
              <span>{formatTimestamp(entry.timestamp)}</span>
              <span>•</span>
              <span>{formatDuration(entry.duration)}</span>
            </div>
          )}
        </DialogHeader>

        {entry && (
          <div className="flex-1 min-h-0 p-6 pt-4 flex flex-col gap-3">
            <Tabs defaultValue="script" className="flex-1 min-h-0">
              <div className="flex items-center justify-between gap-2">
                <TabsList variant="line" className="h-7">
                  <TabsTrigger value="script" className="h-6 text-xs px-2">
                    Script
                  </TabsTrigger>
                  <TabsTrigger value="output" className="h-6 text-xs px-2">
                    Output
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => onLoad(entry)}
                >
                  <Play className="size-3 mr-1" />
                  Load Into Editor
                </Button>
              </div>
              <TabsContent value="script" className="mt-2 h-full">
                <div className="rounded-md border border-border bg-muted/30 h-full overflow-hidden">
                  <Editor
                    height="100%"
                    language={monacoLanguage}
                    theme={monacoTheme}
                    value={entry.script}
                    options={{
                      readOnly: true,
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                      lineNumbers: 'on',
                      minimap: { enabled: false },
                      wordWrap: 'off',
                      tabSize: 2,
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      renderLineHighlight: 'none',
                      padding: { top: 8, bottom: 8 },
                      domReadOnly: true,
                      cursorStyle: 'line-thin',
                      selectionHighlight: false,
                      occurrencesHighlight: 'off',
                      scrollbar: { horizontal: 'auto', vertical: 'auto' },
                    }}
                    loading={
                      <div className="flex items-center justify-center h-full">
                        <div className="text-muted-foreground text-xs">Loading...</div>
                      </div>
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="output" className="mt-2 h-full">
                <div className="rounded-md border border-border bg-muted/30 h-full overflow-hidden">
                  <Editor
                    height="100%"
                    language="plaintext"
                    theme={monacoTheme}
                    value={entry.output || 'No output captured.'}
                    options={{
                      readOnly: true,
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                      lineNumbers: 'off',
                      minimap: { enabled: false },
                      wordWrap: 'on',
                      tabSize: 2,
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      renderLineHighlight: 'none',
                      padding: { top: 8, bottom: 8 },
                      domReadOnly: true,
                      cursorStyle: 'line-thin',
                      selectionHighlight: false,
                      occurrencesHighlight: 'off',
                      scrollbar: { horizontal: 'auto', vertical: 'auto' },
                    }}
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
