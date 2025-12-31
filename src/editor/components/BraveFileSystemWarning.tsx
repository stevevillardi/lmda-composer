import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type FileSystemWarningBrowser = 'brave' | 'vivaldi';

interface BraveFileSystemWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
  browser: FileSystemWarningBrowser;
}

export function BraveFileSystemWarning({
  open,
  onOpenChange,
  onDismiss,
  browser,
}: BraveFileSystemWarningProps) {
  const handleDismiss = () => {
    onDismiss();
    // AlertDialogCancel will handle closing the dialog
  };

  const isBrave = browser === 'brave';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default" className="max-w-xl! !sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-500/10">
            <AlertTriangle className="size-8 text-amber-500" />
          </AlertDialogMedia>
          <AlertDialogTitle>File System Access Not Enabled</AlertDialogTitle>
          <AlertDialogDescription>
            LMDA Composer requires the File System Access API for full save functionality.
            {isBrave
              ? ' In Brave browser, this feature is disabled by default.'
              : ' In Vivaldi, file access must be enabled per extension.'}
          </AlertDialogDescription>
          <div className="space-y-2 text-left text-sm text-muted-foreground">
            <div className="font-medium text-foreground">To enable it:</div>
            {isBrave ? (
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">brave://flags</code> in a new tab</li>
                <li>Search for \"File System Access API\"</li>
                <li>Set it to \"Enabled\"</li>
                <li>Restart your browser</li>
              </ol>
            ) : (
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">vivaldi://extensions</code></li>
                <li>Select \"LMDA Composer\"</li>
                <li>Enable \"Allow access to file URLs\"</li>
              </ol>
            )}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDismiss}>
            Got it
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
