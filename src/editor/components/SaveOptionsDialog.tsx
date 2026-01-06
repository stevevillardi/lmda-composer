/**
 * Dialog shown when saving a portal-bound document.
 * 
 * Offers options to:
 * - Save to Local File (loses portal binding)
 * - Cancel
 */

import { useState } from 'react';
import { Save, X, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { EditorTab } from '@/shared/types';

export interface SaveOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: EditorTab | null;
  onSaveLocal: () => Promise<void>;
}

export function SaveOptionsDialog({
  open,
  onOpenChange,
  tab,
  onSaveLocal,
}: SaveOptionsDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!tab) return null;

  const moduleName = tab.source?.moduleName || 'Module';
  const portalHostname = tab.source?.portalHostname || '';

  const handleSaveLocal = async () => {
    setIsSaving(true);
    try {
      await onSaveLocal();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="size-5" />
            Save Options
          </DialogTitle>
          <DialogDescription>
            This document is linked to a LogicMonitor portal module. Choose how you want to save it.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Module info */}
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{moduleName}</span>
            {portalHostname && (
              <span className="ml-1 text-xs">({portalHostname})</span>
            )}
          </div>

          {/* Warning about losing portal binding */}
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription className="text-sm">
              <strong className="font-medium">Saving locally</strong> will disconnect this file from the LogicMonitor portal. 
              You won&apos;t be able to push changes back to the portal from the saved file.
            </AlertDescription>
          </Alert>

          {/* Options */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={handleSaveLocal}
              disabled={isSaving}
            >
              <Save className="size-5 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Save to Local File</div>
                <div className="text-xs text-muted-foreground">
                  Creates a standalone file (loses portal connection)
                </div>
              </div>
            </Button>

          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="size-4 mr-2" />
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

