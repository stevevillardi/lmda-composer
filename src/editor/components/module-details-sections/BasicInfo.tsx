import { useMemo } from 'react';
import { Info, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEditorStore } from '../../stores/editor-store';
import type { LogicModuleType } from '@/shared/types';
import { MODULE_TYPE_SCHEMAS } from '@/shared/module-type-schemas';
import { validateModuleDisplayName } from '../../utils/validation';

interface ModuleDetailsBasicInfoProps {
  tabId: string;
  moduleType: LogicModuleType;
}

export function ModuleDetailsBasicInfo({ tabId, moduleType }: ModuleDetailsBasicInfoProps) {
  const {
    moduleDetailsDraftByTabId,
    updateModuleDetailsField,
  } = useEditorStore();

  const draft = moduleDetailsDraftByTabId[tabId];
  const schema = MODULE_TYPE_SCHEMAS[moduleType];
  const draftData = draft?.draft || {};

  const handleFieldChange = (field: string, value: unknown) => {
    updateModuleDetailsField(tabId, field, value);
  };

  // Validation
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    
    // Name is required
    if (schema.requiredFields.includes('name') && !draftData.name?.trim()) {
      errors.name = 'Name is required';
    }
    
    // Name cannot include special characters: " $ ^ * ( )
    if (draftData.name) {
      const invalidChars = /["$^*()]/;
      if (invalidChars.test(draftData.name)) {
        errors.name = 'Name cannot include special characters: " $ ^ * ( )';
      }
    }
    
    // Display Name (Resource Label) cannot include special characters: % $ ^ & *
    if (draftData.displayName) {
      const invalidChars = /[%$^&*]/;
      if (invalidChars.test(draftData.displayName)) {
        errors.displayName = 'Resource Label cannot include special characters: % $ ^ & *';
      }
      
      // Additional validation for module types with hyphen restrictions
      const hyphenError = validateModuleDisplayName(draftData.displayName, moduleType);
      if (hyphenError && !errors.displayName) {
        errors.displayName = hyphenError;
      }
    }
    
    // Description max 1024 characters
    if (draftData.description && draftData.description.length > 1024) {
      errors.description = 'Description cannot exceed 1024 characters';
    }
    
    // Collect interval validation
    if (schema.requiredFields.includes('collectInterval')) {
      const intervalLabel = schema.intervalLabel || 'Collect interval';
      const interval = draftData.collectInterval;
      if (interval === undefined || interval === null) {
        errors.collectInterval = `${intervalLabel} is required`;
      } else if (typeof interval === 'number' && interval <= 0) {
        errors.collectInterval = `${intervalLabel} must be greater than 0`;
      }
    }
    
    return errors;
  }, [draftData, schema]);

  // Collect interval options
  const collectIntervalOptions = schema.collectIntervalOptions || [];
  const selectedCollectInterval = useMemo(() => {
    const interval = draftData.collectInterval;
    if (!interval) return undefined;
    const option = collectIntervalOptions.find(opt => opt.value === interval);
    return option ? option.value.toString() : undefined;
  }, [draftData.collectInterval, collectIntervalOptions]);
  const selectedCollectIntervalLabel = useMemo(() => {
    const interval = draftData.collectInterval;
    if (!interval) return undefined;
    const option = collectIntervalOptions.find(opt => opt.value === interval);
    return option?.label;
  }, [draftData.collectInterval, collectIntervalOptions]);

  if (!draft) {
    return (
      <div className="
        flex h-64 items-center justify-center text-muted-foreground
      ">
        Loading module details...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Core module identification and metadata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="module-name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="module-name"
              value={draftData.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="Module name"
              aria-invalid={!!validationErrors.name}
              className={validationErrors.name ? 'border-destructive' : ''}
            />
            {validationErrors.name && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" />
                {validationErrors.name}
              </p>
            )}
          </div>

          <div className="
            grid grid-cols-1 gap-4
            md:grid-cols-2
          ">
            {/* Display Name */}
            {schema.editableFields.includes('displayName') && (
              <div className="space-y-2">
                <Label htmlFor="module-display-name" className="
                  text-sm font-medium
                ">
                  Resource Label
                </Label>
                <Input
                  id="module-display-name"
                  value={draftData.displayName || ''}
                  onChange={(e) => handleFieldChange('displayName', e.target.value)}
                  placeholder="Resource label"
                  aria-invalid={!!validationErrors.displayName}
                  className={validationErrors.displayName ? 'border-destructive' : ''}
                />
                {validationErrors.displayName && (
                  <p className="
                    flex items-center gap-1 text-xs text-destructive
                  ">
                    <AlertCircle className="size-3" />
                    {validationErrors.displayName}
                  </p>
                )}
              </div>
            )}

            {/* Collect Interval */}
            {schema.editableFields.includes('collectInterval') && (
              <div className="space-y-2">
                <Label htmlFor="module-collect-interval" className="
                  text-sm font-medium
                ">
                  {schema.intervalLabel || 'Collect Interval'} <span className="
                    text-destructive
                  ">*</span>
                </Label>
                {collectIntervalOptions.length > 0 ? (
                  <Select
                    value={selectedCollectInterval || undefined}
                    onValueChange={(value) => {
                      const option = collectIntervalOptions.find(opt => opt.value.toString() === value);
                      if (option) {
                        handleFieldChange('collectInterval', option.value);
                      }
                    }}
                  >
                    <SelectTrigger id="module-collect-interval" className={validationErrors.collectInterval ? `
                      border-destructive
                    ` : ''}>
                      <SelectValue>
                        {selectedCollectIntervalLabel || 'Select collect interval'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {collectIntervalOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="module-collect-interval"
                    type="number"
                    min="1"
                    value={draftData.collectInterval || ''}
                    onChange={(e) => handleFieldChange('collectInterval', parseInt(e.target.value, 10) || 0)}
                    placeholder="300"
                    aria-invalid={!!validationErrors.collectInterval}
                    className={validationErrors.collectInterval ? `
                      border-destructive
                    ` : ''}
                  />
                )}
                {validationErrors.collectInterval && (
                  <p className="
                    flex items-center gap-1 text-xs text-destructive
                  ">
                    <AlertCircle className="size-3" />
                    {validationErrors.collectInterval}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {schema.editableFields.includes('description') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="module-description" className="
                  text-sm font-medium
                ">
                  Description
                </Label>
                <span className={`
                  text-xs
                  ${(draftData.description?.length || 0) > 1024 ? `
                    text-destructive
                  ` : `text-muted-foreground`}
                `}>
                  {(draftData.description?.length || 0)} / 1024
                </span>
              </div>
              <Textarea
                id="module-description"
                value={draftData.description || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 1024) {
                    handleFieldChange('description', value);
                  }
                }}
                placeholder="Module description"
                rows={3}
                className="resize-none"
                aria-invalid={!!validationErrors.description}
              />
              {validationErrors.description && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {validationErrors.description}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
