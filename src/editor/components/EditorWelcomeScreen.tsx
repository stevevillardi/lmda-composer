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
  Braces,
  Folder,
} from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { useEditorStore } from '../stores/editor-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import logoIcon from '@/assets/icon128.png';

// ============================================================================
// ActionTile Component - Compact action button with tooltip
// ============================================================================

interface ActionTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  fullWidth?: boolean;
}

function ActionTile({
  icon,
  title,
  description,
  onClick,
  disabled,
  disabledReason,
  fullWidth,
}: ActionTileProps) {
  const button = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border transition-colors text-center min-h-[72px]",
        fullWidth ? "col-span-2" : "",
        disabled
          ? "border-border/40 bg-muted/20 cursor-not-allowed opacity-50"
          : "border-border/70 bg-card/30 hover:bg-accent hover:border-primary/40"
      )}
    >
      <div
        className={cn(
          "size-8 rounded-md grid place-items-center shrink-0",
          disabled ? "bg-muted/30 text-muted-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {icon}
      </div>
      <span
        className={cn(
          "text-xs font-medium tracking-tight leading-tight",
          disabled ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {title}
      </span>
    </button>
  );

  const tooltipContent = disabled && disabledReason ? disabledReason : description;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom" className="max-w-[200px] text-center">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Helper functions for time formatting
// ============================================================================

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================================
// Recent Item Components
// ============================================================================

interface RecentFileItemProps {
  fileName: string;
  lastAccessed: number;
  onClick: () => void;
}

function RecentFileItem({ 
  fileName, 
  lastAccessed, 
  onClick,
}: RecentFileItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-2 text-left",
        "hover:bg-accent transition-colors group"
      )}
    >
      <FileCode className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
      <span className="text-xs truncate text-foreground group-hover:text-primary flex-1">
        {fileName}
      </span>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {formatTimeAgo(lastAccessed)}
      </span>
    </button>
  );
}

interface RecentDirectoryItemProps {
  directoryName: string;
  moduleName: string;
  moduleType: string;
  portalHostname: string;
  lastAccessed: number;
  onClick: () => void;
}

function RecentDirectoryItem({ 
  directoryName, 
  moduleName,
  moduleType,
  portalHostname,
  lastAccessed, 
  onClick,
}: RecentDirectoryItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onClick}
            className={cn(
              "flex items-center gap-2.5 w-full px-3 py-2 text-left",
              "hover:bg-accent transition-colors group"
            )}
          >
            <Folder className="size-3.5 text-primary/70 group-hover:text-primary shrink-0" />
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="text-xs truncate text-foreground group-hover:text-primary">
                {moduleName}
              </span>
              <span className="text-[10px] text-muted-foreground/60 bg-muted/50 px-1 py-0.5 rounded shrink-0">
                {moduleType}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatTimeAgo(lastAccessed)}
            </span>
          </button>
        }
      />
      <TooltipContent side="left">
        <div className="text-xs">
          <div>{directoryName}</div>
          <div className="text-muted-foreground">{portalHostname}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EditorWelcomeScreen() {
  const {
    selectedPortalId,
    recentFiles,
    recentDirectories,
    isLoadingRecentFiles,
    loadRecentFiles,
    openRecentFile,
    showOpenModuleDirectoryDialog,
    openModuleFolderFromDisk,
    createNewFile,
    openFileFromDisk,
    setActiveWorkspace,
    setModuleBrowserOpen,
    setModuleSearchOpen,
    setAppliesToTesterOpen,
    setDebugCommandsDialogOpen,
  } = useEditorStore();

  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  const hasRecentFiles = recentFiles.length > 0 || recentDirectories.length > 0;

  // Combine and sort files and directories, limit to 6 items
  const recentItems = [
    ...recentDirectories.map(dir => ({
      type: 'directory' as const,
      id: dir.id,
      displayName: dir.moduleName,
      directoryName: dir.directoryName,
      moduleType: dir.moduleType,
      portalHostname: dir.portalHostname,
      lastAccessed: dir.lastAccessed,
    })),
    ...recentFiles.map(file => ({
      type: 'file' as const,
      id: file.tabId,
      displayName: file.fileName,
      lastAccessed: file.lastAccessed,
    })),
  ]
    .sort((a, b) => b.lastAccessed - a.lastAccessed)
    .slice(0, 6);

  return (
    <div className="h-full flex flex-col bg-background overflow-auto" tabIndex={-1}>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl space-y-5">
          {/* Header */}
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

          {/* Main 3-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* START Column */}
            <Card size="sm" className="bg-card/40 border-border/70">
              <CardHeader className="pb-0">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <ActionTile
                    icon={<FilePlus className="size-4" />}
                    title="New File"
                    description="Start a Groovy or PowerShell script"
                    onClick={createNewFile}
                  />
                  <ActionTile
                    icon={<FolderOpen className="size-4" />}
                    title="Open File"
                    description="Open a script from your computer"
                    onClick={openFileFromDisk}
                  />
                  <ActionTile
                    icon={<Folder className="size-4" />}
                    title="Open Module Folder"
                    description="Open a saved module directory from disk"
                    onClick={() => void openModuleFolderFromDisk()}
                  />
                  <ActionTile
                    icon={<Braces className="size-4" />}
                    title="API Explorer"
                    description="Explore the LM REST API with your active session"
                    onClick={() => setActiveWorkspace('api')}
                  />
                  <ActionTile
                    icon={<CloudDownload className="size-4" />}
                    title="Import from LMX"
                    description="Browse and import LogicModule scripts from the Exchange"
                    onClick={() => setModuleBrowserOpen(true)}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to browse LogicModules"
                    fullWidth
                  />
                </div>
              </CardContent>
            </Card>

            {/* TOOLS Column */}
            <Card size="sm" className="bg-card/40 border-border/70">
              <CardHeader className="pb-0">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Tools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <ActionTile
                    icon={<FolderSearch className="size-4" />}
                    title="Search Modules"
                    description="Find scripts and datapoints across LogicModules"
                    onClick={() => setModuleSearchOpen(true)}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to search modules"
                  />
                  <ActionTile
                    icon={<Hammer className="size-4" />}
                    title="AppliesTo"
                    description="Test and validate AppliesTo expressions"
                    onClick={() => setAppliesToTesterOpen(true)}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to test AppliesTo expressions"
                  />
                  <ActionTile
                    icon={<Terminal className="size-4" />}
                    title="Debug Commands"
                    description="Run collector debug commands"
                    onClick={() => setDebugCommandsDialogOpen(true)}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to run debug commands"
                    fullWidth
                  />
                </div>
              </CardContent>
            </Card>

            {/* RECENT Column */}
            <Card size="sm" className="bg-card/40 border-border/70 md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-0">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-2">
                  <Clock className="size-3.5" />
                  Recent
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0!">
                {isLoadingRecentFiles ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mr-2" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : hasRecentFiles ? (
                  <div className="divide-y divide-border/50 max-h-[220px] overflow-y-auto">
                    {recentItems.map((item) => (
                      item.type === 'directory' ? (
                        <RecentDirectoryItem
                          key={`dir-${item.id}`}
                          directoryName={item.directoryName!}
                          moduleName={item.displayName}
                          moduleType={item.moduleType!}
                          portalHostname={item.portalHostname!}
                          lastAccessed={item.lastAccessed}
                          onClick={() => showOpenModuleDirectoryDialog(item.id)}
                        />
                      ) : (
                        <RecentFileItem
                          key={`file-${item.id}`}
                          fileName={item.displayName}
                          lastAccessed={item.lastAccessed}
                          onClick={() => openRecentFile(item.id)}
                        />
                      )
                    ))}
                  </div>
                ) : (
                  <Empty className="border-0 py-6">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileCode className="size-4" />
                      </EmptyMedia>
                      <EmptyTitle className="text-xs">No recent files</EmptyTitle>
                      <EmptyDescription className="text-[10px]">
                        Files you open will appear here
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Footer Tip */}
          <div className="w-full flex items-center justify-center">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Tip</span>
              <div className="flex items-center gap-0.5">
                <Kbd>⌘</Kbd>
                <Kbd>⇧</Kbd>
                <Kbd>P</Kbd>
              </div>
              <span>opens the command palette</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
