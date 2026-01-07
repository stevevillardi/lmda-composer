import { useEffect, useMemo, useState } from 'react';
import { Settings, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ModuleDetailsSidebar } from './ModuleDetailsSidebar';
import { useEditorStore } from '../stores/editor-store';
import { MODULE_TYPE_SCHEMAS, type ModuleDetailsSection } from '@/shared/module-type-schemas';
import type { LogicModuleType } from '@/shared/types';
import { ModuleDetailsBasicInfo } from './ModuleDetailsSections/BasicInfo';
import { ModuleDetailsOrganization } from './ModuleDetailsSections/Organization';
import { ModuleDetailsAccess } from './ModuleDetailsSections/Access';
import { ModuleDetailsAppliesTo } from './ModuleDetailsSections/AppliesTo';
import { ModuleDetailsActiveDiscovery } from './ModuleDetailsSections/ActiveDiscovery';
import { ModuleDetailsDatapoints } from './ModuleDetailsSections/Datapoints';
import { ModuleDetailsConfigChecks } from './ModuleDetailsSections/ConfigChecks';
import { ModuleDetailsAlertSettings } from './ModuleDetailsSections/AlertSettings';
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
    loadModuleDetails,
    fetchAccessGroups,
    resetModuleDetailsDraft,
    persistModuleDetailsToDirectory,
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
    
    // Datapoints are read-only, so no dirty tracking needed
    
    return sections;
  }, [draft]);
  
  const availableSections = useMemo<ModuleDetailsSection[]>(() => {
    if (!schema) return [];
    return schema.sections.filter((section) => {
      if (section === 'activeDiscovery') {
        return enableAutoDiscovery && schema.supportsAutoDiscovery;
      }
      if (section === 'datapoints') {
        return schema.readOnlyList === 'datapoints';
      }
      if (section === 'configChecks') {
        return schema.readOnlyList === 'configChecks';
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
  
  // Check for validation errors
  const hasValidationErrors = useMemo(() => {
    if (!draft || !activeTab?.source?.moduleType) return false;
    const schema = MODULE_TYPE_SCHEMAS[activeTab.source.moduleType as LogicModuleType];
    const draftData = draft.draft;
    
    // Name validation
    if (schema.requiredFields.includes('name') && !draftData.name?.trim()) {
      return true;
    }
    
    // Collect interval validation
    if (schema.requiredFields.includes('collectInterval')) {
      const interval = draftData.collectInterval;
      if (interval === undefined || interval === null || (typeof interval === 'number' && interval <= 0)) {
        return true;
      }
    }
    
    // Description max 1024 characters
    if (draftData.description && draftData.description.length > 1024) {
      return true;
    }
    
    // Technology (Technical Notes) max 4096 characters
    if (draftData.technology && draftData.technology.length > 4096) {
      return true;
    }

    // Clear After ACK validation (EventSource)
    if (schema.requiredFields.includes('alertEffectiveIval')) {
      const value = draftData.alertEffectiveIval;
      if (value === undefined || value === null || (typeof value === 'number' && (value < 5 || value > 5760))) {
        return true;
      }
    }
    
    return false;
  }, [draft, activeTab]);

  // Load module details when dialog opens
  useEffect(() => {
    if (moduleDetailsDialogOpen && activeTabId && isModuleTab && !draft) {
      loadModuleDetails(activeTabId);
    }
  }, [moduleDetailsDialogOpen, activeTabId, isModuleTab, draft, loadModuleDetails]);

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
      <DialogContent className="w-[95vw] max-w-[1600px]! h-[90vh] flex flex-col gap-0 p-0" showCloseButton>
        <div className="relative flex flex-col h-full">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="size-5" />
                  Module Details
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Edit module metadata for {activeTab.source.moduleName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex min-h-0 border-t border-border">
            {/* Sidebar Navigation */}
              <ModuleDetailsSidebar
                activeSection={activeSection}
                onSectionChange={(section) => setActiveSection(section)}
                sections={availableSections}
                dirtySections={dirtySections}
              />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {moduleDetailsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
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
                  {activeSection === 'datapoints' && schema?.readOnlyList === 'datapoints' && (
                    <ModuleDetailsDatapoints tabId={activeTabId!} moduleId={activeTab.source.moduleId} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'configChecks' && schema?.readOnlyList === 'configChecks' && (
                    <ModuleDetailsConfigChecks tabId={activeTabId!} moduleId={activeTab.source.moduleId} moduleType={activeTab.source.moduleType} />
                  )}
                  {activeSection === 'alertSettings' && schema?.supportsAlertSettings && (
                    <ModuleDetailsAlertSettings tabId={activeTabId!} moduleType={activeTab.source.moduleType} />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No module details loaded
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-4 border-t shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-muted-foreground">
                {hasChanges && (
                  <span className="text-amber-500">You have changes that have not been staged</span>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {hasChanges && (
                  <Button variant="outline" onClick={() => setResetDialogOpen(true)}>
                    Reset Changes
                  </Button>
                )}
                <Button variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!hasChanges || hasValidationErrors}>
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
