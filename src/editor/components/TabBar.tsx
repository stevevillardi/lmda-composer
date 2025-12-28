import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Plus, Pencil, Circle } from 'lucide-react';
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
    ad: 'AD',
    collection: 'Collect',
    batchcollection: 'Batch',
    freeform: 'Free',
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
                  className={cn(
                    "group flex items-center gap-1.5 px-3 py-1.5 text-sm border-r border-border",
                    "min-w-[120px] max-w-[250px] shrink-0",
                    "transition-colors duration-100",
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
                  <div 
                    className="flex items-center justify-center size-4 rounded hover:bg-destructive/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    onMouseEnter={() => setIsCloseHovered(true)}
                    onMouseLeave={() => setIsCloseHovered(false)}
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
                  </div>
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
          <ContextMenuItem onClick={() => {
            navigator.clipboard.writeText(tab.displayName);
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
  } = useEditorStore();
  
  // Track which tab is being renamed
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  
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
    <div className="flex items-center bg-secondary/20 border-b border-border overflow-hidden">
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
            onClose={() => closeTab(tab.id)}
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
    </div>
  );
}

