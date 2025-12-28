import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import '../monaco-loader';

interface DiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  height?: string;
  theme?: string;
  readOnly?: boolean;
  wordWrap?: boolean;
}

export function DiffEditor({
  original,
  modified,
  language = 'groovy',
  height = '400px',
  theme = 'vs-dark',
  readOnly = true,
  wordWrap = false,
}: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const originalModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const modifiedModelRef = useRef<monaco.editor.ITextModel | null>(null);

  // Create editor once
  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      renderSideBySide: true,
      enableSplitViewResizing: true,
      renderIndicators: true,
      ignoreTrimWhitespace: false,
      renderOverviewRuler: true,
      lineNumbers: 'on',
      wordWrap: wordWrap ? 'on' : 'off',
    });

    editorRef.current = diffEditor;

    return () => {
      if (diffEditor) {
        diffEditor.dispose();
      }
      if (originalModelRef.current) {
        originalModelRef.current.dispose();
      }
      if (modifiedModelRef.current) {
        modifiedModelRef.current.dispose();
      }
    };
  }, [readOnly, wordWrap]);

  // Update models when content changes
  useEffect(() => {
    if (!editorRef.current) return;

    // Create or update original model
    if (!originalModelRef.current) {
      originalModelRef.current = monaco.editor.createModel(original, language);
    } else {
      if (originalModelRef.current.getValue() !== original) {
        originalModelRef.current.setValue(original);
      }
    }

    // Create or update modified model
    if (!modifiedModelRef.current) {
      modifiedModelRef.current = monaco.editor.createModel(modified, language);
    } else {
      if (modifiedModelRef.current.getValue() !== modified) {
        modifiedModelRef.current.setValue(modified);
      }
    }

    // Set models on diff editor
    editorRef.current.setModel({
      original: originalModelRef.current,
      modified: modifiedModelRef.current,
    });
  }, [original, modified, language]);

  // Update theme
  useEffect(() => {
    if (theme) {
      monaco.editor.setTheme(theme);
    }
  }, [theme]);

  // Update readOnly and wordWrap options
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ 
        readOnly,
        wordWrap: wordWrap ? 'on' : 'off',
      });
    }
  }, [readOnly, wordWrap]);

  return <div ref={containerRef} style={{ height, width: '100%' }} aria-label="Code diff comparison" />;
}

