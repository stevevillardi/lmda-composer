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
    portals,
    collectors,
    devices,
    isFetchingDevices,
    setSelectedPortal,
    setSelectedCollector,
    setHostname,
  } = useEditorStore();
  
  // Track URL params application state
  const [urlParamsApplied, setUrlParamsApplied] = useState(false);
  const [pendingCollectorId, setPendingCollectorId] = useState<number | null>(null);
  const [pendingResourceId, setPendingResourceId] = useState<number | null>(null);
  const [pendingHostname, setPendingHostname] = useState<string | null>(null);

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

  // Apply URL parameters after portals are loaded
  useEffect(() => {
    // Only apply once, and only when we have portals
    if (urlParamsApplied || portals.length === 0) return;
    
    const params = new URLSearchParams(window.location.search);
    const portalParam = params.get('portal');
    const resourceIdParam = params.get('resourceId');
    
    if (portalParam) {
      const matchingPortal = portals.find(p => p.id === portalParam || p.hostname === portalParam);
      if (matchingPortal) {
        setSelectedPortal(matchingPortal.id);
        
        if (resourceIdParam) {
          const resourceId = parseInt(resourceIdParam, 10);
          setPendingResourceId(resourceId);
        }
      }
    }
    
    // Mark as applied so we don't do this again
    setUrlParamsApplied(true);
    
    // Clear URL params to avoid confusion on refresh
    if (portalParam || resourceIdParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [portals, urlParamsApplied, setSelectedPortal]);

  // Fetch device details when we have a pending resourceId and collectors are loaded
  useEffect(() => {
    const fetchDevice = async () => {
      if (pendingResourceId && collectors.length > 0) {
        const { selectedPortalId } = useEditorStore.getState();
        if (selectedPortalId) {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_DEVICE_BY_ID',
            payload: { portalId: selectedPortalId, resourceId: pendingResourceId },
          });
          
          if (response?.type === 'DEVICE_BY_ID_LOADED') {
            const device = response.payload;
            setPendingHostname(device.name);
            
            const matchingCollector = collectors.find(c => c.id === device.currentCollectorId);
            if (matchingCollector) {
              setSelectedCollector(device.currentCollectorId);
            }
          }
        }
        setPendingResourceId(null);
      }
    };
    
    fetchDevice();
  }, [collectors, pendingResourceId, setSelectedCollector]);

  // Set pending hostname after devices are loaded
  useEffect(() => {
    if (pendingHostname && !isFetchingDevices && devices.length > 0) {
      setHostname(pendingHostname);
      setPendingHostname(null);
    }
  }, [pendingHostname, isFetchingDevices, devices, setHostname]);

  // Apply pending collector ID after collectors are loaded
  useEffect(() => {
    if (pendingCollectorId && collectors.length > 0) {
      const matchingCollector = collectors.find(c => c.id === pendingCollectorId);
      if (matchingCollector) {
        setSelectedCollector(pendingCollectorId);
      }
      setPendingCollectorId(null);
    }
  }, [collectors, pendingCollectorId, setSelectedCollector]);

  // Update window title with character count
  useEffect(() => {
    const charCount = script.length;
    const warning = charCount > 64000 ? ' ⚠️ LIMIT EXCEEDED' : '';
    document.title = `LogicMonitor IDE (${charCount.toLocaleString()} chars)${warning}`;
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
