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
} from 'lucide-react';
import { SuccessIcon, ErrorIcon } from '../constants/icons';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { DebugCommand } from '../data/debug-commands';
import type { DebugCommandResult } from '@/shared/types';
import { ConfirmationDialog } from './ConfirmationDialog';
import { HealthCheckReport, parseHealthCheckData, type HealthCheckData } from './health-check';

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
      <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden">
        <HealthCheckReport data={healthCheckData} />
      </div>
    );
  }

  // Default text output
  return (
    <div className="flex-1 border rounded-md overflow-hidden">
      <ScrollArea className="h-full p-4">
        {result.success && result.output ? (
          <pre className="text-sm font-mono whitespace-pre-wrap wrap-break-word">
            {result.output}
          </pre>
        ) : result.error ? (
          <div className="text-red-500">
            <p className="font-semibold mb-2">Error:</p>
            <pre className="text-sm font-mono whitespace-pre-wrap wrap-break-word">
              {result.error}
            </pre>
          </div>
        ) : (
          <div className="text-muted-foreground text-center py-8 select-none">
            No output available
          </div>
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
      toast.success('Output copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy output');
    }
  };

  const copyExecutedCommand = async () => {
    if (!executedCommand) return;
    try {
      await navigator.clipboard.writeText(executedCommand);
      toast.success('Executed command copied');
    } catch (error) {
      toast.error('Failed to copy command');
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
    toast.success('Output downloaded');
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
    toast.success('All results exported');
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
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} disabled={isExecutingDebugCommand}>
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <div className="flex items-center gap-2">
                {command.type === 'healthcheck' && (
                  <HeartPulse className="size-5 text-teal-500" />
                )}
                <code className="font-mono font-semibold">{command.command}</code>
                <Badge variant={isExecutingDebugCommand ? 'default' : 'secondary'}>
                  {isExecutingDebugCommand ? (command.type === 'healthcheck' ? 'Analyzing...' : 'Executing...') : 'Complete'}
                </Badge>
                {command.type === 'healthcheck' && !isExecutingDebugCommand && (
                  <Badge className="bg-linear-to-r from-emerald-500 to-cyan-500 text-white">
                    Visual Report
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {resultsWithCollectors.length} collector{resultsWithCollectors.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExecutingDebugCommand && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
              >
                <StopCircle className="size-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newMode = viewMode === 'tabs' ? 'grid' : 'tabs';
                setViewMode(newMode);
                // Clear selected collector when switching to grid view
                if (newMode === 'grid') {
                  setSelectedCollectorId(null);
                }
              }}
              disabled={isExecutingDebugCommand && resultsWithCollectors.length === 0}
            >
              {viewMode === 'tabs' ? (
                <>
                  <LayoutGrid className="size-4 mr-2" />
                  Grid View
                </>
              ) : (
                <>
                  <List className="size-4 mr-2" />
                  Tab View
                </>
              )}
            </Button>
            {resultsWithCollectors.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportAllResults}>
                <Download className="size-4 mr-2" />
                Export All
              </Button>
            )}
            {executedCommand && command.type !== 'healthcheck' && (
              <Button variant="outline" size="sm" onClick={copyExecutedCommand}>
                <Copy className="size-4 mr-2" />
                Copy Command
              </Button>
            )}
          </div>
        </div>

      {/* Results */}
      {resultsWithCollectors.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            {isExecutingDebugCommand ? (
              <>
                <Loader2 className="size-12 mx-auto mb-4 animate-spin" />
                <p className="text-lg font-medium mb-2">Executing command...</p>
                <p className="text-sm">Results will appear here when complete</p>
              </>
            ) : (
              <>
                <ErrorIcon className="size-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No results</p>
                <p className="text-sm">Execute a command to see results</p>
              </>
            )}
          </div>
        </div>
      ) : viewMode === 'tabs' ? (
        <Tabs
          value={selectedCollectorId?.toString() || undefined}
          onValueChange={(value) => setSelectedCollectorId(parseInt(value, 10))}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="mx-4 mt-4">
            {resultsWithCollectors.map(({ collectorId, collector, result }) => (
              <TabsTrigger
                key={collectorId}
                value={collectorId.toString()}
                className="gap-2"
              >
                {result.success ? (
                  <SuccessIcon className="size-4" />
                ) : (
                  <ErrorIcon className="size-4" />
                )}
                <span className="truncate max-w-[150px]">
                  {collector?.description || `Collector ${collectorId}`}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {resultsWithCollectors.map(({ collectorId, collector, result }) => (
            <TabsContent
              key={collectorId}
              value={collectorId.toString()}
              className="flex-1 flex flex-col m-0 mt-4 min-h-0"
            >
              <div className="flex-1 flex flex-col mx-4 mb-4 min-h-0">
                {/* Result Header */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">
                        {collector?.description || `Collector ${collectorId}`}
                      </h3>
                      {result.success ? (
                        <Badge variant="default">
                          <SuccessIcon className="size-3 mr-1" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <ErrorIcon className="size-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {collector?.hostname || 'N/A'}
                      {result.duration && ` • ${result.duration}ms`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.output && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyOutput(result.output!)}
                      >
                        <Copy className="size-4 mr-2" />
                        Copy
                      </Button>
                    )}
                    {result.output && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadOutput(result.output!, collector?.description || `collector-${collectorId}`)}
                      >
                        <Download className="size-4 mr-2" />
                        Download
                      </Button>
                    )}
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
        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resultsWithCollectors.map(({ collectorId, collector, result }) => (
              <div
                key={collectorId}
                className="border rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {collector?.description || `Collector ${collectorId}`}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {collector?.hostname || 'N/A'}
                    </p>
                  </div>
                  {result.success ? (
                    <SuccessIcon className="size-5 shrink-0 ml-2" />
                  ) : (
                    <ErrorIcon className="size-5 shrink-0 ml-2" />
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {result.success ? (
                    <Badge variant="default" className="bg-teal-500">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Error</Badge>
                  )}
                  {result.duration && (
                    <Badge variant="outline" className="text-xs">
                      {result.duration}ms
                    </Badge>
                  )}
                </div>

                <div className="max-h-48 mb-3 border rounded overflow-hidden">
                  <ScrollArea className="h-full p-2">
                    {result.success && result.output ? (
                      <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">
                        {result.output.length > 200
                          ? `${result.output.substring(0, 200)}...`
                          : result.output}
                      </pre>
                    ) : result.error ? (
                      <p className="text-xs text-red-500 wrap-break-word">{result.error}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground select-none">No output</p>
                    )}
                  </ScrollArea>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
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
                      size="sm"
                      onClick={() => copyOutput(result.output!)}
                    >
                      <Copy className="size-4" />
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
