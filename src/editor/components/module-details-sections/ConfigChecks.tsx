import { useState, Fragment } from 'react';
import { Database, ExternalLink, Plus, Pencil, Trash2, ChevronRight, ChevronDown, FileCode, GitCompare, Download, Variable, Filter, Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmationDialog } from '../shared/ConfirmationDialog';
import { ConfigCheckEditorSheet } from './ConfigCheckEditorSheet';
import { buildPortalEditUrl } from '@/shared/module-type-schemas';
import { useEditorStore } from '../../stores/editor-store';
import { WarningAlertIcon, ErrorAlertIcon, CriticalAlertIcon } from '../../constants/icons';
import { cn } from '@/lib/utils';
import type { LogicModuleType, ConfigCheck, ConfigCheckType } from '@/shared/types';

interface ModuleDetailsConfigChecksProps {
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
}

// Config check type configuration
const CONFIG_CHECK_TYPES: Record<ConfigCheckType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  ignore: { label: 'Any Change', icon: GitCompare },
  groovy: { label: 'Groovy Script', icon: FileCode },
  fetch: { label: 'Config Retrieval', icon: Download },
  missing: { label: 'Missing Field', icon: Variable },
  value: { label: 'Value Check', icon: Filter },
};

// Alert level configuration with icons and styling (matching datapoint threshold display)
const ALERT_LEVEL_CONFIG: Record<number, { 
  label: string; 
  shortLabel: string; 
  Icon: React.ComponentType<{ className?: string }> | null;
  bgStyle: string;
}> = {
  1: { label: 'No Alert', shortLabel: 'None', Icon: null, bgStyle: '' },
  2: { label: 'Warning', shortLabel: 'Warn', Icon: WarningAlertIcon, bgStyle: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30' },
  3: { label: 'Error', shortLabel: 'Error', Icon: ErrorAlertIcon, bgStyle: 'bg-yellow-700/15 text-yellow-700 border-yellow-700/30' },
  4: { label: 'Critical', shortLabel: 'Crit', Icon: CriticalAlertIcon, bgStyle: 'bg-red-500/15 text-red-500 border-red-500/30' },
};

// Helper to get a summary of the check configuration
function getCheckSummary(check: ConfigCheck): string {
  switch (check.type) {
    case 'ignore': {
      const dc = check.script?.diff_check;
      if (!dc) return 'Alert on any change';
      const exclusions: string[] = [];
      if (dc.ignore_line_with_regex?.length) exclusions.push(`${dc.ignore_line_with_regex.length} regex`);
      if (dc.ignore_line_start_with?.length) exclusions.push(`${dc.ignore_line_start_with.length} prefix`);
      if (dc.ignore_line_contain?.length) exclusions.push(`${dc.ignore_line_contain.length} contain`);
      if (dc.ignore_blank_lines) exclusions.push('blanks');
      if (dc.ignore_space) exclusions.push('spaces');
      return exclusions.length > 0 ? `Excluding: ${exclusions.join(', ')}` : 'Alert on any change';
    }
    case 'groovy': {
      const script = check.script?.groovy || '';
      const lines = script.split('\n').filter(l => l.trim()).length;
      return `${lines} line${lines !== 1 ? 's' : ''} of Groovy`;
    }
    case 'fetch':
      return 'Alert if retrieval fails';
    case 'missing': {
      const variable = check.script?.value_check?.variable || '';
      return variable ? `Field: ${variable}` : 'Check for missing field';
    }
    case 'value': {
      const vc = check.script?.value_check;
      if (!vc) return 'Value check';
      const variable = vc.variable || '';
      const must = vc.must?.[0];
      if (!must) return variable ? `Field: ${variable}` : 'Value check';
      if ('value_change' in must) return `${variable}: any change`;
      if ('range' in must) {
        const range = must.range;
        const ops = ['gt', 'lt', 'gte', 'lte', 'ne', 'eq'] as const;
        for (const op of ops) {
          if (range[op] !== undefined) {
            const opLabels: Record<string, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤', ne: '≠', eq: '=' };
            return `${variable} ${opLabels[op]} ${range[op]}`;
          }
        }
      }
      return variable ? `Field: ${variable}` : 'Value check';
    }
    default:
      return '';
  }
}

// Truncate description
function truncateText(text: string | undefined, maxLength: number = 60): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function ModuleDetailsConfigChecks({ tabId, moduleId, moduleType }: ModuleDetailsConfigChecksProps) {
  const { 
    portals, 
    selectedPortalId, 
    moduleDetailsDraftByTabId,
    addConfigCheck,
    updateConfigCheck,
    deleteConfigCheck,
  } = useEditorStore();
  
  const draft = moduleDetailsDraftByTabId[tabId];
  const configChecks = (draft?.draft?.configChecks || []) as ConfigCheck[];

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isNewCheck, setIsNewCheck] = useState(false);
  const [newCheckType, setNewCheckType] = useState<ConfigCheckType>('ignore');

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

  const handleAddCheck = (type: ConfigCheckType) => {
    setEditingIndex(null);
    setIsNewCheck(true);
    setNewCheckType(type);
    setSheetOpen(true);
  };

  const handleEditCheck = (index: number) => {
    setEditingIndex(index);
    setIsNewCheck(false);
    const check = configChecks[index];
    setNewCheckType(check.type);
    setSheetOpen(true);
  };

  const handleDeleteClick = (index: number) => {
    setPendingDeleteIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteIndex !== null) {
      deleteConfigCheck(tabId, pendingDeleteIndex);
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(pendingDeleteIndex);
        return next;
      });
    }
    setDeleteDialogOpen(false);
    setPendingDeleteIndex(null);
  };

  const handleSaveCheck = (configCheck: ConfigCheck) => {
    if (isNewCheck) {
      addConfigCheck(tabId, configCheck);
    } else if (editingIndex !== null) {
      updateConfigCheck(tabId, editingIndex, configCheck);
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

  // Get existing names for validation
  const existingNames = configChecks.map(c => c.name);

  // Get the check being edited
  const editingCheck = editingIndex !== null ? configChecks[editingIndex] : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-5" />
                Config Checks
              </CardTitle>
              <CardDescription className="mt-1">
                Configure config checks for this module. Some advanced options are only available in the Portal.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" className="gap-1.5">
                      <Plus className="size-4" />
                      Add Check
                      <ChevronDown className="ml-1 size-3" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => handleAddCheck('ignore')}>
                    <GitCompare className="mr-2 size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>Any Change</span>
                      <span className="text-xs text-muted-foreground">Alert when config changes</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddCheck('groovy')}>
                    <FileCode className="mr-2 size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>Groovy Script</span>
                      <span className="text-xs text-muted-foreground">Custom check logic</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddCheck('fetch')}>
                    <Download className="mr-2 size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>Config Retrieval</span>
                      <span className="text-xs text-muted-foreground">Alert if retrieval fails</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddCheck('missing')}>
                    <Variable className="mr-2 size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>Missing Field</span>
                      <span className="text-xs text-muted-foreground">Alert when field is absent</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddCheck('value')}>
                    <Filter className="mr-2 size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>Value Check</span>
                      <span className="text-xs text-muted-foreground">Check field value conditions</span>
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
          {configChecks.length === 0 ? (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>No config checks configured. Add a check to monitor configuration changes.</span>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {configChecks.length} config check{configChecks.length !== 1 ? 's' : ''} configured
              </p>

              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[160px]">Name</TableHead>
                      <TableHead className="w-[130px]">Type</TableHead>
                      <TableHead className="w-[80px]">Alert</TableHead>
                      <TableHead className="w-[70px]">ACK Clear</TableHead>
                      <TableHead className="min-w-[180px]">Summary</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configChecks.map((check, index) => {
                      const isExpanded = expandedRows.has(index);
                      const typeConfig = CONFIG_CHECK_TYPES[check.type] || CONFIG_CHECK_TYPES.ignore;
                      const TypeIcon = typeConfig.icon;
                      const alertConfig = ALERT_LEVEL_CONFIG[check.alertLevel] || ALERT_LEVEL_CONFIG[2];
                      const summary = getCheckSummary(check);

                      // Check for expandable content
                      const hasDescription = !!check.description?.trim();
                      const hasGroovyScript = check.type === 'groovy' && !!check.script?.groovy?.trim();
                      const hasClearAfter = (check.alertEffectiveIval ?? 0) > 0;
                      const hasExpandableContent = hasDescription || hasGroovyScript || hasClearAfter;

                      return (
                        <Fragment key={check.id ?? `new-${index}`}>
                          <TableRow
                            className={cn(
                              'transition-colors',
                              hasExpandableContent && `
                                cursor-pointer
                                hover:bg-muted/50
                              `,
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
                            <TableCell className="font-medium">{check.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <TypeIcon className="
                                  size-4 text-muted-foreground
                                " />
                                <span className="text-sm text-muted-foreground">
                                  {typeConfig.label}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {alertConfig.Icon ? (
                                <Badge
                                  variant="outline"
                                  className={cn('gap-1 text-xs font-medium', alertConfig.bgStyle)}
                                >
                                  <alertConfig.Icon className="size-3" />
                                  {alertConfig.shortLabel}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {check.ackClearAlert ? 'Yes' : 'No'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {truncateText(summary)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="
                                flex items-center justify-end gap-1
                              ">
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditCheck(index);
                                        }}
                                        aria-label={`Edit ${check.name}`}
                                      >
                                        <Pencil className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>Edit config check</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteClick(index);
                                        }}
                                        aria-label={`Delete ${check.name}`}
                                        className="
                                          text-destructive
                                          hover:text-destructive
                                        "
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>Delete config check</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expandable content row */}
                          {isExpanded && hasExpandableContent && (
                            <TableRow className="
                              bg-muted/20
                              hover:bg-muted/20
                            ">
                              <TableCell colSpan={7} className="py-3">
                                <div className="
                                  max-w-full space-y-3 overflow-hidden pl-10
                                  text-sm
                                ">
                                  {/* Description */}
                                  {hasDescription && (
                                    <div className="space-y-1">
                                      <span className="
                                        text-xs font-medium tracking-wide
                                        text-muted-foreground uppercase
                                      ">Description</span>
                                      <p className="
                                        wrap-break-word whitespace-pre-wrap
                                        text-foreground
                                      ">{check.description}</p>
                                    </div>
                                  )}

                                  {/* Clear After */}
                                  {hasClearAfter && (
                                    <div className="space-y-1">
                                      <span className="
                                        text-xs font-medium tracking-wide
                                        text-muted-foreground uppercase
                                      ">Auto Clear</span>
                                      <div className="flex items-center gap-2">
                                        <Bell className="
                                          size-3.5 text-muted-foreground
                                        " />
                                        <span>After {check.alertEffectiveIval} minute{check.alertEffectiveIval !== 1 ? 's' : ''}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Groovy Script Preview */}
                                  {hasGroovyScript && (
                                    <div className="space-y-1">
                                      <span className="
                                        text-xs font-medium tracking-wide
                                        text-muted-foreground uppercase
                                      ">Groovy Script</span>
                                      <pre className="
                                        max-h-32 overflow-auto rounded-sm
                                        bg-muted/50 px-3 py-2 font-mono text-xs
                                        wrap-break-word whitespace-pre-wrap
                                        text-foreground
                                      ">
                                        {check.script?.groovy}
                                      </pre>
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

      {/* Config Check Editor Sheet */}
      <ConfigCheckEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        configCheck={editingCheck}
        existingNames={existingNames}
        onSave={handleSaveCheck}
        isNew={isNewCheck}
        initialType={newCheckType}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Config Check"
        description={
          pendingDeleteIndex !== null
            ? `Are you sure you want to delete "${configChecks[pendingDeleteIndex]?.name}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
