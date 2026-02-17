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
  Server,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { collectorToasts } from '../../utils/toast-utils';
import { useEditorStore } from '../../stores/editor-store';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import {
  DEBUG_COMMANDS,
  searchCommands,
  type DebugCommand,
} from '../../data/debug-commands';
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
  const [collapsedCommandGroups, setCollapsedCommandGroups] = useState<Record<string, boolean>>({});
  const [collapsedCollectorGroups, setCollapsedCollectorGroups] = useState<Record<string, boolean>>({});

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
      setCollapsedCommandGroups({});
      setCollapsedCollectorGroups({});
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

  // Get all command group keys
  const allCommandGroupKeys = useMemo(() => {
    return Object.keys(commandsByCategory);
  }, [commandsByCategory]);

  // Check if all command groups are expanded
  const allCommandGroupsExpanded = useMemo(() => {
    if (allCommandGroupKeys.length === 0) return false;
    return allCommandGroupKeys.every(key => !collapsedCommandGroups[key]);
  }, [allCommandGroupKeys, collapsedCommandGroups]);

  // Toggle all command groups
  const handleToggleAllCommandGroups = () => {
    const collapsed: Record<string, boolean> = {};
    const shouldCollapse = allCommandGroupsExpanded;
    for (const key of allCommandGroupKeys) {
      collapsed[key] = shouldCollapse;
    }
    setCollapsedCommandGroups(collapsed);
  };

  // Check if all collector groups are expanded
  const allCollectorGroupsExpanded = useMemo(() => {
    if (collectorGroupOrder.length === 0) return false;
    return collectorGroupOrder.every(key => !collapsedCollectorGroups[key]);
  }, [collectorGroupOrder, collapsedCollectorGroups]);

  // Toggle all collector groups
  const handleToggleAllCollectorGroups = () => {
    const collapsed: Record<string, boolean> = {};
    const shouldCollapse = allCollectorGroupsExpanded;
    for (const key of collectorGroupOrder) {
      collapsed[key] = shouldCollapse;
    }
    setCollapsedCollectorGroups(collapsed);
  };

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
      collectorToasts.selectCommandAndCollector();
      return;
    }

    // Validate required parameters
    if (selectedCommand.parameters) {
      for (const param of selectedCommand.parameters) {
        if (param.required && !parameters[param.name]?.trim()) {
          collectorToasts.parameterRequired(param.name);
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

      // Key=value options come first (e.g. version=v3 auth=MD5)
      for (const [key, value] of Object.entries(params)) {
        const needsQuoting = /[\s"\\]/.test(value);
        const formattedValue = needsQuoting
          ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
          : value;
        parts.push(`${key}=${formattedValue}`);
      }

      // Positional args come last (e.g. <host> <oid>)
      for (const value of positional) {
        const needsQuoting = /[\s"\\]/.test(value);
        const formattedValue = needsQuoting
          ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
          : value;
        parts.push(formattedValue);
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
      <DialogContent className="
        flex h-[90vh] w-[95vw]! max-w-[95vw]! flex-col gap-0 p-0
        select-none
      " showCloseButton>
        {/* Fixed Header with Search */}
        <DialogHeader className="shrink-0 space-y-4 border-b px-6 pt-6 pb-4">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="size-5" />
              Debug Commands
            </DialogTitle>
            <DialogDescription>
              Execute collector debug commands on one or more collectors
            </DialogDescription>
          </div>

          {/* Search and Category Filter - Fixed in header */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[280px] flex-1">
              <Search className="
                absolute top-1/2 left-2.5 size-4 -translate-y-1/2
                text-muted-foreground
              " />
              <Input
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pr-7 pl-8"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="
                    absolute top-1/2 right-2.5 -translate-y-1/2
                    text-muted-foreground
                    hover:text-foreground
                  "
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <Select
              value={selectedCategory || 'all'}
              onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)}
            >
              <SelectTrigger className="h-9 w-[180px]">
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
        </DialogHeader>

        {/* Three-column layout */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left Sidebar - Command List */}
          <div className="
            flex min-h-0 w-72 shrink-0 flex-col border-r border-border
            bg-muted/5
          ">
            {/* Sidebar Header */}
            <div className="
              flex items-center justify-between border-b border-border
              bg-background px-3 py-2 text-xs text-muted-foreground
            ">
              <span>{filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleToggleAllCommandGroups}
                disabled={allCommandGroupKeys.length === 0}
                className="h-6 gap-1 px-1.5 text-[10px]"
              >
                {allCommandGroupsExpanded ? (
                  <>
                    <Minimize2 className="size-3" />
                    Collapse
                  </>
                ) : (
                  <>
                    <Maximize2 className="size-3" />
                    Expand
                  </>
                )}
              </Button>
            </div>

            {/* Health Check Quick Action */}
            {!searchQuery && HEALTH_CHECK_COMMAND && (
              <div className="shrink-0 border-b border-border p-3">
                <button
                  onClick={() => handleSelectCommand(HEALTH_CHECK_COMMAND)}
                  className={cn(
                    `
                      w-full rounded-lg border p-3 text-left transition-all
                      backdrop-blur-sm
                    `,
                    `
                      border-teal-500/30 bg-card/60
                      hover:border-teal-500/50 hover:bg-teal-500/10
                    `,
                    selectedCommand?.id === 'healthcheck' && `
                      border-teal-500 bg-teal-500/10
                    `
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <HeartPulse className="size-4 text-teal-500" />
                    <span className="text-sm font-semibold">Health Check</span>
                    <Badge className="
                      h-4 bg-linear-to-r from-emerald-500 to-cyan-500
                      px-1.5 text-[10px] text-white
                    ">
                      Visual
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Comprehensive diagnostic report
                  </p>
                </button>
              </div>
            )}

            {/* Command List */}
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-3">
                {Object.keys(commandsByCategory).length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No commands found
                  </div>
                ) : (
                  Object.entries(commandsByCategory).map(([category, commands]) => {
                    const isOpen = !collapsedCommandGroups[category];
                    return (
                      <Collapsible
                        key={category}
                        open={isOpen}
                        onOpenChange={(open) =>
                          setCollapsedCommandGroups(prev => ({ ...prev, [category]: !open }))
                        }
                        className="
                          overflow-hidden rounded-md border border-border/40
                          bg-card/20
                        "
                      >
                        <CollapsibleTrigger className="
                          flex w-full items-center justify-between px-3 py-2
                          text-xs font-medium text-muted-foreground
                          transition-colors
                          hover:bg-muted/50
                        ">
                          <span className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                            {getCategoryLabel(category)}
                          </span>
                          <Badge variant="secondary" className="
                            h-4 bg-muted px-1.5 text-[10px] font-normal
                            text-muted-foreground
                          ">
                            {commands.length}
                          </Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="border-t border-border/40">
                          {commands.map(cmd => {
                            const isSelected = selectedCommand?.id === cmd.id;
                            return (
                              <button
                                key={cmd.id}
                                onClick={() => handleSelectCommand(cmd)}
                                className={cn(
                                  `
                                    w-full border-l-2 px-3 py-2 text-left
                                    transition-all
                                  `,
                                  isSelected 
                                    ? 'border-primary bg-accent/50' 
                                    : `
                                      border-transparent
                                      hover:border-border/50 hover:bg-muted/30
                                    `
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="truncate font-mono text-xs">
                                    {cmd.command}
                                  </span>
                                  <ChevronRight className="
                                    size-3.5 shrink-0 text-muted-foreground
                                  " />
                                </div>
                                <div className="
                                  mt-0.5 truncate text-xs text-muted-foreground/70
                                ">
                                  {cmd.name}
                                </div>
                              </button>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Center Panel - Command Details or Results */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {selectedCommand ? (
              <>
                {!showResults ? (
                  <>
                    {/* Command Details */}
                    <ScrollArea className="min-h-0 flex-1">
                      <div className="space-y-6 p-6">
                        {/* Command Header */}
                        <div className="
                          rounded-lg border border-border/70 bg-card/60 p-4
                        ">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {selectedCommand.type === 'healthcheck' && (
                              <HeartPulse className="size-5 text-teal-500" />
                            )}
                            <code className="font-mono text-lg font-semibold">
                              {selectedCommand.command}
                            </code>
                            <Badge variant="secondary">
                              {getCategoryLabel(selectedCommand.category)}
                            </Badge>
                            {selectedCommand.type === 'healthcheck' && (
                              <Badge className="
                                bg-linear-to-r from-emerald-500 to-cyan-500
                                text-white
                              ">
                                Visual Report
                              </Badge>
                            )}
                          </div>
                          <h3 className="text-base font-semibold">
                            {selectedCommand.name}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {selectedCommand.description}
                          </p>
                        </div>

                        {/* Health Check Special Info */}
                        {selectedCommand.type === 'healthcheck' && (
                          <div className="
                            rounded-lg border border-teal-500/20
                            bg-linear-to-r from-emerald-500/10 to-cyan-500/10
                            p-4
                          ">
                            <h4 className="
                              mb-2 flex items-center gap-2 font-semibold
                            ">
                              <Sparkles className="size-4 text-cyan-500" />
                              What this report includes:
                            </h4>
                            <ul className="
                              grid gap-1 text-sm text-muted-foreground
                              sm:grid-cols-2
                            ">
                              <li>• Collection summary with thread counts</li>
                              <li>• Top failing modules with charts</li>
                              <li>• Longest-running task analysis</li>
                              <li>• Device capacity limits</li>
                              <li>• Agent config vs defaults</li>
                              <li>• AppliesTo troubleshooting queries</li>
                              <li>• Collector logs analysis</li>
                            </ul>
                          </div>
                        )}

                        {/* Example - hide for health check */}
                        {selectedCommand.type !== 'healthcheck' && (
                          <div className="
                            rounded-lg border border-border/70 bg-card/60 p-4
                          ">
                            <Label className="mb-2 block text-sm font-semibold">
                              Example
                            </Label>
                            <code className="
                              block rounded-md bg-muted/50 p-3 font-mono text-sm
                            ">
                              {selectedCommand.example}
                            </code>
                          </div>
                        )}

                        {/* Parameters */}
                        {selectedCommand.parameters && selectedCommand.parameters.length > 0 && (
                          <div className="
                            rounded-lg border border-border/70 bg-card/60 p-4
                          ">
                            <Label className="mb-4 block text-sm font-semibold">
                              Parameters
                            </Label>
                            <div className="space-y-4">
                              {selectedCommand.parameters.map(param => (
                                <div key={param.name}>
                                  <div className="mb-1.5 flex items-center gap-2">
                                    <Label
                                      htmlFor={`param-${param.name}`}
                                      className="text-sm"
                                    >
                                      {param.name}
                                    </Label>
                                    {param.required ? (
                                      <Badge variant="destructive" className="text-xs">
                                        Required
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        Optional
                                      </Badge>
                                    )}
                                  </div>
                                  <Input
                                    id={`param-${param.name}`}
                                    placeholder={
                                      param.example
                                        ? `e.g., ${param.example}`
                                        : param.description
                                    }
                                    value={parameters[param.name] || ''}
                                    onChange={(e) =>
                                      handleParameterChange(param.name, e.target.value)
                                    }
                                  />
                                  {param.description && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {param.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Execute Button Footer */}
                    <div className="
                      flex shrink-0 items-center justify-end gap-2 border-t
                      border-border bg-background/80 p-4 backdrop-blur-sm
                    ">
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
                            {selectedCommand?.type === 'healthcheck'
                              ? 'Analyzing...'
                              : 'Executing...'}
                          </>
                        ) : (
                          <>
                            {selectedCommand?.type === 'healthcheck' ? (
                              <HeartPulse className="size-4" />
                            ) : (
                              <Play className="size-4" />
                            )}
                            {selectedCommand?.type === 'healthcheck'
                              ? 'Run Health Check'
                              : 'Execute'}
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
                    onRerun={handleExecute}
                  />
                )}
              </>
            ) : (
              <Empty className="flex-1 border-none bg-transparent shadow-none">
                <EmptyMedia variant="icon" className="mx-auto mb-4 bg-muted/50">
                  <Terminal className="size-5 text-muted-foreground/70" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-base font-medium">
                    Select a command
                  </EmptyTitle>
                  <EmptyDescription className="mx-auto mt-1.5 max-w-sm">
                    Choose a debug command from the list to view details and execute
                    on your selected collectors.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>

          {/* Right Sidebar - Collector Selection */}
          {!showResults && (
            <div className="
              flex min-h-0 w-80 shrink-0 flex-col border-l border-border
              bg-muted/5
            ">
              {/* Collector Header */}
              <div className="
                flex items-center justify-between border-b border-border
                bg-background px-3 py-2
              ">
                <div className="flex items-center gap-2">
                  <Server className="size-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Collectors</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {selectedCollectorIds.length} selected
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={handleRefreshCollectors}
                          disabled={isRefreshingCollectors || !selectedPortalId}
                        >
                          <RefreshCw
                            className={cn(
                              "size-3.5",
                              isRefreshingCollectors && "animate-spin"
                            )}
                          />
                        </Button>
                      }
                    />
                    <TooltipContent>Refresh collectors</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleSelectAllCollectors}
                    disabled={collectors.length === 0}
                    className="text-[10px]"
                  >
                    {allCollectorsSelected ? 'Clear' : 'All'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleToggleAllCollectorGroups}
                    disabled={collectorGroupOrder.length === 0}
                    className="h-6 gap-1 px-1.5 text-[10px]"
                  >
                    {allCollectorGroupsExpanded ? (
                      <Minimize2 className="size-3" />
                    ) : (
                      <Maximize2 className="size-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Collector Search */}
              <div className="shrink-0 border-b border-border p-3">
                <div className="relative">
                  <Search className="
                    absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2
                    text-muted-foreground
                  " />
                  <Input
                    placeholder="Filter collectors..."
                    value={collectorSearchQuery}
                    onChange={(e) => setCollectorSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>

              {/* Collector List */}
              {collectors.length === 0 ? (
                <Empty className="flex-1 border-none bg-transparent shadow-none">
                  <EmptyMedia variant="icon" className="mx-auto mb-4 bg-muted/50">
                    <Server className="size-5 text-muted-foreground/70" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle className="text-sm font-medium">
                      No collectors
                    </EmptyTitle>
                    <EmptyDescription className="mx-auto mt-1 text-xs">
                      Connect to a portal to see collectors.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-2 p-3">
                    {collectorGroupOrder.map(groupName => {
                      const isOpen = !collapsedCollectorGroups[groupName];
                      const groupCollectors = collectorsByGroup[groupName] ?? [];
                      const groupSelected = groupCollectors.every(c =>
                        selectedCollectorIds.includes(c.id)
                      );

                      return (
                        <Collapsible
                          key={groupName}
                          open={isOpen}
                          onOpenChange={(open) =>
                            setCollapsedCollectorGroups(prev => ({
                              ...prev,
                              [groupName]: !open,
                            }))
                          }
                          className="
                            overflow-hidden rounded-md border border-border/40
                            bg-card/20
                          "
                        >
                          <div className="
                            flex items-center justify-between px-2 py-1.5
                            transition-colors
                            hover:bg-muted/30
                          ">
                            <CollapsibleTrigger className="
                              flex cursor-pointer items-center gap-2 text-xs
                              font-medium text-muted-foreground
                              transition-colors
                              hover:text-foreground
                            ">
                              {isOpen ? (
                                <ChevronDown className="size-3" />
                              ) : (
                                <ChevronRight className="size-3" />
                              )}
                              <span className="truncate">{groupName}</span>
                              <Badge variant="secondary" className="
                                h-4 bg-muted px-1 text-[10px] font-normal
                                text-muted-foreground
                              ">
                                {groupCollectors.length}
                              </Badge>
                            </CollapsibleTrigger>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleToggleGroupSelection(groupName)}
                              className="h-5 px-1.5 text-[10px]"
                            >
                              {groupSelected ? 'Clear' : 'Select'}
                            </Button>
                          </div>
                          <CollapsibleContent className="border-t border-border/40">
                            {groupCollectors.map(collector => {
                              const isSelected = selectedCollectorIds.includes(
                                collector.id
                              );
                              return (
                                <div
                                  key={collector.id}
                                  className={cn(
                                    `
                                      flex cursor-pointer items-center gap-2
                                      border-l-2 px-2 py-1.5 transition-all
                                    `,
                                    isSelected
                                      ? 'border-primary bg-accent/50'
                                      : `
                                        border-transparent
                                        hover:border-border/50 hover:bg-muted/30
                                      `
                                  )}
                                  onClick={() => handleCollectorToggle(collector.id)}
                                >
                                  <Checkbox
                                    id={`collector-${collector.id}`}
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                      handleCollectorToggle(collector.id)
                                    }
                                    className="shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate text-xs font-medium">
                                        {collector.description}
                                      </span>
                                      <Badge
                                        variant={
                                          collector.isDown ? 'destructive' : 'default'
                                        }
                                        className="h-4 px-1 text-[9px]"
                                      >
                                        {collector.isDown ? 'Offline' : 'Online'}
                                      </Badge>
                                    </div>
                                    <div className="
                                      truncate text-[10px] text-muted-foreground/70
                                    ">
                                      {collector.hostname}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
