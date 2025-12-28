import { useState, useEffect } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { LogicModuleType } from '@/shared/types';

interface ModuleCommitConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  moduleName: string;
  moduleType: LogicModuleType;
  scriptType: 'collection' | 'ad';
  originalScript: string;
  newScript: string;
  hasConflict?: boolean;
  conflictMessage?: string;
  isCommitting?: boolean;
}

const MODULE_TYPE_LABELS: Record<LogicModuleType, string> = {
  datasource: 'DataSource',
  configsource: 'ConfigSource',
  topologysource: 'TopologySource',
  propertysource: 'PropertySource',
  logsource: 'LogSource',
  diagnosticsource: 'DiagnosticSource',
};

export function ModuleCommitConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  moduleName,
  moduleType,
  scriptType,
  originalScript,
  newScript,
  hasConflict = false,
  conflictMessage,
  isCommitting = false,
}: ModuleCommitConfirmationDialogProps) {
  const [commitError, setCommitError] = useState<string | null>(null);

  // Reset error when dialog opens
  useEffect(() => {
    if (open) {
      setCommitError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    try {
      setCommitError(null);
      await onConfirm();
    } catch (error) {
      setCommitError(error instanceof Error ? error.message : 'Failed to commit changes');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const hasChanges = originalScript.trim() !== newScript.trim();
  const scriptTypeLabel = scriptType === 'ad' ? 'Active Discovery Script' : 'Collection Script';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] sm:!max-w-[1200px] max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Commit Changes to Module
          </DialogTitle>
          <DialogDescription>
            This will update the {scriptTypeLabel.toLowerCase()} in LogicMonitor for module "{moduleName}".
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-4">
          {/* Module info */}
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-sm font-medium">Module:</Label>
            <Badge variant="outline">{moduleName}</Badge>
            <Badge variant="secondary">{MODULE_TYPE_LABELS[moduleType]}</Badge>
            <Badge variant="default">{scriptTypeLabel}</Badge>
          </div>

          {/* Conflict warning */}
          {hasConflict && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Conflict Detected</div>
                {conflictMessage || 'The module has been changed externally. Review the changes below before committing.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Script comparison */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Script Changes</Label>
            <div className="grid grid-cols-2 gap-4">
              {/* Original script */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Original Script</Label>
                <Textarea
                  value={originalScript}
                  readOnly
                  className="min-h-[200px] max-h-[400px] font-mono text-sm bg-muted/50 resize-none overflow-y-auto"
                />
              </div>
              {/* New script */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">New Script</Label>
                <Textarea
                  value={newScript}
                  readOnly
                  className={cn(
                    "min-h-[200px] max-h-[400px] font-mono text-sm resize-none overflow-y-auto",
                    hasChanges ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-muted/50"
                  )}
                />
              </div>
            </div>
            {!hasChanges && (
              <p className="text-xs text-muted-foreground">No script changes detected.</p>
            )}
          </div>

          {/* Warning message */}
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>
              This will update the module in LogicMonitor. Make sure you've tested your changes.
            </AlertDescription>
          </Alert>

          {commitError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{commitError}</AlertDescription>
            </Alert>
          )}
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t shrink-0">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isCommitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isCommitting || !hasChanges}>
            {isCommitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Committing...
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                Commit Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

