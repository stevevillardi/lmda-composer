/**
 * LogsTab - Log sources, SNMP traps, and NetFlow configuration for a site.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Radio, Activity } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import type { LogConfig, TrapConfig, FlowConfig } from '../../utils/collector-calculations';
import { ResourceCountCard } from './ResourceCountCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface LogsTabProps {
  siteId: string;
  logs: Record<string, LogConfig>;
  traps: Record<string, TrapConfig>;
  flows: Record<string, FlowConfig>;
  showAdvancedDetails?: boolean;
}

export function LogsTab({ siteId, logs, traps, flows, showAdvancedDetails: _showAdvancedDetails = false }: LogsTabProps) {
  // Note: showAdvancedDetails is accepted for API consistency but logs/traps/flows
  // don't have method breakdowns like devices do
  void _showAdvancedDetails;
  const { updateLogCount, updateTrapCount, updateFlowCount } = useEditorStore();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Calculate totals
  const totalLogDevices = Object.values(logs).reduce((sum, l) => sum + l.count, 0);
  const totalTrapDevices = Object.values(traps).reduce((sum, t) => sum + t.count, 0);
  const totalFlowDevices = Object.values(flows).reduce((sum, f) => sum + f.count, 0);

  const totalEPS =
    Object.values(logs).reduce((sum, l) => sum + l.count * l.eps, 0) +
    Object.values(traps).reduce((sum, t) => sum + t.count * t.eps, 0);
  const totalFPS = Object.values(flows).reduce((sum, f) => sum + f.count * f.fps, 0);

  return (
    <div className="space-y-3">
      {/* System Logs */}
      <Collapsible
        open={!collapsedSections.logs}
        onOpenChange={() => toggleSection('logs')}
        className="overflow-hidden rounded-md border border-border/40 bg-card/20"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50">
          <span className="flex items-center gap-2">
            {!collapsedSections.logs ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <FileText className="size-3.5" />
            System Logs
          </span>
          <span
            className={cn(
              'rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal',
              totalLogDevices > 0 && 'bg-primary/10 text-primary'
            )}
          >
            {totalLogDevices} devices
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/40">
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(logs).map(([logType, log]) => (
              <ResourceCountCard
                key={logType}
                name={log.name}
                icon={log.icon}
                count={log.count}
                onChange={(count) => updateLogCount(siteId, logType, count)}
                subtitle={`${log.eps} EPS/device`}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* SNMP Traps */}
      <Collapsible
        open={!collapsedSections.traps}
        onOpenChange={() => toggleSection('traps')}
        className="overflow-hidden rounded-md border border-border/40 bg-card/20"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50">
          <span className="flex items-center gap-2">
            {!collapsedSections.traps ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <Radio className="size-3.5" />
            SNMP Traps
          </span>
          <span
            className={cn(
              'rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal',
              totalTrapDevices > 0 && 'bg-primary/10 text-primary'
            )}
          >
            {totalTrapDevices} devices
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/40">
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(traps).map(([trapType, trap]) => (
              <ResourceCountCard
                key={trapType}
                name={trap.name}
                icon={trap.icon}
                count={trap.count}
                onChange={(count) => updateTrapCount(siteId, trapType, count)}
                subtitle={`${trap.eps} EPS/device`}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* NetFlow */}
      <Collapsible
        open={!collapsedSections.flows}
        onOpenChange={() => toggleSection('flows')}
        className="overflow-hidden rounded-md border border-border/40 bg-card/20"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50">
          <span className="flex items-center gap-2">
            {!collapsedSections.flows ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <Activity className="size-3.5" />
            NetFlow
          </span>
          <span
            className={cn(
              'rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal',
              totalFlowDevices > 0 && 'bg-primary/10 text-primary'
            )}
          >
            {totalFlowDevices} devices
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/40">
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(flows).map(([flowType, flow]) => (
              <ResourceCountCard
                key={flowType}
                name={flow.name}
                icon={flow.icon}
                count={flow.count}
                onChange={(count) => updateFlowCount(siteId, flowType, count)}
                subtitle={`${flow.fps.toLocaleString()} FPS/device`}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border border-border/40 bg-card/20 px-4 py-3">
          <span className="text-sm text-muted-foreground">Total EPS (Logs + Traps)</span>
          <span className="text-lg font-semibold text-foreground">{totalEPS.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/40 bg-card/20 px-4 py-3">
          <span className="text-sm text-muted-foreground">Total FPS (NetFlow)</span>
          <span className="text-lg font-semibold text-foreground">{totalFPS.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
