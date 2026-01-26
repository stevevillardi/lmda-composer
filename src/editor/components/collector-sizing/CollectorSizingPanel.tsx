/**
 * CollectorSizingPanel - Main container for the collector sizing calculator.
 * Uses a sidebar layout with site list on left, configuration on right.
 */

import { useEffect, useState } from 'react';
import { Plus, Settings, RotateCcw, Server, BarChart3, MapPin, Eye, EyeOff } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { CollectorSizingWelcome } from './CollectorSizingWelcome';
import { SiteListItem } from './SiteListItem';
import { SiteConfigPanel } from './SiteConfigPanel';
import { OverviewPanel } from './OverviewPanel';
import { SettingsDialog } from './SettingsDialog';
import { ConfirmationDialog } from '../shared/ConfirmationDialog';
import { CollectorSizeSelect } from './CollectorSizeSelect';

type ViewMode = 'configure' | 'overview';

export function CollectorSizingPanel() {
  const {
    sites,
    activeSiteId,
    aggregatedResults,
    collectorSizingSettingsOpen,
    collectorSizingConfig,
    addSite,
    setCollectorSizingSettingsOpen,
    setShowAdvancedDetails,
    resetCollectorSizing,
    loadCollectorSizingState,
  } = useEditorStore();

  const [viewMode, setViewMode] = useState<ViewMode>('configure');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const { showAdvancedDetails } = collectorSizingConfig;

  // Load persisted state on mount
  useEffect(() => {
    loadCollectorSizingState();
  }, [loadCollectorSizingState]);

  const hasSites = sites.length > 0;
  const activeSite = sites.find((s) => s.id === activeSiteId);

  // If no sites, show welcome screen
  if (!hasSites) {
    return (
      <>
        <CollectorSizingWelcome />
        <SettingsDialog
          open={collectorSizingSettingsOpen}
          onOpenChange={setCollectorSizingSettingsOpen}
        />
      </>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header - Toolbar style */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-secondary/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Server className="size-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Collector Sizing Calculator
          </span>
        </div>

        <div className="flex-1" />

        {/* Action buttons - right side */}
        <div className="flex items-center gap-1.5">
          {/* Collector Size Select */}
          <CollectorSizeSelect />

          <Separator orientation="vertical" className="mx-1 h-8 mt-1" />

          {/* Advanced Details Toggle */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={showAdvancedDetails ? 'secondary' : 'toolbar-outline'}
                  size="toolbar"
                  onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                  aria-pressed={showAdvancedDetails}
                >
                  {showAdvancedDetails ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                  <span className="hidden sm:inline">
                    {showAdvancedDetails ? 'Details On' : 'Details Off'}
                  </span>
                </Button>
              }
            />
            <TooltipContent>
              {showAdvancedDetails ? 'Hide advanced details' : 'Show advanced details (instances, methods)'}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-8 mt-1" />

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="toolbar-outline"
                  size="toolbar"
                  onClick={() => setCollectorSizingSettingsOpen(true)}
                >
                  <Settings className="size-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              }
            />
            <TooltipContent>Calculator Settings</TooltipContent>
          </Tooltip>

          {/* Reset */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="toolbar-outline"
                  size="toolbar"
                  onClick={() => setResetDialogOpen(true)}
                >
                  <RotateCcw className="size-4" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
              }
            />
            <TooltipContent>Reset all sites and settings</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        {/* Left Sidebar - Site List */}
        <div className="flex w-64 shrink-0 flex-col border-r border-border bg-muted/5">
          {/* View Toggle & Add Site */}
          <div className="flex items-center justify-between border-b border-border bg-background px-3 py-2">
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === 'configure' ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setViewMode('configure')}
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <MapPin className="size-3.5" />
                Sites
              </Button>
              <Button
                variant={viewMode === 'overview' ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setViewMode('overview')}
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <BarChart3 className="size-3.5" />
                Overview
              </Button>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => addSite()}
                    className="size-7"
                  >
                    <Plus className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>Add Site</TooltipContent>
            </Tooltip>
          </div>

          {/* Site List */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-0.5 p-2">
              {sites.map((site) => (
                <SiteListItem
                  key={site.id}
                  site={site}
                  isActive={site.id === activeSiteId}
                />
              ))}
            </div>
          </div>

          {/* Footer Stats */}
          <div className="border-t border-border bg-background px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{sites.length} site{sites.length !== 1 ? 's' : ''}</span>
              {aggregatedResults?.polling && (
                <span className="flex items-center gap-1">
                  <Server className="size-3" />
                  {aggregatedResults.polling.count} collectors
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex min-w-0 flex-1 flex-col bg-background/50">
          {viewMode === 'overview' ? (
            <OverviewPanel
              sites={sites}
              aggregatedResults={aggregatedResults}
              showAdvancedDetails={showAdvancedDetails}
            />
          ) : activeSite ? (
            <SiteConfigPanel site={activeSite} showAdvancedDetails={showAdvancedDetails} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="flex w-full max-w-sm flex-col items-center rounded-lg border-2 border-dashed border-border/60 bg-muted/5 px-8 py-10">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
                  <MapPin className="size-6 text-muted-foreground/60" />
                </div>
                <h3 className="mt-4 text-sm font-medium text-foreground">Select a Site</h3>
                <p className="mt-1.5 text-center text-xs text-muted-foreground">
                  Choose a site from the list to configure devices and view recommendations.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={collectorSizingSettingsOpen}
        onOpenChange={setCollectorSizingSettingsOpen}
      />

      {/* Reset Confirmation Dialog */}
      <ConfirmationDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset Calculator?"
        description="This will delete all sites and reset all settings to defaults. This action cannot be undone."
        confirmLabel="Reset Everything"
        cancelLabel="Cancel"
        onConfirm={resetCollectorSizing}
        variant="destructive"
        icon={RotateCcw}
      />
    </div>
  );
}
