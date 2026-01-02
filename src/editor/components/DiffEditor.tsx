import { useId } from 'react';
import { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';
// Import Monaco loader to configure workers for Chrome extension CSP
import '../monaco-loader';
import type { ScriptLanguage } from '@/shared/types';

interface DiffEditorProps {
  original: string;
  modified: string;
  language?: ScriptLanguage | 'json';
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
  const modelId = useId();
  const originalModelPath = `inmemory://model/${modelId}/original`;
  const modifiedModelPath = `inmemory://model/${modelId}/modified`;

  return (
    <MonacoDiffEditor
      original={original}
      modified={modified}
      language={language}
      originalModelPath={originalModelPath}
      modifiedModelPath={modifiedModelPath}
      keepCurrentOriginalModel
      keepCurrentModifiedModel
      height={height}
      theme={theme}
      options={{
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
        diffCodeLens: false,
        renderMarginRevertIcon: true,
      }}
      loading={
        <div 
          className="flex items-center justify-center h-full text-muted-foreground text-sm" 
          role="status" 
          aria-label="Loading diff editor"
        >
          Loading diff...
        </div>
      }
    />
  );
}
