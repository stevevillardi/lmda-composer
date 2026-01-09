import { useMemo } from 'react';
import { useEditorStore } from '@/editor/stores/editor-store';
import { getPortalBindingStatus, type PortalBindingStatus } from '@/editor/utils/portal-binding';
import type { EditorTab } from '@/shared/types';

/**
 * Result of the usePortalBinding hook.
 */
export interface PortalBindingResult {
  /** Whether the tab is actively bound to the selected portal */
  isActive: boolean;
  /** Full binding status details (null if tab is not a module tab) */
  binding: PortalBindingStatus | null;
}

/**
 * Hook to get the portal binding status for a given tab.
 * 
 * This hook consolidates the repeated pattern of checking portal binding
 * status across many components. It only returns meaningful bindings for
 * tabs with module sources.
 * 
 * @param tab - The EditorTab to check binding for (or null)
 * @returns PortalBindingResult with isActive flag and full binding details
 */
export function usePortalBinding(tab: EditorTab | null): PortalBindingResult {
  const selectedPortalId = useEditorStore((state) => state.selectedPortalId);
  const portals = useEditorStore((state) => state.portals);

  return useMemo(() => {
    // Only module tabs have portal bindings
    if (!tab || tab.source?.type !== 'module') {
      return { isActive: true, binding: null };
    }

    const binding = getPortalBindingStatus(tab, selectedPortalId, portals);
    return {
      isActive: binding.isActive,
      binding,
    };
  }, [tab, selectedPortalId, portals]);
}
