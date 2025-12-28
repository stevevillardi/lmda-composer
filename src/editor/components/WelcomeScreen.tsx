import { useEffect } from 'react';
import { 
  FilePlus, 
  FolderOpen, 
  CloudDownload, 
  FileCode,
  Clock,
  Loader2,
  Hammer,
  Terminal,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import logoIcon from '@/assets/icon128.png';

interface ActionButtonProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

function ActionButton({ 
  icon, 
  title, 
  description, 
  onClick, 
  disabled, 
  disabledReason 
}: ActionButtonProps) {
  const button = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-4 w-full p-4 rounded-lg border transition-all duration-200 text-left",
        disabled
          ? "border-border/50 bg-muted/20 cursor-not-allowed opacity-50"
          : "border-border bg-card hover:bg-accent hover:border-primary/50 hover:shadow-md cursor-pointer"
      )}
    >
      <div className={cn(
        "p-2.5 rounded-lg shrink-0",
        disabled ? "bg-muted/30 text-muted-foreground" : "bg-primary/10 text-primary"
      )}>
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className={cn(
          "font-medium text-sm",
          disabled ? "text-muted-foreground" : "text-foreground"
        )}>
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {description}
        </p>
      </div>
    </button>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

interface RecentFileItemProps {
  fileName: string;
  lastAccessed: number;
  onClick: () => void;
}

function RecentFileItem({ fileName, lastAccessed, onClick }: RecentFileItemProps) {
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    }) + ', ' + date.toLocaleTimeString(undefined, { 
      hour: 'numeric', 
      minute: '2-digit',
    });
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-2.5 text-left",
        "hover:bg-accent transition-colors group"
      )}
    >
      <FileCode className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
      <span className="text-sm truncate text-foreground group-hover:text-primary">
        {fileName}
      </span>
      <span className="text-xs text-muted-foreground/60 shrink-0">
        {formatDate(lastAccessed)}
      </span>
      <span className="text-xs text-muted-foreground shrink-0 ml-auto">
        {formatTimeAgo(lastAccessed)}
      </span>
    </button>
  );
}

export function WelcomeScreen() {
  const {
    selectedPortalId,
    recentFiles,
    isLoadingRecentFiles,
    loadRecentFiles,
    openRecentFile,
    createNewFile,
    openFileFromDisk,
    setModuleBrowserOpen,
    setAppliesToTesterOpen,
    setDebugCommandsDialogOpen,
  } = useEditorStore();

  // Load recent files on mount
  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  const hasRecentFiles = recentFiles.length > 0;

  return (
    <div className="h-full flex flex-col bg-background overflow-auto">
      {/* Centered Content Container */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <img 
                src={logoIcon} 
                alt="LMDA Composer" 
                className="size-14"
              />
              <h1 className="text-4xl font-bold text-foreground tracking-tight">
                LMDA Composer
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Develop and debug LogicModules with ease
            </p>
          </div>

          {/* Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Section */}
            <Card size="sm" className="bg-card/50">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Start
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ActionButton
                  icon={<FilePlus className="size-5" />}
                  title="New File"
                  description="Create a new Groovy or PowerShell script"
                  onClick={createNewFile}
                />
                <ActionButton
                  icon={<FolderOpen className="size-5" />}
                  title="Open File"
                  description="Open an existing script from disk"
                  onClick={openFileFromDisk}
                />
                <ActionButton
                  icon={<CloudDownload className="size-5" />}
                  title="Import from LMX"
                  description="Browse and import LogicModule scripts"
                  onClick={() => setModuleBrowserOpen(true)}
                  disabled={!selectedPortalId}
                  disabledReason="Connect to a portal first to browse LogicModules"
                />
              </CardContent>
            </Card>

            {/* Tools Section */}
            <Card size="sm" className="bg-card/50">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ActionButton
                  icon={<Hammer className="size-5" />}
                  title="AppliesTo Toolbox"
                  description="Test and validate AppliesTo expressions"
                  onClick={() => setAppliesToTesterOpen(true)}
                  disabled={!selectedPortalId}
                  disabledReason="Connect to a portal first to test AppliesTo expressions"
                />
                <ActionButton
                  icon={<Terminal className="size-5" />}
                  title="Debug Commands"
                  description="Run collector debug commands"
                  onClick={() => setDebugCommandsDialogOpen(true)}
                  disabled={!selectedPortalId}
                  disabledReason="Connect to a portal first to run debug commands"
                />
              </CardContent>
            </Card>
          </div>

          {/* Recent Files Section */}
          <Card size="sm" className="bg-card/50">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                <Clock className="size-4" />
                Recent Files
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0!">
              {isLoadingRecentFiles ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mr-2" />
                  <span className="text-sm">Loading recent files...</span>
                </div>
              ) : hasRecentFiles ? (
                <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
                  {recentFiles.map((file) => (
                    <RecentFileItem
                      key={file.tabId}
                      fileName={file.fileName}
                      lastAccessed={file.lastAccessed}
                      onClick={() => openRecentFile(file.tabId)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <div className="text-center">
                    <FileCode className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent files</p>
                    <p className="text-xs mt-1">
                      Files you open or save will appear here
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer hint */}
          <p className="text-center text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">Ctrl+K</kbd> to open the command palette
          </p>
        </div>
      </div>
    </div>
  );
}
