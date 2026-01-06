/**
 * Zustand selectors for common state derivations.
 * 
 * These selectors help avoid duplicate computation logic across components
 * and provide consistent access patterns for derived state.
 */

import { useEditorStore } from './editor-store';
import type { EditorTab, Portal, Collector, DeviceInfo, LogicModuleInfo } from '@/shared/types';

// ============================================================================
// Tab Selectors
// ============================================================================

/**
 * Returns the currently active tab, or undefined if no tab is active.
 */
export function useActiveTab(): EditorTab | undefined {
  return useEditorStore(state => 
    state.tabs.find(t => t.id === state.activeTabId)
  );
}

/**
 * Returns all tabs of a specific kind.
 */
export function useTabsByKind(kind: 'script' | 'api'): EditorTab[] {
  return useEditorStore(state =>
    state.tabs.filter(t => (t.kind ?? 'script') === kind)
  );
}

/**
 * Returns the count of tabs by kind.
 */
export function useTabCounts(): { script: number; api: number } {
  return useEditorStore(state => ({
    script: state.tabs.filter(t => (t.kind ?? 'script') === 'script').length,
    api: state.tabs.filter(t => t.kind === 'api').length,
  }));
}

/**
 * Returns whether the active tab is a module tab.
 */
export function useIsModuleTab(): boolean {
  return useEditorStore(state => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    return tab?.source?.type === 'module';
  });
}

/**
 * Returns whether the active tab is a local file tab.
 */
export function useIsLocalFileTab(): boolean {
  return useEditorStore(state => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    return tab?.source?.type === 'file';
  });
}

/**
 * Returns whether the active tab is a new/scratch tab.
 */
export function useIsNewTab(): boolean {
  return useEditorStore(state => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    return tab?.source?.type === 'new';
  });
}

// ============================================================================
// Portal Selectors
// ============================================================================

/**
 * Returns the currently selected portal, or undefined if none selected.
 */
export function useSelectedPortal(): Portal | undefined {
  return useEditorStore(state =>
    state.portals.find(p => p.id === state.selectedPortalId)
  );
}

/**
 * Returns whether a portal is currently selected.
 */
export function useHasPortal(): boolean {
  return useEditorStore(state => state.selectedPortalId !== null);
}

// ============================================================================
// Collector Selectors
// ============================================================================

/**
 * Returns the currently selected collector, or undefined if none selected.
 */
export function useSelectedCollector(): Collector | undefined {
  return useEditorStore(state =>
    state.collectors.find(c => c.id === state.selectedCollectorId)
  );
}

/**
 * Returns whether a collector is currently selected.
 */
export function useHasCollector(): boolean {
  return useEditorStore(state => state.selectedCollectorId !== null);
}

// ============================================================================
// Device Selectors
// ============================================================================

/**
 * Returns the device matching the current hostname, or undefined.
 */
export function useSelectedDevice(): DeviceInfo | undefined {
  return useEditorStore(state =>
    state.devices.find(d => d.displayName === state.hostname)
  );
}

// ============================================================================
// Module Selectors
// ============================================================================

/**
 * Returns the modules for the currently selected module type.
 */
export function useModulesForSelectedType(): LogicModuleInfo[] {
  return useEditorStore(state =>
    state.modulesCache[state.selectedModuleType] ?? []
  );
}

/**
 * Returns the metadata for the currently selected module type.
 */
export function useModuleMetaForSelectedType(): { offset: number; hasMore: boolean; total: number } {
  return useEditorStore(state =>
    state.modulesMeta[state.selectedModuleType] ?? { offset: 0, hasMore: true, total: 0 }
  );
}

/**
 * Returns whether there are any module search results.
 */
export function useHasModuleSearchResults(): boolean {
  return useEditorStore(state =>
    state.moduleScriptSearchResults.length > 0 || state.moduleDatapointSearchResults.length > 0
  );
}

// ============================================================================
// UI State Selectors
// ============================================================================

/**
 * Returns whether any dialog is currently open.
 */
export function useHasOpenDialog(): boolean {
  return useEditorStore(state =>
    state.commandPaletteOpen ||
    state.settingsDialogOpen ||
    state.executionHistoryOpen ||
    state.moduleBrowserOpen ||
    state.moduleSearchOpen ||
    state.moduleDetailsDialogOpen ||
    state.pullLatestDialogOpen
  );
}

/**
 * Returns whether the right sidebar is open.
 */
export function useRightSidebarOpen(): boolean {
  return useEditorStore(state => state.rightSidebarOpen);
}

// ============================================================================
// Execution Selectors
// ============================================================================

/**
 * Returns whether any execution is currently running.
 */
export function useIsExecuting(): boolean {
  return useEditorStore(state => state.isExecuting);
}

// ============================================================================
// Compound Selectors
// ============================================================================

/**
 * Returns context needed for script execution.
 */
export function useExecutionContext() {
  return useEditorStore(state => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    return {
      hasPortal: state.selectedPortalId !== null,
      hasCollector: state.selectedCollectorId !== null,
      hasDevice: !!state.hostname,
      isModuleTab: tab?.source?.type === 'module',
      language: tab?.language ?? 'groovy',
      mode: tab?.mode ?? 'collection',
    };
  });
}

/**
 * Returns the portal binding for the active tab, if any.
 */
export function useActiveTabPortalBinding() {
  return useEditorStore(state => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (tab?.source?.type !== 'module') return null;
    return tab.document?.portal ?? null;
  });
}
