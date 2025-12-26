import { Trash2 } from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function OutputPanel() {
  const { 
    currentExecution, 
    outputTab, 
    setOutputTab, 
    clearOutput,
    isExecuting,
  } = useEditorStore();

  return (
    <div className="flex flex-col h-full">
      <Tabs 
        value={outputTab} 
        onValueChange={(value) => setOutputTab(value as typeof outputTab)}
        className="h-full"
      >
        {/* Tab Header */}
        <div className="flex items-center justify-between px-2 py-1 bg-secondary/30 border-b border-border">
          <TabsList variant="line">
            <TabsTrigger value="raw">Raw Output</TabsTrigger>
            <TabsTrigger value="parsed">Parsed</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
          </TabsList>
          
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearOutput}
            title="Clear output"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {/* Output Content */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="raw" className="h-full p-3 font-mono text-sm">
            {isExecuting ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-pulse">Executing script...</div>
              </div>
            ) : currentExecution ? (
              <RawOutputContent execution={currentExecution} />
            ) : (
              <div className="text-muted-foreground">
                Run a script to see output here.
              </div>
            )}
          </TabsContent>

          <TabsContent value="parsed" className="h-full p-3 font-mono text-sm">
            <div className="text-muted-foreground">
              Parsing not yet implemented. View raw output for now.
            </div>
          </TabsContent>

          <TabsContent value="validation" className="h-full p-3 font-mono text-sm">
            <div className="text-muted-foreground">
              Validation not yet implemented.
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

interface RawOutputContentProps {
  execution: NonNullable<ReturnType<typeof useEditorStore.getState>['currentExecution']>;
}

function RawOutputContent({ execution }: RawOutputContentProps) {
  if (execution.status === 'error') {
    return (
      <div className="text-destructive">
        <div className="font-semibold mb-1">Error:</div>
        <div>{execution.error}</div>
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap break-words">
      {execution.rawOutput || 'No output'}
    </pre>
  );
}
