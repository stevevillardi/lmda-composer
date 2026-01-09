import { useMemo, useState, KeyboardEvent } from 'react';
import { Search, ServerOff, ChevronDown, ChevronRight, Monitor, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { LoadingState } from './shared/LoadingState';
import { CopyButton } from './shared/CopyButton';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';

const TYPE_COLORS: Record<string, string> = {
  system: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  custom: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  inherited: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  auto: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
};

export function DevicePropertiesPanel() {
  const toPowerShellVariable = useCallback((propertyName: string) => {
    return propertyName
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1');
  }, []);
  const {
    hostname,
    devices,
    deviceProperties,
    isFetchingProperties,
    propertiesSearchQuery,
    setPropertiesSearchQuery,
    insertPropertyAccess,
    fetchDeviceProperties,
    tabs,
    activeTabId,
  } = useEditorStore();

  // Get language from active tab (ensures re-render when tab changes)
  const language = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    return activeTab?.language ?? 'groovy';
  }, [tabs, activeTabId]);

  // Find the selected device to show display name
  const selectedDevice = useMemo(() => {
    return devices.find(d => d.name === hostname);
  }, [devices, hostname]);

  // Filter properties based on search query
  const filteredProperties = useMemo(() => {
    if (!propertiesSearchQuery.trim()) return deviceProperties;
    const query = propertiesSearchQuery.toLowerCase();
    return deviceProperties.filter(
      (prop) =>
        prop.name.toLowerCase().includes(query) ||
        prop.value.toLowerCase().includes(query)
    );
  }, [deviceProperties, propertiesSearchQuery]);

  // Group properties by type
  const groupedProperties = useMemo(() => {
    const groups: Record<string, typeof deviceProperties> = {
      system: [],
      custom: [],
      inherited: [],
      auto: [],
    };
    filteredProperties.forEach((prop) => {
      if (groups[prop.type]) {
        groups[prop.type].push(prop);
      }
    });
    return groups;
  }, [filteredProperties]);

  const handleCopy = async (value: string, propertyName: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Property value copied', {
        description: propertyName,
      });
    } catch (error) {
      toast.error('Failed to copy', {
        description: 'Could not copy property value to clipboard',
      });
    }
  };

  const handleInsert = (propertyName: string) => {
    insertPropertyAccess(propertyName);
    toast.success('Property access inserted', {
      description: propertyName,
    });
  };

  const handlePropertyKeyDown = (e: KeyboardEvent<HTMLButtonElement>, propertyName: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleInsert(propertyName);
    }
  };

  // State for collapsible groups (default all expanded)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    system: true,
    custom: true,
    inherited: true,
    auto: true,
  });

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // Empty state - no device selected
  if (!hostname) {
    return (
      <div className="flex flex-col h-full bg-muted/5">
        <Empty className="h-full border-0 bg-transparent flex flex-col justify-center">
          <EmptyMedia variant="icon" className="bg-muted/50 mb-4">
            <ServerOff className="size-5 text-muted-foreground/70" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-base font-medium">No Device Selected</EmptyTitle>
            <EmptyDescription className="px-6 mt-1.5">
              Select a device from the dropdown above to view its properties
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/5">
      {/* Device Info Header */}
      {selectedDevice && (
        <div className="px-3 py-2 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md text-primary">
              <Monitor className="size-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-foreground">{selectedDevice.displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">{hostname}</p>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => fetchDeviceProperties(selectedDevice.id)}
                    disabled={isFetchingProperties}
                    className={cn(
                      "size-7 transition-all duration-200 hover:bg-muted",
                      isFetchingProperties && "opacity-70"
                    )}
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        isFetchingProperties && "animate-spin"
                      )}
                    />
                  </Button>
                }
              />
              <TooltipContent>
                {isFetchingProperties ? 'Refreshing properties...' : 'Refresh properties'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {isFetchingProperties ? (
        <div className="flex-1 min-h-0 bg-background/50">
          <LoadingState 
            title="Loading Properties"
            description="Fetching device properties..."
            className="border-0 bg-transparent"
          />
        </div>
      ) : deviceProperties.length === 0 ? (
        <Empty className="h-full border-0 bg-transparent flex flex-col justify-center">
          <EmptyMedia variant="icon" className="bg-muted/50 mb-4">
            <ServerOff className="size-5 text-muted-foreground/70" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-base font-medium">No Properties Found</EmptyTitle>
            <EmptyDescription className="mt-1.5">
              This device has no accessible properties
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Search */}
          <div className="p-3 border-b border-border shrink-0 bg-background">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter properties..."
                value={propertiesSearchQuery}
                onChange={(e) => setPropertiesSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted/30 border-input shadow-sm focus-visible:bg-background transition-colors"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 px-1 flex items-center justify-between">
              <span>Showing {filteredProperties.length} properties</span>
              <span className="text-muted-foreground/50">Total: {deviceProperties.length}</span>
            </p>
          </div>

          {/* Properties list - scrollable */}
          <div className="flex-1 min-h-0 overflow-auto bg-muted/5">
            <div className="p-2 space-y-3">
              {Object.entries(groupedProperties).map(([type, props]) => {
                if (props.length === 0) return null;
                return (
                  <Collapsible
                    key={type}
                    open={expandedGroups[type]}
                    onOpenChange={() => toggleGroup(type)}
                    className="border border-border/40 rounded-md bg-card/40 overflow-hidden shadow-sm"
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 transition-colors border-b border-transparent data-[state=open]:border-border/40">
                      {expandedGroups[type] ? (
                        <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] capitalize h-5 px-1.5 font-normal bg-opacity-10 border-opacity-20', TYPE_COLORS[type])}
                        >
                          {type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {props.length}
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="bg-background/30">
                      <div className="divide-y divide-border/30">
                        {props.map((prop) => (
                          <div
                            key={prop.name}
                            className="group relative flex items-start gap-3 px-3 py-2 hover:bg-muted/40 transition-colors"
                          >
                            {/* Hover Indicator */}
                            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="flex-1 min-w-0">
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      className="text-xs font-mono text-left text-foreground/90 hover:text-primary transition-colors truncate block w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm select-text"
                                      onClick={() => handleInsert(prop.name)}
                                      onKeyDown={(e) => handlePropertyKeyDown(e, prop.name)}
                                      tabIndex={0}
                                      aria-label={`Insert property access for ${prop.name}`}
                                    >
                                      {prop.name}
                                    </button>
                                  }
                                />
                                <TooltipContent side="left" className="max-w-xs break-all">
                                  <code className="text-xs block mb-1.5 bg-muted/30 p-1 rounded">
                                    {language === 'groovy'
                                      ? `hostProps.get("${prop.name}")`
                                      : `$${toPowerShellVariable(prop.name)} = "##${prop.name.toUpperCase()}##"`}
                                  </code>
                                  <div className="text-[10px] text-muted-foreground">Click to insert into editor</div>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-[10px] text-muted-foreground truncate mt-1 font-mono select-all">
                                {prop.value || <span className="italic text-muted-foreground/50">(empty)</span>}
                              </p>
                            </div>
                            <CopyButton
                              text={prop.value}
                              size="sm"
                              variant="ghost"
                              className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onCopy={() => handleCopy(prop.value, prop.name)}
                              tooltip="Copy value"
                            />
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
