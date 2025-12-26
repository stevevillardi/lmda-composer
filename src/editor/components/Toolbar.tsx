import { useState } from 'react';
import { 
  Play, 
  RefreshCw, 
  Settings, 
  Circle, 
  AlertTriangle,
  Terminal,
  Activity,
  Database,
  type LucideIcon,
  Target,
  FolderOpen,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { ScriptLanguage, ScriptMode } from '@/shared/types';

interface ModeItem {
  value: ScriptMode;
  label: string;
  icon: LucideIcon;
}

const MODE_ITEMS: ModeItem[] = [
  { value: 'freeform', label: 'Freeform', icon: Terminal },
  { value: 'ad', label: 'Active Discovery', icon: Target },
  { value: 'collection', label: 'Collection', icon: Activity },
  { value: 'batchcollection', label: 'Batch Collection', icon: Database },
];

export function Toolbar() {
  const {
    portals,
    selectedPortalId,
    setSelectedPortal,
    collectors,
    selectedCollectorId,
    setSelectedCollector,
    hostname,
    setHostname,
    language,
    setLanguage,
    mode,
    setMode,
    isExecuting,
    executeScript,
    refreshPortals,
    isDirty,
    setModuleBrowserOpen,
  } = useEditorStore();

  // State for language switch confirmation dialog
  const [pendingLanguage, setPendingLanguage] = useState<ScriptLanguage | null>(null);

  // Handle language toggle click
  const handleLanguageClick = (newLanguage: ScriptLanguage) => {
    if (newLanguage === language) return;
    
    if (isDirty) {
      // Show confirmation dialog
      setPendingLanguage(newLanguage);
    } else {
      // No unsaved changes, switch directly
      setLanguage(newLanguage);
    }
  };

  // Confirm language switch
  const confirmLanguageSwitch = () => {
    if (pendingLanguage) {
      setLanguage(pendingLanguage, true); // Force reset to template
      setPendingLanguage(null);
    }
  };

  // Cancel language switch
  const cancelLanguageSwitch = () => {
    setPendingLanguage(null);
  };

  // Get selected entities for display
  const selectedPortal = portals.find(p => p.id === selectedPortalId);
  const selectedCollector = collectors.find(c => c.id === selectedCollectorId);

  // Build items arrays for Select with { value, label } format
  // Include placeholder as first item with null value
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

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-b border-border">
      {/* Context Group: Portal, Collector, Host */}
      <div className="flex items-center gap-2">
        {/* Portal Selector */}
        <Select 
          value={selectedPortalId} 
          onValueChange={(value) => setSelectedPortal(value || null)}
          items={portalItems}
        >
          <SelectTrigger className="w-[300px] h-8">
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

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={refreshPortals}
                aria-label="Refresh portals"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Refresh portals</TooltipContent>
        </Tooltip>

        {/* Collector Selector */}
        <Select 
          value={selectedCollectorId?.toString() ?? null} 
          onValueChange={(value) => setSelectedCollector(value ? parseInt(value) : null)}
          disabled={!selectedPortalId || collectors.length === 0}
          items={collectorItems}
        >
          <SelectTrigger className="w-[300px] h-8">
            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
              {selectedCollector && (
                <Circle
                  className={cn(
                    'size-2 shrink-0',
                    selectedCollector.isDown 
                      ? 'fill-red-500 text-red-500' 
                      : 'fill-green-500 text-green-500'
                  )}
                />
              )}
              <SelectValue className="truncate" />
            </div>
          </SelectTrigger>
          <SelectContent align="start">
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
                  <div className="flex items-center gap-2">
                    <Circle
                      className={cn(
                        'size-2 shrink-0',
                        collector.isDown 
                          ? 'fill-red-500 text-red-500' 
                          : 'fill-green-500 text-green-500'
                      )}
                    />
                    <span className="font-medium">{collector.description || collector.hostname}</span>
                    <span className="text-muted-foreground text-xs">#{collector.id}</span>
                    {collector.collectorGroupName && (
                      <span className="text-muted-foreground text-xs">
                        ({collector.collectorGroupName})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {/* Hostname Input */}
        <Input
          type="text"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="Enter system.hostname..."
          className="w-[300px] h-8"
        />
      </div>

      <Separator orientation="vertical" className="h-8 mx-1" />

      {/* Script Config Group */}
      <div className="flex items-center gap-2">
        {/* Language Toggle */}
        <div className="flex items-center rounded-md border border-input bg-background/50 p-0.5 gap-0.5">
          <Button
            variant={language === 'groovy' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleLanguageClick('groovy')}
            className={cn(
              "h-7 px-3 text-xs font-medium",
              language === 'groovy' && "shadow-sm"
            )}
          >
            Groovy
          </Button>
          <Button
            variant={language === 'powershell' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleLanguageClick('powershell')}
            className={cn(
              "h-7 px-3 text-xs font-medium",
              language === 'powershell' && "shadow-sm"
            )}
          >
            PowerShell
          </Button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Execution Mode:
          </Label>
          <Select 
            value={mode} 
            onValueChange={(value) => setMode(value as typeof mode)}
            items={MODE_ITEMS}
          >
            <SelectTrigger className="w-[180px] h-8">
              <div className="flex items-center gap-2">
                {(() => {
                  const selectedMode = MODE_ITEMS.find(m => m.value === mode);
                  const Icon = selectedMode?.icon;
                  return Icon ? <Icon className="size-4 shrink-0" /> : null;
                })()}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent align="start">
              {MODE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SelectItem key={item.value} value={item.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1" />

      {/* Action Group */}
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModuleBrowserOpen(true)}
                disabled={!selectedPortalId}
                className="gap-1.5 h-8"
                aria-label="Open from LogicModule"
              >
                <FolderOpen className="size-3.5" />
                <span className="hidden sm:inline">Open from LMX</span>
              </Button>
            }
          />
          <TooltipContent>
            {selectedPortalId 
              ? 'Browse and load scripts from LogicModules' 
              : 'Select a portal to browse LogicModules'}
          </TooltipContent>
        </Tooltip>

        <Button
          onClick={executeScript}
          disabled={isExecuting || !selectedPortalId || !selectedCollectorId}
          size="sm"
          className={cn(
            "gap-1.5 h-8 px-4 font-medium",
            "bg-green-600 hover:bg-green-500 text-white",
            "disabled:bg-green-600/50 disabled:text-white/70"
          )}
        >
          <Play className="size-3.5" />
          {isExecuting ? 'Running...' : 'Run'}
        </Button>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button 
                variant="ghost" 
                size="icon-sm"
                aria-label="Settings"
              >
                <Settings className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>

      {/* Language Switch Confirmation Dialog */}
      <AlertDialog open={pendingLanguage !== null} onOpenChange={(open) => !open && cancelLanguageSwitch()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-500/10">
              <AlertTriangle className="size-8 text-amber-500" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Switch to {pendingLanguage === 'groovy' ? 'Groovy' : 'PowerShell'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in your script. Switching languages will reset 
              the editor to the default {pendingLanguage === 'groovy' ? 'Groovy' : 'PowerShell'} template 
              and your current changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLanguageSwitch}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmLanguageSwitch}
              className="bg-amber-600 hover:bg-amber-500"
            >
              Switch & Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
