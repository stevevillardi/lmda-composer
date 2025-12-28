import { useMemo, useState } from 'react';
import { 
  Database, 
  FileText, 
  Network, 
  Settings2, 
  FileCode, 
  Stethoscope,
  Search,
  AlertTriangle,
  FolderSearch,
  Eye,
  RefreshCw,
  CloudDownload,
} from 'lucide-react';
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

interface ModuleTypeConfig {
  value: LogicModuleType;
  label: string;
  shortLabel: string;
  icon: typeof Database;
}

const MODULE_TYPES: ModuleTypeConfig[] = [
  { value: 'datasource', label: 'DataSource', shortLabel: 'DS', icon: Database },
  { value: 'configsource', label: 'ConfigSource', shortLabel: 'CS', icon: FileText },
  { value: 'topologysource', label: 'TopologySource', shortLabel: 'TS', icon: Network },
  { value: 'propertysource', label: 'PropertySource', shortLabel: 'PS', icon: Settings2 },
  { value: 'logsource', label: 'LogSource', shortLabel: 'LS', icon: FileCode },
  { value: 'diagnosticsource', label: 'DiagnosticSource', shortLabel: 'Diag', icon: Stethoscope },
];

export function LogicModuleBrowser() {
  const {
    moduleBrowserOpen,
    setModuleBrowserOpen,
    selectedModuleType,
    setSelectedModuleType,
    modulesCache,
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

  // Filter and sort modules by search query
  const filteredModules = useMemo(() => {
    let filtered = modules;
    
    // Filter by search query
    if (moduleSearchQuery.trim()) {
      const query = moduleSearchQuery.toLowerCase();
      filtered = modules.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.displayName.toLowerCase().includes(query) ||
          m.appliesTo?.toLowerCase().includes(query)
      );
    }
    
    // Sort alphabetically by displayName or name (A-Z)
    return filtered.sort((a, b) => {
      const nameA = (a.displayName || a.name).toLowerCase();
      const nameB = (b.displayName || b.name).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [modules, moduleSearchQuery]);

  // Handle module refresh with loading state
  const handleRefreshModules = async () => {
    setIsRefreshingModules(true);
    try {
      await fetchModules(selectedModuleType);
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
              {MODULE_TYPES.map((type) => {
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
            <div className="w-80 shrink-0 border-r border-border flex flex-col">
              {/* Search */}
              <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search modules..."
                      value={moduleSearchQuery}
                      onChange={(e) => setModuleSearchQuery(e.target.value)}
                      className="pl-8 h-8"
                    />
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
                    className="border-0"
                  />
                ) : filteredModules.length === 0 ? (
                  <Empty className="border-none h-full py-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FolderSearch className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base">No modules found</EmptyTitle>
                      <EmptyDescription>
                        {!selectedPortalId 
                          ? 'Select a portal to browse modules'
                          : moduleSearchQuery 
                            ? 'Try a different search term or module type'
                            : 'No script-based modules of this type exist'}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="p-2 space-y-1.5">
                    {filteredModules.map((module) => (
                      <ModuleListItem
                        key={module.id}
                        module={module}
                        isSelected={selectedModule?.id === module.id}
                        onClick={() => setSelectedModule(module)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Preview */}
            <div className="flex-1 flex flex-col min-w-0">
              {selectedModule ? (
                <ModulePreview module={selectedModule} />
              ) : (
                <Empty className="flex-1 border-none">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Eye className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">No module selected</EmptyTitle>
                    <EmptyDescription>
                      Select a module from the list to preview its scripts
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Confirmation Dialog */}
      <AlertDialog open={pendingModuleLoad !== null} onOpenChange={(open) => !open && cancelModuleLoad()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-500/10">
              <AlertTriangle className="size-8 text-amber-500" />
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
              className="bg-amber-600 hover:bg-amber-500"
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
        'w-full text-left px-4 py-3 rounded-md transition-all duration-200',
        'border border-transparent',
        'hover:bg-accent/50 hover:border-border',
        isSelected && 'bg-accent border-border shadow-sm'
      )}
    >
      <div className="font-semibold text-sm truncate mb-1">{module.displayName || module.name}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-medium">{module.collectMethod}</span>
        {module.hasAutoDiscovery && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-green-500 font-medium">Active Discovery Enabled</span>
          </>
        )}
      </div>
      {module.appliesTo && (
        <div className="mt-1.5 text-xs text-muted-foreground/70 truncate font-mono">
          {module.appliesTo}
        </div>
      )}
    </button>
  );
}

