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
      <Empty className="h-full border-0">
        <EmptyMedia variant="icon">
          <ServerOff />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No Device Selected</EmptyTitle>
          <EmptyDescription>
            Select a device from the dropdown to view its properties
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Device Info Header */}
      {selectedDevice && (
        <div className="px-3 py-2 border-b border-border bg-secondary/20 shrink-0">
          <div className="flex items-center gap-2">
            <Monitor className="size-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{selectedDevice.displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{hostname}</p>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => fetchDeviceProperties(selectedDevice.id)}
                    disabled={isFetchingProperties}
                    className={cn(
                      "h-7 px-2 text-[10px] gap-1 transition-all duration-200",
                      isFetchingProperties && "opacity-70"
                    )}
                  >
                    <RefreshCw
                      className={cn(
                        "size-3 transition-transform duration-200",
                        isFetchingProperties && "animate-spin"
                      )}
                    />
                    {isFetchingProperties ? 'Refreshing...' : 'Refresh properties'}
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
        <div className="flex-1 min-h-0">
          <LoadingState 
            title="Loading Properties"
            description="Fetching device properties..."
          />
        </div>
      ) : deviceProperties.length === 0 ? (
        <Empty className="h-full border-0">
          <EmptyMedia variant="icon">
            <ServerOff />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No Properties Found</EmptyTitle>
            <EmptyDescription>
              This device has no accessible properties
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Search */}
          <div className="p-2 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter properties..."
                value={propertiesSearchQuery}
                onChange={(e) => setPropertiesSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              {filteredProperties.length} of {deviceProperties.length} properties
            </p>
          </div>

          {/* Properties list - scrollable */}
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="p-2 space-y-2">
              {Object.entries(groupedProperties).map(([type, props]) => {
                if (props.length === 0) return null;
                return (
                  <Collapsible
                    key={type}
                    open={expandedGroups[type]}
                    onOpenChange={() => toggleGroup(type)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full px-1 py-1.5 hover:bg-secondary/50 rounded-md transition-colors">
                      {expandedGroups[type] ? (
                        <ChevronDown className="size-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-3 text-muted-foreground" />
                      )}
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] capitalize', TYPE_COLORS[type])}
                      >
                        {type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        ({props.length})
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 mt-1">
                        {props.map((prop) => (
                          <div
                            key={prop.name}
                            className="group flex items-start gap-2 p-2 rounded-md hover:bg-secondary/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      className="text-xs font-mono text-left text-foreground hover:text-primary hover:underline transition-colors truncate block w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
                                      onClick={() => handleInsert(prop.name)}
                                      onKeyDown={(e) => handlePropertyKeyDown(e, prop.name)}
                                      tabIndex={0}
                                      aria-label={`Insert property access for ${prop.name}`}
                                    >
                                      {prop.name}
                                    </button>
                                  }
                                />
                                <TooltipContent side="left">
                                  <code className="text-xs">
                                    {language === 'groovy'
                                      ? `hostProps.get("${prop.name}")`
                                      : `$${toPowerShellVariable(prop.name)} = "##${prop.name.toUpperCase()}##"`}
                                  </code>
                                  <div className="text-[10px] text-muted-foreground mt-1">Click to insert</div>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">
                                {prop.value || '(empty)'}
                              </p>
                            </div>
                            <CopyButton
                              text={prop.value}
                              size="sm"
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
