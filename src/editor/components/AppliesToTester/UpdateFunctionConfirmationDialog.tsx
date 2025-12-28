import { useState, useEffect } from 'react';
import { Save, Loader2, Edit } from 'lucide-react';
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
      setUpdateError(error instanceof Error ? error.message : 'Failed to update function');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const hasCodeChanges = func.code.trim() !== newCode.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="size-5" />
            Confirm Function Update
          </DialogTitle>
          <DialogDescription>
            Review the changes and update the function name and description if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              {nameError && <p className="text-destructive text-xs mt-1">{nameError}</p>}
            </div>
          </div>

          {/* Code comparison */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Code Changes</Label>
            <div className="grid grid-cols-2 gap-4">
              {/* Original code */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Original Code</Label>
                <Textarea
                  value={func.code}
                  readOnly
                  className="min-h-[100px] font-mono text-sm bg-muted/50 resize-none"
                />
              </div>
              {/* New code */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">New Code</Label>
                <Textarea
                  value={newCode}
                  readOnly
                  className={cn(
                    "min-h-[100px] font-mono text-sm resize-none",
                    hasCodeChanges ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-muted/50"
                  )}
                />
              </div>
            </div>
            {!hasCodeChanges && (
              <p className="text-xs text-muted-foreground">No code changes detected.</p>
            )}
          </div>

          {/* Description field */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="update-description" className="text-right pt-2">
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
            <div className="text-destructive text-sm bg-destructive/10 p-2 rounded">
              {updateError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isUpdating}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isUpdating}>
            {isUpdating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" />
                Confirm Update
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

