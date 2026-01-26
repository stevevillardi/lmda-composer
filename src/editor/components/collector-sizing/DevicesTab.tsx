/**
 * DevicesTab - Grid of device count inputs for a site.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Server, HardDrive, Router, Monitor } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import type { DeviceConfig } from '../../utils/collector-calculations';
import { ResourceCountCard } from './ResourceCountCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface DevicesTabProps {
  siteId: string;
  devices: Record<string, DeviceConfig>;
  showAdvancedDetails?: boolean;
}

// Group devices by category for better organization
const DEVICE_CATEGORIES: Record<string, { icon: typeof Server; devices: string[] }> = {
  Servers: {
    icon: Server,
    devices: [
      'Linux Servers',
      'Windows Servers',
      'SQL Servers',
      'Database Servers (Non-SQL)',
      'Hypervisor Hosts (ESXi, Hyper-V)',
      'iLO/DRAC/BMC Servers',
      'Cisco UCS/FI Servers',
    ],
  },
  Network: {
    icon: Router,
    devices: [
      'Routers',
      'Ethernet Switches',
      'Fibre Channel Switches',
      'Firewalls',
      'Load Balancers',
      'Wireless LAN Controllers',
      'SD-WAN Edges',
      'Access Points',
    ],
  },
  Storage: {
    icon: HardDrive,
    devices: [
      'Nimble Storage Arrays',
      'Netapp Storage Arrays',
      'Pure Storage Arrays',
      'Other Storage Arrays',
    ],
  },
  'Virtual & Other': {
    icon: Monitor,
    devices: ['Virtual Machines (VMs)', 'UPS/PDUs'],
  },
};

export function DevicesTab({ siteId, devices, showAdvancedDetails = false }: DevicesTabProps) {
  const updateDeviceCount = useEditorStore((s) => s.updateDeviceCount);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Calculate total devices
  const totalDevices = Object.values(devices).reduce(
    (sum, d) => sum + d.count,
    0
  );

  // Calculate devices per category
  const getCategoryCount = (category: string) => {
    const deviceNames = DEVICE_CATEGORIES[category]?.devices ?? [];
    return deviceNames.reduce((sum, name) => {
      const device = devices[name];
      return sum + (device?.count ?? 0);
    }, 0);
  };

  return (
    <div className="space-y-3">
      {Object.entries(DEVICE_CATEGORIES).map(([category, { icon: Icon, devices: deviceNames }]) => {
        const isOpen = !collapsedCategories[category];
        const categoryCount = getCategoryCount(category);

        return (
          <Collapsible
            key={category}
            open={isOpen}
            onOpenChange={() => toggleCategory(category)}
            className="overflow-hidden rounded-md border border-border/40 bg-card/20"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50">
              <span className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                <Icon className="size-3.5" />
                {category}
              </span>
              <span
                className={cn(
                  'rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal',
                  categoryCount > 0 && 'bg-primary/10 text-primary'
                )}
              >
                {categoryCount}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/40">
              <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {deviceNames.map((deviceName) => {
                  const device = devices[deviceName];
                  if (!device) return null;

                  return (
                    <ResourceCountCard
                      key={deviceName}
                      name={deviceName}
                      icon={device.icon}
                      count={device.count}
                      onChange={(count) => updateDeviceCount(siteId, deviceName, count)}
                      subtitle={`${device.instances} inst/device`}
                      showAdvancedDetails={showAdvancedDetails}
                      methods={device.methods}
                      instances={device.instances}
                    />
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Summary */}
      <div className="flex items-center justify-between rounded-md border border-border/40 bg-card/20 px-4 py-3">
        <span className="text-sm text-muted-foreground">Total Devices</span>
        <span className="text-lg font-semibold text-foreground">{totalDevices}</span>
      </div>
    </div>
  );
}
