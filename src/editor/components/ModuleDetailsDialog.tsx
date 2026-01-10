import { useEffect, useMemo, useState } from 'react';
import { Settings, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ModuleDetailsSidebar } from './ModuleDetailsSidebar';
import { useEditorStore } from '../stores/editor-store';
import { MODULE_TYPE_SCHEMAS, type ModuleDetailsSection } from '@/shared/module-type-schemas';
import type { LogicModuleType } from '@/shared/types';
import { ModuleDetailsBasicInfo } from './module-details-sections/BasicInfo';
import { ModuleDetailsOrganization } from './module-details-sections/Organization';
import { ModuleDetailsAccess } from './module-details-sections/Access';
import { ModuleDetailsAppliesTo } from './module-details-sections/AppliesTo';
import { ModuleDetailsActiveDiscovery } from './module-details-sections/ActiveDiscovery';
import { ModuleDetailsDatapoints } from './module-details-sections/Datapoints';
import { ModuleDetailsConfigChecks } from './module-details-sections/ConfigChecks';
import { ModuleDetailsAlertSettings } from './module-details-sections/AlertSettings';
import { PortalBindingOverlay } from './PortalBindingOverlay';

export function ModuleDetailsDialog() {
  const {
    moduleDetailsDialogOpen,
    setModuleDetailsDialogOpen,
    tabs,
    activeTabId,
    moduleDetailsLoading,
    moduleDetailsError,
    moduleDetailsDraftByTabId,
    moduleDetailsConflict,
    isRefreshingModuleDetails,
    loadModuleDetails,
    fetchAccessGroups,
    resetModuleDetailsDraft,
    persistModuleDetailsToDirectory,
    refreshModuleDetailsBaseline,
    resolveModuleDetailsConflict,
  } = useEditorStore();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const isModuleTab = activeTab?.source?.type === 'module';
  const draft = activeTabId ? moduleDetailsDraftByTabId[activeTabId] : null;
  const hasChanges = draft ? draft.dirtyFields.size > 0 : false;
  
  // Determine available sections and default to first one
  const schema = activeTab?.source?.moduleType ? MODULE_TYPE_SCHEMAS[activeTab.source.moduleType as LogicModuleType] : null;
  const enableAutoDiscovery = draft?.draft?.enableAutoDiscovery || false;
  
  // Map fields to sections to track which sections have changes
  const dirtySections = useMemo(() => {
    if (!draft || draft.dirtyFields.size === 0) return new Set<string>();
    
    const sections = new Set<string>();
    const dirtyFields = draft.dirtyFields;
    
    // Basic Info fields
    if (dirtyFields.has('name') || dirtyFields.has('displayName') || 
        dirtyFields.has('description') || dirtyFields.has('collectInterval')) {
      sections.add('basic');
    }
    
    // Organization fields
    if (dirtyFields.has('group') || dirtyFields.has('technology') || dirtyFields.has('tags')) {
      sections.add('organization');
    }
    
    // Access fields
    if (dirtyFields.has('accessGroupIds')) {
      sections.add('access');
    }
    
    // AppliesTo fields
    if (dirtyFields.has('appliesTo')) {
      sections.add('appliesTo');
    }
    
  // Active Discovery fields
  if (dirtyFields.has('autoDiscoveryConfig') || dirtyFields.has('enableAutoDiscovery')) {
    sections.add('activeDiscovery');
  }

  // Alert Settings fields
    if (
      dirtyFields.has('alertSubjectTemplate') ||
      dirtyFields.has('alertBodyTemplate') ||
      dirtyFields.has('alertLevel') ||
      dirtyFields.has('clearAfterAck') ||
      dirtyFields.has('alertEffectiveIval')
    ) {
      sections.add('alertSettings');
    }
    
    // Datapoints fields
    if (dirtyFields.has('dataPoints')) {
      sections.add('datapoints');
    }
    
    // ConfigChecks fields
    if (dirtyFields.has('configChecks')) {
      sections.add('configChecks');
    }
    
    return sections;
  }, [draft]);
  
  const availableSections = useMemo<ModuleDetailsSection[]>(() => {
    if (!schema) return [];
    return schema.sections.filter((section) => {
      if (section === 'activeDiscovery') {
        return enableAutoDiscovery && schema.supportsAutoDiscovery;
      }
      if (section === 'datapoints') {
        return schema.editableList === 'datapoints';
      }
      if (section === 'configChecks') {
        return schema.editableList === 'configChecks';
      }
      if (section === 'alertSettings') {
        return schema.supportsAlertSettings;
      }
      return true;
    });
  }, [enableAutoDiscovery, schema]);
  
  const [activeSection, setActiveSection] = useState<ModuleDetailsSection>(availableSections[0] || 'basic');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  
  // Reset to first available section when dialog opens or sections change
  useEffect(() => {
    if (moduleDetailsDialogOpen && availableSections.length > 0) {
      if (!availableSections.includes(activeSection)) {
        setActiveSection(availableSections[0]);
      }
    }
  }, [moduleDetailsDialogOpen, availableSections, activeSection]);
  
  // Check for validation errors and track invalid sections
  const invalidSections = useMemo(() => {
    const sections = new Set<string>();
    if (!draft || !activeTab?.source?.moduleType) return sections;
    
    const schema = MODULE_TYPE_SCHEMAS[activeTab.source.moduleType as LogicModuleType];
    const draftData = draft.draft;
    
    // Name validation
    if (schema.requiredFields.includes('name') && !draftData.name?.trim()) {
      sections.add('basic');
    }
    
    // Collect interval validation
    if (schema.requiredFields.includes('collectInterval')) {
      const interval = draftData.collectInterval;
      if (interval === undefined || interval === null || (typeof interval === 'number' && interval <= 0)) {
        sections.add('basic');
      }
    }
    
    // Description max 1024 characters
    if (draftData.description && draftData.description.length > 1024) {
      sections.add('basic');
    }
    
    // Technology (Technical Notes) max 4096 characters
    if (draftData.technology && draftData.technology.length > 4096) {
      sections.add('organization');
    }

    // Clear After ACK validation (EventSource)
    if (schema.requiredFields.includes('alertEffectiveIval')) {
      const value = draftData.alertEffectiveIval;
      if (value === undefined || value === null || (typeof value === 'number' && (value < 5 || value > 5760))) {
        sections.add('alertSettings');
      }
    }
    
    return sections;
  }, [draft, activeTab]);

  // Load module details when dialog opens
  useEffect(() => {
    if (moduleDetailsDialogOpen && activeTabId && isModuleTab && !draft) {
      loadModuleDetails(activeTabId);
    }
  }, [moduleDetailsDialogOpen, activeTabId, isModuleTab, draft, loadModuleDetails]);

  // Auto-refresh to check for portal changes when dialog opens and user has dirty fields
  useEffect(() => {
    if (moduleDetailsDialogOpen && activeTabId && isModuleTab && draft && hasChanges) {
      // Silently check for portal updates in the background
      refreshModuleDetailsBaseline(activeTabId);
    }
  }, [moduleDetailsDialogOpen, activeTabId, isModuleTab, draft, hasChanges, refreshModuleDetailsBaseline]);

  // Always fetch access groups when dialog opens (needed to display names)
  useEffect(() => {
    if (moduleDetailsDialogOpen && activeTabId && isModuleTab) {
      fetchAccessGroups(activeTabId);
    }
  }, [moduleDetailsDialogOpen, activeTabId, isModuleTab, fetchAccessGroups]);

  const handleClose = () => {
    // Note: Changes are tracked in the draft state and can be reset via the "Reset Changes" button.
    // The dialog closes without warning - users can restore changes by reopening the dialog before committing.
    setModuleDetailsDialogOpen(false);
  };

  const handleSave = async () => {
    // If this tab has a directory handle, persist the module details to module.json
    if (activeTab?.directoryHandleId && activeTabId) {
      await persistModuleDetailsToDirectory(activeTabId);
    }
    // Close the dialog - changes remain in draft for the commit flow
    setModuleDetailsDialogOpen(false);
  };

  const handleReset = () => {
    if (activeTabId) {
      resetModuleDetailsDraft(activeTabId);
    }
  };

  if (!isModuleTab || !activeTab?.source?.moduleId || !activeTab?.source?.moduleType) {
    return null;
  }

  return (
    <Dialog open={moduleDetailsDialogOpen} onOpenChange={setModuleDetailsDialogOpen}>
      <DialogContent className="
        flex h-[90vh] w-[95vw] max-w-[1600px]! flex-col gap-0 p-0
      " showCloseButton>
        <div className="relative flex h-full flex-col">
          <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="size-5" />
                  Module Details
                  {isRefreshingModuleDetails && (
                    <span className="
                      flex items-center gap-1 text-xs text-muted-foreground
                    ">
                      <RefreshCw className="size-3 animate-spin" />
                      Checking for updates...
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Edit module metadata for {activeTab.source.moduleName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 border-t border-border">
            {/* Sidebar Navigation */}
              <ModuleDetailsSidebar
                activeSection={activeSection}
                onSectionChange={(section) => setActiveSection(section)}
                sections={availableSections}
                dirtySections={dirtySections}
                invalidSections={invalidSections}
              />

            {/* Main Content Area */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* Conflict Warning Banner */}
              {moduleDetailsConflict?.hasConflict && (
                <div className="shrink-0 border-b p-4">
                  <Alert variant="warning">
                    <AlertTitle>Portal Changes Detected</AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="space-y-3">
                        <p>
                          {moduleDetailsConflict.message}
                          {moduleDetailsConflict.conflictingFields && moduleDetailsConflict.conflictingFields.length > 0 && (
                            <span className="mt-1 block">
                              Changed fields: {moduleDetailsConflict.conflictingFields.join(', ')}
                            </span>
                          )}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activeTabId && resolveModuleDetailsConflict(activeTabId, 'keep-local')}
                          >
                            Keep My Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => activeTabId && resolveModuleDetailsConflict(activeTabId, 'use-portal')}
                          >
                            <RefreshCw className="mr-1.5 size-3.5" />
                            Use Portal Version
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {moduleDetailsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="
                      size-8 animate-spin text-muted-foreground
                    " />
                    <p className="text-sm text-muted-foreground">Loading module details...</p>
                  </div>
                </div>
              ) : moduleDetailsError ? (
                <div className="p-6">
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{moduleDetailsError}</AlertDescription>
                  </Alert>
                </div>
              ) : draft ? (
                <div className="flex-1 overflow-y-auto p-6">
                  {activeSection === 'basic' && (
                    <ModuleDetailsBasicInfo tabId={activeTabId!} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'organization' && (
                    <ModuleDetailsOrganization tabId={activeTabId!} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'access' && (
                    <ModuleDetailsAccess tabId={activeTabId!} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'appliesTo' && (
                    <ModuleDetailsAppliesTo tabId={activeTabId!} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'activeDiscovery' && enableAutoDiscovery && (
                    <ModuleDetailsActiveDiscovery tabId={activeTabId!} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'datapoints' && schema?.editableList === 'datapoints' && (
                    <ModuleDetailsDatapoints tabId={activeTabId!} moduleId={activeTab.source.moduleId} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'configChecks' && schema?.editableList === 'configChecks' && (
                    <ModuleDetailsConfigChecks tabId={activeTabId!} moduleId={activeTab.source.moduleId} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'alertSettings' && schema?.supportsAlertSettings && (
                    <ModuleDetailsAlertSettings tabId={activeTabId!} moduleType={activeTab.source.moduleType} />
                  )}
                </div>
              ) : (
                <div className="
                  flex h-full items-center justify-center text-muted-foreground
                ">
                  No module details loaded
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 pt-4 pb-6">
            <div className="flex w-full items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {hasChanges && (
                  <span className="text-yellow-500">You have changes that have not been staged</span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {hasChanges && (
                  <Button variant="outline" onClick={() => setResetDialogOpen(true)}>
                    Reset Changes
                  </Button>
                )}
                <Button variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!hasChanges || invalidSections.size > 0}>
                  Stage Changes
                </Button>
              </div>
            </div>
          </DialogFooter>
          <ConfirmationDialog
            open={resetDialogOpen}
            onOpenChange={setResetDialogOpen}
            title="Reset module detail changes?"
            description="This will discard all unsaved changes in the Module Details dialog and restore the last loaded values."
            confirmLabel="Reset Changes"
            cancelLabel="Keep Editing"
            variant="warning"
            onConfirm={handleReset}
          />
          <PortalBindingOverlay tabId={activeTabId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
