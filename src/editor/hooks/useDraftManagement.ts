/**
 * Hook to manage draft saving, loading, and restoration.
 * 
 * Handles:
 * - Loading draft on mount
 * - Showing restore dialog
 * - Auto-saving with debounce
 * - Saving on page unload
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../stores/editor-store';
import type { DraftScript, DraftTabs } from '@/shared/types';

interface DraftManagementReturn {
  pendingDraft: DraftScript | DraftTabs | null;
  showDraftDialog: boolean;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
}

export function useDraftManagement(): DraftManagementReturn {
  const tabs = useEditorStore((state) => state.tabs);
  const loadDraft = useEditorStore((state) => state.loadDraft);
  const restoreDraft = useEditorStore((state) => state.restoreDraft);
  const restoreDraftTabs = useEditorStore((state) => state.restoreDraftTabs);
  const clearDraft = useEditorStore((state) => state.clearDraft);
  const saveDraft = useEditorStore((state) => state.saveDraft);

  // Draft restore dialog state
  const [pendingDraft, setPendingDraft] = useState<DraftScript | DraftTabs | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  
  // Debounce timer for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for saved draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      const draft = await loadDraft();
      if (draft) {
        setPendingDraft(draft);
        setShowDraftDialog(true);
      }
    };
    checkDraft();
  }, [loadDraft]);

  // Auto-save draft with debounce (watches all tabs)
  useEffect(() => {
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, 2000); // Save after 2 seconds of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tabs, saveDraft]);

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
        // Multi-tab draft
        restoreDraftTabs(pendingDraft);
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
  }, [pendingDraft, restoreDraft, restoreDraftTabs, saveDraft]);

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

