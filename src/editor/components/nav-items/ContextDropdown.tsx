import { useEffect, useState, useMemo } from 'react';
import { 
  ChevronDown, 
  Circle, 
  Server, 
  RefreshCw,
  Loader2,
  X,
  Globe,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
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
import { 
  Empty, 
  EmptyHeader, 
  EmptyMedia, 
  EmptyTitle, 
  EmptyDescription, 
  EmptyContent 
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';

export function ContextDropdown({
  showCollector = true,
  showDevice = true,
}: {
  showCollector?: boolean;
  showDevice?: boolean;
}) {
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
    refreshCollectors,
    fetchDevices,
  } = useEditorStore();

  const [isOpen, setIsOpen] = useState(false);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [isRefreshingPortals, setIsRefreshingPortals] = useState(false);
  const [isRefreshingCollectors, setIsRefreshingCollectors] = useState(false);

  useEffect(() => {
    if (isOpen && portals.length === 0) {
      refreshPortals();
    }
  }, [isOpen, portals.length, refreshPortals]);

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
  const selectedCollectorArch = selectedCollector?.arch;
  const isPortalActive = selectedPortal?.status === 'active';
  const selectedDevice = useMemo(() => {
    if (!hostname) return null;
    return devices.find(device => device.name === hostname) ?? null;
  }, [devices, hostname]);

  // If portal becomes inactive, clear dependent context so we don't show stale collector/device state.
  useEffect(() => {
    if (!selectedPortalId) return;
    if (isPortalActive) return;
    if (selectedCollectorId) setSelectedCollector(null);
    if (hostname) setHostname('');
  }, [hostname, isPortalActive, selectedCollectorId, selectedPortalId, setHostname, setSelectedCollector]);

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

  const formatDeviceLabel = (deviceName: string) => {
    const device = devices.find(d => d.name === deviceName);
    if (!device) return deviceName;
    if (!device.displayName || device.displayName === device.name) {
      return device.name;
    }
    return `${device.displayName} (${device.name})`;
  };

  // Build summary text for dropdown trigger
  const getSummaryText = () => {
    if (!selectedPortal) return 'No connected portal';
    if (!showCollector || !isPortalActive) return selectedPortal.hostname;
    if (!selectedCollector) return selectedPortal.hostname;
    const device = showDevice && isPortalActive && hostname ? ` → ${formatDeviceLabel(hostname)}` : '';
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

  // Handle collector refresh with loading state
  const handleRefreshCollectors = async () => {
    setIsRefreshingCollectors(true);
    try {
      await refreshCollectors();
    } finally {
      // Add a small delay to ensure the animation is visible
      setTimeout(() => {
        setIsRefreshingCollectors(false);
      }, 300);
    }
  };

  // Handle device refresh with loading state
  const handleRefreshDevices = async () => {
    await fetchDevices();
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
                  className="h-8 max-w-[280px] gap-1.5"
                >
                  <Globe className="size-3.5 shrink-0" />
                  <Circle
                    className={cn(
                      'size-2 shrink-0',
                      selectedPortal?.status === 'active'
                        ? 'fill-green-500 text-teal-500'
                        : selectedPortal
                          ? 'fill-red-500 text-red-500'
                          : 'fill-muted-foreground text-muted-foreground'
                    )}
                  />
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
            {showCollector && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Collector:</span>
                <span>
                  {selectedCollector?.description || selectedCollector?.hostname || 'Not selected'}
                  {selectedCollectorArch ? ` (${selectedCollectorArch})` : ''}
                </span>
              </div>
            )}
              {showDevice && hostname && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Device:</span>
                <span>{formatDeviceLabel(hostname)}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      <PopoverContent className="
        w-[360px] bg-background/95 p-0 backdrop-blur-xl
      " align="start">
        {portals.length === 0 ? (
          // Empty state when no portals detected
          <Empty className="
            flex flex-col justify-center border-none bg-transparent p-6
          ">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-muted/50">
                <Globe className="size-5 text-muted-foreground/70" />
              </EmptyMedia>
              <EmptyTitle className="text-base font-medium">No portals detected</EmptyTitle>
              <EmptyDescription>
                Open a LogicMonitor portal tab in your browser and sign in. 
                The extension will automatically detect your session.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshPortals}
                disabled={isRefreshingPortals}
                className="w-full bg-background/50"
              >
                <RefreshCw className={cn("mr-2 size-3.5", isRefreshingPortals && `
                  animate-spin
                `)} />
                {isRefreshingPortals ? 'Checking...' : 'Check for Portals'}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="
              border-b border-border bg-secondary/30 p-3 select-none
            ">
              <h4 className="text-sm font-medium">Execution Context</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {showCollector ? 'Select where to run your scripts' : 'Select your portal'}
              </p>
            </div>

            <div className="space-y-4 p-3">
              {/* Portal Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Portal</Label>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleRefreshPortals}
                      disabled={isRefreshingPortals}
                      className={cn(
                        "transition-all duration-200",
                        isRefreshingPortals && "opacity-70"
                      )}
                    >
                      <RefreshCw 
                        className={cn(
                          "size-3 transition-transform duration-200",
                          isRefreshingPortals && "animate-spin"
                        )} 
                      />
                      Refresh
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
              <SelectTrigger className="h-8 w-full" aria-label="Select portal">
                <div className="
                  flex min-w-0 flex-1 items-center gap-2 overflow-hidden
                ">
                  <Circle
                    className={cn(
                      'size-2 shrink-0',
                      selectedPortal?.status === 'active'
                        ? 'fill-green-500 text-teal-500'
                        : selectedPortal
                          ? 'fill-red-500 text-red-500'
                          : 'fill-muted-foreground text-muted-foreground'
                    )}
                  />
                  <SelectValue className="truncate" />
                </div>
              </SelectTrigger>
              <SelectContent align="start">
                {portals.length === 0 ? (
                  <div className="
                    px-2 py-4 text-center text-sm text-muted-foreground
                  ">
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
                              ? 'fill-green-500 text-teal-500'
                              : 'fill-red-500 text-red-500'
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

          {selectedPortal && !isPortalActive && (
            <>
              <Separator />
              <Empty className="
                rounded-lg border border-border/50 bg-background/40 p-4
              ">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-muted/50">
                    <Globe className="size-5 text-muted-foreground/70" />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-medium">Portal detected, but no active session</EmptyTitle>
                  <EmptyDescription className="text-xs">
                    We can see <span className="font-medium">{selectedPortal.hostname}</span>, but it looks like you may be
                    logged out (or the tab is on the login screen). Open that portal tab, sign in, then refresh.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshPortals}
                    disabled={isRefreshingPortals}
                    className="w-full bg-background/50"
                  >
                    <RefreshCw className={cn("mr-2 size-3.5", isRefreshingPortals && `
                      animate-spin
                    `)} />
                    {isRefreshingPortals ? 'Checking...' : 'Refresh portal status'}
                  </Button>
                </EmptyContent>
              </Empty>
            </>
          )}

          {showCollector && isPortalActive && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Collector</Label>
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
                </div>
                <Select 
                  value={selectedCollectorId?.toString() ?? null} 
                  onValueChange={(value) => setSelectedCollector(value ? parseInt(value) : null)}
                  disabled={!selectedPortalId || collectors.length === 0}
                  items={collectorItems}
                >
                  <SelectTrigger className="h-8 w-full" aria-label="Select collector">
                    <div className="
                      flex min-w-0 flex-1 items-center gap-2 overflow-hidden
                    ">
                      {selectedCollector && (
                        <Server
                          className={cn(
                            'size-4 shrink-0',
                            selectedCollector.isDown 
                              ? 'text-red-500' 
                              : 'text-teal-500'
                          )}
                        />
                      )}
                      <SelectValue className="truncate" />
                    </div>
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-[320px]">
                    {collectors.length === 0 ? (
                      <div className="
                        px-2 py-4 text-center text-sm text-muted-foreground
                      ">
                        {selectedPortalId ? 'No collectors found' : 'Select a portal first'}
                      </div>
                    ) : (
                      collectors.map((collector) => (
                        <SelectItem 
                          key={collector.id} 
                          value={collector.id.toString()}
                          disabled={collector.isDown}
                        >
                          <div className="flex w-full items-center gap-2">
                            <Server
                              className={cn(
                                'size-4 shrink-0',
                                collector.isDown 
                                  ? 'text-red-500' 
                                  : 'text-teal-500'
                              )}
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-medium">
                                {collector.description || collector.hostname}
                                {collector.isDown && (
                                  <span className="ml-1.5 text-xs text-red-500">(offline)</span>
                                )}
                              </span>
                              <span className="
                                truncate text-xs text-muted-foreground
                              ">
                                #{collector.id}
                                {collector.collectorGroupName && ` · ${collector.collectorGroupName}`}
                                {collector.arch && ` · ${collector.arch}`}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {showDevice && isPortalActive && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Device (optional)</Label>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={handleRefreshDevices}
                          disabled={isFetchingDevices || !selectedCollectorId}
                          className={cn(
                            "transition-all duration-200",
                            isFetchingDevices && "opacity-70"
                          )}
                        >
                          <RefreshCw 
                            className={cn(
                              "size-3 transition-transform duration-200",
                              isFetchingDevices && "animate-spin"
                            )} 
                          />
                          Refresh
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {isFetchingDevices ? 'Refreshing devices...' : 'Refresh devices'}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Combobox
                  value={hostname}
                  onValueChange={(value) => {
                    setHostname(value || '');
                    if (value) setDeviceSearchQuery('');
                  }}
                  itemToStringLabel={(value) => {
                    if (!value || typeof value !== 'string') return '';
                    return formatDeviceLabel(value);
                  }}
                  disabled={!selectedCollectorId}
                >
                  <InputGroup className="h-9 w-full" data-disabled={!selectedCollectorId}>
                    {hostname && (
                      <InputGroupAddon align="inline-start">
                        <Server className={cn(
                          "size-4 shrink-0",
                          selectedDevice?.hostStatus === 'normal'
                            ? "text-teal-500"
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
                          <X className="pointer-events-none size-3.5" />
                        </ComboboxPrimitive.Clear>
                      ) : (
                        <InputGroupButton
                          size="icon-xs"
                          variant="ghost"
                          render={<ComboboxPrimitive.Trigger />}
                          disabled={!selectedCollectorId}
                          className="data-pressed:bg-transparent"
                        >
                          <ChevronDown className="
                            pointer-events-none size-3.5 text-muted-foreground
                          " />
                        </InputGroupButton>
                      )}
                    </InputGroupAddon>
                  </InputGroup>
                  <ComboboxContent className="min-w-[320px]">
                    <ComboboxList>
                      {isFetchingDevices ? (
                        <div className="
                          flex items-center justify-center py-4 text-sm
                          text-muted-foreground
                        ">
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Loading devices...
                        </div>
                      ) : devices.length === 0 ? (
                        <div className="
                          flex items-center justify-center py-4 text-sm
                          text-muted-foreground
                        ">
                          {selectedCollectorId 
                            ? 'No devices found on this collector'
                            : 'Select a collector first'}
                        </div>
                      ) : filteredDevices.length === 0 ? (
                        <div className="
                          flex items-center justify-center py-4 text-sm
                          text-muted-foreground
                        ">
                          No devices match "{deviceSearchQuery}"
                        </div>
                      ) : (
                        filteredDevices.map((device) => (
                          <ComboboxItem 
                            key={device.id} 
                            value={device.name}
                            className="
                              group relative mx-1 my-0.5 cursor-pointer
                              rounded-sm border-l-2 border-transparent px-2.5
                              py-2 transition-all
                              hover:border-l-primary/50 hover:bg-accent/40
                              aria-selected:border-primary
                              aria-selected:bg-accent/50
                              aria-selected:text-accent-foreground
                            "
                          >
                            <div className="flex w-full items-center gap-2">
                              <Server className={cn(
                                "size-3.5 shrink-0 transition-colors",
                                device.hostStatus === 'normal' 
                                  ? "text-teal-500" 
                                  : "text-red-500"
                              )} />
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-xs font-medium">
                                  {device.displayName}
                                  {device.hostStatus !== 'normal' && (
                                    <span className="ml-1.5 text-red-500">(offline)</span>
                                  )}
                                </span>
                                <span className="
                                  truncate text-[10px] text-muted-foreground
                                  group-aria-selected:text-muted-foreground/80
                                ">{device.name}</span>
                              </div>
                            </div>
                          </ComboboxItem>
                        ))
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </>
          )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
