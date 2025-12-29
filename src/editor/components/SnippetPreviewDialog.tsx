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

const LANGUAGE_COLORS: Record<string, string> = {
  groovy: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  powershell: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
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
  const { language: currentLanguage } = useEditorStore();

  if (!snippet) return null;

  const isCompatible =
    snippet.language === 'both' || snippet.language === currentLanguage;

  const handleInsert = () => {
    onInsert(snippet);
    onClose();
  };

  return (
    <Dialog open={!!snippet} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl! h-[80vh]! flex flex-col overflow-hidden">
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
          <div className="flex items-center gap-2 mt-2">
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
        <div className="flex-1 min-h-0 border rounded-lg bg-secondary/30 overflow-auto">
          <pre className="p-4 text-sm font-mono whitespace-pre">
            <code>{snippet.code}</code>
          </pre>
        </div>

        <DialogFooter className="shrink-0">
          {!isCompatible && (
            <p className="text-xs text-amber-500 mr-auto">
              This snippet is for {snippet.language === 'groovy' ? 'Groovy' : 'PowerShell'} only.
              Switch language to insert it.
            </p>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleInsert} disabled={!isCompatible}>
            <Play className="size-4 mr-2" />
            {snippet.category === 'template' ? 'Use Template' : 'Insert Pattern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

