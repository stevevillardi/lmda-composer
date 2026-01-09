/**
 * Hook to sync theme preference to the document.
 * 
 * Applies 'dark' class to document element based on user preference
 * or system preference when set to 'system'.
 */

import { useEffect } from 'react';
import { useEditorStore } from '../stores/editor-store';

export function useThemeSync() {
  const theme = useEditorStore((state) => state.preferences.theme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);
}

