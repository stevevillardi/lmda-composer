/**
 * Dialog shown when saving a portal-bound document.
 * 
 * Offers options to:
 * - Save to Module Directory (preserves portal binding, saves all scripts + module.json)
 * - Save to Local File (loses portal binding)
 * - Cancel
 */

import { useState } from 'react';
import { Save, X, FolderOpen, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EditorTab } from '@/shared/types';

export interface SaveOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: EditorTab | null;
  onSaveLocal: () => Promise<void>;
  onSaveModuleDirectory?: () => Promise<void>;
}

export function SaveOptionsDialog({
  open,
  onOpenChange,
  tab,
  onSaveLocal,
  onSaveModuleDirectory,
}: SaveOptionsDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveType, setSaveType] = useState<'directory' | 'file' | null>(null);

  if (!tab) return null;

  const moduleName = tab.source?.moduleName || 'Module';
  const portalHostname = tab.source?.portalHostname || '';
  const moduleType = tab.source?.moduleType || 'DataSource';

  const handleSaveLocal = async () => {
    setIsSaving(true);
    setSaveType('file');
    try {
      await onSaveLocal();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
      setSaveType(null);
    }
  };

  const handleSaveModuleDirectory = async () => {
    if (!onSaveModuleDirectory) return;
    setIsSaving(true);
    setSaveType('directory');
    try {
      await onSaveModuleDirectory();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
      setSaveType(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl!">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="size-5" />
            Save Options
          </DialogTitle>
          <DialogDescription>
            This document is linked to a LogicMonitor portal module. Choose how you want to save it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Module info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{moduleName}</span>
            <Badge variant="secondary" className="text-xs">{moduleType}</Badge>
            {portalHostname && (
              <span className="text-xs">({portalHostname})</span>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Module Directory Option - Recommended */}
            {onSaveModuleDirectory && (
              <Button
                variant="outline"
                className="
                  h-auto w-full justify-start gap-3 border-primary/50 py-3
                  hover:border-primary
                "
                onClick={handleSaveModuleDirectory}
                disabled={isSaving}
              >
                <FolderOpen className="size-5 shrink-0 text-primary" />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 font-medium">
                    Save to Module Directory
                    <Badge variant="default" className="text-xs">Recommended</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Saves all scripts + config to a folder (preserves portal connection)
                  </div>
                </div>
                {isSaving && saveType === 'directory' && (
                  <div className="
                    size-4 animate-spin rounded-full border-2 border-primary
                    border-t-transparent
                  " />
                )}
              </Button>
            )}

            {/* Local File Option */}
            <Button
              variant="outline"
              className="h-auto w-full justify-start gap-3 py-3"
              onClick={handleSaveLocal}
              disabled={isSaving}
            >
              <FileText className="size-5 shrink-0" />
              <div className="flex-1 text-left">
                <div className="font-medium">Save to Local File</div>
                <div className="text-xs text-muted-foreground">
                  Creates a standalone file (loses portal connection)
                </div>
              </div>
              {isSaving && saveType === 'file' && (
                <div className="
                  size-4 animate-spin rounded-full border-2 border-foreground
                  border-t-transparent
                " />
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <X className="mr-2 size-4" />
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

