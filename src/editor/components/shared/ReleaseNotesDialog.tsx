/**
 * Release Notes Dialog - Shows what's new after extension updates.
 * 
 * Displays the latest release highlights and changes in a modal dialog.
 */

import { ExternalLink, Sparkles, Wrench, Bug, Check } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditorStore } from '../../stores/editor-store';
import { getLatestRelease, type ReleaseChange } from '@/shared/release-notes';
import { DOCS_URLS } from '@/shared/app-config';

const CATEGORY_CONFIG: Record<ReleaseChange['category'], { label: string; icon: typeof Sparkles; color: string }> = {
  added: { 
    label: 'Added', 
    icon: Sparkles, 
    color: 'text-emerald-500' 
  },
  improved: { 
    label: 'Improved', 
    icon: Wrench, 
    color: 'text-blue-500' 
  },
  fixed: { 
    label: 'Fixed', 
    icon: Bug, 
    color: 'text-amber-500' 
  },
};

interface ReleaseNotesDialogProps {
  onDismiss: () => void;
}

export function ReleaseNotesDialog({ onDismiss }: ReleaseNotesDialogProps) {
  const releaseNotesOpen = useEditorStore((state) => state.releaseNotesOpen);
  const setReleaseNotesOpen = useEditorStore((state) => state.setReleaseNotesOpen);
  
  const release = getLatestRelease();
  
  if (!release) return null;

  const handleClose = () => {
    setReleaseNotesOpen(false);
    onDismiss();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  return (
    <Dialog open={releaseNotesOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl!">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="
              flex size-10 items-center justify-center rounded-lg
              bg-linear-to-br from-purple-500/20 to-cyan-500/20
              text-purple-500
            ">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                What&apos;s New
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  v{release.version}
                </Badge>
                <span className="text-muted-foreground">{release.date}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4 **:data-[slot=scroll-area-viewport]:focus-visible:ring-0 **:data-[slot=scroll-area-viewport]:focus-visible:outline-none">
          {/* Highlights Section */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-foreground">
              {release.title}
            </h3>
            <div className="space-y-2">
              {release.highlights.map((highlight, index) => (
                <div
                  key={index}
                  className="
                    flex items-start gap-2 rounded-lg border border-border/50
                    bg-muted/30 px-3 py-2 text-sm
                  "
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Changes */}
          <div className="space-y-4">
            {release.changes.map((changeGroup, groupIndex) => {
              const config = CATEGORY_CONFIG[changeGroup.category];
              const Icon = config.icon;
              
              return (
                <div key={groupIndex}>
                  <h4 className={`mb-2 flex items-center gap-2 text-sm font-medium ${config.color}`}>
                    <Icon className="size-4" />
                    {config.label}
                  </h4>
                  <ul className="space-y-1.5 pl-6">
                    {changeGroup.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="
                          list-disc text-sm text-muted-foreground
                          marker:text-muted-foreground/50
                        "
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <a
            href={DOCS_URLS.changelog}
            target="_blank"
            rel="noreferrer"
            className="
              inline-flex items-center gap-1.5 text-sm text-muted-foreground
              transition-colors
              hover:text-foreground
            "
          >
            View full changelog
            <ExternalLink className="size-3" />
          </a>
          <Button onClick={handleClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
