import { CheckCircle2, XCircle, AlertTriangle, Info, ChevronDown, ChevronRight, Play, Terminal, ListX } from 'lucide-react';
import { useState } from 'react';
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
  ValidationIssue,
} from '../utils/output-parser';

export function ParsedContent() {
  const { parsedOutput, mode, currentExecution } = useEditorStore();

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
            <XCircle className="size-5 text-red-500" />
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
  if (parsedOutput.type === 'ad') {
    return <ADParseResultTable result={parsedOutput} />;
  }

  return <CollectionParseResultTable result={parsedOutput} />;
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
            <CheckCircle2 className="size-3" />
            {summary.valid} valid
          </Badge>
        )}
        {summary.errors > 0 && (
          <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
            <XCircle className="size-3" />
            {summary.errors} error{summary.errors !== 1 ? 's' : ''}
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <AlertTriangle className="size-3" />
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
  const { datapoints, unparsedLines, summary, type } = result;
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
        {summary.valid > 0 && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
            <CheckCircle2 className="size-3" />
            {summary.valid} valid
          </Badge>
        )}
        {summary.errors > 0 && (
          <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
            <XCircle className="size-3" />
            {summary.errors} error{summary.errors !== 1 ? 's' : ''}
          </Badge>
        )}
        {summary.warnings > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
            <AlertTriangle className="size-3" />
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
          {datapoint.value !== null ? (
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
    return <XCircle className="size-4 text-red-500" />;
  }
  if (hasWarnings) {
    return <AlertTriangle className="size-4 text-yellow-500" />;
  }
  return <CheckCircle2 className="size-4 text-green-600" />;
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
    error: XCircle,
    warning: AlertTriangle,
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

