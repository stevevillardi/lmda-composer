import { useMemo, useState } from 'react';
import { Search, Plus, Code2, FileText, Edit2, Trash2, Play, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
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
import { BUILT_IN_SNIPPETS } from '../data/built-in-snippets';
import type { Snippet } from '@/shared/types';
import { CreateSnippetDialog } from './CreateSnippetDialog';
import { SnippetPreviewDialog } from './SnippetPreviewDialog';
import { ConfirmationDialog } from './ConfirmationDialog';

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
          'w-full text-left px-3 py-2.5 transition-all border-l-2 group relative',
          isCompatible
            ? 'border-transparent hover:bg-muted/30 hover:border-l-primary'
            : 'border-transparent opacity-60 bg-muted/20 cursor-not-allowed'
        )}
        onClick={() => isCompatible && handleInsert(snippet)}
        disabled={!isCompatible}
        onKeyDown={handleKeyDown}
        aria-label={`${snippet.name} snippet${isCompatible ? '' : ' (incompatible language)'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-sm truncate font-medium", isCompatible ? "text-foreground" : "text-muted-foreground")}>
                {snippet.name}
              </span>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn('text-[9px] h-4 px-1 font-normal bg-opacity-10 border-opacity-20', LANGUAGE_COLORS[snippet.language])}
                >
                  {snippet.language === 'both' ? 'Both' : snippet.language}
                </Badge>
                {!snippet.isBuiltIn && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1 font-normal">
                    User
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {snippet.description}
            </p>
          </div>
          
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
             <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      className="p-1 rounded-md hover:bg-background/80 cursor-pointer"
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
                          className="p-1 rounded-md hover:bg-background/80 cursor-pointer"
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
                          className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(snippet);
                          }}
                        >
                          <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
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
    <div className="flex flex-col h-full bg-muted/5">
      {/* Header with filters */}
      <div className="p-3 border-b border-border space-y-3 bg-background">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            value={snippetsSearchQuery}
            onChange={(e) => setSnippetsSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/30 border-input shadow-sm focus-visible:bg-background transition-colors"
          />
        </div>

        {/* Category tabs */}
        <Tabs
          value={snippetCategoryFilter}
          onValueChange={(v) => setSnippetCategoryFilter(v as 'all' | 'template' | 'pattern')}
        >
          <TabsList className="w-full h-8 bg-muted/50 p-0.5" variant="default">
            <TabsTrigger value="all" className="flex-1 text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              All
            </TabsTrigger>
            <TabsTrigger value="template" className="flex-1 text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Templates
            </TabsTrigger>
            <TabsTrigger value="pattern" className="flex-1 text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm">
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
            <SelectTrigger className="h-7 text-xs flex-1 bg-transparent border-input/60 hover:bg-accent/50 focus:ring-offset-0">
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
            <SelectTrigger className="h-7 text-xs flex-1 bg-transparent border-input/60 hover:bg-accent/50 focus:ring-offset-0">
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
          className="w-full h-8 text-xs border-dashed hover:border-primary/50 hover:bg-accent/30 hover:text-primary transition-colors"
          onClick={() => setCreateSnippetDialogOpen(true)}
        >
          <Plus className="size-3.5 mr-1.5" />
          Create Snippet
        </Button>
      </div>

      {/* Snippets list - scrollable */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-2 space-y-4">
          {filteredSnippets.length === 0 ? (
            <div className="flex flex-col h-full bg-muted/5">
              <Empty className="py-8 border-0 bg-transparent flex flex-col justify-center">
                <EmptyMedia variant="icon" className="bg-muted/50 mb-4">
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
                  className="border border-border/40 rounded-md bg-card/20 overflow-hidden"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                    <span className="flex items-center gap-2">
                      {collapsedGroups.template ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      <FileText className="size-3.5" />
                      Templates
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-muted text-muted-foreground">
                      {templates.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border/40 divide-y divide-border/30">
                    {templates.map(renderSnippetCard)}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {snippetCategoryFilter === 'all' && patterns.length > 0 && (
                 <Collapsible
                  open={collapsedGroups.pattern}
                  onOpenChange={() => toggleGroup('pattern')}
                  className="border border-border/40 rounded-md bg-card/20 overflow-hidden"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                    <span className="flex items-center gap-2">
                      {collapsedGroups.pattern ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      <Code2 className="size-3.5" />
                      Patterns
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-muted text-muted-foreground">
                      {patterns.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border/40 divide-y divide-border/30">
                    {patterns.map(renderSnippetCard)}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {snippetCategoryFilter !== 'all' && (
                <div className="border border-border/40 rounded-md bg-card/20 overflow-hidden divide-y divide-border/30">
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
