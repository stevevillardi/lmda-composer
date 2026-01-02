import { Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppliesToEditorSlim } from '../AppliesToEditorSlim';
import { useEditorStore } from '../../stores/editor-store';
import type { LogicModuleType } from '@/shared/types';
import { MODULE_TYPE_SCHEMAS } from '@/shared/module-type-schemas';

interface ModuleDetailsAppliesToProps {
  tabId: string;
  moduleType: LogicModuleType;
}

export function ModuleDetailsAppliesTo({ tabId, moduleType }: ModuleDetailsAppliesToProps) {
  const {
    moduleDetailsDraftByTabId,
    updateModuleDetailsField,
    appliesToResults,
    appliesToError,
    isTestingAppliesTo,
    testAppliesTo,
    setAppliesToExpression,
  } = useEditorStore();

  const draft = moduleDetailsDraftByTabId[tabId];
  const schema = MODULE_TYPE_SCHEMAS[moduleType];
  const draftData = draft?.draft || {};
  const appliesToLabel = schema.fieldAliases?.appliesTo === 'appliesToScript' ? 'Applies To Script' : 'Applies To';

  const handleFieldChange = (field: string, value: unknown) => {
    updateModuleDetailsField(tabId, field, value);
  };

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading module details...
      </div>
    );
  }

  if (!schema.editableFields.includes('appliesTo')) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-5" />
            {appliesToLabel}
          </CardTitle>
          <CardDescription>
            Define which devices this module applies to using LogicMonitor expressions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppliesToEditorSlim
            value={draftData.appliesTo || ''}
            onChange={(value) => {
              handleFieldChange('appliesTo', value);
              setAppliesToExpression(value);
            }}
            onTest={async () => {
              const expression = draftData.appliesTo || '';
              // Set expression first, then test
              setAppliesToExpression(expression);
              // Use requestAnimationFrame to ensure state update is processed
              await new Promise(resolve => requestAnimationFrame(resolve));
              await testAppliesTo();
            }}
            results={appliesToResults}
            error={appliesToError}
            isTesting={isTestingAppliesTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
