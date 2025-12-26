import { CheckCircle2, XCircle, AlertTriangle, Info, FileText } from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  getAllIssues, 
  getIssuesBySeverity,
  type ValidationIssue,
  type ParseResult,
} from '../utils/output-parser';

export function ValidationContent() {
  const { parsedOutput, mode, currentExecution } = useEditorStore();

  // No execution yet
  if (!currentExecution) {
    return (
      <div className="text-muted-foreground p-4">
        Run a script to see validation results here.
      </div>
    );
  }

  // Execution failed
  if (currentExecution.status === 'error') {
    return (
      <div className="p-4">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-500">
              <XCircle className="size-4" />
              Execution Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {currentExecution.error || 'Unknown error occurred during script execution.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  // No parsed output available
  if (!parsedOutput) {
    return (
      <div className="text-muted-foreground p-4">
        {mode === 'freeform' 
          ? 'Validation is not available in Freeform mode.'
          : 'No validation data available. Run a script to see results.'}
      </div>
    );
  }

  return <ValidationSummary result={parsedOutput} />;
}

interface ValidationSummaryProps {
  result: ParseResult;
}

function ValidationSummary({ result }: ValidationSummaryProps) {
  const { summary } = result;
  const allIssues = getAllIssues(result);
  const errors = getIssuesBySeverity(result, 'error');
  const warnings = getIssuesBySeverity(result, 'warning');
  const infos = getIssuesBySeverity(result, 'info');

  const allValid = summary.errors === 0 && summary.warnings === 0;

  return (
    <div className="p-4 space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          title="Total"
          value={summary.total}
          icon={FileText}
          className="bg-muted/30"
        />
        <SummaryCard
          title="Valid"
          value={summary.valid}
          icon={CheckCircle2}
          className={summary.valid > 0 ? 'bg-green-500/10 text-green-600' : 'bg-muted/30'}
        />
        <SummaryCard
          title="Errors"
          value={summary.errors}
          icon={XCircle}
          className={summary.errors > 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted/30'}
        />
        <SummaryCard
          title="Warnings"
          value={summary.warnings}
          icon={AlertTriangle}
          className={summary.warnings > 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-muted/30'}
        />
      </div>

      {/* All Valid Message */}
      {allValid && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="size-6 text-green-600" />
            <div>
              <div className="font-medium text-green-600">All Valid</div>
              <div className="text-sm text-muted-foreground">
                All {summary.total} {result.type === 'ad' ? 'instances' : 'datapoints'} passed validation.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issues List */}
      {allIssues.length > 0 && (
        <div className="space-y-4">
          {/* Errors Section */}
          {errors.length > 0 && (
            <IssueSection
              title="Errors"
              issues={errors}
              icon={XCircle}
              iconClass="text-red-500"
              badgeVariant="destructive"
            />
          )}

          {/* Warnings Section */}
          {warnings.length > 0 && (
            <IssueSection
              title="Warnings"
              issues={warnings}
              icon={AlertTriangle}
              iconClass="text-yellow-500"
              badgeVariant="outline"
              badgeClass="text-yellow-500 border-yellow-500/30"
            />
          )}

          {/* Info Section */}
          {infos.length > 0 && (
            <IssueSection
              title="Info"
              issues={infos}
              icon={Info}
              iconClass="text-blue-500"
              badgeVariant="outline"
              badgeClass="text-blue-500 border-blue-500/30"
            />
          )}
        </div>
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}

function SummaryCard({ title, value, icon: Icon, className }: SummaryCardProps) {
  return (
    <Card className={cn('border-none', className)}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{title}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
          <Icon className="size-6 opacity-60" />
        </div>
      </CardContent>
    </Card>
  );
}

interface IssueSectionProps {
  title: string;
  issues: ValidationIssue[];
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  badgeVariant: 'default' | 'destructive' | 'outline' | 'secondary';
  badgeClass?: string;
}

function IssueSection({ 
  title, 
  issues, 
  icon: Icon, 
  iconClass,
  badgeVariant,
  badgeClass,
}: IssueSectionProps) {
  // Group issues by line number
  const groupedByLine = issues.reduce((acc, issue) => {
    if (!acc[issue.lineNumber]) {
      acc[issue.lineNumber] = [];
    }
    acc[issue.lineNumber].push(issue);
    return acc;
  }, {} as Record<number, ValidationIssue[]>);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('size-4', iconClass)} />
        <span className="text-sm font-medium">{title}</span>
        <Badge variant={badgeVariant} className={cn('text-xs', badgeClass)}>
          {issues.length}
        </Badge>
      </div>
      
      <Card className="divide-y divide-border">
        {Object.entries(groupedByLine)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([lineNum, lineIssues]) => (
            <div key={lineNum} className="px-3 py-2">
              <div className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground font-mono shrink-0 pt-0.5">
                  Line {lineNum}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex-1 space-y-1">
                  {lineIssues.map((issue, idx) => (
                    <div 
                      key={idx}
                      className="text-sm flex items-center gap-2"
                    >
                      <span>{issue.message}</span>
                      {issue.field && (
                        <Badge 
                          variant="secondary" 
                          className="h-4 px-1.5 text-[10px] font-mono"
                        >
                          {issue.field}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
}

