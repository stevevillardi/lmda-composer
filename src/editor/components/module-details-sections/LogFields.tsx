import { useState, Fragment } from 'react';
import { Tags, ExternalLink, Plus, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ConfirmationDialog } from '../shared/ConfirmationDialog';
import { LogFieldEditorSheet } from './LogFieldEditorSheet';
import { buildPortalEditUrl } from '@/shared/module-type-schemas';
import { useEditorStore } from '../../stores/editor-store';
import { cn } from '@/lib/utils';
import type { LogicModuleType, LogSourceLogField } from '@/shared/types';

interface ModuleDetailsLogFieldsProps {
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
}

// Method display labels
const METHOD_LABELS: Record<string, string> = {
  Static: 'Static',
  Regex: 'Dynamic (Regex)',
  Token: 'LM Property (Token)',
};

// Truncate text for display
function truncateText(text: string | undefined, maxLength: number = 40): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function ModuleDetailsLogFields({ tabId, moduleId, moduleType }: ModuleDetailsLogFieldsProps) {
  const { 
    portals, 
    selectedPortalId, 
    moduleDetailsDraftByTabId,
    addLogSourceLogField,
    updateLogSourceLogField,
    deleteLogSourceLogField,
  } = useEditorStore();
  
  const draft = moduleDetailsDraftByTabId[tabId];
  const logFields = (draft?.draft?.logFields || []) as LogSourceLogField[];

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isNewField, setIsNewField] = useState(false);

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

  const handleAddField = () => {
    setEditingIndex(null);
    setIsNewField(true);
    setSheetOpen(true);
  };

  const handleEditField = (index: number) => {
    setEditingIndex(index);
    setIsNewField(false);
    setSheetOpen(true);
  };

  const handleDeleteClick = (index: number) => {
    setPendingDeleteIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteIndex !== null) {
      deleteLogSourceLogField(tabId, pendingDeleteIndex);
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(pendingDeleteIndex);
        return next;
      });
    }
    setDeleteDialogOpen(false);
    setPendingDeleteIndex(null);
  };

  const handleSaveField = (field: LogSourceLogField) => {
    if (isNewField) {
      addLogSourceLogField(tabId, field);
    } else if (editingIndex !== null) {
      updateLogSourceLogField(tabId, editingIndex, field);
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

  // Get the field being edited
  const editingField = editingIndex !== null ? logFields[editingIndex] : null;

  // Get existing keys for validation
  const existingKeys = logFields.map(f => f.key);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tags className="size-5" />
                Log Fields
              </CardTitle>
              <CardDescription className="mt-1">
                Configure log fields (tags) to send additional metadata with logs.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleAddField}>
                <Plus className="size-4" />
                Add Log Field
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
          {logFields.length === 0 ? (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>No log fields configured. Add a log field to send additional metadata with logs.</span>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {logFields.length} log field{logFields.length !== 1 ? 's' : ''} configured
              </p>

              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[180px]">Key</TableHead>
                      <TableHead className="w-[140px]">Method</TableHead>
                      <TableHead className="min-w-[180px]">Value</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logFields.map((field, index) => {
                      const isExpanded = expandedRows.has(index);
                      const hasComment = !!field.comment?.trim();
                      const hasExpandableContent = hasComment;

                      return (
                        <Fragment key={field.id ?? `new-${index}`}>
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
                            <TableCell className="font-medium">
                              <span className="font-mono text-sm">{field.key}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {METHOD_LABELS[field.method] || field.method}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm text-muted-foreground">
                                {truncateText(field.value, 50)}
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
                                          handleEditField(index);
                                        }}
                                        aria-label="Edit log field"
                                      >
                                        <Pencil className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>Edit log field</TooltipContent>
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
                                        aria-label="Delete log field"
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>Delete log field</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expandable content row */}
                          {isExpanded && hasExpandableContent && (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={5} className="py-3">
                                <div className="max-w-full space-y-3 overflow-hidden pl-10 text-sm">
                                  {hasComment && (
                                    <div className="space-y-1">
                                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        Comment
                                      </span>
                                      <p className="wrap-break-word whitespace-pre-wrap text-foreground">
                                        {field.comment}
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

      {/* Log Field Editor Sheet */}
      <LogFieldEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        logField={editingField}
        existingKeys={existingKeys}
        onSave={handleSaveField}
        isNew={isNewField}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Log Field"
        description={
          pendingDeleteIndex !== null
            ? `Are you sure you want to delete "${logFields[pendingDeleteIndex]?.key}"? This action cannot be undone.`
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
