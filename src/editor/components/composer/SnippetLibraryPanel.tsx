import { useMemo, useState } from 'react';
import { Search, Plus, Code2, FileText, Edit2, Trash2, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../../stores/editor-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { BUILT_IN_SNIPPETS } from '../../data/built-in-snippets';
import type { Snippet } from '@/shared/types';
import { CreateSnippetDialog } from './CreateSnippetDialog';
import { SnippetPreviewDialog } from './SnippetPreviewDialog';
import { ConfirmationDialog } from '../shared/ConfirmationDialog';

const LANGUAGE_COLORS: Record<string, string> = {
  groovy: 'bg-yellow-700/10 text-yellow-700 border-yellow-700/20',
  powershell: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  both: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

export function SnippetLibraryPanel() {
  const {
    userSnippets,
    snippetsSearchQuery,
    snippetCategoryFilter,
    snippetLanguageFilter,
    snippetSourceFilter,
    setSnippetsSearchQuery,
    setSnippetCategoryFilter,
    setSnippetLanguageFilter,
    setSnippetSourceFilter,
    insertSnippet,
    setCreateSnippetDialogOpen,
    setEditingSnippet,
    deleteUserSnippet,
    tabs,
    activeTabId,
  } = useEditorStore();

  const currentLanguage = useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    return activeTab?.language ?? 'groovy';
  }, [tabs, activeTabId]);

  // Combine built-in and user snippets
  const allSnippets = useMemo(() => {
    return [...BUILT_IN_SNIPPETS, ...userSnippets];
  }, [userSnippets]);

  // Filter snippets
  const filteredSnippets = useMemo(() => {
    return allSnippets.filter((snippet) => {
      // Search filter
      if (snippetsSearchQuery.trim()) {
        const query = snippetsSearchQuery.toLowerCase();
        const matchesSearch =
          snippet.name.toLowerCase().includes(query) ||
          snippet.description.toLowerCase().includes(query) ||
          snippet.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Category filter
      if (snippetCategoryFilter !== 'all' && snippet.category !== snippetCategoryFilter) {
        return false;
      }

      // Language filter
      if (snippetLanguageFilter !== 'all') {
        if (snippet.language !== 'both' && snippet.language !== snippetLanguageFilter) {
          return false;
        }
      }

      // Source filter
      if (snippetSourceFilter === 'builtin' && !snippet.isBuiltIn) return false;
      if (snippetSourceFilter === 'user' && snippet.isBuiltIn) return false;

      return true;
    });
  }, [allSnippets, snippetsSearchQuery, snippetCategoryFilter, snippetLanguageFilter, snippetSourceFilter]);

  // Group by category
  const templates = filteredSnippets.filter((s) => s.category === 'template');
  const patterns = filteredSnippets.filter((s) => s.category === 'pattern');

  // Preview state
  const [previewSnippet, setPreviewSnippet] = useState<Snippet | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snippetToDelete, setSnippetToDelete] = useState<Snippet | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    template: true,
    pattern: true,
  });

  const handleInsert = (snippet: Snippet) => {
    insertSnippet(snippet);
    setPreviewSnippet(null); // Close preview if open
    toast.success('Snippet inserted', {
      description: snippet.category === 'template' 
        ? 'Template applied to editor'
        : 'Pattern inserted at cursor',
    });
  };

  const handlePreview = (snippet: Snippet) => {
    setPreviewSnippet(snippet);
  };

  const handleEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet);
  };

  const handleDeleteClick = (snippet: Snippet) => {
    setSnippetToDelete(snippet);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (snippetToDelete) {
      deleteUserSnippet(snippetToDelete.id);
      toast.success('Snippet deleted', {
        description: `"${snippetToDelete.name}" has been removed`,
      });
      setSnippetToDelete(null);
    }
  };

  const toggleGroup = (type: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const renderSnippetCard = (snippet: Snippet) => {
    const isCompatible =
      snippet.language === 'both' || snippet.language === currentLanguage;

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isCompatible) {
          handleInsert(snippet);
        }
      }
    };

    return (
      <button
        key={snippet.id}
        className={cn(
          `
            group relative w-full border-l-2 px-3 py-2.5 text-left
            transition-all
          `,
          isCompatible
            ? `
              border-transparent
              hover:border-l-primary hover:bg-muted/30
            `
            : 'cursor-not-allowed border-transparent bg-muted/20 opacity-60'
        )}
        onClick={() => isCompatible && handleInsert(snippet)}
        disabled={!isCompatible}
        onKeyDown={handleKeyDown}
        aria-label={`${snippet.name} snippet${isCompatible ? '' : ' (incompatible language)'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className={cn("truncate text-sm font-medium", isCompatible ? `
                text-foreground
              ` : `text-muted-foreground`)}>
                {snippet.name}
              </span>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(`
                    bg-opacity-10 border-opacity-20 h-4 px-1 text-[9px]
                    font-normal
                  `, LANGUAGE_COLORS[snippet.language])}
                >
                  {snippet.language === 'both' ? 'Both' : snippet.language}
                </Badge>
                {!snippet.isBuiltIn && (
                  <Badge variant="secondary" className="
                    h-4 px-1 text-[9px] font-normal
                  ">
                    User
                  </Badge>
                )}
              </div>
            </div>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {snippet.description}
            </p>
          </div>
          
          <div className="
            flex shrink-0 items-center gap-1 opacity-0 transition-opacity
            group-hover:opacity-100
          ">
             <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      className="
                        cursor-pointer rounded-md p-1
                        hover:bg-background/80
                      "
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(snippet);
                      }}
                    >
                      <Eye className="size-3.5 text-muted-foreground" />
                    </div>
                  }
                />
                <TooltipContent side="left">Preview snippet</TooltipContent>
              </Tooltip>
              
              {!snippet.isBuiltIn && (
                <>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div
                          className="
                            cursor-pointer rounded-md p-1
                            hover:bg-background/80
                          "
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(snippet);
                          }}
                        >
                          <Edit2 className="size-3.5 text-muted-foreground" />
                        </div>
                      }
                    />
                    <TooltipContent side="left">Edit snippet</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div
                          className="
                            cursor-pointer rounded-md p-1
                            hover:bg-destructive/10 hover:text-destructive
                          "
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(snippet);
                          }}
                        >
                          <Trash2 className="
                            size-3.5 text-muted-foreground
                            hover:text-destructive
                          " />
                        </div>
                      }
                    />
                    <TooltipContent side="left">Delete snippet</TooltipContent>
                  </Tooltip>
                </>
              )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col bg-muted/5">
      {/* Header with filters */}
      <div className="space-y-3 border-b border-border bg-background p-3">
        {/* Search */}
        <div className="relative">
          <Search className="
            absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2
            text-muted-foreground
          " />
          <Input
            placeholder="Search snippets..."
            value={snippetsSearchQuery}
            onChange={(e) => setSnippetsSearchQuery(e.target.value)}
            className="
              h-8 border-input bg-muted/30 pl-8 text-xs shadow-sm
              transition-colors
              focus-visible:bg-background
            "
          />
        </div>

        {/* Category tabs */}
        <Tabs
          value={snippetCategoryFilter}
          onValueChange={(v) => setSnippetCategoryFilter(v as 'all' | 'template' | 'pattern')}
        >
          <TabsList className="h-8 w-full bg-muted/50 p-0.5" variant="default">
            <TabsTrigger value="all" className="
              h-7 flex-1 text-xs
              data-[state=active]:bg-background data-[state=active]:shadow-sm
            ">
              All
            </TabsTrigger>
            <TabsTrigger value="template" className="
              h-7 flex-1 text-xs
              data-[state=active]:bg-background data-[state=active]:shadow-sm
            ">
              Templates
            </TabsTrigger>
            <TabsTrigger value="pattern" className="
              h-7 flex-1 text-xs
              data-[state=active]:bg-background data-[state=active]:shadow-sm
            ">
              Patterns
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Additional filters */}
        <div className="flex items-center gap-2">
          <Select
            value={snippetLanguageFilter}
            onValueChange={(v) => setSnippetLanguageFilter(v as 'all' | 'groovy' | 'powershell')}
          >
            <SelectTrigger className="
              h-7 flex-1 border-input/60 bg-transparent text-xs
              hover:bg-accent/50
              focus:ring-offset-0
            ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              <SelectItem value="groovy">Groovy</SelectItem>
              <SelectItem value="powershell">PowerShell</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={snippetSourceFilter}
            onValueChange={(v) => setSnippetSourceFilter(v as 'all' | 'builtin' | 'user')}
          >
            <SelectTrigger className="
              h-7 flex-1 border-input/60 bg-transparent text-xs
              hover:bg-accent/50
              focus:ring-offset-0
            ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="builtin">Built-in</SelectItem>
              <SelectItem value="user">My Snippets</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Create button */}
        <Button
          variant="outline"
          size="sm"
          className="
            h-8 w-full border-dashed text-xs transition-colors
            hover:border-primary/50 hover:bg-accent/30 hover:text-primary
          "
          onClick={() => setCreateSnippetDialogOpen(true)}
        >
          <Plus className="mr-1.5 size-3.5" />
          Create Snippet
        </Button>
      </div>

      {/* Snippets list - scrollable */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="space-y-4 p-2">
          {filteredSnippets.length === 0 ? (
            <div className="flex h-full flex-col bg-muted/5">
              <Empty className="
                flex flex-col justify-center border-0 bg-transparent py-8
              ">
                <EmptyMedia variant="icon" className="mb-4 bg-muted/50">
                  <Code2 className="size-5 text-muted-foreground/70" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-base font-medium">No Snippets Found</EmptyTitle>
                  <EmptyDescription className="mt-1.5 px-6">
                    Try adjusting your filters or create a new snippet
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <>
              {snippetCategoryFilter === 'all' && templates.length > 0 && (
                <Collapsible
                  open={collapsedGroups.template}
                  onOpenChange={() => toggleGroup('template')}
                  className="
                    overflow-hidden rounded-md border border-border/40
                    bg-card/20
                  "
                >
                  <CollapsibleTrigger className="
                    flex w-full items-center justify-between px-3 py-2 text-xs
                    font-medium text-muted-foreground transition-colors
                    hover:bg-muted/50
                  ">
                    <span className="flex items-center gap-2">
                      {collapsedGroups.template ? <ChevronDown className="
                        size-3.5
                      " /> : <ChevronRight className="size-3.5" />}
                      <FileText className="size-3.5" />
                      Templates
                    </span>
                    <Badge variant="secondary" className="
                      h-4 bg-muted px-1.5 text-[10px] font-normal
                      text-muted-foreground
                    ">
                      {templates.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="
                    divide-y divide-border/30 border-t border-border/40
                  ">
                    {templates.map(renderSnippetCard)}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {snippetCategoryFilter === 'all' && patterns.length > 0 && (
                 <Collapsible
                  open={collapsedGroups.pattern}
                  onOpenChange={() => toggleGroup('pattern')}
                  className="
                    overflow-hidden rounded-md border border-border/40
                    bg-card/20
                  "
                >
                  <CollapsibleTrigger className="
                    flex w-full items-center justify-between px-3 py-2 text-xs
                    font-medium text-muted-foreground transition-colors
                    hover:bg-muted/50
                  ">
                    <span className="flex items-center gap-2">
                      {collapsedGroups.pattern ? <ChevronDown className="
                        size-3.5
                      " /> : <ChevronRight className="size-3.5" />}
                      <Code2 className="size-3.5" />
                      Patterns
                    </span>
                    <Badge variant="secondary" className="
                      h-4 bg-muted px-1.5 text-[10px] font-normal
                      text-muted-foreground
                    ">
                      {patterns.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="
                    divide-y divide-border/30 border-t border-border/40
                  ">
                    {patterns.map(renderSnippetCard)}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {snippetCategoryFilter !== 'all' && (
                <div className="
                  divide-y divide-border/30 overflow-hidden rounded-md border
                  border-border/40 bg-card/20
                ">
                  {filteredSnippets.map(renderSnippetCard)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <CreateSnippetDialog />

      {/* Preview Dialog */}
      <SnippetPreviewDialog
        snippet={previewSnippet}
        onClose={() => setPreviewSnippet(null)}
        onInsert={handleInsert}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete snippet?"
        description={
          snippetToDelete 
            ? `Are you sure you want to delete "${snippetToDelete.name}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
