import type { EditorTab, Portal } from '@/shared/types';

export interface PortalBindingStatus {
  isBound: boolean;
  isActive: boolean;
  portalId?: string;
  portalHostname?: string;
  reason?: string;
}

export function getPortalBindingStatus(
  tab: EditorTab,
  selectedPortalId: string | null,
  portals: Portal[]
): PortalBindingStatus {
  const portalId = tab.source?.portalId;
  const portalHostname = tab.source?.portalHostname;

  if (!portalId) {
    return {
      isBound: false,
      isActive: false,
      portalHostname,
      reason: 'Portal binding is missing for this tab.',
    };
  }

  const portal = portals.find((entry) => entry.id === portalId);
  if (!portal) {
    return {
      isBound: true,
      isActive: false,
      portalId,
      portalHostname,
      reason: 'This portal is not currently connected.',
    };
  }

  if (!selectedPortalId) {
    return {
      isBound: true,
      isActive: false,
      portalId,
      portalHostname: portal.hostname,
      reason: 'No active portal is selected.',
    };
  }

  if (selectedPortalId !== portalId) {
    return {
      isBound: true,
      isActive: false,
      portalId,
      portalHostname: portal.hostname,
      reason: 'The active portal does not match this tab.',
    };
  }

  if (portal.status !== 'active') {
    return {
      isBound: true,
      isActive: false,
      portalId,
      portalHostname: portal.hostname,
      reason: 'The bound portal is not active.',
    };
  }

  return {
    isBound: true,
    isActive: true,
    portalId,
    portalHostname: portal.hostname,
  };
}
