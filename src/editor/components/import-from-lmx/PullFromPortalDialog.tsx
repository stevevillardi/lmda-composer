/**
 * Dialog for pulling latest module scripts from the LogicMonitor portal.
 * 
 * Shows a comparison between local content and portal content for each script,
 * allowing the user to select which scripts to pull.
 */

import { useState, useEffect, useMemo } from 'react';
import { Download, Loader2, AlertCircle, Info, FileCode, RefreshCw, Settings } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { DiffEditor } from '../composer/DiffEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEditorStore } from '../../stores/editor-store';
import { EDITABLE_MODULE_DETAILS_FIELDS } from '../../utils/document-helpers';
import type { LogicModuleType } from '@/shared/types';

interface PullFromPortalDialogProps {
  tabId: string;
  moduleName: string;
  moduleType: LogicModuleType;
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

export function PullFromPortalDialog({
  tabId,
  moduleName,
  moduleType,
}: PullFromPortalDialogProps) {
  const {
    pullLatestDialogOpen,
    setPullLatestDialogOpen,
    scriptsForPull,
    selectedScriptsForPull,
    toggleScriptForPull,
    moduleDetailsForPull,
    includeDetailsInPull,
    setIncludeDetailsInPull,
    isFetchingForPull,
    isPullingLatest,
    fetchModuleForPull,
    pullLatestFromPortal,
    moduleDetailsDraftByTabId,
    preferences,
  } = useEditorStore();

  const [error, setError] = useState<string | null>(null);

  // Fetch module data when dialog opens
  useEffect(() => {
    if (pullLatestDialogOpen && tabId) {
      setError(null);
      fetchModuleForPull(tabId).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch module');
      });
    }
  }, [pullLatestDialogOpen, tabId, fetchModuleForPull]);

  // Map theme preference to Monaco theme
  const monacoTheme = useMemo(() => {
    if (preferences.theme === 'light') return 'vs';
    if (preferences.theme === 'dark') return 'vs-dark';
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'vs';
    }
    return 'vs-dark';
  }, [preferences.theme]);

  const handleConfirm = async () => {
    try {
      setError(null);
      const result = await pullLatestFromPortal(tabId);
      if (!result.success) {
        setError(result.error || 'Failed to pull from portal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull from portal');
    }
  };

  const handleCancel = () => {
    setPullLatestDialogOpen(false);
  };

  const scriptsWithChanges = scriptsForPull?.filter(s => s.hasChanges) ?? [];
  const hasSelectedScripts = selectedScriptsForPull.size > 0;
  const isLoading = isFetchingForPull;
  const isProcessing = isPullingLatest;

  // Compute module details changes
  const localDraft = moduleDetailsDraftByTabId[tabId];
  const detailsChanges = useMemo(() => {
    if (!moduleDetailsForPull?.portalDetails || !localDraft?.original) return [];
    
    const changes: Array<{ field: string; label: string; localValue: string; portalValue: string }> = [];
    
    for (const { key, label } of EDITABLE_MODULE_DETAILS_FIELDS) {
      // Compare user's current local draft values vs portal (shows what would be overwritten)
      const localVal = localDraft.draft[key as keyof typeof localDraft.draft];
      const portalVal = moduleDetailsForPull.portalDetails[key];
      // Handle array/object comparisons with JSON stringify
      const localStr = JSON.stringify(localVal);
      const portalStr = JSON.stringify(portalVal);
      if (localStr !== portalStr) {
        // Format display values
        const formatValue = (val: unknown, fieldKey?: string): string => {
          if (val === null || val === undefined) return '(empty)';
          if (typeof val === 'boolean') return val ? 'Yes' : 'No';
          if (Array.isArray(val)) {
            // Handle LogSource-specific array fields
            if (fieldKey === 'filters') {
              return val.length > 0 ? `${val.length} filter${val.length !== 1 ? 's' : ''}` : '(none)';
            }
            if (fieldKey === 'logFields') {
              return val.length > 0 ? `${val.length} field${val.length !== 1 ? 's' : ''}` : '(none)';
            }
            if (fieldKey === 'resourceMapping') {
              return val.length > 0 ? `${val.length} mapping${val.length !== 1 ? 's' : ''}` : '(none)';
            }
            return val.length > 0 ? val.join(', ') : '(none)';
          }
          if (typeof val === 'object') {
            // Handle collectionAttribute - show just the ops
            if (fieldKey === 'collectionAttribute') {
              const attr = val as { filterOp?: string | null; resourceMappingOp?: string };
              const parts = [];
              if (attr.filterOp) parts.push(`filterOp: ${attr.filterOp}`);
              if (attr.resourceMappingOp) parts.push(`resourceMappingOp: ${attr.resourceMappingOp}`);
              return parts.length > 0 ? parts.join(', ') : '(default)';
            }
            return JSON.stringify(val);
          }
          return String(val);
        };
        changes.push({
          field: key,
          label,
          localValue: formatValue(localVal, key),
          portalValue: formatValue(portalVal, key),
        });
      }
    }
    
    return changes;
  }, [moduleDetailsForPull, localDraft]);

  const hasDetailsChanges = detailsChanges.length > 0;
  const hasAnythingSelected = hasSelectedScripts || (includeDetailsInPull && hasDetailsChanges);

  return (
    <Dialog open={pullLatestDialogOpen} onOpenChange={setPullLatestDialogOpen}>
      <DialogContent className="
        flex max-h-[90vh] max-w-[95vw]! flex-col gap-0 p-0
        sm:max-w-[1200px]!
      ">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Pull from Portal
          </DialogTitle>
          <DialogDescription>
            Review and select which scripts to pull from the portal. This will overwrite your local changes.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Module info */}
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm font-medium">Module:</Label>
              <Badge variant="outline">{moduleName}</Badge>
              <Badge variant="secondary">{MODULE_TYPE_LABELS[moduleType]}</Badge>
            </div>

            {/* Warning */}
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                Pulling will overwrite your local content with the version from the portal.
                {scriptsForPull?.some(s => s.hasChanges) && (
                  <span className="
                    mt-1 block text-yellow-600
                    dark:text-yellow-400
                  ">
                    You have local changes that will be lost if you proceed.
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {/* Loading state */}
            {isLoading && (
              <div className="
                flex items-center justify-center py-12 text-muted-foreground
              ">
                <Loader2 className="mr-2 size-5 animate-spin" />
                <span className="text-sm">Fetching module from portal...</span>
              </div>
            )}

            {/* Error state */}
            {error && !isLoading && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Scripts selection */}
            {!isLoading && scriptsForPull && scriptsForPull.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="size-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Scripts to Pull</Label>
                  {scriptsWithChanges.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {scriptsWithChanges.length} with local changes
                    </Badge>
                  )}
                </div>
                <div className="
                  divide-y divide-border rounded-md border border-border
                ">
                  {scriptsForPull.map((script) => (
                    <label
                      key={script.scriptType}
                      className="
                        flex cursor-pointer items-center gap-3 p-3
                        transition-colors
                        hover:bg-muted/40
                      "
                    >
                      <Checkbox
                        checked={selectedScriptsForPull.has(script.scriptType)}
                        onCheckedChange={() => toggleScriptForPull(script.scriptType)}
                        aria-label={`Include ${script.scriptType === 'ad' ? 'Active Discovery' : 'Collection'} script`}
                      />
                      <div className="flex flex-1 items-center gap-2">
                        <FileCode className="size-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {script.scriptType === 'ad' ? 'Active Discovery Script' : 'Collection Script'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {script.fileName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={script.language === 'powershell' ? 'default' : 'secondary'} className="
                          text-xs
                        ">
                          {script.language === 'powershell' ? 'PowerShell' : 'Groovy'}
                        </Badge>
                        {script.hasChanges ? (
                          <Badge variant="outline" className="
                            border-amber-600/50 text-xs text-yellow-600
                          ">
                            Local changes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="
                            border-green-600/50 text-xs text-teal-600
                          ">
                            In sync
                          </Badge>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Script diffs */}
            {!isLoading && scriptsForPull && selectedScriptsForPull.size > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Script Comparison</Label>
                <Tabs defaultValue={Array.from(selectedScriptsForPull)[0]} className="
                  flex flex-col gap-2
                ">
                  <TabsList variant="line" className="h-7">
                    {scriptsForPull
                      .filter(s => selectedScriptsForPull.has(s.scriptType))
                      .map((script) => (
                        <TabsTrigger key={script.scriptType} value={script.scriptType} className="
                          h-6 px-2 text-xs
                        ">
                          {script.scriptType === 'ad' ? 'Active Discovery' : 'Collection'}
                        </TabsTrigger>
                      ))}
                  </TabsList>
                  {scriptsForPull
                    .filter(s => selectedScriptsForPull.has(s.scriptType))
                    .map((script) => (
                      <TabsContent key={script.scriptType} value={script.scriptType}>
                        <div className="
                          overflow-hidden rounded-md border border-border
                        ">
                          <div className="
                            grid grid-cols-2 border-b border-border bg-muted/30
                          ">
                            <div className="
                              border-r border-border px-4 py-2 text-xs
                              font-medium text-muted-foreground
                            ">
                              Local (Current)
                            </div>
                            <div className="
                              px-4 py-2 text-xs font-medium
                              text-muted-foreground
                            ">
                              Portal (Will Replace)
                            </div>
                          </div>
                          <DiffEditor
                            original={script.localContent}
                            modified={script.portalContent}
                            language={script.language}
                            height="350px"
                            theme={monacoTheme}
                            readOnly={true}
                          />
                        </div>
                      </TabsContent>
                    ))}
                </Tabs>
              </div>
            )}

            {/* Module details section */}
            {!isLoading && moduleDetailsForPull && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Module Details</Label>
                  {hasDetailsChanges ? (
                    <Badge variant="secondary" className="text-xs">
                      {detailsChanges.length} field{detailsChanges.length !== 1 ? 's' : ''} differ
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="
                      border-green-600/50 text-xs text-teal-600
                    ">
                      In sync
                    </Badge>
                  )}
                </div>
                
                {hasDetailsChanges && (
                  <div className="rounded-md border border-border">
                    <label className="
                      flex cursor-pointer items-center gap-3 border-b
                      border-border p-3 transition-colors
                      hover:bg-muted/40
                    ">
                      <Checkbox
                        checked={includeDetailsInPull}
                        onCheckedChange={(checked) => setIncludeDetailsInPull(!!checked)}
                        aria-label="Include module details in pull"
                      />
                      <div className="flex flex-1 items-center gap-2">
                        <Settings className="size-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Include Module Details</span>
                          <span className="text-xs text-muted-foreground">
                            Refresh module metadata like appliesTo, description, etc.
                          </span>
                        </div>
                      </div>
                    </label>
                    
                    {includeDetailsInPull && (
                      <div className="
                        max-h-48 space-y-2 overflow-y-auto bg-muted/20 p-3
                      ">
                        <p className="
                          mb-2 text-xs font-medium text-muted-foreground
                        ">Fields to update:</p>
                        {detailsChanges.map((change) => (
                          <div key={change.field} className="
                            space-y-0.5 text-xs
                          ">
                            <div className="font-medium text-foreground">{change.label}</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="
                                rounded-sm border border-border bg-background/50
                                px-2 py-1
                              ">
                                <span className="
                                  text-[10px] text-muted-foreground uppercase
                                ">Local:</span>
                                <span className="block truncate">{change.localValue || '(empty)'}</span>
                              </div>
                              <div className="
                                rounded-sm border border-primary/20 bg-primary/5
                                px-2 py-1
                              ">
                                <span className="
                                  text-[10px] text-muted-foreground uppercase
                                ">Portal:</span>
                                <span className="block truncate">{change.portalValue || '(empty)'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {!hasDetailsChanges && (
                  <div className="
                    rounded-md border border-dashed border-border bg-muted/20
                    p-3 text-xs text-muted-foreground italic
                  ">
                    Module details are up to date with the portal (version {moduleDetailsForPull.portalVersion}).
                  </div>
                )}
              </div>
            )}

            {/* No scripts selected */}
            {!isLoading && scriptsForPull && !hasAnythingSelected && (
              <div className="
                flex items-center gap-2 rounded-md border border-dashed
                border-border bg-muted/20 p-3 text-xs text-muted-foreground
              ">
                <Info className="size-4" />
                Select at least one script or module details to pull from the portal.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 pt-4 pb-6">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="commit"
            onClick={handleConfirm} 
            disabled={isProcessing || isLoading || !hasAnythingSelected}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Pulling...
              </>
            ) : (
              <>
                <Download className="mr-2 size-4" />
                Pull Selected
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

