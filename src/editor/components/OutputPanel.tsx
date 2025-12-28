import { Trash2, XCircle, Clock, Loader2, Play, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { ParsedContent } from './ParsedContent';
import { ValidationContent } from './ValidationContent';
import { CopyButton } from './shared/CopyButton';

export function OutputPanel() {
  const { 
    currentExecution, 
    outputTab, 
    setOutputTab, 
    clearOutput,
    isExecuting,
    tabs,
    activeTabId,
  } = useEditorStore();

  // Derive mode from active tab (getters are not reactive in Zustand)
  const mode = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    return activeTab?.mode ?? 'freeform';
  }, [tabs, activeTabId]);

  const isFreeformMode = mode === 'freeform';
  
  // Auto-switch to 'raw' tab when switching to freeform mode
  useEffect(() => {
    if (isFreeformMode && (outputTab === 'parsed' || outputTab === 'validation')) {
      setOutputTab('raw');
    }
  }, [isFreeformMode, outputTab, setOutputTab]);

  return (
    <div className="flex flex-col h-full">
      <Tabs 
        value={outputTab} 
        onValueChange={(value) => setOutputTab(value as typeof outputTab)}
        className="h-full"
      >
        {/* Tab Header */}
        <div className="flex items-center justify-between px-2 py-1 bg-secondary/30 border-b border-border">
          <div className="flex items-center gap-3">
            <TabsList variant="line">
              <TabsTrigger value="raw" id="output-tab-raw" aria-controls="output-panel-raw">Raw Output</TabsTrigger>
              {isFreeformMode ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span 
                        className="px-2 py-1 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
                        tabIndex={0}
                        aria-disabled="true"
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
                <TabsTrigger value="parsed" id="output-tab-parsed" aria-controls="output-panel-parsed">Parsed</TabsTrigger>
              )}
              {isFreeformMode ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span 
                        className="px-2 py-1 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
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
                <TabsTrigger value="validation" id="output-tab-validation" aria-controls="output-panel-validation">Validation</TabsTrigger>
              )}
            </TabsList>
            
            {/* Status Badge */}
            <ExecutionStatus 
              isExecuting={isExecuting} 
              execution={currentExecution} 
            />
          </div>
          
          <div className="flex items-center gap-1">
            {currentExecution?.rawOutput && (
              <CopyButton 
                text={currentExecution.rawOutput}
                size="sm"
                onCopy={() => {
                  toast.success('Output copied to clipboard');
                }}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearOutput();
                toast.info('Output cleared');
              }}
              className="gap-1.5 h-7 px-2 text-xs"
              aria-label="Clear output"
            >
              <Trash2 className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>

        {/* Output Content */}
        <div className="flex-1 overflow-auto">
          <TabsContent 
            value="raw" 
            className="h-full p-3 font-mono text-sm"
            role="tabpanel"
            aria-labelledby="output-tab-raw"
          >
            {isExecuting ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Executing script...</span>
              </div>
            ) : currentExecution ? (
              <RawOutputContent execution={currentExecution} />
            ) : (
              <Empty className="border-none h-full">
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
        </div>
      </Tabs>
    </div>
  );
}

interface ExecutionStatusProps {
  isExecuting: boolean;
  execution: ReturnType<typeof useEditorStore.getState>['currentExecution'];
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
          !isError && 'bg-green-600 hover:bg-green-500'
        )}
      >
        {isError ? (
          <XCircle className="size-3" />
        ) : (
          <CheckCircle2 className="size-3" />
        )}
        {isError ? 'Error' : 'Complete'}
      </Badge>
      
      <span className="text-xs text-muted-foreground flex items-center gap-1">
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
  execution: NonNullable<ReturnType<typeof useEditorStore.getState>['currentExecution']>;
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
          <div className="pt-2 border-t border-border">
            <pre className="whitespace-pre-wrap break-words text-muted-foreground">
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
        <div className="text-yellow-500 text-xs mb-2">
          {warningLines.map((warning, i) => (
            <div key={i}>{warning}</div>
          ))}
        </div>
      )}
      <pre className="whitespace-pre-wrap break-words">
        {outputLines.join('\n') || 'No output'}
      </pre>
    </div>
  );
}
