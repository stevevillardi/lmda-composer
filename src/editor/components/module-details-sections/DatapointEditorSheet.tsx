import { useState, useMemo, useEffect } from 'react';
import { AlertCircle, Info, Database, Bell, Sliders, FileText, Calculator, Terminal, Clock, Gauge, Tags, Plus, Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { parseAlertThresholds, ALERT_LEVEL_BG_STYLES, type AlertLevel } from '@/shared/alert-threshold-utils';
import { WarningAlertIcon, ErrorAlertIcon, CriticalAlertIcon } from '../../constants/icons';
import type { DataPoint, StatusDisplayName } from '@/shared/types';

/** Type of datapoint being created/edited */
export type DatapointType = 'normal' | 'complex';

interface DatapointEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datapoint: Partial<DataPoint> | null;
  existingNames: string[];
  onSave: (datapoint: DataPoint) => void;
  isNew: boolean;
  /** Type of datapoint - determines which fields are shown */
  datapointType: DatapointType;
}

// Metric type options
const METRIC_TYPE_OPTIONS = [
  { label: 'Counter', value: 1 },
  { label: 'Gauge', value: 2 },
  { label: 'Derive', value: 3 },
];

// Raw data field options (Datapoint Source for Normal type)
const DATAPOINT_SOURCE_OPTIONS = [
  { label: 'Script Output', value: 'output', description: 'Parse value from script output' },
  { label: 'Exit Code', value: 'exitCode', description: 'Use script exit code as value' },
  { label: 'Response Time', value: 'responseTime', description: 'Use script execution time' },
];

// Post processor method options (only for output source)
const INTERPRETATION_METHOD_OPTIONS = [
  { label: 'Name=Value Pair', value: 'namevalue' },
  { label: 'JSON Path', value: 'json' },
  { label: 'Regex', value: 'regex' },
  { label: 'CSV (Column Index)', value: 'csv' },
  { label: 'TSV (Column Index)', value: 'tsv' },
  { label: 'XPath', value: 'xpath' },
  { label: 'Text Match', value: 'textmatch' },
  { label: 'Groovy Script', value: 'groovy' },
];

// Alert for no data options
const ALERT_NO_DATA_OPTIONS = [
  { label: 'No Alert', value: 1 },
  { label: 'Warning', value: 2 },
  { label: 'Error', value: 3 },
  { label: 'Critical', value: 4 },
];

// Alert transition interval options (poll cycles)
const ALERT_INTERVAL_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '1 poll', value: 1 },
  { label: '2 polls', value: 2 },
  { label: '3 polls', value: 3 },
  { label: '4 polls', value: 4 },
  { label: '5 polls', value: 5 },
  { label: '6 polls', value: 6 },
  { label: '7 polls', value: 7 },
  { label: '8 polls', value: 8 },
  { label: '9 polls', value: 9 },
  { label: '10 polls', value: 10 },
  { label: '20 polls', value: 20 },
  { label: '24 polls', value: 24 },
  { label: '30 polls', value: 30 },
  { label: '60 polls', value: 60 },
];

// Status translation operator options
const STATUS_OPERATOR_OPTIONS: Array<{ label: string; value: StatusDisplayName['operator'] }> = [
  { label: '=', value: 'EQ' },
  { label: '≠', value: 'NE' },
  { label: '>', value: 'GT' },
  { label: '≥', value: 'GTE' },
  { label: '<', value: 'LT' },
  { label: '≤', value: 'LTE' },
];

// Alert level icon components
const ALERT_LEVEL_ICONS: Record<AlertLevel, React.ComponentType<{ className?: string }>> = {
  warning: WarningAlertIcon,
  error: ErrorAlertIcon,
  critical: CriticalAlertIcon,
};

// Section wrapper component for consistent styling
interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Section({ icon, title, children, className = '' }: SectionProps) {
  return (
    <div className={`
      rounded-lg border bg-card
      ${className}
    `}>
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-4 p-4">
        {children}
      </div>
    </div>
  );
}

function getInterpretationParamLabel(method: string): string {
  switch (method) {
    case 'namevalue':
      return 'Output Key';
    case 'json':
      return 'JSON Path';
    case 'regex':
      return 'Regex Pattern';
    case 'csv':
    case 'tsv':
      return 'Column Index';
    case 'xpath':
      return 'XPath';
    case 'textmatch':
      return 'Match Pattern';
    case 'groovy':
      return 'Groovy Script';
    default:
      return 'Parameter';
  }
}

function getInterpretationParamPlaceholder(method: string): string {
  switch (method) {
    case 'namevalue':
      return 'e.g., CPUBusyPercent';
    case 'json':
      return 'e.g., $.data.value';
    case 'regex':
      return 'e.g., value=(\\d+)';
    case 'csv':
    case 'tsv':
      return 'e.g., 0 (zero-indexed)';
    case 'xpath':
      return 'e.g., //element/@attribute';
    case 'textmatch':
      return 'e.g., .*pattern.*';
    case 'groovy':
      return 'Groovy script code';
    default:
      return '';
  }
}

function createEmptyDatapoint(datapointType: DatapointType): Partial<DataPoint> {
  if (datapointType === 'complex') {
    return {
      name: '',
      description: '',
      type: 2, // Gauge is most common
      dataType: 7,
      maxDigits: 4,
      postProcessorMethod: 'expression',
      postProcessorParam: '',
      rawDataFieldName: '', // Empty for expression
      minValue: '',
      maxValue: '',
      alertForNoData: 1,
      alertExpr: '',
      alertExprNote: '',
      alertSubject: '',
      alertBody: '',
      alertTransitionInterval: 0,
      alertClearTransitionInterval: 0,
    };
  }
  
  // Normal datapoint defaults
  return {
    name: '',
    description: '',
    type: 2, // Gauge is most common
    dataType: 7,
    maxDigits: 4,
    postProcessorMethod: 'namevalue',
    postProcessorParam: '',
    rawDataFieldName: 'output',
    minValue: '',
    maxValue: '',
    alertForNoData: 1,
    alertExpr: '',
    alertExprNote: '',
    alertSubject: '',
    alertBody: '',
    alertTransitionInterval: 0,
    alertClearTransitionInterval: 0,
  };
}

export function DatapointEditorSheet({
  open,
  onOpenChange,
  datapoint,
  existingNames,
  onSave,
  isNew,
  datapointType,
}: DatapointEditorSheetProps) {
  const [formData, setFormData] = useState<Partial<DataPoint>>(createEmptyDatapoint(datapointType));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when datapoint changes or dialog opens
  useEffect(() => {
    if (open) {
      if (datapoint) {
        setFormData({ ...createEmptyDatapoint(datapointType), ...datapoint });
      } else {
        setFormData(createEmptyDatapoint(datapointType));
      }
      setErrors({});
    }
  }, [open, datapoint, datapointType]);

  // Derived state
  const isComplex = datapointType === 'complex';
  const isOutputSource = formData.rawDataFieldName === 'output';
  const isExitCodeOrResponseTime = formData.rawDataFieldName === 'exitCode' || formData.rawDataFieldName === 'responseTime';
  const requiresInterpretationParam = isOutputSource && formData.postProcessorMethod !== 'none';

  // Handle datapoint source change for Normal type
  const handleSourceChange = (source: string) => {
    if (source === 'exitCode' || source === 'responseTime') {
      // Lock to Gauge type, method=none, no param
      setFormData(prev => ({
        ...prev,
        rawDataFieldName: source,
        type: 2, // Gauge
        postProcessorMethod: 'none',
        postProcessorParam: '',
      }));
    } else {
      // Script Output - enable full options
      setFormData(prev => ({
        ...prev,
        rawDataFieldName: source,
        postProcessorMethod: prev.postProcessorMethod === 'none' ? 'namevalue' : prev.postProcessorMethod,
      }));
    }
  };

  // Handle interpretation method change
  const handleMethodChange = (method: string) => {
    setFormData(prev => ({
      ...prev,
      postProcessorMethod: method,
    }));
  };

  const handleFieldChange = (field: keyof DataPoint, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Status translation handlers
  const statusTranslations = formData.statusDisplayNames ?? [];

  const handleAddTranslation = () => {
    const newTranslation: StatusDisplayName = {
      statusDisplayName: '',
      operator: 'EQ',
      metricValue: '',
    };
    setFormData(prev => ({
      ...prev,
      statusDisplayNames: [...(prev.statusDisplayNames ?? []), newTranslation],
    }));
  };

  const handleUpdateTranslation = (index: number, field: keyof StatusDisplayName, value: string) => {
    // Enforce character limit for display name
    if (field === 'statusDisplayName' && value.length > 128) {
      value = value.slice(0, 128);
    }
    
    setFormData(prev => {
      const updated = [...(prev.statusDisplayNames ?? [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, statusDisplayNames: updated };
    });
    
    // Clear error for this translation if it exists
    const errorKey = `statusTranslation_${index}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };

  const handleDeleteTranslation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      statusDisplayNames: (prev.statusDisplayNames ?? []).filter((_, i) => i !== index),
    }));
    // Clear any errors for deleted translation
    setErrors(prev => {
      const next = { ...prev };
      // Remove errors for this index and re-index remaining errors
      Object.keys(next).forEach(key => {
        if (key.startsWith('statusTranslation_')) {
          delete next[key];
        }
      });
      return next;
    });
  };

  // Helper to check if a value is a valid integer
  const isValidInteger = (value: string): boolean => {
    if (!value.trim()) return false;
    // Allow negative integers
    return /^-?\d+$/.test(value.trim());
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name is required
    if (!formData.name?.trim()) {
      newErrors.name = 'Datapoint name is required';
    } else {
      const normalizedName = formData.name.trim().toLowerCase();
      const originalName = datapoint?.name?.toLowerCase();
      const isDuplicate = existingNames.some(
        name => name.toLowerCase() === normalizedName && name.toLowerCase() !== originalName
      );
      if (isDuplicate) {
        newErrors.name = 'A datapoint with this name already exists';
      }
    }

    // Expression is required for complex datapoints
    if (isComplex && !formData.postProcessorParam?.trim()) {
      newErrors.postProcessorParam = 'Expression is required';
    }

    // Interpretation param is required for output source with a method
    if (!isComplex && isOutputSource && requiresInterpretationParam && !formData.postProcessorParam?.trim()) {
      newErrors.postProcessorParam = `${getInterpretationParamLabel(formData.postProcessorMethod || '')} is required`;
    }

    // Validate status translations
    statusTranslations.forEach((translation, index) => {
      const errorMessages: string[] = [];
      
      // Validate metric value is a valid integer
      if (translation.metricValue && !isValidInteger(translation.metricValue)) {
        errorMessages.push('Value must be an integer');
      }
      
      // Validate display name length (should already be enforced, but double-check)
      if (translation.statusDisplayName && translation.statusDisplayName.length > 128) {
        errorMessages.push('Display name max 128 characters');
      }
      
      // Check for empty required fields if any field is filled
      const hasAnyValue = translation.metricValue || translation.statusDisplayName;
      if (hasAnyValue) {
        if (!translation.metricValue) {
          errorMessages.push('Value is required');
        }
        if (!translation.statusDisplayName?.trim()) {
          errorMessages.push('Display name is required');
        }
      }
      
      if (errorMessages.length > 0) {
        newErrors[`statusTranslation_${index}`] = errorMessages.join('; ');
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const savedDatapoint: DataPoint = {
      // Preserve existing fields
      id: formData.id,
      dataSourceId: formData.dataSourceId,
      originId: formData.originId,
      enableAnomalyAlertSuppression: formData.enableAnomalyAlertSuppression || '',
      adAdvSettingEnabled: formData.adAdvSettingEnabled ?? false,
      warnAdAdvSetting: formData.warnAdAdvSetting || '',
      errorAdAdvSetting: formData.errorAdAdvSetting || '',
      criticalAdAdvSetting: formData.criticalAdAdvSetting || '',
      userParam1: formData.userParam1 || '',
      userParam2: formData.userParam2 || '',
      userParam3: formData.userParam3 || '',
      statusDisplayNames: formData.statusDisplayNames || [],
      // Editable fields
      name: formData.name?.trim() || '',
      description: formData.description || '',
      type: isComplex ? 2 : (formData.type ?? 2), // Complex datapoints are always Gauge (2)
      dataType: 7,
      maxDigits: 4,
      postProcessorMethod: isComplex ? 'expression' : (formData.postProcessorMethod || 'none'),
      postProcessorParam: formData.postProcessorParam || '',
      rawDataFieldName: isComplex ? '' : (formData.rawDataFieldName || ''),
      minValue: formData.minValue || '',
      maxValue: formData.maxValue || '',
      alertForNoData: formData.alertForNoData ?? 1,
      alertExpr: formData.alertExpr || '',
      alertExprNote: formData.alertExprNote || '',
      alertSubject: formData.alertSubject || '',
      alertBody: formData.alertBody || '',
      alertTransitionInterval: formData.alertTransitionInterval ?? 0,
      alertClearTransitionInterval: formData.alertClearTransitionInterval ?? 0,
    };

    onSave(savedDatapoint);
    onOpenChange(false);
  };

  // Memoized labels
  const selectedMetricTypeLabel = useMemo(() => {
    return METRIC_TYPE_OPTIONS.find(opt => opt.value === formData.type)?.label || 'Select type';
  }, [formData.type]);

  const selectedSourceLabel = useMemo(() => {
    return DATAPOINT_SOURCE_OPTIONS.find(opt => opt.value === formData.rawDataFieldName)?.label || 'Select source';
  }, [formData.rawDataFieldName]);

  const selectedMethodLabel = useMemo(() => {
    return INTERPRETATION_METHOD_OPTIONS.find(opt => opt.value === formData.postProcessorMethod)?.label || 'Select method';
  }, [formData.postProcessorMethod]);

  const selectedAlertNoDataLabel = useMemo(() => {
    return ALERT_NO_DATA_OPTIONS.find(opt => opt.value === formData.alertForNoData)?.label || 'Select';
  }, [formData.alertForNoData]);

  const selectedTriggerIntervalLabel = useMemo(() => {
    return ALERT_INTERVAL_OPTIONS.find(opt => opt.value === formData.alertTransitionInterval)?.label || 'Select';
  }, [formData.alertTransitionInterval]);

  const selectedClearIntervalLabel = useMemo(() => {
    return ALERT_INTERVAL_OPTIONS.find(opt => opt.value === formData.alertClearTransitionInterval)?.label || 'Select';
  }, [formData.alertClearTransitionInterval]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="
        flex w-[500px] max-w-[500px] flex-col overflow-hidden p-0
      ">
        <SheetHeader className="shrink-0 border-b p-4">
        <SheetTitle className="flex items-center gap-2">
            <Database className="size-5" />
            {isNew ? 'Add Datapoint' : 'Edit Datapoint'}
          </SheetTitle>
          <SheetDescription>
            {isNew ? 'Configure a new datapoint for this module.' : 'Modify the datapoint settings.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Advanced options disclaimer */}
          <div className="
            flex items-start gap-3 rounded-lg border-l-4 border-cyan-500
            bg-cyan-500/10 p-3
          ">
            <Info className="mt-0.5 size-4 shrink-0 text-cyan-500" />
            <p className="text-sm text-muted-foreground">
              Some advanced options (dynamic thresholds, anomaly detection) are not shown. 
              Edit in Portal for full control.
            </p>
          </div>

          {/* Basic Info Section */}
          <Section icon={<FileText className="size-4 text-muted-foreground" />} title="Basic Info">
            <div className="space-y-2">
              <Label htmlFor="dp-name">
                Datapoint Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dp-name"
                value={formData.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="e.g., CPUBusyPercent"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dp-description">Description</Label>
              <Textarea
                id="dp-description"
                value={formData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Describe what this datapoint measures"
                rows={2}
              />
            </div>
          </Section>

          {/* Data Source Section - Different for Normal vs Complex */}
          {isComplex ? (
            // Complex Datapoint: Expression
            <Section icon={<Calculator className="size-4 text-muted-foreground" />} title="Expression">
              <div className="space-y-2">
                <Label htmlFor="dp-expression">
                  Expression <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="dp-expression"
                  value={formData.postProcessorParam || ''}
                  onChange={(e) => handleFieldChange('postProcessorParam', e.target.value)}
                  placeholder="e.g., max(100 - (PercentProcessorTime * 100 / Frequency_Sys100NS), 0)"
                  rows={4}
                  className={`
                    font-mono text-sm
                    ${errors.postProcessorParam ? `border-destructive` : ''}
                  `}
                />
                {errors.postProcessorParam && (
                  <p className="
                    flex items-center gap-1 text-xs text-destructive
                  ">
                    <AlertCircle className="size-3" />
                    {errors.postProcessorParam}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Reference other datapoints by name. Supports mathematical operations and functions.
                </p>
              </div>

              <div className="
                flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm
                text-muted-foreground
              ">
                <Gauge className="size-4" />
                <span>Complex datapoints are always Gauge type.</span>
              </div>
            </Section>
          ) : (
            // Normal Datapoint: Source-driven fields
            <Section icon={<Database className="size-4 text-muted-foreground" />} title="Data Source">
              <div className="space-y-2">
                <Label htmlFor="dp-source">
                  Datapoint Source <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.rawDataFieldName || 'output'}
                  onValueChange={(value) => value && handleSourceChange(value)}
                >
                  <SelectTrigger id="dp-source">
                    <SelectValue>{selectedSourceLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DATAPOINT_SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show these fields only for Script Output source */}
              {isOutputSource && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="dp-type">Metric Type</Label>
                    <Select
                      value={String(formData.type ?? 2)}
                      onValueChange={(value) => value && handleFieldChange('type', parseInt(value, 10))}
                    >
                      <SelectTrigger id="dp-type">
                        <SelectValue>{selectedMetricTypeLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {METRIC_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dp-method">
                      Interpretation Method <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.postProcessorMethod || 'namevalue'}
                      onValueChange={(value) => value && handleMethodChange(value)}
                    >
                      <SelectTrigger id="dp-method">
                        <SelectValue>{selectedMethodLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {INTERPRETATION_METHOD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Interpretation parameter */}
                  <div className="space-y-2">
                    <Label htmlFor="dp-param">
                      {getInterpretationParamLabel(formData.postProcessorMethod || '')}
                      <span className="text-destructive"> *</span>
                    </Label>
                    {formData.postProcessorMethod === 'groovy' ? (
                      <Textarea
                        id="dp-param"
                        value={formData.postProcessorParam || ''}
                        onChange={(e) => handleFieldChange('postProcessorParam', e.target.value)}
                        placeholder={getInterpretationParamPlaceholder(formData.postProcessorMethod || '')}
                        rows={3}
                        className={`
                          font-mono text-sm
                          ${errors.postProcessorParam ? `border-destructive` : ''}
                        `}
                      />
                    ) : (
                      <Input
                        id="dp-param"
                        value={formData.postProcessorParam || ''}
                        onChange={(e) => handleFieldChange('postProcessorParam', e.target.value)}
                        placeholder={getInterpretationParamPlaceholder(formData.postProcessorMethod || '')}
                        className={errors.postProcessorParam ? `
                          border-destructive
                        ` : ''}
                      />
                    )}
                    {errors.postProcessorParam && (
                      <p className="
                        flex items-center gap-1 text-xs text-destructive
                      ">
                        <AlertCircle className="size-3" />
                        {errors.postProcessorParam}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Info for Exit Code / Response Time - no additional fields needed */}
              {isExitCodeOrResponseTime && (
                <div className="
                  flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2
                  text-sm text-muted-foreground
                ">
                  {formData.rawDataFieldName === 'exitCode' ? (
                    <Terminal className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <Clock className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>
                    {formData.rawDataFieldName === 'exitCode' 
                      ? 'The script exit code will be used as the datapoint value. Type is locked to Gauge.'
                      : 'The script execution time (in milliseconds) will be used as the datapoint value. Type is locked to Gauge.'
                    }
                  </span>
                </div>
              )}
            </Section>
          )}

          {/* Value Range Section */}
          <Section icon={<Sliders className="size-4 text-muted-foreground" />} title="Value Range">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dp-min">Min Value</Label>
                <Input
                  id="dp-min"
                  value={formData.minValue || ''}
                  onChange={(e) => handleFieldChange('minValue', e.target.value)}
                  placeholder="No minimum"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dp-max">Max Value</Label>
                <Input
                  id="dp-max"
                  value={formData.maxValue || ''}
                  onChange={(e) => handleFieldChange('maxValue', e.target.value)}
                  placeholder="No maximum"
                />
              </div>
            </div>
          </Section>

          {/* Alerting Section */}
          <Section icon={<Bell className="size-4 text-muted-foreground" />} title="Alerting">
            <div className="space-y-2">
              <Label htmlFor="dp-alert-expr">Alert Threshold</Label>
              <Input
                id="dp-alert-expr"
                value={formData.alertExpr || ''}
                onChange={(e) => handleFieldChange('alertExpr', e.target.value)}
                placeholder="e.g., > 60 80 90"
              />
              <p className="text-xs text-muted-foreground">
                Format: operator warn error critical (e.g., "&gt; 60 80 90" or "&gt;= 90 95")
              </p>
              
              {/* Live Threshold Visualizer */}
              {(() => {
                const thresholds = parseAlertThresholds(formData.alertExpr);
                if (!thresholds || thresholds.length === 0) return null;
                return (
                  <div className="flex items-center gap-1.5 pt-1">
                    {thresholds.map((t) => {
                      const AlertIcon = ALERT_LEVEL_ICONS[t.level];
                      return (
                        <Badge
                          key={`${t.level}-${t.value}`}
                          variant="outline"
                          className={`
                            gap-1 font-mono text-xs
                            ${ALERT_LEVEL_BG_STYLES[t.level]}
                          `}
                        >
                          <AlertIcon className="size-3" />
                          {t.operator}{t.value}
                        </Badge>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Compact 3-column layout for alert timing */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dp-trigger-interval" className="text-xs">Trigger After</Label>
                <Select
                  value={String(formData.alertTransitionInterval ?? 0)}
                  onValueChange={(value) => value && handleFieldChange('alertTransitionInterval', parseInt(value, 10))}
                >
                  <SelectTrigger id="dp-trigger-interval" className="
                    h-8 text-xs
                  ">
                    <SelectValue>{selectedTriggerIntervalLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dp-clear-interval" className="text-xs">Clear After</Label>
                <Select
                  value={String(formData.alertClearTransitionInterval ?? 0)}
                  onValueChange={(value) => value && handleFieldChange('alertClearTransitionInterval', parseInt(value, 10))}
                >
                  <SelectTrigger id="dp-clear-interval" className="h-8 text-xs">
                    <SelectValue>{selectedClearIntervalLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dp-no-data" className="text-xs">No Data</Label>
                <Select
                  value={String(formData.alertForNoData ?? 1)}
                  onValueChange={(value) => value && handleFieldChange('alertForNoData', parseInt(value, 10))}
                >
                  <SelectTrigger id="dp-no-data" className="h-8 text-xs">
                    <SelectValue>{selectedAlertNoDataLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_NO_DATA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dp-alert-subject">Alert Subject</Label>
              <Input
                id="dp-alert-subject"
                value={formData.alertSubject || ''}
                onChange={(e) => handleFieldChange('alertSubject', e.target.value)}
                placeholder="Optional alert subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dp-alert-body">Alert Body</Label>
              <Textarea
                id="dp-alert-body"
                value={formData.alertBody || ''}
                onChange={(e) => handleFieldChange('alertBody', e.target.value)}
                placeholder="Optional alert body message. Supports ##TOKEN## substitution."
                rows={3}
              />
            </div>
          </Section>

          {/* Status Translations Section */}
          <Section icon={<Tags className="size-4 text-muted-foreground" />} title="Status Translations">
            <p className="text-xs text-muted-foreground">
              Map numeric values to human-readable status labels (e.g., 1 = "Up", 0 = "Down").
            </p>

            {statusTranslations.length > 0 && (
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[60px_70px_1fr_32px] items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
                  <span>Operator</span>
                  <span>Value</span>
                  <span>Display Name</span>
                  <span></span>
                </div>

                {/* Translation rows */}
                {statusTranslations.map((translation, index) => {
                  const rowError = errors[`statusTranslation_${index}`];
                  const hasValueError = rowError?.includes('Value');
                  const hasNameError = rowError?.includes('Display name') || rowError?.includes('128');
                  
                  return (
                    <div key={translation.id ?? `new-${index}`} className="space-y-1">
                      <div className="grid grid-cols-[60px_70px_1fr_32px] items-center gap-2">
                        <Select
                          value={translation.operator}
                          onValueChange={(value) => value && handleUpdateTranslation(index, 'operator', value)}
                        >
                          <SelectTrigger className="h-8 px-2 text-xs">
                            <SelectValue>
                              {STATUS_OPERATOR_OPTIONS.find(o => o.value === translation.operator)?.label ?? '='}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPERATOR_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className="font-mono">{opt.label}</span>
                                <span className="ml-2 text-xs text-muted-foreground">({opt.value})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="text"
                          inputMode="numeric"
                          value={translation.metricValue}
                          onChange={(e) => handleUpdateTranslation(index, 'metricValue', e.target.value)}
                          placeholder="0"
                          className={`h-8 px-2 font-mono text-xs ${hasValueError ? 'border-destructive' : ''}`}
                        />

                        <Input
                          type="text"
                          value={translation.statusDisplayName}
                          onChange={(e) => handleUpdateTranslation(index, 'statusDisplayName', e.target.value)}
                          placeholder="e.g., Up, Down, Unknown"
                          maxLength={128}
                          className={`h-8 px-2 text-xs ${hasNameError ? 'border-destructive' : ''}`}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteTranslation(index)}
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="Remove translation"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      {rowError && (
                        <p className="flex items-center gap-1 pl-[68px] text-[10px] text-destructive">
                          <AlertCircle className="size-2.5" />
                          {rowError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTranslation}
              className="w-full gap-1.5"
            >
              <Plus className="size-3.5" />
              Add Translation
            </Button>
          </Section>
        </div>

        <SheetFooter className="
          mt-0 shrink-0 flex-row justify-end gap-2 border-t p-4
        ">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isNew ? 'Add Datapoint' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
