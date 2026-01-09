import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface KeyValueRow {
  id: string;
  key: string;
  value: string;
}

interface ApiKeyValueSuggestion {
  key: string;
  description?: string;
  required?: boolean;
}

interface ApiKeyValueEditorProps {
  label: ReactNode;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  emptyLabel?: ReactNode;
  className?: string;
  suggestions?: ApiKeyValueSuggestion[];
}

export function ApiKeyValueEditor({
  label,
  values,
  onChange,
  emptyLabel = 'No values added yet.',
  className,
  suggestions = [],
}: ApiKeyValueEditorProps) {
  const [rows, setRows] = useState<KeyValueRow[]>([]);
  const internalUpdate = useRef(false);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalized = useMemo(() => {
    return Object.entries(values).map(([key, value]) => ({ key, value }));
  }, [values]);

  useEffect(() => {
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    setRows(
      normalized.map((row) => ({
        id: crypto.randomUUID(),
        key: row.key,
        value: row.value,
      }))
    );
  }, [normalized]);

  const commitNow = (nextRows: KeyValueRow[]) => {
    internalUpdate.current = true;
    const result: Record<string, string> = {};
    nextRows.forEach((row) => {
      if (row.key.trim().length === 0) return;
      result[row.key] = row.value;
    });
    onChange(result);
  };

  const commitAsync = (nextRows: KeyValueRow[]) => {
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
    }
    commitTimeoutRef.current = setTimeout(() => {
      commitNow(nextRows);
    }, 0);
  };

  const commitDebounced = (nextRows: KeyValueRow[]) => {
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
    }
    commitTimeoutRef.current = setTimeout(() => {
      commitNow(nextRows);
    }, 120);
  };

  const handleRowChange = (rowId: string, field: 'key' | 'value', value: string) => {
    setRows((prev) => {
      const next = prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      );
      commitDebounced(next);
      return next;
    });
  };

  const handleAdd = () => {
    setRows((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), key: '', value: '' }];
      commitAsync(next);
      return next;
    });
  };

  const handleAddSuggestion = (key: string) => {
    setRows((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), key, value: '' }];
      commitAsync(next);
      return next;
    });
  };

  const availableSuggestions = useMemo(() => {
    const usedKeys = new Set(rows.map((row) => row.key));
    return suggestions.filter((item) => !usedKeys.has(item.key));
  }, [rows, suggestions]);

  const handleRemove = (rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      commitAsync(next);
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 select-none">
          {label}
        </div>
        {suggestions.length > 0 ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="xs" className="gap-1">
                        <Plus className="size-3.5" />
                        Add
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>Add a field</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-72">
              {availableSuggestions.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  All available fields are already added.
                </div>
              ) : (
                availableSuggestions.map((item) => (
                  <DropdownMenuItem key={item.key} onClick={() => handleAddSuggestion(item.key)}>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-xs font-medium text-foreground">
                        {item.key}
                        {item.required && (
                          <span className="ml-1 text-[10px] text-muted-foreground">required</span>
                        )}
                      </div>
                      {item.description && (
                        <span className="text-[11px] text-muted-foreground line-clamp-2">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleAdd}>Custom…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="xs" onClick={handleAdd} className="gap-1">
                  <Plus className="size-3.5" />
                  Add
                </Button>
              }
            />
            <TooltipContent>Add a field</TooltipContent>
          </Tooltip>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center border-0 bg-transparent flex flex-col items-center justify-center h-24">
          <p className="text-sm font-medium text-muted-foreground/80 mb-1">
            {emptyLabel}
          </p>
          {suggestions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="xs" className="mt-2 bg-background/50">
                  <Plus className="size-3.5 mr-1" />
                  Add Field
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-72">
                {availableSuggestions.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    All available fields are already added.
                  </div>
                ) : (
                  availableSuggestions.map((item) => (
                    <DropdownMenuItem key={item.key} onClick={() => handleAddSuggestion(item.key)}>
                      <div className="flex flex-col gap-0.5">
                        <div className="text-xs font-medium text-foreground">
                          {item.key}
                          {item.required && (
                            <span className="ml-1 text-[10px] text-muted-foreground">required</span>
                          )}
                        </div>
                        {item.description && (
                          <span className="text-[11px] text-muted-foreground line-clamp-2">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleAdd}>Custom…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="xs" onClick={handleAdd} className="mt-2 bg-background/50">
              <Plus className="size-3.5 mr-1" />
              Add Field
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center group">
              <Input
                value={row.key}
                onChange={(event) => handleRowChange(row.id, 'key', event.target.value)}
                placeholder="Key"
                className="h-8 bg-muted/30 border-input/60 focus-visible:bg-background transition-colors font-mono text-xs"
              />
              <Input
                value={row.value}
                onChange={(event) => handleRowChange(row.id, 'value', event.target.value)}
                placeholder="Value"
                className="h-8 bg-muted/30 border-input/60 focus-visible:bg-background transition-colors font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemove(row.id)}
                aria-label="Remove row"
                className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
