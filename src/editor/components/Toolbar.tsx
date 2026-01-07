import { useMemo, useState } from 'react';
import {
  WarningIcon,
  RunIcon,
  SendIcon,
  LoadingIcon,
  StopIcon,
  SidebarCloseIcon,
  SidebarOpenIcon,
  CommitIcon,
  HistoryIcon,
  SettingsIcon,
  ImportIcon,
} from '../constants/icons';
import { MODE_ITEMS } from '../constants/mode-config';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { DEFAULT_GROOVY_TEMPLATE, DEFAULT_POWERSHELL_TEMPLATE } from '../config/script-templates';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
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
import { SIZES } from '../constants/sizes';
import type { ScriptLanguage, ScriptMode } from '@/shared/types';
import { ContextDropdown } from './ContextDropdown';
import { ActionsDropdown } from './ActionsDropdown';
import { getPortalBindingStatus } from '../utils/portal-binding';
import { normalizeMode } from '../utils/mode-utils';
import { normalizeScript } from '../stores/helpers/slice-helpers';
import { hasAssociatedFileHandle } from '../utils/document-helpers';


export function Toolbar() {
  const {
    selectedPortalId,
    selectedCollectorId,
    portals,
    tabs,
    activeTabId,
    collectors,
    setLanguage,
    setMode,
    isExecuting,
    executeScript,
    executeApiRequest,
    isExecutingApi,
    updateApiTabRequest,
    // Right sidebar
    rightSidebarOpen,
    setRightSidebarOpen,
    // Cancel execution
    cancelDialogOpen,
    setCancelDialogOpen,
    cancelExecution,
    // Module commit
    canCommitModule,
    fetchModuleForCommit,
    setModuleCommitConfirmationOpen,
    fetchLineageVersions,
    setModuleLineageDialogOpen,
    isFetchingLineage,
    setModuleDetailsDialogOpen,
    // Pull latest
    canPullLatest,
    setPullLatestDialogOpen,
    isPullingLatest,
  } = useEditorStore();

  // Get active tab data
  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);
  

  const portalBinding = useMemo(() => {
    if (!activeTab || activeTab.source?.type !== 'module') return null;
    return getPortalBindingStatus(activeTab, selectedPortalId, portals);
  }, [activeTab, selectedPortalId, portals]);
  const isPortalBoundActive = portalBinding?.isActive ?? true;
  const isApiTab = activeTab?.kind === 'api';

  const language = activeTab?.language ?? 'groovy';
  const rawMode = activeTab?.mode ?? 'freeform';
  const mode = normalizeMode(rawMode);
  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);
  const isWindowsCollector = selectedCollector?.arch?.toLowerCase().includes('win') ?? true;
  const powerShellBlocked = language === 'powershell' && !isWindowsCollector;
  
  // Check if content has been modified from default templates (only for scratch files)
  // For saved local files, we don't need to warn since the file is already persisted
  const shouldWarnOnLanguageSwitch = useMemo(() => {
    if (!activeTab) return false;
    
    // If the tab has a file handle (saved local file), don't warn - the file is already saved
    // Switching language will just disconnect the handle and the original file remains
    if (hasAssociatedFileHandle(activeTab)) return false;
    
    // For scratch files, check if content differs from default templates
    const content = normalizeScript(activeTab.content);
    const defaultGroovy = normalizeScript(DEFAULT_GROOVY_TEMPLATE);
    const defaultPs = normalizeScript(DEFAULT_POWERSHELL_TEMPLATE);
    return content !== defaultGroovy && content !== defaultPs;
  }, [activeTab]);

  // State for language switch confirmation dialog
  const [pendingLanguage, setPendingLanguage] = useState<ScriptLanguage | null>(null);

  // Handle language toggle click
  const handleLanguageClick = (newLanguage: ScriptLanguage) => {
    if (newLanguage === language) return;
    
    if (shouldWarnOnLanguageSwitch) {
      // Show confirmation dialog if content has been modified from default template
      setPendingLanguage(newLanguage);
    } else {
      // Default content or saved file, switch directly
      setLanguage(newLanguage);
    }
  };

  // Confirm language switch
  const confirmLanguageSwitch = () => {
    if (pendingLanguage) {
      setLanguage(pendingLanguage, true); // Force reset to template
      setPendingLanguage(null);
    }
  };

  // Cancel language switch
  const cancelLanguageSwitch = () => {
    setPendingLanguage(null);
  };

  // Check if we can execute
  const canExecute = selectedPortalId && selectedCollectorId && !isExecuting;

  const handleRunClick = () => {
    if (powerShellBlocked) {
      toast.info('PowerShell runs only on Windows collectors', {
        description: 'Select a Windows collector to run this script.',
      });
      return;
    }
    executeScript();
  };
  
  // Check if active tab is a module tab
  const isModuleTab = activeTab?.source?.type === 'module';
  const hasLineage = !!activeTab?.source?.lineageId;
  
  // Check if we can commit module changes (has changes and portal selected)
  const canCommit = activeTabId && canCommitModule(activeTabId);

  if (isApiTab) {
    const canSendApi = Boolean(
      selectedPortalId &&
      activeTab?.api?.request.path.trim() &&
      !isExecutingApi
    );
    const pagination = activeTab?.api?.request.pagination;
    const updatePagination = (updates: Partial<typeof pagination>) => {
      if (!activeTab || activeTab.kind !== 'api') return;
          updateApiTabRequest(activeTab.id, {
        pagination: {
          enabled: pagination?.enabled ?? false,
          sizeParam: pagination?.sizeParam ?? 'size',
          offsetParam: pagination?.offsetParam ?? 'offset',
          pageSize: pagination?.pageSize ?? 25,
          ...updates,
        },
      });
    };

    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-b border-border">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block select-none">
            Context:
          </Label>
          <ContextDropdown showCollector={false} showDevice={false} />
        </div>

        <Separator orientation="vertical" className="h-8 mx-1" />

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block select-none">
            Pagination:
          </Label>
          <div className="flex items-center rounded-md border border-input bg-background/50 gap-1">
            <div className="flex items-center gap-2 px-2">
              <span className="text-xs text-muted-foreground select-none">Auto</span>
              <Switch
                checked={pagination?.enabled ?? false}
                onCheckedChange={(checked) => updatePagination({ enabled: checked })}
              />
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2 px-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="text-xs text-muted-foreground whitespace-nowrap select-none">
                      Batch Size
                    </span>
                  }
                />
                <TooltipContent>Controls `size` when auto pagination is on.</TooltipContent>
              </Tooltip>
              <Slider
                value={[pagination?.pageSize ?? 25]}
                onValueChange={(value) =>
                  updatePagination({ pageSize: Array.isArray(value) ? value[0] : value })
                }
                min={25}
                max={1000}
                step={25}
                className="w-[120px]"
              />
              <span className="text-xs text-muted-foreground w-6 text-right select-none">
                {pagination?.pageSize ?? 25}
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ActionsDropdown />
          <Button
            onClick={() => executeApiRequest(activeTabId ?? undefined)}
            disabled={!canSendApi}
            size="toolbar"
            variant="execute"
            className="px-4 font-medium"
            aria-label={isExecutingApi ? 'Sending request' : 'Send request'}
          >
            {isExecutingApi ? (
              <LoadingIcon className={SIZES.ICON_MEDIUM} />
            ) : (
              <SendIcon className={SIZES.ICON_MEDIUM} />
            )}
            {isExecutingApi ? 'Sending...' : 'Send Request'}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={rightSidebarOpen ? 'secondary' : 'ghost'}
                  size="toolbar-icon"
                  onClick={() => {
                    setRightSidebarOpen(!rightSidebarOpen);
                  }}
                  disabled={tabs.length === 0}
                  aria-label={rightSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                  aria-pressed={rightSidebarOpen}
                >
                  {rightSidebarOpen ? (
                    <SidebarCloseIcon className={SIZES.ICON_MEDIUM} />
                  ) : (
                    <SidebarOpenIcon className={SIZES.ICON_MEDIUM} />
                  )}
                </Button>
              }
            />
            <TooltipContent>
              {tabs.length === 0 
                ? 'Open a request to access sidebar' 
                : rightSidebarOpen 
                  ? 'Close sidebar' 
                  : 'Open sidebar (Variables & Helpers)'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-b border-border">
      {/* Context Dropdown (Portal/Collector/Device) */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block">
          Context:
        </Label>
        <ContextDropdown />
      </div>

      <Separator orientation="vertical" className="h-8 mx-1" />

      {/* Script Config Group */}
      <div className="flex items-center gap-2">
        {/* Language Toggle */}
        <Label className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block">
          Language:
        </Label>
        <div 
          className="flex items-center rounded-md border border-input bg-background/50 p-0.5 gap-0.5"
          role="group"
          aria-label="Script language selector"
        >
          <Button
            variant={language === 'groovy' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleLanguageClick('groovy')}
            disabled={tabs.length === 0}
            className={cn(
              SIZES.BUTTON_SIDEBAR,
              "px-3 text-xs font-medium",
              language === 'groovy' && "shadow-sm"
            )}
            aria-pressed={language === 'groovy'}
            aria-label="Groovy language"
          >
            Groovy
          </Button>
          <Button
            variant={language === 'powershell' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleLanguageClick('powershell')}
            disabled={tabs.length === 0}
            className={cn(
              SIZES.BUTTON_SIDEBAR,
              "px-3 text-xs font-medium",
              language === 'powershell' && "shadow-sm"
            )}
            aria-pressed={language === 'powershell'}
            aria-label="PowerShell language"
          >
            PowerShell
          </Button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block">
            Mode:
          </Label>
          <Select 
            value={mode} 
            onValueChange={(value) => setMode(value as ScriptMode)}
            items={MODE_ITEMS}
            disabled={tabs.length === 0}
          >
            <SelectTrigger size="sm" className="w-[180px] text-xs" disabled={tabs.length === 0} aria-label="Script execution mode">
              <div className="flex items-center gap-2">
                {(() => {
                  const selectedMode = MODE_ITEMS.find(m => m.value === mode);
                  const Icon = selectedMode?.icon;
                  return Icon ? <Icon className="size-4 shrink-0" /> : null;
                })()}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent align="start">
              {MODE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SelectItem key={item.value} value={item.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1" />

      {/* Action Group */}
      <div className="flex items-center gap-1.5">
        {/* Lineage Button - shown for module tabs with lineageId */}
        {isModuleTab && hasLineage && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="toolbar-outline"
                  size="toolbar"
                  onClick={async () => {
                    if (!activeTabId) return;
                    try {
                      const count = await fetchLineageVersions(activeTabId);
                      if (count > 0) {
                        setModuleLineageDialogOpen(true);
                      } else {
                        toast.info('No lineage history found', {
                          description: 'This module does not have historical versions available.',
                        });
                      }
                    } catch (error) {
                      toast.error('Failed to load lineage', {
                        description: error instanceof Error ? error.message : 'Unknown error',
                      });
                    }
                  }}
                  disabled={isFetchingLineage || !isPortalBoundActive}
                  aria-label="View module lineage"
                >
                  {isFetchingLineage ? (
                    <LoadingIcon className={SIZES.ICON_MEDIUM} />
                  ) : (
                    <HistoryIcon className={SIZES.ICON_MEDIUM} />
                  )}
                  {isFetchingLineage ? 'Loading...' : 'View Lineage'}
                </Button>
              }
            />
            <TooltipContent>
              {!isPortalBoundActive
                ? 'Portal mismatch: switch to the bound portal to view lineage'
                : isFetchingLineage
                  ? 'Loading lineage...'
                  : 'View historical versions'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Module Details Button - shown for module tabs */}
        {isModuleTab && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="toolbar-outline"
                  size="toolbar"
                  onClick={() => {
                    setModuleDetailsDialogOpen(true);
                  }}
                  disabled={!isPortalBoundActive}
                  aria-label="Open module details"
                >
                  <SettingsIcon className={SIZES.ICON_MEDIUM} />
                  Module Details
                </Button>
              }
            />
            <TooltipContent>
              {!isPortalBoundActive
                ? 'Portal mismatch: switch to the bound portal to edit details'
                : 'Edit module metadata (name, description, appliesTo, etc.)'}
            </TooltipContent>
          </Tooltip>
        )}


        {/* Pull Latest Button - shown for module tabs that can pull */}
        {isModuleTab && activeTabId && canPullLatest(activeTabId) && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="toolbar-outline"
                  size="toolbar"
                  onClick={() => {
                    if (!activeTabId) return;
                    setPullLatestDialogOpen(true);
                  }}
                  disabled={isPullingLatest}
                  aria-label="Pull latest from portal"
                >
                  {isPullingLatest ? (
                    <LoadingIcon className={SIZES.ICON_MEDIUM} />
                  ) : (
                    <ImportIcon className={SIZES.ICON_MEDIUM} />
                  )}
                  {isPullingLatest ? 'Pulling...' : 'Pull'}
                </Button>
              }
            />
            <TooltipContent>
              Pull latest version from LogicMonitor portal
            </TooltipContent>
          </Tooltip>
        )}

        {/* Push to Portal Button - shown for module tabs, disabled unless there are changes */}
        {isModuleTab && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="commit"
                  size="toolbar"
                  onClick={async () => {
                    if (!activeTabId) return;
                    try {
                      await fetchModuleForCommit(activeTabId);
                      setModuleCommitConfirmationOpen(true);
                    } catch (error) {
                      toast.error('Failed to prepare push', {
                        description: error instanceof Error ? error.message : 'Unknown error',
                      });
                    }
                  }}
                  disabled={!canCommit}
                  className="px-3 font-medium"
                  aria-label="Push changes to LogicMonitor portal"
                >
                  <CommitIcon className={SIZES.ICON_MEDIUM} />
                  Push to Portal
                </Button>
              }
            />
            <TooltipContent>
              {!isPortalBoundActive
                ? 'Portal mismatch: switch to the bound portal to push'
                : canCommit
                  ? 'Push changes to LogicMonitor portal'
                  : 'No changes to push'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Separator between module actions and general actions */}
        {isModuleTab && <Separator orientation="vertical" className="h-8 mx-1" aria-hidden="true" />}
        
        {/* Actions Dropdown */}
        <ActionsDropdown />

        {/* Run Button */}
        <Button
          onClick={handleRunClick}
          disabled={!canExecute}
          size="toolbar"
          variant="execute"
          className="px-4 font-medium"
          aria-label={isExecuting ? 'Running script' : 'Run script'}
        >
          {isExecuting ? (
            <LoadingIcon className={SIZES.ICON_MEDIUM} />
          ) : (
            <RunIcon className={SIZES.ICON_MEDIUM} />
          )}
          {isExecuting ? 'Running...' : 'Run Script'}
        </Button>

        {/* Cancel button - only visible when executing */}
        {isExecuting && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="destructive"
                  size="toolbar"
                  onClick={() => setCancelDialogOpen(true)}
                  aria-label="Cancel script execution"
                >
                  <StopIcon className={SIZES.ICON_MEDIUM} />
                  Cancel
                </Button>
              }
            />
            <TooltipContent>Cancel script execution</TooltipContent>
          </Tooltip>
        )}

        <Separator orientation="vertical" className="h-8 mx-1" aria-hidden="true" />

        {/* Right Sidebar Toggle */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={rightSidebarOpen ? 'secondary' : 'ghost'}
                size="toolbar-icon"
                onClick={() => {
                  setRightSidebarOpen(!rightSidebarOpen);
                }}
                disabled={tabs.length === 0}
                aria-label={rightSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                aria-pressed={rightSidebarOpen}
              >
                {rightSidebarOpen ? (
                  <SidebarCloseIcon className={SIZES.ICON_MEDIUM} />
                ) : (
                  <SidebarOpenIcon className={SIZES.ICON_MEDIUM} />
                )}
              </Button>
            }
          />
          <TooltipContent>
            {tabs.length === 0 
              ? 'Open a file to access sidebar' 
              : rightSidebarOpen 
                ? 'Close sidebar' 
                : 'Open sidebar (Properties & Snippets)'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Language Switch Confirmation Dialog */}
      <AlertDialog open={pendingLanguage !== null} onOpenChange={(open) => !open && cancelLanguageSwitch()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-500/10">
              <WarningIcon className="size-8" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Switch to {pendingLanguage === 'groovy' ? 'Groovy' : 'PowerShell'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in your script. Switching languages will reset 
              the editor to the default {pendingLanguage === 'groovy' ? 'Groovy' : 'PowerShell'} template 
              and your current changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLanguageSwitch}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmLanguageSwitch}
              variant="warning"
            >
              Switch & Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Execution Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <StopIcon className="size-8 text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Cancel Script Execution?</AlertDialogTitle>
            <AlertDialogDescription>
              The script is currently running. Cancelling will stop the execution 
              immediately. Any partial results will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Continue Running
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={cancelExecution}
              variant="destructive"
            >
              Cancel Execution
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
