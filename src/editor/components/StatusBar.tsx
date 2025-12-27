import { useMemo } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle } from '@/components/ui/popover';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { MAX_SCRIPT_LENGTH } from '@/shared/types';

// Keyboard shortcuts for help display
const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'Enter'], action: 'Run script' },
  { keys: ['⌘', 'K'], action: 'Command palette' },
  { keys: ['⌘', 'O'], action: 'Open from LogicModule' },
  { keys: ['⌘', 'S'], action: 'Export to file' },
  { keys: ['⌘', '⇧', 'C'], action: 'Copy output' },
  { keys: ['⌘', ','], action: 'Settings' },
  { keys: ['⌘', 'B'], action: 'Toggle sidebar' },
  { keys: ['⌘', 'R'], action: 'Refresh collectors' },
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
    portals,
    selectedPortalId,
    collectors,
    selectedCollectorId,
  } = useEditorStore();

  // Get active tab data
  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const script = activeTab?.content ?? '';
  const language = activeTab?.language ?? 'groovy';
  const mode = activeTab?.mode ?? 'freeform';

  // Get selected entities for display
  const selectedPortal = portals.find(p => p.id === selectedPortalId);
  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);

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

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/30 border-t border-border text-xs">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Status Badge */}
        <Badge variant={statusVariant} className={cn(
          isExecuting && 'animate-pulse'
        )}>
          {statusText}
        </Badge>

        {/* Connection status */}
        {selectedPortalId && selectedCollectorId && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-green-500" />
              Connected to {selectedPortal?.hostname} via {selectedCollector?.description || selectedCollector?.hostname}
            </span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 text-muted-foreground">
        {/* Mode */}
        <Badge variant="outline" className="capitalize font-normal">
          {mode}
        </Badge>

        {/* Language */}
        <Badge variant="outline" className="capitalize font-normal">
          {language}
        </Badge>

        <Separator orientation="vertical" className="h-4" />

        {/* Line count */}
        <span>{lineCount} lines</span>

        <Separator orientation="vertical" className="h-4" />

        {/* Character count */}
        {charCountStatus.showIcon ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className={cn(
                  'flex items-center gap-1 font-medium cursor-help',
                  charCountStatus.color
                )}>
                  <AlertTriangle className="size-3" />
                  {charCount.toLocaleString()} / {MAX_SCRIPT_LENGTH.toLocaleString()}
                </span>
              }
            />
            <TooltipContent>
              {charCountStatus.label}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span>
            {charCount.toLocaleString()} / {MAX_SCRIPT_LENGTH.toLocaleString()}
          </span>
        )}

        <Separator orientation="vertical" className="h-4" />

        {/* Keyboard Shortcuts Help */}
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button 
                      variant="ghost" 
                      size="icon-sm" 
                      className="size-5 text-muted-foreground hover:text-foreground"
                      aria-label="Keyboard shortcuts"
                    >
                      <HelpCircle className="size-3.5" />
                    </Button>
                  }
                />
              }
            />
            <TooltipContent>Keyboard shortcuts</TooltipContent>
          </Tooltip>
          <PopoverContent side="top" align="end" className="w-64 p-3">
            <PopoverHeader>
              <PopoverTitle className="text-sm">Keyboard Shortcuts</PopoverTitle>
            </PopoverHeader>
            <div className="flex flex-col gap-2 mt-2">
              {KEYBOARD_SHORTCUTS.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{shortcut.action}</span>
                  <div className="flex items-center gap-0.5">
                    {shortcut.keys.map((key, keyIdx) => (
                      <Kbd key={keyIdx}>{key}</Kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-3 pt-2 border-t border-border">
              Use Ctrl instead of ⌘ on Windows/Linux
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
