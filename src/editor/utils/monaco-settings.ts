import type { editor } from 'monaco-editor';
import type { UserPreferences } from '@/shared/types';

export function getMonacoTheme(preferences: UserPreferences): 'vs' | 'vs-dark' {
  if (preferences.theme === 'light') return 'vs';
  if (preferences.theme === 'dark') return 'vs-dark';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'vs';
  }
  return 'vs-dark';
}

export function buildMonacoOptions(
  preferences: UserPreferences,
  overrides: editor.IStandaloneEditorConstructionOptions = {}
): editor.IStandaloneEditorConstructionOptions {
  const base: editor.IStandaloneEditorConstructionOptions = {
    fontSize: preferences.fontSize,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    automaticLayout: true,
    scrollBeyondLastLine: false,
  };

  return { ...base, ...overrides };
}
