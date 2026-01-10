import Editor from '@monaco-editor/react';
import { useMemo } from 'react';
import { Download, Layers } from 'lucide-react';
import {
  ActiveDiscoveryIcon,
  CollectionIcon,
  BatchCollectionIcon,
} from '../../constants/icons';
import { toast } from 'sonner';
import { useEditorStore } from '../../stores/editor-store';
import { buildMonacoOptions, getMonacoTheme } from '../../utils/monaco-settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LogicModuleInfo, ScriptLanguage, ScriptMode } from '@/shared/types';

// Import the loader config to use bundled Monaco (CSP-safe)
import '../../monaco-loader';

interface ModulePreviewProps {
  module: LogicModuleInfo;
}

export function ModulePreview({ module }: ModulePreviewProps) {
  const { loadModuleScript, openModuleScripts, preferences } = useEditorStore();

  // Determine script language based on scriptType
  const language: ScriptLanguage = module.scriptType === 'powerShell' ? 'powershell' : 'groovy';
  const monacoLanguage = language === 'groovy' ? 'groovy' : 'powershell';

  // Check what scripts are available
  const hasADScript = module.hasAutoDiscovery && !!module.adScript?.trim();
  const hasCollectionScript = !!module.collectionScript?.trim();

  // Determine the appropriate mode for collection script
  // Note: The parser uses source.moduleType for specialized validation within 'collection' mode
  const getCollectionMode = (): ScriptMode => {
    // Batch scripts (datasource/configsource only)
    if (module.collectMethod === 'batchscript') {
      return 'batchcollection';
    }
    // All collection scripts use 'collection' mode
    // The parser will use moduleType from tab.source for specialized parsing
    return 'collection';
  };

  // Handle loading AD script
  const handleLoadAD = () => {
    if (module.adScript) {
      loadModuleScript(module.adScript, language, 'ad');
      toast.success('Active Discovery script loaded', {
        description: module.displayName || module.name,
      });
    }
  };

  // Handle loading Collection script
  const handleLoadCollection = () => {
    if (module.collectionScript) {
      loadModuleScript(module.collectionScript, language, getCollectionMode());
      toast.success('Collection script loaded', {
        description: module.displayName || module.name,
      });
    }
  };

  // Handle loading both scripts at once
  const handleLoadBoth = () => {
    const scripts: Array<{ type: 'ad' | 'collection'; content: string }> = [];
    
    if (module.adScript?.trim()) {
      scripts.push({ type: 'ad', content: module.adScript });
    }
    if (module.collectionScript?.trim()) {
      scripts.push({ type: 'collection', content: module.collectionScript });
    }
    
    if (scripts.length > 0) {
      openModuleScripts(module, scripts);
      toast.success('Scripts loaded', {
        description: `${scripts.length} script${scripts.length > 1 ? 's' : ''} from ${module.displayName || module.name}`,
      });
    }
  };

  // If both AD and Collection scripts exist, show dual-pane
  const showDualPane = hasADScript && hasCollectionScript;

  const monacoTheme = useMemo(() => getMonacoTheme(preferences), [preferences]);

  const previewOptions = useMemo(() => buildMonacoOptions(preferences, {
    readOnly: true,
    fontSize: 12,
    lineNumbers: 'on',
    minimap: { enabled: false },
    wordWrap: 'off',
    tabSize: 4,
    renderLineHighlight: 'none',
    padding: { top: 8, bottom: 8 },
    domReadOnly: true,
    cursorStyle: 'line-thin',
    selectionHighlight: false,
    occurrencesHighlight: 'off',
    scrollbar: { horizontal: 'auto', vertical: 'auto' },
  }), [preferences]);

  return (
    <div className="flex h-full flex-col">
      {/* Module Header */}
      <div className="border-b border-border bg-secondary/30 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">
              {module.displayName || module.name}
            </h3>
            <p className="
              mt-0.5 truncate font-mono text-xs text-muted-foreground
            ">
              {module.name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {module.collectMethod}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {language}
            </Badge>
            {/* Load Both button - only for datasources and configsources with both AD and Collection */}
            {showDualPane && (module.moduleType === 'datasource' || module.moduleType === 'configsource') && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleLoadBoth}
                      className="h-7 gap-1.5 px-3 text-xs"
                    >
                      <Layers className="size-3" />
                      Load Both
                    </Button>
                  }
                />
                <TooltipContent>
                  Open both AD and Collection scripts in separate tabs
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {module.appliesTo && (
          <div className="mt-2 truncate font-mono text-xs text-muted-foreground">
            <span className="text-muted-foreground/50">appliesTo:</span> {module.appliesTo}
          </div>
        )}
      </div>

      {/* Script Previews */}
      <div className={`
        flex min-h-0 flex-1
        ${showDualPane ? 'flex-row' : `flex-col`}
      `}>
        {/* AD Script Panel */}
        {hasADScript && (
          <div className={`
            flex flex-col
            ${showDualPane ? `w-1/2 min-w-0 border-r border-border` : `flex-1`}
          `}>
            <div className="
              flex items-center justify-between border-b border-border
              bg-muted/30 px-3 py-2
            ">
              <div className="flex items-center gap-2">
                <ActiveDiscoveryIcon className="size-4" />
                <span className="text-xs font-medium">Active Discovery</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLoadAD}
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <Download className="size-3" />
                Load
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <Editor
                height="100%"
                language={monacoLanguage}
                theme={monacoTheme}
                value={module.adScript || '// No AD script'}
                options={previewOptions}
                loading={
                  <div className="flex h-full items-center justify-center">
                    <div className="text-xs text-muted-foreground">Loading...</div>
                  </div>
                }
              />
            </div>
          </div>
        )}

        {/* Separator for dual-pane */}
        {showDualPane && <Separator orientation="vertical" />}

        {/* Collection Script Panel */}
        {hasCollectionScript && (
          <div className={`
            flex flex-col
            ${showDualPane ? 'w-1/2 min-w-0' : `flex-1`}
          `}>
            <div className="
              flex items-center justify-between border-b border-border
              bg-muted/30 px-3 py-2
            ">
              <div className="flex items-center gap-2">
                {module.collectMethod === 'batchscript' ? (
                  <BatchCollectionIcon className="size-4" />
                ) : (
                  <CollectionIcon className="size-4" />
                )}
                <span className="text-xs font-medium">
                  Collection {module.collectMethod === 'batchscript' && '(Batch)'}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLoadCollection}
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <Download className="size-3" />
                Load
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <Editor
                height="100%"
                language={monacoLanguage}
                theme={monacoTheme}
                value={module.collectionScript || '// No collection script'}
                options={previewOptions}
                loading={
                  <div className="flex h-full items-center justify-center">
                    <div className="text-xs text-muted-foreground">Loading...</div>
                  </div>
                }
              />
            </div>
          </div>
        )}

        {/* No scripts available */}
        {!hasADScript && !hasCollectionScript && (
          <div className="
            flex flex-1 items-center justify-center text-sm
            text-muted-foreground
          ">
            <p>No scripts available for this module</p>
          </div>
        )}
      </div>
    </div>
  );
}
