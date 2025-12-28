import { useState, useEffect } from 'react';
import { Save, X, Plus, Code } from 'lucide-react';
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

interface CreateFunctionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, code: string, description?: string) => Promise<void>;
  editingFunction?: CustomAppliesToFunction | null;
  initialCode?: string;
  isSaving?: boolean;
}

export function CreateFunctionDialog({
  open,
  onOpenChange,
  onSave,
  editingFunction,
  initialCode,
  isSaving = false,
}: CreateFunctionDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or editing function changes
  useEffect(() => {
    if (open) {
      if (editingFunction) {
        setName(editingFunction.name);
        setCode(editingFunction.code);
        setDescription(editingFunction.description || '');
      } else {
        setName('');
        setCode(initialCode || '');
        setDescription('');
      }
      setNameError(null);
      setCodeError(null);
      setSaveError(null);
    }
  }, [open, editingFunction, initialCode]);

  // Validate name: alphanumeric + underscore only, no special chars like " * ^ %
  const validateName = (value: string): string | null => {
    if (!value.trim()) {
      return 'Function name is required';
    }
    // Check for disallowed special characters
    if (/["*^%]/.test(value)) {
      return 'Function name cannot contain special characters: " * ^ %';
    }
    // Check for alphanumeric + underscore only
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Function name can only contain letters, numbers, and underscores';
    }
    return null;
  };

  const validateCode = (value: string): string | null => {
    if (!value.trim()) {
      return 'Function code is required';
    }
    return null;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(validateName(value));
    setSaveError(null);
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    setCodeError(validateCode(value));
    setSaveError(null);
  };

  const handleSave = async () => {
    const nameErr = validateName(name);
    const codeErr = validateCode(code);

    setNameError(nameErr);
    setCodeError(codeErr);

    if (nameErr || codeErr) {
      return;
    }

    try {
      await onSave(name.trim(), code.trim(), description.trim() || undefined);
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save function');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingFunction ? (
              <>
                <Code className="size-5" />
                Edit Custom Function
              </>
            ) : (
              <>
                <Plus className="size-5" />
                Create Custom Function
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {editingFunction
              ? 'Update your custom AppliesTo function. Changes will be saved to the portal.'
              : 'Save your AppliesTo expression as a reusable custom function.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="function-name">
              Function Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="function-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="myCustomFunction"
              className={cn(nameError && 'border-destructive')}
              disabled={isSaving}
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Only letters, numbers, and underscores allowed. Cannot contain: " * ^ %
            </p>
          </div>

          {/* Code field */}
          <div className="space-y-2">
            <Label htmlFor="function-code">
              Function Code <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="function-code"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder='hasCategory("Linux") && isDevice()'
              className={cn(
                'font-mono text-sm min-h-[120px]',
                codeError && 'border-destructive'
              )}
              disabled={isSaving}
            />
            {codeError && (
              <p className="text-sm text-destructive">{codeError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The AppliesTo expression that will be executed when this function is called
            </p>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="function-description">Description (optional)</Label>
            <Textarea
              id="function-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this function does..."
              className="min-h-[80px]"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Optional description to help others understand this function
            </p>
          </div>

          {/* Save error */}
          {saveError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{saveError}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="size-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !!nameError || !!codeError || !name.trim() || !code.trim()}
          >
            <Save className="size-4 mr-2" />
            {isSaving ? 'Saving...' : editingFunction ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


