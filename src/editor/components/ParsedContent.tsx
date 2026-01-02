import { Info, ChevronDown, ChevronRight, Play, Terminal, ListX } from 'lucide-react';
import { SuccessIcon, ErrorIcon, WarningIcon, XCircleIcon, AlertTriangleIcon } from '../constants/icons';
import { useState, useMemo } from 'react';
import { useEditorStore } from '../stores/editor-store';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import type { 
  ADInstance, 
  CollectionDatapoint, 
  ADParseResult, 
  CollectionParseResult,
  TopologyParseResult,
  EventParseResult,
  PropertyParseResult,
  LogParseResult,
  ConfigParseResult,
  ScriptErrorParseResult,
  ValidationIssue,
  TopologyVertex,
  TopologyEdge,
  EventEntry,
  PropertyEntry,
  LogEntry,
} from '../utils/output-parser';

export function ParsedContent() {
  const { parsedOutput, currentExecution, tabs, activeTabId } = useEditorStore();

  // Derive mode from active tab (getters are not reactive in Zustand)
  const mode = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    return activeTab?.mode ?? 'freeform';
  }, [tabs, activeTabId]);

  // No execution yet
  if (!currentExecution) {
    return (
      <Empty className="border-none h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Play className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No parsed output yet</EmptyTitle>
          <EmptyDescription>
            Run a script to see parsed output here
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // Execution failed
  if (currentExecution.status === 'error') {
    return (
      <Empty className="border-none h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ErrorIcon className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">Execution failed</EmptyTitle>
          <EmptyDescription>
            Check the Raw Output tab for error details
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // No parsed output available
  if (!parsedOutput) {
    return (
      <Empty className="border-none h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Terminal className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            {mode === 'freeform' ? 'Parsing unavailable' : 'No parsed output'}
          </EmptyTitle>
          <EmptyDescription>
            {mode === 'freeform' 
              ? 'Switch to AD or Collection mode to parse output'
              : 'Run a script to see parsed results'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // Render based on parse result type
  switch (parsedOutput.type) {
    case 'script_error':
      return <ScriptErrorView result={parsedOutput} />;
    case 'ad':
      return <ADParseResultTable result={parsedOutput} />;
    case 'collection':
    case 'batchcollection':
      return <CollectionParseResultTable result={parsedOutput} />;
    case 'topology':
      return <TopologyParseResultView result={parsedOutput} />;
    case 'event':
      return <EventParseResultTable result={parsedOutput} />;
    case 'property':
      return <PropertyParseResultTable result={parsedOutput} />;
    case 'log':
      return <LogParseResultTable result={parsedOutput} />;
    case 'config':
      return <ConfigParseResultView result={parsedOutput} />;
    default:
      return null;
  }
}

// ============================================================================
// Active Discovery Table
// ============================================================================

// ============================================================================
// Script Error View
// ============================================================================

interface ScriptErrorViewProps {
  result: ScriptErrorParseResult;
}

function ScriptErrorView({ result }: ScriptErrorViewProps) {
  const { errorMessage, output, issues } = result;

  return (
    <div className="space-y-4 p-4">
      {/* Error Header */}
      <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <ErrorIcon className="size-6 shrink-0" />
        <div className="space-y-1">
          <div className="font-medium text-red-500">Script Execution Failed</div>
          <div className="text-sm text-muted-foreground">{errorMessage}</div>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue, idx) => (
            <IssueDisplay key={idx} issue={issue} />
          ))}
        </div>
      )}

      {/* Script Output (if any) */}
      {output && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Script Output</h4>
          <div className="bg-muted/30 rounded-md p-4 max-h-64 overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Active Discovery Table
// ============================================================================

interface ADParseResultTableProps {
  result: ADParseResult;
}

function ADParseResultTable({ result }: ADParseResultTableProps) {
  const { instances, unparsedLines, summary } = result;

  if (instances.length === 0 && unparsedLines.length === 0) {
    return (
      <Empty className="border-none h-full py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListX className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No instances found</EmptyTitle>
          <EmptyDescription>
            The script output didn't contain any valid AD instances
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {summary.total} instance{summary.total !== 1 ? 's' : ''} found
        </span>
        {summary.valid > 0 && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
            <SuccessIcon className="size-3" />
            {summary.valid} valid
          </Badge>
        )}
        {summary.errors > 0 && (
          <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
            <ErrorIcon className="size-3" />
            {summary.errors} error{summary.errors !== 1 ? 's' : ''}
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <WarningIcon className="size-3" />
            {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Instances Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Status</TableHead>
            <TableHead>Instance ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Properties</TableHead>
            <TableHead className="w-16">Line</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((instance, idx) => (
            <ADInstanceRow key={idx} instance={instance} />
          ))}
        </TableBody>
      </Table>

      {/* Unparsed Lines */}
      {unparsedLines.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
            <Info className="size-4" />
            {unparsedLines.length} line{unparsedLines.length !== 1 ? 's' : ''} not parsed
          </div>
          <div className="bg-muted/30 rounded-md p-3 text-xs font-mono max-h-32 overflow-auto">
            {unparsedLines.map((line, idx) => (
              <div key={idx} className="text-muted-foreground">
                <span className="text-muted-foreground/50 mr-2">L{line.lineNumber}:</span>
                <span>{line.content || '(empty)'}</span>
                <span className="text-muted-foreground/50 ml-2">— {line.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ADInstanceRowProps {
  instance: ADInstance;
}

function ADInstanceRow({ instance }: ADInstanceRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasErrors = instance.issues.some(i => i.severity === 'error');
  const hasWarnings = instance.issues.some(i => i.severity === 'warning');
  const hasProperties = instance.properties && Object.keys(instance.properties).length > 0;

  return (
    <>
      <TableRow 
        className={cn(
          hasErrors && 'bg-red-500/5',
          hasWarnings && !hasErrors && 'bg-yellow-500/5'
        )}
      >
        <TableCell>
          <StatusIcon issues={instance.issues} />
        </TableCell>
        <TableCell className="font-mono text-sm">
          {instance.id || <span className="text-muted-foreground italic">empty</span>}
        </TableCell>
        <TableCell>{instance.name}</TableCell>
        <TableCell className="max-w-[200px] truncate" title={instance.description}>
          {instance.description || <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          {hasProperties ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {Object.keys(instance.properties!).length} prop{Object.keys(instance.properties!).length !== 1 ? 's' : ''}
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {instance.lineNumber}
        </TableCell>
      </TableRow>
      
      {/* Expanded properties row */}
      {expanded && hasProperties && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={6} className="py-2">
            <div className="flex flex-wrap gap-2 pl-8">
              {Object.entries(instance.properties!).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="font-mono text-xs">
                  {key}={value}
                </Badge>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
      
      {/* Issues row */}
      {instance.issues.length > 0 && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={6} className="py-1">
            <div className="flex flex-col gap-1 pl-8">
              {instance.issues.map((issue, idx) => (
                <IssueDisplay key={idx} issue={issue} />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================================
// Collection Table
// ============================================================================

interface CollectionParseResultTableProps {
  result: CollectionParseResult;
}

function CollectionParseResultTable({ result }: CollectionParseResultTableProps) {
  const { datapoints, unparsedLines, summary, type, isJsonFormat } = result;
  const isBatchMode = type === 'batchcollection';

  if (datapoints.length === 0 && unparsedLines.length === 0) {
    return (
      <Empty className="border-none h-full py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListX className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No datapoints found</EmptyTitle>
          <EmptyDescription>
            The script output didn't contain any valid datapoints
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // Group by wildvalue for batch mode
  const groupedDatapoints = isBatchMode
    ? groupByWildvalue(datapoints)
    : { '': datapoints };

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {summary.total} datapoint{summary.total !== 1 ? 's' : ''} found
          {isBatchMode && ` (${Object.keys(groupedDatapoints).length} instance${Object.keys(groupedDatapoints).length !== 1 ? 's' : ''})`}
        </span>
        {isJsonFormat && (
          <Badge variant="outline" className="text-xs">JSON format</Badge>
        )}
        {summary.valid > 0 && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
            <SuccessIcon className="size-3" />
            {summary.valid} valid
          </Badge>
        )}
        {summary.errors > 0 && (
          <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
            <ErrorIcon className="size-3" />
            {summary.errors} error{summary.errors !== 1 ? 's' : ''}
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <WarningIcon className="size-3" />
            {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Datapoints Table */}
      {Object.entries(groupedDatapoints).map(([wildvalue, points]) => (
        <div key={wildvalue || 'default'} className="space-y-2">
          {isBatchMode && wildvalue && (
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Badge variant="outline">{wildvalue}</Badge>
              <span className="text-xs">({points.length} datapoint{points.length !== 1 ? 's' : ''})</span>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Status</TableHead>
                {isBatchMode && <TableHead>Instance</TableHead>}
                <TableHead>Datapoint</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-16">Line</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((dp, idx) => (
                <CollectionDatapointRow 
                  key={idx} 
                  datapoint={dp} 
                  showWildvalue={isBatchMode} 
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      {/* Unparsed Lines */}
      {unparsedLines.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
            <Info className="size-4" />
            {unparsedLines.length} line{unparsedLines.length !== 1 ? 's' : ''} not parsed
          </div>
          <div className="bg-muted/30 rounded-md p-3 text-xs font-mono max-h-32 overflow-auto">
            {unparsedLines.map((line, idx) => (
              <div key={idx} className="text-muted-foreground">
                <span className="text-muted-foreground/50 mr-2">L{line.lineNumber}:</span>
                <span>{line.content || '(empty)'}</span>
                <span className="text-muted-foreground/50 ml-2">— {line.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface CollectionDatapointRowProps {
  datapoint: CollectionDatapoint;
  showWildvalue: boolean;
}

function CollectionDatapointRow({ datapoint, showWildvalue }: CollectionDatapointRowProps) {
  const hasErrors = datapoint.issues.some(i => i.severity === 'error');
  const hasWarnings = datapoint.issues.some(i => i.severity === 'warning');

  // Check if this is a configuration value (from ConfigSource batch)
  const isConfigValue = datapoint.name === 'configuration' && datapoint.value === null;

  return (
    <>
      <TableRow 
        className={cn(
          hasErrors && 'bg-red-500/5',
          hasWarnings && !hasErrors && 'bg-yellow-500/5'
        )}
      >
        <TableCell>
          <StatusIcon issues={datapoint.issues} />
        </TableCell>
        {showWildvalue && (
          <TableCell className="font-mono text-sm">
            {datapoint.wildvalue || <span className="text-muted-foreground italic">missing</span>}
          </TableCell>
        )}
        <TableCell className="font-mono text-sm">{datapoint.name}</TableCell>
        <TableCell className="font-mono">
          {isConfigValue ? (
            <span className="text-muted-foreground max-w-[200px] truncate block" title={datapoint.rawValue}>
              {datapoint.rawValue.length > 50 ? datapoint.rawValue.substring(0, 50) + '...' : datapoint.rawValue}
            </span>
          ) : datapoint.value !== null ? (
            <span className="text-green-600">{datapoint.value}</span>
          ) : (
            <span className="text-red-500">{datapoint.rawValue}</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {datapoint.lineNumber}
        </TableCell>
      </TableRow>
      
      {/* Issues row */}
      {datapoint.issues.length > 0 && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={showWildvalue ? 5 : 4} className="py-1">
            <div className="flex flex-col gap-1 pl-8">
              {datapoint.issues.map((issue, idx) => (
                <IssueDisplay key={idx} issue={issue} />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

interface StatusIconProps {
  issues: ValidationIssue[];
}

function StatusIcon({ issues }: StatusIconProps) {
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');

  if (hasErrors) {
    return <ErrorIcon className="size-4" />;
  }
  if (hasWarnings) {
    return <WarningIcon className="size-4" />;
  }
  return <SuccessIcon className="size-4" />;
}

interface IssueDisplayProps {
  issue: ValidationIssue;
}

function IssueDisplay({ issue }: IssueDisplayProps) {
  const colors = {
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };
  const icons = {
    error: XCircleIcon,
    warning: AlertTriangleIcon,
    info: Info,
  };
  const Icon = icons[issue.severity];

  return (
    <div className={cn('flex items-center gap-2 text-xs', colors[issue.severity])}>
      <Icon className="size-3" />
      <span>{issue.message}</span>
      {issue.field && (
        <Badge variant="outline" className="h-4 px-1 text-[10px]">
          {issue.field}
        </Badge>
      )}
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function groupByWildvalue(datapoints: CollectionDatapoint[]): Record<string, CollectionDatapoint[]> {
  return datapoints.reduce((acc, dp) => {
    const key = dp.wildvalue || '';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(dp);
    return acc;
  }, {} as Record<string, CollectionDatapoint[]>);
}

// ============================================================================
// Topology Source View
// ============================================================================

interface TopologyParseResultViewProps {
  result: TopologyParseResult;
}

function TopologyParseResultView({ result }: TopologyParseResultViewProps) {
  const { vertices, edges, unparsedLines, summary } = result;

  if (vertices.length === 0 && edges.length === 0 && unparsedLines.length === 0) {
    return (
      <Empty className="border-none h-full py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListX className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No topology data found</EmptyTitle>
          <EmptyDescription>
            The script output didn't contain valid topology vertices or edges
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {vertices.length} vertices, {edges.length} edges
        </span>
        {summary.errors > 0 && (
          <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
            <ErrorIcon className="size-3" />
            {summary.errors} error{summary.errors !== 1 ? 's' : ''}
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <WarningIcon className="size-3" />
            {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Vertices Table */}
      {vertices.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Vertices</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Status</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vertices.map((vertex, idx) => (
                <TopologyVertexRow key={idx} vertex={vertex} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edges Table */}
      {edges.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Edges</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Status</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {edges.map((edge, idx) => (
                <TopologyEdgeRow key={idx} edge={edge} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Unparsed Lines */}
      {unparsedLines.length > 0 && (
        <UnparsedLinesDisplay lines={unparsedLines} />
      )}
    </div>
  );
}

function TopologyVertexRow({ vertex }: { vertex: TopologyVertex }) {
  const hasErrors = vertex.issues.some(i => i.severity === 'error');
  const hasWarnings = vertex.issues.some(i => i.severity === 'warning');

  return (
    <>
      <TableRow className={cn(hasErrors && 'bg-red-500/5', hasWarnings && !hasErrors && 'bg-yellow-500/5')}>
        <TableCell><StatusIcon issues={vertex.issues} /></TableCell>
        <TableCell className="font-mono text-sm">{vertex.id}</TableCell>
        <TableCell>{vertex.name || <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell>{vertex.type || <span className="text-muted-foreground">—</span>}</TableCell>
      </TableRow>
      {vertex.issues.length > 0 && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={4} className="py-1">
            <div className="flex flex-col gap-1 pl-8">
              {vertex.issues.map((issue, idx) => <IssueDisplay key={idx} issue={issue} />)}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function TopologyEdgeRow({ edge }: { edge: TopologyEdge }) {
  const hasErrors = edge.issues.some(i => i.severity === 'error');
  const hasWarnings = edge.issues.some(i => i.severity === 'warning');

  return (
    <>
      <TableRow className={cn(hasErrors && 'bg-red-500/5', hasWarnings && !hasErrors && 'bg-yellow-500/5')}>
        <TableCell><StatusIcon issues={edge.issues} /></TableCell>
        <TableCell className="font-mono text-sm">{edge.from || <span className="text-red-500 italic">missing</span>}</TableCell>
        <TableCell className="font-mono text-sm">{edge.to || <span className="text-red-500 italic">missing</span>}</TableCell>
        <TableCell>{edge.type || edge.displayType || <span className="text-muted-foreground">—</span>}</TableCell>
      </TableRow>
      {edge.issues.length > 0 && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={4} className="py-1">
            <div className="flex flex-col gap-1 pl-8">
              {edge.issues.map((issue, idx) => <IssueDisplay key={idx} issue={issue} />)}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================================
// Event Source Table
// ============================================================================

interface EventParseResultTableProps {
  result: EventParseResult;
}

function EventParseResultTable({ result }: EventParseResultTableProps) {
  const { events, unparsedLines, summary } = result;

  if (events.length === 0 && unparsedLines.length === 0) {
    return (
      <Empty className="border-none h-full py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListX className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No events found</EmptyTitle>
          <EmptyDescription>
            The script output didn't contain any valid events
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {summary.total} event{summary.total !== 1 ? 's' : ''} found
        </span>
        {summary.valid > 0 && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
            <SuccessIcon className="size-3" />
            {summary.valid} valid
          </Badge>
        )}
        {summary.errors > 0 && (
          <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
            <ErrorIcon className="size-3" />
            {summary.errors} error{summary.errors !== 1 ? 's' : ''}
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <WarningIcon className="size-3" />
            {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Events Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Status</TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event, idx) => (
            <EventEntryRow key={idx} event={event} />
          ))}
        </TableBody>
      </Table>

      {unparsedLines.length > 0 && <UnparsedLinesDisplay lines={unparsedLines} />}
    </div>
  );
}

function EventEntryRow({ event }: { event: EventEntry }) {
  const hasErrors = event.issues.some(i => i.severity === 'error');
  const hasWarnings = event.issues.some(i => i.severity === 'warning');

  const severityColors: Record<string, string> = {
    critical: 'text-red-600 bg-red-500/10',
    error: 'text-red-500 bg-red-500/10',
    warn: 'text-yellow-500 bg-yellow-500/10',
    warning: 'text-yellow-500 bg-yellow-500/10',
    info: 'text-blue-500 bg-blue-500/10',
    debug: 'text-gray-500 bg-gray-500/10',
  };

  return (
    <>
      <TableRow className={cn(hasErrors && 'bg-red-500/5', hasWarnings && !hasErrors && 'bg-yellow-500/5')}>
        <TableCell><StatusIcon issues={event.issues} /></TableCell>
        <TableCell className="font-mono text-xs">{event.happenedOn || <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell>
          {event.severity ? (
            <Badge className={cn('text-xs', severityColors[event.severity.toLowerCase()] || '')}>
              {event.severity}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="max-w-[300px] truncate" title={event.message}>
          {event.message || <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{event.source || '—'}</TableCell>
      </TableRow>
      {event.issues.length > 0 && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={5} className="py-1">
            <div className="flex flex-col gap-1 pl-8">
              {event.issues.map((issue, idx) => <IssueDisplay key={idx} issue={issue} />)}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================================
// Property Source Table
// ============================================================================

interface PropertyParseResultTableProps {
  result: PropertyParseResult;
}

function PropertyParseResultTable({ result }: PropertyParseResultTableProps) {
  const { properties, unparsedLines, summary } = result;

  if (properties.length === 0 && unparsedLines.length === 0) {
    return (
      <Empty className="border-none h-full py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListX className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No properties found</EmptyTitle>
          <EmptyDescription>
            The script output didn't contain any valid properties
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {summary.total} propert{summary.total !== 1 ? 'ies' : 'y'} found
        </span>
        {summary.valid > 0 && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
            <SuccessIcon className="size-3" />
            {summary.valid} valid
          </Badge>
        )}
        {summary.errors > 0 && (
          <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
            <ErrorIcon className="size-3" />
            {summary.errors} error{summary.errors !== 1 ? 's' : ''}
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <WarningIcon className="size-3" />
            {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Properties Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Status</TableHead>
            <TableHead>Property Name</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="w-16">Line</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((prop, idx) => (
            <PropertyEntryRow key={idx} property={prop} />
          ))}
        </TableBody>
      </Table>

      {unparsedLines.length > 0 && <UnparsedLinesDisplay lines={unparsedLines} />}
    </div>
  );
}

function PropertyEntryRow({ property }: { property: PropertyEntry }) {
  const hasErrors = property.issues.some(i => i.severity === 'error');
  const hasWarnings = property.issues.some(i => i.severity === 'warning');

  return (
    <>
      <TableRow className={cn(hasErrors && 'bg-red-500/5', hasWarnings && !hasErrors && 'bg-yellow-500/5')}>
        <TableCell><StatusIcon issues={property.issues} /></TableCell>
        <TableCell className="font-mono text-sm">{property.name}</TableCell>
        <TableCell className="font-mono text-sm max-w-[300px] truncate" title={property.value}>
          {property.value || <span className="text-muted-foreground italic">empty</span>}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">{property.lineNumber}</TableCell>
      </TableRow>
      {property.issues.length > 0 && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={4} className="py-1">
            <div className="flex flex-col gap-1 pl-8">
              {property.issues.map((issue, idx) => <IssueDisplay key={idx} issue={issue} />)}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================================
// Log Source Table
// ============================================================================

interface LogParseResultTableProps {
  result: LogParseResult;
}

function LogParseResultTable({ result }: LogParseResultTableProps) {
  const { entries, unparsedLines, summary } = result;

  if (entries.length === 0 && unparsedLines.length === 0) {
    return (
      <Empty className="border-none h-full py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListX className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No log entries found</EmptyTitle>
          <EmptyDescription>
            The script output didn't contain any log entries
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {summary.total} log entr{summary.total !== 1 ? 'ies' : 'y'} found
        </span>
        {summary.valid > 0 && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
            <SuccessIcon className="size-3" />
            {summary.valid} valid
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <WarningIcon className="size-3" />
            {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Log Entries Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Status</TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead>Message</TableHead>
            <TableHead className="w-16">Line</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, idx) => (
            <LogEntryRow key={idx} entry={entry} />
          ))}
        </TableBody>
      </Table>

      {unparsedLines.length > 0 && <UnparsedLinesDisplay lines={unparsedLines} />}
    </div>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const hasErrors = entry.issues.some(i => i.severity === 'error');
  const hasWarnings = entry.issues.some(i => i.severity === 'warning');

  return (
    <>
      <TableRow className={cn(hasErrors && 'bg-red-500/5', hasWarnings && !hasErrors && 'bg-yellow-500/5')}>
        <TableCell><StatusIcon issues={entry.issues} /></TableCell>
        <TableCell className="font-mono text-xs whitespace-nowrap">
          {entry.timestamp || <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="font-mono text-xs max-w-[400px] truncate" title={entry.message}>
          {entry.message}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">{entry.lineNumber}</TableCell>
      </TableRow>
      {entry.issues.length > 0 && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={4} className="py-1">
            <div className="flex flex-col gap-1 pl-8">
              {entry.issues.map((issue, idx) => <IssueDisplay key={idx} issue={issue} />)}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================================
// Config Source View
// ============================================================================

interface ConfigParseResultViewProps {
  result: ConfigParseResult;
}

function ConfigParseResultView({ result }: ConfigParseResultViewProps) {
  const { content, issues, summary } = result;

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          Configuration output ({content.length} characters)
        </span>
        {summary.errors === 0 && summary.warnings === 0 && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
            <SuccessIcon className="size-3" />
            Valid
          </Badge>
        )}
        {summary.errors > 0 && (
          <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
            <ErrorIcon className="size-3" />
            {summary.errors} error{summary.errors !== 1 ? 's' : ''}
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <WarningIcon className="size-3" />
            {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="flex flex-col gap-1">
          {issues.map((issue, idx) => <IssueDisplay key={idx} issue={issue} />)}
        </div>
      )}

      {/* Configuration Content */}
      <div className="bg-muted/30 rounded-md p-4 max-h-96 overflow-auto">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
          {content || <span className="text-muted-foreground italic">Empty configuration</span>}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// Shared: Unparsed Lines Display
// ============================================================================

interface UnparsedLinesDisplayProps {
  lines: Array<{ lineNumber: number; content: string; reason: string }>;
}

function UnparsedLinesDisplay({ lines }: UnparsedLinesDisplayProps) {
  return (
    <div className="mt-4">
      <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
        <Info className="size-4" />
        {lines.length} line{lines.length !== 1 ? 's' : ''} not parsed
      </div>
      <div className="bg-muted/30 rounded-md p-3 text-xs font-mono max-h-32 overflow-auto">
        {lines.map((line, idx) => (
          <div key={idx} className="text-muted-foreground">
            <span className="text-muted-foreground/50 mr-2">L{line.lineNumber}:</span>
            <span>{line.content || '(empty)'}</span>
            <span className="text-muted-foreground/50 ml-2">— {line.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
