import { useEffect, useMemo, useState } from 'react';
import { Clock, History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DiffEditor } from './DiffEditor';
import { useEditorStore } from '../stores/editor-store';
import type { EditorTab, LineageVersion, LogicModuleType, ScriptLanguage } from '@/shared/types';

interface ModuleLineageDialogProps {
  activeTab: EditorTab;
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

export function ModuleLineageDialog({ activeTab }: ModuleLineageDialogProps) {
  const {
    moduleLineageDialogOpen,
    setModuleLineageDialogOpen,
    lineageVersions,
    isFetchingLineage,
    lineageError,
    updateActiveTabContent,
    preferences,
  } = useEditorStore();

  const [selectedVersionId, setSelectedVersionId] = useState<string>('');

  const scriptType = activeTab.source?.scriptType || 'collection';
  const moduleType = activeTab.source?.moduleType;
  const moduleName = activeTab.source?.moduleName || activeTab.displayName;
  const scriptLanguage: ScriptLanguage = activeTab.language;

  const monacoTheme = useMemo(() => {
    if (preferences.theme === 'light') return 'vs';
    if (preferences.theme === 'dark') return 'vs-dark';
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'vs';
    }
    return 'vs-dark';
  }, [preferences.theme]);

  const handleVersionChange = (value: string | null) => {
    setSelectedVersionId(value ?? '');
  };

  useEffect(() => {
    if (moduleLineageDialogOpen && lineageVersions.length > 0) {
      if (!selectedVersionId || !lineageVersions.some((v) => v.id === selectedVersionId)) {
        setSelectedVersionId(lineageVersions[0].id);
      }
    }
  }, [moduleLineageDialogOpen, lineageVersions, selectedVersionId]);

  const selectedVersion = useMemo<LineageVersion | null>(() => {
    return lineageVersions.find((version) => version.id === selectedVersionId) || null;
  }, [lineageVersions, selectedVersionId]);

  const selectedVersionScript = scriptType === 'ad'
    ? selectedVersion?.adScript || ''
    : selectedVersion?.collectionScript || '';

  const formattedUpdatedAt = selectedVersion?.updatedAtMS
    ? new Date(selectedVersion.updatedAtMS).toLocaleString()
    : null;
  const formatVersionLabel = (version: LineageVersion) => {
    const updatedAt = version.updatedAtMS ? new Date(version.updatedAtMS).toLocaleString() : 'Unknown time';
    const author = version.authorUsername || 'Unknown user';
    return `${version.version || 'unknown'} • ${version.id} • ${updatedAt} • ${author}`;
  };

  const handleRestore = () => {
    if (!selectedVersionScript) {
      toast.error('No script available to restore for this version');
      return;
    }
    updateActiveTabContent(selectedVersionScript);
    toast.success('Lineage version restored', {
      description: selectedVersion?.version || selectedVersion?.name || 'Selected version',
    });
    setModuleLineageDialogOpen(false);
  };

  const scriptTypeLabel = scriptType === 'ad' ? 'Active Discovery Script' : 'Collection Script';

  return (
    <Dialog open={moduleLineageDialogOpen} onOpenChange={setModuleLineageDialogOpen}>
      <DialogContent className="max-w-[95vw]! sm:max-w-[1500px]! max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5" />
            View Lineage
          </DialogTitle>
          <DialogDescription>
            Compare the current script with historical versions and restore when needed. These versions reflect core module changes, not user changes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm font-medium">Module:</Label>
              <Badge variant="outline">{moduleName}</Badge>
              {moduleType && <Badge variant="secondary">{MODULE_TYPE_LABELS[moduleType]}</Badge>}
              <Badge variant="default">{scriptTypeLabel}</Badge>
            </div>

            {lineageError && (
              <Alert variant="destructive">
                <AlertDescription>{lineageError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Historical Version</Label>
              <Select
                value={selectedVersionId}
                onValueChange={handleVersionChange}
                disabled={isFetchingLineage || lineageVersions.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedVersion
                      ? formatVersionLabel(selectedVersion)
                      : isFetchingLineage
                        ? 'Loading versions...'
                        : 'Select a version'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {lineageVersions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {formatVersionLabel(version)}
                        </span>
                        {version.isLatest && <Badge variant="secondary">Latest</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVersion && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="size-3.5" />
                  <span>
                    {formattedUpdatedAt || 'Unknown update time'}
                    {selectedVersion.authorUsername ? ` • ${selectedVersion.authorUsername}` : ''}
                  </span>
                </div>
              )}
              {selectedVersion?.commitMessage && (
                <div className="text-xs text-muted-foreground">
                  {selectedVersion.commitMessage}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Script Comparison</Label>
              {selectedVersion ? (
                <div className="border border-border rounded-md overflow-hidden">
                  <div className="grid grid-cols-2 border-b border-border bg-muted/30">
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-r border-border">
                      Current
                    </div>
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
                      Selected Version{selectedVersion ? ` (${selectedVersion.version || 'unknown'})` : ''}
                    </div>
                  </div>
                  <DiffEditor
                    original={activeTab.content}
                    modified={selectedVersionScript}
                    language={scriptLanguage}
                    height="400px"
                    theme={monacoTheme}
                    readOnly={true}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {isFetchingLineage ? 'Loading versions...' : 'Select a version to compare.'}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t shrink-0">
          <Button type="button" variant="ghost" onClick={() => setModuleLineageDialogOpen(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="commit"
            onClick={handleRestore}
            disabled={!selectedVersion || !selectedVersionScript}
          >
            <RotateCcw className="size-4 mr-2" />
            Restore Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
