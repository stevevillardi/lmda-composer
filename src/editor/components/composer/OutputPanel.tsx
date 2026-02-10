import { Trash2, XCircle, Clock, Loader2, Play, CheckCircle2, Maximize2, X, Network } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { clipboardToasts } from '../../utils/toast-utils';
import { useEditorStore } from '../../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { ParsedContent } from './ParsedContent';
import { ValidationContent } from './ValidationContent';
import { TopologyGraphView } from './TopologyGraphView';
import { CopyButton } from '../shared/CopyButton';
import type { ParseResult, TopologyParseResult } from '../../utils/output-parser';
import type { ExecutionResult } from '@/shared/types';

// Helper to get parsed tab status indicator
function getParsedTabIndicator(parsedOutput: ParseResult | null): React.ReactNode {
  if (!parsedOutput) return null;
  
  const count = parsedOutput.summary.total;
  if (count === 0) return null;
  
  return (
    <span className="ml-1 text-xs text-muted-foreground">({count})</span>
  );
}

// Helper to get validation tab status indicator
function getValidationTabIndicator(parsedOutput: ParseResult | null): React.ReactNode {
  if (!parsedOutput) return null;
  
  const { errors, warnings } = parsedOutput.summary;
  
  if (errors > 0) {
    return (
      <span className="ml-1.5 flex items-center gap-1">
        <span className="size-2 rounded-full bg-red-500" />
        <span className="text-xs text-red-500">{errors}</span>
      </span>
    );
  }
  
  if (warnings > 0) {
    return (
      <span className="ml-1.5 flex items-center gap-1">
        <span className="size-2 rounded-full bg-yellow-500" />
        <span className="text-xs text-yellow-500">{warnings}</span>
      </span>
    );
  }
  
  // All valid
  return (
    <span className="ml-1.5 flex items-center gap-1">
      <span className="size-2 rounded-full bg-teal-500" />
      <span className="text-xs text-teal-500">✓</span>
    </span>
  );
}

export function OutputPanel() {
  const outputTab = useEditorStore((s) => s.outputTab);
  const setOutputTab = useEditorStore((s) => s.setOutputTab);
  const clearOutput = useEditorStore((s) => s.clearOutput);
  const isExecuting = useEditorStore((s) => s.isExecuting);
  const executingTabId = useEditorStore((s) => s.executingTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);

  // Per-tab execution selectors
  const currentExecution = useEditorStore((s) =>
    s.activeTabId ? s.executionResultsByTabId[s.activeTabId] ?? null : null
  );
  const parsedOutput = useEditorStore((s) =>
    s.activeTabId ? s.parsedOutputByTabId[s.activeTabId] ?? null : null
  );
  
  // Only show executing state when the active tab is the one executing
  const isTabExecuting = isExecuting && executingTabId === activeTabId;

  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // Derive mode from active tab (getters are not reactive in Zustand)
  const mode = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    return activeTab?.mode ?? 'freeform';
  }, [tabs, activeTabId]);

  const isFreeformMode = mode === 'freeform';
  const isTopologyResult = parsedOutput?.type === 'topology';

  // Auto-switch to 'raw' tab when switching to freeform mode or when graph tab is no longer valid
  useEffect(() => {
    if (isFreeformMode && (outputTab === 'parsed' || outputTab === 'validation' || outputTab === 'graph')) {
      setOutputTab('raw');
    }
    // Switch away from graph tab if result is no longer topology
    if (outputTab === 'graph' && !isTopologyResult) {
      setOutputTab('parsed');
    }
  }, [isFreeformMode, isTopologyResult, outputTab, setOutputTab]);

  const renderHeader = (showFullscreen: boolean, showClose: boolean) => {
    const isFullscreen = showClose;
    
    return (
    <div className={cn(
      "flex items-center justify-between border-b border-border px-2 py-1",
      isFullscreen ? "bg-card px-4 py-2" : "bg-secondary/30"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          isFullscreen && "rounded-lg bg-muted/50 px-2 py-1"
        )}>
          <TabsList variant="line">
          <TabsTrigger value="raw" id="output-tab-raw" aria-controls="output-panel-raw">Raw Output</TabsTrigger>
          {isFreeformMode ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="
                      cursor-not-allowed rounded-sm px-2 py-1 text-sm
                      font-medium text-muted-foreground/50
                      focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:ring-offset-2 focus-visible:outline-none
                    "
                    tabIndex={0}
                    role="tab"
                    aria-disabled="true"
                    aria-selected="false"
                  >
                    Parsed
                  </span>
                }
              />
              <TooltipContent>
                Switch to AD or Collection mode to parse and validate output
              </TooltipContent>
            </Tooltip>
          ) : (
            <TabsTrigger value="parsed" id="output-tab-parsed" aria-controls="output-panel-parsed" className="
              flex items-center
            ">
              Parsed
              {getParsedTabIndicator(parsedOutput)}
            </TabsTrigger>
          )}
          {isFreeformMode ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="
                      cursor-not-allowed rounded-sm px-2 py-1 text-sm
                      font-medium text-muted-foreground/50
                      focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:ring-offset-2 focus-visible:outline-none
                    "
                    tabIndex={0}
                    aria-disabled="true"
                    role="tab"
                    aria-selected="false"
                  >
                    Validation
                  </span>
                }
              />
              <TooltipContent>
                Switch to AD or Collection mode to parse and validate output
              </TooltipContent>
            </Tooltip>
          ) : (
            <TabsTrigger value="validation" id="output-tab-validation" aria-controls="output-panel-validation" className="
              flex items-center
            ">
              Validation
              {getValidationTabIndicator(parsedOutput)}
            </TabsTrigger>
          )}
          {/* Graph tab - only for topology results */}
          {isTopologyResult && (
            <TabsTrigger value="graph" id="output-tab-graph" aria-controls="output-panel-graph" className="
              flex items-center gap-1
            ">
              <Network className="size-3.5" />
              Graph
            </TabsTrigger>
          )}
        </TabsList>
        </div>

        {/* Status Badge */}
        <ExecutionStatus
          isExecuting={isTabExecuting}
          execution={currentExecution}
        />
      </div>

      <div className="flex items-center gap-1">
        {currentExecution?.rawOutput && (
          <CopyButton
            text={currentExecution.rawOutput}
            size="sm"
            onCopy={() => {
              clipboardToasts.outputCopied();
            }}
          />
        )}
        {showFullscreen && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFullscreenOpen(true)}
                  aria-label="Open output fullscreen"
                >
                  <Maximize2 className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Open fullscreen</TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearOutput();
          }}
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label="Clear output"
        >
          <Trash2 className="size-3.5" />
          Clear
        </Button>
        {showClose && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFullscreenOpen(false)}
                  aria-label="Close fullscreen"
                >
                  <X className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Close fullscreen</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
    );
  };

  const outputContent = (
    <div className="flex-1 overflow-auto">
      <TabsContent
        value="raw"
        className="h-full p-3 font-mono text-sm"
        role="tabpanel"
        aria-labelledby="output-tab-raw"
      >
        {isTabExecuting ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Executing script...</span>
          </div>
        ) : currentExecution ? (
          <RawOutputContent execution={currentExecution} />
        ) : (
          <Empty className="h-full border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Play className="size-5" />
              </EmptyMedia>
              <EmptyTitle className="text-base">No output yet</EmptyTitle>
              <EmptyDescription>
                Run a script to see the output here
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>

      <TabsContent
        value="parsed"
        className="h-full overflow-auto"
        role="tabpanel"
        aria-labelledby="output-tab-parsed"
      >
        <ParsedContent />
      </TabsContent>

      <TabsContent
        value="validation"
        className="h-full overflow-auto"
        role="tabpanel"
        aria-labelledby="output-tab-validation"
      >
        <ValidationContent />
      </TabsContent>

      {/* Graph tab - only for topology results */}
      {isTopologyResult && (
        <TabsContent
          value="graph"
          className="h-full overflow-hidden"
          role="tabpanel"
          aria-labelledby="output-tab-graph"
        >
          <TopologyGraphView result={parsedOutput as TopologyParseResult} />
        </TabsContent>
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={outputTab}
        onValueChange={(value) => setOutputTab(value as typeof outputTab)}
        className="flex h-full flex-col"
      >
        {fullscreenOpen ? (
          <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
            <DialogContent
              className="
                flex! h-[90vh]! min-h-0! w-[94vw]! max-w-none! flex-col!
                overflow-hidden p-0
              "
              showCloseButton={false}
            >
              <div className="flex h-full min-h-0 flex-col">
                {renderHeader(false, true)}
                {outputContent}
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <>
            {renderHeader(true, false)}
            {outputContent}
          </>
        )}
      </Tabs>
    </div>
  );
}

interface ExecutionStatusProps {
  isExecuting: boolean;
  execution: ExecutionResult | null;
}

function ExecutionStatus({ isExecuting, execution }: ExecutionStatusProps) {
  if (isExecuting) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="size-3 animate-spin" />
        Running
      </Badge>
    );
  }

  if (!execution) {
    return null;
  }

  const isError = execution.status === 'error';
  const duration = formatDuration(execution.duration);

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant={isError ? 'destructive' : 'default'}
        className={cn(
          'gap-1.5',
          !isError && `
            bg-teal-600
            hover:bg-teal-500
          `
        )}
      >
        {isError ? (
          <XCircle className="size-3" />
        ) : (
          <CheckCircle2 className="size-3" />
        )}
        {isError ? 'Error' : 'Complete'}
      </Badge>

      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3" />
        {duration}
      </span>
    </div>
  );
}


function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

interface RawOutputContentProps {
  execution: ExecutionResult;
}

function RawOutputContent({ execution }: RawOutputContentProps) {
  if (execution.status === 'error') {
    return (
      <div className="space-y-2">
        <div className="text-destructive">
          <span className="font-semibold">Error: </span>
          <span>{execution.error}</span>
        </div>
        {execution.rawOutput && (
          <div className="border-t border-border pt-2">
            <pre className="
              wrap-break-word whitespace-pre-wrap text-muted-foreground
            ">
              {execution.rawOutput}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Check for warnings in output (lines starting with [Warning:)
  const lines = execution.rawOutput.split('\n');
  const warningLines: string[] = [];
  const outputLines: string[] = [];

  let inWarningSection = true;
  for (const line of lines) {
    if (inWarningSection && line.startsWith('[Warning:')) {
      warningLines.push(line);
    } else if (inWarningSection && line === '') {
      // Empty line after warnings
      continue;
    } else {
      inWarningSection = false;
      outputLines.push(line);
    }
  }

  return (
    <div className="space-y-2">
      {warningLines.length > 0 && (
        <div className="mb-2 text-xs text-yellow-500">
          {warningLines.map((warning, i) => (
            <div key={i}>{warning}</div>
          ))}
        </div>
      )}
      <pre className="wrap-break-word whitespace-pre-wrap">
        {outputLines.join('\n') || 'No output'}
      </pre>
    </div>
  );
}
