/**
 * SiteConfigPanel - Configuration panel for a single site.
 * Shows tabs for Devices, Logs & NetFlow, and Recommendations.
 */

import { Server, FileText, BarChart3 } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import type { Site } from '../../stores/slices/collector-sizing-slice';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DevicesTab } from './DevicesTab';
import { LogsTab } from './LogsTab';
import { RecommendationsTab } from './RecommendationsTab';
import { cn } from '@/lib/utils';

interface SiteConfigPanelProps {
  site: Site;
  showAdvancedDetails?: boolean;
}

export function SiteConfigPanel({ site, showAdvancedDetails = false }: SiteConfigPanelProps) {
  const { setSiteActiveTab } = useEditorStore();

  return (
    <div className="flex h-full flex-col">
      {/* Site Header */}
      <div className="border-b border-border bg-secondary/30 px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">{site.name}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Configure devices and resources for this site
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={site.activeTab}
        onValueChange={(value) => setSiteActiveTab(site.id, value as typeof site.activeTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b border-border bg-background px-4">
          <TabsList className="h-10 w-full justify-start gap-4 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="devices"
              className={cn(
                'relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-1',
                'data-[state=active]:border-primary data-[state=active]:bg-transparent',
                'data-[state=active]:shadow-none'
              )}
            >
              <Server className="mr-1.5 size-4" />
              <span>Devices</span>
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className={cn(
                'relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-1',
                'data-[state=active]:border-primary data-[state=active]:bg-transparent',
                'data-[state=active]:shadow-none'
              )}
            >
              <FileText className="mr-1.5 size-4" />
              <span>Logs & NetFlow</span>
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              className={cn(
                'relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-1',
                'data-[state=active]:border-primary data-[state=active]:bg-transparent',
                'data-[state=active]:shadow-none'
              )}
            >
              <BarChart3 className="mr-1.5 size-4" />
              <span>Recommendations</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <TabsContent value="devices" className="mt-0 h-full p-4">
            <DevicesTab siteId={site.id} devices={site.devices} showAdvancedDetails={showAdvancedDetails} />
          </TabsContent>
          <TabsContent value="logs" className="mt-0 h-full p-4">
            <LogsTab
              siteId={site.id}
              logs={site.logs}
              traps={site.traps}
              flows={site.flows}
              showAdvancedDetails={showAdvancedDetails}
            />
          </TabsContent>
          <TabsContent value="recommendations" className="mt-0 h-full p-4">
            <RecommendationsTab
              calculationResult={site.calculationResult}
              site={site}
              showAdvancedDetails={showAdvancedDetails}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
