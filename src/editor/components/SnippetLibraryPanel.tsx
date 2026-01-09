import { useMemo, useState } from 'react';
import { Search, Plus, Code2, FileText, Edit2, Trash2, Play, Eye } from 'lucide-react';
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
      <div
        key={snippet.id}
        className={cn(
          'group p-3 rounded-lg border transition-colors',
          isCompatible
            ? 'border-border hover:border-primary/50 hover:bg-secondary/30 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1'
            : 'border-border/50 opacity-60'
        )}
        tabIndex={isCompatible ? 0 : -1}
        onKeyDown={handleKeyDown}
        role="button"
        aria-label={`${snippet.name} snippet${isCompatible ? '' : ' (incompatible language)'}`}
        aria-disabled={!isCompatible}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {snippet.category === 'template' ? (
                <FileText className="size-3.5 text-muted-foreground shrink-0" />
              ) : (
                <Code2 className="size-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-medium truncate">{snippet.name}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {snippet.description}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className={cn('text-[10px]', LANGUAGE_COLORS[snippet.language])}
              >
                {snippet.language === 'both' ? 'Both' : snippet.language}
              </Badge>
              {!snippet.isBuiltIn && (
                <Badge variant="outline" className="text-[10px]">
                  User
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!snippet.isBuiltIn && (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => handleEdit(snippet)}
                      >
                        <Edit2 className="size-3" />
                      </Button>
                    }
                  />
                  <TooltipContent>Edit snippet</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(snippet)}
                        aria-label={`Delete snippet ${snippet.name}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    }
                  />
                  <TooltipContent>Delete snippet</TooltipContent>
                </Tooltip>
              </>
            )}
            {/* Preview button */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => handlePreview(snippet)}
                  >
                    <Eye className="size-3" />
                  </Button>
                }
              />
              <TooltipContent>Preview snippet</TooltipContent>
            </Tooltip>
            {/* Insert button */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      'transition-opacity',
                      isCompatible
                        ? 'opacity-0 group-hover:opacity-100'
                        : 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => isCompatible && handleInsert(snippet)}
                    disabled={!isCompatible}
                    aria-label={isCompatible 
                      ? (snippet.category === 'template' ? 'Use as template' : 'Insert pattern')
                      : `This snippet is for ${snippet.language === 'groovy' ? 'Groovy' : 'PowerShell'} only`}
                  >
                    <Play className="size-3" />
                  </Button>
                }
              />
              <TooltipContent>
                {isCompatible
                  ? snippet.category === 'template'
                    ? 'Use as template (replaces script)'
                    : 'Insert pattern'
                  : `This snippet is for ${snippet.language === 'groovy' ? 'Groovy' : 'PowerShell'} only. Switch language to use it.`}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with filters */}
      <div className="p-2 border-b border-border space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            value={snippetsSearchQuery}
            onChange={(e) => setSnippetsSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Category tabs */}
        <Tabs
          value={snippetCategoryFilter}
          onValueChange={(v) => setSnippetCategoryFilter(v as 'all' | 'template' | 'pattern')}
        >
          <TabsList className="w-full h-7" variant="default">
            <TabsTrigger value="all" className="flex-1 text-xs h-6">
              All
            </TabsTrigger>
            <TabsTrigger value="template" className="flex-1 text-xs h-6">
              Templates
            </TabsTrigger>
            <TabsTrigger value="pattern" className="flex-1 text-xs h-6">
              Patterns
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Additional filters */}
        <div className="flex items-center gap-2">
          <Select
            value={snippetLanguageFilter}
            onValueChange={(v) => setSnippetLanguageFilter(v as 'all' | 'groovy' | 'powershell')}
            items={[
              { value: 'all', label: 'All Languages' },
              { value: 'groovy', label: 'Groovy' },
              { value: 'powershell', label: 'PowerShell' },
            ]}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
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
            items={[
              { value: 'all', label: 'All Sources' },
              { value: 'builtin', label: 'Built-in' },
              { value: 'user', label: 'My Snippets' },
            ]}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
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
          className="w-full h-7 text-xs"
          onClick={() => setCreateSnippetDialogOpen(true)}
        >
          <Plus className="size-3 mr-1.5" />
          Create Snippet
        </Button>
      </div>

      {/* Snippets list - scrollable */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-2 space-y-4">
          {filteredSnippets.length === 0 ? (
            <Empty className="py-8 border-0">
              <EmptyMedia variant="icon">
                <Code2 />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No Snippets Found</EmptyTitle>
                <EmptyDescription>
                  Try adjusting your filters or create a new snippet
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {snippetCategoryFilter === 'all' && templates.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                    Templates ({templates.length})
                  </h3>
                  <div className="space-y-2">
                    {templates.map(renderSnippetCard)}
                  </div>
                </div>
              )}

              {snippetCategoryFilter === 'all' && patterns.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                    Patterns ({patterns.length})
                  </h3>
                  <div className="space-y-2">
                    {patterns.map(renderSnippetCard)}
                  </div>
                </div>
              )}

              {snippetCategoryFilter !== 'all' && (
                <div className="space-y-2">
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
