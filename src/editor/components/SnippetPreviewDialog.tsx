import { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Play, FileText, Code2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Snippet } from '@/shared/types';
import { useEditorStore } from '../stores/editor-store';
import { buildMonacoOptions, getMonacoTheme } from '../utils/monaco-settings';

// Import the loader config to use bundled Monaco (CSP-safe)
import '../monaco-loader';

const LANGUAGE_COLORS: Record<string, string> = {
  groovy: 'bg-yellow-700/10 text-yellow-700 border-yellow-700/20',
  powershell: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  both: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

interface SnippetPreviewDialogProps {
  snippet: Snippet | null;
  onClose: () => void;
  onInsert: (snippet: Snippet) => void;
}

export function SnippetPreviewDialog({
  snippet,
  onClose,
  onInsert,
}: SnippetPreviewDialogProps) {
  const { tabs, activeTabId, preferences } = useEditorStore();

  const currentLanguage = useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    return activeTab?.language ?? 'groovy';
  }, [tabs, activeTabId]);

  const snippetLanguage = snippet?.language ?? currentLanguage;
  const isCompatible =
    !snippet ? true : snippet.language === 'both' || snippet.language === currentLanguage;

  const monacoTheme = useMemo(() => getMonacoTheme(preferences), [preferences]);

  const editorOptions = useMemo(() => buildMonacoOptions(preferences, {
    readOnly: true,
    fontSize: 12,
    lineNumbers: 'on',
    minimap: { enabled: false },
    wordWrap: 'off',
    tabSize: 2,
    renderLineHighlight: 'none',
    padding: { top: 8, bottom: 8 },
    domReadOnly: true,
    cursorStyle: 'line-thin',
    selectionHighlight: false,
    occurrencesHighlight: 'off',
    scrollbar: { horizontal: 'auto', vertical: 'auto' },
  }), [preferences]);

  const monacoLanguage =
    snippetLanguage === 'both' ? currentLanguage : snippetLanguage;

  if (!snippet) return null;

  const handleInsert = () => {
    onInsert(snippet);
    onClose();
  };

  return (
    <Dialog open={!!snippet} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="
        flex h-[80vh]! max-w-3xl! flex-col overflow-hidden
      ">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            {snippet.category === 'template' ? (
              <FileText className="size-5 text-muted-foreground" />
            ) : (
              <Code2 className="size-5 text-muted-foreground" />
            )}
            <DialogTitle>{snippet.name}</DialogTitle>
          </div>
          <DialogDescription>{snippet.description}</DialogDescription>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs', LANGUAGE_COLORS[snippet.language])}
            >
              {snippet.language === 'both' ? 'Both' : snippet.language}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {snippet.category}
            </Badge>
            {snippet.tags.length > 0 && (
              <div className="flex items-center gap-1">
                {snippet.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
                {snippet.tags.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{snippet.tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Code preview */}
        <div className="
          min-h-0 flex-1 overflow-hidden border-y border-border bg-background/50
        ">
          <Editor
            height="100%"
            language={monacoLanguage === 'powershell' ? 'powershell' : 'groovy'}
            theme={monacoTheme}
            value={snippet.code}
            options={editorOptions}
            loading={
              <div className="flex h-full items-center justify-center">
                <div className="text-xs text-muted-foreground">Loading...</div>
              </div>
            }
          />
        </div>

        <DialogFooter className="
          shrink-0 border-t border-border bg-muted/20 p-4
        ">
          {!isCompatible && (
            <p className="
              mr-auto flex items-center gap-1.5 text-xs text-yellow-500
            ">
              <span className="block size-1.5 rounded-full bg-yellow-500" />
              Snippet incompatible with current language ({snippet.language === 'groovy' ? 'Groovy' : 'PowerShell'} only)
            </p>
          )}
          <Button variant="outline" onClick={onClose} size="sm">
            Close
          </Button>
          <Button onClick={handleInsert} disabled={!isCompatible} size="sm">
            <Play className="mr-1.5 size-3.5" />
            {snippet.category === 'template' ? 'Use Template' : 'Insert Pattern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
