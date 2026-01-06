import { useState, useEffect, useMemo } from 'react';
import { 
  GitBranch, 
  Loader2, 
  FolderOpen, 
  Check, 
  AlertCircle,
  Plus,
  Clock,
  Globe,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { LogicModuleType, RepositoryInfo, CloneResult } from '@/shared/types';
import { 
  getRepositoryInfoList, 
  isDirectoryPickerSupported,
} from '../utils/document-store';
import { pickOrCreateRepository } from '../utils/module-repository';

interface CloneModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClone: (repositoryId: string | null, overwrite: boolean) => Promise<CloneResult>;
  moduleName: string;
  moduleType: LogicModuleType;
  portalHostname: string;
  hasCollectionScript: boolean;
  hasAdScript: boolean;
  scriptLanguage?: 'groovy' | 'powershell';
}

function getScriptExtension(language?: 'groovy' | 'powershell'): string {
  return language === 'powershell' ? '.ps1' : '.groovy';
}

const MODULE_TYPE_LABELS: Record<LogicModuleType, string> = {
  datasource: 'DataSource',
  configsource: 'ConfigSource',
  topologysource: 'TopologySource',
  propertysource: 'PropertySource',
  logsource: 'LogSource',
  diagnosticsource: 'DiagnosticSource',
  eventsource: 'EventSource',
};

const MODULE_TYPE_DIRS: Record<LogicModuleType, string> = {
  datasource: 'datasources',
  configsource: 'configsources',
  topologysource: 'topologysources',
  propertysource: 'propertysources',
  logsource: 'logsources',
  diagnosticsource: 'diagnosticsources',
  eventsource: 'eventsources',
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function CloneModuleDialog({
  open,
  onOpenChange,
  onClone,
  moduleName,
  moduleType,
  portalHostname,
  hasCollectionScript,
  hasAdScript,
  scriptLanguage,
}: CloneModuleDialogProps) {
  const extension = getScriptExtension(scriptLanguage);
  const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [newlyPickedRepo, setNewlyPickedRepo] = useState<RepositoryInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CloneResult | null>(null);
  const [overwrite, setOverwrite] = useState(false);

  const isSupported = isDirectoryPickerSupported();

  // Load repositories when dialog opens and reset state
  useEffect(() => {
    if (open) {
      // Reset all state when dialog opens
      setError(null);
      setResult(null);
      setOverwrite(false);
      setSelectedRepoId(null); // Reset selection to force re-evaluation
      setNewlyPickedRepo(null);
      loadRepositories();
    }
  }, [open]);

  const loadRepositories = async () => {
    setIsLoading(true);
    try {
      const repos = await getRepositoryInfoList();
      setRepositories(repos);
      // Auto-select the first repository if available (selectedRepoId was reset above)
      if (repos.length > 0) {
        setSelectedRepoId(repos[0].id);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle picking a new directory
  const handlePickNewDirectory = async () => {
    setIsPicking(true);
    setError(null);
    try {
      const repo = await pickOrCreateRepository();
      if (repo) {
        // Add to repositories list and select it
        setNewlyPickedRepo({
          id: repo.id,
          displayPath: repo.displayPath,
          lastAccessed: repo.lastAccessed,
          portals: repo.portals,
        });
        setSelectedRepoId(repo.id);
      }
    } catch (err) {
      console.error('Failed to pick directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to select directory');
    } finally {
      setIsPicking(false);
    }
  };

  // Combine existing repos with newly picked one
  const allRepositories = useMemo(() => {
    if (newlyPickedRepo && !repositories.find(r => r.id === newlyPickedRepo.id)) {
      return [newlyPickedRepo, ...repositories];
    }
    return repositories;
  }, [repositories, newlyPickedRepo]);

  const expectedPath = useMemo(() => {
    if (!selectedRepoId) {
      return `<choose directory>/${portalHostname}/${MODULE_TYPE_DIRS[moduleType]}/${moduleName}/`;
    }
    const repo = allRepositories.find(r => r.id === selectedRepoId);
    if (!repo) return '';
    return `${repo.displayPath}/${portalHostname}/${MODULE_TYPE_DIRS[moduleType]}/${moduleName}/`;
  }, [selectedRepoId, allRepositories, portalHostname, moduleType, moduleName]);

  const handleClone = async () => {
    setIsCloning(true);
    setError(null);
    setResult(null);
    
    try {
      // Pass null for selectedRepoId if "new" is selected
      const repoId = selectedRepoId === 'new' ? null : selectedRepoId;
      const cloneResult = await onClone(repoId, overwrite);
      
      if (cloneResult.success) {
        setResult(cloneResult);
      } else {
        setError(cloneResult.error || 'Failed to clone module');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCloning(false);
    }
  };

  const handleClose = () => {
    if (!isCloning) {
      onOpenChange(false);
    }
  };

  if (!isSupported) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl!">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="size-5" />
              Clone to Repository
            </DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Your browser does not support the File System Access API required for this feature.
              Please use Chrome, Edge, or another Chromium-based browser.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl!">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-5" />
            Clone to Repository
          </DialogTitle>
          <DialogDescription>
            Save module scripts and metadata to a local directory for git version control.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Module info */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Module</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{moduleName}</Badge>
              <Badge variant="secondary">{MODULE_TYPE_LABELS[moduleType]}</Badge>
              <Badge variant="default" className="gap-1">
                <Globe className="size-3" />
                {portalHostname}
              </Badge>
            </div>
          </div>

          {/* Scripts to clone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Scripts to Clone</Label>
            <div className="flex gap-2">
              {hasCollectionScript && (
                <Badge variant="secondary">collection{extension}</Badge>
              )}
              {hasAdScript && (
                <Badge variant="secondary">ad{extension}</Badge>
              )}
              <Badge variant="outline">module.json</Badge>
            </div>
          </div>

          {/* Repository selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Destination Repository</Label>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <RadioGroup
                  value={selectedRepoId || ''}
                  onValueChange={(value) => setSelectedRepoId(value ? String(value) : null)}
                  className="space-y-2"
                >
                  {/* Existing repositories (including newly picked) */}
                  {allRepositories.map((repo) => (
                    <div
                      key={repo.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedRepoId === repo.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50",
                        newlyPickedRepo?.id === repo.id && "ring-2 ring-green-500/50"
                      )}
                      onClick={() => setSelectedRepoId(repo.id)}
                    >
                      <RadioGroupItem value={repo.id} id={repo.id} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                          <span className="font-mono text-sm truncate">{repo.displayPath}</span>
                          {newlyPickedRepo?.id === repo.id && (
                            <Badge variant="secondary" className="text-xs">New</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatRelativeTime(repo.lastAccessed)}
                          </span>
                          {repo.portals.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Globe className="size-3" />
                              {repo.portals.length} portal{repo.portals.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                {/* Choose new directory button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2 border-dashed"
                  onClick={handlePickNewDirectory}
                  disabled={isPicking}
                >
                  {isPicking ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Selecting...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4 mr-2" />
                      Choose New Directory...
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Expected path preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Files will be created at</Label>
            <div className="font-mono text-xs bg-muted/50 p-2 rounded border border-border truncate">
              {expectedPath}
            </div>
          </div>

          {/* Overwrite option */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="overwrite"
              checked={overwrite}
              onCheckedChange={(checked) => setOverwrite(checked === true)}
            />
            <Label htmlFor="overwrite" className="text-sm cursor-pointer">
              Overwrite if module already exists
            </Label>
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success message */}
          {result?.success && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <Check className="size-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                <div className="font-medium">Module cloned successfully!</div>
                <div className="text-xs mt-1 font-mono">{result.modulePath}</div>
                <div className="text-xs mt-2">
                  Use your git tools to commit: <code className="bg-muted px-1 rounded">git add . && git commit</code>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isCloning}>
            {result?.success ? 'Close' : 'Cancel'}
          </Button>
          {!result?.success && (
            <Button onClick={handleClone} disabled={isCloning || isPicking || !selectedRepoId}>
              {isCloning ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Cloning...
                </>
              ) : (
                <>
                  <GitBranch className="size-4 mr-2" />
                  Clone Module
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

