import { useRef, useEffect, useState, useCallback, KeyboardEvent } from 'react';
import { X, Plus, Pencil, Circle, Save, Upload, Trash2, AlertTriangle, Braces, Link2, Cloud } from 'lucide-react';
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
import { normalizeMode } from '../utils/mode-utils';
import { isFileDirty, hasPortalChanges } from '../utils/document-helpers';
import {
  CollectionIcon,
  ConfigSourceIcon,
  EventSourceIcon,
  TopologySourceIcon,
  PropertySourceIcon,
  LogSourceIcon,
} from '../constants/icons';

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

// Language icons (using simple text badges for now)
function LanguageIcon({ language }: { language: EditorTab['language'] }) {
  return (
    <span className={cn(
      "text-[10px] font-mono font-medium px-1 py-0.5 rounded",
      language === 'groovy' 
        ? "bg-blue-500/20 text-blue-400" 
        : "bg-cyan-500/20 text-cyan-400"
    )}>
      {language === 'groovy' ? 'GR' : 'PS'}
    </span>
  );
}

function ApiBadge() {
  return (
    <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
      API
    </span>
  );
}

// Mode badge for execution mode indication
function ModeBadge({ mode }: { mode: EditorTab['mode'] }) {
  const normalizedMode = normalizeMode(mode);
  
  const modeColors: Record<string, string> = {
    ad: 'bg-purple-500/20 text-purple-400',
    collection: 'bg-green-500/20 text-green-400',
    batchcollection: 'bg-amber-500/20 text-amber-400',
    freeform: 'bg-gray-500/20 text-gray-400',
  };
  
  const modeLabels: Record<string, string> = {
    ad: 'Active Discovery',
    collection: 'Collection',
    batchcollection: 'Batch Collection',
    freeform: 'Freeform',
  };
  
  return (
    <span className={cn(
      "text-[10px] font-medium px-1 py-0.5 rounded",
      modeColors[normalizedMode]
    )}>
      {modeLabels[normalizedMode]}
    </span>
  );
}

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  isRenaming: boolean;
  /** Has unsaved local file changes (amber indicator) */
  isFileDirty: boolean;
  /** Has unpushed portal changes (blue indicator) */
  hasPortalChanges: boolean;
  canRename: boolean;
  selectedPortalId: string | null;
  portals: Portal[];
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onStartRename: () => void;
  onRename: (newName: string) => void;
  onCancelRename: () => void;
}

function TabItem({ 
  tab, 
  isActive, 
  isRenaming,
  isFileDirty: fileDirty,
  hasPortalChanges: portalChanges,
  canRename,
  selectedPortalId,
  portals,
  onActivate, 
  onClose, 
  onCloseOthers, 
  onCloseAll,
  onStartRename,
  onRename,
  onCancelRename,
}: TabItemProps) {
  // Combined dirty state for close confirmation
  const isDirty = fileDirty || portalChanges;
  const tabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [renameValue, setRenameValue] = useState(tab.displayName);
  const [isTabHovered, setIsTabHovered] = useState(false);
  
  // Scroll active tab into view
  useEffect(() => {
    if (isActive && tabRef.current) {
      tabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [isActive]);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      setRenameValue(tab.displayName);
      inputRef.current.focus();
      // Select the name part without extension
      const dotIndex = tab.displayName.lastIndexOf('.');
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isRenaming, tab.displayName]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== tab.displayName) {
      onRename(trimmed);
    } else {
      onCancelRename();
    }
  }, [renameValue, tab.displayName, onRename, onCancelRename]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelRename();
    }
  }, [handleRenameSubmit, onCancelRename]);

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

  // If renaming, show input instead of context menu trigger
  if (isRenaming) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-sm border-r border-border",
          "min-w-[120px] flex-shrink-0",
          "bg-background text-foreground border-b-2 border-b-primary"
        )}
      >
        {tab.kind === 'api' ? (
          <ApiBadge />
        ) : isModuleBound && ModuleIcon ? (
          <ModuleIcon className="size-4 shrink-0" />
        ) : (
          <LanguageIcon language={tab.language} />
        )}
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleRenameKeyDown}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm"
        />
      </div>
    );
  }
  
  return (
    <Tooltip>
      <ContextMenu>
        <TooltipTrigger
          render={
            <ContextMenuTrigger
              render={
                <button
                  ref={tabRef}
                  onClick={onActivate}
                  onDoubleClick={canRename ? onStartRename : undefined}
                  onMouseEnter={() => setIsTabHovered(true)}
                  onMouseLeave={() => setIsTabHovered(false)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    "group flex items-center gap-1.5 px-3 py-1.5 text-sm border-r border-border",
                    "min-w-[120px] flex-shrink-0",
                    "transition-colors duration-100",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                    isActive 
                      ? "bg-background text-foreground border-b-2 border-b-primary" 
                      : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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
                  <span className="min-w-0 flex-1 text-left flex items-center gap-1.5 overflow-hidden">
                    <span className="truncate">{tab.displayName}</span>
                    {tab.hasFileHandle && (
                      <span className="text-[10px] text-muted-foreground ml-1 opacity-70 flex-shrink-0">(local)</span>
                    )}
                  </span>
                  

                  {isPortalBound && (
                    <span
                      className={cn(
                        'flex items-center justify-center size-4 rounded-sm',
                        isPortalActive ? 'text-muted-foreground' : 'text-amber-500'
                      )}
                      aria-label={isPortalActive ? 'Portal bound' : 'Portal mismatch'}
                    >
                      <Link2 className="size-3" />
                    </span>
                  )}
                  
                  {/* Dirty indicators and close button container - fixed width to prevent layout shift */}
                  <span className="flex items-center gap-0.5 min-w-[20px] flex-shrink-0 justify-end">
                    {/* Portal changes indicator (blue cloud) - hidden when tab is hovered to show X */}
                    {portalChanges && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Cloud className={cn(
                              "size-3 flex-shrink-0 transition-opacity duration-100",
                              isActive ? "text-blue-400" : "text-blue-400/70",
                              isTabHovered && "opacity-0 pointer-events-none"
                            )} />
                          }
                        />
                        <TooltipContent side="bottom" className="text-xs">
                          Unpushed portal changes
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* File dirty indicator (amber dot) - hidden when tab is hovered to show X */}
                    {fileDirty && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Circle className={cn(
                              "size-2.5 fill-current flex-shrink-0 transition-opacity duration-100",
                              isActive ? "text-amber-400" : "text-muted-foreground",
                              isTabHovered && "opacity-0 pointer-events-none"
                            )} />
                          }
                        />
                        <TooltipContent side="bottom" className="text-xs">
                          Unsaved changes
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* Close button - shows on tab hover or when active */}
                    <span
                      role="button"
                      className="flex items-center justify-center size-4 rounded hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-1 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                      }}
                      aria-label={`Close ${tab.displayName}`}
                      tabIndex={-1}
                    >
                      <X className={cn(
                        "size-3 hover:text-destructive transition-opacity duration-100",
                        isDirty && !isTabHovered
                          ? "opacity-0" // Hide X when showing dirty indicators (tab not hovered)
                          : isTabHovered || isActive
                            ? "opacity-100" // Show X when tab is hovered or active
                            : "opacity-0" // Hide X otherwise
                      )} />
                    </span>
                  </span>
                </button>
              }
            />
          }
        />
        <ContextMenuContent>
          <ContextMenuItem 
            onClick={onStartRename}
            disabled={!canRename}
            title={!canRename ? "Cannot rename local files (name matches filesystem)" : undefined}
          >
            <Pencil className="size-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
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
            } catch (error) {
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
          <div className="text-[10px] text-muted-foreground mt-1">
            {isPortalActive ? 'Portal bound' : 'Portal mismatch'} • {portalLabel || 'Unknown portal'}
          </div>
        )}
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {tab.kind === 'api'
            ? 'API request tab'
            : tab.hasFileHandle 
              ? 'Local file • Saved to disk' 
              : 'Double-click to rename'}
        </div>
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
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    openTab,
    openApiExplorerTab,
    renameTab,
    preferences,
    saveFile,
    saveFileAs,
    canCommitModule,
    fetchModuleForCommit,
    setModuleCommitConfirmationOpen,
    moduleCommitConfirmationOpen,
  } = useEditorStore();
  
  // Track which tab is being renamed
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  // Track pending tab close with confirmation
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);
  // Track tab to close after successful commit
  const [tabToCloseAfterCommit, setTabToCloseAfterCommit] = useState<string | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  
  const activeTab = activeTabId ? tabs.find(t => t.id === activeTabId) : null;
  const isApiActive = activeTab?.kind === 'api';
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
    const saved = tab.hasFileHandle 
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

  // Get pending tab info
  const pendingTab = pendingCloseTabId ? tabs.find(t => t.id === pendingCloseTabId) : null;
  const isModuleTab = pendingTab?.source?.type === 'module';
  const isLocalFile = pendingTab?.hasFileHandle;
  const canCommit = pendingCloseTabId && canCommitModule(pendingCloseTabId);
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
      className="flex items-center bg-secondary/20 border-b border-border overflow-hidden"
      role="tablist"
      aria-label="Editor tabs"
      onKeyDown={handleKeyDown}
      ref={tabListRef}
    >
      {/* Scrollable tab list */}
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-border">
        {visibleTabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            isRenaming={renamingTabId === tab.id}
            isFileDirty={isFileDirty(tab)}
            hasPortalChanges={hasPortalChanges(tab)}
            canRename={!tab.hasFileHandle}
            selectedPortalId={selectedPortalId}
            portals={portals}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => handleTabClose(tab.id)}
            onCloseOthers={() => closeOtherTabs(tab.id)}
            onCloseAll={closeAllTabs}
            onStartRename={() => setRenamingTabId(tab.id)}
            onRename={(newName) => {
              renameTab(tab.id, newName);
              setRenamingTabId(null);
            }}
            onCancelRename={() => setRenamingTabId(null)}
          />
        ))}
      </div>
      
      {/* New tab button */}
      <div className="flex items-center px-1 border-l border-border">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewTab}
                className="h-6 px-2 gap-1 text-xs"
              >
                {isApiActive ? <Braces className="size-3.5" /> : <Plus className="size-3.5" />}
                <span>{isApiActive ? 'New API Request' : 'New File'}</span>
              </Button>
            }
          />
          <TooltipContent>{isApiActive ? 'Create a new API request tab' : 'Create a new file tab'}</TooltipContent>
        </Tooltip>
      </div>
      
      {/* Active tab info badges */}
      {activeTabId && (
        <div className="flex items-center gap-1 px-2 border-l border-border">
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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-amber-500/10">
                <AlertTriangle className="size-8 text-amber-500" />
              </AlertDialogMedia>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block">
                  The file <strong>{pendingTab.displayName}</strong> has unsaved changes.
                </span>
                <span className="block text-sm text-muted-foreground">
                  What would you like to do before closing?
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={handleCancelClose}>
                Cancel
              </AlertDialogCancel>
              {isLocalFile && (
                <AlertDialogAction
                  onClick={handleSaveAndClose}
                  variant="commit"
                  className="gap-2"
                >
                  <Save className="size-4" />
                  Save & Close
                </AlertDialogAction>
              )}
              {isModuleTab && canCommit && (
                <AlertDialogAction
                  onClick={handlePreviewCommit}
                  variant="commit"
                  className="gap-2"
                >
                  <Upload className="size-4" />
                  Preview Commit
                </AlertDialogAction>
              )}
              {isModuleTab && !canCommit && (
                <AlertDialogAction
                  onClick={handleSaveAndClose}
                  variant="commit"
                  className="gap-2"
                >
                  <Save className="size-4" />
                  Save a Local Copy & Close
                </AlertDialogAction>
              )}
              {!isLocalFile && !isModuleTab && (
                <AlertDialogAction
                  onClick={handleSaveAndClose}
                  variant="commit"
                  className="gap-2"
                >
                  <Save className="size-4" />
                  Save Locally
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
