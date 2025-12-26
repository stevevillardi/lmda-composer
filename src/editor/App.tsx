import { useEffect, useState, useRef, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { EditorPanel } from './components/EditorPanel';
import { OutputPanel } from './components/OutputPanel';
import { StatusBar } from './components/StatusBar';
import { ExecutionContextDialog } from './components/ExecutionContextDialog';
import { LogicModuleBrowser } from './components/LogicModuleBrowser';
import { CommandPalette } from './components/CommandPalette';
import { ExecutionHistory } from './components/ExecutionHistory';
import { SettingsDialog } from './components/SettingsDialog';
import { useEditorStore } from './stores/editor-store';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DraftScript } from '@/shared/types';

export function App() {
  const { 
    refreshPortals, 
    script, 
    loadDraft, 
    restoreDraft, 
    clearDraft,
    saveDraft,
    loadPreferences,
    loadHistory,
    preferences,
  } = useEditorStore();

  // Draft restore dialog state
  const [pendingDraft, setPendingDraft] = useState<DraftScript | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  
  // Debounce timer for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set dark mode on mount based on preferences
  useEffect(() => {
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (preferences.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [preferences.theme]);

  // Load preferences and history on mount
  useEffect(() => {
    loadPreferences();
    loadHistory();
  }, [loadPreferences, loadHistory]);

  // Check for saved draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      const draft = await loadDraft();
      if (draft) {
        setPendingDraft(draft);
        setShowDraftDialog(true);
      }
    };
    checkDraft();
  }, [loadDraft]);

  // Discover portals on mount
  useEffect(() => {
    refreshPortals();
  }, [refreshPortals]);

  // Update window title with character count
  useEffect(() => {
    const charCount = script.length;
    const warning = charCount > 64000 ? ' ⚠️ LIMIT EXCEEDED' : '';
    document.title = `LM IDE (${charCount.toLocaleString()} chars)${warning}`;
  }, [script]);

  // Auto-save draft with debounce
  useEffect(() => {
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, 2000); // Save after 2 seconds of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [script, saveDraft]);

  // Handle draft restore
  const handleRestoreDraft = useCallback(() => {
    if (pendingDraft) {
      restoreDraft(pendingDraft);
    }
    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [pendingDraft, restoreDraft]);

  // Handle discard draft
  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [clearDraft]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Toolbar */}
      <Toolbar />

      {/* Main Content Area - Resizable Panels */}
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        {/* Editor Panel */}
        <ResizablePanel defaultSize={70} minSize={30}>
          <EditorPanel />
        </ResizablePanel>

        {/* Resize Handle */}
        <ResizableHandle withHandle />

        {/* Output Panel */}
        <ResizablePanel defaultSize={30} minSize={10}>
          <div className="h-full border-t border-border">
            <OutputPanel />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Status Bar */}
      <StatusBar />

      {/* Dialogs */}
      <ExecutionContextDialog />
      <LogicModuleBrowser />
      <CommandPalette />
      <ExecutionHistory />
      <SettingsDialog />

      {/* Draft Restore Dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Previous Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved script from a previous session
              {pendingDraft?.lastModified && (
                <span className="block mt-1 text-xs">
                  Last modified: {new Date(pendingDraft.lastModified).toLocaleString()}
                </span>
              )}
              {pendingDraft && (
                <span className="block mt-1 text-xs">
                  Language: {pendingDraft.language === 'groovy' ? 'Groovy' : 'PowerShell'}
                  {pendingDraft.hostname && ` • Host: ${pendingDraft.hostname}`}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardDraft}>
              Discard
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDraft}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
