import { useMemo, useState } from 'react';
import { 
  Database, 
  FileText, 
  Network, 
  Settings2, 
  FileCode, 
  Stethoscope,
  Search,
  Loader2,
  AlertTriangle,
  FolderSearch,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
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
  } = useEditorStore();

  // Get modules for current type
  const modules = modulesCache[selectedModuleType];

  // Filter modules by search query
  const filteredModules = useMemo(() => {
    if (!moduleSearchQuery.trim()) return modules;
    const query = moduleSearchQuery.toLowerCase();
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.displayName.toLowerCase().includes(query) ||
        m.appliesTo?.toLowerCase().includes(query)
    );
  }, [modules, moduleSearchQuery]);

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
        <DialogContent className="!w-[90vw] !max-w-[90vw] h-[90vh] flex flex-col gap-4 p-0" showCloseButton>
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Import from LogicModule Exchange</DialogTitle>
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
            <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
              {/* Search */}
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search modules..."
                    value={moduleSearchQuery}
                    onChange={(e) => setModuleSearchQuery(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
              </div>

              {/* Module List */}
              <div className="flex-1 overflow-y-auto">
                {isFetchingModules ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
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
                  <div className="divide-y divide-border">
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
        'w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent'
      )}
    >
      <div className="font-medium text-sm truncate">{module.displayName || module.name}</div>
      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
        <span className="font-mono">{module.collectMethod}</span>
        {module.hasAutoDiscovery && (
          <>
            <span>•</span>
            <span className="text-green-500">AD</span>
          </>
        )}
      </div>
      {module.appliesTo && (
        <div className="mt-1 text-xs text-muted-foreground/70 truncate font-mono">
          {module.appliesTo}
        </div>
      )}
    </button>
  );
}

