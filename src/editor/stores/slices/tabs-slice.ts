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
} from '@/shared/types';
import { toast } from 'sonner';
import { getExtensionForLanguage, getLanguageFromFilename } from '../../utils/file-extensions';
import { createScratchDocument, isFileDirty, getDocumentType, convertToLocalDocument, updateDocumentAfterSave } from '../../utils/document-helpers';
import { getDefaultScriptTemplate, DEFAULT_GROOVY_TEMPLATE, DEFAULT_POWERSHELL_TEMPLATE } from '../../config/script-templates';
import { normalizeMode } from '../../utils/mode-utils';
import * as documentStore from '../../utils/document-store';
import type { ParseResult } from '../../utils/output-parser';

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  DRAFT: 'lm-ide-draft',           // Legacy single-file draft
  DRAFT_TABS: 'lm-ide-draft-tabs', // Multi-tab draft
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
  
  // Language and mode (with template switching)
  setLanguage: (language: ScriptLanguage, force?: boolean) => void;
  setMode: (mode: ScriptMode) => void;
  
  // Draft management
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<DraftScript | DraftTabs | null>;
  clearDraft: () => Promise<void>;
  restoreDraft: (draft: DraftScript) => void;
  restoreDraftTabs: (draftTabs: DraftTabs) => void;
  
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
  
  // From UI slice (for preferences and output tab)
  preferences: { defaultLanguage: ScriptLanguage; defaultMode: ScriptMode };
  outputTab: string;
  
  // From execution slice (for clearing parsed output when mode changes)
  parsedOutput: ParseResult | null;
  
  // From module slice (for save options dialog)
  setSaveOptionsDialogOpen: (open: boolean, tabId?: string) => void;
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

  // =====================
  // Core Tab Management
  // =====================

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
    const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
    const isDefaultGroovy = normalize(activeTab.content) === normalize(DEFAULT_GROOVY_TEMPLATE);
    const isDefaultPowershell = normalize(activeTab.content) === normalize(DEFAULT_POWERSHELL_TEMPLATE);
    
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
      if (activeTab.hasFileHandle) {
        shouldClearFileHandle = true;
      }
    }
    
    set({
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { 
              ...t, 
              language, 
              content: newContent, 
              displayName: newDisplayName,
              // Clear both hasFileHandle and fileHandleId when disconnecting
              // The old file handle remains in IndexedDB for recent files access
              hasFileHandle: shouldClearFileHandle ? false : t.hasFileHandle,
              fileHandleId: shouldClearFileHandle ? undefined : t.fileHandleId,
            }
          : t
      ),
    });
    
    // Notify user that the file handle was disconnected
    if (shouldClearFileHandle) {
      toast.info('File handle disconnected', {
        description: 'The file extension no longer matches. Use "Save As" to create a new file with the correct extension.',
      });
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
      tabs: tabs.map(t => 
        t.id === activeTabId 
          ? { ...t, mode }
          : t
      ),
    } as Partial<TabsSlice & TabsSliceDependencies>);
  },

  // =====================
  // Draft Management
  // =====================

  saveDraft: async () => {
    try {
      const { tabs, activeTabId, hasSavedDraft } = get();
      
      // Normalize for comparison
      const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
      
      // Check if all tabs are default templates (nothing to save)
      const hasApiTabs = tabs.some(tab => tab.kind === 'api');
      const hasNonDefaultContent = hasApiTabs || tabs.some(tab => {
        if (tab.kind === 'api') return false;
        const normalizedContent = normalize(tab.content);
        const isDefaultGroovy = normalizedContent === normalize(DEFAULT_GROOVY_TEMPLATE);
        const isDefaultPowershell = normalizedContent === normalize(DEFAULT_POWERSHELL_TEMPLATE);
        return !isDefaultGroovy && !isDefaultPowershell;
      });
      
      // Skip saving if all tabs are default templates
      if (!hasNonDefaultContent && tabs.length <= 1) {
        // If there was a saved draft, clear it since we're back to default
        if (hasSavedDraft) {
          await chrome.storage.local.remove(STORAGE_KEYS.DRAFT_TABS);
          await chrome.storage.local.remove(STORAGE_KEYS.DRAFT);
          set({ hasSavedDraft: false });
        }
        return;
      }
      
      const draftTabs: DraftTabs = {
        tabs,
        activeTabId,
        lastModified: Date.now(),
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.DRAFT_TABS]: draftTabs });
      set({ hasSavedDraft: true });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  },

  loadDraft: async () => {
    try {
      // First try to load multi-tab draft
      const tabsResult = await chrome.storage.local.get(STORAGE_KEYS.DRAFT_TABS);
      if (tabsResult[STORAGE_KEYS.DRAFT_TABS]) {
        const draftTabs = tabsResult[STORAGE_KEYS.DRAFT_TABS] as DraftTabs;
        set({ hasSavedDraft: true });
        return draftTabs; // Return for dialog, don't auto-restore
      }
      
      // Fall back to legacy single-file draft
      const result = await chrome.storage.local.get(STORAGE_KEYS.DRAFT);
      if (result[STORAGE_KEYS.DRAFT]) {
        set({ hasSavedDraft: true });
        return result[STORAGE_KEYS.DRAFT] as DraftScript;
      }
      return null;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  },

  clearDraft: async () => {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.DRAFT);
      await chrome.storage.local.remove(STORAGE_KEYS.DRAFT_TABS);
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
    // Normalize any legacy mode values to valid modes
    const normalizedTabs = draftTabs.tabs.map(tab => ({
      ...tab,
      mode: normalizeMode(tab.mode),
    }));
    
    set({
      tabs: normalizedTabs,
      activeTabId: draftTabs.activeTabId,
      hasSavedDraft: true, // Mark as having saved draft so auto-save will update it
    });
    // Don't call clearDraft here - let the auto-save overwrite instead
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
            originalContent: content,
            hasFileHandle: false,
            isLocalFile: true,
            source: { type: 'file' },
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
      
      // Generate tab ID and file handle ID (same initially, but can diverge on language change)
      const tabId = crypto.randomUUID();
      const fileHandleId = crypto.randomUUID();
      
      // Store handle in IndexedDB using fileHandleId
      await documentStore.saveFileHandle(fileHandleId, handle, fileName);
      
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
        originalContent: content,
        hasFileHandle: true,
        fileHandleId,
        isLocalFile: true,
        source,
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
    const { tabs, activeTabId, setSaveOptionsDialogOpen } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return false;
    
    // Get fresh tab state
    const tab = get().tabs.find(t => t.id === targetTabId);
    if (!tab) return false;

    // Portal documents use the save options dialog
    const docType = getDocumentType(tab);
    if (docType === 'portal') {
      setSaveOptionsDialogOpen(true, targetTabId);
      return false;
    }

    // If no file handle, redirect to Save As (handles language change disconnect)
    if (!tab.hasFileHandle || !tab.fileHandleId) {
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
        
        // Update tab state - sync both originalContent and document state
        set({
          tabs: get().tabs.map(t => 
            t.id === targetTabId 
              ? { 
                  ...t, 
                  originalContent: contentToSave,
                  document: t.document 
                    ? updateDocumentAfterSave(t.document, contentToSave) 
                    : convertToLocalDocument(targetTabId, contentToSave, t.displayName),
                }
              : t
          ),
        });
        
        toast.success('File saved');
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
            tabs: get().tabs.map(t => 
              t.id === targetTabId 
                ? { 
                    ...t, 
                    originalContent: contentToSave,
                    document: t.document 
                      ? updateDocumentAfterSave(t.document, contentToSave) 
                      : convertToLocalDocument(targetTabId, contentToSave, t.displayName),
                  }
                : t
            ),
          });
          
          toast.success('File saved');
          return true;
        }
      }
      
      // Permission denied - trigger Save As
      return await get().saveFileAs(targetTabId);
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error('Failed to save file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  },

  saveFileAs: async (tabId?: string) => {
    const { tabs, activeTabId } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return false;
    
    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab) return false;

    // Check if File System Access API is supported
    if (!documentStore.isFileSystemAccessSupported()) {
      // Fallback to download
      get().exportToFile();
      toast.success('File exported');
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
      
      // Generate a new fileHandleId for this file
      // This ensures the old file handle (if any) remains in IndexedDB for recent files
      const newFileHandleId = crypto.randomUUID();
      
      // Store new handle in IndexedDB with the new ID
      await documentStore.saveFileHandle(newFileHandleId, handle, handle.name);
      
      // Update tab state - sync both originalContent and document state
      set({
        tabs: get().tabs.map(t => 
          t.id === targetTabId 
            ? { 
                ...t, 
                displayName: handle.name,
                originalContent: contentToSave,
                hasFileHandle: true,
                fileHandleId: newFileHandleId,
                isLocalFile: true,
                source: { type: 'file' },
                document: convertToLocalDocument(newFileHandleId, contentToSave, handle.name),
              }
            : t
        ),
      });
      
      toast.success('File saved');
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
      toast.error('Failed to save file', {
        description: error instanceof Error ? error.message : String(error),
      });
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
          // Update tab to reflect no handle access
          set({
            tabs: get().tabs.map(t => 
              t.id === tabId 
                ? { ...t, hasFileHandle: false }
                : t
            ),
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
            
            if (tab && tab.originalContent !== newContent) {
              // File was modified externally - update originalContent
              // Keep user's current edits, but update the baseline
              set({
                tabs: get().tabs.map(t => 
                  t.id === status.tabId 
                    ? { ...t, originalContent: newContent, hasFileHandle: true }
                    : t
                ),
              });
            } else {
              // Just mark as having handle
              set({
                tabs: get().tabs.map(t => 
                  t.id === status.tabId 
                    ? { ...t, hasFileHandle: true }
                    : t
                ),
              });
            }
          } catch {
            // File might have been deleted - just mark handle as available
            set({
              tabs: get().tabs.map(t => 
                t.id === status.tabId 
                  ? { ...t, hasFileHandle: true }
                  : t
              ),
            });
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
      const recentFiles = await documentStore.getRecentFileHandles(10);
      
      set({ recentFiles, isLoadingRecentFiles: false });
    } catch (error) {
      console.error('Failed to load recent files:', error);
      set({ recentFiles: [], isLoadingRecentFiles: false });
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
        toast.error('File not found', { description: 'This file has been removed from recent files.' });
        return;
      }

      // Check permission
      let permission = await documentStore.queryFilePermission(handle);
      if (permission !== 'granted') {
        permission = (await documentStore.requestFilePermission(handle)) ? 'granted' : 'denied';
      }

      if (permission !== 'granted') {
        // User denied permission - don't remove from list, they might grant it later
        toast.info('Permission required', {
          description: `Permission to access "${handle.name}" was denied. Click again to retry.`,
        });
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
          toast.error('File no longer exists', {
            description: `"${handle.name}" was deleted or moved. It has been removed from recent files.`,
          });
        } else {
          toast.error('Unable to read file', {
            description: `Could not read "${handle.name}". It has been removed from recent files.`,
          });
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
        originalContent: content,
        hasFileHandle: true,
        fileHandleId,
        isLocalFile: true,
      };

      set({
        tabs: [...get().tabs, newTab],
        activeTabId: newTabId,
      });
    } catch (error) {
      console.error('Failed to open recent file:', error);
      toast.error('Failed to open file', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
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
      originalContent: tab.content,
      isLocalFile: true,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: options?.activate === false ? get().activeTabId : newTab.id,
    });

    return newTab.id;
  },
});
