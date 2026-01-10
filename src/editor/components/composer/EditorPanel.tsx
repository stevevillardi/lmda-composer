import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editor-store';
import type { editor } from 'monaco-editor';
import { useCallback, useRef, useMemo, useEffect } from 'react';
import { buildMonacoOptions, getMonacoTheme } from '@/editor/utils/monaco-settings';
import { getPortalBindingStatus } from '../../utils/portal-binding';
import { PortalBindingOverlay } from './PortalBindingOverlay';
import { registerMonacoShortcuts } from '../../utils/keyboard-shortcuts';

import { FilePlus, Loader2 } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';

// Import the loader config to use bundled Monaco (CSP-safe)
import '../../monaco-loader';

export function EditorPanel() {
  const { 
    tabs, 
    activeTabId, 
    updateActiveTabContent, 
    preferences,
    selectedPortalId,
    portals,
    setEditorInstance,
    createNewFile,
  } = useEditorStore();
  
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Get active tab
  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    setEditorInstance(editor);
    
    registerMonacoShortcuts(editor);

    // Focus editor
    editor.focus();
  }, [setEditorInstance]);

  const isPortalLocked = useMemo(() => {
    if (!activeTab || activeTab.source?.type !== 'module') return false;
    const binding = getPortalBindingStatus(activeTab, selectedPortalId, portals);
    return !binding.isActive;
  }, [activeTab, selectedPortalId, portals]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined && !isPortalLocked) {
      updateActiveTabContent(value);
    }
  }, [updateActiveTabContent, isPortalLocked]);

  // Map our language to Monaco language ID
  const monacoLanguage = activeTab?.language === 'groovy' ? 'groovy' : 'powershell';

  // Map theme preference to Monaco theme
  const monacoTheme = useMemo(() => getMonacoTheme(preferences), [preferences]);

  // Build editor options from preferences
  const editorOptions = useMemo(() => buildMonacoOptions(preferences, {
    lineNumbers: 'on' as const,
    minimap: { enabled: preferences.minimap },
    wordWrap: preferences.wordWrap ? 'on' as const : 'off' as const,
    tabSize: preferences.tabSize,
    insertSpaces: true,
    renderLineHighlight: 'line' as const,
    cursorBlinking: 'smooth' as const,
    smoothScrolling: true,
    padding: { top: 8, bottom: 8 },
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    readOnly: isPortalLocked,
  }), [preferences, isPortalLocked]);

  useEffect(() => {
    if (!activeTab) {
      setEditorInstance(null);
    }
  }, [activeTab, setEditorInstance]);

  return (
    <div className="relative flex size-full flex-col">
      {/* Monaco Editor */}
      <div className="min-h-0 flex-1" role="region" aria-label="Code editor">
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
              <div className="
                flex h-full flex-col items-center justify-center gap-3
                text-muted-foreground
              " role="status" aria-label="Loading editor">
                <Loader2 className="size-8 animate-spin text-primary/50" />
                <span className="text-sm font-medium">Initializing Editor...</span>
              </div>
            }
          />
        ) : (
          <div 
            className="
              flex h-full flex-col items-center justify-center gap-4
              text-muted-foreground
            " 
            role="status" 
            aria-label="No file open"
          >
            <div className="rounded-full bg-secondary/30 p-4">
              <FilePlus className="size-8 text-muted-foreground/50" />
            </div>
            <div className="space-y-1 text-center">
              <p className="font-medium text-foreground">No file open</p>
              <p className="text-sm text-muted-foreground">
                Press <Kbd>⌘</Kbd> <Kbd>N</Kbd> to create a new file
              </p>
            </div>
            <button
              onClick={createNewFile}
              className="
                mt-2 rounded-md bg-primary/10 px-4 py-2 text-xs font-medium
                text-primary transition-colors
                hover:bg-primary/20
              "
            >
              Create New File
            </button>
          </div>
        )}
      </div>
      <PortalBindingOverlay tabId={activeTabId} />
    </div>
  );
}
