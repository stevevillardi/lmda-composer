/**
 * Tabs slice - manages multi-tab editor state.
 * 
 * This slice handles core tab management: opening, closing, switching, and updating tabs.
 * File operations (openFileFromDisk, saveFile, etc.) remain in editor-store.ts for now
 * due to their complexity and dependencies on other systems.
 */

import type { StateCreator } from 'zustand';
import type { 
  EditorTab, 
  ScriptLanguage, 
  ScriptMode,
  FilePermissionStatus,
} from '@/shared/types';
import { getExtensionForLanguage } from '../../utils/file-extensions';
import { createScratchDocument } from '../../utils/document-helpers';
import { getDefaultScriptTemplate } from '../../config/script-templates';

// ============================================================================
// Types
// ============================================================================

/**
 * State managed by the tabs slice.
 */
export interface TabsSliceState {
  tabs: EditorTab[];
  activeTabId: string | null;
  
  // File system state
  tabsNeedingPermission: FilePermissionStatus[];
  isRestoringFileHandles: boolean;
  
  // Draft state
  hasSavedDraft: boolean;
  
  // Recent files
  recentFiles: Array<{ 
    tabId: string; 
    fileName: string; 
    lastAccessed: number;
    isRepositoryModule?: boolean;
    moduleName?: string;
    scriptType?: 'collection' | 'ad';
    portalHostname?: string;
  }>;
  isLoadingRecentFiles: boolean;
}

/**
 * Actions provided by the tabs slice.
 */
export interface TabsSliceActions {
  // Tab management
  getActiveTab: () => EditorTab | null;
  openTab: (tab: Omit<EditorTab, 'id'> & { id?: string }, options?: { activate?: boolean }) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, newName: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  updateActiveTabContent: (content: string) => void;
  setActiveTabLanguage: (language: ScriptLanguage) => void;
  setActiveTabMode: (mode: ScriptMode) => void;
  setTabContextOverride: (tabId: string, override: EditorTab['contextOverride']) => void;
  
  // Helper to create new file
  createNewFile: () => void;
  
  // Helper to get unique untitled name
  getUniqueUntitledName: (language: ScriptLanguage) => string;
}

/**
 * Combined slice interface.
 */
export interface TabsSlice extends TabsSliceState, TabsSliceActions {}

// ============================================================================
// Dependencies - state accessed from other slices
// ============================================================================

interface TabsSliceDependencies {
  // From portal slice (for module scripts)
  selectedPortalId: string | null;
  portals: Array<{ id: string; hostname: string }>;
  
  // From UI slice (for preferences)
  preferences: { defaultLanguage: ScriptLanguage; defaultMode: ScriptMode };
}

// ============================================================================
// Initial State
// ============================================================================

export const tabsSliceInitialState: TabsSliceState = {
  tabs: [],
  activeTabId: null,
  tabsNeedingPermission: [],
  isRestoringFileHandles: false,
  hasSavedDraft: false,
  recentFiles: [],
  isLoadingRecentFiles: false,
};

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Creates the tabs slice.
 */
export const createTabsSlice: StateCreator<
  TabsSlice & TabsSliceDependencies,
  [],
  [],
  TabsSlice
> = (set, get) => ({
  ...tabsSliceInitialState,

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId) ?? null;
  },

  openTab: (tabData, options) => {
    const id = tabData.id || crypto.randomUUID();
    const newTab: EditorTab = {
      id,
      kind: tabData.kind ?? 'script',
      displayName: tabData.displayName,
      content: tabData.content,
      language: tabData.language,
      mode: tabData.mode,
      source: tabData.source,
      contextOverride: tabData.contextOverride,
      api: tabData.api,
      // Unified document state
      document: tabData.document,
      // Legacy fields for backwards compatibility
      originalContent: tabData.originalContent,
      hasFileHandle: tabData.hasFileHandle,
      isLocalFile: tabData.isLocalFile,
      portalContent: tabData.portalContent,
    };
    
    const { tabs, activeTabId } = get();
    set({
      tabs: [...tabs, newTab],
      activeTabId: options?.activate === false ? activeTabId : id,
    });
    
    return id;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, tabsNeedingPermission } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    
    // NOTE: We intentionally do NOT delete file handles when closing tabs.
    // This allows them to persist in "Recent Files" for the WelcomeScreen.
    
    // Remove from permission-needed list if present
    const newTabsNeedingPermission = tabsNeedingPermission.filter(t => t.tabId !== tabId);
    
    // If we're closing the active tab, switch to another one
    let newActiveTabId: string | null = activeTabId;
    if (tabId === activeTabId) {
      if (newTabs.length === 0) {
        // No tabs left - WelcomeScreen will show
        newActiveTabId = null;
      } else {
        const targetKind = tab.kind ?? 'script';
        let nextTabId: string | null = null;

        // Prefer same-kind tab to the left
        for (let i = tabIndex - 1; i >= 0; i -= 1) {
          const candidate = tabs[i];
          if (candidate.id !== tabId && (candidate.kind ?? 'script') === targetKind) {
            nextTabId = candidate.id;
            break;
          }
        }

        // Otherwise, prefer same-kind tab to the right
        if (!nextTabId) {
          for (let i = tabIndex + 1; i < tabs.length; i += 1) {
            const candidate = tabs[i];
            if (candidate.id !== tabId && (candidate.kind ?? 'script') === targetKind) {
              nextTabId = candidate.id;
              break;
            }
          }
        }

        // Fallback: first available tab
        newActiveTabId = nextTabId ?? newTabs[0].id;
      }
    }
    
    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
      tabsNeedingPermission: newTabsNeedingPermission,
    });
  },

  closeOtherTabs: (tabId) => {
    const { tabs } = get();
    const tabToKeep = tabs.find(t => t.id === tabId);
    if (!tabToKeep) return;

    const targetKind = tabToKeep.kind ?? 'script';
    const remainingTabs = tabs.filter(t => (t.kind ?? 'script') !== targetKind || t.id === tabId);

    set({
      tabs: remainingTabs,
      activeTabId: tabId,
    });
  },

  closeAllTabs: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) {
      set({
        tabs: [],
        activeTabId: null,
      });
      return;
    }

    const targetKind = activeTab.kind ?? 'script';
    const remainingTabs = tabs.filter(t => (t.kind ?? 'script') !== targetKind);
    const nextActive = remainingTabs[0]?.id ?? null;

    set({
      tabs: remainingTabs,
      activeTabId: nextActive,
    });
  },

  setActiveTab: (tabId) => {
    const { tabs } = get();
    if (tabs.some(t => t.id === tabId)) {
      set({ activeTabId: tabId });
    }
  },

  renameTab: (tabId, newName) => {
    const { tabs } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // Ensure name has appropriate extension
    let displayName = newName.trim();
    if (!displayName) return;
    
    // Add extension if missing for script tabs
    if (tab.kind !== 'api' && !displayName.endsWith('.groovy') && !displayName.endsWith('.ps1')) {
      displayName += getExtensionForLanguage(tab.language);
    }
    
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, displayName }
          : t
      ),
    });
  },

  updateTabContent: (tabId, content) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, content }
          : t
      ),
    });
  },

  updateActiveTabContent: (content) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, content }
          : t
      ),
    });
  },

  setActiveTabLanguage: (language) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, language }
          : t
      ),
    });
  },

  setActiveTabMode: (mode) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, mode }
          : t
      ),
    });
  },

  setTabContextOverride: (tabId, override) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => 
        t.id === tabId 
          ? { ...t, contextOverride: override }
          : t
      ),
    });
  },

  createNewFile: () => {
    const { preferences, tabs } = get();
    const language = preferences.defaultLanguage;
    const mode = preferences.defaultMode;
    
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      kind: 'script',
      displayName: get().getUniqueUntitledName(language),
      content: getDefaultScriptTemplate(language),
      language,
      mode,
      document: createScratchDocument(),
    };
    
    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
    });
  },

  getUniqueUntitledName: (language) => {
    const { tabs } = get();
    const extension = language === 'groovy' ? 'groovy' : 'ps1';
    let counter = 0;
    let name = `Untitled.${extension}`;
    
    while (tabs.some(t => t.displayName === name)) {
      counter += 1;
      name = `Untitled ${counter}.${extension}`;
    }
    
    return name;
  },
});
