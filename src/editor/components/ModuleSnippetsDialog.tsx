import { useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Search,
  Puzzle,
  RefreshCw,
  Plus,
  Clock,
  Server,
  Download,
  ChevronDown,
  ChevronRight,
  Database
} from 'lucide-react';
import type { editor } from 'monaco-editor';
import { useEditorStore } from '../stores/editor-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LoadingState } from './shared/LoadingState';
import { CopyButton } from './shared/CopyButton';
import { cn } from '@/lib/utils';
import { buildMonacoOptions, getMonacoTheme } from '@/editor/utils/monaco-settings';
import type { ModuleSnippetInfo } from '@/shared/types';

import '../monaco-loader';

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Extract category from snippet name (e.g., "cisco.meraki" -> "cisco", "lm.emit" -> "lm")
function getSnippetCategory(name: string): string {
  const parts = name.split('.');
  return parts[0] || 'other';
}

// Category display labels
const CATEGORY_LABELS: Record<string, string> = {
  lm: 'LogicMonitor',
  cisco: 'Cisco',
  aruba: 'Aruba',
  vmware: 'VMware',
  emc: 'EMC/Dell',
  paloalto: 'Palo Alto',
  netapp: 'NetApp',
  juniper: 'Juniper',
  proto: 'Protocols',
  velocloud: 'VeloCloud',
  versa: 'Versa',
  cato: 'Cato',
  cohesity: 'Cohesity',
  hp: 'HP',
  oracle: 'Oracle',
  loader: 'Loader',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

export function ModuleSnippetsDialog() {
  const {
    moduleSnippetsDialogOpen,
    setModuleSnippetsDialogOpen,
    moduleSnippets,
    moduleSnippetsCacheMeta,
    moduleSnippetsLoading,
    selectedModuleSnippet,
    moduleSnippetSource,
    moduleSnippetSourceLoading,
    moduleSnippetsSearchQuery,
    cachedSnippetVersions,
    fetchModuleSnippets,
    selectModuleSnippet,
    insertModuleSnippetImport,
    setModuleSnippetsSearchQuery,
    selectedPortalId,
    selectedCollectorId,
    collectors,
    preferences,
  } = useEditorStore();

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
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

  // Get collector info
  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);
  const hasContext = selectedPortalId && selectedCollectorId;
  const hasCache = moduleSnippets.length > 0;

  // Filter and group snippets by category
  const { filteredSnippets, groupedSnippets, categories } = useMemo(() => {
    let filtered = moduleSnippets;
    if (moduleSnippetsSearchQuery.trim()) {
      const query = moduleSnippetsSearchQuery.toLowerCase();
      filtered = moduleSnippets.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort alphabetically
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    
    // Group by category
    const grouped = new Map<string, ModuleSnippetInfo[]>();
    for (const snippet of sorted) {
      const category = getSnippetCategory(snippet.name);
      const existing = grouped.get(category) || [];
      existing.push(snippet);
      grouped.set(category, existing);
    }
    
    // Sort categories (lm first, then alphabetically)
    const categoryOrder = Array.from(grouped.keys()).sort((a, b) => {
      if (a === 'lm') return -1;
      if (b === 'lm') return 1;
      return getCategoryLabel(a).localeCompare(getCategoryLabel(b));
    });
    
    return { 
      filteredSnippets: sorted, 
      groupedSnippets: grouped,
      categories: categoryOrder,
    };
  }, [moduleSnippets, moduleSnippetsSearchQuery]);

  // Get the currently selected snippet info
  const selectedSnippetInfo = moduleSnippets.find(
    s => s.name === selectedModuleSnippet?.name
  );

  // Check if current selection is cached
  const isCurrentVersionCached = selectedModuleSnippet
    ? cachedSnippetVersions.has(`${selectedModuleSnippet.name}:${selectedModuleSnippet.version}`)
    : false;

  const handleInsertImport = () => {
    if (selectedModuleSnippet) {
      insertModuleSnippetImport(selectedModuleSnippet.name, selectedModuleSnippet.version);
    }
  };

  const handleVersionChange = (version: string | null) => {
    if (selectedModuleSnippet && version) {
      selectModuleSnippet(selectedModuleSnippet.name, version);
    }
  };

  const handleEditorMount = (editorInstance: editor.IStandaloneCodeEditor) => {
    editorRef.current = editorInstance;
    editorInstance.updateOptions({ readOnly: true });
  };

  const toggleCategory = (category: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const renderSnippetList = () => {
    if (moduleSnippetsLoading && !hasCache) {
      return (
        <LoadingState
          title="Fetching snippets..."
          description={`Querying collector ${selectedCollector?.description || `#${selectedCollectorId}`}`}
          className="border-0"
        />
      );
    }

    if (filteredSnippets.length === 0) {
      if (moduleSnippetsSearchQuery.trim()) {
        return (
          <Empty className="border-none h-full py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search className="size-5" />
              </EmptyMedia>
              <EmptyTitle className="text-base">No matches</EmptyTitle>
              <EmptyDescription>
                No snippets match &quot;{moduleSnippetsSearchQuery}&quot;
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        );
      }
      return null;
    }

    return (
      <div className="p-3 space-y-2">
        {categories.map((category) => {
          const snippets = groupedSnippets.get(category) || [];
          if (snippets.length === 0) return null;
          
          const isCollapsed = collapsedGroups[category] ?? false;
          const label = getCategoryLabel(category);
          
          return (
            <Collapsible
              key={category}
              open={!isCollapsed}
              onOpenChange={() => toggleCategory(category)}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                  <span>{label}</span>
                </span>
                <Badge variant="outline" className="text-xs">
                  {snippets.length}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {snippets.map((snippet) => {
                  const isSelected = selectedModuleSnippet?.name === snippet.name;
                  const hasCachedVersion = snippet.versions.some(v => 
                    cachedSnippetVersions.has(`${snippet.name}:${v}`)
                  );
                  
                  return (
                    <button
                      key={snippet.name}
                      type="button"
                      onClick={() => selectModuleSnippet(snippet.name, snippet.latestVersion)}
                      className={cn(
                        'w-full text-left rounded-md border border-transparent px-2.5 py-2 transition',
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{snippet.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasCachedVersion && (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Database className="size-3 text-emerald-500" />
                                }
                              />
                              <TooltipContent>Source cached locally</TooltipContent>
                            </Tooltip>
                          )}
                          <Badge variant="outline" className="text-[10px] h-5">
                            v{snippet.latestVersion}
                          </Badge>
                        </div>
                      </div>
                      {snippet.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {snippet.description}
                        </p>
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
  };

  const renderPreviewPane = () => {
    if (!selectedModuleSnippet) {
      return (
        <Empty className="flex-1 border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Puzzle className="size-5" />
            </EmptyMedia>
            <EmptyTitle className="text-base">Select a module</EmptyTitle>
            <EmptyDescription>
              Choose a module from the list to view its source code
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate">
                {selectedModuleSnippet.name}
              </h3>
              {selectedSnippetInfo?.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {selectedSnippetInfo.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedSnippetInfo && (
                <Select
                  value={selectedModuleSnippet.version}
                  onValueChange={handleVersionChange}
                >
                  <SelectTrigger className="h-8 w-auto gap-2 text-xs min-w-[100px]">
                    <div className="flex items-center gap-1.5">
                      {isCurrentVersionCached && (
                        <Database className="size-3 text-emerald-500" />
                      )}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">
                        {selectedSnippetInfo.versions.length} version{selectedSnippetInfo.versions.length === 1 ? '' : 's'} available
                      </SelectLabel>
                      {selectedSnippetInfo.versions.map((v) => {
                        const isCached = cachedSnippetVersions.has(`${selectedModuleSnippet.name}:${v}`);
                        const isLatest = v === selectedSnippetInfo.latestVersion;
                        return (
                          <SelectItem key={v} value={v}>
                            <div className="flex items-center gap-2">
                              <span>v{v}</span>
                              {isLatest && (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                  latest
                                </Badge>
                              )}
                              {isCached && (
                                <Database className="size-3 text-emerald-500 ml-auto" />
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <Badge variant="outline" className="text-xs">
                {selectedSnippetInfo?.language || 'groovy'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions bar */}
        <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Puzzle className="size-4" />
            <span className="text-xs font-medium">Source Code</span>
            {isCurrentVersionCached && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                <Database className="size-3" />
                Cached
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {moduleSnippetSource && (
              <CopyButton
                text={moduleSnippetSource}
                size="sm"
                variant="outline"
                className="h-7"
                tooltip="Copy source code"
              />
            )}
            <Button
              size="sm"
              variant="default"
              onClick={handleInsertImport}
              className="h-7 px-2 gap-1.5 text-xs"
            >
              <Plus className="size-3" />
              Insert Import
            </Button>
          </div>
        </div>

        {/* Source content */}
        <div className="flex-1 min-h-0">
          {moduleSnippetSourceLoading ? (
            <LoadingState
              title="Loading source..."
              description={`Fetching ${selectedModuleSnippet.name} v${selectedModuleSnippet.version} from collector`}
              className="border-0"
            />
          ) : moduleSnippetSource ? (
            <Editor
              height="100%"
              language="groovy"
              theme={monacoTheme}
              value={moduleSnippetSource}
              onMount={handleEditorMount}
              options={previewOptions}
              loading={
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground text-xs">Loading editor...</div>
                </div>
              }
            />
          ) : (
            <Empty className="flex-1 border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Download className="size-5" />
                </EmptyMedia>
                <EmptyTitle className="text-base">Failed to load source</EmptyTitle>
                <EmptyDescription>
                  Could not retrieve source code from the collector
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={moduleSnippetsDialogOpen} onOpenChange={setModuleSnippetsDialogOpen}>
      <DialogContent className="w-[90vw]! max-w-[90vw]! h-[90vh] flex flex-col gap-4 p-0" showCloseButton>
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="size-5" />
            Module Snippets
          </DialogTitle>
          <DialogDescription>
            Browse LogicMonitor&apos;s reusable code modules and insert import patterns into your scripts.
          </DialogDescription>
        </DialogHeader>

        {/* Main Content */}
        {!hasCache && !moduleSnippetsLoading ? (
          // Empty State
          <EmptyState
            hasContext={!!hasContext}
            isLoading={moduleSnippetsLoading}
            collectorDescription={selectedCollector?.description}
            collectorId={selectedCollectorId}
            onFetch={fetchModuleSnippets}
          />
        ) : (
          <div className="flex-1 flex min-h-0 border-t border-border">
            {/* Left Panel - Snippet List */}
            <div className="w-96 shrink-0 border-r border-border flex flex-col min-h-0">
              {/* Search */}
              <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search snippets..."
                      value={moduleSnippetsSearchQuery}
                      onChange={(e) => setModuleSnippetsSearchQuery(e.target.value)}
                      className="pl-8 pr-7 h-8"
                    />
                    {moduleSnippetsSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => setModuleSnippetsSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={fetchModuleSnippets}
                          disabled={moduleSnippetsLoading || !hasContext}
                          className={cn(
                            "size-8 transition-all duration-200",
                            moduleSnippetsLoading && "opacity-70"
                          )}
                        >
                          <RefreshCw 
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              moduleSnippetsLoading && "animate-spin"
                            )} 
                          />
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {moduleSnippetsLoading ? 'Fetching from collector...' : 'Refresh from collector'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Results count */}
              <div className="px-4 py-2 border-b border-border bg-secondary/20 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  {filteredSnippets.length} module{filteredSnippets.length === 1 ? '' : 's'}
                  {categories.length > 0 && ` in ${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`}
                </span>
                {moduleSnippetsCacheMeta && (
                  <div className="flex items-center gap-1 text-muted-foreground/70">
                    <Clock className="size-3" />
                    <span>{formatRelativeTime(moduleSnippetsCacheMeta.fetchedAt)}</span>
                  </div>
                )}
              </div>

              {/* Snippet List */}
              <div className="flex-1 overflow-auto">
                {renderSnippetList()}
              </div>

              {/* Footer with collector info */}
              {moduleSnippetsCacheMeta && (
                <div className="p-3 border-t border-border text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Server className="size-3" />
                    <span className="truncate">
                      {moduleSnippetsCacheMeta.collectorDescription} (#{moduleSnippetsCacheMeta.fetchedFromCollector})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Preview */}
            <div className="flex-1 min-w-0">
              {renderPreviewPane()}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EmptyStateProps {
  hasContext: boolean;
  isLoading: boolean;
  collectorDescription?: string;
  collectorId?: number | null;
  onFetch: () => void;
}

function EmptyState({
  hasContext,
  isLoading,
  collectorDescription,
  collectorId,
  onFetch,
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 border-t border-border">
      <Empty className="border-0 max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Puzzle className="size-6" />
          </EmptyMedia>
          <EmptyTitle className="text-lg">Module Snippets Library</EmptyTitle>
          <EmptyDescription className="text-sm leading-relaxed">
            LogicMonitor provides reusable code modules that you can import into your scripts.
            These include helper functions for common tasks like API calls, data emission,
            debugging, and vendor-specific integrations (Cisco, VMware, etc.).
          </EmptyDescription>
          <EmptyDescription className="text-sm leading-relaxed mt-2">
            Fetch the list of available modules from your portal via a collector to browse 
            their source code and easily add import boilerplate to your scripts.
          </EmptyDescription>
        </EmptyHeader>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            size="lg"
            onClick={onFetch}
            disabled={!hasContext || isLoading}
            className="min-w-[200px]"
          >
            {isLoading ? (
              <>
                <RefreshCw className="size-4 mr-2 animate-spin" />
                Fetching from Collector...
              </>
            ) : (
              <>
                <Download className="size-4 mr-2" />
                Fetch Module Snippets
              </>
            )}
          </Button>

          {hasContext && collectorDescription ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Server className="size-3" />
              <span>Using: {collectorDescription} (#{collectorId})</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Connect to a portal with an active collector to fetch module snippets
            </p>
          )}
        </div>
      </Empty>
    </div>
  );
}
