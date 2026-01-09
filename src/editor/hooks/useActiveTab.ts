import { useMemo } from 'react';
import { useEditorStore } from '@/editor/stores/editor-store';
import type { EditorTab } from '@/shared/types';

/**
 * Hook to get the currently active tab from the editor store.
 * 
 * This hook consolidates the repeated pattern of finding the active tab
 * across many components, providing a single source of truth.
 * 
 * @returns The active EditorTab or null if no tab is active
 */
export function useActiveTab(): EditorTab | null {
  const tabs = useEditorStore((state) => state.tabs);
  const activeTabId = useEditorStore((state) => state.activeTabId);

  return useMemo(() => {
    return tabs.find((t) => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);
}
