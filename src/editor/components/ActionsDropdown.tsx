import {  
  Download,
  FileInput,
  FilePlus,
  Folder,
  Save,
  Settings,
  CommandIcon,
  PanelRight,
  CloudDownload,
  FolderSearch,
  Hammer,
  Wrench,
  Upload,
  Send,
  Braces,
  ArrowLeftRight,
  Play,
  Puzzle,
  BookOpen,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { getPortalBindingStatus } from '../utils/portal-binding';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { DropdownMenuSectionHeader } from './shared';

export function ActionsDropdown() {
  const {
    tabs,
    activeTabId,
    selectedPortalId,
    portals,
    setActiveTab,
    setActiveWorkspace,
    setModuleBrowserOpen,
    setModuleSearchOpen,
    setSettingsDialogOpen,
    setAppliesToTesterOpen,
    setDebugCommandsDialogOpen,
    setModuleSnippetsDialogOpen,
    rightSidebarOpen,
    toggleRightSidebar,
    createNewFile,
    openFileFromDisk,
    openModuleFolderFromDisk,
    saveFile,
    saveFileAs,
    exportToFile,
    openApiExplorerTab,
    executeApiRequest,
    executeScript,
    canCommitModule,
    fetchModuleForCommit,
    setModuleCommitConfirmationOpen,
  } = useEditorStore();

  const hasOpenTabs = tabs.length > 0;
  const activeTab = tabs.find(t => t.id === activeTabId);
  const isModuleTab = activeTab?.source?.type === 'module';
  const portalBinding = activeTab && isModuleTab
    ? getPortalBindingStatus(activeTab, selectedPortalId, portals)
    : null;
  const isPortalBoundActive = portalBinding?.isActive ?? true;
  const canCommit = activeTabId && isModuleTab && canCommitModule(activeTabId);
  const isApiActive = activeTab?.kind === 'api';
  const canSendApi = Boolean(
    selectedPortalId &&
    activeTab?.kind === 'api' &&
    activeTab.api?.request.path.trim()
  );
  const canRunScript = Boolean(
    selectedPortalId &&
    activeTab?.kind !== 'api'
  );

  const getLastTabIdByKind = (kind: 'api' | 'script') => {
    return [...tabs].reverse().find(tab => (tab.kind ?? 'script') === kind)?.id ?? null;
  };

  const switchToScriptView = () => {
    setActiveWorkspace('script');
    const lastScript = getLastTabIdByKind('script');
    if (lastScript) {
      setActiveTab(lastScript);
    }
    // If no script tabs exist, the workspace will show WelcomeScreenV2
  };

  const switchToApiView = () => {
    setActiveWorkspace('api');
    const lastApi = getLastTabIdByKind('api');
    if (lastApi) {
      setActiveTab(lastApi);
    }
    // If no API tabs exist, the workspace will show ApiWelcomeScreen
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="toolbar-outline"
                  size="toolbar"
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
          <DropdownMenuSectionHeader>
            {isApiActive ? 'API Actions' : 'File Actions'}
          </DropdownMenuSectionHeader>

          {isApiActive ? (
            <>
              <DropdownMenuItem onClick={() => openApiExplorerTab()}>
                <Braces className="size-4 mr-2" />
                <span className="flex-1">New API Request</span>
                <Kbd className="ml-auto">⌘K</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => executeApiRequest(activeTabId ?? undefined)}
                disabled={!canSendApi}
              >
                <Send className="size-4 mr-2" />
                <span className="flex-1">Send Request</span>
                <Kbd className="ml-auto">⌘↵</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={switchToScriptView}>
                <ArrowLeftRight className="size-4 mr-2" />
                <span className="flex-1">Switch to Script Editor</span>
                <Kbd className="ml-auto">⌘⇧M</Kbd>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => executeScript()}
                disabled={!canRunScript}
              >
                <Play className="size-4 mr-2" />
                <span className="flex-1">Run Script</span>
                <Kbd className="ml-auto">⌘↵</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                createNewFile();
              }}>
                <FilePlus className="size-4 mr-2" />
                <span className="flex-1">New File</span>
                <Kbd className="ml-auto">⌘K</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={switchToApiView}>
                <Braces className="size-4 mr-2" />
                <span className="flex-1">Switch to API Explorer</span>
                <Kbd className="ml-auto">⌘⇧M</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => {
                openFileFromDisk();
              }}>
                <FileInput className="size-4 mr-2" />
                <span className="flex-1">Open File...</span>
                <Kbd className="ml-auto">⌘O</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => {
                void openModuleFolderFromDisk();
              }}>
                <Folder className="size-4 mr-2" />
                <span className="flex-1">Open Module Folder...</span>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => void saveFile()}
                disabled={!hasOpenTabs}
              >
                <Save className="size-4 mr-2" />
                <span className="flex-1">Save</span>
                <Kbd className="ml-auto">⌘S</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => void saveFileAs()}
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
            </>
          )}
        </DropdownMenuGroup>

        {!isApiActive && (
          <>
            {!selectedPortalId ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div className="cursor-help">
                      <DropdownMenuSectionHeader>Portal Actions</DropdownMenuSectionHeader>
                    </div>
                  }
                />
                <TooltipContent>
                  Portal actions are only available when connected to a portal
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuSectionHeader>Portal Actions</DropdownMenuSectionHeader>
            )}

            <DropdownMenuGroup>
              <DropdownMenuItem 
                onClick={() => {
                  setModuleBrowserOpen(true);
                }}
                disabled={!selectedPortalId}
              >
                <CloudDownload className="size-4 mr-2" />
                <span className="flex-1">Import from LMX</span>
                <Kbd className="ml-auto">⌘⇧I</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => {
                  setModuleSearchOpen(true);
                }}
                disabled={!selectedPortalId}
              >
                <FolderSearch className="size-4 mr-2" />
                <span className="flex-1">Search LogicModules</span>
                <Kbd className="ml-auto">⌘⇧F</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => {
                  setAppliesToTesterOpen(true);
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
                }}
                disabled={!selectedPortalId}
              >
                <Wrench className="size-4 mr-2" />
                <span className="flex-1">Debug Commands</span>
                <Kbd className="ml-auto">⌘⇧D</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => {
                  setModuleSnippetsDialogOpen(true);
                }}
              >
                <Puzzle className="size-4 mr-2" />
                <span className="flex-1">Module Snippets</span>
                <Kbd className="ml-auto">⌘⇧L</Kbd>
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
                        <span className="flex-1">Push to Portal</span>
                      </DropdownMenuItem>
                    }
                  />
                  {(!selectedPortalId || !canCommit) && (
                    <TooltipContent>
                      {!isPortalBoundActive
                        ? 'Portal mismatch: switch to the bound portal to commit'
                        : selectedPortalId && !canCommit 
                          ? 'No changes detected' 
                          : 'Portal connection required'}
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSectionHeader>Layout</DropdownMenuSectionHeader>

        <DropdownMenuGroup>
          <DropdownMenuItem 
            onClick={() => {
              toggleRightSidebar();
            }}
            disabled={!hasOpenTabs}
          >
            <PanelRight className="size-4 mr-2" />
            <span className="flex-1">{rightSidebarOpen ? 'Hide' : 'Show'} Sidebar</span>
            <Kbd className="ml-auto">⌘B</Kbd>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSectionHeader>Settings & Help</DropdownMenuSectionHeader>

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => {
            setSettingsDialogOpen(true);
          }}>
            <Settings className="size-4 mr-2" />
            <span className="flex-1">Settings</span>
            <Kbd className="ml-auto">⌘,</Kbd>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => {
            window.open('https://stevevillardi.github.io/lmda-composer/', '_blank');
          }}>
            <BookOpen className="size-4 mr-2" />
            <span className="flex-1">Documentation</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => {
            window.open('https://logicmonitor.github.io/lm-powershell-module-docs/', '_blank');
          }}>
            <Terminal className="size-4 mr-2" />
            <span className="flex-1">Install the LM Pwsh Module</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
