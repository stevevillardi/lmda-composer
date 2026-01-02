import { useMemo, useState } from 'react';
import { Lock, Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useEditorStore } from '../stores/editor-store';
import { getPortalBindingStatus } from '../utils/portal-binding';

interface PortalBindingOverlayProps {
  tabId: string | null;
}

export function PortalBindingOverlay({ tabId }: PortalBindingOverlayProps) {
  const { tabs, selectedPortalId, portals, createLocalCopyFromTab, closeTab, setActiveTab } = useEditorStore();
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [portalTabId, setPortalTabId] = useState<string | null>(null);
  const [localTabId, setLocalTabId] = useState<string | null>(null);

  const tab = useMemo(() => {
    if (!tabId) return null;
    return tabs.find((entry) => entry.id === tabId) ?? null;
  }, [tabId, tabs]);

  if (!tab || tab.source?.type !== 'module') {
    return null;
  }

  const binding = getPortalBindingStatus(tab, selectedPortalId, portals);
  if (binding.isActive) {
    return null;
  }

  const activePortal = portals.find((entry) => entry.id === selectedPortalId);
  const boundPortalLabel = binding.portalHostname || binding.portalId || 'Unknown portal';
  const activePortalLabel = activePortal?.hostname || 'No active portal';
  const reason = binding.reason || 'The active portal does not match this tab.';

  const handleConvert = () => {
    const newTabId = createLocalCopyFromTab(tab.id, { activate: false });
    if (!newTabId) return;
    setPortalTabId(tab.id);
    setLocalTabId(newTabId);
    setConfirmCloseOpen(true);
  };

  const handleConfirmClose = () => {
    if (portalTabId) {
      closeTab(portalTabId);
    }
    if (localTabId) {
      setActiveTab(localTabId);
    }
    setPortalTabId(null);
    setLocalTabId(null);
  };

  const handleKeepPortalTab = () => {
    if (localTabId) {
      setActiveTab(localTabId);
    }
    setPortalTabId(null);
    setLocalTabId(null);
  };

  return (
    <>
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-5" />
              Portal Bound Tab
            </CardTitle>
            <CardDescription>
              This tab is locked until its portal is active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription className="space-y-2">
                <div>{reason}</div>
                <div className="text-sm text-muted-foreground">
                  Bound to <strong>{boundPortalLabel}</strong>. Active portal: <strong>{activePortalLabel}</strong>.
                </div>
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-between gap-3">
              <Button onClick={handleConvert} variant="secondary" className="gap-2">
                <Link2 className="size-4" />
                Convert to Local File
              </Button>
              <span className="text-xs text-muted-foreground">
                Reconnect and set the bound portal active to continue editing.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      <ConfirmationDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title="Close portal-bound tab?"
        description="You now have a local copy. Do you want to close the portal-bound tab?"
        confirmLabel="Close Portal Tab"
        cancelLabel="Keep Portal Tab"
        onConfirm={handleConfirmClose}
        onCancel={handleKeepPortalTab}
        variant="warning"
      />
    </>
  );
}
