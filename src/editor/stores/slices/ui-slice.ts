/**
 * UI slice - manages dialog states, sidebars, and user preferences.
 */

import { settingsToasts } from '../../utils/toast-utils';
import type { StateCreator } from 'zustand';
import type { UserPreferences, EditorTab, ScriptLanguage, ScriptMode } from '@/shared/types';
import { DEFAULT_PREFERENCES } from '@/shared/types';
import { DEFAULT_GROOVY_TEMPLATE, DEFAULT_POWERSHELL_TEMPLATE } from '../../config/script-templates';
import { getExtensionForLanguage } from '../../utils/file-extensions';
import { normalizeScript } from '../helpers/slice-helpers';

// ============================================================================
// Types
// ============================================================================

/**
 * Workspace type - determines which view is active.
 * 'devtools' is only available in development builds.
 */
export type WorkspaceType = 'script' | 'api' | 'devtools';

/**
 * State managed by the UI slice.
 */
export interface UISliceState {
  // Dialog states
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  executionHistoryOpen: boolean;
  releaseNotesOpen: boolean;
  
  // Chord keyboard shortcut state (⌘K waiting for follow-up key)
  chordPending: boolean;
  
  // Right sidebar state
  rightSidebarOpen: boolean;
  rightSidebarTab: 'properties' | 'snippets' | 'history';
  
  // Output tab
  outputTab: 'raw' | 'parsed' | 'validation' | 'graph';
  
  // Active workspace view (script editor or API explorer)
  activeWorkspace: WorkspaceType;
  
  // User preferences
  preferences: UserPreferences;
}

/**
 * Actions provided by the UI slice.
 */
export interface UISliceActions {
  // Dialog actions
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsDialogOpen: (open: boolean) => void;
  setExecutionHistoryOpen: (open: boolean) => void;
  setReleaseNotesOpen: (open: boolean) => void;
  
  // Chord keyboard shortcut action
  setChordPending: (pending: boolean) => void;
  
  // Right sidebar actions
  setRightSidebarOpen: (open: boolean) => void;
  setRightSidebarTab: (tab: 'properties' | 'snippets' | 'history') => void;
  toggleRightSidebar: () => void;
  
  // Output tab action
  setOutputTab: (tab: 'raw' | 'parsed' | 'validation' | 'graph') => void;
  
  // Workspace action
  setActiveWorkspace: (workspace: WorkspaceType) => void;
  
  // Preferences actions
  setPreferences: (preferences: Partial<UserPreferences>) => void;
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
}

/**
 * Combined slice interface.
 */
export interface UISlice extends UISliceState, UISliceActions {}

// ============================================================================
// Dependencies - state from other slices that UI slice needs
// ============================================================================

/**
 * Cross-slice dependencies for the UI slice.
 * loadPreferences needs access to tabs to apply default language/mode.
 */
interface UISliceDependencies {
  tabs: EditorTab[];
  activeTabId: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PREFERENCES = 'lm-ide-preferences';

// ============================================================================
// Initial State
// ============================================================================

export const uiSliceInitialState: UISliceState = {
  // Dialogs
  commandPaletteOpen: false,
  settingsDialogOpen: false,
  executionHistoryOpen: false,
  releaseNotesOpen: false,
  
  // Chord keyboard shortcut
  chordPending: false,
  
  // Right sidebar
  rightSidebarOpen: true,
  rightSidebarTab: 'properties',
  
  // Output
  outputTab: 'raw',
  
  // Workspace - defaults to script editor
  activeWorkspace: 'script',
  
  // Preferences
  preferences: DEFAULT_PREFERENCES,
};

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Creates the UI slice.
 */
export const createUISlice: StateCreator<
  UISlice & UISliceDependencies,
  [],
  [],
  UISlice
> = (set, get) => ({
  ...uiSliceInitialState,

  // Dialog actions
  setCommandPaletteOpen: (open) => {
    set({ commandPaletteOpen: open });
  },

  setSettingsDialogOpen: (open) => {
    set({ settingsDialogOpen: open });
  },

  setExecutionHistoryOpen: (open) => {
    set({ executionHistoryOpen: open });
  },

  setReleaseNotesOpen: (open) => {
    set({ releaseNotesOpen: open });
  },

  // Chord keyboard shortcut action
  setChordPending: (pending) => {
    set({ chordPending: pending });
  },

  // Right sidebar actions
  setRightSidebarOpen: (open) => {
    set({ rightSidebarOpen: open });
  },

  setRightSidebarTab: (tab) => {
    set({ rightSidebarTab: tab });
  },

  toggleRightSidebar: () => {
    set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen }));
  },

  // Output tab action
  setOutputTab: (tab) => {
    set({ outputTab: tab });
  },

  // Workspace action
  setActiveWorkspace: (workspace) => {
    set({ activeWorkspace: workspace });
  },

  // Preferences actions
  setPreferences: (newPreferences) => {
    set((state) => ({
      preferences: { ...state.preferences, ...newPreferences },
    }));
    // Auto-save preferences
    get().savePreferences();
  },

  loadPreferences: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_PREFERENCES);
      const storedPrefs = result[STORAGE_KEY_PREFERENCES] as Partial<UserPreferences> | undefined;
      if (storedPrefs) {
        const mergedPrefs = { ...DEFAULT_PREFERENCES, ...storedPrefs };
        
        // Check if editor is in initial state (using default template)
        const { tabs, activeTabId } = get();
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab?.kind === 'api') {
          set({ preferences: mergedPrefs });
          return;
        }
        const currentScript = activeTab?.content ?? '';
        
        const isDefaultGroovy = normalizeScript(currentScript) === normalizeScript(DEFAULT_GROOVY_TEMPLATE);
        const isDefaultPowershell = normalizeScript(currentScript) === normalizeScript(DEFAULT_POWERSHELL_TEMPLATE);
        const isInitialState = isDefaultGroovy || isDefaultPowershell;
        
        // Apply default language/mode from preferences if in initial state
        if (isInitialState && activeTabId) {
          const newLanguage: ScriptLanguage = mergedPrefs.defaultLanguage;
          const newMode: ScriptMode = mergedPrefs.defaultMode;
          const newScript = newLanguage === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE;
          const extension = getExtensionForLanguage(newLanguage);
          
          // Update the active tab with new language, mode, and content
          set({ 
            preferences: mergedPrefs,
            tabs: tabs.map(t => 
              t.id === activeTabId
                ? { 
                    ...t, 
                    language: newLanguage, 
                    mode: newMode, 
                    content: newScript,
                    displayName: t.displayName.replace(/\.(groovy|ps1)$/, extension),
                  }
                : t
            ),
          } as Partial<UISlice & UISliceDependencies>);
        } else {
          set({ preferences: mergedPrefs });
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  },

  savePreferences: async () => {
    try {
      const { preferences } = get();
      await chrome.storage.local.set({ [STORAGE_KEY_PREFERENCES]: preferences });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      settingsToasts.saveFailed();
    }
  },
});
