import {  
  Download,
  FileInput,
  FilePlus,
  Save,
  Settings,
  CommandIcon,
  PanelRight,
  CloudDownload,
  Hammer,
  Wrench,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';

export function ActionsDropdown() {
  const {
    tabs,
    activeTabId,
    selectedPortalId,
    setModuleBrowserOpen,
    setSettingsDialogOpen,
    setAppliesToTesterOpen,
    setDebugCommandsDialogOpen,
    rightSidebarOpen,
    toggleRightSidebar,
    createNewFile,
    openFileFromDisk,
    saveFile,
    saveFileAs,
    exportToFile,
    canCommitModule,
    fetchModuleForCommit,
    setModuleCommitConfirmationOpen,
  } = useEditorStore();

  const hasOpenTabs = tabs.length > 0;
  const activeTab = tabs.find(t => t.id === activeTabId);
  const isModuleTab = activeTab?.source?.type === 'module';
  const canCommit = activeTabId && isModuleTab && canCommitModule(activeTabId);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                >
                  <CommandIcon className="size-4" />
                  <span className="hidden sm:inline text-xs">Actions</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Actions Menu</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <div className="relative flex items-center gap-2 my-2">
            <Separator className="flex-1" />
            <span className="shrink-0 px-2 text-xs text-muted-foreground select-none">
              File Actions
            </span>
            <Separator className="flex-1" />
          </div>
          <DropdownMenuItem onClick={() => {
            createNewFile();
            toast.info('New file created');
          }}>
            <FilePlus className="size-4 mr-2" />
            <span className="flex-1">New File</span>
            <Kbd className="ml-auto">⌘N</Kbd>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => {
            openFileFromDisk();
            toast.info('Opening file...');
          }}>
            <FileInput className="size-4 mr-2" />
            <span className="flex-1">Open File...</span>
            <Kbd className="ml-auto">⌘O</Kbd>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={async () => {
              try {
                await saveFile();
                toast.success('File saved');
              } catch (error) {
                toast.error('Failed to save file', {
                  description: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }}
            disabled={!hasOpenTabs}
          >
            <Save className="size-4 mr-2" />
            <span className="flex-1">Save</span>
            <Kbd className="ml-auto">⌘S</Kbd>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={async () => {
              try {
                await saveFileAs();
                toast.success('File saved');
              } catch (error) {
                toast.error('Failed to save file', {
                  description: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }}
            disabled={!hasOpenTabs}
          >
            <Download className="size-4 mr-2" />
            <span className="flex-1">Save As...</span>
            <Kbd className="ml-auto">⌘⇧S</Kbd>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => {
              exportToFile();
              toast.success('File exported', {
                description: 'Download started',
              });
            }}
            disabled={!hasOpenTabs}
          >
            <Download className="size-4 mr-2" />
            <span className="flex-1">Export (Download)</span>
            <Kbd className="ml-auto">⌘⇧E</Kbd>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {!selectedPortalId ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="relative flex items-center gap-2 my-2 cursor-help">
                  <Separator className="flex-1" />
                  <span className="shrink-0 px-2 text-xs text-muted-foreground select-none">
                    Portal Actions
                  </span>
                  <Separator className="flex-1" />
                </div>
              }
            />
            <TooltipContent>
              Portal actions are only available when connected to a portal
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="relative flex items-center gap-2 my-2">
            <Separator className="flex-1" />
            <span className="shrink-0 px-2 text-xs text-muted-foreground select-none">
              Portal Actions
            </span>
            <Separator className="flex-1" />
          </div>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem 
            onClick={() => {
              setModuleBrowserOpen(true);
              toast.info('Opening LogicModule Exchange...');
            }}
            disabled={!selectedPortalId}
          >
            <CloudDownload className="size-4 mr-2" />
            <span className="flex-1">Import from LMX</span>
            <Kbd className="ml-auto">⌘⇧I</Kbd>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => {
              setAppliesToTesterOpen(true);
              toast.info('Opening AppliesTo Toolbox...');
            }}
            disabled={!selectedPortalId}
          >
            <Hammer className="size-4 mr-2" />
            <span className="flex-1">AppliesTo Toolbox</span>
            <Kbd className="ml-auto">⌘⇧A</Kbd>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => {
              setDebugCommandsDialogOpen(true);
              toast.info('Opening Debug Commands...');
            }}
            disabled={!selectedPortalId}
          >
            <Wrench className="size-4 mr-2" />
            <span className="flex-1">Debug Commands</span>
            <Kbd className="ml-auto">⌘D</Kbd>
          </DropdownMenuItem>

          {isModuleTab && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuItem 
                    onClick={async () => {
                      if (!activeTabId) return;
                      try {
                        await fetchModuleForCommit(activeTabId);
                        setModuleCommitConfirmationOpen(true);
                      } catch (error) {
                        toast.error('Failed to prepare commit', {
                          description: error instanceof Error ? error.message : 'Unknown error',
                        });
                      }
                    }}
                    disabled={!selectedPortalId || !canCommit}
                  >
                    <Upload className="size-4 mr-2" />
                    <span className="flex-1">Commit to Module</span>
                  </DropdownMenuItem>
                }
              />
              {(!selectedPortalId || !canCommit) && (
                <TooltipContent>
                  {selectedPortalId && !canCommit 
                    ? 'No changes detected' 
                    : 'Portal connection required'}
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </DropdownMenuGroup>

        <div className="relative flex items-center gap-2 my-2">
          <Separator className="flex-1" />
          <span className="shrink-0 px-2 text-xs text-muted-foreground select-none">
            Layout
          </span>
          <Separator className="flex-1" />
        </div>

        <DropdownMenuGroup>
          <DropdownMenuItem 
            onClick={() => {
              toggleRightSidebar();
              toast.info(rightSidebarOpen ? 'Sidebar hidden' : 'Sidebar shown');
            }}
            disabled={!hasOpenTabs}
          >
            <PanelRight className="size-4 mr-2" />
            <span className="flex-1">{rightSidebarOpen ? 'Hide' : 'Show'} Sidebar</span>
            <Kbd className="ml-auto">⌘B</Kbd>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <div className="relative flex items-center gap-2 my-2">
          <Separator className="flex-1" />
          <span className="shrink-0 px-2 text-xs text-muted-foreground select-none">
            Settings
          </span>
          <Separator className="flex-1" />
        </div>

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => {
            setSettingsDialogOpen(true);
            toast.info('Opening settings...');
          }}>
            <Settings className="size-4 mr-2" />
            <span className="flex-1">Settings</span>
            <Kbd className="ml-auto">⌘,</Kbd>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

