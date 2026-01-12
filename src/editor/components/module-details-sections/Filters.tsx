import { useState, Fragment } from 'react';
import { Filter, ExternalLink, Plus, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ConfirmationDialog } from '../shared/ConfirmationDialog';
import { FilterEditorSheet } from './FilterEditorSheet';
import { buildPortalEditUrl } from '@/shared/module-type-schemas';
import { useEditorStore } from '../../stores/editor-store';
import { cn } from '@/lib/utils';
import type { LogicModuleType, LogSourceFilter } from '@/shared/types';

interface ModuleDetailsFiltersProps {
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
}

// Operator display labels
const OPERATOR_LABELS: Record<string, string> = {
  Equal: 'Equals',
  NotEqual: 'Not Equals',
  Contain: 'Contains',
  NotContain: 'Not Contains',
  RegexMatch: 'Regex Match',
  RegexNotMatch: 'Regex Not Match',
};

// Truncate text for display
function truncateText(text: string | undefined, maxLength: number = 60): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function ModuleDetailsFilters({ tabId, moduleId, moduleType }: ModuleDetailsFiltersProps) {
  const { 
    portals, 
    selectedPortalId, 
    moduleDetailsDraftByTabId,
    addLogSourceFilter,
    updateLogSourceFilter,
    deleteLogSourceFilter,
    updateCollectionAttribute,
  } = useEditorStore();
  
  const draft = moduleDetailsDraftByTabId[tabId];
  const filters = (draft?.draft?.filters || []) as LogSourceFilter[];
  const collectionAttribute = draft?.draft?.collectionAttribute as { filterOp?: string | null } | undefined;
  const filterOp = collectionAttribute?.filterOp || 'AND';

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isNewFilter, setIsNewFilter] = useState(false);

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

  const handleAddFilter = () => {
    setEditingIndex(null);
    setIsNewFilter(true);
    setSheetOpen(true);
  };

  const handleEditFilter = (index: number) => {
    setEditingIndex(index);
    setIsNewFilter(false);
    setSheetOpen(true);
  };

  const handleDeleteClick = (index: number) => {
    setPendingDeleteIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteIndex !== null) {
      deleteLogSourceFilter(tabId, pendingDeleteIndex);
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(pendingDeleteIndex);
        return next;
      });
    }
    setDeleteDialogOpen(false);
    setPendingDeleteIndex(null);
  };

  const handleSaveFilter = (filter: LogSourceFilter) => {
    if (isNewFilter) {
      addLogSourceFilter(tabId, filter);
    } else if (editingIndex !== null) {
      updateLogSourceFilter(tabId, editingIndex, filter);
    }
  };

  const handleToggleOperator = (checked: boolean) => {
    updateCollectionAttribute(tabId, { filterOp: checked ? 'OR' : 'AND' });
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

  // Get the filter being edited
  const editingFilter = editingIndex !== null ? filters[editingIndex] : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="size-5" />
                Include Filters
              </CardTitle>
              <CardDescription className="mt-1">
                Configure filters to include specific log messages. Filters evaluate the Message attribute.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleAddFilter}>
                <Plus className="size-4" />
                Add Filter
              </Button>
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
          {/* AND/OR Toggle */}
          <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted/20 p-3">
            <Label htmlFor="filter-op-toggle" className="text-sm font-medium">
              Filter Operation:
            </Label>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm", filterOp === 'AND' ? 'font-medium' : 'text-muted-foreground')}>AND</span>
              <Switch
                id="filter-op-toggle"
                checked={filterOp === 'OR'}
                onCheckedChange={handleToggleOperator}
              />
              <span className={cn("text-sm", filterOp === 'OR' ? 'font-medium' : 'text-muted-foreground')}>OR</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {filterOp === 'AND' 
                ? 'Event must match ALL filters to be ingested'
                : 'Event must match at least ONE filter to be ingested'}
            </span>
          </div>

          {filters.length === 0 ? (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>No include filters configured. Add a filter to control which log messages are ingested.</span>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {filters.length} filter{filters.length !== 1 ? 's' : ''} configured
              </p>

              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[150px]">Operator</TableHead>
                      <TableHead className="min-w-[200px]">Value</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filters.map((filter, index) => {
                      const isExpanded = expandedRows.has(index);
                      const hasComment = !!filter.comment?.trim();
                      const hasExpandableContent = hasComment;

                      return (
                        <Fragment key={filter.id ?? `new-${index}`}>
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
                            <TableCell>
                              <Badge variant="secondary" className="font-mono text-xs">
                                {OPERATOR_LABELS[filter.operator] || filter.operator}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">
                                {truncateText(filter.value, 80)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditFilter(index);
                                        }}
                                        aria-label="Edit filter"
                                      >
                                        <Pencil className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>Edit filter</TooltipContent>
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
                                        aria-label="Delete filter"
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>Delete filter</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expandable content row */}
                          {isExpanded && hasExpandableContent && (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={4} className="py-3">
                                <div className="max-w-full space-y-3 overflow-hidden pl-10 text-sm">
                                  {hasComment && (
                                    <div className="space-y-1">
                                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        Comment
                                      </span>
                                      <p className="wrap-break-word whitespace-pre-wrap text-foreground">
                                        {filter.comment}
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

      {/* Filter Editor Sheet */}
      <FilterEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filter={editingFilter}
        onSave={handleSaveFilter}
        isNew={isNewFilter}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Filter"
        description="Are you sure you want to delete this filter? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
