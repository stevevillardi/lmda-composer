import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Download,
  LayoutGrid,
  List,
  StopCircle,
  HeartPulse,
  Terminal,
  Clock,
} from 'lucide-react';
import { SuccessIcon, ErrorIcon } from '../../constants/icons';
import { clipboardToasts, collectorToasts } from '../../utils/toast-utils';
import { useEditorStore } from '../../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { DebugCommand } from '../../data/debug-commands';
import type { DebugCommandResult } from '@/shared/types';
import { ConfirmationDialog } from '../shared/ConfirmationDialog';
import { HealthCheckReport, parseHealthCheckData, type HealthCheckData } from '../health-check';

interface MultiCollectorResultsProps {
  command: DebugCommand;
  executedCommand?: string;
  onBack: () => void;
}

// Component to render result content, with special handling for health check
function ResultContent({ 
  result, 
  isHealthCheck 
}: { 
  result: DebugCommandResult; 
  isHealthCheck: boolean;
}) {
  // Try to parse as health check data if it's a health check command
  const healthCheckData = useMemo<HealthCheckData | null>(() => {
    if (!isHealthCheck || !result.success || !result.output) return null;
    return parseHealthCheckData(result.output);
  }, [isHealthCheck, result.success, result.output]);

  // If we have valid health check data, render the visual report
  if (healthCheckData) {
    return (
      <div className="
        flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border
        border-border/70
      ">
        <HealthCheckReport data={healthCheckData} />
      </div>
    );
  }

  // Default text output
  return (
    <div className="
      flex-1 overflow-hidden rounded-md border border-border/70 bg-card/60
    ">
      <ScrollArea className="h-full p-4">
        {result.success && result.output ? (
          <pre className="font-mono text-sm wrap-break-word whitespace-pre-wrap">
            {result.output}
          </pre>
        ) : result.error ? (
          <div className="text-destructive">
            <p className="mb-2 font-semibold">Error:</p>
            <pre className="font-mono text-sm wrap-break-word whitespace-pre-wrap">
              {result.error}
            </pre>
          </div>
        ) : (
          <Empty className="h-full border-none bg-transparent shadow-none">
            <EmptyMedia variant="icon" className="mx-auto mb-4 bg-muted/50">
              <Terminal className="size-5 text-muted-foreground/70" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-sm font-medium">No output</EmptyTitle>
              <EmptyDescription className="text-xs">
                This command did not produce any output.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </ScrollArea>
    </div>
  );
}

export function MultiCollectorResults({ command, executedCommand, onBack }: MultiCollectorResultsProps) {
  const {
    debugCommandResults,
    collectors,
    isExecutingDebugCommand,
    cancelDebugCommandExecution,
  } = useEditorStore();

  const [viewMode, setViewMode] = useState<'tabs' | 'grid'>('tabs');
  const [selectedCollectorId, setSelectedCollectorId] = useState<number | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Get collector info for each result
  const resultsWithCollectors = useMemo(() => {
    return Object.entries(debugCommandResults || {}).map(([collectorIdStr, result]) => {
      const collectorId = parseInt(collectorIdStr, 10);
      const collector = collectors.find(c => c.id === collectorId);
      return {
        collectorId,
        collector,
        result: result as DebugCommandResult,
      };
    });
  }, [debugCommandResults, collectors]);

  // Set first collector as selected by default
  useMemo(() => {
    if (resultsWithCollectors.length > 0 && !selectedCollectorId) {
      setSelectedCollectorId(resultsWithCollectors[0].collectorId);
    }
  }, [resultsWithCollectors, selectedCollectorId]);

  // Copy output to clipboard
  const copyOutput = async (output: string) => {
    try {
      await navigator.clipboard.writeText(output);
      clipboardToasts.outputCopied();
    } catch (_error) {
      clipboardToasts.copyFailed('output');
    }
  };

  const copyExecutedCommand = async () => {
    if (!executedCommand) return;
    try {
      await navigator.clipboard.writeText(executedCommand);
      clipboardToasts.commandCopied();
    } catch (_error) {
      clipboardToasts.copyFailed('command');
    }
  };

  // Download output as file
  const downloadOutput = (output: string, collectorName: string) => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${command.command.replace('!', '')}_${collectorName}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    clipboardToasts.downloaded('Output');
  };

  // Export all results
  const exportAllResults = () => {
    let content = `Debug Command: ${command.command}\n`;
    content += `Executed: ${new Date().toLocaleString()}\n`;
    content += `Collectors: ${resultsWithCollectors.length}\n`;
    content += '='.repeat(80) + '\n\n';

    for (const { collector, result } of resultsWithCollectors) {
      content += `Collector: ${collector?.description || `ID ${result.collectorId}`}\n`;
      content += `Hostname: ${collector?.hostname || 'N/A'}\n`;
      content += `Status: ${result.success ? 'Success' : 'Error'}\n`;
      if (result.duration) {
        content += `Duration: ${result.duration}ms\n`;
      }
      content += '-'.repeat(80) + '\n';
      if (result.success && result.output) {
        content += result.output + '\n';
      } else if (result.error) {
        content += `Error: ${result.error}\n`;
      }
      content += '\n' + '='.repeat(80) + '\n\n';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${command.command.replace('!', '')}_all_results_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    collectorToasts.resultsExported();
  };

  return (
    <>
      <ConfirmationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancel Debug Command Execution"
        description="Are you sure you want to cancel the debug command execution? This action cannot be undone."
        confirmLabel="Cancel Execution"
        cancelLabel="Continue"
        onConfirm={async () => {
          await cancelDebugCommandExecution();
        }}
        variant="warning"
        icon={StopCircle}
      />
      <div className="flex h-full flex-col">
        {/* Header with glassmorphism */}
        <div className="
          flex items-center justify-between border-b border-border
          bg-secondary/30 px-4 py-3
        ">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              disabled={isExecutingDebugCommand}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {command.type === 'healthcheck' && (
                  <HeartPulse className="size-4 text-teal-500" />
                )}
                <code className="font-mono text-sm font-semibold">
                  {command.command}
                </code>
                <Badge
                  variant={isExecutingDebugCommand ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {isExecutingDebugCommand
                    ? command.type === 'healthcheck'
                      ? 'Analyzing...'
                      : 'Executing...'
                    : 'Complete'}
                </Badge>
                {command.type === 'healthcheck' && !isExecutingDebugCommand && (
                  <Badge className="
                    bg-linear-to-r from-emerald-500 to-cyan-500 text-xs
                    text-white
                  ">
                    Visual Report
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {resultsWithCollectors.length} collector
                {resultsWithCollectors.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExecutingDebugCommand && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                className="gap-1.5"
              >
                <StopCircle className="size-4" />
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newMode = viewMode === 'tabs' ? 'grid' : 'tabs';
                setViewMode(newMode);
                if (newMode === 'grid') {
                  setSelectedCollectorId(null);
                }
              }}
              disabled={isExecutingDebugCommand && resultsWithCollectors.length === 0}
              className="gap-1.5"
            >
              {viewMode === 'tabs' ? (
                <>
                  <LayoutGrid className="size-4" />
                  Grid
                </>
              ) : (
                <>
                  <List className="size-4" />
                  Tabs
                </>
              )}
            </Button>
            {resultsWithCollectors.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportAllResults}
                className="gap-1.5"
              >
                <Download className="size-4" />
                Export
              </Button>
            )}
            {executedCommand && command.type !== 'healthcheck' && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyExecutedCommand}
                className="gap-1.5"
              >
                <Copy className="size-4" />
                Copy
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        {resultsWithCollectors.length === 0 ? (
          <Empty className="flex-1 border-none bg-transparent shadow-none">
            <EmptyMedia variant="icon" className="mx-auto mb-4 bg-muted/50">
              {isExecutingDebugCommand ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground/70" />
              ) : (
                <Terminal className="size-5 text-muted-foreground/70" />
              )}
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-base font-medium">
                {isExecutingDebugCommand ? 'Executing command...' : 'No results'}
              </EmptyTitle>
              <EmptyDescription className="mx-auto mt-1.5 max-w-sm">
                {isExecutingDebugCommand
                  ? 'Results will appear here when complete.'
                  : 'Execute a command to see results.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : viewMode === 'tabs' ? (
          <Tabs
            value={selectedCollectorId?.toString() || undefined}
            onValueChange={(value) => setSelectedCollectorId(parseInt(value, 10))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 border-b border-border bg-muted/30 px-4 pt-3">
              <TabsList className="h-auto gap-1 bg-transparent p-0">
                {resultsWithCollectors.map(({ collectorId, collector, result }) => (
                  <TabsTrigger
                    key={collectorId}
                    value={collectorId.toString()}
                    className="
                      gap-1.5 rounded-b-none border border-b-0 border-border/50
                      bg-card/40 px-3 py-1.5 text-xs
                      data-[state=active]:border-border
                      data-[state=active]:bg-background
                      data-[state=active]:shadow-none
                    "
                  >
                    {result.success ? (
                      <SuccessIcon className="size-3.5" />
                    ) : (
                      <ErrorIcon className="size-3.5" />
                    )}
                    <span className="max-w-[120px] truncate">
                      {collector?.description || `Collector ${collectorId}`}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {resultsWithCollectors.map(({ collectorId, collector, result }) => (
              <TabsContent
                key={collectorId}
                value={collectorId.toString()}
                className="m-0 flex min-h-0 flex-1 flex-col bg-muted/5"
              >
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  {/* Result Header Card */}
                  <div className="
                    mb-4 rounded-lg border border-border/70 bg-card/60 p-4
                  ">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="font-semibold">
                            {collector?.description || `Collector ${collectorId}`}
                          </h3>
                          {result.success ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <SuccessIcon className="size-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 text-xs">
                              <ErrorIcon className="size-3" />
                              Error
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{collector?.hostname || 'N/A'}</span>
                          {result.duration && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {result.duration}ms
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.output && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyOutput(result.output!)}
                              className="gap-1.5"
                            >
                              <Copy className="size-3.5" />
                              Copy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                downloadOutput(
                                  result.output!,
                                  collector?.description || `collector-${collectorId}`
                                )
                              }
                              className="gap-1.5"
                            >
                              <Download className="size-3.5" />
                              Download
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Result Content */}
                  <ResultContent
                    result={result}
                    isHealthCheck={command.type === 'healthcheck'}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <ScrollArea className="flex-1 bg-muted/5 p-4">
            <div className="
              grid grid-cols-1 gap-4
              md:grid-cols-2
              lg:grid-cols-3
            ">
              {resultsWithCollectors.map(({ collectorId, collector, result }) => (
                <div
                  key={collectorId}
                  className="
                    flex flex-col rounded-lg border border-border/40 bg-card/60
                    p-4 backdrop-blur-sm transition-all
                    hover:border-border hover:bg-card/80
                  "
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">
                        {collector?.description || `Collector ${collectorId}`}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {collector?.hostname || 'N/A'}
                      </p>
                    </div>
                    {result.success ? (
                      <SuccessIcon className="ml-2 size-5 shrink-0" />
                    ) : (
                      <ErrorIcon className="ml-2 size-5 shrink-0" />
                    )}
                  </div>

                  <div className="mb-3 flex items-center gap-2">
                    {result.success ? (
                      <Badge variant="default" className="text-xs">Success</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Error</Badge>
                    )}
                    {result.duration && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Clock className="size-2.5" />
                        {result.duration}ms
                      </Badge>
                    )}
                  </div>

                  <div className="
                    mb-3 max-h-40 overflow-hidden rounded-md border
                    border-border/50 bg-muted/30
                  ">
                    <ScrollArea className="h-full p-2">
                      {result.success && result.output ? (
                        <pre className="
                          font-mono text-[10px] leading-relaxed wrap-break-word
                          whitespace-pre-wrap
                        ">
                          {result.output.length > 200
                            ? `${result.output.substring(0, 200)}...`
                            : result.output}
                        </pre>
                      ) : result.error ? (
                        <p className="
                          text-[10px] wrap-break-word text-destructive
                        ">
                          {result.error}
                        </p>
                      ) : (
                        <p className="
                          py-4 text-center text-[10px] text-muted-foreground
                          select-none
                        ">
                          No output
                        </p>
                      )}
                    </ScrollArea>
                  </div>

                  <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        setSelectedCollectorId(collectorId);
                        setViewMode('tabs');
                      }}
                    >
                      View Details
                    </Button>
                    {result.output && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => copyOutput(result.output!)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </>
  );
}
