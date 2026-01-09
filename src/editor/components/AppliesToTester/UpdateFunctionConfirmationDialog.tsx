import { useState, useEffect, useMemo } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DiffEditor } from '../DiffEditor';
import { useEditorStore } from '../../stores/editor-store';
import { cn } from '@/lib/utils';
import type { CustomAppliesToFunction } from '@/shared/types';

interface UpdateFunctionConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, code: string, description?: string) => Promise<void>;
  function: CustomAppliesToFunction;
  newCode: string;
  isUpdating?: boolean;
}

export function UpdateFunctionConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  function: func,
  newCode,
  isUpdating = false,
}: UpdateFunctionConfirmationDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const { preferences } = useEditorStore();

  // Map theme preference to Monaco theme
  const monacoTheme = useMemo(() => {
    if (preferences.theme === 'light') return 'vs';
    if (preferences.theme === 'dark') return 'vs-dark';
    // System: check prefers-color-scheme
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'vs';
    }
    return 'vs-dark';
  }, [preferences.theme]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(func.name);
      setDescription(func.description || '');
      setNameError(null);
      setUpdateError(null);
    }
  }, [open, func]);

  const validateName = (value: string): string | null => {
    if (!value.trim()) {
      return 'Function name is required.';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Name can only contain letters, numbers, and underscores.';
    }
    return null;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(null);
    setUpdateError(null);
  };

  const handleConfirm = async () => {
    const nameErr = validateName(name);
    setNameError(nameErr);

    if (nameErr) {
      return;
    }

    try {
      await onConfirm(name.trim(), newCode.trim(), description.trim() || undefined);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to commit function');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const hasCodeChanges = func.code.trim() !== newCode.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="
        flex max-h-[90vh] max-w-[95vw]! flex-col gap-0 p-0
        sm:max-w-[1500px]!
      ">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Commit Changes to Function
          </DialogTitle>
          <DialogDescription>
            This will update the AppliesTo function "{func.name}" in LogicMonitor. Review the changes and update the function name and description if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
          {/* Name field */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="update-name" className="text-right">
              Name
            </Label>
            <div className="col-span-3">
              <Input
                id="update-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className={cn(nameError && 'border-destructive')}
              />
              {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
            </div>
          </div>

          {/* Code comparison */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Code Changes</Label>
            {hasCodeChanges ? (
              <div className="overflow-hidden rounded-md border border-border">
                <div className="
                  grid grid-cols-2 border-b border-border bg-muted/30
                ">
                  <div className="
                    border-r border-border px-4 py-2 text-xs font-medium
                    text-muted-foreground
                  ">
                    Original
                  </div>
                  <div className="
                    px-4 py-2 text-xs font-medium text-muted-foreground
                  ">
                    Modified
                  </div>
                </div>
                <DiffEditor
                  original={func.code}
                  modified={newCode}
                  language="groovy"
                  height="300px"
                  theme={monacoTheme}
                  readOnly={true}
                  wordWrap={true}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No code changes detected.</p>
            )}
          </div>

          {/* Description field */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="update-description" className="pt-2 text-right">
              Description (optional)
            </Label>
            <div className="col-span-3">
              <Textarea
                id="update-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px] text-sm"
                placeholder="Optional description for this function"
              />
            </div>
          </div>

          {updateError && (
            <div className="
              rounded-sm bg-destructive/10 p-2 text-sm text-destructive
            ">
              {updateError}
            </div>
          )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 pt-4 pb-6">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isUpdating}>
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="commit"
            onClick={handleConfirm} 
            disabled={isUpdating || !hasCodeChanges}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Committing...
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" />
                Commit Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

