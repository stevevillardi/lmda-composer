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
  FileText,
  Database,
} from 'lucide-react';
import { portalToasts } from '../../utils/toast-utils';
import { useEditorStore } from '../../stores/editor-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import logoIcon from '@/assets/icon128.png';

// ============================================================================
// Shared Visuals
// ============================================================================

export function GradientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Purple accent glow - top right */}
      <div className="
        absolute -top-24 -right-24 size-64 rounded-full bg-purple-400/25
        blur-3xl
        dark:bg-purple-500/15
      " />
      {/* Teal accent glow - left side */}
      <div className="
        absolute top-40 -left-24 size-72 rounded-full bg-teal-400/25 blur-3xl
        dark:bg-teal-500/15
      " />
      {/* Cyan accent glow - bottom */}
      <div className="
        absolute right-1/3 bottom-0 size-48 rounded-full bg-cyan-400/20 blur-3xl
        dark:bg-cyan-500/10
      " />
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
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left",
        `
          group transition-colors
          hover:bg-accent/50
        `,
        `
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 focus-visible:outline-none
        `
      )}
    >
      <FileCode className="
        size-3.5 shrink-0 text-muted-foreground transition-colors
        group-hover:text-primary
      " />
      <span className="
        flex-1 truncate text-xs text-foreground transition-colors
        group-hover:text-primary
      ">
        {fileName}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
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
              "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left",
              `
                group transition-colors
                hover:bg-accent/50
              `,
              `
                focus-visible:ring-2 focus-visible:ring-ring
                focus-visible:ring-offset-2 focus-visible:outline-none
              `
            )}
          >
            <Folder className="
              size-3.5 shrink-0 text-primary/70 transition-colors
              group-hover:text-primary
            " />
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="
                truncate text-xs text-foreground transition-colors
                group-hover:text-primary
              ">
                {moduleName}
              </span>
              <span className="
                shrink-0 rounded-sm bg-muted/50 px-1 py-0.5 text-[10px]
                text-muted-foreground/60
              ">
                {moduleType}
              </span>
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">
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
    setCreateModuleWizardOpen,
  } = useEditorStore();

  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  // Show a persistent toast when no portal is connected
  useEffect(() => {
    if (!selectedPortalId) {
      portalToasts.noPortalConnected();
    }
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
    <div className="relative flex h-full flex-col overflow-auto bg-background" tabIndex={-1}>
      <GradientBackground />
      {/* Toast is handled via useEffect, no banner rendered here */}
      
      <div className="relative z-10 flex flex-1 items-center justify-center p-4">
        <div className="
          w-full max-w-4xl animate-in space-y-8 duration-500 fade-in
          slide-in-from-bottom-4
        ">
          {/* Header */}
          <div className="
            flex flex-col items-center gap-4 text-center select-none
          ">
            <div className="relative">
              <div className="
                absolute inset-0 rounded-full bg-primary/20 blur-xl
              " />
              <img src={logoIcon} alt="LMDA Composer" className="
                relative size-20 drop-shadow-sm
              " draggable={false} />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                Welcome to LMDA Composer
              </h1>
              <p className="mx-auto max-w-lg text-lg text-muted-foreground">
                Your dedicated workspace for LogicMonitor scripting. Build, test, and debug with confidence.
              </p>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="
            mx-auto grid w-full max-w-4xl grid-cols-1 gap-4
            sm:grid-cols-2
            lg:grid-cols-4
          ">
            <button
              onClick={createNewFile}
              className={cn(
                `
                  group flex flex-col items-center justify-center gap-3
                  rounded-xl border border-border/60 bg-card/60 p-6
                `,
                `
                  transition-all
                  hover:scale-[1.02] hover:border-primary/30 hover:bg-card/80
                  hover:shadow-lg
                `,
                `
                  focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2 focus-visible:outline-none
                `
              )}
            >
              <div className="
                flex size-12 items-center justify-center rounded-full
                bg-primary/10 text-primary transition-colors
                group-hover:bg-primary/20
              ">
                <FilePlus className="size-6" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Create New Script</h3>
                <p className="mt-1 text-sm text-muted-foreground">Start a Groovy or PowerShell file</p>
              </div>
            </button>

            <button
              onClick={() => setCreateModuleWizardOpen(true)}
              className={cn(
                `
                  group flex flex-col items-center justify-center gap-3
                  rounded-xl border border-border/60 bg-card/60 p-6
                `,
                `
                  transition-all
                  hover:scale-[1.02] hover:border-primary/30 hover:bg-card/80
                  hover:shadow-lg
                `,
                `
                  focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2 focus-visible:outline-none
                `
              )}
            >
              <div className="
                flex size-12 items-center justify-center rounded-full
                bg-primary/10 text-primary transition-colors
                group-hover:bg-primary/20
              ">
                <Database className="size-6" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Create LogicModule</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a new module in your portal</p>
              </div>
            </button>

            <button
              onClick={openFileFromDisk}
              className={cn(
                `
                  group flex flex-col items-center justify-center gap-3
                  rounded-xl border border-border/60 bg-card/60 p-6
                `,
                `
                  transition-all
                  hover:scale-[1.02] hover:border-primary/30 hover:bg-card/80
                  hover:shadow-lg
                `,
                `
                  focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2 focus-visible:outline-none
                `
              )}
            >
              <div className="
                flex size-12 items-center justify-center rounded-full
                bg-primary/10 text-primary transition-colors
                group-hover:bg-primary/20
              ">
                <FolderOpen className="size-6" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Open File</h3>
                <p className="mt-1 text-sm text-muted-foreground">Open from your computer</p>
              </div>
            </button>

            <button
              onClick={() => void openModuleFolderFromDisk()}
              className={cn(
                `
                  group flex flex-col items-center justify-center gap-3
                  rounded-xl border border-border/60 bg-card/60 p-6
                `,
                `
                  transition-all
                  hover:scale-[1.02] hover:border-primary/30 hover:bg-card/80
                  hover:shadow-lg
                `,
                `
                  focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2 focus-visible:outline-none
                `
              )}
            >
              <div className="
                flex size-12 items-center justify-center rounded-full
                bg-primary/10 text-primary transition-colors
                group-hover:bg-primary/20
              ">
                <Folder className="size-6" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Open Module Folder</h3>
                <p className="mt-1 text-sm text-muted-foreground">Open a saved module directory</p>
              </div>
            </button>
          </div>

          {/* Conditional Content: History vs Educational */}
          {hasRecentFiles ? (
            <Card className="border-border/60 bg-card/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="
                  flex items-center gap-2 text-lg font-medium
                ">
                  <Clock className="size-5 text-primary" />
                  Recent Files
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="
                  grid grid-cols-1 gap-2
                  md:grid-cols-2
                ">
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
            <div className="
              grid gap-6 pt-4
              md:grid-cols-2
            ">
              <Card className="
                border-border/60 bg-card/40 backdrop-blur-sm select-none
              ">
                <CardHeader>
                  <CardTitle className="
                    flex items-center gap-2 text-lg font-medium
                  ">
                    <Play className="size-5 text-primary" />
                    Workflow Steps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {STEPS.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="
                          flex size-6 items-center justify-center rounded-full
                          bg-primary/10 text-xs font-medium text-primary
                        ">
                          {i + 1}
                        </div>
                        {i < STEPS.length - 1 && <div className="
                          my-1 w-px flex-1 bg-border
                        " />}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{step.title}</h4>
                        <p className="mt-0.5 text-xs text-muted-foreground">{step.body}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="
                border-border/60 bg-card/40 backdrop-blur-sm select-none
              ">
                <CardHeader>
                  <CardTitle className="
                    flex items-center gap-2 text-lg font-medium
                  ">
                    <Sparkles className="size-5 text-primary" />
                    Key Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {FEATURES.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <feature.icon className="
                          mt-0.5 size-4 shrink-0 text-primary
                        " />
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
