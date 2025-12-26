import Editor from '@monaco-editor/react';
import { useEditorStore } from '../stores/editor-store';
import type { editor } from 'monaco-editor';
import { useCallback, useRef, useMemo } from 'react';

// Import the loader config to use bundled Monaco (CSP-safe)
import '../monaco-loader';

export function EditorPanel() {
  const { script, setScript, language, executeScript, preferences } = useEditorStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    
    // Add keyboard shortcut for running script
    editor.addAction({
      id: 'run-script',
      label: 'Run Script',
      keybindings: [
        // Ctrl/Cmd + Enter
        2048 | 3, // CtrlCmd | Enter
      ],
      run: () => {
        executeScript();
      },
    });

    // Focus editor
    editor.focus();
  }, [executeScript]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setScript(value);
    }
  }, [setScript]);

  // Map our language to Monaco language ID
  const monacoLanguage = language === 'groovy' ? 'groovy' : 'powershell';

  // Map theme preference to Monaco theme
  const monacoTheme = useMemo(() => {
    if (preferences.theme === 'light') return 'vs';
    if (preferences.theme === 'dark') return 'vs-dark';
    // System: check prefers-color-scheme
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'vs';
    }
    return 'vs-dark';
  }, [preferences.theme]);

  // Build editor options from preferences
  const editorOptions = useMemo(() => ({
    fontSize: preferences.fontSize,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    lineNumbers: 'on' as const,
    minimap: { enabled: preferences.minimap },
    wordWrap: preferences.wordWrap ? 'on' as const : 'off' as const,
    tabSize: preferences.tabSize,
    insertSpaces: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    renderLineHighlight: 'line' as const,
    cursorBlinking: 'smooth' as const,
    smoothScrolling: true,
    padding: { top: 8, bottom: 8 },
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
  }), [preferences.fontSize, preferences.tabSize, preferences.wordWrap, preferences.minimap]);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={monacoLanguage}
        theme={monacoTheme}
        value={script}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        options={editorOptions}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}
