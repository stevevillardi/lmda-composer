/**
 * Hook to manage release notes display.
 * 
 * Shows the release notes modal after extension updates, but only when:
 * - The version has changed since last seen
 * - No other dialogs are open
 * - No pending URL context (auto-open scripts)
 * - Draft restoration is not pending
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '../stores/editor-store';
import type { PendingUrlContext } from './useUrlParamsHandler';

const STORAGE_KEY_LAST_SEEN_VERSION = 'lastSeenVersion';

interface UseReleaseNotesOptions {
  /** Pending URL context from useUrlParamsHandler */
  pendingUrlContext: PendingUrlContext | null;
  /** Whether draft restoration dialog is showing */
  showDraftRestoreDialog: boolean;
}

interface UseReleaseNotesResult {
  /** Whether the release notes should be shown */
  shouldShow: boolean;
  /** Call this when user dismisses the modal */
  markAsSeen: () => Promise<void>;
}

/**
 * Hook to manage when to show release notes modal.
 */
export function useReleaseNotes({
  pendingUrlContext,
  showDraftRestoreDialog,
}: UseReleaseNotesOptions): UseReleaseNotesResult {
  const [hasVersionChanged, setHasVersionChanged] = useState(false);
  const [hasCheckedVersion, setHasCheckedVersion] = useState(false);
  const [isFirstInstall, setIsFirstInstall] = useState(false);
  
  const setReleaseNotesOpen = useEditorStore((state) => state.setReleaseNotesOpen);
  
  // Get all dialog states that should block the release notes modal
  const moduleBrowserOpen = useEditorStore((state) => state.moduleBrowserOpen);
  const moduleSearchOpen = useEditorStore((state) => state.moduleSearchOpen);
  const executionContextDialogOpen = useEditorStore((state) => state.executionContextDialogOpen);
  const saveOptionsDialogOpen = useEditorStore((state) => state.saveOptionsDialogOpen);
  const createModuleWizardOpen = useEditorStore((state) => state.createModuleWizardOpen);
  const appliesToTesterOpen = useEditorStore((state) => state.appliesToTesterOpen);
  const debugCommandsDialogOpen = useEditorStore((state) => state.debugCommandsDialogOpen);
  const moduleDetailsDialogOpen = useEditorStore((state) => state.moduleDetailsDialogOpen);
  const pullLatestDialogOpen = useEditorStore((state) => state.pullLatestDialogOpen);
  const moduleCommitConfirmationOpen = useEditorStore((state) => state.moduleCommitConfirmationOpen);
  const moduleLineageDialogOpen = useEditorStore((state) => state.moduleLineageDialogOpen);
  const moduleSnippetsDialogOpen = useEditorStore((state) => state.moduleSnippetsDialogOpen);
  const settingsDialogOpen = useEditorStore((state) => state.settingsDialogOpen);
  const commandPaletteOpen = useEditorStore((state) => state.commandPaletteOpen);
  const openModuleDirectoryDialogOpen = useEditorStore((state) => state.openModuleDirectoryDialogOpen);

  // Check version on mount
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const currentVersion = chrome.runtime.getManifest().version;
        const result = await chrome.storage.local.get(STORAGE_KEY_LAST_SEEN_VERSION);
        const lastSeenVersion = result[STORAGE_KEY_LAST_SEEN_VERSION] as string | undefined;
        
        if (!lastSeenVersion) {
          // First install - don't show modal, onboarding page handles this
          setIsFirstInstall(true);
          setHasVersionChanged(false);
          // Store current version so next update will show modal
          await chrome.storage.local.set({ [STORAGE_KEY_LAST_SEEN_VERSION]: currentVersion });
        } else if (lastSeenVersion !== currentVersion) {
          // Version changed - show modal
          setHasVersionChanged(true);
        } else {
          // Same version - don't show
          setHasVersionChanged(false);
        }
      } catch (error) {
        console.error('Failed to check version for release notes:', error);
        setHasVersionChanged(false);
      }
      
      setHasCheckedVersion(true);
    };
    
    checkVersion();
  }, []);

  // Check if any blocking dialogs are open
  const hasBlockingDialogs = useMemo(() => {
    return (
      moduleBrowserOpen ||
      moduleSearchOpen ||
      executionContextDialogOpen ||
      saveOptionsDialogOpen ||
      createModuleWizardOpen ||
      appliesToTesterOpen ||
      debugCommandsDialogOpen ||
      moduleDetailsDialogOpen ||
      pullLatestDialogOpen ||
      moduleCommitConfirmationOpen ||
      moduleLineageDialogOpen ||
      moduleSnippetsDialogOpen ||
      settingsDialogOpen ||
      commandPaletteOpen ||
      openModuleDirectoryDialogOpen
    );
  }, [
    moduleBrowserOpen,
    moduleSearchOpen,
    executionContextDialogOpen,
    saveOptionsDialogOpen,
    createModuleWizardOpen,
    appliesToTesterOpen,
    debugCommandsDialogOpen,
    moduleDetailsDialogOpen,
    pullLatestDialogOpen,
    moduleCommitConfirmationOpen,
    moduleLineageDialogOpen,
    moduleSnippetsDialogOpen,
    settingsDialogOpen,
    commandPaletteOpen,
    openModuleDirectoryDialogOpen,
  ]);

  // Determine if we can show release notes
  const canShow = useMemo(() => {
    // Must have checked version first
    if (!hasCheckedVersion) return false;
    
    // Don't show if version hasn't changed
    if (!hasVersionChanged) return false;
    
    // Don't show on first install (onboarding page shows changes instead)
    if (isFirstInstall) return false;
    
    // Don't show if URL params are pending
    if (pendingUrlContext) return false;
    
    // Don't show if draft restore dialog is pending
    if (showDraftRestoreDialog) return false;
    
    // Don't show if any other dialogs are open
    if (hasBlockingDialogs) return false;
    
    return true;
  }, [
    hasCheckedVersion,
    hasVersionChanged,
    isFirstInstall,
    pendingUrlContext,
    showDraftRestoreDialog,
    hasBlockingDialogs,
  ]);

  // Effect to show the modal when conditions are met
  useEffect(() => {
    if (canShow) {
      // Small delay to ensure UI is settled
      const timer = setTimeout(() => {
        setReleaseNotesOpen(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [canShow, setReleaseNotesOpen]);

  // Mark the current version as seen
  const markAsSeen = useCallback(async () => {
    try {
      const currentVersion = chrome.runtime.getManifest().version;
      await chrome.storage.local.set({ [STORAGE_KEY_LAST_SEEN_VERSION]: currentVersion });
      setHasVersionChanged(false);
    } catch (error) {
      console.error('Failed to store last seen version:', error);
    }
  }, []);

  return {
    shouldShow: canShow,
    markAsSeen,
  };
}
