/**
 * SiteListItem - Individual site in the sidebar list with rename support.
 */

import { useState, useRef, useEffect } from 'react';
import { Server, Trash2, Pencil, Check, X } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import type { Site } from '../../stores/slices/collector-sizing-slice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SiteListItemProps {
  site: Site;
  isActive: boolean;
}

export function SiteListItem({ site, isActive }: SiteListItemProps) {
  const { setActiveSiteId, removeSite, renameSite, sites } = useEditorStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(site.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const canRemove = sites.length > 1;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(site.name);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== site.name) {
      renameSite(site.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(site.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canRemove) {
      removeSite(site.id);
    }
  };

  // Quick stats
  const totalDevices = Object.values(site.devices).reduce(
    (sum, d) => sum + d.count,
    0
  );
  const hasRecommendation = site.calculationResult?.polling || site.calculationResult?.logs;

  return (
    <div
      onClick={() => !isEditing && setActiveSiteId(site.id)}
      className={cn(
        'group relative w-full px-3 py-2.5 text-left transition-all cursor-pointer',
        'border-l-2',
        isActive
          ? 'border-primary bg-accent/50 text-accent-foreground'
          : 'border-transparent hover:border-border/50 hover:bg-muted/30'
      )}
    >
      {isEditing ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            className="h-7 flex-1 text-sm"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveEdit();
            }}
          >
            <Check className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelEdit();
            }}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'truncate text-sm font-medium',
                isActive ? 'text-foreground' : 'text-foreground/90'
              )}
            >
              {site.name}
            </span>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={handleStartEdit}
                      className="flex size-5 items-center justify-center rounded hover:bg-accent/50"
                    >
                      <Pencil className="size-3 text-muted-foreground" />
                    </button>
                  }
                />
                <TooltipContent>Rename</TooltipContent>
              </Tooltip>
              {canRemove && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        onClick={handleRemove}
                        className="flex size-5 items-center justify-center rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3 text-destructive/70" />
                      </button>
                    }
                  />
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{totalDevices} devices</span>
            {hasRecommendation && (
              <>
                <span className="text-muted-foreground/30">•</span>
                {site.calculationResult?.polling && (
                  <span className="flex items-center gap-0.5">
                    <Server className="size-3" />
                    {site.calculationResult.polling.count}×{site.calculationResult.polling.size}
                  </span>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
