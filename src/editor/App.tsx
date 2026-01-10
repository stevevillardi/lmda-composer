import { useEffect, useMemo, Suspense, lazy } from 'react';
import { FileWarning, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Toolbar } from './components/nav-items/Toolbar';
import { OutputPanel } from './components/composer/OutputPanel';
import { StatusBar } from './components/nav-items/StatusBar';
import { ExecutionContextDialog } from './components/composer/ExecutionContextDialog';
import { LogicModuleBrowser } from './components/import-from-lmx/LogicModuleBrowser';
import { CommandPalette } from './components/nav-items/CommandPalette';
import { SettingsDialog } from './components/nav-items/SettingsDialog';
import { RightSidebar } from './components/composer/RightSidebar';
import { TabBar } from './components/composer/TabBar';
import { EditorWelcomeScreen } from './components/composer/EditorWelcomeScreen';
import { BraveFileSystemWarning } from './components/nav-items/BraveFileSystemWarning';
import { DebugCommandsDialog } from './components/collector-debug/DebugCommandsDialog';
import { ModuleDetailsDialog } from './components/import-from-lmx/ModuleDetailsDialog';
import { ModuleSnippetsDialog } from './components/portal-actions/ModuleSnippetsDialog';
import { OpenModuleDirectoryDialog } from './components/composer/OpenModuleDirectoryDialog';
import { useEditorStore } from './stores/editor-store';
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
import type { LogicModuleInfo, LogicModuleType, ScriptType } from '@/shared/types';
import { getOriginalContent } from './utils/document-helpers';
import {
  useAppInitialization,
  useThemeSync,
  useUrlParamsHandler,
  useDraftManagement,
  usePortalEventListeners,
  useBrowserFileSystemWarning,
  useWindowTitle,
  useActiveTab,
} from './hooks';

// Lazy-loaded components
const EditorPanelLazy = lazy(() => import('./components/composer/EditorPanel').then((mod) => ({ default: mod.EditorPanel })));
const LogicModuleSearchLazy = lazy(() => import('./components/portal-actions/LogicModuleSearch').then((mod) => ({ default: mod.LogicModuleSearch })));
const ApiExplorerPanelLazy = lazy(() => import('./components/api-explorer/ApiExplorerPanel').then((mod) => ({ default: mod.ApiExplorerPanel })));
const ApiRightSidebarLazy = lazy(() => import('./components/api-explorer/ApiRightSidebar').then((mod) => ({ default: mod.ApiRightSidebar })));
const ApiWelcomeScreenLazy = lazy(() => import('./components/api-explorer/ApiWelcomeScreen').then((mod) => ({ default: mod.ApiWelcomeScreen })));
const AppliesToTesterLazy = lazy(() => import('./components/applies-to-tester/AppliesToTester').then((mod) => ({ default: mod.AppliesToTester })));
const PushToPortalDialogLazy = lazy(() => import('./components/import-from-lmx/PushToPortalDialog').then((mod) => ({ default: mod.PushToPortalDialog })));
const PullFromPortalDialogLazy = lazy(() => import('./components/import-from-lmx/PullFromPortalDialog').then((mod) => ({ default: mod.PullFromPortalDialog })));
const ModuleLineageDialogLazy = lazy(() => import('./components/import-from-lmx/ModuleLineageDialog').then((mod) => ({ default: mod.ModuleLineageDialog })));
const SaveOptionsDialogLazy = lazy(() => import('./components/nav-items/SaveOptionsDialog').then((mod) => ({ default: mod.SaveOptionsDialog })));

// Layout constants
const PANEL_SIZES = {
  MAIN_WITH_SIDEBAR: '78.5%',
  MAIN_FULL: '100%',
  SIDEBAR: '21.5%',
  SIDEBAR_MAX: '40%',
  EDITOR: '80%',
  OUTPUT: '40%',
  MIN: '20%',
  MIN_MAIN: '50%',
} as const;

const panelLoadingFallback = (
  <div className="flex h-full items-center justify-center">
    <div className="
      flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4
      py-3 text-sm text-muted-foreground shadow-sm
    ">
      <Loader2 className="size-4 animate-spin" />
      Loading workspace…
    </div>
  </div>
);

function normalizeModuleScriptType(raw?: string): ScriptType {
  const normalized = (raw || '').toLowerCase();
  if (normalized === 'powershell') return 'powerShell';
  if (normalized === 'file') return 'file';
  if (normalized === 'embed' || normalized === 'embedded') return 'embed';
  return 'embed';
}

function buildModuleScriptsFromResponse(
  module: Record<string, unknown>,
  moduleType: LogicModuleType
): { moduleInfo: LogicModuleInfo; scripts: Array<{ type: 'ad' | 'collection'; content: string }> } | null {
  const moduleId = module.id as number | undefined;
  const moduleName = module.name as string | undefined;
  if (!moduleId || !moduleName) return null;

  let collectionScript = '';
  let adScript = '';
  let scriptType: ScriptType = 'embed';
  let collectMethod = (module.collectMethod as string | undefined) || 'script';
  let appliesTo = (module.appliesTo as string | undefined) || '';
  let hasAutoDiscovery = false;

  if (moduleType === 'propertysource' || moduleType === 'diagnosticsource' || moduleType === 'eventsource') {
    collectionScript = (module.groovyScript as string | undefined) || '';
    scriptType = normalizeModuleScriptType(module.scriptType as string | undefined);
    collectMethod = 'script';
  } else if (moduleType === 'logsource') {
    appliesTo = (module.appliesToScript as string | undefined) || appliesTo;
    collectMethod = ((module.collectionMethod as string | undefined) || collectMethod).toLowerCase();
    const collectionAttribute = module.collectionAttribute as {
      script?: { embeddedContent?: string; type?: string };
      groovyScript?: string;
      scriptType?: string;
    } | undefined;
    collectionScript = collectionAttribute?.script?.embeddedContent
      || collectionAttribute?.groovyScript
      || '';
    scriptType = normalizeModuleScriptType(
      collectionAttribute?.script?.type
        || collectionAttribute?.scriptType
        || (module.scriptType as string | undefined)
    );
  } else {
    const collectorAttribute = module.collectorAttribute as { groovyScript?: string; scriptType?: string } | undefined;
    collectionScript = collectorAttribute?.groovyScript || '';
    scriptType = normalizeModuleScriptType(collectorAttribute?.scriptType || (module.scriptType as string | undefined));

    if (moduleType !== 'topologysource') {
      const adMethod = (module.autoDiscoveryConfig as { method?: { groovyScript?: string } } | undefined)?.method;
      if (adMethod) {
        adScript = adMethod.groovyScript || '';
        hasAutoDiscovery = !!adScript.trim();
      }
    }
  }

  const moduleInfo: LogicModuleInfo = {
    id: moduleId,
    name: moduleName,
    displayName: (module.displayName as string | undefined) || moduleName,
    moduleType,
    appliesTo,
    collectMethod,
    hasAutoDiscovery,
    scriptType,
    lineageId: module.lineageId as string | undefined,
  };

  const scripts: Array<{ type: 'ad' | 'collection'; content: string }> = [];
  if (collectionScript.trim()) {
    scripts.push({ type: 'collection', content: collectionScript });
  }
  if (adScript.trim()) {
    scripts.push({ type: 'ad', content: adScript });
  }

  return { moduleInfo, scripts };
}

export function App() {
  const { 
    refreshPortals, 
    tabs,
    activeTabId,
    portals,
    selectedPortalId,
    openModuleScripts,
    rightSidebarOpen,
    activeWorkspace,
    tabsNeedingPermission,
    restoreFileHandles,
    requestFilePermissions,
    moduleCommitConfirmationOpen,
    setModuleCommitConfirmationOpen,
    loadedModuleForCommit,
    commitModuleScript,
    isCommittingModule,
    moduleCommitConflict,
    switchToPortalWithContext,
    // Pull dialog
    pullLatestDialogOpen,
    // Save options dialog
    saveOptionsDialogOpen,
    saveOptionsDialogTabId,
    setSaveOptionsDialogOpen,
    saveFileAs,
    saveModuleDirectory,
  } = useEditorStore();
  
  // Get active tab for auto-save trigger and window title
  const activeTab = useActiveTab();
  
  // Compute workspace visibility state
  const workspaceState = useMemo(() => {
    const apiTabCount = tabs.filter(t => t.kind === 'api').length;
    const scriptTabCount = tabs.filter(t => (t.kind ?? 'script') === 'script').length;
    
    const showApiWelcome = activeWorkspace === 'api' && apiTabCount === 0;
    const showScriptWelcome = activeWorkspace === 'script' && scriptTabCount === 0 && tabs.length === 0;
    const showWelcome = showApiWelcome || showScriptWelcome;
    
    return { showWelcome, showApiWelcome, showScriptWelcome };
  }, [tabs, activeWorkspace]);
  
  // Custom hooks for app initialization and management
  useAppInitialization();
  useThemeSync();
  usePortalEventListeners();
  useWindowTitle(activeTab);
  
  const {
    pendingResourceId,
    pendingDataSourceId,
    pendingCollectMethod,
    pendingModuleId,
    pendingModuleType,
    setPendingResourceId,
    setPendingDataSourceId,
    setPendingCollectMethod,
    setPendingModuleId,
    setPendingModuleType,
  } = useUrlParamsHandler();
  
  const {
    pendingDraft,
    showDraftDialog,
    handleRestoreDraft,
    handleDiscardDraft,
  } = useDraftManagement();
  
  const {
    showBraveWarning,
    setShowBraveWarning,
    fileSystemWarningBrowser,
    handleBraveWarningDismiss,
  } = useBrowserFileSystemWarning();

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

  // Auto-open scripts for device datasource links (script/batchscript only)
  useEffect(() => {
    const openFromDeviceDatasource = async () => {
      if (!pendingDataSourceId || !pendingCollectMethod) return;
      if (pendingCollectMethod !== 'script' && pendingCollectMethod !== 'batchscript') {
        toast.warning('Datasource not script-based', {
          description: `Collect method is ${pendingCollectMethod}. Only script or batchscript datasources can be opened.`,
        });
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
  }, [pendingDataSourceId, pendingCollectMethod, openModuleScripts, selectedPortalId, setPendingDataSourceId, setPendingCollectMethod]);

  // Auto-open scripts for module links (LMX module tabs)
  useEffect(() => {
    const openFromModuleContext = async () => {
      if (!pendingModuleId || !pendingModuleType) return;
      if (!selectedPortalId) return;

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'FETCH_MODULE',
          payload: { portalId: selectedPortalId, moduleType: pendingModuleType, moduleId: pendingModuleId },
        });

        if (response?.type === 'MODULE_FETCHED' && response.payload) {
          const parsed = buildModuleScriptsFromResponse(response.payload, pendingModuleType);
          if (parsed && parsed.scripts.length > 0) {
            openModuleScripts(parsed.moduleInfo, parsed.scripts);
            const portal = portals.find(p => p.id === selectedPortalId);
            toast.success('Opened module scripts', {
              description: `${parsed.moduleInfo.displayName || parsed.moduleInfo.name} • Portal ${portal?.hostname ?? selectedPortalId}`,
            });
          }
        }
      } catch (error) {
        console.error('Failed to open module scripts from context:', error);
      } finally {
        setPendingModuleId(null);
        setPendingModuleType(null);
      }
    };

    openFromModuleContext();
  }, [pendingModuleId, pendingModuleType, openModuleScripts, portals, selectedPortalId, setPendingModuleId, setPendingModuleType]);

  // Apply resource context when a resourceId is present
  useEffect(() => {
    const applyResourceContext = async () => {
      if (!pendingResourceId || !selectedPortalId) return;

      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEVICE_BY_ID',
        payload: { portalId: selectedPortalId, resourceId: pendingResourceId },
      });

      if (response?.type === 'DEVICE_BY_ID_LOADED') {
        const device = response.payload;
        if (device.currentCollectorId) {
          await switchToPortalWithContext(selectedPortalId, {
            collectorId: device.currentCollectorId,
            hostname: device.name,
          });
          const portal = portals.find(p => p.id === selectedPortalId);
          toast.success('Context applied', {
            description: `Portal ${portal?.hostname ?? selectedPortalId} • Collector ${device.currentCollectorId} • Host ${device.name}`,
          });
        }
      }
      setPendingResourceId(null);
    };

    applyResourceContext();
  }, [pendingResourceId, portals, selectedPortalId, switchToPortalWithContext, setPendingResourceId]);

  return (
    <div className="
      flex h-screen flex-col overflow-hidden bg-background text-foreground
    ">
      {/* Toolbar */}
      <Toolbar />

      {/* File Permission Banner - shown when files need permission re-request */}
      {tabsNeedingPermission.length > 0 && (
        <div className="
          flex items-center gap-2 border-b border-yellow-500/20 bg-yellow-500/10
          px-3 py-1.5
        ">
          <FileWarning className="size-4 shrink-0 text-yellow-500" />
          <span className="flex-1 text-sm text-yellow-500">
            {tabsNeedingPermission.length} file{tabsNeedingPermission.length !== 1 ? 's' : ''} need permission to save directly
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={requestFilePermissions}
            className="
              border-yellow-500/30 text-yellow-500
              hover:bg-yellow-500/10
            "
          >
            Restore Access
          </Button>
        </div>
      )}

      {/* Main Content Area */}
      {workspaceState.showWelcome ? (
        <div className="min-h-0 flex-1">
          {workspaceState.showApiWelcome ? (
            <Suspense fallback={panelLoadingFallback}>
              <ApiWelcomeScreenLazy />
            </Suspense>
          ) : (
            <EditorWelcomeScreen />
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <TabBar />

          {/* Main workspace */}
          <ResizablePanelGroup
            key={rightSidebarOpen ? 'with-sidebar' : 'without-sidebar'}
            direction="horizontal"
            className="min-h-0 flex-1"
          >
            <ResizablePanel defaultSize={rightSidebarOpen ? PANEL_SIZES.MAIN_WITH_SIDEBAR : PANEL_SIZES.MAIN_FULL} minSize={PANEL_SIZES.MIN_MAIN}>
              {activeTab?.kind === 'api' ? (
                <Suspense fallback={panelLoadingFallback}>
                  <ApiExplorerPanelLazy />
                </Suspense>
              ) : (
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel defaultSize={PANEL_SIZES.EDITOR} minSize={PANEL_SIZES.MIN}>
                    <Suspense fallback={panelLoadingFallback}>
                      <EditorPanelLazy />
                    </Suspense>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel defaultSize={PANEL_SIZES.OUTPUT} minSize={PANEL_SIZES.MIN}>
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
                <ResizablePanel defaultSize={PANEL_SIZES.SIDEBAR} minSize={PANEL_SIZES.SIDEBAR} maxSize={PANEL_SIZES.SIDEBAR_MAX}>
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
      <ModuleSnippetsDialog />
      {activeTab && activeTab.source?.type === 'module' && loadedModuleForCommit && (
        <Suspense fallback={null}>
          <PushToPortalDialogLazy
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
            originalScript={getOriginalContent(activeTab, 'portal') || ''}
            newScript={activeTab.content}
            hasConflict={moduleCommitConflict?.hasConflict ?? false}
            conflictMessage={moduleCommitConflict?.message}
            isPushing={isCommittingModule}
          />
        </Suspense>
      )}
      {activeTab && activeTab.source?.type === 'module' && (
        <Suspense fallback={null}>
          <ModuleLineageDialogLazy activeTab={activeTab} />
        </Suspense>
      )}
      {/* Pull From Portal Dialog */}
      {activeTab && activeTab.source?.type === 'module' && pullLatestDialogOpen && (
        <Suspense fallback={null}>
          <PullFromPortalDialogLazy
            tabId={activeTab.id}
            moduleName={activeTab.source.moduleName || activeTab.displayName}
            moduleType={activeTab.source.moduleType || 'datasource'}
          />
        </Suspense>
      )}
      <ModuleDetailsDialog />
      <OpenModuleDirectoryDialog />
      {/* Save Options Dialog (for portal documents) */}
      <Suspense fallback={null}>
        <SaveOptionsDialogLazy
          open={saveOptionsDialogOpen}
          onOpenChange={(open) => setSaveOptionsDialogOpen(open)}
          tab={saveOptionsDialogTabId ? tabs.find(t => t.id === saveOptionsDialogTabId) ?? null : null}
          onSaveLocal={async () => {
            if (saveOptionsDialogTabId) {
              await saveFileAs(saveOptionsDialogTabId);
            }
          }}
          onSaveModuleDirectory={async () => {
            if (saveOptionsDialogTabId) {
              await saveModuleDirectory(saveOptionsDialogTabId);
            }
          }}
        />
      </Suspense>
      <BraveFileSystemWarning
        open={showBraveWarning}
        onOpenChange={setShowBraveWarning}
        onDismiss={handleBraveWarningDismiss}
        browser={fileSystemWarningBrowser ?? 'brave'}
      />

      {/* Draft Restore Dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10">
              <RotateCcw className="size-8 text-primary" />
            </AlertDialogMedia>
            <AlertDialogTitle>Restore Previous Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved work from a previous session
              {pendingDraft?.lastModified && (
                <span className="mt-1 block text-xs">
                  Last modified: {new Date(pendingDraft.lastModified).toLocaleString()}
                </span>
              )}
              {pendingDraft && 'tabs' in pendingDraft ? (
                <span className="mt-1 block text-xs">
                  {pendingDraft.tabs.length} open tab{pendingDraft.tabs.length !== 1 ? 's' : ''}
                </span>
              ) : pendingDraft ? (
                <span className="mt-1 block text-xs">
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
