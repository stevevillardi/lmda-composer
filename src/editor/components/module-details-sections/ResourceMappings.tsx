import { useState, Fragment, useMemo } from 'react';
import { Link2, ExternalLink, Plus, Pencil, Trash2, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ConfirmationDialog } from '../shared/ConfirmationDialog';
import { ResourceMappingEditorSheet } from './ResourceMappingEditorSheet';
import { buildPortalEditUrl } from '@/shared/module-type-schemas';
import { useEditorStore } from '../../stores/editor-store';
import { cn } from '@/lib/utils';
import type { LogicModuleType, LogSourceResourceMapping } from '@/shared/types';

interface ModuleDetailsResourceMappingsProps {
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

interface SortableRowProps {
  mapping: LogSourceResourceMapping;
  index: number;
  isExpanded: boolean;
  hasExpandableContent: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableRow({
  mapping,
  index,
  isExpanded,
  hasExpandableContent,
  onToggleExpand,
  onEdit,
  onDelete,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mapping.id ?? `new-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Fragment>
      <TableRow
        ref={setNodeRef}
        style={style}
        className={cn(
          'transition-colors',
          hasExpandableContent && 'cursor-pointer hover:bg-muted/50',
          isExpanded && 'bg-muted/30',
          isDragging && 'opacity-50 bg-muted/50'
        )}
        onClick={() => hasExpandableContent && onToggleExpand()}
      >
        <TableCell className="w-[40px]">
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'size-6 cursor-grab touch-none',
              isDragging && 'cursor-grabbing'
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4 text-muted-foreground" />
          </Button>
        </TableCell>
        <TableCell className="w-[40px]">
          {hasExpandableContent ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
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
          <Badge variant="outline" className="font-mono text-xs">
            {mapping.index}
          </Badge>
        </TableCell>
        <TableCell className="font-medium">
          <span className="font-mono text-sm">{mapping.key}</span>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="text-xs">
            {METHOD_LABELS[mapping.method] || mapping.method}
          </Badge>
        </TableCell>
        <TableCell>
          <span className="font-mono text-sm text-muted-foreground">
            {truncateText(mapping.value, 40)}
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
                      onEdit();
                    }}
                    aria-label="Edit mapping"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Edit mapping</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    aria-label="Delete mapping"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Delete mapping</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>
      {/* Expandable content row */}
      {isExpanded && hasExpandableContent && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={7} className="py-3">
            <div className="max-w-full space-y-3 overflow-hidden pl-10 text-sm">
              <div className="space-y-1">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Comment
                </span>
                <p className="wrap-break-word whitespace-pre-wrap text-foreground">
                  {mapping.comment}
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export function ModuleDetailsResourceMappings({ tabId, moduleId, moduleType }: ModuleDetailsResourceMappingsProps) {
  const { 
    portals, 
    selectedPortalId, 
    moduleDetailsDraftByTabId,
    addLogSourceResourceMapping,
    updateLogSourceResourceMapping,
    deleteLogSourceResourceMapping,
    reorderLogSourceResourceMappings,
    updateCollectionAttribute,
  } = useEditorStore();
  
  const draft = moduleDetailsDraftByTabId[tabId];
  const resourceMappings = (draft?.draft?.resourceMapping || []) as LogSourceResourceMapping[];
  const collectionAttribute = draft?.draft?.collectionAttribute as { resourceMappingOp?: string } | undefined;
  const resourceMappingOp = collectionAttribute?.resourceMappingOp || 'AND';

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isNewMapping, setIsNewMapping] = useState(false);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Generate stable IDs for sortable context
  const sortableIds = useMemo(() => 
    resourceMappings.map((m, i) => m.id ?? `new-${i}`),
    [resourceMappings]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));
      
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderLogSourceResourceMappings(tabId, oldIndex, newIndex);
        
        // Update expanded rows to follow the moved item
        setExpandedRows(prev => {
          const next = new Set<number>();
          prev.forEach(expandedIdx => {
            if (expandedIdx === oldIndex) {
              next.add(newIndex);
            } else if (oldIndex < newIndex) {
              // Item moved down
              if (expandedIdx > oldIndex && expandedIdx <= newIndex) {
                next.add(expandedIdx - 1);
              } else {
                next.add(expandedIdx);
              }
            } else {
              // Item moved up
              if (expandedIdx >= newIndex && expandedIdx < oldIndex) {
                next.add(expandedIdx + 1);
              } else {
                next.add(expandedIdx);
              }
            }
          });
          return next;
        });
      }
    }
  };

  const handleOpenPortal = () => {
    if (!selectedPortalId) return;

    const portal = portals.find(p => p.id === selectedPortalId);
    if (!portal) return;

    const url = buildPortalEditUrl(portal.hostname, moduleType, moduleId);
    window.open(url, '_blank');
  };

  const handleAddMapping = () => {
    setEditingIndex(null);
    setIsNewMapping(true);
    setSheetOpen(true);
  };

  const handleEditMapping = (index: number) => {
    setEditingIndex(index);
    setIsNewMapping(false);
    setSheetOpen(true);
  };

  const handleDeleteClick = (index: number) => {
    setPendingDeleteIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteIndex !== null) {
      deleteLogSourceResourceMapping(tabId, pendingDeleteIndex);
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(pendingDeleteIndex);
        return next;
      });
    }
    setDeleteDialogOpen(false);
    setPendingDeleteIndex(null);
  };

  const handleSaveMapping = (mapping: LogSourceResourceMapping) => {
    if (isNewMapping) {
      // Assign the next index
      const nextIndex = resourceMappings.length;
      addLogSourceResourceMapping(tabId, { ...mapping, index: nextIndex });
    } else if (editingIndex !== null) {
      updateLogSourceResourceMapping(tabId, editingIndex, mapping);
    }
  };

  const handleToggleOperator = (checked: boolean) => {
    updateCollectionAttribute(tabId, { resourceMappingOp: checked ? 'OR' : 'AND' });
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

  // Get the mapping being edited
  const editingMapping = editingIndex !== null ? resourceMappings[editingIndex] : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-5" />
                Resource Mappings
              </CardTitle>
              <CardDescription className="mt-1">
                Configure resource mappings to match log data to monitored resources in LogicMonitor.
                Drag to reorder mappings by priority.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleAddMapping}>
                <Plus className="size-4" />
                Add Mapping
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
            <Label htmlFor="mapping-op-toggle" className="text-sm font-medium">
              Mapping Operation:
            </Label>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm", resourceMappingOp === 'AND' ? 'font-medium' : 'text-muted-foreground')}>AND</span>
              <Switch
                id="mapping-op-toggle"
                checked={resourceMappingOp === 'OR'}
                onCheckedChange={handleToggleOperator}
              />
              <span className={cn("text-sm", resourceMappingOp === 'OR' ? 'font-medium' : 'text-muted-foreground')}>OR</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {resourceMappingOp === 'AND' 
                ? 'Resource must match ALL mappings'
                : 'Resource must match at least ONE mapping'}
            </span>
          </div>

          {resourceMappings.length === 0 ? (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>No resource mappings configured. Add a mapping to link logs to monitored resources.</span>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {resourceMappings.length} mapping{resourceMappings.length !== 1 ? 's' : ''} configured
              </p>

              <div className="overflow-hidden rounded-md border">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[60px]">Index</TableHead>
                        <TableHead className="w-[180px]">Key</TableHead>
                        <TableHead className="w-[140px]">Method</TableHead>
                        <TableHead className="min-w-[160px]">Value</TableHead>
                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={sortableIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {resourceMappings.map((mapping, index) => {
                          const hasComment = !!mapping.comment?.trim();
                          const hasExpandableContent = hasComment;

                          return (
                            <SortableRow
                              key={mapping.id ?? `new-${index}`}
                              mapping={mapping}
                              index={index}
                              isExpanded={expandedRows.has(index)}
                              hasExpandableContent={hasExpandableContent}
                              onToggleExpand={() => toggleRowExpanded(index)}
                              onEdit={() => handleEditMapping(index)}
                              onDelete={() => handleDeleteClick(index)}
                            />
                          );
                        })}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </DndContext>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resource Mapping Editor Sheet */}
      <ResourceMappingEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        resourceMapping={editingMapping}
        onSave={handleSaveMapping}
        isNew={isNewMapping}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Resource Mapping"
        description={
          pendingDeleteIndex !== null
            ? `Are you sure you want to delete the mapping for "${resourceMappings[pendingDeleteIndex]?.key}"? This action cannot be undone.`
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
