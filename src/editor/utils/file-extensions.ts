import type { ScriptLanguage } from '@/shared/types';

/**
 * Get the script language based on a filename extension.
 * @param filename - The filename (e.g., "script.ps1" or "script.groovy")
 * @returns 'powershell' for .ps1 files, 'groovy' for all others
 */
export function getLanguageFromFilename(filename: string): ScriptLanguage {
  return filename.toLowerCase().endsWith('.ps1') ? 'powershell' : 'groovy';
}

/**
 * Get the file extension for a given script language.
 * @param language - The script language ('groovy' or 'powershell')
 * @returns '.groovy' or '.ps1'
 */
export function getExtensionForLanguage(language: ScriptLanguage): string {
  return language === 'powershell' ? '.ps1' : '.groovy';
}

/**
 * File extensions accepted for script files.
 */
export const SCRIPT_FILE_EXTENSIONS = ['.groovy', '.ps1', '.txt'];

/**
 * File type filter for file picker dialogs.
 */
export const SCRIPT_FILE_TYPES = {
  description: 'Script Files',
  accept: {
    'text/plain': SCRIPT_FILE_EXTENSIONS,
  },
};

