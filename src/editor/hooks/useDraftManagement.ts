/**
 * Hook to manage draft saving, loading, and restoration.
 * 
 * Handles:
 * - Loading draft on mount
 * - Showing restore dialog
 * - Auto-saving with debounce (triggered by tab changes, not content)
 * - Saving on page unload
 * 
 * Performance: Uses a fingerprint of tab count + IDs to avoid re-running
 * on every keystroke. Content changes trigger saves via visibility change
 * and beforeunload events, plus periodic interval.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../stores/editor-store';
import { hasModuleUrlParams } from './useUrlParamsHandler';
import type { DraftScript, DraftTabs } from '@/shared/types';

interface DraftManagementReturn {
  pendingDraft: DraftScript | DraftTabs | null;
  showDraftDialog: boolean;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
}

/**
 * Creates a stable fingerprint for tabs that only changes when:
 * - Tab count changes
 * - Tab IDs change (tab added/removed/reordered)
 * - Active tab changes
 * This avoids triggering on every keystroke.
 */
function createTabFingerprint(tabs: { id: string }[], activeTabId: string | null): string {
  return `${tabs.length}:${tabs.map(t => t.id).join(',')}:${activeTabId}`;
}

export function useDraftManagement(): DraftManagementReturn {
  // Use fine-grained selectors to minimize re-renders
  const tabFingerprint = useEditorStore((state) => 
    createTabFingerprint(state.tabs, state.activeTabId)
  );
  const loadDraft = useEditorStore((state) => state.loadDraft);
  const restoreDraft = useEditorStore((state) => state.restoreDraft);
  const restoreDraftTabs = useEditorStore((state) => state.restoreDraftTabs);
  const mergeDraftTabs = useEditorStore((state) => state.mergeDraftTabs);
  const clearDraft = useEditorStore((state) => state.clearDraft);
  const saveDraft = useEditorStore((state) => state.saveDraft);

  // Draft restore dialog state
  const [pendingDraft, setPendingDraft] = useState<DraftScript | DraftTabs | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  
  // Track if URL params will open a module (checked once on mount)
  const [shouldMergeRestore, setShouldMergeRestore] = useState(false);
  
  // Debounce timer for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Interval timer for periodic saves
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for saved draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      // Check if URL params indicate a module will be opened
      // This determines whether we merge or replace tabs on restore
      const willOpenFromUrl = hasModuleUrlParams();
      setShouldMergeRestore(willOpenFromUrl);
      
      const draft = await loadDraft();
      if (draft) {
        setPendingDraft(draft);
        setShowDraftDialog(true);
      }
    };
    checkDraft();
  }, [loadDraft]);

  // Auto-save when tab structure changes (not content)
  useEffect(() => {
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, 2000); // Save after 2 seconds of tab structure stability

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tabFingerprint, saveDraft]);

  // Periodic auto-save to catch content changes (every 30 seconds)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      saveDraft();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [saveDraft]);

  // Save when page visibility changes (user switches tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveDraft();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [saveDraft]);

  // Save draft immediately when user leaves the page (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear any pending debounce timer
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save immediately - use sync approach since async may not complete
      saveDraft();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveDraft]);

  // Handle draft restore - supports both legacy single-file and multi-tab drafts
  const handleRestoreDraft = useCallback(() => {
    if (pendingDraft) {
      if ('tabs' in pendingDraft) {
        // Multi-tab draft - merge or replace based on URL params
        if (shouldMergeRestore) {
          // URL params will open tabs, merge draft with those tabs
          mergeDraftTabs(pendingDraft);
        } else {
          // No URL params, replace tabs
          restoreDraftTabs(pendingDraft);
        }
      } else {
        // Legacy single-file draft
        restoreDraft(pendingDraft);
      }
      // Save immediately after restore to persist the restored state
      // This prevents data loss if user leaves before debounce timer
      setTimeout(() => saveDraft(), 100);
    }
    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [pendingDraft, restoreDraft, restoreDraftTabs, mergeDraftTabs, shouldMergeRestore, saveDraft]);

  // Handle discard draft
  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [clearDraft]);

  return {
    pendingDraft,
    showDraftDialog,
    handleRestoreDraft,
    handleDiscardDraft,
  };
}

