/**
 * Developer Tools Panel for running integration tests.
 * Only visible in development builds.
 */

import { useState, useCallback, useRef } from 'react';
import { Play, Square, Trash2, FlaskConical, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useEditorStore } from '../../stores/editor-store';
import { TestResultsDialog } from './TestResultsDialog';
import {
  ALL_TEST_SUITES,
  runAllTestSuites,
  aggregateResults,
  type TestSuite,
  type TestSuiteResult,
  type TestRunProgress,
  type TestResult,
} from '../../utils/integration-tests';

interface TestSuiteCardProps {
  suite: TestSuite;
  isSelected: boolean;
  onToggle: () => void;
  isRunning: boolean;
  result?: TestSuiteResult;
}

function TestSuiteCard({ suite, isSelected, onToggle, isRunning, result }: TestSuiteCardProps) {
  const getStatusIcon = () => {
    if (isRunning) return <Loader2 className="size-4 animate-spin text-blue-500" />;
    if (!result) return <Clock className="size-4 text-muted-foreground" />;
    if (result.failed > 0) return <XCircle className="size-4 text-red-500" />;
    if (result.passed === result.totalTests) return <CheckCircle2 className="size-4 text-green-500" />;
    return <AlertTriangle className="size-4 text-yellow-500" />;
  };

  const getStatusBadge = () => {
    if (!result) return null;
    if (result.failed > 0) {
      return <Badge variant="destructive">{result.failed} failed</Badge>;
    }
    if (result.passed === result.totalTests) {
      return <Badge className="bg-green-600">All passed</Badge>;
    }
    return <Badge variant="secondary">{result.passed}/{result.totalTests} passed</Badge>;
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={isRunning}
        id={`suite-${suite.id}`}
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <label htmlFor={`suite-${suite.id}`} className="cursor-pointer font-medium text-sm">
            {suite.name}
          </label>
          <Badge variant="outline" className="text-xs">
            {suite.tests.length} tests
          </Badge>
          {getStatusBadge()}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{suite.description}</p>
        {result && (
          <p className="mt-1 text-xs text-muted-foreground">
            Duration: {(result.duration / 1000).toFixed(2)}s
          </p>
        )}
      </div>
    </div>
  );
}

export function DevToolsPanel() {
  const { selectedPortalId, portals } = useEditorStore();
  const selectedPortal = portals.find(p => p.id === selectedPortalId);

  const [selectedSuites, setSelectedSuites] = useState<Set<string>>(
    new Set(ALL_TEST_SUITES.map(s => s.id))
  );
  const [skipCleanup, setSkipCleanup] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<TestRunProgress | null>(null);
  const [results, setResults] = useState<TestSuiteResult[]>([]);
  const [currentResults, setCurrentResults] = useState<TestResult[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleToggleSuite = useCallback((suiteId: string) => {
    setSelectedSuites(prev => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedSuites(new Set(ALL_TEST_SUITES.map(s => s.id)));
  }, []);

  const handleSelectNone = useCallback(() => {
    setSelectedSuites(new Set());
  }, []);

  const handleRunTests = useCallback(async () => {
    if (!selectedPortalId || !selectedPortal) {
      return;
    }

    const suitesToRun = ALL_TEST_SUITES.filter(s => selectedSuites.has(s.id));
    if (suitesToRun.length === 0) {
      return;
    }

    abortControllerRef.current = new AbortController();
    setIsRunning(true);
    setResults([]);
    setCurrentResults([]);
    setProgress({ phase: 'setup', totalTests: 0, completedTests: 0 });

    try {
      const suiteResults = await runAllTestSuites(suitesToRun, {
        portalId: selectedPortalId,
        portalHostname: selectedPortal.hostname,
        skipCleanup,
        abortSignal: abortControllerRef.current.signal,
        onProgress: setProgress,
        onTestComplete: (result) => {
          setCurrentResults(prev => [...prev, result]);
        },
      });

      setResults(suiteResults);
      setShowResultsDialog(true);
    } catch (error) {
      console.error('Test run failed:', error);
    } finally {
      setIsRunning(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  }, [selectedPortalId, selectedPortal, selectedSuites, skipCleanup]);

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleClearResults = useCallback(() => {
    setResults([]);
    setCurrentResults([]);
  }, []);

  const selectedTestCount = ALL_TEST_SUITES
    .filter(s => selectedSuites.has(s.id))
    .reduce((sum, s) => sum + s.tests.length, 0);

  const aggregated = results.length > 0 ? aggregateResults(results) : null;

  const progressPercent = progress 
    ? (progress.completedTests / Math.max(progress.totalTests, 1)) * 100
    : 0;

  if (!selectedPortal) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Select a portal to run integration tests.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="size-5" />
              <CardTitle>Integration Tests</CardTitle>
            </div>
            <Badge variant="outline">
              Portal: {selectedPortal.hostname}
            </Badge>
          </div>
          <CardDescription>
            Run end-to-end tests against the LogicMonitor API to validate module operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRunTests}
                disabled={isRunning || selectedSuites.size === 0}
                className="gap-2"
              >
                <Play className="size-4" />
                Run {selectedTestCount} Tests
              </Button>
              {isRunning && (
                <Button variant="destructive" onClick={handleAbort} className="gap-2">
                  <Square className="size-4" />
                  Abort
                </Button>
              )}
              {results.length > 0 && !isRunning && (
                <Button variant="outline" onClick={handleClearResults} className="gap-2">
                  <Trash2 className="size-4" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="skip-cleanup"
                checked={skipCleanup}
                onCheckedChange={setSkipCleanup}
                disabled={isRunning}
              />
              <Label htmlFor="skip-cleanup" className="text-sm">
                Skip cleanup (for debugging)
              </Label>
            </div>
          </div>

          {/* Progress */}
          {isRunning && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{progress.phase}...</span>
                <span>{progress.completedTests} / {progress.totalTests}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              {progress.currentTest && (
                <p className="text-xs text-muted-foreground">
                  Running: {progress.currentTest}
                </p>
              )}
            </div>
          )}

          {/* Aggregated Results */}
          {aggregated && !isRunning && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                {aggregated.failed > 0 ? (
                  <XCircle className="size-5 text-red-500" />
                ) : (
                  <CheckCircle2 className="size-5 text-green-500" />
                )}
                <span className="font-medium">
                  {aggregated.failed > 0 ? 'Tests Failed' : 'All Tests Passed'}
                </span>
              </div>
              <Badge variant="secondary" className="bg-green-600/20 text-green-600">
                {aggregated.passed} passed
              </Badge>
              {aggregated.failed > 0 && (
                <Badge variant="destructive">
                  {aggregated.failed} failed
                </Badge>
              )}
              {aggregated.skipped > 0 && (
                <Badge variant="outline">
                  {aggregated.skipped} skipped
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Duration: {(aggregated.duration / 1000).toFixed(2)}s
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResultsDialog(true)}
              >
                View Details
              </Button>
            </div>
          )}

          {/* Live Results */}
          {isRunning && currentResults.length > 0 && (
            <ScrollArea className="h-32 rounded-md border">
              <div className="space-y-1 p-2">
                {currentResults.map((result, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {result.status === 'passed' ? (
                      <CheckCircle2 className="size-3 text-green-500" />
                    ) : result.status === 'failed' ? (
                      <XCircle className="size-3 text-red-500" />
                    ) : (
                      <Clock className="size-3 text-muted-foreground" />
                    )}
                    <span className={result.status === 'failed' ? 'text-red-500' : ''}>
                      {result.testName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({(result.duration / 1000).toFixed(2)}s)
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Test Suites */}
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Test Suites</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={isRunning}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSelectNone} disabled={isRunning}>
                Select None
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[525px]">
            <div className="space-y-2 pr-4">
              {ALL_TEST_SUITES.map(suite => (
                <TestSuiteCard
                  key={suite.id}
                  suite={suite}
                  isSelected={selectedSuites.has(suite.id)}
                  onToggle={() => handleToggleSuite(suite.id)}
                  isRunning={isRunning}
                  result={results.find(r => r.suiteId === suite.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <TestResultsDialog
        open={showResultsDialog}
        onOpenChange={setShowResultsDialog}
        results={results}
      />
    </div>
  );
}
