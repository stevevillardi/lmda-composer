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
} from '../../constants/icons';
import { moduleToasts } from '../../utils/toast-utils';
import { useEditorStore } from '../../stores/editor-store';
import { LoadingState } from '../shared/LoadingState';
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
import { LOGIC_MODULE_TYPES } from '../../constants/logic-module-types';

function isImportableScriptModule(module: LogicModuleInfo): boolean {
  const collectMethod = module.collectMethod?.toLowerCase();
  const isScriptCollectMethod = collectMethod === 'script' || collectMethod === 'batchscript';
  const hasCollectionScript = !!module.collectionScript?.trim();
  const hasAdScript = !!module.adScript?.trim();

  // EventSource uses collector type to distinguish script vs non-script variants.
  if (module.moduleType === 'eventsource' && module.collector && module.collector !== 'scriptevent')
    return false;

  return isScriptCollectMethod && (hasCollectionScript || hasAdScript);
}

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
    let filtered = modules.filter(isImportableScriptModule);
    
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
      moduleToasts.refreshed(modulesCache[selectedModuleType]?.length || 0);
    } catch (error) {
      moduleToasts.refreshFailed(error instanceof Error ? error : undefined);
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
        <DialogContent className="
          flex h-[90vh] w-[90vw]! max-w-[90vw]! flex-col gap-4 p-0 select-none
        " showCloseButton>
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
              className="w-full flex-wrap justify-start"
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
                    <span className="
                      hidden
                      sm:inline
                    ">{type.label}</span>
                    <span className="sm:hidden">{type.shortLabel}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>

          {/* Main Content Area */}
          <div className="flex min-h-0 flex-1 border-t border-border">
            {/* Left Panel - Module List */}
            <div className="
              flex w-80 shrink-0 flex-col border-r border-border bg-muted/5
            ">
              {/* Search */}
              <div className="border-b border-border bg-background p-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="
                      absolute top-1/2 left-2.5 size-4 -translate-y-1/2
                      text-muted-foreground
                    " />
                    <Input
                      type="text"
                      placeholder="Search modules..."
                      value={moduleSearchQuery}
                      onChange={(e) => setModuleSearchQuery(e.target.value)}
                      className="
                        h-8 border-input bg-background pr-7 pl-8 shadow-sm
                      "
                    />
                    {moduleSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => setModuleSearchQuery('')}
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
                          onClick={handleRefreshModules}
                          disabled={isRefreshingModules || isFetchingModules}
                          className={cn(
                            "size-8 transition-all duration-200",
                            (isRefreshingModules || isFetchingModules) && `
                              opacity-70
                            `
                          )}
                        >
                          <RefreshCw 
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              (isRefreshingModules || isFetchingModules) && `
                                animate-spin
                              `
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
              <div className="flex flex-1 flex-col overflow-y-auto">
                {isFetchingModules ? (
                  <LoadingState 
                    title="Loading modules..."
                    description="Fetching LogicModules from portal"
                    className="border-0 bg-transparent"
                  />
                ) : filteredModules.length === 0 ? (
                  <Empty className="
                    flex h-full flex-col justify-center border-none py-8
                  ">
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="bg-muted/50">
                        <FolderSearch className="
                          size-5 text-muted-foreground/70
                        " />
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
                  <div className="space-y-1 p-2">
                    {filteredModules.map((module) => (
                      <ModuleListItem
                        key={module.id}
                        module={module}
                        isSelected={selectedModule?.id === module.id}
                        onClick={() => setSelectedModule(module)}
                      />
                    ))}
                    {moduleMeta?.hasMore && (
                      <div className="px-1 pt-2 pb-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="
                            w-full border-dashed bg-background/50
                            hover:bg-accent/50
                          "
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
            <div className="flex min-w-0 flex-1 flex-col bg-background/50">
              {selectedModule ? (
                <ModulePreview module={selectedModule} />
              ) : (
                <div className="
                  flex h-full animate-in flex-col items-center justify-center
                  p-8 text-center duration-300 fade-in
                ">
                  <Empty className="
                    w-full max-w-sm border-none bg-transparent shadow-none
                  ">
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="
                        mx-auto mb-4 bg-muted/50
                      ">
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
        `
          group relative w-full px-3 py-2.5 text-left transition-all
          duration-200
        `,
        'border-l-2',
        isSelected 
          ? 'border-primary bg-accent/50 text-accent-foreground shadow-sm' 
          : `
            border-transparent text-muted-foreground
            hover:border-border/50 hover:bg-muted/30 hover:text-foreground
          `
      )}
    >
      <div className={cn(`
        mb-1 flex min-w-0 items-center gap-1.5 truncate text-sm font-medium
      `, isSelected ? `text-foreground` : `text-foreground/90`)}>
        <span className="flex-1 truncate">{module.displayName || module.name}</span>
        {module.name && module.displayName && module.name !== module.displayName && (
          <span className={cn(`
            max-w-[40%] shrink-0 truncate text-xs font-normal
          `, isSelected ? `text-muted-foreground/80` : `
            text-muted-foreground/60
          `)}>
            ({module.name})
          </span>
        )}
      </div>
      <div className={cn("flex items-center gap-2 text-xs", isSelected ? `
        text-muted-foreground
      ` : `text-muted-foreground/70`)}>
        <span className="
          rounded-[3px] bg-muted/30 px-1 font-mono font-medium tracking-tight
        ">{module.collectMethod}</span>
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
                      <span className="
                        inline-flex items-center text-orange-500/80
                      " aria-label="Batch collection">
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
                      <span className="
                        inline-flex items-center text-teal-500/80
                      " aria-label="Collection">
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
        <div className={cn(`
          mt-1.5 truncate font-mono text-[11px] transition-colors
        `, isSelected ? `text-muted-foreground/80` : `
          text-muted-foreground/50
          group-hover:text-muted-foreground/70
        `)}>
          {module.appliesTo}
        </div>
      )}
    </button>
  );
}
