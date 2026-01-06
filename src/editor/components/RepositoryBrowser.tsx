import { useState, useEffect, useCallback } from 'react';
import { 
  GitBranch, 
  FolderOpen, 
  Trash2, 
  RefreshCw,
  Clock,
  Globe,
  FileCode2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Loader2,
  FolderX,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { RepositoryInfo } from '@/shared/types';
import { 
  getRepositoryInfoList, 
  deleteRepository,
  getRepository,
  getModuleFilesForRepository,
  queryDirectoryPermission,
  requestDirectoryPermission,
} from '../utils/repository-store';
import type { StoredModuleFile } from '../utils/repository-store';

interface RepositoryBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenModule: (moduleFile: StoredModuleFile) => void;
}

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

interface ExpandedRepoState {
  repoId: string;
  files: StoredModuleFile[];
  isLoading: boolean;
  hasPermission: boolean;
}

export function RepositoryBrowser({ 
  open, 
  onOpenChange,
  onOpenModule,
}: RepositoryBrowserProps) {
  const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRepos, setExpandedRepos] = useState<Record<string, ExpandedRepoState>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRepositories = useCallback(async () => {
    setIsLoading(true);
    try {
      const repos = await getRepositoryInfoList();
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      toast.error('Failed to load repositories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadRepositories();
    }
  }, [open, loadRepositories]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRepositories();
    setIsRefreshing(false);
  };

  const handleDeleteRepo = async (repoId: string, displayPath: string) => {
    if (!confirm(`Delete repository "${displayPath}"? This will remove it from the browser but won't delete files from disk.`)) {
      return;
    }
    
    try {
      await deleteRepository(repoId);
      setRepositories(repos => repos.filter(r => r.id !== repoId));
      setExpandedRepos(expanded => {
        const newExpanded = { ...expanded };
        delete newExpanded[repoId];
        return newExpanded;
      });
      toast.success('Repository removed');
    } catch (error) {
      console.error('Failed to delete repository:', error);
      toast.error('Failed to remove repository');
    }
  };

  const handleToggleRepo = async (repoId: string) => {
    const current = expandedRepos[repoId];
    
    if (current) {
      // Collapse
      setExpandedRepos(expanded => {
        const newExpanded = { ...expanded };
        delete newExpanded[repoId];
        return newExpanded;
      });
      return;
    }
    
    // Expand and load files
    setExpandedRepos(expanded => ({
      ...expanded,
      [repoId]: { repoId, files: [], isLoading: true, hasPermission: false },
    }));
    
    try {
      const repo = await getRepository(repoId);
      if (!repo) {
        throw new Error('Repository not found');
      }
      
      // Check permission
      let hasPermission = await queryDirectoryPermission(repo.handle) === 'granted';
      
      // Request permission if needed
      if (!hasPermission) {
        hasPermission = await requestDirectoryPermission(repo.handle);
      }
      
      if (!hasPermission) {
        setExpandedRepos(expanded => ({
          ...expanded,
          [repoId]: { repoId, files: [], isLoading: false, hasPermission: false },
        }));
        return;
      }
      
      // Load module files
      const files = await getModuleFilesForRepository(repoId);
      
      setExpandedRepos(expanded => ({
        ...expanded,
        [repoId]: { repoId, files, isLoading: false, hasPermission: true },
      }));
    } catch (error) {
      console.error('Failed to load repository files:', error);
      setExpandedRepos(expanded => ({
        ...expanded,
        [repoId]: { repoId, files: [], isLoading: false, hasPermission: false },
      }));
    }
  };

  const handleOpenFile = async (file: StoredModuleFile) => {
    try {
      onOpenModule(file);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to open file:', error);
      toast.error('Failed to open file');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[400px] sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <GitBranch className="size-5" />
            Module Repositories
          </SheetTitle>
          <SheetDescription>
            Browse and open modules from your local git repositories.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
          <span className="text-sm text-muted-foreground">
            {repositories.length} repositor{repositories.length !== 1 ? 'ies' : 'y'}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-7 gap-1"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : repositories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderX className="size-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">No repositories</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Clone a module to a local directory to get started.
                </p>
              </div>
            ) : (
              repositories.map((repo) => {
                const expanded = expandedRepos[repo.id];
                const isExpanded = !!expanded;
                
                return (
                  <div 
                    key={repo.id}
                    className="border rounded-lg bg-card overflow-hidden"
                  >
                    {/* Repository header */}
                    <div 
                      className="flex items-start gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleToggleRepo(repo.id)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-5 p-0 shrink-0 mt-0.5"
                      >
                        {expanded?.isLoading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : isExpanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </Button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                          <span className="font-mono text-sm truncate font-medium">
                            {repo.displayPath}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
                        
                        {repo.portals.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {repo.portals.slice(0, 3).map(portal => (
                              <Badge key={portal} variant="secondary" className="text-[10px]">
                                {portal}
                              </Badge>
                            ))}
                            {repo.portals.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{repo.portals.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRepo(repo.id, repo.displayPath);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent>Remove from list</TooltipContent>
                      </Tooltip>
                    </div>
                    
                    {/* Expanded file list */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30">
                        {expanded.isLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : !expanded.hasPermission ? (
                          <Alert className="m-2 py-2">
                            <AlertCircle className="size-4" />
                            <AlertDescription className="text-xs">
                              Click to grant access to this directory.
                            </AlertDescription>
                          </Alert>
                        ) : expanded.files.length === 0 ? (
                          <div className="py-4 px-3 text-sm text-muted-foreground text-center">
                            No module files found
                          </div>
                        ) : (
                          <div className="py-1">
                            {expanded.files.map(file => (
                              <div
                                key={file.fileId}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleOpenFile(file)}
                              >
                                <FileCode2 className="size-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-mono truncate block">
                                    {file.relativePath.split('/').slice(-2).join('/')}
                                  </span>
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {file.scriptType} script
                                  </span>
                                </div>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {file.scriptType === 'ad' ? 'AD' : 'Collection'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

