import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { EditorPanel } from './components/EditorPanel';
import { OutputPanel } from './components/OutputPanel';
import { StatusBar } from './components/StatusBar';
import { useEditorStore } from './stores/editor-store';

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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Editor and Context Panel */}
        <div className="flex-1 min-h-0">
          <EditorPanel />
        </div>

        {/* Output Panel */}
        <div className="h-64 border-t border-border">
          <OutputPanel />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
