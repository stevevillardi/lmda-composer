import { useRef, useEffect, useState, useCallback, KeyboardEvent } from 'react';
import { X, Plus, Circle, Save, Upload, Trash2, AlertTriangle, Braces, Link2, Cloud, Folder } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import { cn } from '@/lib/utils';
import type { EditorTab, Portal, LogicModuleType } from '@/shared/types';
import { getDefaultScriptTemplate } from '../config/script-templates';
import { getPortalBindingStatus } from '../utils/portal-binding';
import { isFileDirty, hasPortalChanges, hasAssociatedFileHandle } from '../utils/document-helpers';
import {
  CollectionIcon,
  ConfigSourceIcon,
  EventSourceIcon,
  TopologySourceIcon,
  PropertySourceIcon,
  LogSourceIcon,
} from '../constants/icons';
import { LanguageBadge, ApiBadge, ModeBadge } from './shared';

/** Returns the appropriate module type icon component for a given LogicModuleType */
function getModuleTypeIcon(moduleType: LogicModuleType) {
  switch (moduleType) {
    case 'datasource':
      return CollectionIcon;
    case 'configsource':
      return ConfigSourceIcon;
    case 'eventsource':
      return EventSourceIcon;
    case 'topologysource':
      return TopologySourceIcon;
    case 'propertysource':
      return PropertySourceIcon;
    case 'logsource':
      return LogSourceIcon;
    default:
      return CollectionIcon;
  }
}

// Re-export LanguageBadge with EditorTab type for backwards compatibility
function LanguageIcon({ language }: { language: EditorTab['language'] }) {
  return <LanguageBadge language={language} />;
}

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  /** Has unsaved local file changes (amber indicator) */
  isFileDirty: boolean;
  /** Has unpushed portal changes (blue indicator) */
  hasPortalChanges: boolean;
  selectedPortalId: string | null;
  portals: Portal[];
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
}

function TabItem({ 
  tab, 
  isActive, 
  isFileDirty: fileDirty,
  hasPortalChanges: portalChanges,
  selectedPortalId,
  portals,
  onActivate, 
  onClose, 
  onCloseOthers, 
  onCloseAll,
}: TabItemProps) {
  const tabRef = useRef<HTMLDivElement>(null);
  const [isTabHovered, setIsTabHovered] = useState(false);
  
  // Scroll active tab into view
  useEffect(() => {
    if (isActive && tabRef.current) {
      tabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [isActive]);

  const portalBinding = tab.source?.type === 'module'
    ? getPortalBindingStatus(tab, selectedPortalId, portals)
    : null;
  const isPortalBound = !!portalBinding;
  const isPortalActive = portalBinding?.isActive ?? true;
  const portalLabel = portalBinding?.portalHostname || portalBinding?.portalId;
  
  // Get module type icon for module-bound tabs
  const isModuleBound = tab.source?.type === 'module' && tab.source?.moduleType;
  const ModuleIcon = isModuleBound ? getModuleTypeIcon(tab.source!.moduleType!) : null;

  // Build tooltip content
  const tooltipContent = tab.source?.moduleName 
    ? `${tab.source.moduleName}/${tab.displayName.split('/').pop()}`
    : tab.displayName;

  return (
    <Tooltip>
      <ContextMenu>
        <TooltipTrigger
          render={
            <ContextMenuTrigger
              render={
                <div
                  ref={tabRef}
                  onClick={onActivate}
                  onMouseEnter={() => setIsTabHovered(true)}
                  onMouseLeave={() => setIsTabHovered(false)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onActivate();
                    }
                  }}
                  className={cn(
                    `
                      group flex items-center gap-1.5 border-r border-border
                      px-3 py-1.5 text-sm
                    `,
                    "min-w-[120px] shrink-0",
                    "transition-colors duration-100",
                    `
                      focus:ring-2 focus:ring-primary focus:ring-offset-1
                      focus:outline-none
                    `,
                    isActive 
                      ? `
                        border-b-2 border-b-primary bg-background
                        text-foreground
                      ` 
                      : `
                        bg-secondary/30 text-muted-foreground
                        hover:bg-secondary/50 hover:text-foreground
                      `
                  )}
                >
                  {/* Language/Module type indicator */}
                  {tab.kind === 'api' ? (
                    <ApiBadge />
                  ) : isModuleBound && ModuleIcon ? (
                    <ModuleIcon className="size-4 shrink-0" />
                  ) : (
                    <LanguageIcon language={tab.language} />
                  )}
                  
                  {/* Tab name */}
                  <span className="
                    flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden
                    text-left
                  ">
                    <span className="truncate">{tab.displayName}</span>
                    {hasAssociatedFileHandle(tab) && (
                      <span className="
                        ml-1 shrink-0 text-[10px] text-muted-foreground
                        opacity-70
                      ">(local)</span>
                    )}
                  </span>
                  

                  {isPortalBound && (
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm',
                        isPortalActive ? 'text-muted-foreground' : `
                          text-yellow-500
                        `
                      )}
                      aria-label={isPortalActive ? 'Portal bound' : 'Portal mismatch'}
                    >
                      <Link2 className="size-3" />
                    </span>
                  )}
                  
                  {/* Dirty indicators and close button container */}
                  <span className="flex shrink-0 items-center gap-0.5">
                    {/* Portal changes indicator (blue cloud) */}
                    {portalChanges && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Cloud className={cn(
                              "size-3 shrink-0",
                              isActive ? "text-cyan-400" : "text-cyan-400/70"
                            )} />
                          }
                        />
                        <TooltipContent side="bottom" className="text-xs">
                          Unpushed portal changes
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* File dirty indicator (amber dot) */}
                    {fileDirty && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Circle className={cn(
                              "size-2.5 shrink-0 fill-current",
                              isActive ? "text-yellow-400" : `
                                text-muted-foreground
                              `
                            )} />
                          }
                        />
                        <TooltipContent side="bottom" className="text-xs">
                          Unsaved changes
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* Close button - shows on tab hover or when active */}
                    <button
                      type="button"
                      className="
                        flex size-4 shrink-0 cursor-pointer items-center
                        justify-center rounded-sm
                        hover:bg-destructive/20
                        focus-visible:ring-2 focus-visible:ring-ring
                        focus-visible:ring-offset-1 focus-visible:outline-none
                      "
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                      }}
                      aria-label={`Close ${tab.displayName}`}
                      tabIndex={-1}
                    >
                      <X className={cn(
                        `
                          size-3 transition-opacity duration-100
                          hover:text-destructive
                        `,
                        isTabHovered || isActive ? "opacity-100" : "opacity-0"
                      )} />
                    </button>
                  </span>
                </div>
              }
            />
          }
        />
        <ContextMenuContent>
          <ContextMenuItem onClick={onClose}>
            Close
          </ContextMenuItem>
          <ContextMenuItem onClick={onCloseOthers}>
            Close Others
          </ContextMenuItem>
          <ContextMenuItem onClick={onCloseAll}>
            Close All
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={async () => {
            try {
              await navigator.clipboard.writeText(tab.displayName);
              toast.success('Copied to clipboard', {
                description: tab.displayName,
              });
            } catch (_error) {
              toast.error('Failed to copy', {
                description: 'Could not copy tab name to clipboard',
              });
            }
          }}>
            Copy Name
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="text-xs">{tooltipContent}</div>
        {isPortalBound && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {isPortalActive ? 'Portal bound' : 'Portal mismatch'} • {portalLabel || 'Unknown portal'}
          </div>
        )}
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {tab.kind === 'api'
            ? 'API request tab'
            : hasAssociatedFileHandle(tab) 
              ? 'Local file • Saved to disk' 
              : tab.directoryHandleId
                ? 'Module directory • Saved to disk'
                : isPortalBound
                  ? 'Portal module • Not saved locally'
                  : 'New file'}
        </div>
        {(portalChanges || fileDirty) && (
          <div className="
            mt-1 flex items-center gap-2 border-t border-border/50 pt-1
            text-[10px]
          ">
            {portalChanges && (
              <span className="flex items-center gap-1 text-cyan-400">
                <Cloud className="size-2.5" />
                Unpushed changes
              </span>
            )}
            {fileDirty && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Circle className="size-2 fill-current" />
                Unsaved changes
              </span>
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function TabBar() {
  const {
    tabs,
    activeTabId,
    selectedPortalId,
    portals,
    activeWorkspace,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    openTab,
    openApiExplorerTab,
    preferences,
    saveFile,
    saveFileAs,
    saveModuleDirectory,
    canCommitModule,
    fetchModuleForCommit,
    setModuleCommitConfirmationOpen,
    moduleCommitConfirmationOpen,
  } = useEditorStore();
  
  // Track pending tab close with confirmation
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);
  // Track tab to close after successful commit
  const [tabToCloseAfterCommit, setTabToCloseAfterCommit] = useState<string | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  
  const activeTab = activeTabId ? tabs.find(t => t.id === activeTabId) : null;
  // Use activeWorkspace state, or fall back to active tab kind if available
  const isApiActive = activeTab ? activeTab.kind === 'api' : activeWorkspace === 'api';
  const activeView = isApiActive ? 'api' : 'script';
  const visibleTabs = tabs.filter(tab => (tab.kind ?? 'script') === activeView);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!tabListRef.current) return;
    
    const currentIndex = visibleTabs.findIndex(t => t.id === activeTabId);
    if (currentIndex === -1) return;
    
    let targetIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        targetIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        targetIndex = Math.min(visibleTabs.length - 1, currentIndex + 1);
        break;
      case 'Home':
        e.preventDefault();
        targetIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        targetIndex = visibleTabs.length - 1;
        break;
      default:
        return;
    }
    
    if (targetIndex !== currentIndex) {
      setActiveTab(visibleTabs[targetIndex].id);
      // Focus the tab button
      const tabButton = tabListRef.current.querySelector(
        `button[role="tab"][aria-controls="tabpanel-${visibleTabs[targetIndex].id}"]`
      ) as HTMLButtonElement;
      tabButton?.focus();
    }
  }, [visibleTabs, activeTabId, setActiveTab]);
  
  // Handle tab close with dirty check
  const handleTabClose = useCallback(async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // Check for either file dirty or portal changes
    const hasUnsavedChanges = isFileDirty(tab) || hasPortalChanges(tab);
    if (!hasUnsavedChanges) {
      // Not dirty, close immediately
      closeTab(tabId);
      return;
    }
    
    // Dirty - show confirmation dialog
    setPendingCloseTabId(tabId);
  }, [tabs, closeTab]);

  // Handle close confirmation actions
  const handleSaveAndClose = useCallback(async () => {
    if (!pendingCloseTabId) return;
    const tab = tabs.find(t => t.id === pendingCloseTabId);
    if (!tab) {
      setPendingCloseTabId(null);
      return;
    }

    // Determine which save function to use
    const saved = hasAssociatedFileHandle(tab) 
      ? await saveFile(pendingCloseTabId)
      : await saveFileAs(pendingCloseTabId);
    
    // Toast is shown inside saveFile/saveFileAs
    if (saved) {
      closeTab(pendingCloseTabId);
    }
    // If saved is false, user may have cancelled - don't close
    setPendingCloseTabId(null);
  }, [pendingCloseTabId, tabs, saveFile, saveFileAs, closeTab]);

  const handlePreviewCommit = useCallback(async () => {
    if (!pendingCloseTabId) return;
    const tab = tabs.find(t => t.id === pendingCloseTabId);
    if (!tab || tab.source?.type !== 'module') {
      setPendingCloseTabId(null);
      return;
    }

    try {
      // Store the tab ID to close after successful commit
      setTabToCloseAfterCommit(pendingCloseTabId);
      // Fetch module data and open commit confirmation dialog
      await fetchModuleForCommit(pendingCloseTabId);
      setModuleCommitConfirmationOpen(true);
      // Close the close confirmation dialog
      setPendingCloseTabId(null);
    } catch (error) {
      toast.error('Failed to prepare commit', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setPendingCloseTabId(null);
      setTabToCloseAfterCommit(null);
    }
  }, [pendingCloseTabId, tabs, fetchModuleForCommit, setModuleCommitConfirmationOpen]);

  const handleDiscardAndClose = useCallback(() => {
    if (!pendingCloseTabId) return;
    closeTab(pendingCloseTabId);
    setPendingCloseTabId(null);
  }, [pendingCloseTabId, closeTab]);

  const handleCancelClose = useCallback(() => {
    setPendingCloseTabId(null);
  }, []);

  // Close tab after successful push to portal
  useEffect(() => {
    if (!moduleCommitConfirmationOpen && tabToCloseAfterCommit) {
      const tab = tabs.find(t => t.id === tabToCloseAfterCommit);
      // If tab exists and has no more portal changes (push was successful), close it
      if (tab && !hasPortalChanges(tab)) {
        closeTab(tabToCloseAfterCommit);
        setTabToCloseAfterCommit(null);
      } else if (!tab) {
        // Tab was already closed, just clear the state
        setTabToCloseAfterCommit(null);
      } else {
        // Push failed or was cancelled, clear the state
        setTabToCloseAfterCommit(null);
      }
    }
  }, [moduleCommitConfirmationOpen, tabToCloseAfterCommit, tabs, closeTab]);

  // Get pending tab info for close confirmation
  const pendingTab = pendingCloseTabId ? tabs.find(t => t.id === pendingCloseTabId) : null;
  const isModuleTab = pendingTab?.source?.type === 'module';
  const isLocalFile = pendingTab ? hasAssociatedFileHandle(pendingTab) : false;
  const isDirectorySaved = !!pendingTab?.directoryHandleId;
  const pendingHasFileDirty = pendingTab ? isFileDirty(pendingTab) : false;
  const pendingHasPortalChanges = pendingTab ? hasPortalChanges(pendingTab) : false;
  const canCommit = pendingCloseTabId && canCommitModule(pendingCloseTabId);
  
  // Determine dialog scenario
  type CloseScenario = 'directory-saved' | 'portal-module' | 'local-file' | 'scratch';
  const getCloseScenario = (): CloseScenario => {
    if (!pendingTab) return 'scratch';
    if (isDirectorySaved) return 'directory-saved';
    if (isModuleTab) return 'portal-module';
    if (isLocalFile) return 'local-file';
    return 'scratch';
  };
  const closeScenario = getCloseScenario();

  // Handle save to module directory for close dialog
  const handleSaveToDirectoryAndClose = async () => {
    if (!pendingCloseTabId) return;
    // For already directory-saved tabs, just save
    if (isDirectorySaved) {
      const saved = await saveFile(pendingCloseTabId);
      if (saved) {
        closeTab(pendingCloseTabId);
      }
    } else {
      // For portal modules not yet saved, save as module directory
      const saved = await saveModuleDirectory(pendingCloseTabId);
      if (saved) {
        closeTab(pendingCloseTabId);
      }
    }
    setPendingCloseTabId(null);
  };
  
  // Create a new untitled tab
  const handleNewTab = () => {
    if (isApiActive) {
      openApiExplorerTab();
      return;
    }

    const extension = preferences.defaultLanguage === 'groovy' ? 'groovy' : 'ps1';
    const template = getDefaultScriptTemplate(preferences.defaultLanguage);
    
    // Find a unique name
    let counter = 1;
    let displayName = `Untitled.${extension}`;
    while (tabs.some(t => t.displayName === displayName)) {
      displayName = `Untitled ${counter}.${extension}`;
      counter++;
    }
    
    openTab({
      displayName,
      content: template,
      language: preferences.defaultLanguage,
      mode: preferences.defaultMode,
    });
  };
  
  return (
    <div 
      className="
        flex items-center overflow-hidden border-b border-border bg-secondary/20
      "
      role="tablist"
      aria-label="Editor tabs"
      onKeyDown={handleKeyDown}
      ref={tabListRef}
    >
      {/* Scrollable tab list */}
      <div className="
        scrollbar-thin scrollbar-thumb-border flex flex-1 items-center
        overflow-x-auto
      ">
        {visibleTabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            isFileDirty={isFileDirty(tab)}
            hasPortalChanges={hasPortalChanges(tab)}
            selectedPortalId={selectedPortalId}
            portals={portals}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => handleTabClose(tab.id)}
            onCloseOthers={() => closeOtherTabs(tab.id)}
            onCloseAll={closeAllTabs}
          />
        ))}
      </div>
      
      {/* New tab button */}
      <div className="flex items-center border-l border-border px-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewTab}
                className="h-6 gap-1 px-2 text-xs"
              >
                {isApiActive ? <Braces className="size-3.5" /> : <Plus className="
                  size-3.5
                " />}
                <span>{isApiActive ? 'New API Request' : 'New File'}</span>
              </Button>
            }
          />
          <TooltipContent>{isApiActive ? 'Create a new API request tab' : 'Create a new file tab'}</TooltipContent>
        </Tooltip>
      </div>
      
      {/* Active tab info badges */}
      {activeTabId && (
        <div className="
          flex items-center gap-1 border-l border-border px-2 select-none
        ">
          {(() => {
            if (!activeTab) return null;
            if (activeTab.kind === 'api') {
              return <ApiBadge />;
            }
            return <ModeBadge mode={activeTab.mode} />;
          })()}
        </div>
      )}

      {/* Close Confirmation Dialog */}
      {pendingTab && (
        <AlertDialog open={pendingCloseTabId !== null} onOpenChange={(open) => !open && handleCancelClose()}>
          <AlertDialogContent className="max-w-xl!">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-yellow-500/10">
                <AlertTriangle className="size-8 text-yellow-500" />
              </AlertDialogMedia>
              <AlertDialogTitle>
                {closeScenario === 'directory-saved' && 'Unsaved Changes'}
                {closeScenario === 'portal-module' && 'Unpushed Portal Changes'}
                {closeScenario === 'local-file' && 'Unsaved Changes'}
                {closeScenario === 'scratch' && 'Unsaved File'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block">
                  <strong>{pendingTab.displayName}</strong>
                  {closeScenario === 'directory-saved' && (
                    <>
                      {pendingHasFileDirty && ' has unsaved changes to disk'}
                      {pendingHasFileDirty && pendingHasPortalChanges && ' and'}
                      {pendingHasPortalChanges && ' has unpushed changes to the portal'}
                      .
                    </>
                  )}
                  {closeScenario === 'portal-module' && ' has unpushed portal changes.'}
                  {closeScenario === 'local-file' && ' has unsaved changes.'}
                  {closeScenario === 'scratch' && ' has not been saved.'}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  What would you like to do before closing?
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="
              flex-col gap-2
              sm:flex-row
            ">
              <AlertDialogCancel onClick={handleCancelClose}>
                Cancel
              </AlertDialogCancel>
              
              {/* Scenario: Directory-saved module */}
              {closeScenario === 'directory-saved' && (
                <>
                  {pendingHasFileDirty && (
                    <AlertDialogAction
                      onClick={handleSaveToDirectoryAndClose}
                      variant="commit"
                      className="gap-2"
                    >
                      <Folder className="size-4" />
                      Save to Directory
                    </AlertDialogAction>
                  )}
                  {pendingHasPortalChanges && canCommit && (
                    <AlertDialogAction
                      onClick={handlePreviewCommit}
                      variant="commit"
                      className="gap-2"
                    >
                      <Upload className="size-4" />
                      Push to Portal
                    </AlertDialogAction>
                  )}
                </>
              )}
              
              {/* Scenario: Portal module (not locally saved) */}
              {closeScenario === 'portal-module' && (
                <>
                  {canCommit && (
                    <AlertDialogAction
                      onClick={handlePreviewCommit}
                      variant="commit"
                      className="gap-2"
                    >
                      <Upload className="size-4" />
                      Push to Portal
                    </AlertDialogAction>
                  )}
                  <AlertDialogAction
                    onClick={handleSaveToDirectoryAndClose}
                    variant="outline"
                    className="gap-2"
                  >
                    <Folder className="size-4" />
                    Save Module Directory
                  </AlertDialogAction>
                </>
              )}
              
              {/* Scenario: Local file */}
              {closeScenario === 'local-file' && (
                <AlertDialogAction
                  onClick={handleSaveAndClose}
                  variant="commit"
                  className="gap-2"
                >
                  <Save className="size-4" />
                  Save & Close
                </AlertDialogAction>
              )}
              
              {/* Scenario: Scratch file */}
              {closeScenario === 'scratch' && (
                <AlertDialogAction
                  onClick={handleSaveAndClose}
                  variant="commit"
                  className="gap-2"
                >
                  <Save className="size-4" />
                  Save As...
                </AlertDialogAction>
              )}
              
              <AlertDialogAction
                onClick={handleDiscardAndClose}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="size-4" />
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
