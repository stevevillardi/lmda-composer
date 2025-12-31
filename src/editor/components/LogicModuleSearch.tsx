import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Download,
  AlertTriangle,
  Timer,
  Search,
  FilePlus,
  ChevronDown,
  ChevronRight,
  Database,
  Braces,
  CaseSensitive,
  Target,
  Activity,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { editor } from 'monaco-editor';
import type { LogicModuleType, ModuleSearchMatchType, ScriptSearchResult, ScriptMatchRange } from '@/shared/types';
import { useEditorStore } from '../stores/editor-store';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { LoadingState } from './shared/LoadingState';
import { CopyButton } from './shared/CopyButton';
import { cn } from '@/lib/utils';
import { COLORS } from '../constants/colors';
import { LOGIC_MODULE_TYPES } from '../constants/logic-module-types';
import { buildMonacoOptions, getMonacoTheme } from '@/editor/utils/monaco-settings';

import '../monaco-loader';

const MATCH_LABELS = {
  substring: 'Substring',
  exact: 'Exact',
  regex: 'Regex',
} as const;

const ALERT_FOR_NO_DATA_LABELS: Record<number, string> = {
  1: 'Do not trigger an alert',
  2: 'Trigger warning alert',
  3: 'Trigger error alert',
  4: 'Trigger critical alert',
};

function formatPollInterval(seconds?: number): string {
  if (!seconds || seconds <= 0) return 'Unknown';
  if (seconds < 60) return `${seconds}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(minutes % 1 === 0 ? 0 : 1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function formatIntervalDetail(
  interval: number | undefined,
  collectInterval: number | undefined
): string {
  if (interval === undefined || interval === null) return 'n/a';
  if (interval === 0) return 'Immediate (no wait)';
  if (!collectInterval) return `${interval} polls`;
  const minutes = (interval * collectInterval) / 60;
  const minuteLabel = minutes >= 1 ? `${minutes.toFixed(minutes % 1 === 0 ? 0 : 1)} min` : '< 1 min';
  return `${interval} polls (~${minuteLabel})`;
}

type AlertLevel = 'warning' | 'error' | 'critical';

const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  warning: 'Warning',
  error: 'Error',
  critical: 'Critical',
};

const ALERT_LEVEL_STYLES: Record<AlertLevel, string> = {
  warning: COLORS.WARNING_STRONG.text,
  error: COLORS.ERROR_STRONG.text,
  critical: COLORS.CRITICAL_STRONG.text,
};

function parseAlertThresholds(expression: string | undefined): Array<{ level: AlertLevel; operator: string; value: number }> | null {
  if (!expression?.trim()) return null;
  const tokens = expression.trim().split(/\s+/);
  if (tokens.length < 2) return null;

  const operator = tokens[0];
  const values = tokens.slice(1).map((value) => Number(value)).filter((value) => !Number.isNaN(value));
  if (values.length === 0) return null;

  const thresholds: Array<{ level: AlertLevel; operator: string; value: number }> = [];

  if (values.length === 1) {
    thresholds.push({ level: 'warning', operator, value: values[0] });
    return thresholds;
  }

  if (values.length === 2) {
    const [warningValue, errorValue] = values;
    if (warningValue === errorValue) {
      thresholds.push({ level: 'error', operator, value: errorValue });
      return thresholds;
    }
    thresholds.push({ level: 'warning', operator, value: warningValue });
    thresholds.push({ level: 'error', operator, value: errorValue });
    return thresholds;
  }

  const [warningValue, errorValue, criticalValue] = values;
  if (errorValue === criticalValue && warningValue !== errorValue) {
    thresholds.push({ level: 'warning', operator, value: warningValue });
    thresholds.push({ level: 'critical', operator, value: errorValue });
    return thresholds;
  }
  if (warningValue === errorValue && errorValue === criticalValue) {
    thresholds.push({ level: 'critical', operator, value: criticalValue });
    return thresholds;
  }
  thresholds.push({ level: 'warning', operator, value: warningValue });
  thresholds.push({ level: 'error', operator, value: errorValue });
  thresholds.push({ level: 'critical', operator, value: criticalValue });
  return thresholds;
}

function dedupeLineHighlights(matches: ScriptMatchRange[]): ScriptMatchRange[] {
  const seen = new Set<number>();
  return matches.filter((match) => {
    if (seen.has(match.line)) return false;
    seen.add(match.line);
    return true;
  });
}

export function LogicModuleSearch() {
  const {
    selectedPortalId,
    moduleSearchOpen,
    setModuleSearchOpen,
    moduleSearchMode,
    setModuleSearchMode,
    moduleSearchTerm,
    setModuleSearchTerm,
    moduleSearchMatchType,
    setModuleSearchMatchType,
    moduleSearchCaseSensitive,
    setModuleSearchCaseSensitive,
    moduleSearchModuleTypes,
    setModuleSearchModuleTypes,
    isSearchingModules,
    moduleSearchProgress,
    moduleSearchIndexInfo,
    moduleScriptSearchResults,
    moduleDatapointSearchResults,
    moduleSearchError,
    selectedScriptSearchResult,
    selectedDatapointSearchResult,
    setSelectedScriptSearchResult,
    setSelectedDatapointSearchResult,
    clearModuleSearchResults,
    searchModuleScripts,
    searchDatapoints,
    refreshModuleSearchIndex,
    cancelModuleSearch,
    openModuleScripts,
    openTab,
    preferences,
  } = useEditorStore();

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const adEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const collectionEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const adDecorationsRef = useRef<string[]>([]);
  const collectionDecorationsRef = useRef<string[]>([]);

  const monacoTheme = useMemo(() => getMonacoTheme(preferences), [preferences]);

  const previewOptions = useMemo(() => buildMonacoOptions(preferences, {
    readOnly: true,
    fontSize: 12,
    lineNumbers: 'on',
    minimap: { enabled: false },
    wordWrap: 'off',
    tabSize: 4,
    renderLineHighlight: 'none',
    padding: { top: 8, bottom: 8 },
    domReadOnly: true,
    cursorStyle: 'line-thin',
    selectionHighlight: false,
    occurrencesHighlight: 'off',
    scrollbar: { horizontal: 'auto', vertical: 'auto' },
  }), [preferences]);

  useEffect(() => {
    if (moduleSearchOpen) {
      setCollapsedGroups({});
    }
  }, [moduleSearchOpen]);

  const groupedScriptResults = useMemo(() => {
    const grouped = new Map<LogicModuleType, ScriptSearchResult[]>();
    for (const result of moduleScriptSearchResults) {
      const existing = grouped.get(result.module.moduleType) || [];
      existing.push(result);
      grouped.set(result.module.moduleType, existing);
    }
    return grouped;
  }, [moduleScriptSearchResults]);

  const groupedDatapointResults = useMemo(() => {
    const grouped = new Map<string, typeof moduleDatapointSearchResults>();
    for (const result of moduleDatapointSearchResults) {
      const key = String(result.moduleId);
      const existing = grouped.get(key) || [];
      existing.push(result);
      grouped.set(key, existing);
    }
    return grouped;
  }, [moduleDatapointSearchResults]);

  const handleSearch = async () => {
    clearModuleSearchResults();
    if (moduleSearchMode === 'scripts') {
      await searchModuleScripts();
    } else {
      await searchDatapoints();
    }
  };

  const handleModuleTypesChange = (value: string | string[]) => {
    const selected = Array.isArray(value) ? value : [value];
    setModuleSearchModuleTypes(selected.filter(Boolean) as LogicModuleType[]);
  };

  const applyHighlights = (
    editorInstance: editor.IStandaloneCodeEditor | null,
    decorationRef: React.MutableRefObject<string[]>,
    matches: ScriptMatchRange[]
  ) => {
    if (!editorInstance) return;

    const inlineDecorations = matches.map((match) => ({
      range: {
        startLineNumber: match.line,
        startColumn: match.startColumn,
        endLineNumber: match.line,
        endColumn: match.endColumn,
      },
      options: { inlineClassName: 'monaco-search-inline' },
    }));

    const lineDecorations = dedupeLineHighlights(matches).map((match) => ({
      range: {
        startLineNumber: match.line,
        startColumn: 1,
        endLineNumber: match.line,
        endColumn: 1,
      },
      options: { isWholeLine: true, className: 'monaco-search-line' },
    }));

    decorationRef.current = editorInstance.deltaDecorations(
      decorationRef.current,
      [...lineDecorations, ...inlineDecorations]
    );

    if (matches.length > 0) {
      const first = matches[0];
      editorInstance.revealLineInCenter(first.line);
      editorInstance.setPosition({ lineNumber: first.line, column: first.startColumn });
    }
  };

  useEffect(() => {
    if (moduleSearchMode !== 'scripts' || !selectedScriptSearchResult) {
      if (adEditorRef.current) {
        adDecorationsRef.current = adEditorRef.current.deltaDecorations(adDecorationsRef.current, []);
      }
      if (collectionEditorRef.current) {
        collectionDecorationsRef.current = collectionEditorRef.current.deltaDecorations(collectionDecorationsRef.current, []);
      }
      return;
    }

    applyHighlights(adEditorRef.current, adDecorationsRef, selectedScriptSearchResult.adMatches);
    applyHighlights(collectionEditorRef.current, collectionDecorationsRef, selectedScriptSearchResult.collectionMatches);
  }, [moduleSearchMode, selectedScriptSearchResult]);

  const handleEditorMount = (type: 'ad' | 'collection') => {
    return (editorInstance: editor.IStandaloneCodeEditor) => {
      if (type === 'ad') {
        adEditorRef.current = editorInstance;
      } else {
        collectionEditorRef.current = editorInstance;
      }
      editorInstance.updateOptions({ readOnly: true });
      if (moduleSearchMode === 'scripts' && selectedScriptSearchResult) {
        const matches =
          type === 'ad'
            ? selectedScriptSearchResult.adMatches
            : selectedScriptSearchResult.collectionMatches;
        applyHighlights(editorInstance, type === 'ad' ? adDecorationsRef : collectionDecorationsRef, matches);
      }
    };
  };

  const handleLoadScript = (scriptType: 'ad' | 'collection') => {
    if (!selectedScriptSearchResult) return;
    const script = scriptType === 'ad'
      ? selectedScriptSearchResult.module.adScript
      : selectedScriptSearchResult.module.collectionScript;
    if (!script?.trim()) return;
    openModuleScripts(selectedScriptSearchResult.module, [{ type: scriptType, content: script }]);
    toast.success('Script loaded', {
      description: selectedScriptSearchResult.module.displayName || selectedScriptSearchResult.module.name,
    });
  };

  const handleCreateFile = (scriptType: 'ad' | 'collection') => {
    if (!selectedScriptSearchResult) return;
    const module = selectedScriptSearchResult.module;
    const script = scriptType === 'ad' ? module.adScript : module.collectionScript;
    if (!script?.trim()) return;
    const extension = module.scriptType === 'powerShell' ? 'ps1' : 'groovy';
    const language = module.scriptType === 'powerShell' ? 'powershell' : 'groovy';
    const displayName = `${module.name}/${scriptType}.${extension}`;

    openTab({
      displayName,
      content: script,
      language,
      mode: 'freeform',
    });
    toast.success('New file created', {
      description: `Created from ${module.displayName || module.name}`,
    });
  };

  const isSearchDisabled =
    !selectedPortalId ||
    !moduleSearchTerm.trim() ||
    (moduleSearchMode === 'scripts' && moduleSearchModuleTypes.length === 0);

  const progressValue = (() => {
    if (!moduleSearchProgress?.total || moduleSearchProgress.total === 0) return undefined;
    return Math.min(100, Math.round((moduleSearchProgress.processed / moduleSearchProgress.total) * 100));
  })();

  const indexAgeLabel = (() => {
    const indexedAt = moduleSearchIndexInfo?.indexedAt;
    if (!indexedAt) return 'Not indexed yet';
    const ageMs = Date.now() - indexedAt;
    if (ageMs < 60 * 1000) return 'Just now';
    if (ageMs < 60 * 60 * 1000) return `${Math.round(ageMs / (60 * 1000))}m ago`;
    if (ageMs < 24 * 60 * 60 * 1000) return `${Math.round(ageMs / (60 * 60 * 1000))}h ago`;
    return `${Math.round(ageMs / (24 * 60 * 60 * 1000))}d ago`;
  })();

  const renderResultsList = () => {
    if (isSearchingModules) {
      return (
        <LoadingState
          title="Searching..."
          description={
            moduleSearchMode === 'scripts'
              ? 'Scanning module scripts'
              : 'Scanning datasource datapoints'
          }
        />
      );
    }

    if (moduleSearchError) {
      return (
        <Empty>
          <EmptyMedia>
            <Braces className="size-8 text-destructive" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Search failed</EmptyTitle>
            <EmptyDescription>{moduleSearchError}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (!moduleSearchTerm.trim()) {
      return (
        <Empty>
          <EmptyMedia>
            <Search className="size-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Start a search</EmptyTitle>
            <EmptyDescription>Enter a query to scan scripts or datapoints.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (moduleSearchMode === 'scripts') {
      if (moduleSearchModuleTypes.length === 0) {
        return (
          <Empty>
            <EmptyMedia>
              <Search className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No module types selected</EmptyTitle>
              <EmptyDescription>Select at least one module type to search.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        );
      }
      if (moduleScriptSearchResults.length === 0) {
        return (
          <Empty>
            <EmptyMedia>
              <Search className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No matches found</EmptyTitle>
              <EmptyDescription>Try a different query or broaden your filters.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        );
      }

      return (
        <div className="space-y-3 p-3">
          {LOGIC_MODULE_TYPES.map((type) => {
            const results = groupedScriptResults.get(type.value) || [];
            if (!results.length) return null;
            const isOpen = !collapsedGroups[type.value];
            const Icon = type.icon;
            return (
              <Collapsible
                key={type.value}
                open={isOpen}
                onOpenChange={(open) =>
                  setCollapsedGroups((prev) => ({ ...prev, [type.value]: !open }))
                }
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                  <span className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    <Icon className="size-3.5" />
                    {type.label}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {results.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-1">
                  {results.map((result) => {
                    const isSelected = selectedScriptSearchResult?.module.id === result.module.id;
                    const collectionCount = result.collectionMatches.length;
                    const adCount = result.adMatches.length;
                    return (
                      <button
                        key={`${result.module.id}-${result.module.name}`}
                        className={cn(
                          'w-full text-left rounded-md border border-transparent px-2.5 py-2 transition',
                          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
                        )}
                        onClick={() => setSelectedScriptSearchResult(result)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {result.module.displayName || result.module.name}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {result.module.name}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {adCount > 0 && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] flex items-center gap-1"
                                aria-label={`${adCount} Active Discovery matches`}
                              >
                                <Target className="size-3 text-blue-500" />
                                {adCount}
                              </Badge>
                            )}
                            {collectionCount > 0 && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] flex items-center gap-1"
                                aria-label={`${collectionCount} Collection matches`}
                              >
                                <Activity className="size-3 text-green-500" />
                                {collectionCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {result.module.appliesTo && (
                          <div className="text-[11px] text-muted-foreground font-mono truncate mt-1">
                            appliesTo: {result.module.appliesTo}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      );
    }

    if (moduleDatapointSearchResults.length === 0) {
      return (
        <Empty>
          <EmptyMedia>
            <Database className="size-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No datapoints found</EmptyTitle>
            <EmptyDescription>Try a different query or adjust match settings.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <div className="space-y-3 p-3">
        {Array.from(groupedDatapointResults.entries()).map(([key, results]) => {
          const moduleName = results[0]?.moduleDisplayName || results[0]?.moduleName || 'Datasource';
          const isOpen = !collapsedGroups[key];
          return (
            <Collapsible
              key={key}
              open={isOpen}
              onOpenChange={(open) =>
                setCollapsedGroups((prev) => ({ ...prev, [key]: !open }))
              }
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  <Database className="size-3.5" />
                  {moduleName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {results.length}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {results.map((result) => {
                  const isSelected = selectedDatapointSearchResult?.dataPoint.id === result.dataPoint.id;
                  return (
                    <button
                      key={`${key}-${result.dataPoint.id}`}
                      className={cn(
                        'w-full text-left rounded-md border border-transparent px-2.5 py-2 transition',
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
                      )}
                      onClick={() => setSelectedDatapointSearchResult(result)}
                    >
                      <div className="text-sm font-medium truncate">{result.dataPoint.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{result.dataPoint.description}</div>
                    </button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };

  const renderPreviewPane = () => {
    if (moduleSearchMode === 'datapoints') {
      if (!selectedDatapointSearchResult) {
        return (
          <Empty>
            <EmptyMedia>
              <Database className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Select a datapoint</EmptyTitle>
              <EmptyDescription>Pick a result to view datapoint details.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        );
      }

      const { dataPoint } = selectedDatapointSearchResult;
      const pollInterval = selectedDatapointSearchResult.collectInterval;
      const alertForNoDataValue =
        typeof dataPoint.alertForNoData === 'boolean'
          ? (dataPoint.alertForNoData ? 4 : 1)
          : dataPoint.alertForNoData;
      const alertThresholds = parseAlertThresholds(dataPoint.alertExpr);
      return (
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm truncate">
                  {dataPoint.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {dataPoint.description || 'No description'}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {selectedDatapointSearchResult.moduleDisplayName}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground font-mono truncate">
              <span className="text-muted-foreground/50">module:</span> {selectedDatapointSearchResult.moduleName}
            </div>
            <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
              <span className="text-muted-foreground/50">appliesTo:</span> {selectedDatapointSearchResult.appliesTo || 'n/a'}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/70 bg-card/60 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="size-4" />
                  Alert Behavior
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Alert for No Data</span>
                    <span className="text-right font-medium">
                      {alertForNoDataValue ? ALERT_FOR_NO_DATA_LABELS[alertForNoDataValue] || `Level ${alertForNoDataValue}` : 'n/a'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Alert Thresholds</span>
                    {alertThresholds ? (
                      <div className="text-right flex flex-wrap justify-end gap-2">
                        {alertThresholds.map((threshold) => (
                          <span
                            key={`${threshold.level}-${threshold.value}-${threshold.operator}`}
                            className={cn('font-medium', ALERT_LEVEL_STYLES[threshold.level])}
                          >
                            {ALERT_LEVEL_LABELS[threshold.level]} {threshold.operator} {threshold.value}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-right text-muted-foreground">No threshold set</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-card/60 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Timer className="size-4" />
                  Timing
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Poll Interval</span>
                    <span className="text-right font-medium">{formatPollInterval(pollInterval)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Trigger Interval</span>
                    <span className="text-right font-medium">
                      {formatIntervalDetail(dataPoint.alertTransitionInterval, pollInterval)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Clear Interval</span>
                    <span className="text-right font-medium">
                      {formatIntervalDetail(dataPoint.alertClearTransitionInterval, pollInterval)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!selectedScriptSearchResult) {
      return (
        <Empty>
          <EmptyMedia>
            <Search className="size-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Select a module</EmptyTitle>
            <EmptyDescription>Pick a result to preview the matching scripts.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    const module = selectedScriptSearchResult.module;
    const language = module.scriptType === 'powerShell' ? 'powershell' : 'groovy';
    const monacoLanguage = language === 'groovy' ? 'groovy' : 'powershell';
    const hasADScript = !!module.adScript?.trim();
    const hasCollectionScript = !!module.collectionScript?.trim();
    const showDualPane = hasADScript && hasCollectionScript && (module.moduleType === 'datasource' || module.moduleType === 'configsource');

    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate">
                {module.displayName || module.name}
              </h3>
              <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                {module.name}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="font-mono text-xs">
                {module.collectMethod}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {language}
              </Badge>
            </div>
          </div>
          {module.appliesTo && (
            <div className="mt-2 text-xs text-muted-foreground font-mono truncate">
              <span className="text-muted-foreground/50">appliesTo:</span> {module.appliesTo}
            </div>
          )}
        </div>

        <div className={`flex-1 flex min-h-0 ${showDualPane ? 'flex-row' : 'flex-col'}`}>
          {hasADScript && (
            <div className={`flex flex-col ${showDualPane ? 'w-1/2 min-w-0 border-r border-border' : 'flex-1'}`}>
              <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-blue-500" />
                  <span className="text-xs font-medium">Active Discovery</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CopyButton
                    text={module.adScript || ''}
                    size="sm"
                    variant="outline"
                    className="h-7"
                    tooltip="Copy AD script"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLoadScript('ad')}
                    className="h-7 px-2 gap-1.5 text-xs"
                  >
                    <Download className="size-3" />
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateFile('ad')}
                    className="h-7 px-2 gap-1.5 text-xs"
                  >
                    <FilePlus className="size-3" />
                    New
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={monacoLanguage}
                  theme={monacoTheme}
                  value={module.adScript || ''}
                  onMount={handleEditorMount('ad')}
                  options={previewOptions}
                  loading={
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground text-xs">Loading...</div>
                    </div>
                  }
                />
              </div>
            </div>
          )}

          {showDualPane && hasADScript && hasCollectionScript && <Separator orientation="vertical" />}

          {hasCollectionScript && (
            <div className={`flex flex-col ${showDualPane ? 'w-1/2 min-w-0' : 'flex-1'}`}>
              <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-green-500" />
                  <span className="text-xs font-medium">Collection</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CopyButton
                    text={module.collectionScript || ''}
                    size="sm"
                    variant="outline"
                    className="h-7"
                    tooltip="Copy collection script"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLoadScript('collection')}
                    className="h-7 px-2 gap-1.5 text-xs"
                  >
                    <Download className="size-3" />
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateFile('collection')}
                    className="h-7 px-2 gap-1.5 text-xs"
                  >
                    <FilePlus className="size-3" />
                    New
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={monacoLanguage}
                  theme={monacoTheme}
                  value={module.collectionScript || ''}
                  onMount={handleEditorMount('collection')}
                  options={previewOptions}
                  loading={
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground text-xs">Loading...</div>
                    </div>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={moduleSearchOpen} onOpenChange={setModuleSearchOpen}>
      <DialogContent className="w-[90vw]! max-w-[90vw]! h-[90vh] flex flex-col gap-4 p-0" showCloseButton>
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-5" />
            LogicModule Search
          </DialogTitle>
          <DialogDescription>
            Search across scripts and datasource datapoints to find exact usage and definitions.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              value={[moduleSearchMode]}
              onValueChange={(value) => {
                const selected = Array.isArray(value) ? value[0] : value;
                if (selected) {
                  setModuleSearchMode(selected as 'scripts' | 'datapoints');
                }
              }}
              variant="outline"
              className="gap-1"
            >
              <ToggleGroupItem value="scripts" className="px-3 text-xs">
                Scripts
              </ToggleGroupItem>
              <ToggleGroupItem value="datapoints" className="px-3 text-xs">
                Datapoints
              </ToggleGroupItem>
            </ToggleGroup>

            <Separator orientation="vertical" className="h-6" />

            <ToggleGroup
              value={[moduleSearchMatchType]}
              onValueChange={(value) => {
                const selected = Array.isArray(value) ? value[0] : value;
                if (selected) {
                  setModuleSearchMatchType(selected as ModuleSearchMatchType);
                }
              }}
              variant="outline"
              className="gap-1"
            >
              {Object.entries(MATCH_LABELS).map(([value, label]) => (
                <ToggleGroupItem key={value} value={value} className="px-3 text-xs">
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Toggle
                    pressed={moduleSearchCaseSensitive}
                    onPressedChange={setModuleSearchCaseSensitive}
                    variant="outline"
                    size="sm"
                    aria-label="Toggle case sensitivity"
                    className="gap-1.5"
                  >
                    <CaseSensitive className="size-3.5" />
                    Aa
                  </Toggle>
                }
              />
              <TooltipContent>Case sensitive</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={moduleSearchMode === 'scripts' ? 'Search scripts...' : 'Search datapoints...'}
                value={moduleSearchTerm}
                onChange={(e) => setModuleSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="pl-8 pr-2 h-9"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleSearch}
              disabled={isSearchDisabled || isSearchingModules}
              className="h-9"
            >
              <Search className="size-4 mr-2" />
              Search
            </Button>
            {(isSearchingModules || moduleSearchProgress?.stage === 'indexing') && (
              <Button
                variant="outline"
                size="sm"
                onClick={cancelModuleSearch}
                className="h-9"
              >
                <X className="size-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>
                Index: {indexAgeLabel}
                {moduleSearchIndexInfo?.moduleCount
                  ? ` (${moduleSearchIndexInfo.moduleCount.toLocaleString()} modules)`
                  : ''}
              </span>
              {moduleSearchIndexInfo?.isStale && (
                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                  Stale
                </Badge>
              )}
              <Button
                variant="ghost"
                size="xs"
                onClick={refreshModuleSearchIndex}
                className="gap-1 text-xs"
                disabled={!selectedPortalId}
              >
                <RefreshCw className="size-3" />
                Refresh index
              </Button>
            </div>
            {moduleSearchProgress && (
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wide">
                  {moduleSearchProgress.stage === 'indexing' ? 'Indexing' : 'Searching'}
                </span>
                <span>
                  {moduleSearchProgress.processed.toLocaleString()}
                  {moduleSearchProgress.total ? ` / ${moduleSearchProgress.total.toLocaleString()}` : ''}{' '}
                  {moduleSearchProgress.stage === 'indexing' ? 'indexed' : 'scanned'}
                  {typeof moduleSearchProgress.matched === 'number' ? ` • ${moduleSearchProgress.matched.toLocaleString()} matches` : ''}
                </span>
                {progressValue !== undefined && (
                  <div className="w-24">
                    <Progress value={progressValue} />
                  </div>
                )}
              </div>
            )}
          </div>

          {moduleSearchMode === 'scripts' && (
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                value={moduleSearchModuleTypes}
                onValueChange={handleModuleTypesChange}
                variant="outline"
                className="w-full justify-start flex-wrap"
              >
                {LOGIC_MODULE_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <ToggleGroupItem
                      key={type.value}
                      value={type.value}
                      className="flex items-center gap-1.5 px-3"
                    >
                      <Icon className="size-4" />
                      <span className="hidden sm:inline">{type.label}</span>
                      <span className="sm:hidden">{type.shortLabel}</span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>
          )}
        </div>

        <div className="flex-1 flex min-h-0 border-t border-border">
          <div className="w-96 shrink-0 border-r border-border flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-border bg-secondary/20 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                {moduleSearchMode === 'scripts'
                  ? `${moduleScriptSearchResults.length} module${moduleScriptSearchResults.length === 1 ? '' : 's'}`
                  : `${moduleDatapointSearchResults.length} datapoint${moduleDatapointSearchResults.length === 1 ? '' : 's'}`}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {MATCH_LABELS[moduleSearchMatchType]}
              </Badge>
            </div>
            <div className="flex-1 overflow-auto">
              {renderResultsList()}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {renderPreviewPane()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
