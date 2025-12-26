import { useEditorStore } from '../stores/editor-store';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { MAX_SCRIPT_LENGTH } from '@/shared/types';

export function StatusBar() {
  const { 
    script, 
    language, 
    mode, 
    currentExecution, 
    isExecuting,
    portals,
    selectedPortalId,
    collectors,
    selectedCollectorId,
  } = useEditorStore();

  // Get selected entities for display
  const selectedPortal = portals.find(p => p.id === selectedPortalId);
  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);

  const charCount = script.length;
  const isOverLimit = charCount > MAX_SCRIPT_LENGTH;

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
        <span className={cn(isOverLimit && 'text-destructive font-semibold')}>
          {charCount.toLocaleString()} / {MAX_SCRIPT_LENGTH.toLocaleString()}
        </span>

        <Separator orientation="vertical" className="h-4" />

        {/* Encoding */}
        <span>UTF-8</span>
      </div>
    </div>
  );
}
