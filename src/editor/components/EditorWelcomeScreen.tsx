import { useEffect } from 'react';
import {
  FilePlus,
  FolderOpen,
  CloudDownload,
  FileCode,
  Clock,
  Folder,
  ArrowUpRight,
  Target,
  Play,
  Sparkles,
  Layers,
  Puzzle,
  Terminal,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import logoIcon from '@/assets/icon128.png';

// ============================================================================
// Shared Visuals
// ============================================================================

export function GradientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Purple accent glow - top right */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-400/25 blur-3xl dark:bg-purple-500/15" />
      {/* Teal accent glow - left side */}
      <div className="absolute top-40 -left-24 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl dark:bg-teal-500/15" />
      {/* Cyan accent glow - bottom */}
      <div className="absolute bottom-0 right-1/3 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10" />
    </div>
  );
}

// ============================================================================
// Constants - Educational Content
// ============================================================================

const STEPS = [
  {
    title: 'Open the Composer',
    body: 'Click the extension icon, or use the “Open in LMDA Composer” link in the resource menu or LMX module tab.',
    icon: ArrowUpRight,
  },
  {
    title: 'Choose a target',
    body: 'Pick a portal and collector. Select a device if your script needs host properties.',
    icon: Target,
  },
  {
    title: 'Run and validate',
    body: 'Pick a mode (Freeform, AD, Collection, Batch) to validate output and see parsed results.',
    icon: Play,
  },
];

const FEATURES = [
  { label: 'Run Groovy and PowerShell against any collector', icon: Play },
  { label: 'Switch between Freeform, AD, Collection, and Batch modes', icon: Layers },
  { label: 'Browse modules, compare lineage, and commit back', icon: CloudDownload },
  { label: 'Use snippets and templates to move faster', icon: Puzzle },
  { label: 'Review execution history and parsed output', icon: Terminal },
  { label: 'Open and save local script files', icon: FileText },
];

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
        "flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-md",
        "hover:bg-accent/50 transition-colors group"
      )}
    >
      <FileCode className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
      <span className="text-xs truncate text-foreground group-hover:text-primary flex-1 transition-colors">
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
              "flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-md",
              "hover:bg-accent/50 transition-colors group"
            )}
          >
            <Folder className="size-3.5 text-primary/70 group-hover:text-primary shrink-0 transition-colors" />
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="text-xs truncate text-foreground group-hover:text-primary transition-colors">
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
    loadRecentFiles,
    openRecentFile,
    showOpenModuleDirectoryDialog,
    openModuleFolderFromDisk,
    createNewFile,
    openFileFromDisk,
  } = useEditorStore();

  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  // Show a persistent toast when no portal is connected
  useEffect(() => {
    if (!selectedPortalId) {
      toast.warning('No Portal Connected', {
        id: 'connect-warning',
        description: 'Connect to a LogicMonitor portal to run scripts and access data.',
        duration: Infinity,
        dismissible: true,
      });
    } else {
      toast.dismiss('connect-warning');
    }
    
    // Cleanup on unmount (optional, but good practice if we want the toast to hide when leaving this screen)
    // However, for a "global" state like connection, maybe we want it to persist?
    // Given the previous banner was PART of this screen, it should probably hide if we leave this screen.
    return () => {
      toast.dismiss('connect-warning');
    };
  }, [selectedPortalId]);

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
    <div className="h-full relative flex flex-col bg-background overflow-auto" tabIndex={-1}>
      <GradientBackground />
      {/* Toast is handled via useEffect, no banner rendered here */}
      
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <img src={logoIcon} alt="LMDA Composer" className="relative size-20 drop-shadow-sm" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                Welcome to LMDA Composer
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                Your dedicated workspace for LogicMonitor scripting. Build, test, and debug with confidence.
              </p>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto w-full">
            <button
              onClick={createNewFile}
              className="group flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border/60 bg-card/60 hover:bg-card/80 transition-all hover:scale-[1.02] hover:shadow-lg hover:border-primary/30"
            >
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                <FilePlus className="size-6" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Create New Script</h3>
                <p className="text-sm text-muted-foreground mt-1">Start a Groovy or PowerShell file</p>
              </div>
            </button>

            <button
              onClick={openFileFromDisk}
              className="group flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border/60 bg-card/60 hover:bg-card/80 transition-all hover:scale-[1.02] hover:shadow-lg hover:border-primary/30"
            >
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                <FolderOpen className="size-6" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Open File</h3>
                <p className="text-sm text-muted-foreground mt-1">Open from your computer</p>
              </div>
            </button>

            <button
              onClick={() => void openModuleFolderFromDisk()}
              className="group flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border/60 bg-card/60 hover:bg-card/80 transition-all hover:scale-[1.02] hover:shadow-lg hover:border-primary/30"
            >
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                <Folder className="size-6" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Open Module Folder</h3>
                <p className="text-sm text-muted-foreground mt-1">Open a saved module directory</p>
              </div>
            </button>
          </div>

          {/* Conditional Content: History vs Educational */}
          {hasRecentFiles ? (
            <Card className="bg-card/40 border-border/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Clock className="size-5 text-primary" />
                  Recent Files
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 pt-4">
              <Card className="bg-card/40 border-border/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Play className="size-5 text-primary" />
                    Workflow Steps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {STEPS.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                          {i + 1}
                        </div>
                        {i < STEPS.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{step.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.body}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Sparkles className="size-5 text-primary" />
                    Key Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {FEATURES.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <feature.icon className="size-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
