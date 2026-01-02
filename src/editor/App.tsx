import { useEffect, useState, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { FileWarning, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Toolbar } from './components/Toolbar';
import { OutputPanel } from './components/OutputPanel';
import { StatusBar } from './components/StatusBar';
import { ExecutionContextDialog } from './components/ExecutionContextDialog';
import { LogicModuleBrowser } from './components/LogicModuleBrowser';
import { CommandPalette } from './components/CommandPalette';
import { SettingsDialog } from './components/SettingsDialog';
import { RightSidebar } from './components/RightSidebar';
import { TabBar } from './components/TabBar';
import { WelcomeScreenV2 } from './components/WelcomeScreenV2';
import { BraveFileSystemWarning } from './components/BraveFileSystemWarning';
import { DebugCommandsDialog } from './components/DebugCommandsDialog';
import { ModuleDetailsDialog } from './components/ModuleDetailsDialog';
import { useEditorStore } from './stores/editor-store';
import { isFileSystemAccessSupported } from './utils/file-handle-store';
import { isBraveBrowser, isVivaldiBrowser } from './utils/browser-detection';
import { Button } from '@/components/ui/button';
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
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DraftScript, DraftTabs, LogicModuleInfo, ScriptType } from '@/shared/types';

const EditorPanelLazy = lazy(() => import('./components/EditorPanel').then((mod) => ({ default: mod.EditorPanel })));
const LogicModuleSearchLazy = lazy(() => import('./components/LogicModuleSearch').then((mod) => ({ default: mod.LogicModuleSearch })));
const ApiExplorerPanelLazy = lazy(() => import('./components/api/ApiExplorerPanel').then((mod) => ({ default: mod.ApiExplorerPanel })));
const ApiRightSidebarLazy = lazy(() => import('./components/api/ApiRightSidebar').then((mod) => ({ default: mod.ApiRightSidebar })));
const AppliesToTesterLazy = lazy(() => import('./components/AppliesToTester').then((mod) => ({ default: mod.AppliesToTester })));
const ModuleCommitConfirmationDialogLazy = lazy(() => import('./components/ModuleCommitConfirmationDialog').then((mod) => ({ default: mod.ModuleCommitConfirmationDialog })));
const ModuleLineageDialogLazy = lazy(() => import('./components/ModuleLineageDialog').then((mod) => ({ default: mod.ModuleLineageDialog })));

const panelLoadingFallback = (
  <div className="flex items-center justify-center h-full">
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground shadow-sm">
      <Loader2 className="size-4 animate-spin" />
      Loading workspace…
    </div>
  </div>
);

export function App() {
  const { 
    refreshPortals, 
    tabs,
    activeTabId,
    loadDraft, 
    restoreDraft,
    restoreDraftTabs,
    clearDraft,
    saveDraft,
    loadPreferences,
    loadHistory,
    loadApiHistory,
    loadApiEnvironments,
    loadUserSnippets,
    preferences,
    portals,
    collectors,
    devices,
    isFetchingDevices,
    selectedPortalId,
    setSelectedPortal,
    setSelectedCollector,
    setHostname,
    openModuleScripts,
    rightSidebarOpen,
    tabsNeedingPermission,
    restoreFileHandles,
    requestFilePermissions,
    handlePortalDisconnected,
    moduleCommitConfirmationOpen,
    setModuleCommitConfirmationOpen,
    loadedModuleForCommit,
    commitModuleScript,
    isCommittingModule,
  } = useEditorStore();
  
  // Get active tab for auto-save trigger and window title
  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);
  
  // Track URL params application state
  const [urlParamsApplied, setUrlParamsApplied] = useState(false);
  const [pendingCollectorId, setPendingCollectorId] = useState<number | null>(null);
  const [pendingResourceId, setPendingResourceId] = useState<number | null>(null);
  const [pendingDataSourceId, setPendingDataSourceId] = useState<number | null>(null);
  const [pendingCollectMethod, setPendingCollectMethod] = useState<string | null>(null);
  const [pendingHostname, setPendingHostname] = useState<string | null>(null);

  // Draft restore dialog state
  const [pendingDraft, setPendingDraft] = useState<DraftScript | DraftTabs | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  
  // File System Access API warning state
  const [showBraveWarning, setShowBraveWarning] = useState(false);
  const [fileSystemWarningBrowser, setFileSystemWarningBrowser] = useState<'brave' | 'vivaldi' | null>(null);
  
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

  // Load preferences, history, and user snippets on mount
  useEffect(() => {
    loadPreferences();
    loadHistory();
    loadApiHistory();
    loadApiEnvironments();
    loadUserSnippets();
  }, [loadPreferences, loadHistory, loadApiHistory, loadApiEnvironments, loadUserSnippets]);

  // Check for File System Access API availability and Brave browser
  useEffect(() => {
    // Check if user has already dismissed this warning
    const dismissed = localStorage.getItem('lm-ide-fs-api-warning-dismissed')
      ?? localStorage.getItem('lm-ide-brave-fs-api-warning-dismissed');
    if (dismissed === 'true') {
      return;
    }

    const checkBrowser = async () => {
      if (await isVivaldiBrowser()) {
        setFileSystemWarningBrowser('vivaldi');
        setTimeout(() => {
          setShowBraveWarning(true);
        }, 500);
        return;
      }

      const fsApiSupported = isFileSystemAccessSupported();
      if (!fsApiSupported) {
        const isBrave = await isBraveBrowser();
        if (isBrave) {
          setFileSystemWarningBrowser('brave');
          setTimeout(() => {
            setShowBraveWarning(true);
          }, 500);
        }
      }
    };

    checkBrowser().catch((error) => {
      console.error('Error checking browser for File System Access warning:', error);
    });
  }, []);

  // Handle Brave warning dismissal
  const handleBraveWarningDismiss = useCallback(() => {
    localStorage.setItem('lm-ide-fs-api-warning-dismissed', 'true');
    localStorage.setItem('lm-ide-brave-fs-api-warning-dismissed', 'true');
    setShowBraveWarning(false);
  }, []);

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

  // Restore file handles after draft is restored or on mount
  useEffect(() => {
    // Wait until draft dialog is closed (user has made a choice)
    if (!showDraftDialog && tabs.length > 0) {
      restoreFileHandles();
    }
  }, [showDraftDialog, tabs.length, restoreFileHandles]);

  // Discover portals on mount
  useEffect(() => {
    refreshPortals();
  }, [refreshPortals]);

  // Listen for portal disconnection messages from the service worker
  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: { portalId: string; hostname: string } }) => {
      if (message.type === 'PORTAL_DISCONNECTED' && message.payload) {
        handlePortalDisconnected(message.payload.portalId, message.payload.hostname);
      }
      // Don't return true - we're not using sendResponse
      return false;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [handlePortalDisconnected]);

  // Apply URL parameters after portals are loaded
  useEffect(() => {
    // Only apply once, and only when we have portals
    if (urlParamsApplied || portals.length === 0) return;
    
    const params = new URLSearchParams(window.location.search);
    const portalParam = params.get('portal');
    const resourceIdParam = params.get('resourceId');
    const dataSourceIdParam = params.get('dataSourceId');
    const collectMethodParam = params.get('collectMethod');
    
    if (portalParam) {
      const matchingPortal = portals.find(p => p.id === portalParam || p.hostname === portalParam);
      if (matchingPortal) {
        setSelectedPortal(matchingPortal.id);
        
        if (resourceIdParam) {
          const resourceId = parseInt(resourceIdParam, 10);
          setPendingResourceId(resourceId);
        }
        if (dataSourceIdParam) {
          const dataSourceId = parseInt(dataSourceIdParam, 10);
          if (!Number.isNaN(dataSourceId)) {
            setPendingDataSourceId(dataSourceId);
          }
        }
        if (collectMethodParam) {
          setPendingCollectMethod(collectMethodParam);
        }
      }
    }
    
    // Mark as applied so we don't do this again
    setUrlParamsApplied(true);
    
    // Clear URL params to avoid confusion on refresh
    if (portalParam || resourceIdParam || dataSourceIdParam || collectMethodParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [portals, urlParamsApplied, setSelectedPortal]);

  // Auto-open scripts for device datasource links (script/batchscript only)
  useEffect(() => {
    const openFromDeviceDatasource = async () => {
      if (!pendingDataSourceId || !pendingCollectMethod) return;
      if (pendingCollectMethod !== 'script' && pendingCollectMethod !== 'batchscript') {
        setPendingDataSourceId(null);
        setPendingCollectMethod(null);
        return;
      }

      if (!selectedPortalId) return;

      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULE',
        payload: { portalId: selectedPortalId, moduleType: 'datasource', moduleId: pendingDataSourceId },
      });

      if (response?.type === 'MODULE_FETCHED' && response.payload) {
        const module = response.payload;
        const scriptType: ScriptType = module?.collectorAttribute?.scriptType ?? 'embed';
        const moduleInfo: LogicModuleInfo = {
          id: module.id,
          name: module.name,
          displayName: module.displayName,
          moduleType: 'datasource',
          appliesTo: module.appliesTo ?? '',
          collectMethod: module.collectMethod ?? pendingCollectMethod,
          hasAutoDiscovery: !!module.autoDiscoveryConfig,
          scriptType,
          lineageId: module.lineageId,
        };

        const scripts: Array<{ type: 'ad' | 'collection'; content: string }> = [];
        const collectionScript = module?.collectorAttribute?.groovyScript;
        const adScript = module?.autoDiscoveryConfig?.method?.groovyScript;

        if (collectionScript) {
          scripts.push({ type: 'collection', content: collectionScript });
        }
        if (adScript) {
          scripts.push({ type: 'ad', content: adScript });
        }

        if (scripts.length > 0) {
          openModuleScripts(moduleInfo, scripts);
          toast.success('Opened device datasource scripts', {
            description: module.displayName || module.name,
          });
        }
      }

      setPendingDataSourceId(null);
      setPendingCollectMethod(null);
    };

    openFromDeviceDatasource();
  }, [pendingDataSourceId, pendingCollectMethod, openModuleScripts, selectedPortalId]);

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

  // Update window title with character count and tab info
  useEffect(() => {
    const charCount = activeTab?.content.length ?? 0;
    const warning = charCount > 64000 ? ' ⚠️ LIMIT EXCEEDED' : '';
    const tabName = activeTab?.displayName ?? 'No file';
    document.title = `${tabName} - LMDA Composer (${charCount.toLocaleString()} chars)${warning}`;
  }, [activeTab]);

  // Auto-save draft with debounce (watches all tabs)
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
  }, [tabs, saveDraft]);

  // Save draft immediately when user leaves the page (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear any pending debounce timer
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save immediately - use sync approach since async may not complete
      saveDraft();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveDraft]);

  // Handle draft restore - supports both legacy single-file and multi-tab drafts
  const handleRestoreDraft = useCallback(() => {
    if (pendingDraft) {
      if ('tabs' in pendingDraft) {
        // Multi-tab draft
        restoreDraftTabs(pendingDraft);
      } else {
        // Legacy single-file draft
        restoreDraft(pendingDraft);
      }
      // Save immediately after restore to persist the restored state
      // This prevents data loss if user leaves before debounce timer
      setTimeout(() => saveDraft(), 100);
    }
    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [pendingDraft, restoreDraft, restoreDraftTabs, saveDraft]);

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

      {/* File Permission Banner - shown when files need permission re-request */}
      {tabsNeedingPermission.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
          <FileWarning className="size-4 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-500 flex-1">
            {tabsNeedingPermission.length} file{tabsNeedingPermission.length !== 1 ? 's' : ''} need permission to save directly
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={requestFilePermissions}
            className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
          >
            Restore Access
          </Button>
        </div>
      )}

      {/* Main Content Area */}
      {/* When no tabs are open, show WelcomeScreen full-height */}
      {tabs.length === 0 ? (
        <div className="flex-1 min-h-0">
          <WelcomeScreenV2 />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <TabBar />

          {/* Main workspace */}
          <ResizablePanelGroup
            key={rightSidebarOpen ? 'with-sidebar' : 'without-sidebar'}
            direction="horizontal"
            className="flex-1 min-h-0"
          >
            <ResizablePanel defaultSize={rightSidebarOpen ? "78.5%" : "100%"} minSize="50%">
              {activeTab?.kind === 'api' ? (
                <Suspense fallback={panelLoadingFallback}>
                  <ApiExplorerPanelLazy />
                </Suspense>
              ) : (
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel defaultSize="80%" minSize="20%">
                    <Suspense fallback={panelLoadingFallback}>
                      <EditorPanelLazy />
                    </Suspense>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel defaultSize="40%" minSize="20%">
                    <div className="h-full border-t border-border">
                      <OutputPanel />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </ResizablePanel>

            {rightSidebarOpen && (
              <>
                <ResizableHandle withVerticalHandle />
                <ResizablePanel defaultSize="21.5%" minSize="21.5%" maxSize="40%">
                  {activeTab?.kind === 'api' ? (
                    <Suspense fallback={panelLoadingFallback}>
                      <ApiRightSidebarLazy />
                    </Suspense>
                  ) : (
                    <RightSidebar />
                  )}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      )}

      {/* Status Bar */}
      <StatusBar />

      {/* Dialogs */}
      <ExecutionContextDialog />
      <LogicModuleBrowser />
      <Suspense fallback={null}>
        <LogicModuleSearchLazy />
      </Suspense>
      <CommandPalette />
      <SettingsDialog />
      <Suspense fallback={null}>
        <AppliesToTesterLazy />
      </Suspense>
      <DebugCommandsDialog />
      {activeTab && activeTab.source?.type === 'module' && loadedModuleForCommit && (
        <Suspense fallback={null}>
          <ModuleCommitConfirmationDialogLazy
            open={moduleCommitConfirmationOpen}
            onOpenChange={setModuleCommitConfirmationOpen}
            onConfirm={async (reason) => {
              if (activeTabId) {
                await commitModuleScript(activeTabId, reason);
              }
            }}
            moduleName={loadedModuleForCommit.name}
            moduleType={loadedModuleForCommit.moduleType}
            scriptType={activeTab.source.scriptType || 'collection'}
            scriptLanguage={loadedModuleForCommit.scriptType === 'powerShell' ? 'powershell' : 'groovy'}
            originalScript={activeTab.originalContent || ''}
            newScript={activeTab.content}
            hasConflict={false}
            isCommitting={isCommittingModule}
          />
        </Suspense>
      )}
      {activeTab && activeTab.source?.type === 'module' && (
        <Suspense fallback={null}>
          <ModuleLineageDialogLazy activeTab={activeTab} />
        </Suspense>
      )}
      <ModuleDetailsDialog />
      <BraveFileSystemWarning
        open={showBraveWarning}
        onOpenChange={setShowBraveWarning}
        onDismiss={handleBraveWarningDismiss}
        browser={fileSystemWarningBrowser ?? 'brave'}
      />

      {/* Draft Restore Dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10">
              <RotateCcw className="size-8 text-primary" />
            </AlertDialogMedia>
            <AlertDialogTitle>Restore Previous Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved work from a previous session
              {pendingDraft?.lastModified && (
                <span className="block mt-1 text-xs">
                  Last modified: {new Date(pendingDraft.lastModified).toLocaleString()}
                </span>
              )}
              {pendingDraft && 'tabs' in pendingDraft ? (
                <span className="block mt-1 text-xs">
                  {pendingDraft.tabs.length} open tab{pendingDraft.tabs.length !== 1 ? 's' : ''}
                </span>
              ) : pendingDraft ? (
                <span className="block mt-1 text-xs">
                  Language: {pendingDraft.language === 'groovy' ? 'Groovy' : 'PowerShell'}
                  {pendingDraft.hostname && ` • Host: ${pendingDraft.hostname}`}
                </span>
              ) : null}
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
