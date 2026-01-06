/**
 * Hook to update the window title based on the active tab.
 * 
 * Shows tab name, character count, and warning if limit exceeded.
 */

import { useEffect } from 'react';
import type { EditorTab } from '@/shared/types';

export function useWindowTitle(activeTab: EditorTab | null) {
  useEffect(() => {
    const charCount = activeTab?.content.length ?? 0;
    const warning = charCount > 64000 ? ' ⚠️ LIMIT EXCEEDED' : '';
    const tabName = activeTab?.displayName ?? 'No file';
    document.title = `${tabName} - LMDA Composer (${charCount.toLocaleString()} chars)${warning}`;
  }, [activeTab]);
}

