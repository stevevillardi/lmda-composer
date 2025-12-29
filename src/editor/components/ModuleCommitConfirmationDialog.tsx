import { useState, useEffect, useMemo } from 'react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DiffEditor } from './DiffEditor';
import { useEditorStore } from '../stores/editor-store';
import type { LogicModuleType, ScriptLanguage } from '@/shared/types';

interface ModuleCommitConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  moduleName: string;
  moduleType: LogicModuleType;
  scriptType: 'collection' | 'ad';
  scriptLanguage?: ScriptLanguage;
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
  scriptLanguage = 'groovy',
  originalScript,
  newScript,
  hasConflict = false,
  conflictMessage,
  isCommitting = false,
}: ModuleCommitConfirmationDialogProps) {
  const [commitError, setCommitError] = useState<string | null>(null);
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
      <DialogContent className="max-w-[95vw]! sm:max-w-[1500px]! max-h-[90vh] flex flex-col gap-0 p-0">
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
            {hasChanges && originalScript !== undefined && newScript !== undefined ? (
              <div className="border border-border rounded-md overflow-hidden">
                <div className="grid grid-cols-2 border-b border-border bg-muted/30">
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-r border-border">
                    Original
                  </div>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
                    Modified
                  </div>
                </div>
                <DiffEditor
                  original={originalScript}
                  modified={newScript}
                  language={scriptLanguage}
                  height="400px"
                  theme={monacoTheme}
                  readOnly={true}
                />
              </div>
            ) : hasChanges ? (
              <p className="text-xs text-muted-foreground">Loading diff...</p>
            ) : (
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
          <Button 
            type="button" 
            onClick={handleConfirm} 
            disabled={isCommitting || !hasChanges}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
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

