import Editor from '@monaco-editor/react';
import { useEditorStore } from '../stores/editor-store';
import type { editor } from 'monaco-editor';
import { useCallback, useRef, useMemo } from 'react';
import { TabBar } from './TabBar';
import { WelcomeScreen } from './WelcomeScreen';

// Import the loader config to use bundled Monaco (CSP-safe)
import '../monaco-loader';

export function EditorPanel() {
  const { 
    tabs, 
    activeTabId, 
    updateActiveTabContent, 
    executeScript, 
    preferences 
  } = useEditorStore();
  
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Get active tab
  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

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
      updateActiveTabContent(value);
    }
  }, [updateActiveTabContent]);

  // Map our language to Monaco language ID
  const monacoLanguage = activeTab?.language === 'groovy' ? 'groovy' : 'powershell';

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

  // Show WelcomeScreen when no tabs are open
  if (tabs.length === 0) {
    return (
      <div className="h-full w-full flex flex-col">
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Tab Bar */}
      <TabBar />
      
      {/* Monaco Editor */}
      <div className="flex-1 min-h-0" role="region" aria-label="Code editor">
        {activeTab ? (
          <Editor
            key={activeTabId} // Re-mount editor when switching tabs for proper state isolation
            height="100%"
            language={monacoLanguage}
            theme={monacoTheme}
            value={activeTab.content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={editorOptions}
            loading={
              <div className="flex items-center justify-center h-full" role="status" aria-label="Loading editor">
                <div className="text-muted-foreground">Loading editor...</div>
              </div>
            }
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground" role="status" aria-label="No file open">
            No file open
          </div>
        )}
      </div>
    </div>
  );
}
