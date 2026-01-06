/**
 * UI slice - manages dialog states, sidebars, and user preferences.
 */

import type { StateCreator } from 'zustand';
import type { UserPreferences } from '@/shared/types';
import { DEFAULT_PREFERENCES } from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

/**
 * State managed by the UI slice.
 */
export interface UISliceState {
  // Dialog states
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  executionHistoryOpen: boolean;
  createSnippetDialogOpen: boolean;
  cancelDialogOpen: boolean;
  debugCommandsDialogOpen: boolean;
  moduleSnippetsDialogOpen: boolean;
  appliesToTesterOpen: boolean;
  
  // Right sidebar state
  rightSidebarOpen: boolean;
  rightSidebarTab: 'properties' | 'snippets' | 'history';
  
  // Output tab
  outputTab: 'raw' | 'parsed' | 'validation' | 'graph';
  
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
  setCreateSnippetDialogOpen: (open: boolean) => void;
  setCancelDialogOpen: (open: boolean) => void;
  setDebugCommandsDialogOpen: (open: boolean) => void;
  setModuleSnippetsDialogOpen: (open: boolean) => void;
  setAppliesToTesterOpen: (open: boolean) => void;
  
  // Right sidebar actions
  setRightSidebarOpen: (open: boolean) => void;
  setRightSidebarTab: (tab: 'properties' | 'snippets' | 'history') => void;
  
  // Output tab action
  setOutputTab: (tab: 'raw' | 'parsed' | 'validation' | 'graph') => void;
  
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
  createSnippetDialogOpen: false,
  cancelDialogOpen: false,
  debugCommandsDialogOpen: false,
  moduleSnippetsDialogOpen: false,
  appliesToTesterOpen: false,
  
  // Right sidebar
  rightSidebarOpen: false,
  rightSidebarTab: 'properties',
  
  // Output
  outputTab: 'raw',
  
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
  UISlice,
  [],
  [],
  UISlice
> = (set, get) => ({
  ...uiSliceInitialState,

  // Dialog actions
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
  setExecutionHistoryOpen: (open) => set({ executionHistoryOpen: open }),
  setCreateSnippetDialogOpen: (open) => set({ createSnippetDialogOpen: open }),
  setCancelDialogOpen: (open) => set({ cancelDialogOpen: open }),
  setDebugCommandsDialogOpen: (open) => set({ debugCommandsDialogOpen: open }),
  setModuleSnippetsDialogOpen: (open) => set({ moduleSnippetsDialogOpen: open }),
  setAppliesToTesterOpen: (open) => set({ appliesToTesterOpen: open }),

  // Right sidebar actions
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  setRightSidebarTab: (tab) => set({ rightSidebarTab: tab }),

  // Output tab action
  setOutputTab: (tab) => set({ outputTab: tab }),

  // Preferences actions
  setPreferences: (preferences) => {
    const currentPrefs = get().preferences;
    const updated = { ...currentPrefs, ...preferences };
    set({ preferences: updated });
    
    // Auto-save preferences when changed
    chrome.storage.local
      .set({ [STORAGE_KEY_PREFERENCES]: updated })
      .catch(console.error);
  },

  loadPreferences: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_PREFERENCES);
      const storedPrefs = result[STORAGE_KEY_PREFERENCES] as Partial<UserPreferences> | undefined;
      
      if (storedPrefs) {
        // Merge with defaults to handle any new preference keys
        set({ preferences: { ...DEFAULT_PREFERENCES, ...storedPrefs } });
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
    }
  },
});

