import { useMemo, useState, KeyboardEvent } from 'react';
import { Search, ServerOff, ChevronDown, ChevronRight, Monitor, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../../stores/editor-store';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { LoadingState } from '../shared/LoadingState';
import { CopyButton } from '../shared/CopyButton';
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
    } catch (_error) {
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
      <div className="flex h-full flex-col bg-muted/5">
        <Empty className="
          flex h-full flex-col justify-center border-0 bg-transparent
        ">
          <EmptyMedia variant="icon" className="mb-4 bg-muted/50">
            <ServerOff className="size-5 text-muted-foreground/70" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-base font-medium">No Device Selected</EmptyTitle>
            <EmptyDescription className="mt-1.5 px-6">
              Select a device from the dropdown above to view its properties
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-muted/5">
      {/* Device Info Header */}
      {selectedDevice && (
        <div className="shrink-0 border-b border-border bg-background px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Monitor className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{selectedDevice.displayName}</p>
              <p className="
                mt-0.5 truncate font-mono text-[10px] text-muted-foreground
              ">{hostname}</p>
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
                      `
                        size-7 transition-all duration-200
                        hover:bg-muted
                      `,
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
        <div className="min-h-0 flex-1 bg-background/50">
          <LoadingState 
            title="Loading Properties"
            description="Fetching device properties..."
            className="border-0 bg-transparent"
          />
        </div>
      ) : deviceProperties.length === 0 ? (
        <Empty className="
          flex h-full flex-col justify-center border-0 bg-transparent
        ">
          <EmptyMedia variant="icon" className="mb-4 bg-muted/50">
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
          <div className="shrink-0 border-b border-border bg-background p-3">
            <div className="relative">
              <Search className="
                absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2
                text-muted-foreground
              " />
              <Input
                placeholder="Filter properties..."
                value={propertiesSearchQuery}
                onChange={(e) => setPropertiesSearchQuery(e.target.value)}
                className="
                  h-8 border-input bg-muted/30 pl-8 text-xs shadow-sm
                  transition-colors
                  focus-visible:bg-background
                "
              />
            </div>
            <p className="
              mt-2 flex items-center justify-between px-1 text-[10px]
              text-muted-foreground
            ">
              <span>Showing {filteredProperties.length} properties</span>
              <span className="text-muted-foreground/50">Total: {deviceProperties.length}</span>
            </p>
          </div>

          {/* Properties list - scrollable */}
          <div className="min-h-0 flex-1 overflow-auto bg-muted/5">
            <div className="space-y-3 p-2">
              {Object.entries(groupedProperties).map(([type, props]) => {
                if (props.length === 0) return null;
                return (
                  <Collapsible
                    key={type}
                    open={expandedGroups[type]}
                    onOpenChange={() => toggleGroup(type)}
                    className="
                      overflow-hidden rounded-md border border-border/40
                      bg-card/40 shadow-sm
                    "
                  >
                    <CollapsibleTrigger className="
                      flex w-full items-center gap-2 border-b border-transparent
                      px-3 py-2 transition-colors
                      hover:bg-muted/50
                      data-[state=open]:border-border/40
                    ">
                      {expandedGroups[type] ? (
                        <ChevronDown className="
                          size-3 shrink-0 text-muted-foreground
                        " />
                      ) : (
                        <ChevronRight className="
                          size-3 shrink-0 text-muted-foreground
                        " />
                      )}
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(`
                            bg-opacity-10 border-opacity-20 h-5 px-1.5
                            text-[10px] font-normal capitalize
                          `, TYPE_COLORS[type])}
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
                            className="
                              group relative flex items-start gap-3 px-3 py-2
                              transition-colors
                              hover:bg-muted/40
                            "
                          >
                            {/* Hover Indicator */}
                            <div className="
                              absolute top-0 bottom-0 left-0 w-[2px] bg-primary
                              opacity-0 transition-opacity
                              group-hover:opacity-100
                            " />
                            
                            <div className="min-w-0 flex-1">
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      className="
                                        block w-full truncate rounded-sm
                                        text-left font-mono text-xs
                                        text-foreground/90 transition-colors
                                        select-text
                                        hover:text-primary
                                        focus-visible:ring-2
                                        focus-visible:ring-ring
                                        focus-visible:ring-offset-2
                                        focus-visible:outline-none
                                      "
                                      onClick={() => handleInsert(prop.name)}
                                      onKeyDown={(e) => handlePropertyKeyDown(e, prop.name)}
                                      aria-label={`Insert property access for ${prop.name}`}
                                    >
                                      {prop.name}
                                    </button>
                                  }
                                />
                                <TooltipContent side="left" className="
                                  max-w-xs break-all
                                ">
                                  <code className="
                                    mb-1.5 block rounded-sm bg-muted/30 p-1
                                    text-xs
                                  ">
                                    {language === 'groovy'
                                      ? `hostProps.get("${prop.name}")`
                                      : `$${toPowerShellVariable(prop.name)} = "##${prop.name.toUpperCase()}##"`}
                                  </code>
                                  <div className="
                                    text-[10px] text-muted-foreground
                                  ">Click to insert into editor</div>
                                </TooltipContent>
                              </Tooltip>
                              <p className="
                                mt-1 truncate font-mono text-[10px]
                                text-muted-foreground select-all
                              ">
                                {prop.value || <span className="
                                  text-muted-foreground/50 italic
                                ">(empty)</span>}
                              </p>
                            </div>
                            <CopyButton
                              text={prop.value}
                              size="sm"
                              variant="ghost"
                              className="
                                size-6 opacity-0 transition-opacity
                                group-hover:opacity-100
                              "
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
