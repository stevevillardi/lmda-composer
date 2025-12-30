import { useEffect } from 'react';
import {
  FilePlus,
  FolderOpen,
  CloudDownload,
  FileCode,
  Clock,
  Loader2,
  Hammer,
  FolderSearch,
  Terminal,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import logoIcon from '@/assets/icon128.png';

interface ActionRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

function ActionRow({
  icon,
  title,
  description,
  onClick,
  disabled,
  disabledReason,
}: ActionRowProps) {
  const button = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 w-full px-3.5 py-2.5 rounded-md border transition-colors text-left",
        disabled
          ? "border-border/40 bg-muted/20 cursor-not-allowed opacity-50"
          : "border-border/70 bg-card/30 hover:bg-accent hover:border-primary/40"
      )}
    >
      <div
        className={cn(
          "size-9 rounded-md grid place-items-center shrink-0",
          disabled ? "bg-muted/30 text-muted-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            "text-sm font-medium tracking-tight",
            disabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {title}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {description}
        </div>
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
    return (
      date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      }) +
      ', ' +
      date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    );
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3.5 py-2.5 text-left",
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

export function WelcomeScreenV2() {
  const {
    selectedPortalId,
    recentFiles,
    isLoadingRecentFiles,
    loadRecentFiles,
    openRecentFile,
    createNewFile,
    openFileFromDisk,
    setModuleBrowserOpen,
    setModuleSearchOpen,
    setAppliesToTesterOpen,
    setDebugCommandsDialogOpen,
  } = useEditorStore();

  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  const hasRecentFiles = recentFiles.length > 0;

  return (
    <div className="h-full flex flex-col bg-background overflow-auto">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl space-y-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <img src={logoIcon} alt="LMDA Composer" className="size-10" />
              <div className="leading-tight">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                  LMDA Composer
                </h1>
                <p className="text-sm text-muted-foreground">
                  Create, test, and ship LogicModules faster
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6">
            <div className="space-y-4">
              <Card size="sm" className="bg-card/40 border-border/70">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Quick Start
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <ActionRow
                    icon={<FilePlus className="size-4" />}
                    title="New File"
                    description="Start a Groovy or PowerShell script"
                    onClick={createNewFile}
                  />
                  <ActionRow
                    icon={<FolderOpen className="size-4" />}
                    title="Open File"
                    description="Open a script from your computer"
                    onClick={openFileFromDisk}
                  />
                  <ActionRow
                    icon={<CloudDownload className="size-4" />}
                    title="Import from LogicModule Exchange"
                    description="Browse and import LogicModule scripts"
                    onClick={() => setModuleBrowserOpen(true)}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to browse LogicModules"
                  />
                </CardContent>
              </Card>

              <Card size="sm" className="bg-card/40 border-border/70">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Tools
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <ActionRow
                    icon={<FolderSearch className="size-4" />}
                    title="Search LogicModules"
                    description="Find scripts and datapoints across modules"
                    onClick={() => setModuleSearchOpen(true)}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to search modules"
                  />
                  <ActionRow
                    icon={<Hammer className="size-4" />}
                    title="AppliesTo Toolbox"
                    description="Test and validate AppliesTo expressions"
                    onClick={() => setAppliesToTesterOpen(true)}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to test AppliesTo expressions"
                  />
                  <ActionRow
                    icon={<Terminal className="size-4" />}
                    title="Debug Commands"
                    description="Run collector debug commands"
                    onClick={() => setDebugCommandsDialogOpen(true)}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to run debug commands"
                  />
                </CardContent>
              </Card>

            </div>

            <Card size="sm" className="bg-card/40 border-border/70">
              <CardHeader className="pb-0">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-2">
                  <Clock className="size-3.5" />
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
                  <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
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
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
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
          </div>

          <div className="w-full flex items-center justify-center">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Tip</span>
              <span className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">
                Ctrl+K
              </span>
              <span>opens the command palette</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
