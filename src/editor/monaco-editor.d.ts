declare module 'monaco-editor/esm/vs/editor/editor.api';

declare module 'monaco-editor/esm/vs/basic-languages/powershell/powershell.js' {
  import type { languages } from 'monaco-editor';
  export const conf: languages.LanguageConfiguration;
  export const language: languages.IMonarchLanguage;
}
