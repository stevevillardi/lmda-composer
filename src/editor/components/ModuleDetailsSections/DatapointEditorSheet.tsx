import { useState, useMemo, useEffect } from 'react';
import { AlertCircle, Info, Database, Bell, Sliders, FileText, Calculator, Terminal, Clock, Gauge } from 'lucide-react';
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
import type { DataPoint } from '@/shared/types';

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

  // Title based on type and new/edit state
  const sheetTitle = useMemo(() => {
    if (!isNew) {
      return `Edit: ${datapoint?.name || 'Datapoint'}`;
    }
    return isComplex ? 'Add Complex Datapoint' : 'Add Normal Datapoint';
  }, [isNew, isComplex, datapoint?.name]);

  const sheetDescription = useMemo(() => {
    if (isComplex) {
      return 'Create a calculated datapoint using an expression that references other datapoints.';
    }
    return 'Create a datapoint that extracts values from script output, exit code, or response time.';
  }, [isComplex]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col overflow-hidden p-0">
        <SheetHeader className="shrink-0 border-b p-4">
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Advanced options disclaimer */}
          <div className="flex items-start gap-3 rounded-lg border-l-4 border-blue-500 bg-blue-500/10 p-3">
            <Info className="size-4 text-blue-500 mt-0.5 shrink-0" />
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
                <p className="text-xs text-destructive flex items-center gap-1">
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
                  className={`font-mono text-sm ${errors.postProcessorParam ? 'border-destructive' : ''}`}
                />
                {errors.postProcessorParam && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.postProcessorParam}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Reference other datapoints by name. Supports mathematical operations and functions.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
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
                        className={`font-mono text-sm ${errors.postProcessorParam ? 'border-destructive' : ''}`}
                      />
                    ) : (
                      <Input
                        id="dp-param"
                        value={formData.postProcessorParam || ''}
                        onChange={(e) => handleFieldChange('postProcessorParam', e.target.value)}
                        placeholder={getInterpretationParamPlaceholder(formData.postProcessorMethod || '')}
                        className={errors.postProcessorParam ? 'border-destructive' : ''}
                      />
                    )}
                    {errors.postProcessorParam && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {errors.postProcessorParam}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Info for Exit Code / Response Time - no additional fields needed */}
              {isExitCodeOrResponseTime && (
                <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  {formData.rawDataFieldName === 'exitCode' ? (
                    <Terminal className="size-4 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="size-4 mt-0.5 shrink-0" />
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
                          className={`text-xs font-mono gap-1 ${ALERT_LEVEL_BG_STYLES[t.level]}`}
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
                  <SelectTrigger id="dp-trigger-interval" className="h-8 text-xs">
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
        </div>

        <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t p-4 mt-0">
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
