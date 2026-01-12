/**
 * Dialog shown when opening a module directory.
 * 
 * Allows user to select which scripts to open from the module.
 * Also handles:
 * - Detecting missing script files on disk
 * - Offering re-export from portal for missing scripts
 * - Showing file status (exists/missing/modified)
 */

import { useState, useEffect } from 'react';
import { FolderOpen, FileCode, Loader2, AlertTriangle, Download, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { directoryToasts } from '../../utils/toast-utils';
import { useEditorStore } from '../../stores/editor-store';
import * as documentStore from '../../utils/document-store';
import type { ModuleDirectoryConfig } from '@/shared/types';

interface ScriptStatus {
  exists: boolean;
  modified: boolean;
  canReExport: boolean;
}

export function OpenModuleDirectoryDialog() {
  const {
    openModuleDirectoryDialogOpen,
    openModuleDirectoryDialogId,
    setOpenModuleDirectoryDialogOpen,
    openModuleDirectory,
    selectedPortalId,
    loadRecentFiles,
  } = useEditorStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isReExporting, setIsReExporting] = useState(false);
  const [config, setConfig] = useState<ModuleDirectoryConfig | null>(null);
  const [directoryName, setDirectoryName] = useState<string>('');
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [selectedScripts, setSelectedScripts] = useState<Set<'collection' | 'ad'>>(new Set());
  const [scriptStatuses, setScriptStatuses] = useState<Record<string, ScriptStatus>>({});
  const [error, setError] = useState<string | null>(null);

  // Helper to clean up a deleted/invalid directory and close dialog
  const cleanupAndClose = async (directoryId: string, reason: string) => {
    await documentStore.deleteDirectoryHandle(directoryId);
    await loadRecentFiles();
    setOpenModuleDirectoryDialogOpen(false);
    directoryToasts.removed(reason);
  };

  // Load directory config when dialog opens
  useEffect(() => {
    if (!openModuleDirectoryDialogOpen || !openModuleDirectoryDialogId) {
      setConfig(null);
      setDirectoryHandle(null);
      setSelectedScripts(new Set());
      setScriptStatuses({});
      setError(null);
      return;
    }

    const loadConfig = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const record = await documentStore.getDirectoryHandleRecord(openModuleDirectoryDialogId);
        if (!record) {
          // Directory handle not found in IndexedDB - clean up and close
          await cleanupAndClose(openModuleDirectoryDialogId, 'The saved module directory could not be found.');
          setIsLoading(false);
          return;
        }

        setDirectoryName(record.directoryName);
        setDirectoryHandle(record.handle);

        // Request permission
        let permission = await documentStore.queryDirectoryPermission(record.handle);
        if (permission !== 'granted') {
          permission = (await documentStore.requestDirectoryPermission(record.handle)) ? 'granted' : 'denied';
        }

        if (permission !== 'granted') {
          setError('Permission denied. Click to retry.');
          setIsLoading(false);
          return;
        }

        // Read module.json
        let configJson: string | null = null;
        try {
          configJson = await documentStore.readFileFromDirectory(record.handle, 'module.json');
        } catch (readError) {
          // Directory may have been deleted - the handle exists but the folder is gone
          console.error('[ModuleDir] OpenModuleDirectoryDialog: Error reading directory:', readError);
          await cleanupAndClose(openModuleDirectoryDialogId, 'The module directory was deleted or moved.');
          setIsLoading(false);
          return;
        }
        
        if (!configJson) {
          // module.json doesn't exist - directory is invalid, clean up
          await cleanupAndClose(openModuleDirectoryDialogId, 'This folder does not contain a valid module.json file.');
          setIsLoading(false);
          return;
        }

        const parsedConfig = JSON.parse(configJson) as ModuleDirectoryConfig;
        setConfig(parsedConfig);
        
        // Check actual file existence and status for each script
        const statuses: Record<string, ScriptStatus> = {};
        const availableScripts = Object.keys(parsedConfig.scripts) as Array<'collection' | 'ad'>;
        const canReExport = !!selectedPortalId && 
          parsedConfig.portalBinding?.portalId === selectedPortalId;
        
        for (const scriptType of availableScripts) {
          const scriptConfig = parsedConfig.scripts[scriptType];
          if (!scriptConfig) continue;
          
          const exists = await documentStore.fileExistsInDirectory(record.handle, scriptConfig.fileName);
          let modified = false;
          
          if (exists && scriptConfig.diskChecksum) {
            // Check if file was modified externally by comparing checksums
            const content = await documentStore.readFileFromDirectory(record.handle, scriptConfig.fileName);
            if (content !== null) {
              const currentChecksum = await documentStore.computeChecksum(content);
              modified = currentChecksum !== scriptConfig.diskChecksum;
            }
          }
          
          statuses[scriptType] = { exists, modified, canReExport };
        }
        
        setScriptStatuses(statuses);
        
        // Pre-select only scripts that exist
        const existingScripts = availableScripts.filter(s => statuses[s]?.exists);
        setSelectedScripts(new Set(existingScripts));
      } catch (err) {
        console.error('[ModuleDir] OpenModuleDirectoryDialog: Failed to load config:', err);
        setError('Failed to read module configuration.');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [openModuleDirectoryDialogOpen, openModuleDirectoryDialogId, selectedPortalId]);

  const handleToggleScript = (scriptType: 'collection' | 'ad') => {
    // Only allow toggling scripts that exist
    const status = scriptStatuses[scriptType];
    if (!status?.exists) return;
    
    setSelectedScripts(prev => {
      const next = new Set(prev);
      if (next.has(scriptType)) {
        next.delete(scriptType);
      } else {
        next.add(scriptType);
      }
      return next;
    });
  };

  const handleOpen = async () => {
    if (!openModuleDirectoryDialogId || selectedScripts.size === 0) return;
    
    setIsOpening(true);
    try {
      await openModuleDirectory(openModuleDirectoryDialogId, Array.from(selectedScripts));
    } finally {
      setIsOpening(false);
    }
  };

  const handleReExport = async (scriptType: 'collection' | 'ad') => {
    if (!config || !directoryHandle || !selectedPortalId) {
      return;
    }
    
    const { portalBinding } = config;
    if (portalBinding.portalId !== selectedPortalId) {
      directoryToasts.portalMismatch(portalBinding.portalHostname);
      return;
    }

    setIsReExporting(true);
    
    try {
      // Fetch the module from portal
      const { sendMessage } = await import('../../utils/chrome-messaging');
      const result = await sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId: portalBinding.portalId,
          moduleType: portalBinding.moduleType,
          moduleId: portalBinding.moduleId,
        },
      });

      if (!result.ok) {
        directoryToasts.fetchModuleFailed(result.error);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const module = result.data as any;
      
      // Extract the script content
      let scriptContent = '';
      let scriptLanguage: 'groovy' | 'powershell' = 'groovy';
      
      if (scriptType === 'ad') {
        scriptContent = module.autoDiscoveryConfig?.method?.groovyScript || '';
      } else {
        // Collection script
        if (
          portalBinding.moduleType === 'propertysource' ||
          portalBinding.moduleType === 'diagnosticsource' ||
          portalBinding.moduleType === 'eventsource'
        ) {
          scriptContent = module.groovyScript || '';
        } else if (portalBinding.moduleType === 'logsource') {
          scriptContent = module.collectionAttribute?.script?.embeddedContent
            || module.collectionAttribute?.groovyScript
            || '';
        } else {
          // DataSource, ConfigSource, TopologySource
          scriptContent = module.collectorAttribute?.groovyScript || '';
          const rawScriptType = module.scriptType || module.collectorAttribute?.scriptType || 'embed';
          scriptLanguage = rawScriptType.toLowerCase() === 'powershell' ? 'powershell' : 'groovy';
        }
      }

      if (!scriptContent) {
        directoryToasts.scriptEmpty(scriptType);
        return;
      }

      // Determine filename
      const scriptConfig = config.scripts[scriptType];
      const extension = scriptLanguage === 'powershell' ? '.ps1' : '.groovy';
      const fileName = scriptConfig?.fileName || (scriptType === 'ad' ? `ad${extension}` : `collection${extension}`);

      // Request write permission
      const writePermission = await documentStore.requestDirectoryPermission(directoryHandle, 'readwrite');
      if (!writePermission) {
        directoryToasts.permissionDenied();
        return;
      }

      // Write the script file
      await documentStore.writeFileToDirectory(directoryHandle, fileName, scriptContent);

      // Update module.json with new checksums
      const checksum = await documentStore.computeChecksum(scriptContent);
      const configJson = await documentStore.readFileFromDirectory(directoryHandle, 'module.json');
      if (configJson) {
        const updatedConfig = JSON.parse(configJson) as ModuleDirectoryConfig;
        if (!updatedConfig.scripts[scriptType]) {
          updatedConfig.scripts[scriptType] = {
            fileName,
            language: scriptLanguage,
            mode: scriptType === 'ad' ? 'ad' : 'collection',
            portalChecksum: checksum,
            diskChecksum: checksum,
          };
        } else {
          updatedConfig.scripts[scriptType].portalChecksum = checksum;
          updatedConfig.scripts[scriptType].diskChecksum = checksum;
        }
        await documentStore.writeFileToDirectory(directoryHandle, 'module.json', JSON.stringify(updatedConfig, null, 2));
        setConfig(updatedConfig);
      }

      // Update script status
      setScriptStatuses(prev => ({
        ...prev,
        [scriptType]: { exists: true, modified: false, canReExport: true },
      }));
      
      // Auto-select the re-exported script
      setSelectedScripts(prev => new Set([...prev, scriptType]));

      directoryToasts.reExported(fileName);
    } catch (err) {
      console.error('[ModuleDir] handleReExport: Failed:', err);
      directoryToasts.reExportFailed(err instanceof Error ? err : undefined);
    } finally {
      setIsReExporting(false);
    }
  };

  const availableScripts = config ? Object.keys(config.scripts) as Array<'collection' | 'ad'> : [];
  const hasAnyMissingScripts = availableScripts.some(s => !scriptStatuses[s]?.exists);
  const canReExportMissing = hasAnyMissingScripts && 
    config?.portalBinding?.portalId === selectedPortalId;

  return (
    <Dialog open={openModuleDirectoryDialogOpen} onOpenChange={setOpenModuleDirectoryDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="size-5" />
            Open Module Directory
          </DialogTitle>
          <DialogDescription>
            Select which scripts to open from this module.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="
              flex items-center justify-center py-8 text-muted-foreground
            ">
              <Loader2 className="mr-2 size-5 animate-spin" />
              <span className="text-sm">Loading module configuration...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : config ? (
            <>
              {/* Module info */}
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {config.portalBinding.moduleName}
                </div>
                <div className="
                  flex items-center gap-2 text-xs text-muted-foreground
                ">
                  <Badge variant="secondary" className="text-xs">
                    {config.portalBinding.moduleType}
                  </Badge>
                  <span>{config.portalBinding.portalHostname}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Directory: {directoryName}
                </div>
              </div>

              {/* Script selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="
                    text-xs font-medium tracking-wide text-muted-foreground
                    uppercase
                  ">
                    Scripts to Open
                  </div>
                  {hasAnyMissingScripts && !canReExportMissing && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="
                          border-amber-600/50 text-xs text-yellow-600
                        ">
                          <AlertTriangle className="mr-1 size-3" />
                          Missing files
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Switch to portal "{config.portalBinding.portalHostname}" to re-export missing scripts
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {availableScripts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scripts found in this module.</p>
                ) : (
                  <div className="space-y-2">
                    {availableScripts.map((scriptType) => {
                      const scriptConfig = config.scripts[scriptType];
                      if (!scriptConfig) return null;
                      
                      const status = scriptStatuses[scriptType];
                      const isMissing = !status?.exists;
                      const isModified = status?.modified;
                      
                      return (
                        <div 
                          key={scriptType}
                          className={`
                            flex items-center gap-3 rounded-md border p-3
                            ${
                            isMissing 
                              ? 'border-amber-600/50 bg-yellow-500/5' 
                              : 'border-border/70 bg-card/30'
                          }
                          `}
                        >
                          <Checkbox
                            id={`script-${scriptType}`}
                            checked={selectedScripts.has(scriptType)}
                            onCheckedChange={() => handleToggleScript(scriptType)}
                            disabled={isMissing}
                          />
                          <Label 
                            htmlFor={`script-${scriptType}`}
                            className={`
                              flex flex-1 items-center gap-2
                              ${isMissing ? `opacity-60` : `cursor-pointer`}
                            `}
                          >
                            <FileCode className="size-4 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="
                                flex items-center gap-2 text-sm font-medium
                                capitalize
                              ">
                                {scriptType === 'collection' ? 'Collection' : 'Active Discovery'}
                                {isMissing && (
                                  <Badge variant="outline" className="
                                    border-amber-600/50 text-xs text-yellow-600
                                  ">
                                    <AlertTriangle className="mr-1 size-3" />
                                    Missing
                                  </Badge>
                                )}
                                {!isMissing && isModified && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="
                                        border-blue-600/50 text-xs text-cyan-600
                                      ">
                                        Modified
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      File was modified externally since last save
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {!isMissing && !isModified && (
                                  <CheckCircle2 className="size-3 text-teal-600" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {scriptConfig.fileName} ({scriptConfig.language})
                              </div>
                            </div>
                          </Label>
                          {isMissing && status?.canReExport && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleReExport(scriptType)}
                                  disabled={isReExporting}
                                >
                                  {isReExporting ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="mr-1 size-3" />
                                      Re-export
                                    </>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Download script from portal and save to directory
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="ghost" 
            onClick={() => setOpenModuleDirectoryDialogOpen(false)}
            disabled={isOpening}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleOpen}
            disabled={isLoading || isOpening || selectedScripts.size === 0 || !!error}
          >
            {isOpening ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <FolderOpen className="mr-2 size-4" />
                Open Selected
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

