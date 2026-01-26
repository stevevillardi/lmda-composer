/**
 * Tabs slice - manages multi-tab editor state and file operations.
 * 
 * This slice handles:
 * - Core tab management: opening, closing, switching, and updating tabs
 * - File operations: open, save, save as, recent files
 * - Draft persistence: save/restore drafts
 * - Language and mode management
 */

import type { StateCreator } from 'zustand';
import type { 
  EditorTab, 
  ScriptLanguage, 
  ScriptMode,
  FilePermissionStatus,
  DraftScript,
  DraftTabs,
  EditorTabSource,
  Portal,
  SerializableModuleDetailsDraft,
  ModuleDirectoryConfig,
} from '@/shared/types';
import { fileToasts, directoryToasts, moduleToasts } from '../../utils/toast-utils';
import { getExtensionForLanguage, getLanguageFromFilename } from '../../utils/file-extensions';
import { createScratchDocument, createLocalDocument, isFileDirty, getDocumentType, convertToLocalDocument, updateDocumentAfterSave, hasAssociatedFileHandle, getOriginalContent, extractScriptFromModule, detectScriptLanguage } from '../../utils/document-helpers';
import { getDefaultScriptTemplate, DEFAULT_GROOVY_TEMPLATE, DEFAULT_POWERSHELL_TEMPLATE } from '../../config/script-templates';
import { normalizeMode } from '../../utils/mode-utils';
import * as documentStore from '../../utils/document-store';
import { normalizeScript } from '../helpers/slice-helpers';
import { sendMessage } from '../../utils/chrome-messaging';
import type { ParseResult } from '../../utils/output-parser';
import type { ModuleDetailsDraft } from './tools-slice';

// ============================================================================
// Storage Keys
// ============================================================================

// Legacy chrome.storage.local keys - used only for migration
const LEGACY_STORAGE_KEYS = {
  DRAFT: 'lm-ide-draft',           // Legacy single-file draft
  DRAFT_TABS: 'lm-ide-draft-tabs', // Legacy multi-tab draft in chrome.storage
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

function getUniqueUntitledName(tabs: EditorTab[], language: ScriptLanguage): string {
  const extension = language === 'groovy' ? 'groovy' : 'ps1';
  let counter = 0;
  let displayName = `Untitled.${extension}`;

  while (tabs.some(t => t.displayName === displayName)) {
    counter += 1;
    displayName = `Untitled ${counter}.${extension}`;
  }

  return displayName;
}

/**
 * Finds the next tab to activate after closing a tab.
 * Prefers same-kind tab to the left, then right, then falls back to any tab.
 */
function findNextTabAfterClose(
  tabs: EditorTab[],
  closedTabId: string,
  closedTabIndex: number,
  closedTabKind: 'script' | 'api'
): string | null {
  // Filter to same-kind tabs (excluding the one being closed)
  const sameKindTabs = tabs
    .map((t, idx) => ({ tab: t, originalIndex: idx }))
    .filter(({ tab }) => tab.id !== closedTabId && (tab.kind ?? 'script') === closedTabKind);

  if (sameKindTabs.length === 0) {
    // No same-kind tabs left, return first remaining tab
    const remaining = tabs.filter(t => t.id !== closedTabId);
    return remaining[0]?.id ?? null;
  }

  // Find the closest same-kind tab to the left
  const leftCandidate = sameKindTabs
    .filter(({ originalIndex }) => originalIndex < closedTabIndex)
    .pop();

  if (leftCandidate) {
    return leftCandidate.tab.id;
  }

  // Otherwise, find closest same-kind tab to the right
  const rightCandidate = sameKindTabs
    .find(({ originalIndex }) => originalIndex > closedTabIndex);

  return rightCandidate?.tab.id ?? sameKindTabs[0]?.tab.id ?? null;
}

/**
 * Updates a single tab in the tabs array by ID.
 * Returns a new array with the updated tab, or the original array if tab not found.
 * 
 * @param tabs - Current tabs array
 * @param tabId - ID of the tab to update
 * @param updates - Partial updates to apply to the tab
 * @returns New tabs array with the update applied
 */
function updateTabById(
  tabs: EditorTab[],
  tabId: string,
  updates: Partial<EditorTab> | ((tab: EditorTab) => Partial<EditorTab>)
): EditorTab[] {
  return tabs.map(t => {
    if (t.id !== tabId) return t;
    const partialUpdates = typeof updates === 'function' ? updates(t) : updates;
    return { ...t, ...partialUpdates };
  });
}

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
  
  // Recent files and directories
  recentFiles: Array<{ 
    tabId: string; 
    fileName: string; 
    lastAccessed: number;
  }>;
  recentDirectories: Array<{
    id: string;
    directoryName: string;
    moduleName: string;
    portalHostname: string;
    moduleType: string;
    lastAccessed: number;
  }>;
  isLoadingRecentFiles: boolean;
  
  // Open module directory dialog
  openModuleDirectoryDialogOpen: boolean;
  openModuleDirectoryDialogId: string | null;
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
  
  // Language and mode (with template switching)
  setLanguage: (language: ScriptLanguage, force?: boolean) => void;
  setMode: (mode: ScriptMode) => void;
  
  // Draft management
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<DraftScript | DraftTabs | null>;
  clearDraft: () => Promise<void>;
  restoreDraft: (draft: DraftScript) => void;
  restoreDraftTabs: (draftTabs: DraftTabs) => void;
  /** Merge draft tabs with existing tabs (used when URL params opened tabs first) */
  mergeDraftTabs: (draftTabs: DraftTabs) => void;
  
  // File export
  exportToFile: () => void;
  
  // File operations
  openFileFromDisk: () => Promise<void>;
  saveFile: (tabId?: string) => Promise<boolean>;
  saveFileAs: (tabId?: string) => Promise<boolean>;
  restoreFileHandles: () => Promise<void>;
  requestFilePermissions: () => Promise<void>;
  
  // Dirty state helpers
  isTabDirty: (tabId: string) => boolean;
  getTabDirtyState: (tab: EditorTab) => boolean;
  
  // Recent files
  loadRecentFiles: () => Promise<void>;
  openRecentFile: (fileHandleId: string) => Promise<void>;
  
  // Create local copy
  createLocalCopyFromTab: (tabId: string, options?: { activate?: boolean }) => string | null;
  
  // Module directory operations
  saveModuleDirectory: (tabId?: string) => Promise<boolean>;
  openModuleDirectory: (directoryId: string, scriptsToOpen?: Array<'collection' | 'ad'>) => Promise<boolean>;
  openModuleFolderFromDisk: () => Promise<boolean>;
  showOpenModuleDirectoryDialog: (directoryId: string) => void;
  setOpenModuleDirectoryDialogOpen: (open: boolean) => void;
}

/**
 * Combined slice interface.
 */
export interface TabsSlice extends TabsSliceState, TabsSliceActions {}

// ============================================================================
// Dependencies - state and actions accessed from other slices
// ============================================================================

export interface TabsSliceDependencies {
  // From portal slice (for module scripts)
  selectedPortalId: string | null;
  portals: Portal[];

  // From UI slice (for preferences, output tab, and workspace)
  preferences: { defaultLanguage: ScriptLanguage; defaultMode: ScriptMode };
  outputTab: 'raw' | 'parsed' | 'validation' | 'graph';
  activeWorkspace: 'script' | 'api' | 'collector-sizing' | 'devtools';
  setActiveWorkspace: (workspace: 'script' | 'api' | 'collector-sizing' | 'devtools') => void;
  
  // From execution slice (for clearing parsed output when mode changes)
  parsedOutput: ParseResult | null;
  
  // From module slice (for save options dialog)
  setSaveOptionsDialogOpen: (open: boolean, tabId?: string) => void;
  
  // From tools slice (for module details drafts persistence)
  moduleDetailsDraftByTabId: Record<string, ModuleDetailsDraft>;
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
  recentDirectories: [],
  isLoadingRecentFiles: false,
  openModuleDirectoryDialogOpen: false,
  openModuleDirectoryDialogId: null,
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

  // =====================
  // Core Tab Management
  // =====================

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId) ?? null;
  },

  openTab: (tabData, options) => {
    const id = tabData.id || crypto.randomUUID();
    const tabKind = tabData.kind ?? 'script';
    const newTab: EditorTab = {
      id,
      kind: tabKind,
      displayName: tabData.displayName,
      content: tabData.content,
      language: tabData.language,
      mode: tabData.mode,
      source: tabData.source,
      contextOverride: tabData.contextOverride,
      api: tabData.api,
      fileHandleId: tabData.fileHandleId,
      document: tabData.document ?? createScratchDocument(),
    };
    
    const { tabs, activeTabId, setActiveWorkspace } = get();
    const shouldActivate = options?.activate !== false;
    
    // Set workspace based on tab kind if activating
    if (shouldActivate) {
      setActiveWorkspace(tabKind === 'api' ? 'api' : 'script');
    }
    
    set({
      tabs: [...tabs, newTab],
      activeTabId: shouldActivate ? id : activeTabId,
    });
    
    return id;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, tabsNeedingPermission } = get();
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;
    
    const tab = tabs[tabIndex];
    const newTabs = tabs.filter(t => t.id !== tabId);
    
    // NOTE: We intentionally do NOT delete file handles when closing tabs.
    // This allows them to persist in "Recent Files" for the WelcomeScreen.
    
    // Remove from permission-needed list if present
    const newTabsNeedingPermission = tabsNeedingPermission.filter(t => t.tabId !== tabId);
    
    // Determine new active tab if closing the current one
    let newActiveTabId: string | null = activeTabId;
    if (tabId === activeTabId) {
      newActiveTabId = newTabs.length === 0
        ? null
        : findNextTabAfterClose(tabs, tabId, tabIndex, tab.kind ?? 'script');
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
    const { tabs, setActiveWorkspace } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      // Update workspace based on the tab kind
      setActiveWorkspace(tab.kind === 'api' ? 'api' : 'script');
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
    
    set({ tabs: updateTabById(tabs, tabId, { displayName }) });
  },

  updateTabContent: (tabId, content) => {
    const { tabs } = get();
    set({ tabs: updateTabById(tabs, tabId, { content }) });
  },

  updateActiveTabContent: (content) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({ tabs: updateTabById(tabs, activeTabId, { content }) });
  },

  setActiveTabLanguage: (language) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({ tabs: updateTabById(tabs, activeTabId, { language }) });
  },

  setActiveTabMode: (mode) => {
    const { tabs, activeTabId } = get();
    if (!activeTabId) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;

    set({ tabs: updateTabById(tabs, activeTabId, { mode }) });
  },

  setTabContextOverride: (tabId, override) => {
    const { tabs } = get();
    set({ tabs: updateTabById(tabs, tabId, { contextOverride: override }) });
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
    return getUniqueUntitledName(tabs, language);
  },

  // =====================
  // Language and Mode
  // =====================

  setLanguage: (language, force = false) => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;
    
    // If same language, do nothing
    if (language === activeTab.language) return;
    
    // Normalize scripts for comparison (trim whitespace, normalize line endings)
    const isDefaultGroovy = normalizeScript(activeTab.content) === normalizeScript(DEFAULT_GROOVY_TEMPLATE);
    const isDefaultPowershell = normalizeScript(activeTab.content) === normalizeScript(DEFAULT_POWERSHELL_TEMPLATE);
    
    // Determine new content
    let newContent = activeTab.content;
    let newDisplayName = activeTab.displayName;
    let shouldClearFileHandle = false;
    
    // Switch templates if:
    // - force is true (user confirmed reset)
    // - script is a default template
    if (force || isDefaultGroovy || isDefaultPowershell) {
      newContent = language === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE;
    }
    
    // Update display name extension to match new language
    const filenameMatch = activeTab.displayName.match(/^(.+)\.(groovy|ps1)$/);
    
    if (filenameMatch) {
      const baseName = filenameMatch[1];
      newDisplayName = `${baseName}.${language === 'groovy' ? 'groovy' : 'ps1'}`;
      
      // If this tab has a file handle, disconnect it since the extension no longer matches
      if (hasAssociatedFileHandle(activeTab)) {
        shouldClearFileHandle = true;
      }
    }
    
    set({
      tabs: updateTabById(tabs, activeTab.id, {
        language, 
        content: newContent, 
        displayName: newDisplayName,
        // Clear fileHandleId when disconnecting (old handle remains in IndexedDB for recent files)
        fileHandleId: shouldClearFileHandle ? undefined : activeTab.fileHandleId,
        // Also update document state when clearing file handle
        document: shouldClearFileHandle ? createScratchDocument() : activeTab.document,
      }),
    });
    
    // Notify user that the file handle was disconnected
    if (shouldClearFileHandle) {
      fileToasts.handleDisconnected();
    }
  },

  setMode: (mode) => {
    const { tabs, activeTabId, outputTab } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.kind === 'api') return;
    
    // Clear parsed output and switch to raw tab if in freeform mode
    const updates: Partial<TabsSlice & TabsSliceDependencies> = {
      parsedOutput: null, // Always clear parsed output when mode changes
    };
    if (mode === 'freeform' && (outputTab === 'parsed' || outputTab === 'validation' || outputTab === 'graph')) {
      updates.outputTab = 'raw';
    }
    
    set({
      ...updates,
      tabs: updateTabById(tabs, activeTab.id, { mode }),
    } as Partial<TabsSlice & TabsSliceDependencies>);
  },

  // =====================
  // Draft Management
  // =====================

  saveDraft: async () => {
    try {
      const { tabs, activeTabId, hasSavedDraft, moduleDetailsDraftByTabId, activeWorkspace } = get();
      
      // Check if all tabs are default templates (nothing to save)
      const hasApiTabs = tabs.some(tab => tab.kind === 'api');
      const hasNonDefaultContent = hasApiTabs || tabs.some(tab => {
        if (tab.kind === 'api') return false;
        const normalizedContent = normalizeScript(tab.content);
        const isDefaultGroovy = normalizedContent === normalizeScript(DEFAULT_GROOVY_TEMPLATE);
        const isDefaultPowershell = normalizedContent === normalizeScript(DEFAULT_POWERSHELL_TEMPLATE);
        return !isDefaultGroovy && !isDefaultPowershell;
      });
      
      // Also check if there are any module details drafts with changes
      const hasModuleDetailsDrafts = Object.keys(moduleDetailsDraftByTabId).length > 0;
      
      // Skip saving if all tabs are default templates and no module details
      if (!hasNonDefaultContent && tabs.length <= 1 && !hasModuleDetailsDrafts) {
        // If there was a saved draft, clear it since we're back to default
        if (hasSavedDraft) {
          await documentStore.clearTabDrafts();
          set({ hasSavedDraft: false });
        }
        return;
      }
      
      // Serialize module details drafts (convert Set to Array)
      const serializedModuleDetailsDrafts: Record<string, SerializableModuleDetailsDraft> = {};
      for (const [tabId, draft] of Object.entries(moduleDetailsDraftByTabId)) {
        serializedModuleDetailsDrafts[tabId] = {
          original: draft.original as Record<string, unknown> | null,
          draft: draft.draft as Record<string, unknown>,
          dirtyFields: Array.from(draft.dirtyFields),
          loadedAt: draft.loadedAt,
          tabId: draft.tabId,
          moduleId: draft.moduleId,
          moduleType: draft.moduleType,
          portalId: draft.portalId,
          version: draft.version,
        };
      }
      
      const draftTabs: DraftTabs = {
        tabs,
        activeTabId,
        lastModified: Date.now(),
        moduleDetailsDrafts: serializedModuleDetailsDrafts,
        activeWorkspace,
      };
      
      await documentStore.saveTabDrafts(draftTabs);
      set({ hasSavedDraft: true });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  },

  loadDraft: async () => {
    try {
      // First try to load from IndexedDB (new storage location)
      const idbDrafts = await documentStore.loadTabDrafts();
      if (idbDrafts) {
        // Validate that the draft has tabs - skip 0-tab drafts
        if ('tabs' in idbDrafts && idbDrafts.tabs.length === 0) {
          console.log('[tabs-slice] Skipping draft with 0 tabs');
          await documentStore.clearTabDrafts();
          return null;
        }
        set({ hasSavedDraft: true });
        return idbDrafts;
      }
      
      // Migration: Check chrome.storage.local for legacy drafts
      // First try multi-tab draft
      const tabsResult = await chrome.storage.local.get(LEGACY_STORAGE_KEYS.DRAFT_TABS);
      if (tabsResult[LEGACY_STORAGE_KEYS.DRAFT_TABS]) {
        const draftTabs = tabsResult[LEGACY_STORAGE_KEYS.DRAFT_TABS] as DraftTabs;
        
        // Validate that the draft has tabs - skip 0-tab drafts
        if (draftTabs.tabs.length === 0) {
          console.log('[tabs-slice] Skipping legacy draft with 0 tabs');
          await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.DRAFT_TABS);
          await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.DRAFT);
          return null;
        }
        
        // Migrate to IndexedDB
        await documentStore.saveTabDrafts(draftTabs);
        
        // Clear legacy storage
        await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.DRAFT_TABS);
        await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.DRAFT);
        
        console.log('[tabs-slice] Migrated multi-tab draft from chrome.storage.local to IndexedDB');
        set({ hasSavedDraft: true });
        return draftTabs;
      }
      
      // Fall back to legacy single-file draft
      const result = await chrome.storage.local.get(LEGACY_STORAGE_KEYS.DRAFT);
      if (result[LEGACY_STORAGE_KEYS.DRAFT]) {
        const legacyDraft = result[LEGACY_STORAGE_KEYS.DRAFT] as DraftScript;
        
        // Clear legacy storage (don't migrate single-file drafts, they're outdated)
        await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.DRAFT);
        
        console.log('[tabs-slice] Found legacy single-file draft');
        set({ hasSavedDraft: true });
        return legacyDraft;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  },

  clearDraft: async () => {
    try {
      // Clear IndexedDB drafts
      await documentStore.clearTabDrafts();
      
      // Also clear any legacy storage to ensure clean state
      await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.DRAFT);
      await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.DRAFT_TABS);
      
      set({ hasSavedDraft: false });
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  },

  restoreDraft: (draft) => {
    // Create a tab from the legacy draft format
    const extension = draft.language === 'groovy' ? 'groovy' : 'ps1';
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      displayName: `Recovered.${extension}`,
      content: draft.script,
      language: draft.language,
      mode: normalizeMode(draft.mode),
      document: createScratchDocument(),
    };
    
    set({
      tabs: [newTab],
      activeTabId: newTab.id,
      hasSavedDraft: true, // Mark as having saved draft so auto-save will update it
    });
    // Don't call clearDraft here - let the auto-save overwrite instead
    // This prevents race conditions where clear happens before save
  },
  
  restoreDraftTabs: (draftTabs) => {
    const { setActiveWorkspace } = get();
    
    // Normalize any legacy mode values to valid modes
    const normalizedTabs = draftTabs.tabs.map(tab => ({
      ...tab,
      mode: normalizeMode(tab.mode),
    }));
    
    // Restore module details drafts if present (convert Array back to Set)
    const restoredModuleDetailsDrafts: Record<string, ModuleDetailsDraft> = {};
    
    if (draftTabs.moduleDetailsDrafts) {
      for (const [tabId, serialized] of Object.entries(draftTabs.moduleDetailsDrafts)) {
        restoredModuleDetailsDrafts[tabId] = {
          original: serialized.original,
          draft: serialized.draft,
          dirtyFields: new Set(serialized.dirtyFields),
          loadedAt: serialized.loadedAt,
          tabId: serialized.tabId,
          moduleId: serialized.moduleId,
          moduleType: serialized.moduleType,
          portalId: serialized.portalId,
          version: serialized.version,
        } as ModuleDetailsDraft;
      }
    }
    
    set({
      tabs: normalizedTabs,
      activeTabId: draftTabs.activeTabId,
      hasSavedDraft: true, // Mark as having saved draft so auto-save will update it
      moduleDetailsDraftByTabId: restoredModuleDetailsDrafts,
    });
    
    // Restore the active workspace if saved, but ensure it matches the active tab's kind
    // If active tab is a script tab, use script workspace regardless of saved workspace
    const activeTab = normalizedTabs.find(t => t.id === draftTabs.activeTabId);
    if (activeTab) {
      const tabKind = activeTab.kind ?? 'script';
      setActiveWorkspace(tabKind === 'api' ? 'api' : 'script');
    } else if (draftTabs.activeWorkspace) {
      setActiveWorkspace(draftTabs.activeWorkspace);
    }
    // Don't call clearDraft here - let the auto-save overwrite instead
  },
  
  mergeDraftTabs: (draftTabs) => {
    const { tabs: existingTabs, activeTabId: existingActiveTabId } = get();
    
    // Get IDs of existing tabs to avoid duplicates
    const existingTabIds = new Set(existingTabs.map(t => t.id));
    
    // Normalize any legacy mode values to valid modes
    const normalizedDraftTabs = draftTabs.tabs
      .filter(tab => !existingTabIds.has(tab.id)) // Exclude tabs that already exist
      .map(tab => ({
        ...tab,
        mode: normalizeMode(tab.mode),
      }));
    
    // Merge draft tabs with existing tabs (existing tabs come first, they're from URL params)
    const mergedTabs = [...existingTabs, ...normalizedDraftTabs];
    
    // Restore module details drafts if present (convert Array back to Set)
    // Only for tabs that are in the merged set
    const restoredModuleDetailsDrafts: Record<string, ModuleDetailsDraft> = {};
    
    if (draftTabs.moduleDetailsDrafts) {
      const mergedTabIds = new Set(mergedTabs.map(t => t.id));
      for (const [tabId, serialized] of Object.entries(draftTabs.moduleDetailsDrafts)) {
        if (mergedTabIds.has(tabId)) {
          restoredModuleDetailsDrafts[tabId] = {
            original: serialized.original,
            draft: serialized.draft,
            dirtyFields: new Set(serialized.dirtyFields),
            loadedAt: serialized.loadedAt,
            tabId: serialized.tabId,
            moduleId: serialized.moduleId,
            moduleType: serialized.moduleType,
            portalId: serialized.portalId,
            version: serialized.version,
          } as ModuleDetailsDraft;
        }
      }
    }
    
    // Keep existing active tab if present, otherwise use the first existing tab
    // This ensures the URL-opened module tab stays active
    const activeTabId = existingActiveTabId ?? mergedTabs[0]?.id ?? null;
    
    set({
      tabs: mergedTabs,
      activeTabId,
      hasSavedDraft: true,
      moduleDetailsDraftByTabId: restoredModuleDetailsDrafts,
    });
  },

  // =====================
  // File Export
  // =====================

  exportToFile: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    
    const extension = getExtensionForLanguage(activeTab.language);
    const baseName = activeTab.displayName.replace(/\.(groovy|ps1)$/, '');
    const fileName = `${baseName}${extension}`;

    const blob = new Blob([activeTab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // =====================
  // File Operations
  // =====================

  openFileFromDisk: async () => {
    // Check if File System Access API is supported
    if (!documentStore.isFileSystemAccessSupported()) {
      // Fallback to input element for unsupported browsers
      return new Promise<void>((resolve) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.groovy,.ps1,.txt';
        
        fileInput.onchange = async (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (!file) {
            resolve();
            return;
          }
          
          const content = await file.text();
          const fileName = file.name;
          const isGroovy = fileName.endsWith('.groovy');
          
          const newTab: EditorTab = {
            id: crypto.randomUUID(),
            displayName: fileName,
            content,
            language: isGroovy ? 'groovy' : 'powershell',
            mode: 'freeform',
            source: { type: 'file' },
            document: createScratchDocument(), // No persistent file handle via input element
          };
          
          set({
            tabs: [...get().tabs, newTab],
            activeTabId: newTab.id,
          });
          resolve();
        };
        
        fileInput.click();
      });
    }

    try {
      // Use File System Access API
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Script Files',
            accept: {
              'text/plain': ['.groovy', '.ps1', '.txt'],
            },
          },
        ],
        multiple: false,
      });
      
      // Read file content
      const file = await handle.getFile();
      const content = await file.text();
      const fileName = file.name;
      const isGroovy = fileName.endsWith('.groovy');
      
      // Generate tab ID
      const tabId = crypto.randomUUID();
      
      // Store handle in IndexedDB - may return existing ID if file was opened before
      const fileHandleId = await documentStore.saveFileHandle(crypto.randomUUID(), handle, fileName);
      
      // Create new tab
      const source: EditorTabSource = { type: 'file' };
      const displayName = fileName;
      const mode: ScriptMode = 'freeform';
      const newTab: EditorTab = {
        id: tabId,
        displayName,
        content,
        language: isGroovy ? 'groovy' : 'powershell',
        mode,
        fileHandleId,
        source,
        document: createLocalDocument(fileHandleId, content, fileName),
      };
      
      set({
        tabs: [...get().tabs, newTab],
        activeTabId: tabId,
      });
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Error opening file:', error);
      }
    }
  },


  saveFile: async (tabId?: string) => {
    const { activeTabId, setSaveOptionsDialogOpen } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) {
      return false;
    }
    
    // Get fresh tab state
    const tab = get().tabs.find(t => t.id === targetTabId);
    if (!tab) {
      return false;
    }

    // Directory-based saves (module directories) - check this FIRST
    // This ensures directory-saved modules save directly to disk without prompting
    if (tab.directoryHandleId && tab.source?.scriptType) {
      try {
        const storedDir = await documentStore.getDirectoryHandleRecord(tab.directoryHandleId);
        if (!storedDir) {
          directoryToasts.handleNotFound();
          return false;
        }

        // Request permission
        const handleWithPermission = storedDir.handle as unknown as { 
          requestPermission(options?: { mode?: string }): Promise<PermissionState>;
        };
        const permissionStatus = await handleWithPermission.requestPermission({ mode: 'readwrite' });
        if (permissionStatus !== 'granted') {
          directoryToasts.permissionDenied();
          return false;
        }

        // Determine filename based on script type and language
        const extension = tab.language === 'powershell' ? '.ps1' : '.groovy';
        const fileName = tab.source.scriptType === 'ad' ? `ad${extension}` : `collection${extension}`;

        // Get fresh content
        const currentTab = get().tabs.find(t => t.id === targetTabId);
        if (!currentTab) return false;
        const contentToSave = currentTab.content;

        // Write script to directory
        await documentStore.writeFileToDirectory(storedDir.handle, fileName, contentToSave);

        // Update module.json with new disk checksum
        const moduleJsonContent = await documentStore.readFileFromDirectory(storedDir.handle, 'module.json');
        if (moduleJsonContent) {
          const moduleConfig = JSON.parse(moduleJsonContent);
          const scriptKey = tab.source.scriptType === 'ad' ? 'ad' : 'collection';
          if (moduleConfig.scripts?.[scriptKey]) {
            moduleConfig.scripts[scriptKey].diskChecksum = await documentStore.computeChecksum(contentToSave);
            moduleConfig.scripts[scriptKey].fileName = fileName;
          }
          await documentStore.writeFileToDirectory(storedDir.handle, 'module.json', JSON.stringify(moduleConfig, null, 2));
        }

        // Update lastAccessed for the directory handle
        await documentStore.touchDirectoryHandle(tab.directoryHandleId);

        // Update document state after save
        set({
          tabs: updateTabById(get().tabs, targetTabId, (t) => ({
            document: t.document 
              ? updateDocumentAfterSave(t.document, contentToSave) 
              : convertToLocalDocument(targetTabId, contentToSave, t.displayName),
          })),
        });

        fileToasts.saved();
        return true;
      } catch (error) {
        fileToasts.saveFailed(error instanceof Error ? error : undefined);
        return false;
      }
    }

    // Portal documents (not already saved to a directory) use the save options dialog
    const docType = getDocumentType(tab);
    if (docType === 'portal') {
      setSaveOptionsDialogOpen(true, targetTabId);
      return false;
    }

    // If no file handle, redirect to Save As (handles language change disconnect)
    if (!hasAssociatedFileHandle(tab) || !tab.fileHandleId) {
      return await get().saveFileAs(targetTabId);
    }

    try {
      // Look up existing handle in IndexedDB using fileHandleId
      const handle = await documentStore.getFileHandle(tab.fileHandleId);
      
      if (!handle) {
        // Handle not found in IndexedDB - trigger Save As
        return await get().saveFileAs(targetTabId);
      }
      
      // Check permission
      const permission = await documentStore.queryFilePermission(handle);
      
      if (permission === 'granted') {
        // Get fresh content at time of save
        const currentTab = get().tabs.find(t => t.id === targetTabId);
        if (!currentTab) return false;
        const contentToSave = currentTab.content;
        
        // Write to file
        await documentStore.writeToHandle(handle, contentToSave);
        
        // Update lastAccessed timestamp (use fileHandleId for storage)
        await documentStore.saveFileHandle(tab.fileHandleId, handle, currentTab.displayName);
        
        // Update document state after save
        set({
          tabs: updateTabById(get().tabs, targetTabId, (t) => ({
            document: t.document 
              ? updateDocumentAfterSave(t.document, contentToSave) 
              : convertToLocalDocument(targetTabId, contentToSave, t.displayName),
          })),
        });
        
        fileToasts.saved();
        return true;
      } else if (permission === 'prompt') {
        // Request permission
        const granted = await documentStore.requestFilePermission(handle);
        if (granted) {
          // Get fresh content after permission granted
          const currentTab = get().tabs.find(t => t.id === targetTabId);
          if (!currentTab) return false;
          const contentToSave = currentTab.content;
          
          await documentStore.writeToHandle(handle, contentToSave);
          await documentStore.saveFileHandle(tab.fileHandleId, handle, currentTab.displayName);
          
          set({
            tabs: updateTabById(get().tabs, targetTabId, (t) => ({
              document: t.document 
                ? updateDocumentAfterSave(t.document, contentToSave) 
                : convertToLocalDocument(targetTabId, contentToSave, t.displayName),
            })),
          });
          
          fileToasts.saved();
          return true;
        }
      }
      
      // Permission denied - trigger Save As
      return await get().saveFileAs(targetTabId);
    } catch (error) {
      console.error('Error saving file:', error);
      fileToasts.saveFailed(error instanceof Error ? error : undefined);
      return false;
    }
  },

  saveFileAs: async (tabId?: string) => {
    const { tabs, activeTabId, setSaveOptionsDialogOpen } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) {
      return false;
    }
    
    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab) {
      return false;
    }

    // For portal-bound modules (including directory-saved ones), show save options dialog
    const docType = getDocumentType(tab);
    if (docType === 'portal' || (docType === 'local' && tab.document?.portal)) {
      setSaveOptionsDialogOpen(true, targetTabId);
      return false;
    }

    // Check if File System Access API is supported
    if (!documentStore.isFileSystemAccessSupported()) {
      // Fallback to download
      get().exportToFile();
      fileToasts.exported();
      return true;
    }

    try {
      const extension = getExtensionForLanguage(tab.language);
      const baseName = tab.displayName.replace(/\.(groovy|ps1)$/, '');
      const suggestedName = baseName + extension;
      
      // Show save picker
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Script Files',
            accept: { 'text/plain': [extension] },
          },
        ],
      });
      
      // Get current content at time of save
      const currentTab = get().tabs.find(t => t.id === targetTabId);
      const contentToSave = currentTab?.content ?? tab.content;
      
      // Write content to file
      await documentStore.writeToHandle(handle, contentToSave);
      
      // Store new handle in IndexedDB - may return existing ID if file was saved before
      const newFileHandleId = await documentStore.saveFileHandle(crypto.randomUUID(), handle, handle.name);
      
      // Update tab state with new document
      set({
        tabs: updateTabById(get().tabs, targetTabId, {
          displayName: handle.name,
          fileHandleId: newFileHandleId,
          source: { type: 'file' },
          document: convertToLocalDocument(newFileHandleId, contentToSave, handle.name),
        }),
      });
      
      fileToasts.saved();
      return true;
    } catch (error) {
      // Check for expected DOMExceptions that shouldn't show error toasts
      const isDOMException = error instanceof DOMException;
      
      if (isDOMException) {
        // User cancelled file picker
        if (error.name === 'AbortError') {
          return false;
        }
        // User activation required - happens when save is triggered without direct user interaction
        // (e.g., from keyboard shortcut losing activation context, or programmatic calls)
        // This is expected behavior, not an error to show to users
        if (error.name === 'NotAllowedError') {
          return false;
        }
      }
      
      // Log and show toast for unexpected errors
      console.error('Error in Save As:', error);
      fileToasts.saveFailed(error instanceof Error ? error : String(error));
      return false;
    }
  },

  restoreFileHandles: async () => {
    set({ isRestoringFileHandles: true });
    
    try {
      const { tabs } = get();
      const storedHandles = await documentStore.getAllFileHandles();
      const needsPermission: FilePermissionStatus[] = [];
      
      // Check permission for each handle that matches a currently open tab
      for (const [tabId, record] of storedHandles) {
        // Only process handles for tabs that are currently open
        const tabExists = tabs.some(t => t.id === tabId);
        if (!tabExists) {
          // Skip handles for closed tabs - keep them for recent files
          continue;
        }
        
        const permission = await documentStore.queryFilePermission(record.handle);
        
        if (permission === 'prompt') {
          needsPermission.push({
            tabId,
            fileName: record.fileName,
            state: 'prompt',
          });
        } else if (permission === 'denied') {
          // Update tab to reflect no handle access - convert to scratch document
          set({
            tabs: updateTabById(get().tabs, tabId, { 
              fileHandleId: undefined, 
              document: createScratchDocument() 
            }),
          });
        }
        // If granted, handle is ready to use - no action needed
      }
      
      set({ 
        tabsNeedingPermission: needsPermission,
        isRestoringFileHandles: false,
      });
    } catch (error) {
      console.error('Error restoring file handles:', error);
      set({ isRestoringFileHandles: false });
    }
  },

  requestFilePermissions: async () => {
    const { tabsNeedingPermission, tabs } = get();
    const stillNeedsPermission: FilePermissionStatus[] = [];
    
    for (const status of tabsNeedingPermission) {
      try {
        const handle = await documentStore.getFileHandle(status.tabId);
        if (!handle) continue;
        
        const granted = await documentStore.requestFilePermission(handle);
        
        if (granted) {
          // Optionally re-read file content to check for external changes
          try {
            const newContent = await documentStore.readFromHandle(handle);
            const tab = tabs.find(t => t.id === status.tabId);
            
            if (tab && getOriginalContent(tab) !== newContent) {
              // File was modified externally - update baseline content
              // Keep user's current edits, but update the baseline
              set({
                tabs: updateTabById(get().tabs, status.tabId, (t) => ({
                  document: t.document ? updateDocumentAfterSave(t.document, newContent) : t.document,
                })),
              });
            }
            // If content hasn't changed, document state is already correct
          } catch {
            // File might have been deleted - no action needed, document state is still valid
          }
        } else {
          stillNeedsPermission.push(status);
        }
      } catch {
        stillNeedsPermission.push(status);
      }
    }
    
    set({ tabsNeedingPermission: stillNeedsPermission });
  },

  // =====================
  // Dirty State Helpers
  // =====================

  isTabDirty: (tabId: string) => {
    const tab = get().tabs.find(t => t.id === tabId);
    if (!tab) return false;
    return get().getTabDirtyState(tab);
  },

  getTabDirtyState: (tab: EditorTab) => {
    // Use the unified document helper for dirty state detection
    // This handles both new DocumentState and legacy fields
    return isFileDirty(tab);
  },

  // =====================
  // Recent Files
  // =====================

  loadRecentFiles: async () => {
    set({ isLoadingRecentFiles: true });
    try {
      const [recentFiles, recentDirectories] = await Promise.all([
        documentStore.getRecentFileHandles(10),
        documentStore.getRecentDirectoryHandles(10),
      ]);
      
      set({ recentFiles, recentDirectories, isLoadingRecentFiles: false });
    } catch (error) {
      console.error('Failed to load recent files:', error);
      set({ recentFiles: [], recentDirectories: [], isLoadingRecentFiles: false });
    }
  },

  openRecentFile: async (fileHandleId: string) => {
    // Note: The parameter is called fileHandleId because that's what the recent files list stores.
    // It's the IndexedDB storage key for the file handle, not a tab ID.

    try {
      const handle = await documentStore.getFileHandle(fileHandleId);
      if (!handle) {
        // Handle not found - just delete this one entry and reload
        await documentStore.deleteFileHandle(fileHandleId);
        await get().loadRecentFiles();
        fileToasts.notFound();
        return;
      }

      // Check permission
      let permission = await documentStore.queryFilePermission(handle);
      if (permission !== 'granted') {
        permission = (await documentStore.requestFilePermission(handle)) ? 'granted' : 'denied';
      }

      if (permission !== 'granted') {
        // User denied permission - don't remove from list, they might grant it later
        fileToasts.permissionRequired(handle.name);
        return;
      }

      // Try to read file content - this will fail if file was deleted from disk
      let content: string;
      try {
        content = await documentStore.readFromHandle(handle);
      } catch (readError) {
        // File likely deleted from disk - remove this specific handle only
        // (other handles with the same filename might point to different files)
        await documentStore.deleteFileHandle(fileHandleId);
        await get().loadRecentFiles();
        
        const isNotFoundError = readError instanceof DOMException && 
          (readError.name === 'NotFoundError' || readError.name === 'NotReadableError');
        
        if (isNotFoundError) {
          fileToasts.noLongerExists(handle.name);
        } else {
          fileToasts.unableToRead(handle.name);
        }
        return;
      }

      const fileName = handle.name;
      const language: ScriptLanguage = getLanguageFromFilename(fileName);
      
      // Update lastAccessed in IndexedDB
      await documentStore.saveFileHandle(fileHandleId, handle, fileName);

      // Generate a new tab ID for this session (separate from fileHandleId)
      const newTabId = crypto.randomUUID();
      
      // Create regular file tab
      const newTab: EditorTab = {
        id: newTabId,
        displayName: fileName,
        content,
        language,
        mode: 'freeform',
        fileHandleId,
        document: createLocalDocument(fileHandleId, content, fileName),
      };

      set({
        tabs: [...get().tabs, newTab],
        activeTabId: newTabId,
      });
    } catch (error) {
      console.error('Failed to open recent file:', error);
      fileToasts.openFailed(error instanceof Error ? error : undefined);
    }
  },

  // =====================
  // Module Directory Operations
  // =====================

  saveModuleDirectory: async (tabId?: string) => {
    const { tabs, activeTabId, moduleDetailsDraftByTabId } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) {
      return false;
    }

    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab || tab.kind === 'api') {
      directoryToasts.cannotSave('This tab cannot be saved as a module directory.');
      return false;
    }

    // Validate this is a portal-bound module
    if (!tab.source || tab.source.type !== 'module') {
      directoryToasts.cannotSave('Only portal-bound modules can be saved as module directories.');
      return false;
    }

    const { moduleId, moduleName, moduleType, portalId, portalHostname, lineageId } = tab.source;
    if (!moduleId || !moduleName || !moduleType || !portalId || !portalHostname) {
      directoryToasts.cannotSave('Missing module binding information.');
      return false;
    }
    

    try {
      // Show directory picker - user selects parent folder
      // TypeScript doesn't have full types for showDirectoryPicker options
      const parentDirHandle = await (window as unknown as { 
        showDirectoryPicker(options?: { mode?: string; startIn?: string }): Promise<FileSystemDirectoryHandle> 
      }).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      // Create module subfolder inside the parent directory
      // Sanitize module name for filesystem (replace invalid chars with underscores)
      const sanitizedModuleName = moduleName.replace(/[/\\?%*:|"<>]/g, '_');
      const dirHandle = await parentDirHandle.getDirectoryHandle(sanitizedModuleName, { create: true });

      // Find all open tabs for this module (collection and AD)
      const moduleTabs = tabs.filter(t => 
        t.source?.type === 'module' && 
        t.source.moduleId === moduleId && 
        t.source.portalId === portalId
      );

      // Determine script file extension based on language
      const getScriptFileName = (type: 'collection' | 'ad', language: ScriptLanguage) => {
        const ext = language === 'powershell' ? 'ps1' : 'groovy';
        return `${type}.${ext}`;
      };

      // Build scripts config and write files
      const scriptsConfig: ModuleDirectoryConfig['scripts'] = {};
      
      // For initial save, fetch ALL scripts from portal (not just open tabs)
      // This ensures the directory is complete even if only one script tab is open
      // Fetch the full module from portal to get all scripts
      const fetchResult = await sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId,
          moduleType,
          moduleId,
        },
      });

      if (!fetchResult.ok) {
        moduleToasts.fetchFailed();
        return false;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const portalModule = fetchResult.data as any;
      
      // Extract scripts from portal using shared utilities
      const portalCollectionScript = extractScriptFromModule(portalModule, moduleType, 'collection');
      const collectionLanguage: ScriptLanguage = detectScriptLanguage(portalModule);
      const portalAdScript = extractScriptFromModule(portalModule, moduleType, 'ad');
      const hasAdScript = portalAdScript.trim().length > 0;
      
      // Find open tabs for each script type
      const collectionTab = moduleTabs.find(t => t.source?.scriptType === 'collection');
      const adTab = moduleTabs.find(t => t.source?.scriptType === 'ad');
      
      // Save collection script
      // Use open tab content if available, otherwise use portal content
      const collectionContent = collectionTab?.content ?? portalCollectionScript;
      const collectionLang = collectionTab?.language ?? collectionLanguage;
      const collectionMode = collectionTab?.mode ?? 'collection';
      
      if (collectionContent.trim().length > 0 || portalCollectionScript.trim().length > 0) {
        const fileName = getScriptFileName('collection', collectionLang);
        const portalChecksum = await documentStore.computeChecksum(portalCollectionScript);
        const diskChecksum = await documentStore.computeChecksum(collectionContent);
        
        await documentStore.writeFileToDirectory(dirHandle, fileName, collectionContent);
        
        scriptsConfig.collection = {
          fileName,
          language: collectionLang,
          mode: collectionMode,
          portalChecksum,
          diskChecksum,
        };
      }
      
      // Save AD script if it exists in portal
      if (hasAdScript) {
        // Use open tab content if available, otherwise use portal content
        const adContent = adTab?.content ?? portalAdScript;
        const adLang = adTab?.language ?? 'groovy';
        const adMode = adTab?.mode ?? 'ad';
        const fileName = getScriptFileName('ad', adLang);
        const portalChecksum = await documentStore.computeChecksum(portalAdScript);
        const diskChecksum = await documentStore.computeChecksum(adContent);
        
        await documentStore.writeFileToDirectory(dirHandle, fileName, adContent);
        
        scriptsConfig.ad = {
          fileName,
          language: adLang,
          mode: adMode,
          portalChecksum,
          diskChecksum,
        };
      }

      // Get module details draft if available
      const moduleDetailsDraft = moduleDetailsDraftByTabId[targetTabId];
      
      // Build module.json config
      const config: ModuleDirectoryConfig = {
        version: 1,
        portalBinding: {
          portalId,
          portalHostname,
          moduleId,
          moduleType,
          moduleName,
          lineageId,
        },
        scripts: scriptsConfig,
        // Store both portalBaseline and localDraft (if different) for module details
        // This mirrors how scripts track portalChecksum vs diskChecksum
        moduleDetails: moduleDetailsDraft ? {
          portalVersion: moduleDetailsDraft.version,
          lastPulledAt: new Date(moduleDetailsDraft.loadedAt).toISOString(),
          portalBaseline: moduleDetailsDraft.original as Record<string, unknown>,
          // Only store localDraft if there are dirty fields (user has made changes)
          localDraft: moduleDetailsDraft.dirtyFields.size > 0 
            ? moduleDetailsDraft.draft as Record<string, unknown>
            : undefined,
        } : undefined,
        lastSyncedAt: new Date().toISOString(),
      };

      // Write module.json
      await documentStore.writeFileToDirectory(
        dirHandle, 
        'module.json', 
        JSON.stringify(config, null, 2)
      );

      // Save directory handle to IndexedDB - may return existing ID if directory was used before
      const directoryHandleId = await documentStore.saveDirectoryHandle(crypto.randomUUID(), dirHandle, {
        directoryName: dirHandle.name,
        moduleName,
        portalHostname,
        moduleType,
      });

      // Update all module tabs with directory handle reference
      const updatedTabs = tabs.map(t => {
        if (t.source?.type === 'module' && 
            t.source.moduleId === moduleId && 
            t.source.portalId === portalId) {
          // Update document state to reflect saved to directory
          const scriptConfig = scriptsConfig[t.source.scriptType || 'collection'];
          return {
            ...t,
            directoryHandleId,
            document: {
              ...t.document,
              type: 'local' as const,
              file: {
                handleId: directoryHandleId,
                lastSavedContent: t.content,
                lastSavedAt: Date.now(),
                fileName: scriptConfig?.fileName,
              },
              // Preserve portal binding for push detection
              portal: t.document?.portal,
            },
          };
        }
        return t;
      });

      set({ tabs: updatedTabs });

      moduleToasts.saved(dirHandle.name, Object.keys(scriptsConfig).length);

      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // User cancelled the picker
        return false;
      }
      moduleToasts.saveFailed(error instanceof Error ? error : undefined);
      return false;
    }
  },

  showOpenModuleDirectoryDialog: (directoryId: string) => {
    set({ 
      openModuleDirectoryDialogOpen: true, 
      openModuleDirectoryDialogId: directoryId,
    });
  },

  setOpenModuleDirectoryDialogOpen: (open: boolean) => {
    set({ 
      openModuleDirectoryDialogOpen: open,
      openModuleDirectoryDialogId: open ? get().openModuleDirectoryDialogId : null,
    });
  },

  openModuleFolderFromDisk: async () => {
    // Check if directory picker is supported
    if (!documentStore.isDirectoryPickerSupported()) {
      directoryToasts.notSupported();
      return false;
    }

    try {
      // Show directory picker
      const dirHandle = await (window as unknown as { 
        showDirectoryPicker(options?: { mode?: string }): Promise<FileSystemDirectoryHandle> 
      }).showDirectoryPicker({
        mode: 'readwrite',
      });

      // Check if module.json exists in this directory
      const configJson = await documentStore.readFileFromDirectory(dirHandle, 'module.json');
      if (!configJson) {
        directoryToasts.notModuleDirectory();
        return false;
      }

      // Validate the config
      let config: import('@/shared/types').ModuleDirectoryConfig;
      try {
        config = JSON.parse(configJson);
        if (!config.portalBinding?.moduleName || !config.portalBinding?.moduleType) {
          throw new Error('Invalid config');
        }
      } catch {
        directoryToasts.invalidModuleJson();
        return false;
      }

      // Save the directory handle to IndexedDB - may return existing ID if directory was used before
      const directoryId = await documentStore.saveDirectoryHandle(documentStore.generateId(), dirHandle, {
        directoryName: dirHandle.name,
        moduleName: config.portalBinding.moduleName,
        moduleType: config.portalBinding.moduleType,
        portalHostname: config.portalBinding.portalHostname,
      });

      // Refresh recent files to include this directory
      await get().loadRecentFiles();

      // Show the open dialog so user can select which scripts to open
      get().showOpenModuleDirectoryDialog(directoryId);

      return true;
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        directoryToasts.openModuleFolderFailed(error instanceof Error ? error : undefined);
      }
      return false;
    }
  },

  openModuleDirectory: async (directoryId: string, scriptsToOpen?: Array<'collection' | 'ad'>) => {
    try {
      // Get directory handle record from IndexedDB
      const record = await documentStore.getDirectoryHandleRecord(directoryId);
      if (!record) {
        await documentStore.deleteDirectoryHandle(directoryId);
        await get().loadRecentFiles();
        directoryToasts.notFound();
        return false;
      }

      const dirHandle = record.handle;

      // Request permission
      let permission = await documentStore.queryDirectoryPermission(dirHandle);
      if (permission !== 'granted') {
        permission = (await documentStore.requestDirectoryPermission(dirHandle)) ? 'granted' : 'denied';
      }

      if (permission !== 'granted') {
        directoryToasts.permissionRequired(record.directoryName);
        return false;
      }

      // Read module.json
      const configJson = await documentStore.readFileFromDirectory(dirHandle, 'module.json');
      if (!configJson) {
        directoryToasts.missingModuleJson();
        return false;
      }

      let config: ModuleDirectoryConfig;
      try {
        config = JSON.parse(configJson) as ModuleDirectoryConfig;
      } catch {
        directoryToasts.invalidModuleJson();
        return false;
      }

      // Determine which scripts to open
      const availableScripts = Object.keys(config.scripts) as Array<'collection' | 'ad'>;
      const toOpen = scriptsToOpen ?? availableScripts;

      if (toOpen.length === 0) {
        directoryToasts.noScriptsSelected();
        return false;
      }

      // Hybrid Portal Sync: Check if current portal matches the stored portal
      const { selectedPortalId, tabs } = get();
      const portalScriptContent: Record<'collection' | 'ad', string | null> = {
        collection: null,
        ad: null,
      };
      let portalSyncSucceeded = false;
      let configNeedsUpdate = false;

      if (selectedPortalId && selectedPortalId === config.portalBinding.portalId) {
        try {
          const result = await sendMessage({
            type: 'FETCH_MODULE',
            payload: {
              portalId: config.portalBinding.portalId,
              moduleType: config.portalBinding.moduleType,
              moduleId: config.portalBinding.moduleId,
            },
          });

          if (result.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const module = result.data as any;

            // Extract scripts from fetched module
            for (const scriptType of availableScripts) {
              const portalContent = extractScriptFromModule(
                module, 
                config.portalBinding.moduleType, 
                scriptType
              );
              portalScriptContent[scriptType] = portalContent;

              // Update portal checksum if it changed
              const newChecksum = await documentStore.computeChecksum(portalContent);
              const oldChecksum = config.scripts[scriptType]?.portalChecksum;

              if (oldChecksum !== newChecksum && config.scripts[scriptType]) {
                config.scripts[scriptType].portalChecksum = newChecksum;
                configNeedsUpdate = true;
              }
            }

            portalSyncSucceeded = true;

            // Write updated config back if checksums changed
            if (configNeedsUpdate) {
              await documentStore.writeFileToDirectory(
                dirHandle,
                'module.json',
                JSON.stringify(config, null, 2)
              );
            }
          }
        } catch {
          // Portal sync failed, use stored checksums as fallback
        }
      }

      // Read and open each selected script
      const newTabs: EditorTab[] = [];

      for (const scriptType of toOpen) {
        const scriptConfig = config.scripts[scriptType];
        if (!scriptConfig) {
          continue;
        }

        const content = await documentStore.readFileFromDirectory(dirHandle, scriptConfig.fileName);
        if (content === null) {
          directoryToasts.scriptNotFound(scriptConfig.fileName);
          continue;
        }

        const newTabId = crypto.randomUUID();

        // Standardize naming: "ModuleName (AD)" or "ModuleName (Collection)"
        const modeLabel = scriptType === 'ad' ? 'AD' : 'Collection';
        const newTab: EditorTab = {
          id: newTabId,
          kind: 'script',
          displayName: `${config.portalBinding.moduleName} (${modeLabel})`,
          content,
          language: scriptConfig.language,
          mode: scriptConfig.mode,
          source: {
            type: 'module',
            moduleId: config.portalBinding.moduleId,
            moduleName: config.portalBinding.moduleName,
            moduleType: config.portalBinding.moduleType,
            scriptType,
            lineageId: config.portalBinding.lineageId,
            portalId: config.portalBinding.portalId,
            portalHostname: config.portalBinding.portalHostname,
          },
          directoryHandleId: directoryId,
          document: {
            type: 'local',
            file: {
              handleId: directoryId,
              lastSavedContent: content,
              lastSavedAt: Date.now(),
              fileName: scriptConfig.fileName,
            },
            portal: {
              id: config.portalBinding.portalId,
              hostname: config.portalBinding.portalHostname,
              moduleId: config.portalBinding.moduleId,
              moduleType: config.portalBinding.moduleType,
              moduleName: config.portalBinding.moduleName,
              scriptType,
              lineageId: config.portalBinding.lineageId,
              // Hybrid sync: Use portal content if we successfully fetched it,
              // otherwise fall back to disk content as best-effort baseline
              lastKnownContent: portalSyncSucceeded && portalScriptContent[scriptType] !== null
                ? portalScriptContent[scriptType]!
                : content,
              lastPulledAt: config.moduleDetails?.lastPulledAt 
                ? new Date(config.moduleDetails.lastPulledAt).getTime() 
                : undefined,
            },
          },
        };

        newTabs.push(newTab);
      }

      if (newTabs.length === 0) {
        directoryToasts.noScriptsOpened();
        return false;
      }

      // Update lastAccessed
      await documentStore.touchDirectoryHandle(directoryId);

      // Pre-populate module details draft from module.json if available
      // Uses portalBaseline as original and localDraft (if exists) as current draft
      // This mirrors how scripts use portalChecksum vs diskChecksum
      const updatedModuleDetailsDrafts = { ...get().moduleDetailsDraftByTabId };
      if (config.moduleDetails?.portalBaseline) {
        const portalBaseline = config.moduleDetails.portalBaseline as Partial<ModuleDetailsDraft['draft']>;
        // Use localDraft if available, otherwise fall back to portalBaseline
        const localDraft = config.moduleDetails.localDraft 
          ? config.moduleDetails.localDraft as Partial<ModuleDetailsDraft['draft']>
          : { ...portalBaseline };
        
        // Compute dirty fields by comparing localDraft vs portalBaseline
        const dirtyFields = new Set<string>();
        if (config.moduleDetails.localDraft) {
          for (const key of Object.keys(localDraft)) {
            const localVal = localDraft[key as keyof typeof localDraft];
            const baselineVal = portalBaseline[key as keyof typeof portalBaseline];
            // Use JSON comparison for objects/arrays
            if (JSON.stringify(localVal) !== JSON.stringify(baselineVal)) {
              dirtyFields.add(key);
            }
          }
        }
        
        for (const newTab of newTabs) {
          updatedModuleDetailsDrafts[newTab.id] = {
            original: portalBaseline,
            draft: { ...localDraft },
            dirtyFields,
            loadedAt: Date.now(),
            tabId: newTab.id,
            moduleId: config.portalBinding.moduleId,
            moduleType: config.portalBinding.moduleType,
            portalId: config.portalBinding.portalId,
            version: config.moduleDetails.portalVersion,
          };
        }
      }

      // Add tabs and activate the first one
      set({
        tabs: [...tabs, ...newTabs],
        activeTabId: newTabs[0].id,
        openModuleDirectoryDialogOpen: false,
        openModuleDirectoryDialogId: null,
        moduleDetailsDraftByTabId: updatedModuleDetailsDrafts,
      } as Partial<TabsSlice & TabsSliceDependencies>);

      directoryToasts.opened(newTabs.length, record.directoryName);

      return true;
    } catch (error) {
      directoryToasts.openFailed(error instanceof Error ? error : undefined);
      return false;
    }
  },

  // =====================
  // Create Local Copy
  // =====================

  createLocalCopyFromTab: (tabId: string, options) => {
    const { tabs } = get();
    const tab = tabs.find((entry) => entry.id === tabId);
    if (!tab || tab.kind === 'api') return null;

    const displayName = getUniqueUntitledName(tabs, tab.language);
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      kind: 'script',
      displayName,
      content: tab.content,
      language: tab.language,
      mode: tab.mode,
      document: createScratchDocument(),
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: options?.activate === false ? get().activeTabId : newTab.id,
    });

    return newTab.id;
  },
});
