import { Target, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEditorStore } from '../../stores/editor-store';
import type { LogicModuleType } from '@/shared/types';
import { MODULE_TYPE_SCHEMAS } from '@/shared/module-type-schemas';

interface ModuleDetailsActiveDiscoveryProps {
  tabId: string;
  moduleType: LogicModuleType;
}

export function ModuleDetailsActiveDiscovery({ tabId, moduleType }: ModuleDetailsActiveDiscoveryProps) {
  const {
    moduleDetailsDraftByTabId,
    updateModuleDetailsField,
  } = useEditorStore();

  const draft = moduleDetailsDraftByTabId[tabId];
  const schema = MODULE_TYPE_SCHEMAS[moduleType];
  const draftData = draft?.draft || {};
  const adConfig = draftData.autoDiscoveryConfig || {};
  
  // Read boolean values directly - ensure they're always boolean, never undefined
  const deleteInactiveInstance = Boolean(adConfig.deleteInactiveInstance);
  const disableInstance = Boolean(adConfig.disableInstance);

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

  const handleDeleteInactiveChange = (checked: boolean) => {
    // Read fresh state directly from store to avoid any stale closures
    const storeState = useEditorStore.getState();
    const currentDraft = storeState.moduleDetailsDraftByTabId[tabId];
    if (!currentDraft) return;
    
    const currentAD = currentDraft.draft?.autoDiscoveryConfig || {};
    
    // Build new AD config - explicitly set deleteInactiveInstance to the checked value
    const newAD = {
      ...currentAD,
      deleteInactiveInstance: checked,
    };
    
    // Only reset showDeletedInstanceDays if we're disabling
    if (!checked) {
      newAD.showDeletedInstanceDays = 0;
    }
    
    // Update the field directly using the store action
    storeState.updateModuleDetailsField(tabId, 'autoDiscoveryConfig', newAD);
  };

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

  // Filter operation options
  const filterOperationOptions = [
    { label: 'Equal', value: 'Equal' },
    { label: 'Not Equal', value: 'NotEqual' },
    { label: 'Greater Than', value: 'GreaterThan' },
    { label: 'Greater Equal', value: 'GreaterEqual' },
    { label: 'Less Than', value: 'LessThan' },
    { label: 'Less Equal', value: 'LessEqual' },
    { label: 'Contain', value: 'Contain' },
    { label: 'Not Contain', value: 'NotContain' },
    { label: 'Not Exist', value: 'NotExist' },
    { label: 'Regex Match', value: 'RegexMatch' },
    { label: 'Regex Not Match', value: 'RegexNotMatch' },
  ];

  // Get current filters
  const filters = adConfig.filters || [];

  // Handle filter changes
  const handleFilterChange = (index: number, field: string, value: string) => {
    const newFilters = [...filters];
    if (!newFilters[index]) {
      newFilters[index] = { attribute: '', operation: 'Equal', value: '' };
    }
    newFilters[index] = {
      ...newFilters[index],
      [field]: value,
    };
    handleADFieldChange('filters', newFilters);
  };

  const handleAddFilter = () => {
    const newFilters = [...filters, { attribute: '', operation: 'Equal', value: '' }];
    handleADFieldChange('filters', newFilters);
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    handleADFieldChange('filters', newFilters);
  };

  // Get current values with defaults - ensure they're always strings for Select
  const currentScheduleInterval = String(adConfig.scheduleInterval ?? 0);
  const currentShowDeletedDays = String(adConfig.showDeletedInstanceDays === 30 ? 30 : 0);
  const currentAutoGroupMethod = adConfig.instanceAutoGroupMethod || 'none';
  
  // Get labels for selected values
  const selectedScheduleIntervalLabel = useMemo(() => {
    const interval = adConfig.scheduleInterval ?? 0;
    return scheduleIntervalOptions.find(opt => opt.value === interval)?.label;
  }, [adConfig.scheduleInterval]);
  
  const selectedShowDeletedDaysLabel = useMemo(() => {
    const days = adConfig.showDeletedInstanceDays === 30 ? 30 : 0;
    return days === 30 ? '30 days' : '0 days';
  }, [adConfig.showDeletedInstanceDays]);
  
  const selectedAutoGroupMethodLabel = useMemo(() => {
    const method = adConfig.instanceAutoGroupMethod || 'none';
    return instanceAutoGroupMethodOptions.find(opt => opt.value === method)?.label;
  }, [adConfig.instanceAutoGroupMethod]);

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading module details...
      </div>
    );
  }

  if (!schema.supportsAutoDiscovery) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5" />
            Auto Discovery Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic instance discovery and management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Schedule Interval */}
            <div className="space-y-2">
              <Label htmlFor="ad-schedule-interval" className="text-sm font-medium">
                Schedule Interval
              </Label>
              <Select
                value={currentScheduleInterval}
                onValueChange={(value) => {
                  if (value) {
                    handleADFieldChange('scheduleInterval', parseInt(value, 10));
                  }
                }}
              >
                <SelectTrigger id="ad-schedule-interval">
                  <SelectValue>
                    {selectedScheduleIntervalLabel || 'Select schedule interval'}
                  </SelectValue>
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
                  onCheckedChange={handleDeleteInactiveChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically delete instances that are no longer discovered
              </p>
            </div>

            {/* Show Deleted Instance Days */}
            {deleteInactiveInstance && (
              <div className="space-y-2">
                <Label htmlFor="ad-show-deleted-days" className="text-sm font-medium">
                  Show Deleted Instance Days
                </Label>
                <Select
                  value={currentShowDeletedDays}
                  onValueChange={(value) => {
                    if (value) {
                      handleADFieldChange('showDeletedInstanceDays', parseInt(value, 10));
                    }
                  }}
                >
                  <SelectTrigger id="ad-show-deleted-days">
                    <SelectValue>
                      {selectedShowDeletedDaysLabel || 'Select days'}
                    </SelectValue>
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
              <p className="text-xs text-muted-foreground">
                Disable discovered instances by default
              </p>
            </div>

            {/* Instance Auto Group Method */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ad-auto-group-method" className="text-sm font-medium">
                Instance Auto Group Method
              </Label>
              <Select
                value={currentAutoGroupMethod}
                onValueChange={(value) => handleADFieldChange('instanceAutoGroupMethod', value)}
              >
                <SelectTrigger id="ad-auto-group-method">
                  <SelectValue>
                    {selectedAutoGroupMethodLabel || 'Select method'}
                  </SelectValue>
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
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Filters</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Filter instances discovered by auto discovery
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddFilter}
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                Add Filter
              </Button>
            </div>

            {filters.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-md bg-muted/20">
                No filters configured. Click "Add Filter" to create one.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Attribute</TableHead>
                      <TableHead className="w-[150px]">Operation</TableHead>
                      <TableHead className="w-[250px]">Value</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filters.map((filter, index) => {
                      const operation = filter.operation || 'Equal';
                      const showValue = operation !== 'NotExist';
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={filter.attribute || ''}
                              onChange={(e) => handleFilterChange(index, 'attribute', e.target.value)}
                              placeholder="e.g., system.hostname"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={operation}
                              onValueChange={(value) => {
                                if (value) {
                                  handleFilterChange(index, 'operation', value);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue>
                                  {filterOperationOptions.find(opt => opt.value === operation)?.label || operation}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {filterOperationOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {showValue ? (
                              <Input
                                value={filter.value || ''}
                                onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
                                placeholder="Filter value"
                                className="h-8"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const comment = filter.comment || '';
                              const isTruncated = comment.length > 40;
                              
                              if (isTruncated) {
                                return (
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Input
                                          value={comment}
                                          onChange={(e) => handleFilterChange(index, 'comment', e.target.value)}
                                          placeholder="Optional comment"
                                          className="h-8"
                                        />
                                      }
                                    />
                                    <TooltipContent className="max-w-md">
                                      <p className="whitespace-pre-wrap">{comment}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }
                              
                              return (
                                <Input
                                  value={comment}
                                  onChange={(e) => handleFilterChange(index, 'comment', e.target.value)}
                                  placeholder="Optional comment"
                                  className="h-8"
                                />
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleRemoveFilter(index)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

