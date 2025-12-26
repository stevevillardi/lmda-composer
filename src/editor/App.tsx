import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { EditorPanel } from './components/EditorPanel';
import { OutputPanel } from './components/OutputPanel';
import { StatusBar } from './components/StatusBar';
import { useEditorStore } from './stores/editor-store';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

export function App() {
  const { refreshPortals, script } = useEditorStore();

  // Set dark mode on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Discover portals on mount
  useEffect(() => {
    refreshPortals();
  }, [refreshPortals]);

  // Update window title with character count
  useEffect(() => {
    const charCount = script.length;
    const warning = charCount > 64000 ? ' ⚠️ LIMIT EXCEEDED' : '';
    document.title = `LM IDE (${charCount.toLocaleString()} chars)${warning}`;
  }, [script]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Toolbar */}
      <Toolbar />

      {/* Main Content Area - Resizable Panels */}
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        {/* Editor Panel */}
        <ResizablePanel defaultSize={70} minSize={30}>
          <EditorPanel />
        </ResizablePanel>

        {/* Resize Handle */}
        <ResizableHandle withHandle />

        {/* Output Panel */}
        <ResizablePanel defaultSize={30} minSize={10}>
          <div className="h-full border-t border-border">
            <OutputPanel />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
