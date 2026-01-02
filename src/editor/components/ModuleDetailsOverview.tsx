import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { AppliesToEditorSlim } from './AppliesToEditorSlim';
import { useEditorStore } from '../stores/editor-store';
import type { LogicModuleType } from '@/shared/types';
import { MODULE_TYPE_SCHEMAS } from '@/shared/module-type-schemas';

interface ModuleDetailsOverviewProps {
  tabId: string;
  moduleType: LogicModuleType;
}

export function ModuleDetailsOverview({ tabId, moduleType }: ModuleDetailsOverviewProps) {
  const {
    moduleDetailsDraftByTabId,
    updateModuleDetailsField,
    accessGroups,
    appliesToResults,
    appliesToError,
    isTestingAppliesTo,
    testAppliesTo,
    setAppliesToExpression,
  } = useEditorStore();

  const draft = moduleDetailsDraftByTabId[tabId];
  const schema = MODULE_TYPE_SCHEMAS[moduleType];

  const draftData = draft?.draft || {};
  const adConfig = draftData.autoDiscoveryConfig || {};
  const enableAutoDiscovery = draftData.enableAutoDiscovery || false;
  
  // Ensure boolean fields are explicitly boolean, not undefined - read directly from draftData to ensure reactivity
  const deleteInactiveInstance = (draftData.autoDiscoveryConfig?.deleteInactiveInstance === true);
  const disableInstance = (draftData.autoDiscoveryConfig?.disableInstance === true);

  const handleFieldChange = (field: string, value: unknown) => {
    updateModuleDetailsField(tabId, field, value);
  };

  const handleADFieldChange = (field: string, value: unknown) => {
    // Read fresh state from store to avoid stale closures
    const currentDraft = moduleDetailsDraftByTabId[tabId];
    const currentAD = currentDraft?.draft?.autoDiscoveryConfig || {};
    const newAD = {
      ...currentAD,
      [field]: value,
    };
    handleFieldChange('autoDiscoveryConfig', newAD);
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
    }
    
    // Description max 1024 characters
    if (draftData.description && draftData.description.length > 1024) {
      errors.description = 'Description cannot exceed 1024 characters';
    }
    
    // Collect interval validation
    if (schema.requiredFields.includes('collectInterval')) {
      const interval = draftData.collectInterval;
      if (interval === undefined || interval === null) {
        errors.collectInterval = 'Collect interval is required';
      } else if (typeof interval === 'number' && interval <= 0) {
        errors.collectInterval = 'Collect interval must be greater than 0';
      }
    }
    
    return errors;
  }, [draftData, schema]);

  const [accessGroupSearch, setAccessGroupSearch] = useState('');
  const anchorRef = useComboboxAnchor();

  // Access groups options for combobox
  const accessGroupOptions = useMemo(() => {
    if (!accessGroupSearch.trim()) {
      return accessGroups.map(ag => ({
        value: ag.id.toString(),
        label: ag.name,
      }));
    }
    const query = accessGroupSearch.toLowerCase();
    return accessGroups
      .filter(ag => ag.name.toLowerCase().includes(query))
      .map(ag => ({
        value: ag.id.toString(),
        label: ag.name,
      }));
  }, [accessGroups, accessGroupSearch]);

  // Selected access group IDs
  const selectedAccessGroupIds = useMemo(() => {
    const ids = draftData.accessGroupIds;
    if (Array.isArray(ids)) {
      return ids.map(id => id.toString());
    }
    if (typeof ids === 'string') {
      return ids.split(',').map(id => id.trim()).filter(Boolean);
    }
    return [];
  }, [draftData.accessGroupIds]);

  const handleAccessGroupChange = (value: string[] | string | null | undefined) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    const numericIds = values.map(v => parseInt(v, 10)).filter(id => !isNaN(id));
    handleFieldChange('accessGroupIds', numericIds);
  };

  // Collect interval options
  const collectIntervalOptions = schema.collectIntervalOptions || [];
  const selectedCollectInterval = useMemo(() => {
    const interval = draftData.collectInterval;
    if (!interval) return undefined;
    return collectIntervalOptions.find(opt => opt.value === interval)?.value.toString();
  }, [draftData.collectInterval, collectIntervalOptions]);
  
  const selectedCollectIntervalLabel = useMemo(() => {
    const interval = draftData.collectInterval;
    if (!interval) return undefined;
    return collectIntervalOptions.find(opt => opt.value === interval)?.label;
  }, [draftData.collectInterval, collectIntervalOptions]);

  // AD schedule interval options: 0|15|60|1440 minutes
  const scheduleIntervalOptions = [
    { label: 'On host/data source change (0 min)', value: 0 },
    { label: '15 minutes', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '24 hours', value: 1440 },
  ];

  // AD instance auto group method options
  const instanceAutoGroupMethodOptions = [
    { label: 'None', value: 'none' },
    { label: 'Regex', value: 'regex' },
    { label: 'ILP', value: 'ilp' },
  ];


  if (!draft) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading module details...
      </div>
    );
  }

  return (
    <div className="p-6 pb-8 w-full">
      <div className="space-y-8">
        {/* Basic Information Section */}
        <div className="space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="text-base font-semibold">Basic Information</h3>
            <p className="text-xs text-muted-foreground mt-1">Core module identification and metadata</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2 md:col-span-2">
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
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  {validationErrors.name}
                </p>
              )}
            </div>

            {/* Display Name */}
            {schema.editableFields.includes('displayName') && (
              <div className="space-y-2">
                <Label htmlFor="module-display-name" className="text-sm font-medium">
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
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {validationErrors.displayName}
                  </p>
                )}
              </div>
            )}

            {/* Collect Interval */}
            {schema.editableFields.includes('collectInterval') && (
              <div className="space-y-2">
                <Label htmlFor="module-collect-interval" className="text-sm font-medium">
                  Collect Interval <span className="text-destructive">*</span>
                </Label>
                {collectIntervalOptions.length > 0 ? (
                  <Select
                    value={selectedCollectInterval}
                    onValueChange={(value) => {
                      const option = collectIntervalOptions.find(opt => opt.value.toString() === value);
                      if (option) {
                        handleFieldChange('collectInterval', option.value);
                      }
                    }}
                  >
                    <SelectTrigger id="module-collect-interval" className={validationErrors.collectInterval ? 'border-destructive' : ''}>
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
                    className={validationErrors.collectInterval ? 'border-destructive' : ''}
                  />
                )}
                {validationErrors.collectInterval && (
                  <p className="text-xs text-destructive flex items-center gap-1">
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
                <Label htmlFor="module-description" className="text-sm font-medium">
                  Description
                </Label>
                <span className={`text-xs ${(draftData.description?.length || 0) > 1024 ? 'text-destructive' : 'text-muted-foreground'}`}>
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
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  {validationErrors.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Applies To Section */}
        {schema.editableFields.includes('appliesTo') && (
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <h3 className="text-base font-semibold">Applies To</h3>
              <p className="text-xs text-muted-foreground mt-1">Define which devices this module applies to</p>
            </div>
            <AppliesToEditorSlim
              value={draftData.appliesTo || ''}
              onChange={(value) => {
                handleFieldChange('appliesTo', value);
                setAppliesToExpression(value);
              }}
              onTest={async () => {
                setAppliesToExpression(draftData.appliesTo || '');
                await testAppliesTo();
              }}
              results={appliesToResults}
              error={appliesToError}
              isTesting={isTestingAppliesTo}
            />
          </div>
        )}

        {/* Organization Section */}
        {(schema.editableFields.includes('group') || 
          schema.editableFields.includes('technology') || 
          schema.editableFields.includes('tags')) && (
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <h3 className="text-base font-semibold">Organization</h3>
              <p className="text-xs text-muted-foreground mt-1">Categorization and tagging</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Group */}
              {schema.editableFields.includes('group') && (
                <div className="space-y-2">
                  <Label htmlFor="module-group" className="text-sm font-medium">
                    Group
                  </Label>
                  <Input
                    id="module-group"
                    value={draftData.group || ''}
                    onChange={(e) => handleFieldChange('group', e.target.value)}
                    placeholder="Module group"
                  />
                </div>
              )}

              {/* Tags */}
              {schema.editableFields.includes('tags') && (
                <div className="space-y-2">
                  <Label htmlFor="module-tags" className="text-sm font-medium">
                    Tags
                  </Label>
                  <Input
                    id="module-tags"
                    value={draftData.tags || ''}
                    onChange={(e) => handleFieldChange('tags', e.target.value)}
                    placeholder="Comma-separated tags"
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate multiple tags with commas
                  </p>
                </div>
              )}
            </div>

            {/* Technology */}
            {schema.editableFields.includes('technology') && (
              <div className="space-y-2">
                <Label htmlFor="module-technology" className="text-sm font-medium">
                  Technical Notes
                </Label>
                <Textarea
                  id="module-technology"
                  value={draftData.technology || ''}
                  onChange={(e) => handleFieldChange('technology', e.target.value)}
                  placeholder="Technical notes"
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Auto Discovery Section */}
        {schema.supportsAutoDiscovery && enableAutoDiscovery && (
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <h3 className="text-base font-semibold">Auto Discovery Configuration</h3>
              <p className="text-xs text-muted-foreground mt-1">Configure automatic instance discovery</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Schedule Interval */}
              <div className="space-y-2">
                <Label htmlFor="ad-schedule-interval" className="text-sm font-medium">
                  Schedule Interval
                </Label>
                <Select
                  value={adConfig.scheduleInterval?.toString() || '0'}
                  onValueChange={(value) => {
                    if (value) {
                      handleADFieldChange('scheduleInterval', parseInt(value, 10));
                    }
                  }}
                >
                  <SelectTrigger id="ad-schedule-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleIntervalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delete Inactive Instance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ad-delete-inactive" className="text-sm font-medium">
                    Delete Inactive Instance
                  </Label>
                  <Switch
                    id="ad-delete-inactive"
                    checked={deleteInactiveInstance}
                    onCheckedChange={(checked) => {
                      handleADFieldChange('deleteInactiveInstance', checked);
                      if (!checked) {
                        handleADFieldChange('showDeletedInstanceDays', 0);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Show Deleted Instance Days */}
              {deleteInactiveInstance && (
                <div className="space-y-2">
                  <Label htmlFor="ad-show-deleted-days" className="text-sm font-medium">
                    Show Deleted Instance Days
                  </Label>
                  <Select
                    value={adConfig.showDeletedInstanceDays?.toString() || '0'}
                    onValueChange={(value) => {
                      if (value) {
                        handleADFieldChange('showDeletedInstanceDays', parseInt(value, 10));
                      }
                    }}
                  >
                    <SelectTrigger id="ad-show-deleted-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Disable Instance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ad-disable-instance" className="text-sm font-medium">
                    Disable Instance
                  </Label>
                  <Switch
                    id="ad-disable-instance"
                    checked={disableInstance}
                    onCheckedChange={(checked) => handleADFieldChange('disableInstance', checked)}
                  />
                </div>
              </div>

              {/* Instance Auto Group Method */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ad-auto-group-method" className="text-sm font-medium">
                  Instance Auto Group Method
                </Label>
                <Select
                  value={adConfig.instanceAutoGroupMethod || 'none'}
                  onValueChange={(value) => handleADFieldChange('instanceAutoGroupMethod', value)}
                >
                  <SelectTrigger id="ad-auto-group-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {instanceAutoGroupMethodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Instance Auto Group Method Params */}
              {adConfig.instanceAutoGroupMethod && adConfig.instanceAutoGroupMethod !== 'none' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="ad-auto-group-params" className="text-sm font-medium">
                    Instance Auto Group Method Parameters
                  </Label>
                  <Input
                    id="ad-auto-group-params"
                    value={adConfig.instanceAutoGroupMethodParams || ''}
                    onChange={(e) => handleADFieldChange('instanceAutoGroupMethodParams', e.target.value)}
                    placeholder="Parameters for auto group method"
                  />
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filters</Label>
              <p className="text-xs text-muted-foreground">
                Filter configuration for auto discovery (editing filters will be available in a future update)
              </p>
              {adConfig.filters && adConfig.filters.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {adConfig.filters.length} filter{adConfig.filters.length !== 1 ? 's' : ''} configured
                </div>
              )}
            </div>
          </div>
        )}

        {/* Access Control Section */}
        {schema.editableFields.includes('accessGroupIds') && schema.accessGroupSupport && (
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <h3 className="text-base font-semibold">Access Control</h3>
              <p className="text-xs text-muted-foreground mt-1">Control who can access this module</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-access-groups" className="text-sm font-medium">
                Access Groups
              </Label>
              <Combobox
                multiple
                value={selectedAccessGroupIds}
                onValueChange={(value) => handleAccessGroupChange(value)}
                inputValue={accessGroupSearch}
                onInputValueChange={(value) => setAccessGroupSearch(value)}
              >
                <ComboboxChips ref={anchorRef} className="w-full">
                  {selectedAccessGroupIds.map((id) => {
                    const ag = accessGroups.find(a => a.id.toString() === id);
                    return (
                      <ComboboxChip key={id}>
                        {ag?.name || id}
                      </ComboboxChip>
                    );
                  })}
                  <ComboboxChipsInput
                    placeholder={selectedAccessGroupIds.length === 0 ? "Select access groups..." : ""}
                  />
                </ComboboxChips>
                <ComboboxContent anchor={anchorRef}>
                  <ComboboxList>
                    {accessGroupOptions.length === 0 ? (
                      <ComboboxEmpty>No access groups found</ComboboxEmpty>
                    ) : (
                      accessGroupOptions.map((option) => (
                        <ComboboxItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => setAccessGroupSearch('')}
                        >
                          {option.label}
                        </ComboboxItem>
                      ))
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
