import { Server, Code2, Clock } from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { DevicePropertiesPanel } from './DevicePropertiesPanel';
import { SnippetLibraryPanel } from './SnippetLibraryPanel';
import { ExecutionHistoryPanel } from './ExecutionHistoryPanel';

interface RightSidebarProps {
  className?: string;
}

export function RightSidebar({ className }: RightSidebarProps) {
  const {
    rightSidebarOpen,
    rightSidebarTab,
    setRightSidebarTab,
    deviceProperties,
    executionHistory,
  } = useEditorStore();

  if (!rightSidebarOpen) {
    return null;
  }

  return (
    <div className={cn('flex flex-col h-full bg-background border-l border-border min-w-[200px] overflow-hidden', className)}>
      {/* Header with tabs */}
      <div className="flex items-center px-2 py-1.5 border-b border-border bg-secondary/30 flex-shrink-0">
        <Tabs value={rightSidebarTab} onValueChange={(value) => setRightSidebarTab(value as 'properties' | 'snippets' | 'history')}>
          <TabsList variant="line" className="h-7">
            <TabsTrigger value="properties" className="h-6 text-xs px-2 gap-1">
              <Server className="size-3" />
              <span>Props{deviceProperties.length > 0 && ` (${deviceProperties.length})`}</span>
            </TabsTrigger>
            <TabsTrigger value="snippets" className="h-6 text-xs px-2 gap-1">
              <Code2 className="size-3" />
              <span>Snippets</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="h-6 text-xs px-2 gap-1">
              <Clock className="size-3" />
              <span>History{executionHistory.length > 0 && ` (${executionHistory.length})`}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content - panels handle their own scrolling */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {rightSidebarTab === 'properties' && (
          <DevicePropertiesPanel />
        )}
        {rightSidebarTab === 'snippets' && (
          <SnippetLibraryPanel />
        )}
        {rightSidebarTab === 'history' && (
          <ExecutionHistoryPanel />
        )}
      </div>
    </div>
  );
}

