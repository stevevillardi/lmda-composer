import { useState, useEffect, useMemo } from 'react';
import { Play, Activity, Database } from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ExecutionContextDialog() {
  const { 
    executionContextDialogOpen, 
    cancelExecutionContextDialog, 
    confirmExecutionContext,
    wildvalue: storedWildvalue,
    datasourceId: storedDatasourceId,
    tabs,
    activeTabId,
  } = useEditorStore();

  // Derive mode from active tab (getters are not reactive in Zustand)
  const mode = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    return activeTab?.mode ?? 'freeform';
  }, [tabs, activeTabId]);

  const [wildvalueInput, setWildvalueInput] = useState(storedWildvalue || '');
  const [datasourceInput, setDatasourceInput] = useState(storedDatasourceId || '');

  // Determine which mode we're in
  const isCollectionMode = mode === 'collection';
  const isBatchCollectionMode = mode === 'batchcollection';

  // Reset inputs when dialog opens
  useEffect(() => {
    if (executionContextDialogOpen) {
      setWildvalueInput(storedWildvalue || '');
      setDatasourceInput(storedDatasourceId || '');
    }
  }, [executionContextDialogOpen, storedWildvalue, storedDatasourceId]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      cancelExecutionContextDialog();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCollectionMode) {
      confirmExecutionContext(wildvalueInput.trim(), '');
    } else if (isBatchCollectionMode) {
      confirmExecutionContext('', datasourceInput.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Collection mode - ask for wildvalue
  if (isCollectionMode) {
    return (
      <Dialog open={executionContextDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="size-5 text-primary" />
                </div>
                <DialogTitle>Collection Script</DialogTitle>
              </div>
              <DialogDescription>
                Collection scripts run once per instance. Enter the instance identifier (wildvalue) 
                to test your script against a specific instance.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="space-y-2">
                <Label htmlFor="wildvalue">WildValue (Instance Identifier)</Label>
                <Input
                  id="wildvalue"
                  value={wildvalueInput}
                  onChange={(e) => setWildvalueInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., eth0, C:, process-123"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This value will be available as <code className="bg-muted px-1 rounded">##WILDVALUE##</code> in 
                  your script and as <code className="bg-muted px-1 rounded">instanceProps["wildvalue"]</code> in Groovy.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={cancelExecutionContextDialog}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="gap-1.5"
              >
                <Play className="size-3.5" />
                Run Script
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Batch Collection mode - ask for datasource name/ID
  if (isBatchCollectionMode) {
    return (
      <Dialog open={executionContextDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Database className="size-5 text-primary" />
                </div>
                <DialogTitle>Batch Collection Script</DialogTitle>
              </div>
              <DialogDescription>
                Batch collection scripts iterate over all discovered instances. Enter the datasource 
                name or ID to fetch instance properties from the collector.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="space-y-2">
                <Label htmlFor="datasource">Datasource Name or ID</Label>
                <Input
                  id="datasource"
                  value={datasourceInput}
                  onChange={(e) => setDatasourceInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., snmp64_If-, Interfaces-, 12345"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Enter the datasource name (e.g., <code className="bg-muted px-1 rounded">snmp64_If-</code>) or 
                  numeric ID. This is used to fetch <code className="bg-muted px-1 rounded">datasourceinstanceProps</code> from 
                  the collector's cache.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={cancelExecutionContextDialog}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="gap-1.5"
              >
                <Play className="size-3.5" />
                Run Script
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // If not in collection or batch collection mode, don't render
  return null;
}

