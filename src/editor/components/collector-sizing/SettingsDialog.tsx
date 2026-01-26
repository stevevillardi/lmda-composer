/**
 * SettingsDialog - Comprehensive configuration for the collector sizing calculator.
 * Includes tabs for: Collector Load, Collection Methods, Device Types.
 */

import { useState } from 'react';
import {
  RotateCcw,
  Settings,
  Gauge,
  Network,
  Server,
  Plus,
  Trash2,
  AlertCircle,
  Router,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import type { MethodWeights, CollectorSize } from '../../utils/collector-calculations';
import { createDefaultMethodWeights } from '../../utils/collector-calculations';
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
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLLECTOR_SIZES: CollectorSize[] = ['SMALL', 'MEDIUM', 'LARGE', 'XL', 'XXL'];

const DEVICE_ICONS = ['Server', 'Router', 'Network', 'Database', 'Monitor', 'HardDrive', 'Wifi'];

const DEFAULT_METHOD_KEYS = Object.keys(createDefaultMethodWeights());

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('collector-load');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl! flex-col overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <Settings className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Calculator Settings</DialogTitle>
              <DialogDescription>
                Configure calculation parameters, method weights, and device types
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs with ScrollArea for Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="shrink-0 justify-start">
            <TabsTrigger value="collector-load" className="gap-2">
              <Gauge className="size-4" />
              Collector Load
            </TabsTrigger>
            <TabsTrigger value="collection-methods" className="gap-2">
              <Network className="size-4" />
              Collection Methods
            </TabsTrigger>
            <TabsTrigger value="device-types" className="gap-2">
              <Server className="size-4" />
              Device Types
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden pt-4">
            <ScrollArea className="h-full pr-4">
              <TabsContent value="collector-load" className="mt-0">
                <CollectorLoadTab />
              </TabsContent>
              <TabsContent value="collection-methods" className="mt-0">
                <CollectionMethodsTab />
              </TabsContent>
              <TabsContent value="device-types" className="mt-0">
                <DeviceTypesTab />
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Collector Load Tab
// ============================================================================

function CollectorLoadTab() {
  const {
    collectorSizingConfig,
    setMaxLoadPercent,
    setCollectorCapacity,
    setPollingFailover,
    setLogsFailover,
    resetCollectorCapacitiesToDefault,
  } = useEditorStore();

  const { maxLoadPercent, collectorCapacities, pollingFailover, logsFailover } =
    collectorSizingConfig;

  const handleCapacityChange = (
    size: CollectorSize,
    field: 'weight' | 'eps' | 'fps',
    value: string
  ) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setCollectorCapacity(size, field, numValue);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Server className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Collector Load Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Configure capacity settings for different collector sizes
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetCollectorCapacitiesToDefault}
          className="gap-1.5 text-destructive hover:bg-destructive/10"
        >
          <RotateCcw className="size-3.5" />
          Reset to Defaults
        </Button>
      </div>

      {/* Max Load Percentage */}
      <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
        <div className="flex items-center justify-between">
          <Label>Maximum Load Percentage</Label>
          <span className="text-sm font-medium text-foreground">{maxLoadPercent}%</span>
        </div>
        <Slider
          value={[maxLoadPercent]}
          onValueChange={(values) => {
            const val = Array.isArray(values) ? values[0] : values;
            setMaxLoadPercent(val);
          }}
          min={50}
          max={100}
          step={5}
          className="mt-3 w-full"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Target maximum utilization for collectors. Lower values provide more headroom.
        </p>
      </div>

      {/* Failover Settings */}
      <div className="space-y-4 rounded-lg border border-border/50 bg-muted/10 p-4">
        <h4 className="text-sm font-medium text-foreground">Failover Configuration</h4>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="polling-failover">Polling Failover</Label>
            <p className="text-xs text-muted-foreground">
              Add an extra collector for high availability
            </p>
          </div>
          <Switch
            id="polling-failover"
            checked={pollingFailover}
            onCheckedChange={setPollingFailover}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="logs-failover">Logs Failover</Label>
            <p className="text-xs text-muted-foreground">
              Add an extra log collector for high availability
            </p>
          </div>
          <Switch id="logs-failover" checked={logsFailover} onCheckedChange={setLogsFailover} />
        </div>
      </div>

      {/* Collector Capacities */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Collector Capacities by Size</h4>
        {COLLECTOR_SIZES.map((size) => (
          <div
            key={size}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-card/20 p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <Server className="size-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium">{size}</div>
                <div className="text-[10px] text-muted-foreground">Configure capacity values</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor={`${size}-weight`} className="text-[10px]">
                  Polling Load
                </Label>
                <Input
                  id={`${size}-weight`}
                  type="text"
                  inputMode="numeric"
                  value={collectorCapacities[size].weight}
                  onChange={(e) => handleCapacityChange(size, 'weight', e.target.value)}
                  className="h-7 w-24 text-right text-xs"
                />
              </div>
              <div>
                <Label htmlFor={`${size}-eps`} className="text-[10px]">
                  Events/s
                </Label>
                <Input
                  id={`${size}-eps`}
                  type="text"
                  inputMode="numeric"
                  value={collectorCapacities[size].eps}
                  onChange={(e) => handleCapacityChange(size, 'eps', e.target.value)}
                  className="h-7 w-24 text-right text-xs"
                />
              </div>
              <div>
                <Label htmlFor={`${size}-fps`} className="text-[10px]">
                  Flows/s
                </Label>
                <Input
                  id={`${size}-fps`}
                  type="text"
                  inputMode="numeric"
                  value={collectorCapacities[size].fps}
                  onChange={(e) => handleCapacityChange(size, 'fps', e.target.value)}
                  className="h-7 w-24 text-right text-xs"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Collection Methods Tab
// ============================================================================

function CollectionMethodsTab() {
  const {
    collectorSizingConfig,
    setMethodWeight,
    addMethodWeight,
    deleteMethodWeight,
    resetMethodWeightsToDefault,
  } = useEditorStore();

  const { methodWeights } = collectorSizingConfig;

  const [showAddMethod, setShowAddMethod] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodWeight, setNewMethodWeight] = useState(1);

  const handleWeightChange = (method: string, value: number[]) => {
    setMethodWeight(method as keyof MethodWeights, value[0]);
  };

  const handleAddMethod = () => {
    if (!newMethodName.trim()) return;
    addMethodWeight(newMethodName.toUpperCase(), newMethodWeight);
    setNewMethodName('');
    setNewMethodWeight(1);
    setShowAddMethod(false);
  };

  const isDefaultMethod = (method: string): boolean => {
    return DEFAULT_METHOD_KEYS.includes(method);
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Gauge className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Method Weight Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Higher weights indicate more resource usage
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddMethod(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            Add Method
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetMethodWeightsToDefault}
            className="gap-1.5 text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="size-3.5" />
            Reset to Defaults
          </Button>
        </div>
      </div>

      {/* Add Method Form */}
      {showAddMethod && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h4 className="mb-3 text-sm font-medium">Add New Method</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="method-name" className="text-xs">
                Method Name
              </Label>
              <Input
                id="method-name"
                value={newMethodName}
                onChange={(e) => setNewMethodName(e.target.value)}
                placeholder="Enter method name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="method-weight" className="text-xs">
                Weight: {newMethodWeight.toFixed(1)}
              </Label>
              <Slider
                id="method-weight"
                min={0.1}
                max={5}
                step={0.1}
                value={[newMethodWeight]}
                onValueChange={(v) => setNewMethodWeight(Array.isArray(v) ? v[0] : v)}
                className="mt-3"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddMethod(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddMethod} disabled={!newMethodName.trim()}>
              Add Method
            </Button>
          </div>
        </div>
      )}

      {/* Method Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(methodWeights as unknown as Record<string, number>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([method, weight]) => (
            <div
              key={method}
              className="rounded-lg border border-border/50 bg-card/20 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
                    <Gauge className="size-3.5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{method}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Weight: {weight.toFixed(1)}
                    </div>
                  </div>
                </div>
                {!isDefaultMethod(method) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMethodWeight(method)}
                    className="size-7 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <Slider
                min={0.1}
                max={5}
                step={0.1}
                value={[weight]}
                onValueChange={(value) => {
                  const val = Array.isArray(value) ? value[0] : value;
                  handleWeightChange(method, [val]);
                }}
                className="mt-3"
              />
            </div>
          ))}
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-border/50 bg-blue-500/5 p-4">
        <h4 className="mb-2 text-sm font-medium text-blue-600 dark:text-blue-400">
          About Method Weights
        </h4>
        <p className="text-xs text-muted-foreground">
          Method weights represent the relative CPU/resource cost of each polling method. Higher
          weights indicate more resource-intensive methods. Script-based collection typically has
          the highest weight due to the overhead of spawning processes.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Device Types Tab
// ============================================================================

function DeviceTypesTab() {
  const {
    collectorSizingConfig,
    setDeviceDefaultInstances,
    setDeviceDefaultMethod,
    deleteDeviceDefaultMethod,
    addDeviceType,
    resetDeviceDefaultsToDefault,
  } = useEditorStore();

  const { deviceDefaults, methodWeights } = collectorSizingConfig;

  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddMethod, setShowAddMethod] = useState<string | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceIcon, setNewDeviceIcon] = useState('Server');
  const [newDeviceInstances, setNewDeviceInstances] = useState(100);
  const [newDeviceMethods, setNewDeviceMethods] = useState<Record<string, number>>({});
  const [selectedMethod, setSelectedMethod] = useState('');
  const [newMethodWeight, setNewMethodWeight] = useState(0.5);

  const handleAddDevice = () => {
    if (!newDeviceName.trim() || Object.keys(newDeviceMethods).length === 0) return;

    // Normalize methods to sum to 1
    const methodSum = Object.values(newDeviceMethods).reduce((sum, w) => sum + w, 0);
    const normalizedMethods =
      methodSum > 0
        ? Object.fromEntries(
            Object.entries(newDeviceMethods).map(([m, w]) => [m, w / methodSum])
          )
        : newDeviceMethods;

    addDeviceType(newDeviceName, newDeviceIcon, newDeviceInstances, normalizedMethods);
    setNewDeviceName('');
    setNewDeviceIcon('Server');
    setNewDeviceInstances(100);
    setNewDeviceMethods({});
    setShowAddDevice(false);
  };

  const handleAddMethodToDevice = (deviceType: string) => {
    if (!selectedMethod) return;

    const currentMethods = deviceDefaults[deviceType].methods;
    const currentTotal = Object.values(currentMethods).reduce((sum, w) => sum + w, 0);

    // Don't add if it would exceed 1
    if (currentTotal + newMethodWeight > 1) return;

    setDeviceDefaultMethod(deviceType, selectedMethod, newMethodWeight);
    setSelectedMethod('');
    setNewMethodWeight(0.5);
    setShowAddMethod(null);
  };

  const handleAddMethodToNewDevice = () => {
    if (!selectedMethod) return;
    setNewDeviceMethods((prev) => ({
      ...prev,
      [selectedMethod]: newMethodWeight,
    }));
    setSelectedMethod('');
    setNewMethodWeight(0.5);
  };

  const getAvailableMethods = (deviceType: string) => {
    const currentMethods = new Set(Object.keys(deviceDefaults[deviceType]?.methods ?? {}));
    return Object.keys(methodWeights as unknown as Record<string, number>).filter(
      (m) => !currentMethods.has(m)
    );
  };

  const getTotalMethodWeight = (methods: Record<string, number>) => {
    return Object.values(methods).reduce((sum, w) => sum + w, 0);
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Server className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Device Type Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Configure instance counts and collection methods per device type
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDevice(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            Add Device
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetDeviceDefaultsToDefault}
            className="gap-1.5 text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="size-3.5" />
            Reset to Defaults
          </Button>
        </div>
      </div>

      {/* Add Device Form */}
      {showAddDevice && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h4 className="mb-3 text-sm font-medium">Add New Device Type</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="device-name" className="text-xs">
                Device Name
              </Label>
              <Input
                id="device-name"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="Enter device name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="device-icon" className="text-xs">
                Icon
              </Label>
              <Select value={newDeviceIcon} onValueChange={(v) => v && setNewDeviceIcon(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="device-instances" className="text-xs">
                Base Instances
              </Label>
              <Input
                id="device-instances"
                type="text"
                inputMode="numeric"
                value={newDeviceInstances}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (!isNaN(num) && num >= 0) setNewDeviceInstances(num);
                }}
                className="mt-1"
              />
            </div>
          </div>

          {/* Methods for new device */}
          <div className="mt-4">
            <Label className="text-xs">Collection Methods</Label>
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <Select value={selectedMethod} onValueChange={(v) => v && setSelectedMethod(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(methodWeights as unknown as Record<string, number>)
                      .filter((m) => !(m in newDeviceMethods))
                      .map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-[10px]">Weight: {(newMethodWeight * 100).toFixed(0)}%</Label>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[newMethodWeight]}
                  onValueChange={(v) => setNewMethodWeight(Array.isArray(v) ? v[0] : v)}
                />
              </div>
              <Button
                size="sm"
                onClick={handleAddMethodToNewDevice}
                disabled={!selectedMethod || newMethodWeight === 0}
              >
                Add
              </Button>
            </div>

            {/* Display added methods */}
            {Object.keys(newDeviceMethods).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(newDeviceMethods).map(([method, weight]) => (
                  <span
                    key={method}
                    className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
                  >
                    {method}: {(weight * 100).toFixed(0)}%
                    <button
                      onClick={() =>
                        setNewDeviceMethods((prev) => {
                          const copy = { ...prev };
                          delete copy[method];
                          return copy;
                        })
                      }
                      className="ml-1 text-destructive/70 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddDevice(false);
                setNewDeviceName('');
                setNewDeviceIcon('Server');
                setNewDeviceInstances(100);
                setNewDeviceMethods({});
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddDevice}
              disabled={!newDeviceName.trim() || Object.keys(newDeviceMethods).length === 0}
            >
              Add Device Type
            </Button>
          </div>
        </div>
      )}

      {/* Device Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(deviceDefaults)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([deviceType, config]) => {
            const totalWeight = getTotalMethodWeight(config.methods);
            const hasWeightError = Math.abs(totalWeight - 1) > 0.01;

            return (
              <div
                key={deviceType}
                className={cn(
                  'rounded-lg border p-3',
                  hasWeightError
                    ? 'border-yellow-500/50 bg-yellow-500/5'
                    : 'border-border/50 bg-card/20'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {hasWeightError ? (
                      <div className="flex size-7 items-center justify-center rounded-full bg-yellow-500/10">
                        <AlertCircle className="size-3.5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                    ) : (
                      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
                        {config.icon === 'Router' ? (
                          <Router className="size-3.5 text-primary" />
                        ) : (
                          <Server className="size-3.5 text-primary" />
                        )}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium">{deviceType}</div>
                      {hasWeightError && (
                        <div className="text-[10px] text-yellow-600 dark:text-yellow-400">
                          Methods must total 100% ({(totalWeight * 100).toFixed(0)}%)
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddMethod(deviceType)}
                    disabled={
                      showAddMethod === deviceType || getAvailableMethods(deviceType).length === 0
                    }
                    className="h-7 gap-1 text-xs"
                  >
                    <Plus className="size-3" />
                    Method
                  </Button>
                </div>

                {/* Add Method to Device */}
                {showAddMethod === deviceType && (
                  <div className="mt-3 flex items-end gap-2 border-t border-border/30 pt-3">
                    <div className="flex-1">
                      <Select value={selectedMethod} onValueChange={(v) => v && setSelectedMethod(v)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Method" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableMethods(deviceType).map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[newMethodWeight]}
                        onValueChange={(v) => setNewMethodWeight(Array.isArray(v) ? v[0] : v)}
                      />
                    </div>
                    <span className="w-10 text-[10px]">{(newMethodWeight * 100).toFixed(0)}%</span>
                    <Button
                      size="sm"
                      className="h-7"
                      onClick={() => handleAddMethodToDevice(deviceType)}
                      disabled={!selectedMethod}
                    >
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => {
                        setShowAddMethod(null);
                        setSelectedMethod('');
                        setNewMethodWeight(0.5);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Methods List */}
                <div className="mt-3 space-y-2">
                  {Object.entries(config.methods)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([method, weight]) => (
                      <div key={method} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{method}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium">
                                {(weight * 100).toFixed(0)}%
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteDeviceDefaultMethod(deviceType, method)}
                                className="size-5 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="size-2.5" />
                              </Button>
                            </div>
                          </div>
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={[weight]}
                            onValueChange={(v) => {
                              const val = Array.isArray(v) ? v[0] : v;
                              setDeviceDefaultMethod(deviceType, method, val);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>

                {/* Instance Count */}
                <div className="mt-3 border-t border-border/30 pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Base Instances</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={config.instances}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        if (!isNaN(num) && num >= 0) {
                          setDeviceDefaultInstances(deviceType, num);
                        }
                      }}
                      className="h-7 w-20 text-right text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
