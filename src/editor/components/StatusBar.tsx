import { useMemo } from 'react';
import { AlertTriangle, BookOpen, ExternalLink, HelpCircle } from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle } from '@/components/ui/popover';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { COLORS } from '@/editor/constants/colors';
import { MAX_SCRIPT_LENGTH } from '@/shared/types';

// Get extension version from manifest
const getExtensionVersion = (): string => {
  try {
    return chrome.runtime.getManifest().version || 'unknown';
  } catch {
    return 'unknown';
  }
};

// Keyboard shortcuts for help display
// Chord shortcuts use ⌘K as the leader key, followed by a letter
const KEYBOARD_SHORTCUTS = [
  {
    label: 'Editor',
    items: [
      { keys: ['⌘', 'Enter'], action: 'Run script' },
      { keys: ['⌘', '⇧', 'P'], action: 'Command palette' },
      { keys: ['⌘', 'B'], action: 'Toggle sidebar' },
      { keys: ['⌘', ','], action: 'Settings' },
    ],
  },
  {
    label: 'Files (⌘K chords)',
    items: [
      { keys: ['⌘K', 'N'], action: 'New file' },
      { keys: ['⌘K', 'O'], action: 'Open file' },
      { keys: ['⌘K', 'F'], action: 'Open Module Folder' },
      { keys: ['⌘', 'S'], action: 'Save' },
      { keys: ['⌘K', '⇧S'], action: 'Save As...' },
      { keys: ['⌘K', 'E'], action: 'Export (Download)' },
      { keys: ['⌘K', 'M'], action: 'Toggle API/Script view' },
    ],
  },
  {
    label: 'Portal Tools (⌘K chords)',
    items: [
      { keys: ['⌘K', 'I'], action: 'Import from LMX' },
      { keys: ['⌘K', 'S'], action: 'Search LogicModules' },
      { keys: ['⌘K', 'A'], action: 'AppliesTo Toolbox' },
      { keys: ['⌘K', 'D'], action: 'Debug Commands' },
      { keys: ['⌘K', 'L'], action: 'Module Snippets' },
      { keys: ['⌘K', 'R'], action: 'Refresh collectors' },
      { keys: ['⌘K', 'C'], action: 'Copy output' },
    ],
  },
] as const;

// Character count thresholds for progressive warnings
const WARNING_THRESHOLD = 50000;  // 50K - show yellow warning
const DANGER_THRESHOLD = 60000;   // 60K - show red warning

export function StatusBar() {
  const { 
    tabs,
    activeTabId,
    currentExecution, 
    isExecuting,
    isExecutingApi,
    portals,
    selectedPortalId,
    collectors,
    selectedCollectorId,
    devices,
    hostname,
    chordPending,
  } = useEditorStore();

  // Get active tab data
  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);
  const isApiTab = activeTab?.kind === 'api';
  const apiResponse = activeTab?.api?.response;

  const script = activeTab?.content ?? '';
  const language = activeTab?.language ?? 'groovy';
  const mode = activeTab?.mode ?? 'freeform';

  // Get selected entities for display
  const selectedPortal = portals.find(p => p.id === selectedPortalId);
  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);
  const selectedDevice = useMemo(() => {
    if (!hostname) return null;
    return devices.find(d => d.name === hostname) ?? null;
  }, [devices, hostname]);

  const charCount = script.length;
  const isOverLimit = charCount > MAX_SCRIPT_LENGTH;
  const isDanger = charCount >= DANGER_THRESHOLD;
  const isWarning = charCount >= WARNING_THRESHOLD;
  
  // Determine the character count status
  const getCharCountStatus = () => {
    if (isOverLimit) return { color: 'text-destructive', label: 'Over limit! Script will not run.', showIcon: true };
    if (isDanger) return { color: 'text-red-500', label: `Approaching limit (${Math.round((charCount / MAX_SCRIPT_LENGTH) * 100)}% used)`, showIcon: true };
    if (isWarning) return { color: 'text-yellow-500', label: `${Math.round((charCount / MAX_SCRIPT_LENGTH) * 100)}% of limit used`, showIcon: true };
    return { color: '', label: '', showIcon: false };
  };
  
  const charCountStatus = getCharCountStatus();

  // Calculate line and column (simplified - just line count for now)
  const lineCount = script.split('\n').length;

  // Get extension version
  const extensionVersion = useMemo(() => getExtensionVersion(), []);

  // Execution status
  let statusText = 'Ready';
  let statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
  
  if (isExecuting) {
    statusText = 'Executing...';
    statusVariant = 'default';
  } else if (currentExecution) {
    switch (currentExecution.status) {
      case 'complete':
        statusText = `Complete (${currentExecution.duration}ms)`;
        statusVariant = 'default';
        break;
      case 'error':
        statusText = 'Error';
        statusVariant = 'destructive';
        break;
      case 'timeout':
        statusText = 'Timeout';
        statusVariant = 'destructive';
        break;
    }
  }

  const helpAndVersion = (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-auto px-2 py-1 text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                  aria-label="Keyboard shortcuts and version"
                >
                  <HelpCircle className="size-3.5" />
                  <span className="text-xs">v{extensionVersion}</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Keyboard shortcuts</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" className="w-64 p-3 select-none gap-0">
        <PopoverHeader>
          <PopoverTitle className="text-sm">Keyboard Shortcuts</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col gap-0 mt-2">
          {KEYBOARD_SHORTCUTS.map((section,) => (
            <div key={section.label} className="space-y-2">
              <div className="relative flex items-center gap-2 my-2">
                <Separator className="flex-1" />
                <span className="shrink-0 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </span>
                <Separator className="flex-1" />
              </div>
              <div className="flex flex-col gap-1.5">
                {section.items.map((shortcut) => (
                  <div key={shortcut.action} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{shortcut.action}</span>
                    <div className="flex items-center gap-0.5">
                      {shortcut.keys.map((key, keyIdx) => (
                        <Kbd key={keyIdx}>{key}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-border space-y-2">
          <p className="text-[10px] text-muted-foreground/70">
            Use Ctrl/Alt instead of ⌘/⌥ on Windows/Linux
          </p>
          <a
            href="https://stevevillardi.github.io/lmda-composer/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="size-3" />
            Full Documentation
            <ExternalLink className="size-2.5" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (isApiTab) {
    const apiStatusStyle = (() => {
      if (!apiResponse) return null;
      if (apiResponse.status >= 500) return COLORS.HTTP_STATUS.serverError;
      if (apiResponse.status >= 400) return COLORS.HTTP_STATUS.clientError;
      if (apiResponse.status >= 300) return COLORS.HTTP_STATUS.redirect;
      if (apiResponse.status >= 200) return COLORS.HTTP_STATUS.success;
      return COLORS.HTTP_STATUS.info;
    })();

    const apiStatusText = (() => {
      if (isExecutingApi) return 'Requesting...';
      if (!apiResponse) return 'Ready';
      return `Status ${apiResponse.status}`;
    })();

    return (
      <div 
        className="flex items-center justify-between px-3 py-1.5 bg-secondary/30 border-t border-border text-xs select-none"
        role="status"
        aria-label="API status bar"
      >
        <div className="flex items-center gap-3">
          {/* Chord indicator - shows when ⌘K is pressed */}
          {chordPending ? (
            <Badge 
              variant="default"
              className="bg-primary text-primary-foreground animate-pulse"
              aria-live="assertive"
            >
              <Kbd className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">⌘K</Kbd>
              <span className="ml-1.5">waiting...</span>
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] font-semibold",
                apiStatusStyle?.bgSubtle,
                apiStatusStyle?.text
              )}
              aria-live="polite"
              aria-atomic="true"
            >
              {apiStatusText}
            </Badge>
          )}
          {selectedPortalId && (
            <>
              <Separator orientation="vertical" className="h-5" aria-hidden="true" />
              <span className="text-muted-foreground flex items-center gap-1.5" aria-label="Portal status">
                <span className="size-1.5 rounded-full bg-teal-500" aria-hidden="true" />
                Connected to {selectedPortal?.hostname}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-muted-foreground">
          {apiResponse && (
            <>
              <span aria-label={`Last response duration ${apiResponse.durationMs} milliseconds`}>
                {apiResponse.durationMs}ms
              </span>
              <Separator orientation="vertical" className="h-5" aria-hidden="true" />
              <span aria-label={`Response size ${apiResponse.body.length} characters`}>
                {apiResponse.body.length.toLocaleString()} chars
              </span>
              <Separator orientation="vertical" className="h-5" aria-hidden="true" />
            </>
          )}
          {helpAndVersion}
        </div>
      </div>
    );
  }

  const deviceLabel = selectedDevice
    ? selectedDevice.displayName === selectedDevice.name
      ? selectedDevice.name
      : `${selectedDevice.displayName} (${selectedDevice.name})`
    : hostname || '';

  return (
    <div 
      className="flex items-center justify-between px-3 py-1.5 bg-secondary/30 border-t border-border text-xs select-none"
      role="status"
      aria-label="Editor status bar"
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Chord indicator - shows when ⌘K is pressed */}
        {chordPending && (
          <Badge 
            variant="default"
            className="bg-primary text-primary-foreground animate-pulse"
            aria-live="assertive"
          >
            <Kbd className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">⌘K</Kbd>
            <span className="ml-1.5">waiting...</span>
          </Badge>
        )}

        {/* Status Badge */}
        {!chordPending && (
          <Badge 
            variant={statusVariant} 
            className={cn(
              isExecuting && 'animate-pulse'
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {statusText}
          </Badge>
        )}

        {/* Connection status */}
        {selectedPortalId && selectedCollectorId && (
          <>
            <Separator orientation="vertical" className="h-5" aria-hidden="true" />
            <span className="text-muted-foreground flex items-center gap-1.5" aria-label="Connection status">
              <span className="size-1.5 rounded-full bg-teal-500 shrink-0" aria-hidden="true" />
              <span>
                Connected to {selectedPortal?.hostname} via {selectedCollector?.description || selectedCollector?.hostname}
                {deviceLabel ? (
                  deviceLabel.length > 40 ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="cursor-default"> · {deviceLabel.slice(0, 40)}…</span>
                        }
                      />
                      <TooltipContent>{deviceLabel}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span> · {deviceLabel}</span>
                  )
                ) : ''}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 text-muted-foreground">
        {/* Only show script info when tabs are open */}
        {tabs.length > 0 && (
          <>
            {/* Mode */}
            <Badge variant="outline" className="capitalize font-normal" aria-label={`Script mode: ${mode}`}>
              {mode}
            </Badge>

            {/* Language */}
            <Badge variant="outline" className="capitalize font-normal" aria-label={`Script language: ${language}`}>
              {language}
            </Badge>

            <Separator orientation="vertical" className="h-5" aria-hidden="true" />

            {/* Line count */}
            <span aria-label={`${lineCount} lines`}>{lineCount} lines</span>

            <Separator orientation="vertical" className="h-5" aria-hidden="true" />

            {/* Character count */}
            {charCountStatus.showIcon ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span 
                      className={cn(
                        'flex items-center gap-1 font-medium cursor-help',
                        charCountStatus.color
                      )}
                      role="alert"
                      aria-label={`Character count: ${charCount.toLocaleString()} of ${MAX_SCRIPT_LENGTH.toLocaleString()}. ${charCountStatus.label}`}
                    >
                      <AlertTriangle className="size-3" aria-hidden="true" />
                      {charCount.toLocaleString()} / {MAX_SCRIPT_LENGTH.toLocaleString()}
                    </span>
                  }
                />
                <TooltipContent>
                  {charCountStatus.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span aria-label={`Character count: ${charCount.toLocaleString()} of ${MAX_SCRIPT_LENGTH.toLocaleString()}`}>
                {charCount.toLocaleString()} / {MAX_SCRIPT_LENGTH.toLocaleString()}
              </span>
            )}

            <Separator orientation="vertical" className="h-5" aria-hidden="true" />
          </>
        )}

        {/* Keyboard Shortcuts Help & Version */}
        {helpAndVersion}
      </div>
    </div>
  );
}
