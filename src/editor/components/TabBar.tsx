import { useRef, useEffect, useState, useCallback, KeyboardEvent } from 'react';
import { X, Plus, Pencil, Circle, Save, Upload, Trash2 } from 'lucide-react';
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
import type { EditorTab } from '@/shared/types';

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

// Mode badge for execution mode indication
function ModeBadge({ mode }: { mode: EditorTab['mode'] }) {
  const modeColors = {
    ad: 'bg-purple-500/20 text-purple-400',
    collection: 'bg-green-500/20 text-green-400',
    batchcollection: 'bg-amber-500/20 text-amber-400',
    freeform: 'bg-gray-500/20 text-gray-400',
  };
  
  const modeLabels = {
    ad: 'Active Discovery',
    collection: 'Collection',
    batchcollection: 'Batch Collection',
    freeform: 'Freeform',
  };
  
  return (
    <span className={cn(
      "text-[10px] font-medium px-1 py-0.5 rounded",
      modeColors[mode]
    )}>
      {modeLabels[mode]}
    </span>
  );
}

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  isRenaming: boolean;
  isDirty: boolean;
  canRename: boolean;
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
  isDirty,
  canRename,
  onActivate, 
  onClose, 
  onCloseOthers, 
  onCloseAll,
  onStartRename,
  onRename,
  onCancelRename,
}: TabItemProps) {
  const tabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [renameValue, setRenameValue] = useState(tab.displayName);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  
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
          "min-w-[120px] max-w-[200px] shrink-0",
          "bg-background text-foreground border-b-2 border-b-primary"
        )}
      >
        <LanguageIcon language={tab.language} />
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
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    "group flex items-center gap-1.5 px-3 py-1.5 text-sm border-r border-border",
                    "min-w-[120px] max-w-[250px] shrink-0",
                    "transition-colors duration-100",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                    isActive 
                      ? "bg-background text-foreground border-b-2 border-b-primary" 
                      : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  {/* Language indicator */}
                  <LanguageIcon language={tab.language} />
                  
                  {/* Tab name */}
                  <span className="truncate flex-1 text-left">
                    {tab.displayName}
                    {tab.hasFileHandle && (
                      <span className="text-[10px] text-muted-foreground ml-1 opacity-70">(local)</span>
                    )}
                  </span>
                  
                  {/* Close/Dirty indicator */}
                  <button
                    type="button"
                    className="flex items-center justify-center size-4 rounded hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    onMouseEnter={() => setIsCloseHovered(true)}
                    onMouseLeave={() => setIsCloseHovered(false)}
                    aria-label={`Close ${tab.displayName}`}
                    tabIndex={-1}
                  >
                    {/* Show X when: hovered on close area, OR (active/group-hover AND not dirty) */}
                    {/* Show dot when: dirty AND not hovered on close area */}
                    {isDirty && !isCloseHovered ? (
                      <Circle className={cn(
                        "size-2.5 fill-current",
                        isActive ? "text-amber-400" : "text-muted-foreground"
                      )} />
                    ) : (
                      <X className={cn(
                        "size-3 hover:text-destructive",
                        isDirty 
                          ? "opacity-100" // Always show X when hovering over dirty indicator
                          : cn(
                              "opacity-0 group-hover:opacity-100",
                              isActive && "opacity-100"
                            )
                      )} />
                    )}
                  </button>
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
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {tab.hasFileHandle 
            ? "Local file • Saved to disk" 
            : "Double-click to rename"}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function TabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    openTab,
    renameTab,
    preferences,
    getTabDirtyState,
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
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!tabListRef.current) return;
    
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    if (currentIndex === -1) return;
    
    let targetIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        targetIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        targetIndex = Math.min(tabs.length - 1, currentIndex + 1);
        break;
      case 'Home':
        e.preventDefault();
        targetIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        targetIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    
    if (targetIndex !== currentIndex) {
      setActiveTab(tabs[targetIndex].id);
      // Focus the tab button
      const tabButton = tabListRef.current.querySelector(
        `button[role="tab"][aria-controls="tabpanel-${tabs[targetIndex].id}"]`
      ) as HTMLButtonElement;
      tabButton?.focus();
    }
  }, [tabs, activeTabId, setActiveTab]);
  
  // Handle tab close with dirty check
  const handleTabClose = useCallback(async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const isDirty = getTabDirtyState(tab);
    if (!isDirty) {
      // Not dirty, close immediately
      closeTab(tabId);
      return;
    }
    
    // Dirty - show confirmation dialog
    setPendingCloseTabId(tabId);
  }, [tabs, getTabDirtyState, closeTab]);

  // Handle close confirmation actions
  const handleSaveAndClose = useCallback(async () => {
    if (!pendingCloseTabId) return;
    const tab = tabs.find(t => t.id === pendingCloseTabId);
    if (!tab) {
      setPendingCloseTabId(null);
      return;
    }

    try {
      if (tab.hasFileHandle) {
        // Local file - save it
        const saved = await saveFile(pendingCloseTabId);
        if (saved) {
          toast.success('File saved');
          closeTab(pendingCloseTabId);
        } else {
          toast.error('Failed to save file');
        }
        setPendingCloseTabId(null);
      } else if (tab.source?.type === 'module') {
        // Module without file handle - save as local file
        const saved = await saveFileAs(pendingCloseTabId);
        if (saved) {
          toast.success('File saved locally');
          closeTab(pendingCloseTabId);
        } else {
          toast.error('Failed to save file');
        }
        setPendingCloseTabId(null);
      } else {
        // Other tab types - save as local file
        const saved = await saveFileAs(pendingCloseTabId);
        if (saved) {
          toast.success('File saved locally');
          closeTab(pendingCloseTabId);
        } else {
          toast.error('Failed to save file');
        }
        setPendingCloseTabId(null);
      }
    } catch (error) {
      toast.error('Failed to save', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setPendingCloseTabId(null);
    }
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

  // Close tab after successful commit
  useEffect(() => {
    if (!moduleCommitConfirmationOpen && tabToCloseAfterCommit) {
      const tab = tabs.find(t => t.id === tabToCloseAfterCommit);
      // If tab exists and is no longer dirty (commit was successful), close it
      if (tab && !getTabDirtyState(tab)) {
        closeTab(tabToCloseAfterCommit);
        setTabToCloseAfterCommit(null);
      } else if (!tab) {
        // Tab was already closed, just clear the state
        setTabToCloseAfterCommit(null);
      } else {
        // Commit failed or was cancelled, clear the state
        setTabToCloseAfterCommit(null);
      }
    }
  }, [moduleCommitConfirmationOpen, tabToCloseAfterCommit, tabs, getTabDirtyState, closeTab]);

  // Get pending tab info
  const pendingTab = pendingCloseTabId ? tabs.find(t => t.id === pendingCloseTabId) : null;
  const isModuleTab = pendingTab?.source?.type === 'module';
  const isLocalFile = pendingTab?.hasFileHandle;
  const canCommit = pendingCloseTabId && canCommitModule(pendingCloseTabId);

  // Create a new untitled tab
  const handleNewTab = () => {
    const extension = preferences.defaultLanguage === 'groovy' ? 'groovy' : 'ps1';
    const template = preferences.defaultLanguage === 'groovy' 
      ? `import com.santaba.agent.groovyapi.expect.Expect;
import com.santaba.agent.groovyapi.snmp.Snmp;
import com.santaba.agent.groovyapi.http.*;
import com.santaba.agent.groovyapi.jmx.*;

def hostname = hostProps.get("system.hostname");

// Your script here

return 0;
`
      : `# LogicMonitor PowerShell Script
# Use ##PROPERTY.NAME## tokens for device properties (e.g., ##SYSTEM.HOSTNAME##)

$hostname = "##SYSTEM.HOSTNAME##"

# Your script here

Exit 0
`;
    
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
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            isRenaming={renamingTabId === tab.id}
            isDirty={getTabDirtyState(tab)}
            canRename={!tab.hasFileHandle}
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
                <Plus className="size-3.5" />
                <span>New File</span>
              </Button>
            }
          />
          <TooltipContent>Create a new file tab</TooltipContent>
        </Tooltip>
      </div>
      
      {/* Active tab info badges */}
      {activeTabId && (
        <div className="flex items-center gap-1 px-2 border-l border-border">
          {(() => {
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (!activeTab) return null;
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
                <Circle className="size-8 text-amber-500 fill-current" />
              </AlertDialogMedia>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2">
                  <p>
                    The file <strong>{pendingTab.displayName}</strong> has unsaved changes.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    What would you like to do before closing?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={handleCancelClose}>
                Cancel
              </AlertDialogCancel>
              {isLocalFile && (
                <AlertDialogAction
                  onClick={handleSaveAndClose}
                  className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
                >
                  <Save className="size-4" />
                  Save & Close
                </AlertDialogAction>
              )}
              {isModuleTab && canCommit && (
                <AlertDialogAction
                  onClick={handlePreviewCommit}
                  className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
                >
                  <Upload className="size-4" />
                  Preview Commit
                </AlertDialogAction>
              )}
              {isModuleTab && !canCommit && (
                <AlertDialogAction
                  onClick={handleSaveAndClose}
                  className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
                >
                  <Save className="size-4" />
                  Save a Local Copy & Close
                </AlertDialogAction>
              )}
              {!isLocalFile && !isModuleTab && (
                <AlertDialogAction
                  onClick={handleSaveAndClose}
                  className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
                >
                  <Save className="size-4" />
                  Save Locally
                </AlertDialogAction>
              )}
              <AlertDialogAction
                onClick={handleDiscardAndClose}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
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

