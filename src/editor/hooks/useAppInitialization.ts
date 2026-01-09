/**
 * Hook to handle application initialization tasks.
 * 
 * Loads preferences, history, API environments, user snippets,
 * and performs cleanup of old data on mount.
 */

import { useEffect } from 'react';
import { useEditorStore } from '../stores/editor-store';

export function useAppInitialization() {
  const loadPreferences = useEditorStore((state) => state.loadPreferences);
  const loadHistory = useEditorStore((state) => state.loadHistory);
  const loadApiHistory = useEditorStore((state) => state.loadApiHistory);
  const loadApiEnvironments = useEditorStore((state) => state.loadApiEnvironments);
  const loadUserSnippets = useEditorStore((state) => state.loadUserSnippets);

  useEffect(() => {
    loadPreferences();
    loadHistory();
    loadApiHistory();
    loadApiEnvironments();
    loadUserSnippets();
    
    // Clean up old data in the background
    import('../utils/document-store').then(({ cleanupOldData }) => {
      cleanupOldData().catch(console.error);
    });
  }, [loadPreferences, loadHistory, loadApiHistory, loadApiEnvironments, loadUserSnippets]);
}

