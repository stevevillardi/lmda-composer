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
import { useEditorStore } from '../../stores/editor-store';
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
import { LoadingState } from '../shared/LoadingState';
import { CopyButton } from '../shared/CopyButton';
import { cn } from '@/lib/utils';
import { buildMonacoOptions, getMonacoTheme } from '@/editor/utils/monaco-settings';
import type { ModuleSnippetInfo } from '@/shared/types';

import '../../monaco-loader';

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
          <Empty className="h-full border-none py-8">
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
      <div className="space-y-2 p-3">
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
              <CollapsibleTrigger className="
                flex w-full items-center justify-between rounded-md px-2 py-1.5
                text-xs font-medium text-muted-foreground
                hover:bg-muted/50
              ">
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
                        `
                          w-full rounded-md border border-transparent px-3
                          py-2.5 text-left transition-all duration-200
                        `,
                        isSelected 
                          ? 'bg-accent text-accent-foreground shadow-sm' 
                          : `
                            text-foreground/80
                            hover:bg-accent/50 hover:text-foreground
                          `
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", isSelected ? `
                          font-semibold
                        ` : `font-medium`)}>
                          {snippet.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {hasCachedVersion && (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Database className="size-3 text-teal-500/80" />
                                }
                              />
                              <TooltipContent>Source cached locally</TooltipContent>
                            </Tooltip>
                          )}
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "h-4 px-1.5 text-[10px] font-normal",
                              isSelected ? "bg-background/50" : `
                                bg-muted text-muted-foreground
                              `
                            )}
                          >
                            v{snippet.latestVersion}
                          </Badge>
                        </div>
                      </div>
                      {snippet.description && (
                        <p className={cn(
                          "mt-0.5 line-clamp-1 text-xs",
                          isSelected ? "text-accent-foreground/80" : `
                            text-muted-foreground/80
                          `
                        )}>
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
        <div className="
          flex h-full animate-in flex-col items-center justify-center p-8
          text-center duration-300 fade-in
        ">
          <Empty className="
            w-full max-w-sm border-none bg-transparent shadow-none
          ">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="mx-auto mb-4 bg-muted/50">
                <Puzzle className="size-5 text-muted-foreground/70" />
              </EmptyMedia>
              <EmptyTitle className="text-base font-medium">Select a module</EmptyTitle>
              <EmptyDescription className="mx-auto mt-1.5">
                Choose a module from the list to view its source code
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        {/* Header - Consolidated with Actions */}
        <div className="
          flex items-center justify-between gap-4 border-b border-border
          bg-secondary/30 px-6 py-3
        ">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 truncate text-sm font-medium">
              {selectedModuleSnippet.name}
              {selectedSnippetInfo && (
                <Badge variant="outline" className="h-5 text-[10px] font-normal">
                  {selectedSnippetInfo?.language || 'groovy'}
                </Badge>
              )}
            </h3>
            {selectedSnippetInfo?.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {selectedSnippetInfo.description}
              </p>
            )}
          </div>
          
          <div className="flex shrink-0 items-center gap-3">
            {/* Version Selector */}
            {selectedSnippetInfo && (
              <Select
                value={selectedModuleSnippet.version}
                onValueChange={handleVersionChange}
              >
                <SelectTrigger className="
                  h-7 w-auto min-w-[90px] gap-2 border-transparent
                  bg-background/50 text-xs shadow-none
                  hover:bg-background/80
                ">
                  <div className="flex items-center gap-1.5">
                    {isCurrentVersionCached && (
                      <Database className="size-3 text-teal-500" />
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
                              <Badge variant="secondary" className="
                                h-4 px-1 text-[9px]
                              ">
                                latest
                              </Badge>
                            )}
                            {isCached && (
                              <Database className="ml-auto size-3 text-teal-500" />
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}

            <div className="h-4 w-px bg-border" />

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {moduleSnippetSource && (
                <CopyButton
                  text={moduleSnippetSource}
                  size="sm"
                  variant="ghost"
                  className="size-7"
                  tooltip="Copy source code"
                />
              )}
              <Button
                size="sm"
                variant="default"
                onClick={handleInsertImport}
                className="h-7 gap-1.5 px-3 text-xs shadow-sm"
              >
                <Plus className="size-3.5" />
                Insert Import
              </Button>
            </div>
          </div>
        </div>

        {/* Source content */}
        <div className="min-h-0 flex-1">
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
                <div className="flex h-full items-center justify-center">
                  <div className="text-xs text-muted-foreground">Loading editor...</div>
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
      <DialogContent className="
        flex h-[90vh] w-[90vw]! max-w-[90vw]! flex-col gap-4 p-0
      " showCloseButton>
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
          <div className="flex min-h-0 flex-1 border-t border-border">
            {/* Left Panel - Snippet List */}
            <div className="
              flex min-h-0 w-96 shrink-0 flex-col border-r border-border
            ">
              {/* Search */}
              <div className="border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="
                      absolute top-1/2 left-2.5 size-4 -translate-y-1/2
                      text-muted-foreground
                    " />
                    <Input
                      type="text"
                      placeholder="Search snippets..."
                      value={moduleSnippetsSearchQuery}
                      onChange={(e) => setModuleSnippetsSearchQuery(e.target.value)}
                      className="h-8 pr-7 pl-8"
                    />
                    {moduleSnippetsSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => setModuleSnippetsSearchQuery('')}
                        className="
                          absolute top-1/2 right-2 -translate-y-1/2
                          text-muted-foreground
                          hover:text-foreground
                        "
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
              <div className="
                flex items-center justify-between border-b border-border
                bg-secondary/20 px-4 py-2 text-xs text-muted-foreground
              ">
                <span>
                  {filteredSnippets.length} module{filteredSnippets.length === 1 ? '' : 's'}
                  {categories.length > 0 && ` in ${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`}
                </span>
                {moduleSnippetsCacheMeta && (
                  <div className="
                    flex items-center gap-1 text-muted-foreground/70
                  ">
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
                <div className="
                  border-t border-border p-3 text-xs text-muted-foreground
                ">
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
            <div className="min-w-0 flex-1">
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
    <div className="
      flex flex-1 items-center justify-center border-t border-border bg-muted/10
      p-8
    ">
      <Empty className="
        max-w-lg border-border/50 bg-card/40 shadow-sm backdrop-blur-sm
      ">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="mb-4 bg-primary/10 text-primary">
            <Puzzle className="size-6" />
          </EmptyMedia>
          <EmptyTitle className="text-xl font-semibold tracking-tight">Module Snippets Library</EmptyTitle>
          <EmptyDescription className="
            mt-2 text-sm/relaxed text-muted-foreground/90
          ">
            LogicMonitor provides reusable code modules that you can import into your scripts.
            These include helper functions for common tasks like API calls, data emission,
            debugging, and vendor-specific integrations (Cisco, VMware, etc.).
          </EmptyDescription>
          <EmptyDescription className="
            mt-4 rounded-md border border-border/50 bg-accent/30 p-3
            text-sm/relaxed
          ">
            Fetch the list of available modules from your portal via a collector to browse 
            their source code and easily add import boilerplate to your scripts.
          </EmptyDescription>
        </EmptyHeader>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Button
            size="lg"
            onClick={onFetch}
            disabled={!hasContext || isLoading}
            className="
              min-w-[200px] shadow-md transition-all
              hover:scale-[1.02]
            "
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Fetching from Collector...
              </>
            ) : (
              <>
                <Download className="mr-2 size-4" />
                Fetch Module Snippets
              </>
            )}
          </Button>

          {hasContext && collectorDescription ? (
            <div className="
              flex items-center gap-2 rounded-full border border-border/40
              bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground
            ">
              <Server className="size-3" />
              <span>Using: <span className="font-medium text-foreground">{collectorDescription}</span> (#{collectorId})</span>
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
