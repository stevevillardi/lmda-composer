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
    <div className={cn(`
      flex h-full min-w-[200px] flex-col overflow-hidden border-l border-border
      bg-background
    `, className)}>
      {/* Header with tabs */}
      <div className="
        flex shrink-0 items-center border-b border-border bg-secondary/30 px-2
        py-1.5
      ">
        <Tabs value={rightSidebarTab} onValueChange={(value) => setRightSidebarTab(value as 'properties' | 'snippets' | 'history')}>
          <TabsList variant="line" className="h-7">
            <TabsTrigger value="properties" className="h-6 gap-1 px-2 text-xs">
              <Server className="size-3" />
              <span>Props{deviceProperties.length > 0 && ` (${deviceProperties.length})`}</span>
            </TabsTrigger>
            <TabsTrigger value="snippets" className="h-6 gap-1 px-2 text-xs">
              <Code2 className="size-3" />
              <span>Snippets</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="h-6 gap-1 px-2 text-xs">
              <Clock className="size-3" />
              <span>History{executionHistory.length > 0 && ` (${executionHistory.length})`}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content - panels handle their own scrolling */}
      <div className="min-h-0 flex-1 overflow-hidden">
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

