import { useState, useEffect } from 'react';
import { AlertCircle, Info, FileCheck, Bell, FileCode, Variable, Filter, GitCompare, Download, Plus, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { WarningAlertIcon, ErrorAlertIcon, CriticalAlertIcon } from '../../constants/icons';
import type { ConfigCheck, ConfigCheckType, ConfigCheckScript, DiffCheckConfig, ValueCheckConfig } from '@/shared/types';

interface ConfigCheckEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configCheck: Partial<ConfigCheck> | null;
  existingNames: string[];
  onSave: (configCheck: ConfigCheck) => void;
  isNew: boolean;
  /** Initial type when creating a new check */
  initialType: ConfigCheckType;
}

// Config check type options
const CONFIG_CHECK_TYPE_OPTIONS: { label: string; value: ConfigCheckType; description: string; icon: React.ReactNode }[] = [
  { label: 'Any Change', value: 'ignore', description: 'Alert when config changes (with exclusions)', icon: <GitCompare className="size-4 text-muted-foreground" /> },
  { label: 'Groovy Script', value: 'groovy', description: 'Use custom Groovy logic', icon: <FileCode className="size-4 text-muted-foreground" /> },
  { label: 'Config Retrieval', value: 'fetch', description: 'Alert when config cannot be retrieved', icon: <Download className="size-4 text-muted-foreground" /> },
  { label: 'Missing Field', value: 'missing', description: 'Alert when a field is missing', icon: <Variable className="size-4 text-muted-foreground" /> },
  { label: 'Value Check', value: 'value', description: 'Check field value conditions', icon: <Filter className="size-4 text-muted-foreground" /> },
];

// Alert level options
const ALERT_LEVEL_OPTIONS = [
  { label: 'No Alert', value: 1 },
  { label: 'Warning', value: 2 },
  { label: 'Error', value: 3 },
  { label: 'Critical', value: 4 },
];

// Value check condition options
const VALUE_CONDITION_OPTIONS = [
  { label: 'Value Changed', value: 'value_change' },
  { label: 'Greater Than', value: 'gt' },
  { label: 'Less Than', value: 'lt' },
  { label: 'Greater Than or Equal', value: 'gte' },
  { label: 'Less Than or Equal', value: 'lte' },
  { label: 'Not Equal', value: 'ne' },
  { label: 'Equal', value: 'eq' },
];

// Section wrapper component for consistent styling
interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Section({ icon, title, children, className = '' }: SectionProps) {
  return (
    <div className={`rounded-lg border bg-card ${className}`}>
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

// Info box component
interface InfoBoxProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function InfoBox({ icon = <Info className="size-4" />, children, className = '' }: InfoBoxProps) {
  return (
    <div className={`flex gap-2 p-3 rounded-md bg-cyan-500/5 border-l-2 border-cyan-500/50 text-sm text-muted-foreground ${className}`}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>{children}</div>
    </div>
  );
}

// Multi-value input component for dynamic list entries
interface MultiValueInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  description?: string;
}

function MultiValueInput({ label, values, onChange, placeholder, description }: MultiValueInputProps) {
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setNewValue('');
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {/* Existing values as removable tags */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value, index) => (
            <div
              key={`${value}-${index}`}
              className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs font-mono"
            >
              <span className="max-w-[200px] truncate">{value}</span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${value}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Add new value input */}
      <div className="flex gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newValue.trim()}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function createEmptyConfigCheck(type: ConfigCheckType): Partial<ConfigCheck> {
  const baseCheck: Partial<ConfigCheck> = {
    name: '',
    description: '',
    type,
    alertLevel: 2, // Warning
    ackClearAlert: false,
    alertEffectiveIval: 0, // Never
    alertTransitionInterval: 0, // Always 0
  };

  // Set default script based on type
  switch (type) {
    case 'ignore':
      baseCheck.script = {
        format: 'arbitrary',
        diff_check: {
          ignore_line_with_regex: [],
          ignore_line_start_with: [],
          ignore_blank_lines: false,
          ignore_space: false,
          ignore_line_contain: [],
        },
      };
      break;
    case 'groovy':
      baseCheck.script = {
        format: 'arbitrary',
        groovy: '',
      };
      break;
    case 'fetch':
      baseCheck.script = {
        format: 'arbitrary',
        fetch_check: { fetch: 0 },
      };
      break;
    case 'missing':
      baseCheck.script = {
        format: 'arbitrary',
        value_check: {
          variable: '',
          must: [{ missing: {} }],
        },
      };
      break;
    case 'value':
      baseCheck.script = {
        format: 'arbitrary',
        value_check: {
          variable: '',
          must: [{ value_change: {} }],
        },
      };
      break;
  }

  return baseCheck;
}

// Helper to parse the condition from value_check.must
function parseValueCondition(must: ValueCheckConfig['must']): { conditionType: string; conditionValue: string } {
  if (!must || must.length === 0) {
    return { conditionType: 'value_change', conditionValue: '' };
  }

  const condition = must[0];
  if ('missing' in condition) {
    return { conditionType: 'missing', conditionValue: '' };
  }
  if ('value_change' in condition) {
    return { conditionType: 'value_change', conditionValue: '' };
  }
  if ('range' in condition) {
    const range = condition.range;
    const operators = ['gt', 'lt', 'gte', 'lte', 'ne', 'eq'] as const;
    for (const op of operators) {
      if (range[op] !== undefined) {
        return { conditionType: op, conditionValue: range[op] || '' };
      }
    }
  }
  return { conditionType: 'value_change', conditionValue: '' };
}

export function ConfigCheckEditorSheet({
  open,
  onOpenChange,
  configCheck,
  existingNames,
  onSave,
  isNew,
  initialType,
}: ConfigCheckEditorSheetProps) {
  const [formData, setFormData] = useState<Partial<ConfigCheck>>(createEmptyConfigCheck(initialType));
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // State for value check condition
  const [valueConditionType, setValueConditionType] = useState('value_change');
  const [valueConditionValue, setValueConditionValue] = useState('');
  
  // State for diff_check arrays (dynamic multi-value lists)
  const [ignoreRegexList, setIgnoreRegexList] = useState<string[]>([]);
  const [ignoreStartsWithList, setIgnoreStartsWithList] = useState<string[]>([]);
  const [ignoreContainsList, setIgnoreContainsList] = useState<string[]>([]);

  // Reset form when configCheck changes or dialog opens
  useEffect(() => {
    if (open) {
      if (configCheck) {
        setFormData({ ...createEmptyConfigCheck(configCheck.type || initialType), ...configCheck });
        
        // Parse value condition if applicable
        if ((configCheck.type === 'value' || configCheck.type === 'missing') && configCheck.script?.value_check) {
          const parsed = parseValueCondition(configCheck.script.value_check.must);
          setValueConditionType(parsed.conditionType);
          setValueConditionValue(parsed.conditionValue);
        }
        
        // Parse diff_check arrays
        if (configCheck.type === 'ignore' && configCheck.script?.diff_check) {
          const dc = configCheck.script.diff_check;
          setIgnoreRegexList(dc.ignore_line_with_regex || []);
          setIgnoreStartsWithList(dc.ignore_line_start_with || []);
          setIgnoreContainsList(dc.ignore_line_contain || []);
        } else {
          setIgnoreRegexList([]);
          setIgnoreStartsWithList([]);
          setIgnoreContainsList([]);
        }
      } else {
        setFormData(createEmptyConfigCheck(initialType));
        setValueConditionType('value_change');
        setValueConditionValue('');
        setIgnoreRegexList([]);
        setIgnoreStartsWithList([]);
        setIgnoreContainsList([]);
      }
      setErrors({});
    }
  }, [open, configCheck, initialType]);

  const handleFieldChange = <K extends keyof ConfigCheck>(field: K, value: ConfigCheck[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleTypeChange = (newType: ConfigCheckType) => {
    // Preserve common fields when switching types
    const preservedFields = {
      name: formData.name,
      description: formData.description,
      alertLevel: formData.alertLevel,
      ackClearAlert: formData.ackClearAlert,
      alertEffectiveIval: formData.alertEffectiveIval,
    };
    setFormData({ ...createEmptyConfigCheck(newType), ...preservedFields, type: newType });
    
    // Reset type-specific state
    setValueConditionType('value_change');
    setValueConditionValue('');
    setIgnoreRegexList([]);
    setIgnoreStartsWithList([]);
    setIgnoreContainsList([]);
  };

  const handleScriptChange = (groovyCode: string) => {
    setFormData(prev => ({
      ...prev,
      script: {
        ...(prev.script || { format: 'arbitrary' }),
        format: 'arbitrary',
        groovy: groovyCode,
      } as ConfigCheckScript,
    }));
  };

  const handleDiffCheckChange = (field: keyof DiffCheckConfig, value: boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      script: {
        ...(prev.script || { format: 'arbitrary' }),
        format: 'arbitrary',
        diff_check: {
          ...(prev.script?.diff_check || {}),
          [field]: value,
        },
      } as ConfigCheckScript,
    }));
  };

  const handleValueCheckVariableChange = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      script: {
        ...(prev.script || { format: 'arbitrary' }),
        format: 'arbitrary',
        value_check: {
          variable,
          must: prev.script?.value_check?.must || [{ value_change: {} }],
        },
      } as ConfigCheckScript,
    }));
  };

  const handleValueConditionChange = (conditionType: string, conditionValue: string = '') => {
    setValueConditionType(conditionType);
    setValueConditionValue(conditionValue);

    let must: ValueCheckConfig['must'];
    if (conditionType === 'value_change') {
      must = [{ value_change: {} }];
    } else if (conditionType === 'missing') {
      must = [{ missing: {} }];
    } else {
      must = [{ range: { [conditionType]: conditionValue } }];
    }

    setFormData(prev => ({
      ...prev,
      script: {
        ...(prev.script || { format: 'arbitrary' }),
        format: 'arbitrary',
        value_check: {
          variable: prev.script?.value_check?.variable || '',
          must,
        },
      } as ConfigCheckScript,
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name is required
    if (!formData.name?.trim()) {
      newErrors.name = 'Config check name is required';
    } else {
      const normalizedName = formData.name.trim().toLowerCase();
      const originalName = configCheck?.name?.toLowerCase();
      const isDuplicate = existingNames.some(
        name => name.toLowerCase() === normalizedName && name.toLowerCase() !== originalName
      );
      if (isDuplicate) {
        newErrors.name = 'A config check with this name already exists';
      }
    }

    // Type-specific validation
    if (formData.type === 'groovy') {
      if (!formData.script?.groovy?.trim()) {
        newErrors.groovy = 'Groovy script is required';
      }
    }

    if (formData.type === 'missing' || formData.type === 'value') {
      if (!formData.script?.value_check?.variable?.trim()) {
        newErrors.variable = 'Variable name is required';
      }
      
      // Range condition requires a value
      if (formData.type === 'value' && valueConditionType !== 'value_change' && !valueConditionValue.trim()) {
        newErrors.conditionValue = 'Condition value is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    // Build final script based on type
    let script: ConfigCheckScript = { format: 'arbitrary' };

    switch (formData.type) {
      case 'ignore': {
        script.diff_check = {
          ignore_line_with_regex: ignoreRegexList.filter(s => s.trim()),
          ignore_line_start_with: ignoreStartsWithList.filter(s => s.trim()),
          ignore_blank_lines: formData.script?.diff_check?.ignore_blank_lines ?? false,
          ignore_space: formData.script?.diff_check?.ignore_space ?? false,
          ignore_line_contain: ignoreContainsList.filter(s => s.trim()),
        };
        break;
      }
      case 'groovy':
        script.groovy = formData.script?.groovy || '';
        break;
      case 'fetch':
        script.fetch_check = { fetch: 0 };
        break;
      case 'missing':
        script.value_check = {
          variable: formData.script?.value_check?.variable || '',
          must: [{ missing: {} }],
        };
        break;
      case 'value': {
        let must: ValueCheckConfig['must'];
        if (valueConditionType === 'value_change') {
          must = [{ value_change: {} }];
        } else {
          must = [{ range: { [valueConditionType]: valueConditionValue } }];
        }
        script.value_check = {
          variable: formData.script?.value_check?.variable || '',
          must,
        };
        break;
      }
    }

    const savedConfigCheck: ConfigCheck = {
      // Preserve existing fields
      id: formData.id,
      configSourceId: formData.configSourceId,
      originId: formData.originId,
      // Form fields
      name: formData.name?.trim() || '',
      description: formData.description || '',
      type: formData.type as ConfigCheckType,
      alertLevel: formData.alertLevel ?? 2,
      ackClearAlert: formData.ackClearAlert ?? false,
      alertEffectiveIval: formData.alertEffectiveIval ?? 0,
      alertTransitionInterval: 0, // Always 0
      script,
    };

    onSave(savedConfigCheck);
    onOpenChange(false);
  };

  const currentType = formData.type || initialType;
  const typeInfo = CONFIG_CHECK_TYPE_OPTIONS.find(t => t.value === currentType);
  const isRangeCondition = valueConditionType !== 'value_change' && valueConditionType !== 'missing';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] max-w-[500px] flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <FileCheck className="size-5" />
            {isNew ? 'Add Config Check' : 'Edit Config Check'}
          </SheetTitle>
          <SheetDescription>
            {isNew ? 'Configure a new config check for this module.' : 'Modify the config check settings.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Basic Info Section */}
          <Section icon={<Info className="size-4 text-muted-foreground" />} title="Basic Information">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="e.g., ConfigChangeCheck"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Describe what this config check monitors..."
                  rows={2}
                />
              </div>

              {/* Type selector - only for new checks or allow type change */}
              <div className="space-y-2">
                <Label>Check Type</Label>
                <Select
                  value={currentType}
                  onValueChange={(val) => val && handleTypeChange(val as ConfigCheckType)}
                  disabled={!isNew}
                >
                  <SelectTrigger>
                    <SelectValue>{typeInfo?.label || 'Select type'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIG_CHECK_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          {opt.icon}
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typeInfo && (
                  <p className="text-xs text-muted-foreground">{typeInfo.description}</p>
                )}
                {!isNew && (
                  <p className="text-xs text-muted-foreground italic">
                    Check type cannot be changed after creation.
                  </p>
                )}
              </div>
            </div>
          </Section>

          {/* Type-specific configuration */}
          {currentType === 'ignore' && (
            <Section icon={<GitCompare className="size-4 text-muted-foreground" />} title="Change Exclusions">
              <div className="space-y-4">
                <InfoBox>
                  Configure which changes to ignore. Leave empty to alert on any change.
                </InfoBox>

                <MultiValueInput
                  label="Ignore lines matching regex"
                  values={ignoreRegexList}
                  onChange={setIgnoreRegexList}
                  placeholder="e.g., ^#.*"
                  description="Add regex patterns to exclude matching lines"
                />

                <MultiValueInput
                  label="Ignore lines starting with"
                  values={ignoreStartsWithList}
                  onChange={setIgnoreStartsWithList}
                  placeholder="e.g., #"
                  description="Add prefixes to exclude lines that start with them"
                />

                <MultiValueInput
                  label="Ignore lines containing"
                  values={ignoreContainsList}
                  onChange={setIgnoreContainsList}
                  placeholder="e.g., timestamp"
                  description="Add strings to exclude lines containing them"
                />

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Ignore blank lines</Label>
                      <p className="text-xs text-muted-foreground">Skip blank line differences</p>
                    </div>
                    <Switch
                      checked={formData.script?.diff_check?.ignore_blank_lines ?? false}
                      onCheckedChange={(checked) => handleDiffCheckChange('ignore_blank_lines', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Ignore whitespace changes</Label>
                      <p className="text-xs text-muted-foreground">Skip spacing differences</p>
                    </div>
                    <Switch
                      checked={formData.script?.diff_check?.ignore_space ?? false}
                      onCheckedChange={(checked) => handleDiffCheckChange('ignore_space', checked)}
                    />
                  </div>
                </div>
              </div>
            </Section>
          )}

          {currentType === 'groovy' && (
            <Section icon={<FileCode className="size-4 text-muted-foreground" />} title="Groovy Script">
              <div className="space-y-4">
                <InfoBox icon={<FileCode className="size-4" />}>
                  The <code className="font-mono text-xs bg-muted px-1 rounded">config</code> variable contains the configuration content. Return <code className="font-mono text-xs bg-muted px-1 rounded">1</code> to trigger alert, <code className="font-mono text-xs bg-muted px-1 rounded">0</code> for no alert.
                </InfoBox>

                <div className="space-y-2">
                  <Label htmlFor="groovyScript" className="flex items-center gap-1">
                    Script <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="groovyScript"
                    value={formData.script?.groovy || ''}
                    onChange={(e) => handleScriptChange(e.target.value)}
                    placeholder={`if (config.contains("error")) {\n    println config;\n    return 1;\n} else {\n    return 0;\n}`}
                    rows={10}
                    className={`font-mono text-sm ${errors.groovy ? 'border-destructive' : ''}`}
                  />
                  {errors.groovy && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.groovy}
                    </p>
                  )}
                </div>
              </div>
            </Section>
          )}

          {currentType === 'fetch' && (
            <Section icon={<Download className="size-4 text-muted-foreground" />} title="Retrieval Check">
              <InfoBox>
                This check will alert when the configuration cannot be retrieved from the device.
                No additional configuration is required.
              </InfoBox>
            </Section>
          )}

          {currentType === 'missing' && (
            <Section icon={<Variable className="size-4 text-muted-foreground" />} title="Missing Field Check">
              <div className="space-y-4">
                <InfoBox>
                  Alert when the specified field is missing from the configuration.
                </InfoBox>

                <div className="space-y-2">
                  <Label htmlFor="variable" className="flex items-center gap-1">
                    Field Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="variable"
                    value={formData.script?.value_check?.variable || ''}
                    onChange={(e) => handleValueCheckVariableChange(e.target.value)}
                    placeholder="e.g., hostname"
                    className={errors.variable ? 'border-destructive' : ''}
                  />
                  {errors.variable && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.variable}
                    </p>
                  )}
                </div>
              </div>
            </Section>
          )}

          {currentType === 'value' && (
            <Section icon={<Filter className="size-4 text-muted-foreground" />} title="Value Check">
              <div className="space-y-4">
                <InfoBox>
                  Check a field&apos;s value for changes or specific conditions.
                </InfoBox>

                <div className="space-y-2">
                  <Label htmlFor="variable" className="flex items-center gap-1">
                    Field Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="variable"
                    value={formData.script?.value_check?.variable || ''}
                    onChange={(e) => handleValueCheckVariableChange(e.target.value)}
                    placeholder="e.g., version"
                    className={errors.variable ? 'border-destructive' : ''}
                  />
                  {errors.variable && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.variable}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={valueConditionType}
                    onValueChange={(val) => val && handleValueConditionChange(val, valueConditionValue)}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {VALUE_CONDITION_OPTIONS.find(opt => opt.value === valueConditionType)?.label || 'Select condition'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {VALUE_CONDITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isRangeCondition && (
                  <div className="space-y-2">
                    <Label htmlFor="conditionValue" className="flex items-center gap-1">
                      Value <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="conditionValue"
                      value={valueConditionValue}
                      onChange={(e) => {
                        setValueConditionValue(e.target.value);
                        handleValueConditionChange(valueConditionType, e.target.value);
                      }}
                      placeholder="e.g., 100"
                      className={errors.conditionValue ? 'border-destructive' : ''}
                    />
                    {errors.conditionValue && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {errors.conditionValue}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Alert Settings Section */}
          <Section icon={<Bell className="size-4 text-muted-foreground" />} title="Alert Settings">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Alert Level</Label>
                <Select
                  value={String(formData.alertLevel ?? 2)}
                  onValueChange={(val) => val && handleFieldChange('alertLevel', parseInt(val, 10))}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {ALERT_LEVEL_OPTIONS.find(opt => opt.value === (formData.alertLevel ?? 2))?.label || 'Select level'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_LEVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        <div className="flex items-center gap-2">
                          {opt.value === 2 && <WarningAlertIcon className="size-4" />}
                          {opt.value === 3 && <ErrorAlertIcon className="size-4" />}
                          {opt.value === 4 && <CriticalAlertIcon className="size-4" />}
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Clear on Acknowledgement</Label>
                  <p className="text-xs text-muted-foreground">Auto-clear alert when acknowledged</p>
                </div>
                <Switch
                  checked={formData.ackClearAlert ?? false}
                  onCheckedChange={(checked) => handleFieldChange('ackClearAlert', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alertEffectiveIval">Clear After (minutes)</Label>
                <Input
                  id="alertEffectiveIval"
                  type="number"
                  min={0}
                  value={formData.alertEffectiveIval ?? 0}
                  onChange={(e) => handleFieldChange('alertEffectiveIval', parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  {(formData.alertEffectiveIval ?? 0) === 0 ? 'Alert will never auto-clear' : `Alert will clear after ${formData.alertEffectiveIval} minutes`}
                </p>
              </div>
            </div>
          </Section>

          {/* Advanced options note */}
          <InfoBox>
            For advanced config check options, visit the module page in your LogicMonitor portal.
          </InfoBox>
        </div>

        <SheetFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isNew ? 'Add Config Check' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
