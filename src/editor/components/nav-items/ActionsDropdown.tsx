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
  Calculator,
} from 'lucide-react';
import { fileToasts, portalToasts } from '../../utils/toast-utils';
import { DOCS_URLS } from '@/shared/app-config';
import { useEditorStore } from '../../stores/editor-store';
import { getPortalBindingStatus } from '../../utils/portal-binding';
import { switchWorkspaceWithLastTab } from '../../utils/workspace-navigation';
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
import { DropdownMenuSectionHeader } from '.././shared';
import { LMDA_MODULE_DOCS_URLS } from '@/shared/app-config';

export function ActionsDropdown() {
  const {
    tabs,
    activeTabId,
    selectedPortalId,
    portals,
    activeWorkspace,
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
  // Determine which workspace is active
  const isApiActive = activeWorkspace === 'api';
  const isCollectorSizingActive = activeWorkspace === 'collector-sizing';
  const canSendApi = Boolean(
    selectedPortalId &&
    activeTab?.kind === 'api' &&
    activeTab.api?.request.path.trim()
  );
  const canRunScript = Boolean(
    selectedPortalId &&
    activeTab?.kind !== 'api'
  );

  const switchToScriptView = () => {
    switchWorkspaceWithLastTab({
      targetWorkspace: 'script',
      tabs,
      setActiveWorkspace,
      setActiveTab,
    });
    // If no script tabs exist, the workspace will show EditorWelcomeScreen
  };

  const switchToApiView = () => {
    switchWorkspaceWithLastTab({
      targetWorkspace: 'api',
      tabs,
      setActiveWorkspace,
      setActiveTab,
    });
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
                  <span className="
                    hidden text-xs
                    sm:inline
                  ">Actions</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Actions Menu</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-72">
        {isCollectorSizingActive ? (
          // Collector Sizing workspace - only show workspace switching
          <>
            <DropdownMenuSectionHeader>Switch Workspace</DropdownMenuSectionHeader>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={switchToScriptView}>
                <FilePlus className="mr-2 size-4" />
                <span className="flex-1">Switch to Script Editor</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={switchToApiView}>
                <Braces className="mr-2 size-4" />
                <span className="flex-1">Switch to API Explorer</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : (
          // Script/API workspaces - show full actions
          <>
            <DropdownMenuGroup>
              <DropdownMenuSectionHeader>
                {isApiActive ? 'API Actions' : 'File Actions'}
              </DropdownMenuSectionHeader>

              {isApiActive ? (
            <>
              <DropdownMenuItem onClick={() => openApiExplorerTab()}>
                <Braces className="mr-2 size-4" />
                <span className="flex-1">New API Request</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>N</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => executeApiRequest(activeTabId ?? undefined)}
                disabled={!canSendApi}
              >
                <Send className="mr-2 size-4" />
                <span className="flex-1">Send Request</span>
                <Kbd className="ml-auto">⌘↵</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={switchToScriptView}>
                <ArrowLeftRight className="mr-2 size-4" />
                <span className="flex-1">Switch to Script Editor</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>M</Kbd>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => executeScript()}
                disabled={!canRunScript}
              >
                <Play className="mr-2 size-4" />
                <span className="flex-1">Run Script</span>
                <Kbd className="ml-auto">⌘↵</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                createNewFile();
              }}>
                <FilePlus className="mr-2 size-4" />
                <span className="flex-1">New File</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>N</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={switchToApiView}>
                <Braces className="mr-2 size-4" />
                <span className="flex-1">Switch to API Explorer</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>M</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => {
                openFileFromDisk();
              }}>
                <FileInput className="mr-2 size-4" />
                <span className="flex-1">Open File...</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>O</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => {
                void openModuleFolderFromDisk();
              }}>
                <Folder className="mr-2 size-4" />
                <span className="flex-1">Open Module Folder...</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>F</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => void saveFile()}
                disabled={!hasOpenTabs}
              >
                <Save className="mr-2 size-4" />
                <span className="flex-1">Save</span>
                <Kbd className="ml-auto">⌘S</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => void saveFileAs()}
                disabled={!hasOpenTabs}
              >
                <Download className="mr-2 size-4" />
                <span className="flex-1">Save As...</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>⇧S</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => {
                  exportToFile();
                  fileToasts.exported();
                }}
                disabled={!hasOpenTabs}
              >
                <Download className="mr-2 size-4" />
                <span className="flex-1">Export (Download)</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>E</Kbd>
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
                <CloudDownload className="mr-2 size-4" />
                <span className="flex-1">Import from LMX</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>I</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => {
                  setModuleSearchOpen(true);
                }}
                disabled={!selectedPortalId}
              >
                <FolderSearch className="mr-2 size-4" />
                <span className="flex-1">Search LogicModules</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>S</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => {
                  setAppliesToTesterOpen(true);
                }}
                disabled={!selectedPortalId}
              >
                <Hammer className="mr-2 size-4" />
                <span className="flex-1">AppliesTo Toolbox</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>A</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => {
                  setDebugCommandsDialogOpen(true);
                }}
                disabled={!selectedPortalId}
              >
                <Wrench className="mr-2 size-4" />
                <span className="flex-1">Debug Commands</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>D</Kbd>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={() => {
                  setModuleSnippetsDialogOpen(true);
                }}
                disabled={!selectedPortalId}
              >
                <Puzzle className="mr-2 size-4" />
                <span className="flex-1">Module Snippets</span>
                <Kbd className="ml-auto">⌘K</Kbd> <Kbd>L</Kbd>
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
                            portalToasts.prepareCommitFailed(error instanceof Error ? error : undefined);
                          }
                        }}
                        disabled={!selectedPortalId || !canCommit}
                      >
                        <Upload className="mr-2 size-4" />
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
                <PanelRight className="mr-2 size-4" />
                <span className="flex-1">{rightSidebarOpen ? 'Hide' : 'Show'} Sidebar</span>
                <Kbd className="ml-auto">⌘B</Kbd>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSectionHeader>Utilities</DropdownMenuSectionHeader>

            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => setActiveWorkspace('collector-sizing')}
              >
                <Calculator className="mr-2 size-4" />
                <span className="flex-1">Collector Sizing Calculator</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSectionHeader>Settings & Help</DropdownMenuSectionHeader>

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => {
            setSettingsDialogOpen(true);
          }}>
            <Settings className="mr-2 size-4" />
            <span className="flex-1">Settings</span>
            <Kbd className="ml-auto">⌘,</Kbd>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => {
            window.open(DOCS_URLS.home, '_blank');
          }}>
            <BookOpen className="mr-2 size-4" />
            <span className="flex-1">Documentation</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => {
            window.open(LMDA_MODULE_DOCS_URLS.docs, '_blank');
          }}>
            <Terminal className="mr-2 size-4" />
            <span className="flex-1">Install the LM Pwsh Module</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
