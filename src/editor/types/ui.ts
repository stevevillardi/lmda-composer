/**
 * Editor UI-specific types.
 * 
 * Types related to dialog states, panel configurations, and UI preferences.
 */

/**
 * Panel identifiers for the left and right sidebars.
 */
export type LeftPanelId = 'context' | 'modules' | 'history' | 'properties' | 'files' | 'snippets' | 'appliesTo' | 'moduleSnippets';
export type RightPanelId = 'output' | 'api';

/**
 * Configuration for which panels are open.
 */
export interface PanelConfig {
  leftPanelId: LeftPanelId | null;
  rightPanelId: RightPanelId | null;
}

/**
 * State for the module details dialog.
 */
export interface ModuleDetailsDialogState {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * State for the commit dialog.
 */
export interface CommitDialogState {
  isOpen: boolean;
  isCommitting: boolean;
  commitReason: string;
  includePreviousVersionId: boolean;
}

/**
 * State for the settings dialog.
 */
export interface SettingsDialogState {
  isOpen: boolean;
  activeSection: 'general' | 'editor' | 'execution' | 'api' | 'about';
}

/**
 * Resolved theme value after evaluating 'system' preference.
 */
export type ResolvedTheme = 'dark' | 'light';

