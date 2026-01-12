/**
 * Dialog for displaying detailed test results.
 */

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, AlertTriangle, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { aggregateResults, type TestSuiteResult, type TestResult } from '../../utils/integration-tests';

interface TestResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: TestSuiteResult[];
}

interface TestResultItemProps {
  result: TestResult;
  isExpanded: boolean;
  onToggle: () => void;
}

function TestResultItem({ result, isExpanded, onToggle }: TestResultItemProps) {
  const [copied, setCopied] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState<'request' | 'response' | null>(null);

  const handleCopyError = () => {
    if (result.error) {
      navigator.clipboard.writeText(result.error + (result.stack ? '\n\n' + result.stack : ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyPayload = (type: 'request' | 'response') => {
    const payload = type === 'request' ? result.requestPayload : result.apiResponse;
    if (payload) {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedPayload(type);
      setTimeout(() => setCopiedPayload(null), 2000);
    }
  };

  const getStatusIcon = () => {
    switch (result.status) {
      case 'passed':
        return <CheckCircle2 className="size-4 text-green-500" />;
      case 'failed':
        return <XCircle className="size-4 text-red-500" />;
      case 'skipped':
        return <Clock className="size-4 text-muted-foreground" />;
      default:
        return <Clock className="size-4 text-muted-foreground" />;
    }
  };

  const hasDetails = !!(result.error || result.stack || result.details || result.requestPayload || result.apiResponse);

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50"
        onClick={onToggle}
        disabled={!hasDetails}
      >
        {hasDetails ? (
          isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )
        ) : (
          <div className="size-4" />
        )}
        {getStatusIcon()}
        <span className="flex-1 font-medium text-sm">{result.testName}</span>
        <span className="text-xs text-muted-foreground">
          {(result.duration / 1000).toFixed(2)}s
        </span>
        {result.moduleId && (
          <Badge variant="outline" className="text-xs">
            ID: {result.moduleId}
          </Badge>
        )}
      </button>
      {isExpanded && hasDetails && (
        <div className="border-t border-border bg-muted/20 p-3">
          {result.error && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-red-500">Error:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyError}
                  className="h-6 gap-1 px-2 text-xs"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded bg-destructive/10 p-2 text-xs text-red-500">
                {result.error}
              </pre>
            </div>
          )}
          {result.stack && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Stack trace
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                {result.stack}
              </pre>
            </details>
          )}
          {result.details && (
            <div className="mt-2">
              <span className="text-xs font-medium text-muted-foreground">Details:</span>
              <p className="mt-1 text-xs">{result.details}</p>
            </div>
          )}
          {result.requestPayload !== undefined && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-2">
                <span>Request Payload</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyPayload('request');
                  }}
                  className="h-5 gap-1 px-2 text-xs"
                >
                  {copiedPayload === 'request' ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copiedPayload === 'request' ? 'Copied' : 'Copy'}
                </Button>
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                {JSON.stringify(result.requestPayload, null, 2)}
              </pre>
            </details>
          )}
          {result.apiResponse !== undefined && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-2">
                <span>API Response</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyPayload('response');
                  }}
                  className="h-5 gap-1 px-2 text-xs"
                >
                  {copiedPayload === 'response' ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copiedPayload === 'response' ? 'Copied' : 'Copy'}
                </Button>
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                {JSON.stringify(result.apiResponse, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

interface SuiteResultsPanelProps {
  suiteResult: TestSuiteResult;
}

function SuiteResultsPanel({ suiteResult }: SuiteResultsPanelProps) {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  const toggleTest = (testId: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const failedTests = suiteResult.results.filter(r => r.status === 'failed');
  const passedTests = suiteResult.results.filter(r => r.status === 'passed');
  const skippedTests = suiteResult.results.filter(r => r.status === 'skipped');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="bg-green-600/20 text-green-600">
          {suiteResult.passed} passed
        </Badge>
        {suiteResult.failed > 0 && (
          <Badge variant="destructive">
            {suiteResult.failed} failed
          </Badge>
        )}
        {suiteResult.skipped > 0 && (
          <Badge variant="outline">
            {suiteResult.skipped} skipped
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          Duration: {(suiteResult.duration / 1000).toFixed(2)}s
        </span>
        {!suiteResult.cleanupSuccessful && (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            <AlertTriangle className="mr-1 size-3" />
            Cleanup issues
          </Badge>
        )}
      </div>

      {/* Cleanup errors */}
      {suiteResult.cleanupErrors && suiteResult.cleanupErrors.length > 0 && (
        <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
          <p className="mb-2 text-sm font-medium text-yellow-600">Cleanup Errors:</p>
          <ul className="list-inside list-disc text-xs text-yellow-600">
            {suiteResult.cleanupErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Failed tests first */}
      {failedTests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-500">Failed Tests</h4>
          {failedTests.map(result => (
            <TestResultItem
              key={result.testId}
              result={result}
              isExpanded={expandedTests.has(result.testId)}
              onToggle={() => toggleTest(result.testId)}
            />
          ))}
        </div>
      )}

      {/* Passed tests */}
      {passedTests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-green-500">Passed Tests</h4>
          {passedTests.map(result => (
            <TestResultItem
              key={result.testId}
              result={result}
              isExpanded={expandedTests.has(result.testId)}
              onToggle={() => toggleTest(result.testId)}
            />
          ))}
        </div>
      )}

      {/* Skipped tests */}
      {skippedTests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Skipped Tests</h4>
          {skippedTests.map(result => (
            <TestResultItem
              key={result.testId}
              result={result}
              isExpanded={expandedTests.has(result.testId)}
              onToggle={() => toggleTest(result.testId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TestResultsDialog({ open, onOpenChange, results }: TestResultsDialogProps) {
  const aggregated = results.length > 0 ? aggregateResults(results) : null;

  if (!aggregated) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]! max-w-[75vw]!">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {aggregated.failed > 0 ? (
              <XCircle className="size-5 text-red-500" />
            ) : (
              <CheckCircle2 className="size-5 text-green-500" />
            )}
            Test Results
          </DialogTitle>
          <DialogDescription>
            {aggregated.passed} of {aggregated.totalTests} tests passed in {(aggregated.duration / 1000).toFixed(2)}s
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={results[0]?.suiteId || 'summary'} className="mt-4">
          <TabsList className="mb-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            {results.map(result => (
              <TabsTrigger key={result.suiteId} value={result.suiteId}>
                {result.suiteName}
                {result.failed > 0 && (
                  <Badge variant="destructive" className="ml-2 size-5 justify-center rounded-full p-0 text-xs">
                    {result.failed}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="summary">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                {/* Overall summary */}
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-2xl font-bold">{aggregated.passed}/{aggregated.totalTests}</p>
                    <p className="text-sm text-muted-foreground">Tests Passed</p>
                  </div>
                  <div className="h-12 w-px bg-border" />
                  <div>
                    <p className="text-2xl font-bold">{(aggregated.duration / 1000).toFixed(1)}s</p>
                    <p className="text-sm text-muted-foreground">Total Duration</p>
                  </div>
                  <div className="h-12 w-px bg-border" />
                  <div>
                    <p className="text-2xl font-bold">{results.length}</p>
                    <p className="text-sm text-muted-foreground">Test Suites</p>
                  </div>
                </div>

                {/* Suite breakdown */}
                <div className="space-y-3">
                  <h3 className="font-medium">Suite Breakdown</h3>
                  {results.map(result => (
                    <div
                      key={result.suiteId}
                      className="flex items-center justify-between rounded-md border border-border p-3"
                    >
                      <div className="flex items-center gap-2">
                        {result.failed > 0 ? (
                          <XCircle className="size-4 text-red-500" />
                        ) : (
                          <CheckCircle2 className="size-4 text-green-500" />
                        )}
                        <span className="font-medium">{result.suiteName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-green-600/20 text-green-600">
                          {result.passed} passed
                        </Badge>
                        {result.failed > 0 && (
                          <Badge variant="destructive">{result.failed} failed</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {(result.duration / 1000).toFixed(2)}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {results.map(result => (
            <TabsContent key={result.suiteId} value={result.suiteId}>
              <ScrollArea className="h-[400px]">
                <div className="pr-4">
                  <SuiteResultsPanel suiteResult={result} />
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
