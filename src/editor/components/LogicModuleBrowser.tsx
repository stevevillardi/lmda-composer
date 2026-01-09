import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  FolderSearch,
  Eye,
  RefreshCw,
  CloudDownload,
} from 'lucide-react';
import {
  ActiveDiscoveryIcon,
  CollectionIcon,
  BatchCollectionIcon,
  WarningIcon,
} from '../constants/icons';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { LoadingState } from './shared/LoadingState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LogicModuleType, LogicModuleInfo } from '@/shared/types';
import { ModulePreview } from './ModulePreview';
import { LOGIC_MODULE_TYPES } from '../constants/logic-module-types';

export function LogicModuleBrowser() {
  const {
    moduleBrowserOpen,
    setModuleBrowserOpen,
    selectedModuleType,
    setSelectedModuleType,
    modulesCache,
    modulesMeta,
    modulesSearch,
    isFetchingModules,
    selectedModule,
    setSelectedModule,
    moduleSearchQuery,
    setModuleSearchQuery,
    pendingModuleLoad,
    confirmModuleLoad,
    cancelModuleLoad,
    selectedPortalId,
    fetchModules,
  } = useEditorStore();

  const [isRefreshingModules, setIsRefreshingModules] = useState(false);

  // Get modules for current type
  const modules = modulesCache[selectedModuleType];
  const moduleMeta = modulesMeta[selectedModuleType];
  const cachedSearch = modulesSearch[selectedModuleType];

  useEffect(() => {
    if (!moduleBrowserOpen || !selectedPortalId) return;

    const trimmedQuery = moduleSearchQuery.trim();

    if (!trimmedQuery) {
      if (cachedSearch) {
        fetchModules(selectedModuleType, { append: false, pages: 3, search: '' });
      }
      return;
    }

    if (!moduleMeta.hasMore) {
      return;
    }

    if (trimmedQuery === cachedSearch) return;

    const handle = window.setTimeout(() => {
      fetchModules(selectedModuleType, { append: false, search: trimmedQuery });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [
    moduleBrowserOpen,
    selectedPortalId,
    moduleSearchQuery,
    cachedSearch,
    moduleMeta.hasMore,
    selectedModuleType,
    fetchModules,
  ]);

  // Filter and sort modules by search query
  const filteredModules = useMemo(() => {
    let filtered = modules;
    
    // Filter by search query
    if (moduleSearchQuery.trim()) {
      if (!moduleMeta.hasMore || moduleSearchQuery !== cachedSearch) {
        const query = moduleSearchQuery.toLowerCase();
        filtered = modules.filter(
          (m) =>
            m.name.toLowerCase().includes(query) ||
            m.displayName.toLowerCase().includes(query) ||
            m.appliesTo?.toLowerCase().includes(query) ||
            m.description?.toLowerCase().includes(query)
        );
      }
    }
    
    // Sort alphabetically by displayName or name (A-Z)
    return [...filtered].sort((a, b) => {
      const nameA = (a.displayName || a.name).toLowerCase();
      const nameB = (b.displayName || b.name).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [modules, moduleSearchQuery, moduleMeta.hasMore, cachedSearch]);

  // Handle module refresh with loading state
  const handleRefreshModules = async () => {
    setIsRefreshingModules(true);
    try {
      const trimmedQuery = moduleSearchQuery.trim();
      if (trimmedQuery && moduleMeta.hasMore) {
        await fetchModules(selectedModuleType, { append: false, search: trimmedQuery });
      } else if (!trimmedQuery) {
        await fetchModules(selectedModuleType, { append: false, pages: 3, search: '' });
      }
      toast.success('Modules refreshed', {
        description: `Loaded ${modulesCache[selectedModuleType]?.length || 0} modules`,
      });
    } catch (error) {
      toast.error('Failed to refresh modules', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      // Add a small delay to ensure the animation is visible
      setTimeout(() => {
        setIsRefreshingModules(false);
      }, 300);
    }
  };

  // Handle module type change
  const handleTypeChange = (value: string | string[]) => {
    const type = (Array.isArray(value) ? value[0] : value) as LogicModuleType;
    if (type) {
      setSelectedModuleType(type);
    }
  };

  return (
    <>
      <Dialog open={moduleBrowserOpen} onOpenChange={setModuleBrowserOpen}>
        <DialogContent className="w-[90vw]! max-w-[90vw]! h-[90vh] flex flex-col gap-4 p-0" showCloseButton>
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <CloudDownload className="size-5" />
              Import from LogicModule Exchange
            </DialogTitle>
            <DialogDescription>
              Browse and load scripts from existing LogicModules in your portal 
            </DialogDescription>
          </DialogHeader>

          {/* Module Type Toggle */}
          <div className="px-6">
            <ToggleGroup
              value={[selectedModuleType]}
              onValueChange={handleTypeChange}
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

          {/* Main Content Area */}
          <div className="flex-1 flex min-h-0 border-t border-border">
            {/* Left Panel - Module List */}
            <div className="w-80 shrink-0 border-r border-border flex flex-col bg-muted/5">
              {/* Search */}
              <div className="p-3 border-b border-border bg-background">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search modules..."
                      value={moduleSearchQuery}
                      onChange={(e) => setModuleSearchQuery(e.target.value)}
                      className="pl-8 pr-7 h-8 bg-background border-input shadow-sm"
                    />
                    {moduleSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => setModuleSearchQuery('')}
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
                          onClick={handleRefreshModules}
                          disabled={isRefreshingModules || isFetchingModules}
                          className={cn(
                            "size-8 transition-all duration-200",
                            (isRefreshingModules || isFetchingModules) && "opacity-70"
                          )}
                        >
                          <RefreshCw 
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              (isRefreshingModules || isFetchingModules) && "animate-spin"
                            )} 
                          />
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {(isRefreshingModules || isFetchingModules) ? 'Refreshing modules...' : 'Refresh modules'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Module List */}
              <div className="flex-1 overflow-y-auto flex flex-col">
                {isFetchingModules ? (
                  <LoadingState 
                    title="Loading modules..."
                    description="Fetching LogicModules from portal"
                    className="border-0 bg-transparent"
                  />
                ) : filteredModules.length === 0 ? (
                  <Empty className="border-none h-full py-8 flex flex-col justify-center">
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="bg-muted/50">
                        <FolderSearch className="size-5 text-muted-foreground/70" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base font-medium">No modules found</EmptyTitle>
                      <EmptyDescription className="px-6">
                        {!selectedPortalId 
                          ? 'Select a portal to browse modules'
                          : moduleSearchQuery 
                            ? 'Try a different search term or module type'
                            : 'No script-based modules of this type exist'}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredModules.map((module) => (
                      <ModuleListItem
                        key={module.id}
                        module={module}
                        isSelected={selectedModule?.id === module.id}
                        onClick={() => setSelectedModule(module)}
                      />
                    ))}
                    {moduleMeta?.hasMore && (
                      <div className="pt-2 pb-1 px-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full bg-background/50 border-dashed hover:bg-accent/50"
                          onClick={() => fetchModules(selectedModuleType, { append: true })}
                          disabled={isFetchingModules}
                        >
                          {isFetchingModules
                            ? 'Loading more...'
                            : `Load more (${modules.length} of ${moduleMeta.total || '...'} loaded)`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Preview */}
            <div className="flex-1 flex flex-col min-w-0 bg-background/50">
              {selectedModule ? (
                <ModulePreview module={selectedModule} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-300">
                  <Empty className="border-none bg-transparent shadow-none w-full max-w-sm">
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="mx-auto bg-muted/50 mb-4">
                        <Eye className="size-5 text-muted-foreground/70" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base font-medium">No module selected</EmptyTitle>
                      <EmptyDescription className="mx-auto mt-1.5">
                        Select a module from the list to preview its scripts and configuration
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Confirmation Dialog */}
      <AlertDialog open={pendingModuleLoad !== null} onOpenChange={(open) => !open && cancelModuleLoad()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-yellow-500/10">
              <WarningIcon className="size-8" />
            </AlertDialogMedia>
            <AlertDialogTitle>Load script?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in your editor. Loading this script will replace 
              your current work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelModuleLoad}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmModuleLoad}
              variant="warning"
            >
              Load & Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ModuleListItemProps {
  module: LogicModuleInfo;
  isSelected: boolean;
  onClick: () => void;
}

function ModuleListItem({ module, isSelected, onClick }: ModuleListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 transition-all duration-200 group relative',
        'border-l-2',
        isSelected 
          ? 'bg-accent/50 border-primary text-accent-foreground shadow-sm' 
          : 'border-transparent hover:bg-muted/30 hover:border-border/50 text-muted-foreground hover:text-foreground'
      )}
    >
      <div className={cn("font-medium text-sm truncate mb-1 flex items-center gap-1.5 min-w-0", isSelected ? "text-foreground" : "text-foreground/90")}>
        <span className="truncate flex-1">{module.displayName || module.name}</span>
        {module.name && module.displayName && module.name !== module.displayName && (
          <span className={cn("text-xs font-normal truncate shrink-0 max-w-[40%]", isSelected ? "text-muted-foreground/80" : "text-muted-foreground/60")}>
            ({module.name})
          </span>
        )}
      </div>
      <div className={cn("flex items-center gap-2 text-xs", isSelected ? "text-muted-foreground" : "text-muted-foreground/70")}>
        <span className="font-mono font-medium tracking-tight bg-muted/30 px-1 rounded-[3px]">{module.collectMethod}</span>
        {(module.hasAutoDiscovery || module.collectMethod === 'batchscript' || module.collectMethod) && (
          <>
            <span className="text-muted-foreground/30">•</span>
            <div className="flex items-center gap-1.5">
              {module.hasAutoDiscovery && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="inline-flex items-center text-primary/80" aria-label="Active Discovery enabled">
                        <ActiveDiscoveryIcon className="size-3.5" />
                      </span>
                    }
                  />
                  <TooltipContent>Active Discovery</TooltipContent>
                </Tooltip>
              )}
              {module.collectMethod === 'batchscript' && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="inline-flex items-center text-orange-500/80" aria-label="Batch collection">
                        <BatchCollectionIcon className="size-3.5" />
                      </span>
                    }
                  />
                  <TooltipContent>Batch collection</TooltipContent>
                </Tooltip>
              )}
              {module.collectMethod !== 'batchscript' && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="inline-flex items-center text-teal-500/80" aria-label="Collection">
                        <CollectionIcon className="size-3.5" />
                      </span>
                    }
                  />
                  <TooltipContent>Collection</TooltipContent>
                </Tooltip>
              )}
            </div>
          </>
        )}
      </div>
      {module.appliesTo && (
        <div className={cn("mt-1.5 text-[11px] font-mono truncate transition-colors", isSelected ? "text-muted-foreground/80" : "text-muted-foreground/50 group-hover:text-muted-foreground/70")}>
          {module.appliesTo}
        </div>
      )}
    </button>
  );
}
