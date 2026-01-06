/**
 * Tabs slice - manages multi-tab editor state.
 * 
 * This slice is a placeholder for future extraction from editor-store.ts.
 * The actual implementation remains in editor-store.ts for now.
 */

import type { StateCreator } from 'zustand';
import type { 
  EditorTab, 
  ScriptLanguage, 
  ScriptMode,
  FilePermissionStatus,
  DraftScript,
  DraftTabs,
} from '@/shared/types';
import type { RecentFileInfo } from '../../utils/document-store';

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
  recentFiles: RecentFileInfo[];
  isLoadingRecentFiles: boolean;
}

/**
 * Actions provided by the tabs slice.
 */
export interface TabsSliceActions {
  // Tab management
  getActiveTab: () => EditorTab | null;
  openTab: (tab: Omit<EditorTab, 'id'> & { id?: string }) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  setTabDisplayName: (tabId: string, name: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  duplicateTab: (tabId: string) => string;
  
  // Language/Mode
  setLanguage: (language: ScriptLanguage, force?: boolean) => void;
  setMode: (mode: ScriptMode) => void;
  
  // File operations
  openFileFromDisk: () => Promise<void>;
  openModuleFromRepository: () => Promise<void>;
  saveFile: (tabId?: string) => Promise<boolean>;
  saveFileAs: (tabId?: string) => Promise<void>;
  exportToFile: () => void;
  restoreFileHandles: () => Promise<void>;
  requestFilePermissions: () => Promise<void>;
  
  // Recent files
  loadRecentFiles: () => Promise<void>;
  openRecentFile: (tabId: string) => Promise<void>;
  
  // Draft operations
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<DraftScript | DraftTabs | null>;
  clearDraft: () => Promise<void>;
  restoreDraft: (draft: DraftScript) => void;
  restoreDraftTabs: (draftTabs: DraftTabs) => void;
  
  // Dirty state helpers
  getTabDirtyState: (tabId: string) => boolean;
  hasAnyDirtyTabs: () => boolean;
  canCommitModule: (tabId: string) => boolean;
}

/**
 * Combined slice interface.
 */
export interface TabsSlice extends TabsSliceState, TabsSliceActions {}

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
// Slice Creator (Placeholder)
// ============================================================================

/**
 * Creates the tabs slice.
 * 
 * Note: This is a placeholder. The actual implementation is still in editor-store.ts.
 * This file defines the types and initial state for future extraction.
 */
export const createTabsSlice: StateCreator<
  TabsSlice,
  [],
  [],
  TabsSlice
> = (set, get) => ({
  ...tabsSliceInitialState,

  // Placeholder implementations - actual logic is in editor-store.ts
  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId) || null;
  },
  openTab: () => '', // Implemented in editor-store.ts
  closeTab: () => { /* Implemented in editor-store.ts */ },
  closeOtherTabs: () => { /* Implemented in editor-store.ts */ },
  closeAllTabs: () => set({ tabs: [], activeTabId: null }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  updateTabContent: () => { /* Implemented in editor-store.ts */ },
  setTabDisplayName: () => { /* Implemented in editor-store.ts */ },
  reorderTabs: () => { /* Implemented in editor-store.ts */ },
  duplicateTab: () => '', // Implemented in editor-store.ts
  
  setLanguage: () => { /* Implemented in editor-store.ts */ },
  setMode: () => { /* Implemented in editor-store.ts */ },
  
  openFileFromDisk: async () => { /* Implemented in editor-store.ts */ },
  openModuleFromRepository: async () => { /* Implemented in editor-store.ts */ },
  saveFile: async () => false, // Implemented in editor-store.ts
  saveFileAs: async () => { /* Implemented in editor-store.ts */ },
  exportToFile: () => { /* Implemented in editor-store.ts */ },
  restoreFileHandles: async () => { /* Implemented in editor-store.ts */ },
  requestFilePermissions: async () => { /* Implemented in editor-store.ts */ },
  
  loadRecentFiles: async () => { /* Implemented in editor-store.ts */ },
  openRecentFile: async () => { /* Implemented in editor-store.ts */ },
  
  saveDraft: async () => { /* Implemented in editor-store.ts */ },
  loadDraft: async () => null, // Implemented in editor-store.ts
  clearDraft: async () => { /* Implemented in editor-store.ts */ },
  restoreDraft: () => { /* Implemented in editor-store.ts */ },
  restoreDraftTabs: () => { /* Implemented in editor-store.ts */ },
  
  getTabDirtyState: () => false, // Implemented in editor-store.ts
  hasAnyDirtyTabs: () => false, // Implemented in editor-store.ts
  canCommitModule: () => false, // Implemented in editor-store.ts
});

