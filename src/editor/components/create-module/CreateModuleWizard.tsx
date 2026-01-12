/**
 * CreateModuleWizard - Multi-step wizard dialog for creating new LogicModules
 */
import { useState, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEditorStore } from '../../stores/editor-store';
import type { CreateModuleConfig, LogicModuleType, ScriptLanguage } from '@/shared/types';
import { ModuleTypeStep } from './ModuleTypeStep';
import { BasicInfoStep } from './BasicInfoStep';
import { ScriptConfigStep } from './ScriptConfigStep';
import { ConfirmStep } from './ConfirmStep';

// ============================================================================
// Types
// ============================================================================

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 'type', title: 'Module Type', description: 'Choose the type of module to create' },
  { id: 'info', title: 'Basic Info', description: 'Enter module name and details' },
  { id: 'scripts', title: 'Script Config', description: 'Configure script options' },
  { id: 'confirm', title: 'Confirm', description: 'Review and create' },
];

// ============================================================================
// Step Indicator Component
// ============================================================================

interface StepIndicatorProps {
  steps: WizardStep[];
  currentStep: number;
}

function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
              index < currentStep
                ? 'bg-primary text-primary-foreground'
                : index === currentStep
                  ? 'bg-primary/10 text-primary ring-2 ring-primary'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                'mx-2 h-0.5 w-8 transition-colors',
                index < currentStep ? 'bg-primary' : 'bg-border'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CreateModuleWizard() {
  const {
    createModuleWizardOpen,
    setCreateModuleWizardOpen,
    selectedPortalId,
    portals,
    createModule,
  } = useEditorStore();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [moduleType, setModuleType] = useState<LogicModuleType>('datasource');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [collectionLanguage, setCollectionLanguage] = useState<ScriptLanguage>('groovy');
  const [hasMultiInstances, setHasMultiInstances] = useState(false);
  const [useBatchScript, setUseBatchScript] = useState(false);
  const [adLanguage, setAdLanguage] = useState<ScriptLanguage>('groovy');
  const [initializeLocalDirectory, setInitializeLocalDirectory] = useState(false);

  // Reset form when dialog closes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setCurrentStep(0);
      setModuleType('datasource');
      setName('');
      setDisplayName('');
      setCollectionLanguage('groovy');
      setHasMultiInstances(false);
      setUseBatchScript(false);
      setAdLanguage('groovy');
      setInitializeLocalDirectory(false);
      setIsCreating(false);
    }
    setCreateModuleWizardOpen(open);
  }, [setCreateModuleWizardOpen]);

  // Navigation
  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 0: // Module type
        return moduleType !== null;
      case 1: // Basic info
        return name.trim().length > 0;
      case 2: // Script config
        return true;
      case 3: // Confirm
        return true;
      default:
        return false;
    }
  }, [currentStep, moduleType, name]);

  const goNext = useCallback(() => {
    if (currentStep < WIZARD_STEPS.length - 1 && canGoNext()) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, canGoNext]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Create module
  const handleCreate = useCallback(async () => {
    if (!selectedPortalId) {
      toast.error('No portal connected', {
        description: 'Please connect to a LogicMonitor portal first.',
      });
      return;
    }

    const config: CreateModuleConfig = {
      moduleType,
      name: name.trim(),
      displayName: displayName.trim() || undefined,
      collectionLanguage,
      hasMultiInstances,
      useBatchScript,
      adLanguage: hasMultiInstances ? adLanguage : undefined,
      initializeLocalDirectory,
    };

    setIsCreating(true);
    try {
      await createModule(config);
      handleOpenChange(false);
      toast.success('Module created', {
        description: `Successfully created "${config.name}" in your portal.`,
      });
    } catch (error) {
      toast.error('Failed to create module', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsCreating(false);
    }
  }, [
    selectedPortalId,
    moduleType,
    name,
    displayName,
    collectionLanguage,
    hasMultiInstances,
    useBatchScript,
    adLanguage,
    initializeLocalDirectory,
    createModule,
    handleOpenChange,
  ]);

  const portal = portals.find(p => p.id === selectedPortalId);
  const step = WIZARD_STEPS[currentStep];

  return (
    <Dialog open={createModuleWizardOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[90vh] w-[90vw]! max-w-[700px]! flex-col gap-0 p-0"
        showCloseButton
      >
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5" />
            Create LogicModule
          </DialogTitle>
          <DialogDescription>
            Create a new scripted module in {portal?.displayName || 'your portal'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="shrink-0 border-b bg-muted/5 px-6 py-4">
          <StepIndicator steps={WIZARD_STEPS} currentStep={currentStep} />
          <div className="mt-3 text-center">
            <p className="text-sm font-medium text-foreground">{step.title}</p>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {currentStep === 0 && (
            <ModuleTypeStep
              value={moduleType}
              onChange={setModuleType}
            />
          )}
          {currentStep === 1 && (
            <BasicInfoStep
              moduleType={moduleType}
              name={name}
              displayName={displayName}
              onNameChange={setName}
              onDisplayNameChange={setDisplayName}
            />
          )}
          {currentStep === 2 && (
            <ScriptConfigStep
              moduleType={moduleType}
              collectionLanguage={collectionLanguage}
              hasMultiInstances={hasMultiInstances}
              useBatchScript={useBatchScript}
              adLanguage={adLanguage}
              onCollectionLanguageChange={setCollectionLanguage}
              onHasMultiInstancesChange={setHasMultiInstances}
              onUseBatchScriptChange={setUseBatchScript}
              onAdLanguageChange={setAdLanguage}
            />
          )}
          {currentStep === 3 && (
            <ConfirmStep
              moduleType={moduleType}
              name={name}
              displayName={displayName}
              collectionLanguage={collectionLanguage}
              hasMultiInstances={hasMultiInstances}
              useBatchScript={useBatchScript}
              adLanguage={adLanguage}
              initializeLocalDirectory={initializeLocalDirectory}
              onInitializeLocalDirectoryChange={setInitializeLocalDirectory}
            />
          )}
        </div>

        {/* Footer */}
        <div className="
          flex shrink-0 items-center justify-between border-t bg-background px-6 py-4
        ">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={currentStep === 0 || isCreating}
          >
            <ChevronLeft className="mr-1 size-4" />
            Back
          </Button>

          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button
              onClick={goNext}
              disabled={!canGoNext()}
            >
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={isCreating || !selectedPortalId}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-1 size-4" />
                  Create Module
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
