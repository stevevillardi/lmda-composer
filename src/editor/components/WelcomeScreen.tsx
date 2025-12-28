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
import { cn } from '@/lib/utils';
import logoIcon from '@/assets/icon128.png';

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

function ActionCard({ 
  icon, 
  title, 
  description, 
  onClick, 
  disabled, 
  disabledReason 
}: ActionCardProps) {
  const card = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-5 rounded-lg border transition-all duration-200",
        "w-[180px] h-[140px]",
        disabled
          ? "border-border/50 bg-muted/20 cursor-not-allowed opacity-50"
          : "border-border bg-card hover:bg-accent hover:border-primary/50 hover:shadow-md cursor-pointer"
      )}
    >
      <div className={cn(
        "p-3 rounded-lg",
        disabled ? "bg-muted/30 text-muted-foreground" : "bg-primary/10 text-primary"
      )}>
        {icon}
      </div>
      <div className="text-center">
        <h3 className={cn(
          "font-medium text-sm",
          disabled ? "text-muted-foreground" : "text-foreground"
        )}>
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </div>
    </button>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger render={card} />
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return card;
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

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2 rounded-md text-left",
        "hover:bg-accent transition-colors group"
      )}
    >
      <FileCode className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
      <span className="flex-1 text-sm truncate text-foreground group-hover:text-primary">
        {fileName}
      </span>
      <span className="text-xs text-muted-foreground shrink-0">
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
    <div className="flex-1 flex items-center justify-center bg-background overflow-hidden p-6">
      <div className="max-w-6xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <img 
              src={logoIcon} 
              alt="LMDA Composer" 
              className="size-12"
            />
            <h1 className="text-3xl font-bold text-foreground">
              LMDA Composer
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Develop and debug LogicMonitor scripts with ease
          </p>
        </div>

        {/* Action Cards */}
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* File Actions */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground text-center">
              File Actions
            </h2>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <ActionCard
                icon={<FilePlus className="size-6" />}
                title="New File"
                description="Create a new script"
                onClick={createNewFile}
              />
              <ActionCard
                icon={<FolderOpen className="size-6" />}
                title="Open File"
                description="Open from disk"
                onClick={openFileFromDisk}
              />
            </div>
          </div>

          {/* Portal Actions */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground text-center">
              Portal Actions
            </h2>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <ActionCard
                icon={<CloudDownload className="size-6" />}
                title="Import from LMX"
                description="Browse LogicModules"
                onClick={() => setModuleBrowserOpen(true)}
                disabled={!selectedPortalId}
                disabledReason="Connect to a portal first to browse LogicModules"
              />
              <ActionCard
                icon={<Hammer className="size-6" />}
                title="AppliesTo Toolbox"
                description="Test expressions"
                onClick={() => setAppliesToTesterOpen(true)}
                disabled={!selectedPortalId}
                disabledReason="Connect to a portal first to test AppliesTo expressions"
              />
              <ActionCard
                icon={<Terminal className="size-6" />}
                title="Debug Commands"
                description="Run collector commands"
                onClick={() => setDebugCommandsDialogOpen(true)}
                disabled={!selectedPortalId}
                disabledReason="Connect to a portal first to run debug commands"
              />
            </div>
          </div>
        </div>

        {/* Recent Files */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span className="font-medium">Recent Files</span>
          </div>
          
          <div className="border rounded-lg bg-card/50">
            {isLoadingRecentFiles ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin mr-2" />
                <span className="text-sm">Loading recent files...</span>
              </div>
            ) : hasRecentFiles ? (
              <div className="divide-y divide-border">
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
              <div className="py-8 text-center text-muted-foreground">
                <FileCode className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent files</p>
                <p className="text-xs mt-1">
                  Files you open or save will appear here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">Ctrl+K</kbd> to open the command palette
        </p>
      </div>
    </div>
  );
}

