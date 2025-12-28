import { useState, useMemo, useEffect } from 'react';
import {
  Terminal,
  Search,
  Play,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  DEBUG_COMMANDS,
  searchCommands,
  type DebugCommand,
} from '../data/debug-commands';
import { MultiCollectorResults } from './MultiCollectorResults';

const CATEGORY_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  system: 'System',
  network: 'Network',
  health: 'Health',
  misc: 'Misc',
};

export function DebugCommandsDialog() {
  const {
    debugCommandsDialogOpen,
    setDebugCommandsDialogOpen,
    selectedPortalId,
    collectors,
    executeDebugCommand,
    isExecutingDebugCommand,
  } = useEditorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<DebugCommand | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [selectedCollectorIds, setSelectedCollectorIds] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (debugCommandsDialogOpen) {
      setSearchQuery('');
      setSelectedCategory(null);
      setSelectedCommand(null);
      setParameters({});
      setSelectedCollectorIds([]);
      setShowResults(false);
    }
  }, [debugCommandsDialogOpen]);

  // Initialize parameters when command is selected
  useEffect(() => {
    if (selectedCommand) {
      const initialParams: Record<string, string> = {};
      if (selectedCommand.parameters) {
        for (const param of selectedCommand.parameters) {
          initialParams[param.name] = '';
        }
      }
      setParameters(initialParams);
    }
  }, [selectedCommand]);

  // Filter commands by search and category
  const filteredCommands = useMemo(() => {
    let commands = DEBUG_COMMANDS;

    // Filter by search query
    if (searchQuery.trim()) {
      commands = searchCommands(searchQuery);
    }

    // Filter by category
    if (selectedCategory) {
      commands = commands.filter(cmd => cmd.category === selectedCategory);
    }

    return commands;
  }, [searchQuery, selectedCategory]);

  // Group commands by category
  const commandsByCategory = useMemo(() => {
    const grouped: Record<string, DebugCommand[]> = {};
    for (const cmd of filteredCommands) {
      if (!grouped[cmd.category]) {
        grouped[cmd.category] = [];
      }
      grouped[cmd.category].push(cmd);
    }
    return grouped;
  }, [filteredCommands]);

  // Get all categories
  const categories = useMemo(() => {
    return Array.from(new Set(DEBUG_COMMANDS.map(cmd => cmd.category)));
  }, []);

  // Handle command selection
  const handleSelectCommand = (command: DebugCommand) => {
    setSelectedCommand(command);
    setShowResults(false);
  };

  // Handle parameter change
  const handleParameterChange = (paramName: string, value: string) => {
    setParameters(prev => ({
      ...prev,
      [paramName]: value,
    }));
  };

  // Handle collector selection
  const handleCollectorToggle = (collectorId: number) => {
    setSelectedCollectorIds(prev => {
      if (prev.includes(collectorId)) {
        return prev.filter(id => id !== collectorId);
      } else {
        return [...prev, collectorId];
      }
    });
  };

  // Handle execute
  const handleExecute = async () => {
    if (!selectedCommand || selectedCollectorIds.length === 0 || !selectedPortalId) {
      toast.error('Please select a command and at least one collector');
      return;
    }

    // Validate required parameters
    if (selectedCommand.parameters) {
      for (const param of selectedCommand.parameters) {
        if (param.required && !parameters[param.name]?.trim()) {
          toast.error(`Parameter "${param.name}" is required`);
          return;
        }
      }
    }

    // Filter out empty parameters
    const filteredParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (value?.trim()) {
        filteredParams[key] = value.trim();
      }
    }

    setShowResults(true);
    await executeDebugCommand(
      selectedPortalId,
      selectedCollectorIds,
      selectedCommand.command,
      filteredParams
    );
  };

  // Check if can execute
  const canExecute = selectedCommand && selectedCollectorIds.length > 0 && !isExecutingDebugCommand;

  return (
    <Dialog open={debugCommandsDialogOpen} onOpenChange={setDebugCommandsDialogOpen}>
      <DialogContent className="w-[95vw]! max-w-[95vw]! h-[90vh] flex flex-col gap-0 p-0" showCloseButton>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-5" />
            Debug Commands
          </DialogTitle>
          <DialogDescription>
            Execute collector debug commands on one or more collectors
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Sidebar - Command List */}
          <div className="w-80 border-r flex flex-col min-h-0">
            {/* Search */}
            <div className="p-4 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search commands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Category Filter */}
            {!searchQuery && (
              <div className="p-4 border-b shrink-0">
                <div className="space-y-2">
                  <Button
                    variant={selectedCategory === null ? 'default' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedCategory(null)}
                  >
                    All Categories
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {CATEGORY_LABELS[category] || category}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Command List */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {Object.keys(commandsByCategory).length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No commands found
                    </div>
                  ) : (
                    Object.entries(commandsByCategory).map(([category, commands]) => (
                      <div key={category} className="mb-4">
                        {!searchQuery && (
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                            {CATEGORY_LABELS[category] || category}
                          </div>
                        )}
                        {commands.map(cmd => (
                          <button
                            key={cmd.id}
                            onClick={() => handleSelectCommand(cmd)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                              "hover:bg-accent",
                              selectedCommand?.id === cmd.id && "bg-accent font-medium"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs">{cmd.command}</span>
                              <ChevronRight className="size-4 text-muted-foreground" />
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {cmd.name}
                            </div>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel - Command Details & Execution */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {selectedCommand ? (
              <>
                {!showResults ? (
                  <>
                    {/* Command Details */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="p-6 space-y-6">
                          {/* Command Header */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <code className="text-lg font-mono font-semibold">{selectedCommand.command}</code>
                              <Badge variant="secondary">{CATEGORY_LABELS[selectedCommand.category]}</Badge>
                            </div>
                            <h3 className="text-lg font-semibold">{selectedCommand.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{selectedCommand.description}</p>
                          </div>

                          <Separator />

                          {/* Example */}
                          <div>
                            <Label className="text-sm font-semibold mb-2 block">Example</Label>
                            <code className="block p-3 bg-muted rounded-md text-sm font-mono">
                              {selectedCommand.example}
                            </code>
                          </div>

                          {/* Parameters */}
                          {selectedCommand.parameters && selectedCommand.parameters.length > 0 && (
                            <div>
                              <Label className="text-sm font-semibold mb-3 block">Parameters</Label>
                              <div className="space-y-4">
                                {selectedCommand.parameters.map(param => (
                                  <div key={param.name}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Label htmlFor={`param-${param.name}`} className="text-sm">
                                        {param.name}
                                      </Label>
                                      {param.required && (
                                        <Badge variant="destructive" className="text-xs">Required</Badge>
                                      )}
                                      {!param.required && (
                                        <Badge variant="outline" className="text-xs">Optional</Badge>
                                      )}
                                    </div>
                                    <Input
                                      id={`param-${param.name}`}
                                      placeholder={param.example ? `e.g., ${param.example}` : param.description}
                                      value={parameters[param.name] || ''}
                                      onChange={(e) => handleParameterChange(param.name, e.target.value)}
                                    />
                                    {param.description && (
                                      <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Separator />

                          {/* Collector Selection */}
                          <div>
                            <Label className="text-sm font-semibold mb-3 block">
                              Select Collectors ({selectedCollectorIds.length} selected)
                            </Label>
                            {collectors.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground border rounded-md">
                                No collectors available. Please select a portal first.
                              </div>
                            ) : (
                              <div className="h-48 border rounded-md overflow-hidden">
                                <ScrollArea className="h-full">
                                  <div className="p-2 space-y-2">
                                    {collectors.map(collector => (
                                      <div
                                        key={collector.id}
                                        className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent"
                                      >
                                        <Checkbox
                                          id={`collector-${collector.id}`}
                                          checked={selectedCollectorIds.includes(collector.id)}
                                          onCheckedChange={() => handleCollectorToggle(collector.id)}
                                        />
                                        <Label
                                          htmlFor={`collector-${collector.id}`}
                                          className="flex-1 cursor-pointer"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium">{collector.description}</span>
                                            <Badge
                                              variant={collector.isDown ? 'destructive' : 'default'}
                                              className="ml-2"
                                            >
                                              {collector.isDown ? 'Offline' : 'Online'}
                                            </Badge>
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-0.5">
                                            {collector.hostname}
                                          </div>
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}
                          </div>
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Execute Button */}
                    <div className="p-4 border-t flex items-center justify-end gap-2 shrink-0">
                      <Button
                        variant="outline"
                        onClick={() => setDebugCommandsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleExecute}
                        disabled={!canExecute}
                        className="gap-2"
                      >
                        {isExecutingDebugCommand ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Executing...
                          </>
                        ) : (
                          <>
                            <Play className="size-4" />
                            Execute
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <MultiCollectorResults
                    command={selectedCommand}
                    onBack={() => setShowResults(false)}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center text-muted-foreground">
                  <Terminal className="size-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Select a command</p>
                  <p className="text-sm">Choose a debug command from the list to view details and execute</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

