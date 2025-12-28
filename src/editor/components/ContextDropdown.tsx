import { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  Circle, 
  Server, 
  RefreshCw,
  Loader2,
  X,
  Globe,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Combobox,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox';
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { 
  InputGroup, 
  InputGroupAddon, 
  InputGroupInput,
  InputGroupButton,
} from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function ContextDropdown() {
  const {
    portals,
    selectedPortalId,
    setSelectedPortal,
    collectors,
    selectedCollectorId,
    setSelectedCollector,
    devices,
    isFetchingDevices,
    hostname,
    setHostname,
    refreshPortals,
  } = useEditorStore();

  const [isOpen, setIsOpen] = useState(false);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [isRefreshingPortals, setIsRefreshingPortals] = useState(false);

  // Filter devices based on search query
  const filteredDevices = useMemo(() => {
    if (!deviceSearchQuery.trim()) return devices;
    const query = deviceSearchQuery.toLowerCase();
    return devices.filter(device => 
      device.name.toLowerCase().includes(query) ||
      device.displayName.toLowerCase().includes(query)
    );
  }, [devices, deviceSearchQuery]);

  // Get selected entities for display
  const selectedPortal = portals.find(p => p.id === selectedPortalId);
  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);

  // Build items arrays for Select
  const portalItems = [
    { value: null, label: 'Select portal...' },
    ...portals.map(p => ({ value: p.id, label: p.hostname }))
  ];
  
  const collectorItems = [
    { value: null, label: 'Select collector...' },
    ...collectors.map(c => ({ 
      value: c.id.toString(), 
      label: c.description || c.hostname 
    }))
  ];

  // Build summary text for dropdown trigger
  const getSummaryText = () => {
    if (!selectedPortal) return 'No connected portal';
    if (!selectedCollector) return selectedPortal.hostname;
    const device = hostname ? ` → ${hostname}` : '';
    return `${selectedPortal.hostname} → ${selectedCollector.description || selectedCollector.hostname}${device}`;
  };

  // Handle portal refresh with loading state
  const handleRefreshPortals = async () => {
    setIsRefreshingPortals(true);
    try {
      await refreshPortals();
    } finally {
      // Add a small delay to ensure the animation is visible
      setTimeout(() => {
        setIsRefreshingPortals(false);
      }, 300);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 max-w-[280px]"
                >
                  <Globe className="size-3.5 shrink-0" />
                  <span className="truncate text-xs">{getSummaryText()}</span>
                  <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                </Button>
              }
            />
          }
        />
        <TooltipContent className="text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Portal:</span>
              <span>{selectedPortal?.hostname || 'Not selected'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Collector:</span>
              <span>{selectedCollector?.description || selectedCollector?.hostname || 'Not selected'}</span>
            </div>
            {hostname && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Device:</span>
                <span>{hostname}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="p-3 border-b border-border">
          <h4 className="font-medium text-sm">Execution Context</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select where to run your scripts
          </p>
        </div>

        <div className="p-3 space-y-4">
          {/* Portal Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Portal</Label>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleRefreshPortals}
                      disabled={isRefreshingPortals}
                      className={cn(
                        "size-5 transition-all duration-200",
                        isRefreshingPortals && "opacity-70"
                      )}
                    >
                      <RefreshCw 
                        className={cn(
                          "size-3 transition-transform duration-200",
                          isRefreshingPortals && "animate-spin"
                        )} 
                      />
                    </Button>
                  }
                />
                <TooltipContent>
                  {isRefreshingPortals ? 'Refreshing portals...' : 'Refresh portals'}
                </TooltipContent>
              </Tooltip>
            </div>
            <Select 
              value={selectedPortalId} 
              onValueChange={(value) => setSelectedPortal(value || null)}
              items={portalItems}
            >
              <SelectTrigger className="w-full h-8" aria-label="Select portal">
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                  <Circle
                    className={cn(
                      'size-2 shrink-0',
                      selectedPortal?.status === 'active'
                        ? 'fill-green-500 text-green-500'
                        : selectedPortal
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'fill-muted-foreground text-muted-foreground'
                    )}
                  />
                  <SelectValue className="truncate" />
                </div>
              </SelectTrigger>
              <SelectContent align="start">
                {portals.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No portals found
                  </div>
                ) : (
                  portals.map((portal) => (
                    <SelectItem key={portal.id} value={portal.id}>
                      <div className="flex items-center gap-2">
                        <Circle
                          className={cn(
                            'size-2',
                            portal.status === 'active'
                              ? 'fill-green-500 text-green-500'
                              : 'fill-yellow-500 text-yellow-500'
                          )}
                        />
                        <span>{portal.hostname}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Collector Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Collector</Label>
            <Select 
              value={selectedCollectorId?.toString() ?? null} 
              onValueChange={(value) => setSelectedCollector(value ? parseInt(value) : null)}
              disabled={!selectedPortalId || collectors.length === 0}
              items={collectorItems}
            >
              <SelectTrigger className="w-full h-8" aria-label="Select collector">
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                  {selectedCollector && (
                    <Server
                      className={cn(
                        'size-4 shrink-0',
                        selectedCollector.isDown 
                          ? 'text-red-500' 
                          : 'text-green-500'
                      )}
                    />
                  )}
                  <SelectValue className="truncate" />
                </div>
              </SelectTrigger>
              <SelectContent align="start" className="min-w-[320px]">
                {collectors.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {selectedPortalId ? 'No collectors found' : 'Select a portal first'}
                  </div>
                ) : (
                  collectors.map((collector) => (
                    <SelectItem 
                      key={collector.id} 
                      value={collector.id.toString()}
                      disabled={collector.isDown}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Server
                          className={cn(
                            'size-4 shrink-0',
                            collector.isDown 
                              ? 'text-red-500' 
                              : 'text-green-500'
                          )}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium truncate">
                            {collector.description || collector.hostname}
                            {collector.isDown && (
                              <span className="text-red-500 text-xs ml-1.5">(offline)</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            #{collector.id}
                            {collector.collectorGroupName && ` · ${collector.collectorGroupName}`}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Device/Hostname Combobox */}
          <div className="space-y-1.5">
            <Label className="text-xs">Device (optional)</Label>
            <Combobox
              value={hostname}
              onValueChange={(value) => {
                setHostname(value || '');
                if (value) setDeviceSearchQuery('');
              }}
              disabled={!selectedCollectorId}
            >
              <InputGroup className="w-full h-9" data-disabled={!selectedCollectorId}>
                {hostname && (
                  <InputGroupAddon align="inline-start">
                    <Server className={cn(
                      "size-4 shrink-0",
                      devices.find(d => d.name === hostname)?.hostStatus === 'normal'
                        ? "text-green-500"
                        : "text-red-500"
                    )} />
                  </InputGroupAddon>
                )}
                <ComboboxPrimitive.Input
                  render={<InputGroupInput disabled={!selectedCollectorId} />}
                  placeholder={
                    isFetchingDevices 
                      ? 'Loading devices...' 
                      : !selectedCollectorId 
                        ? 'Select collector first...'
                        : devices.length === 0 
                          ? 'No devices on collector' 
                          : 'Search devices...'
                  }
                  onChange={(e) => setDeviceSearchQuery(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  {hostname ? (
                    <ComboboxPrimitive.Clear
                      render={<InputGroupButton variant="ghost" size="icon-xs" />}
                    >
                      <X className="size-3.5 pointer-events-none" />
                    </ComboboxPrimitive.Clear>
                  ) : (
                    <InputGroupButton
                      size="icon-xs"
                      variant="ghost"
                      render={<ComboboxPrimitive.Trigger />}
                      disabled={!selectedCollectorId}
                      className="data-pressed:bg-transparent"
                    >
                      <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none" />
                    </InputGroupButton>
                  )}
                </InputGroupAddon>
              </InputGroup>
              <ComboboxContent className="min-w-[320px]">
                <ComboboxList>
                  {isFetchingDevices ? (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Loading devices...
                    </div>
                  ) : devices.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                      {selectedCollectorId 
                        ? 'No devices found on this collector'
                        : 'Select a collector first'}
                    </div>
                  ) : filteredDevices.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                      No devices match "{deviceSearchQuery}"
                    </div>
                  ) : (
                    filteredDevices.map((device) => (
                      <ComboboxItem key={device.id} value={device.name}>
                        <div className="flex items-center gap-2 w-full">
                          <Server className={cn(
                            "size-4 shrink-0",
                            device.hostStatus === 'normal' 
                              ? "text-green-500" 
                              : "text-red-500"
                          )} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium truncate">
                              {device.displayName}
                              {device.hostStatus !== 'normal' && (
                                <span className="text-red-500 text-xs ml-1.5">(offline)</span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">{device.name}</span>
                          </div>
                        </div>
                      </ComboboxItem>
                    ))
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

