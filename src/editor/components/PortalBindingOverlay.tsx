import { useMemo, useState } from 'react';
import { Lock, Link2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useEditorStore } from '../stores/editor-store';
import { getPortalBindingStatus } from '../utils/portal-binding';

interface PortalBindingOverlayProps {
  tabId: string | null;
}

export function PortalBindingOverlay({ tabId }: PortalBindingOverlayProps) {
  const { tabs, selectedPortalId, portals, createLocalCopyFromTab, closeTab, setActiveTab, switchToPortalWithContext } = useEditorStore();
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
  
  // Check if the bound portal is available (just not selected)
  const boundPortal = binding.portalId 
    ? portals.find(p => p.id === binding.portalId && p.status === 'active')
    : null;
  const canSwitchToPortal = !!boundPortal;

  const handleSwitchPortal = () => {
    if (boundPortal) {
      // Pass the tab's context override to restore collector and hostname
      switchToPortalWithContext(boundPortal.id, {
        collectorId: tab.contextOverride?.collectorId,
        hostname: tab.contextOverride?.hostname,
      });
    }
  };

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
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Card className="max-w-lg w-full mx-4 shadow-xl border-yellow-500/30 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/15">
                <Lock className="size-5 text-yellow-500" />
              </div>
              <div>
                <CardTitle className="text-base">Portal Bound Tab</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  This tab is locked until its portal is active
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm text-foreground">{reason}</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Bound to: <span className="text-foreground font-medium">{boundPortalLabel}</span></p>
                    <p>Active portal: <span className="text-foreground font-medium">{activePortalLabel}</span></p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {canSwitchToPortal ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleSwitchPortal} variant="default" className="gap-2 flex-1">
                    <RefreshCw className="size-4" />
                    Switch Portal
                  </Button>
                  <Button onClick={handleConvert} variant="secondary" className="gap-2">
                    <Link2 className="size-4" />
                    Convert to Local
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button onClick={handleConvert} variant="secondary" className="gap-2 w-full">
                    <Link2 className="size-4" />
                    Convert to Local File
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    The bound portal is not available. Open a tab to that portal to reconnect.
                  </p>
                </div>
              )}
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
