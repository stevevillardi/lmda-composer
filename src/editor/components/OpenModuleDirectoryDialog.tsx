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
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import * as documentStore from '../utils/document-store';
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
      console.log('[ModuleDir] OpenModuleDirectoryDialog: Loading config for:', openModuleDirectoryDialogId);
      setIsLoading(true);
      setError(null);
      
      try {
        const record = await documentStore.getDirectoryHandleRecord(openModuleDirectoryDialogId);
        if (!record) {
          console.log('[ModuleDir] OpenModuleDirectoryDialog: Directory not found in storage');
          setError('Directory not found in storage.');
          setIsLoading(false);
          return;
        }
        console.log('[ModuleDir] OpenModuleDirectoryDialog: Found directory:', record.directoryName);

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
        const configJson = await documentStore.readFileFromDirectory(record.handle, 'module.json');
        if (!configJson) {
          setError('Could not find module.json in this directory.');
          setIsLoading(false);
          return;
        }

        const parsedConfig = JSON.parse(configJson) as ModuleDirectoryConfig;
        console.log('[ModuleDir] OpenModuleDirectoryDialog: Parsed config:', {
          moduleName: parsedConfig.portalBinding.moduleName,
          scripts: Object.keys(parsedConfig.scripts),
        });
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
        
        console.log('[ModuleDir] OpenModuleDirectoryDialog: Script statuses:', statuses);
        setScriptStatuses(statuses);
        
        // Pre-select only scripts that exist
        const existingScripts = availableScripts.filter(s => statuses[s]?.exists);
        console.log('[ModuleDir] OpenModuleDirectoryDialog: Pre-selected scripts:', existingScripts);
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
    
    console.log('[ModuleDir] OpenModuleDirectoryDialog: Opening with scripts:', Array.from(selectedScripts));
    setIsOpening(true);
    try {
      await openModuleDirectory(openModuleDirectoryDialogId, Array.from(selectedScripts));
      console.log('[ModuleDir] OpenModuleDirectoryDialog: Open complete');
    } finally {
      setIsOpening(false);
    }
  };

  const handleReExport = async (scriptType: 'collection' | 'ad') => {
    console.log('[ModuleDir] handleReExport: Starting for scriptType:', scriptType);
    if (!config || !directoryHandle || !selectedPortalId) {
      console.log('[ModuleDir] handleReExport: Missing requirements', { config: !!config, directoryHandle: !!directoryHandle, selectedPortalId });
      return;
    }
    
    const { portalBinding } = config;
    if (portalBinding.portalId !== selectedPortalId) {
      console.log('[ModuleDir] handleReExport: Portal mismatch', { expected: portalBinding.portalId, current: selectedPortalId });
      toast.error('Portal mismatch', {
        description: `Switch to portal "${portalBinding.portalHostname}" to re-export this script.`,
      });
      return;
    }

    setIsReExporting(true);
    
    try {
      // Fetch the module from portal
      console.log('[ModuleDir] handleReExport: Fetching module from portal...');
      const { sendMessage } = await import('../utils/chrome-messaging');
      const result = await sendMessage({
        type: 'FETCH_MODULE',
        payload: {
          portalId: portalBinding.portalId,
          moduleType: portalBinding.moduleType,
          moduleId: portalBinding.moduleId,
        },
      });

      if (!result.ok) {
        toast.error('Failed to fetch module', {
          description: result.error || 'Could not retrieve module from portal.',
        });
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
        toast.warning('Script is empty', {
          description: `The ${scriptType} script in the portal is empty.`,
        });
        return;
      }

      // Determine filename
      const scriptConfig = config.scripts[scriptType];
      const extension = scriptLanguage === 'powershell' ? '.ps1' : '.groovy';
      const fileName = scriptConfig?.fileName || (scriptType === 'ad' ? `ad${extension}` : `collection${extension}`);

      // Request write permission
      const writePermission = await documentStore.requestDirectoryPermission(directoryHandle, 'readwrite');
      if (!writePermission) {
        toast.error('Permission denied', {
          description: 'Cannot write to the module directory.',
        });
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
      console.log('[ModuleDir] handleReExport: Updating script status to exists=true');
      setScriptStatuses(prev => ({
        ...prev,
        [scriptType]: { exists: true, modified: false, canReExport: true },
      }));
      
      // Auto-select the re-exported script
      setSelectedScripts(prev => new Set([...prev, scriptType]));

      console.log('[ModuleDir] handleReExport: Complete!');
      toast.success('Script re-exported', {
        description: `${fileName} has been restored from the portal.`,
      });
    } catch (err) {
      console.error('[ModuleDir] handleReExport: Failed:', err);
      toast.error('Re-export failed', {
        description: err instanceof Error ? err.message : 'Unknown error occurred.',
      });
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

        <div className="py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" />
              <span className="text-sm">Loading module configuration...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : config ? (
            <>
              {/* Module info */}
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {config.portalBinding.moduleName}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Scripts to Open
                  </div>
                  {hasAnyMissingScripts && !canReExportMissing && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/50">
                          <AlertTriangle className="size-3 mr-1" />
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
                          className={`flex items-center gap-3 p-3 rounded-md border ${
                            isMissing 
                              ? 'border-amber-600/50 bg-amber-500/5' 
                              : 'border-border/70 bg-card/30'
                          }`}
                        >
                          <Checkbox
                            id={`script-${scriptType}`}
                            checked={selectedScripts.has(scriptType)}
                            onCheckedChange={() => handleToggleScript(scriptType)}
                            disabled={isMissing}
                          />
                          <Label 
                            htmlFor={`script-${scriptType}`}
                            className={`flex-1 flex items-center gap-2 ${isMissing ? 'opacity-60' : 'cursor-pointer'}`}
                          >
                            <FileCode className="size-4 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="text-sm font-medium capitalize flex items-center gap-2">
                                {scriptType}
                                {isMissing && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/50">
                                    <AlertTriangle className="size-3 mr-1" />
                                    Missing
                                  </Badge>
                                )}
                                {!isMissing && isModified && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-600/50">
                                        Modified
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      File was modified externally since last save
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {!isMissing && !isModified && (
                                  <CheckCircle2 className="size-3 text-green-600" />
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
                                      <Download className="size-3 mr-1" />
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
                <Loader2 className="size-4 mr-2 animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <FolderOpen className="size-4 mr-2" />
                Open Selected
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

