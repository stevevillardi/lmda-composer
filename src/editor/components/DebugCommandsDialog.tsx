import { useState, useMemo, useEffect } from 'react';
import {
  Terminal,
  Search,
  Play,
  Loader2,
  ChevronRight,
  HeartPulse,
  Sparkles,
  RefreshCw,
  ChevronDown,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  DEBUG_COMMANDS,
  searchCommands,
  type DebugCommand,
} from '../data/debug-commands';
import { MultiCollectorResults } from './MultiCollectorResults';

// Find the health check command
const HEALTH_CHECK_COMMAND = DEBUG_COMMANDS.find(cmd => cmd.type === 'healthcheck');

const CATEGORY_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  system: 'System',
  network: 'Network',
  health: 'Health',
  misc: 'Misc',
  scripting: 'Scripting',
  fileops: 'File Operations',
  diagnostics: 'Diagnostics',
  windows: 'Windows',
  query: 'Query/Protocol',
  taskmgmt: 'Task Management',
};

// Helper function to get normalized category label
function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

export function DebugCommandsDialog() {
  const {
    debugCommandsDialogOpen,
    setDebugCommandsDialogOpen,
    selectedPortalId,
    collectors,
    refreshCollectors,
    executeDebugCommand,
    isExecutingDebugCommand,
  } = useEditorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [collectorSearchQuery, setCollectorSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<DebugCommand | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [selectedCollectorIds, setSelectedCollectorIds] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [executedCommand, setExecutedCommand] = useState<string | null>(null);
  const [isRefreshingCollectors, setIsRefreshingCollectors] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (debugCommandsDialogOpen) {
      setSearchQuery('');
      setCollectorSearchQuery('');
      setSelectedCategory(null);
      setSelectedCommand(null);
      setParameters({});
      setSelectedCollectorIds([]);
      setShowResults(false);
      setExecutedCommand(null);
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
    // Exclude healthcheck from the list since it has a special card
    let commands = DEBUG_COMMANDS.filter(cmd => cmd.type !== 'healthcheck');

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

  const collectorsByGroup = useMemo(() => {
    const grouped: Record<string, typeof collectors> = {};
    
    // Filter collectors first
    const filteredCollectors = collectors.filter(c => {
      if (!collectorSearchQuery.trim()) return true;
      const query = collectorSearchQuery.toLowerCase();
      return (
        c.description.toLowerCase().includes(query) ||
        c.hostname.toLowerCase().includes(query) ||
        (c.collectorGroupName && c.collectorGroupName.toLowerCase().includes(query))
      );
    });

    for (const collector of filteredCollectors) {
      const groupName =
        collector.collectorGroupName && collector.collectorGroupName !== '@default'
          ? collector.collectorGroupName
          : 'Ungrouped';
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(collector);
    }
    return grouped;
  }, [collectors, collectorSearchQuery]);

  const collectorGroupOrder = useMemo(() => {
    const groups = Object.keys(collectorsByGroup);
    return groups.sort((a, b) => {
      if (a === 'Ungrouped') return -1;
      if (b === 'Ungrouped') return 1;
      return a.localeCompare(b);
    });
  }, [collectorsByGroup]);

  const allCollectorIds = useMemo(() => collectors.map(collector => collector.id), [collectors]);
  const allCollectorsSelected = collectors.length > 0 && selectedCollectorIds.length === collectors.length;

  useEffect(() => {
    setCollapsedGroups(prev => {
      const next = { ...prev };
      for (const groupName of collectorGroupOrder) {
        if (next[groupName] === undefined) {
          next[groupName] = false;
        }
      }
      return next;
    });
  }, [collectorGroupOrder]);

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

  const handleSelectAllCollectors = () => {
    setSelectedCollectorIds(allCollectorsSelected ? [] : allCollectorIds);
  };

  const handleToggleGroupSelection = (groupName: string) => {
    const groupCollectors = collectorsByGroup[groupName] ?? [];
    if (groupCollectors.length === 0) return;
    setSelectedCollectorIds(prev => {
      const selectedSet = new Set(prev);
      const groupIds = groupCollectors.map(collector => collector.id);
      const allSelected = groupIds.every(id => selectedSet.has(id));
      if (allSelected) {
        groupIds.forEach(id => selectedSet.delete(id));
      } else {
        groupIds.forEach(id => selectedSet.add(id));
      }
      return Array.from(selectedSet);
    });
  };

  const handleToggleGroupCollapse = (groupName: string, isOpen: boolean) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !isOpen,
    }));
  };

  const handleRefreshCollectors = async () => {
    setIsRefreshingCollectors(true);
    try {
      await refreshCollectors();
    } finally {
      setTimeout(() => {
        setIsRefreshingCollectors(false);
      }, 300);
    }
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

    const positionalArgs: string[] = [];
    const filteredParams: Record<string, string> = {};
    if (selectedCommand.parameters) {
      for (const param of selectedCommand.parameters) {
        const value = parameters[param.name]?.trim() ?? '';
        if (!value) continue;
        if (param.positional) {
          positionalArgs.push(value);
        } else {
          filteredParams[param.name] = value;
        }
      }
    }

    const formatDebugCommand = (command: string, params: Record<string, string>, positional: string[]) => {
      const parts: string[] = [];

      for (const value of positional) {
        const needsQuoting = /[\s"\\]/.test(value);
        const formattedValue = needsQuoting
          ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
          : value;
        parts.push(formattedValue);
      }

      for (const [key, value] of Object.entries(params)) {
        const needsQuoting = /[\s"\\]/.test(value);
        const formattedValue = needsQuoting
          ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
          : value;
        parts.push(`${key}=${formattedValue}`);
      }

      if (parts.length === 0) return command;
      return `${command} ${parts.join(' ')}`;
    };

    setShowResults(true);
    setExecutedCommand(formatDebugCommand(selectedCommand.command, filteredParams, positionalArgs));
    await executeDebugCommand(
      selectedPortalId,
      selectedCollectorIds,
      selectedCommand.command,
      filteredParams,
      positionalArgs
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
                  className="pl-8 pr-7"
                />
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter */}
            {!searchQuery && (
              <div className="p-4 border-b shrink-0">
                <Label className="text-xs font-semibold mb-2 block">Category</Label>
                <Select
                  value={selectedCategory || 'all'}
                  onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue>
                      {selectedCategory ? getCategoryLabel(selectedCategory) : 'All Categories'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {getCategoryLabel(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Health Check Quick Action */}
            {!searchQuery && HEALTH_CHECK_COMMAND && (
              <div className="p-3 border-b shrink-0">
                <button
                  onClick={() => handleSelectCommand(HEALTH_CHECK_COMMAND)}
                  className={cn(
                    "w-full p-3 rounded-lg border-2 text-left transition-all",
                    "bg-card/40 backdrop-blur-sm border-teal-500/30 hover:bg-teal-500/10 hover:border-teal-500/50",
                    selectedCommand?.id === 'healthcheck' && "border-teal-500 bg-teal-500/10"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <HeartPulse className="size-5 text-teal-500" />
                    <span className="font-semibold text-sm">Collector Health Check</span>

                  </div>
                  <p className="text-xs text-muted-foreground">
                    Comprehensive diagnostic with visual reports
                  </p>
                </button>
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
                            {getCategoryLabel(category)}
                          </div>
                        )}
                        {commands.map(cmd => (
                          <button
                            key={cmd.id}
                            onClick={() => handleSelectCommand(cmd)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                              "hover:bg-accent",
                              selectedCommand?.id === cmd.id && "bg-accent font-medium",
                              cmd.type === 'healthcheck' && "border-l-2 border-teal-500"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs">{cmd.command}</span>
                              {cmd.type === 'healthcheck' ? (
                                <HeartPulse className="size-4 text-teal-500" />
                              ) : (
                                <ChevronRight className="size-4 text-muted-foreground" />
                              )}
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
                              {selectedCommand.type === 'healthcheck' ? (
                                <HeartPulse className="size-6 text-teal-500" />
                              ) : null}
                              <code className="text-lg font-mono font-semibold">{selectedCommand.command}</code>
                              <Badge variant="secondary">{getCategoryLabel(selectedCommand.category)}</Badge>
                              {selectedCommand.type === 'healthcheck' && (
                                <Badge className="bg-linear-to-r from-emerald-500 to-cyan-500 text-white">
                                  Visual Report
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold">{selectedCommand.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{selectedCommand.description}</p>
                          </div>

                          <Separator />

                          {/* Health Check Special Info */}
                          {selectedCommand.type === 'healthcheck' && (
                            <div className="p-4 rounded-lg bg-linear-to-r from-emerald-500/10 to-cyan-500/10 border border-teal-500/20">
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Sparkles className="size-4 text-cyan-500" />
                                What this report includes:
                              </h4>
                              <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Collection summary with thread counts by type</li>
                                <li>• Top failing modules with visual charts</li>
                                <li>• Longest-running task analysis</li>
                                <li>• Device capacity limits and sizing recommendations</li>
                                <li>• Agent configuration vs defaults comparison</li>
                                <li>• Helpful AppliesTo queries for troubleshooting</li>
                                <li>• Collector logs (wrapper, sbproxy, watchdog)</li>
                              </ul>
                            </div>
                          )}

                          {/* Example - hide for health check */}
                          {selectedCommand.type !== 'healthcheck' && (
                            <div>
                              <Label className="text-sm font-semibold mb-2 block">Example</Label>
                              <code className="block p-3 bg-muted rounded-md text-sm font-mono">
                                {selectedCommand.example}
                              </code>
                            </div>
                          )}

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
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-semibold">
                                Select Collectors ({selectedCollectorIds.length} selected)
                              </Label>
                              <div className="flex items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleRefreshCollectors}
                                        disabled={isRefreshingCollectors || !selectedPortalId}
                                        className={cn(
                                          "transition-all duration-200",
                                          isRefreshingCollectors && "opacity-70"
                                        )}
                                      >
                                        <RefreshCw
                                          className={cn(
                                            "size-3 transition-transform duration-200",
                                            isRefreshingCollectors && "animate-spin"
                                          )}
                                        />
                                        Refresh
                                      </Button>
                                    }
                                  />
                                  <TooltipContent>
                                    {isRefreshingCollectors ? 'Refreshing collectors...' : 'Refresh collectors'}
                                  </TooltipContent>
                                </Tooltip>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={handleSelectAllCollectors}
                                  disabled={collectors.length === 0}
                                >
                                  {allCollectorsSelected ? 'Clear' : 'Select all'}
                                </Button>
                              </div>
                            </div>

                            <div className="mb-3">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                <Input 
                                  placeholder="Filter collectors..." 
                                  value={collectorSearchQuery}
                                  onChange={(e) => setCollectorSearchQuery(e.target.value)}
                                  className="pl-8 h-8 text-xs"
                                />
                              </div>
                            </div>

                            {collectors.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground border rounded-md">
                                No collectors available. Please select a portal first.
                              </div>
                            ) : (
                              <div className="h-96 border rounded-md overflow-hidden">
                                <ScrollArea className="h-full">
                                  <div className="p-2 space-y-3">
                                    {collectorGroupOrder.map(groupName => (
                                      <Collapsible
                                        key={groupName}
                                        open={!collapsedGroups[groupName]}
                                        onOpenChange={(isOpen) => handleToggleGroupCollapse(groupName, isOpen)}
                                      >
                                        <div className="flex items-center justify-between px-2 py-1 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                                          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground transition-colors">
                                            <ChevronDown
                                              className={cn(
                                                "size-3 transition-transform",
                                                collapsedGroups[groupName] && "-rotate-90"
                                              )}
                                            />
                                            <span>{groupName}</span>
                                            <span className="text-[10px] font-medium normal-case text-muted-foreground/70">
                                              ({collectorsByGroup[groupName]?.length ?? 0})
                                            </span>
                                          </CollapsibleTrigger>
                                          <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => handleToggleGroupSelection(groupName)}
                                          >
                                            {collectorsByGroup[groupName]?.every(collector =>
                                              selectedCollectorIds.includes(collector.id)
                                            )
                                              ? 'Clear group'
                                              : 'Select group'}
                                          </Button>
                                        </div>
                                        <CollapsibleContent className="space-y-2 pt-2">
                                          {collectorsByGroup[groupName]?.map(collector => (
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
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-medium">{collector.description}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                      ({collector.hostname})
                                                    </span>
                                                    <span className="text-muted-foreground">•</span>
                                                    <Badge
                                                      variant={collector.isDown ? 'destructive' : 'default'}
                                                    >
                                                      {collector.isDown ? 'Offline' : 'Online'}
                                                    </Badge>
                                                  </div>
                                                </div>
                                              </Label>
                                            </div>
                                          ))}
                                        </CollapsibleContent>
                                      </Collapsible>
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
                        variant="execute"
                        className="gap-2"
                      >
                        {isExecutingDebugCommand ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            {selectedCommand?.type === 'healthcheck' ? 'Analyzing...' : 'Executing...'}
                          </>
                        ) : (
                          <>
                            {selectedCommand?.type === 'healthcheck' ? (
                              <HeartPulse className="size-4" />
                            ) : (
                              <Play className="size-4" />
                            )}
                            {selectedCommand?.type === 'healthcheck' ? 'Run Health Check' : 'Execute'}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <MultiCollectorResults
                    command={selectedCommand}
                    executedCommand={executedCommand ?? selectedCommand.command}
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
