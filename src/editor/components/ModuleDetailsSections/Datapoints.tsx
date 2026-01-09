import { useState, useMemo, Fragment } from 'react';
import { Database, ExternalLink, Plus, Pencil, Trash2, ChevronRight, ChevronDown, Bell, BellOff, Mail, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { DatapointEditorSheet, type DatapointType } from './DatapointEditorSheet';
import { buildPortalEditUrl } from '@/shared/module-type-schemas';
import { useEditorStore } from '../../stores/editor-store';
import { parseAlertThresholds, ALERT_LEVEL_BG_STYLES, type AlertLevel } from '@/shared/alert-threshold-utils';
import { GaugeIcon, CounterIcon, DeriveIcon, ExpressionIcon, OutputIcon, WarningAlertIcon, ErrorAlertIcon, CriticalAlertIcon } from '../../constants/icons';
import { cn } from '@/lib/utils';
import type { LogicModuleType, DataPoint } from '@/shared/types';

interface ModuleDetailsDatapointsProps {
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
}

// Alert for no data labels
const ALERT_NO_DATA_LABELS: Record<number, string> = {
  1: 'No Alert',
  2: 'Warning',
  3: 'Error',
  4: 'Critical',
};

// Metric type icon components
const METRIC_TYPE_ICONS: Record<number, React.ComponentType<{ className?: string }>> = {
  1: CounterIcon,
  2: GaugeIcon,
  3: DeriveIcon,
};

// Alert level icon components
const ALERT_LEVEL_ICONS: Record<AlertLevel, React.ComponentType<{ className?: string }>> = {
  warning: WarningAlertIcon,
  error: ErrorAlertIcon,
  critical: CriticalAlertIcon,
};

// Metric type labels
const METRIC_TYPE_LABELS: Record<number, string> = {
  1: 'Counter',
  2: 'Gauge',
  3: 'Derive',
};

// Method/source display labels
const METHOD_LABELS: Record<string, string> = {
  // Sources
  exitCode: 'Exit Code',
  responseTime: 'Response Time',
  // Methods
  expression: 'Expression',
  namevalue: 'Name=Value',
  json: 'JSON Path',
  regex: 'Regex',
  csv: 'CSV',
  tsv: 'TSV',
  xpath: 'XPath',
  textmatch: 'Text Match',
  groovy: 'Groovy',
  none: 'None',
};

// Determine if a datapoint is complex (expression-based)
function isComplexDatapoint(dp: DataPoint): boolean {
  return dp.postProcessorMethod === 'expression';
}

// Get source/method display for a datapoint
function getSourceMethodDisplay(dp: DataPoint): { label: string; isComplex: boolean } {
  if (isComplexDatapoint(dp)) {
    return { label: METHOD_LABELS['expression'] || 'Expression', isComplex: true };
  }
  
  // For normal datapoints, show the source or method
  if (dp.rawDataFieldName === 'exitCode') {
    return { label: METHOD_LABELS['exitCode'] || 'Exit Code', isComplex: false };
  }
  if (dp.rawDataFieldName === 'responseTime') {
    return { label: METHOD_LABELS['responseTime'] || 'Response Time', isComplex: false };
  }
  
  // Script output - show method with friendly label
  const method = dp.postProcessorMethod || 'none';
  return { label: METHOD_LABELS[method] || method, isComplex: false };
}

// Truncate post processor param for display
function truncateParam(param: string | undefined, maxLength: number = 40): string {
  if (!param) return '';
  if (param.length <= maxLength) return param;
  return param.substring(0, maxLength) + '...';
}

export function ModuleDetailsDatapoints({ tabId, moduleId, moduleType }: ModuleDetailsDatapointsProps) {
  const { 
    portals, 
    selectedPortalId, 
    moduleDetailsDraftByTabId,
    addDatapoint,
    updateDatapoint,
    deleteDatapoint,
  } = useEditorStore();
  
  const draft = moduleDetailsDraftByTabId[tabId];
  const datapoints = (draft?.draft?.dataPoints || []) as DataPoint[];

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isNewDatapoint, setIsNewDatapoint] = useState(false);
  const [newDatapointType, setNewDatapointType] = useState<DatapointType>('normal');

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const handleOpenPortal = () => {
    if (!selectedPortalId) return;
    
    const portal = portals.find(p => p.id === selectedPortalId);
    if (!portal) return;

    const url = buildPortalEditUrl(portal.hostname, moduleType, moduleId);
    window.open(url, '_blank');
  };

  const handleAddDatapoint = (type: DatapointType) => {
    setEditingIndex(null);
    setIsNewDatapoint(true);
    setNewDatapointType(type);
    setSheetOpen(true);
  };

  const handleEditDatapoint = (index: number) => {
    setEditingIndex(index);
    setIsNewDatapoint(false);
    // Determine type from existing datapoint
    const dp = datapoints[index];
    setNewDatapointType(isComplexDatapoint(dp) ? 'complex' : 'normal');
    setSheetOpen(true);
  };

  const handleDeleteClick = (index: number) => {
    setPendingDeleteIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteIndex !== null) {
      deleteDatapoint(tabId, pendingDeleteIndex);
      // Remove from expanded rows if it was expanded
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(pendingDeleteIndex);
        return next;
      });
    }
    setDeleteDialogOpen(false);
    setPendingDeleteIndex(null);
  };

  const handleSaveDatapoint = (datapoint: DataPoint) => {
    if (isNewDatapoint) {
      addDatapoint(tabId, datapoint);
    } else if (editingIndex !== null) {
      updateDatapoint(tabId, editingIndex, datapoint);
    }
  };

  const toggleRowExpanded = (index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Get existing datapoint names for uniqueness validation
  const existingNames = datapoints.map(dp => dp.name);

  // Get the datapoint being edited
  const editingDatapoint = editingIndex !== null ? datapoints[editingIndex] : null;

  // Determine datapoint type for the sheet
  const currentDatapointType = useMemo((): DatapointType => {
    if (isNewDatapoint) {
      return newDatapointType;
    }
    if (editingDatapoint) {
      return isComplexDatapoint(editingDatapoint) ? 'complex' : 'normal';
    }
    return 'normal';
  }, [isNewDatapoint, newDatapointType, editingDatapoint]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-5" />
                Datapoints
              </CardTitle>
              <CardDescription className="mt-1">
                Configure datapoints for this module. Some advanced options are only available in the Portal.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" className="gap-1.5">
                      <Plus className="size-4" />
                      Add Datapoint
                      <ChevronDown className="size-3 ml-1" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAddDatapoint('normal')}>
                    <OutputIcon className="size-4 mr-2" />
                    <div className="flex flex-col">
                      <span>Normal Datapoint</span>
                      <span className="text-xs text-muted-foreground">From script output, exit code, or response time</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddDatapoint('complex')}>
                    <ExpressionIcon className="size-4 mr-2" />
                    <div className="flex flex-col">
                      <span>Complex Datapoint</span>
                      <span className="text-xs text-muted-foreground">Calculated expression using other datapoints</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={handleOpenPortal}
                      disabled={!selectedPortalId}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      <ExternalLink className="size-4" />
                      Portal
                    </Button>
                  }
                />
                <TooltipContent>
                  Open module in LogicMonitor portal for advanced options
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {datapoints.length === 0 ? (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>No datapoints configured. Add a datapoint to start collecting metrics.</span>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {datapoints.length} datapoint{datapoints.length !== 1 ? 's' : ''} configured
              </p>
              
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[160px]">Name</TableHead>
                      <TableHead className="w-[90px]">Type</TableHead>
                      <TableHead className="w-[110px]">Method</TableHead>
                      <TableHead className="w-[180px]">Key / Expression</TableHead>
                      <TableHead className="w-[160px]">Threshold</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datapoints.map((dp, index) => {
                      const isExpanded = expandedRows.has(index);
                      const thresholds = parseAlertThresholds(dp.alertExpr);
                      const sourceMethod = getSourceMethodDisplay(dp);
                      const MetricIcon = METRIC_TYPE_ICONS[dp.type] || GaugeIcon;
                      
                      // Check for expandable content
                      const hasDescription = !!dp.description?.trim();
                      const hasNoDataAlert = dp.alertForNoData !== 1;
                      const hasAlertSubject = !!dp.alertSubject?.trim();
                      const hasAlertBody = !!dp.alertBody?.trim();
                      // Always show alert settings section (trigger/clear intervals are always displayed)
                      const hasAlertSettings = true;
                      const hasExpandableContent = hasDescription || hasAlertSettings || hasAlertSubject || hasAlertBody;

                      // Param display
                      const paramDisplay = dp.postProcessorParam || '';
                      const truncatedParam = truncateParam(paramDisplay);
                      const isParamTruncated = paramDisplay.length > 40;

                      return (
                        <Fragment key={dp.id ?? `new-${index}`}>
                          <TableRow 
                            className={cn(
                              'transition-colors',
                              hasExpandableContent && 'cursor-pointer hover:bg-muted/50',
                              isExpanded && 'bg-muted/30'
                            )}
                            onClick={() => hasExpandableContent && toggleRowExpanded(index)}
                          >
                            <TableCell className="w-[40px]">
                              {hasExpandableContent ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRowExpanded(index);
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                </Button>
                              ) : (
                                <div className="size-6" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{dp.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <MetricIcon className="size-4" />
                                <span className="text-sm text-muted-foreground">
                                  {METRIC_TYPE_LABELS[dp.type] || `Type ${dp.type}`}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {sourceMethod.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              {paramDisplay ? (
                                isParamTruncated ? (
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <span className="font-mono text-xs text-muted-foreground cursor-help">
                                          {truncatedParam}
                                        </span>
                                      }
                                    />
                                    <TooltipContent className="max-w-md font-mono text-xs whitespace-pre-wrap">
                                      {paramDisplay}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {paramDisplay}
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {thresholds && thresholds.length > 0 ? (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {thresholds.map((t) => {
                                    const AlertIcon = ALERT_LEVEL_ICONS[t.level];
                                    return (
                                      <Badge
                                        key={`${t.level}-${t.value}`}
                                        variant="outline"
                                        className={cn('text-xs font-mono gap-1', ALERT_LEVEL_BG_STYLES[t.level])}
                                      >
                                        <AlertIcon className="size-3" />
                                        {t.operator}{t.value}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No threshold</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => handleEditDatapoint(index)}
                                        aria-label={`Edit ${dp.name}`}
                                      >
                                        <Pencil className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>Edit datapoint</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => handleDeleteClick(index)}
                                        aria-label={`Delete ${dp.name}`}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>Delete datapoint</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expandable content row */}
                          {isExpanded && hasExpandableContent && (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={7} className="py-3">
                                <div className="pl-10 space-y-3 text-sm max-w-full overflow-hidden">
                                  {/* Description */}
                                  {hasDescription && (
                                    <div className="space-y-1">
                                      <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Description</span>
                                      <p className="text-foreground whitespace-pre-wrap break-words">{dp.description}</p>
                                    </div>
                                  )}
                                  
                                  {/* Alert Settings */}
                                  {hasAlertSettings && (
                                    <div className="space-y-1">
                                      <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Alert Settings</span>
                                      <div className="flex items-center gap-4 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          {dp.alertForNoData === 1 ? (
                                            <BellOff className="size-3.5 text-muted-foreground" />
                                          ) : (
                                            <Bell className="size-3.5 text-yellow-500" />
                                          )}
                                          <span className="text-muted-foreground">No Data:</span>
                                          <span className={cn(
                                            hasNoDataAlert && 'text-yellow-500'
                                          )}>
                                            {ALERT_NO_DATA_LABELS[dp.alertForNoData] || 'Unknown'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-muted-foreground">Trigger:</span>
                                          <span>
                                            {dp.alertTransitionInterval === 0 || dp.alertTransitionInterval === undefined
                                              ? 'Immediately'
                                              : `${dp.alertTransitionInterval} poll${dp.alertTransitionInterval !== 1 ? 's' : ''}`
                                            }
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-muted-foreground">Clear:</span>
                                          <span>
                                            {dp.alertClearTransitionInterval === 0 || dp.alertClearTransitionInterval === undefined
                                              ? 'Immediately'
                                              : `${dp.alertClearTransitionInterval} poll${dp.alertClearTransitionInterval !== 1 ? 's' : ''}`
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Custom Alert Subject */}
                                  {hasAlertSubject && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                                        <Mail className="size-3" />
                                        Alert Subject
                                      </div>
                                      <p className="text-foreground font-mono text-xs bg-muted/50 px-2 py-1 rounded whitespace-pre-wrap break-words">
                                        {dp.alertSubject}
                                      </p>
                                    </div>
                                  )}

                                  {/* Custom Alert Body */}
                                  {hasAlertBody && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                                        <MessageSquare className="size-3" />
                                        Alert Body
                                      </div>
                                      <p className="text-foreground font-mono text-xs bg-muted/50 px-2 py-1.5 rounded whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                                        {dp.alertBody}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Datapoint Editor Sheet */}
      <DatapointEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        datapoint={editingDatapoint}
        existingNames={existingNames}
        onSave={handleSaveDatapoint}
        isNew={isNewDatapoint}
        datapointType={currentDatapointType}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Datapoint?"
        description={`Are you sure you want to delete "${pendingDeleteIndex !== null ? datapoints[pendingDeleteIndex]?.name : ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
