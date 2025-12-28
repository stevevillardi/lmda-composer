import { useState, useMemo } from 'react';
import { 
  Play, 
  AlertTriangle,
  Terminal,
  Activity,
  Database,
  type LucideIcon,
  Target,
  Loader2,
  StopCircle,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
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
import { SIZES } from '../constants/sizes';
import type { ScriptLanguage, ScriptMode } from '@/shared/types';
import { ContextDropdown } from './ContextDropdown';
import { ActionsDropdown } from './ActionsDropdown';

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
    selectedPortalId,
    selectedCollectorId,
    tabs,
    activeTabId,
    setLanguage,
    setMode,
    isExecuting,
    executeScript,
    // Right sidebar
    rightSidebarOpen,
    setRightSidebarOpen,
    // Cancel execution
    cancelDialogOpen,
    setCancelDialogOpen,
    cancelExecution,
  } = useEditorStore();

  // Get active tab data
  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const language = activeTab?.language ?? 'groovy';
  const mode = activeTab?.mode ?? 'freeform';
  
  // Check if content has been modified from default templates
  const isModified = useMemo(() => {
    if (!activeTab) return false;
    const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
    const content = normalize(activeTab.content);
    // Import the default templates for comparison
    const DEFAULT_GROOVY = normalize(`import com.santaba.agent.groovyapi.expect.Expect;
import com.santaba.agent.groovyapi.snmp.Snmp;
import com.santaba.agent.groovyapi.http.*;
import com.santaba.agent.groovyapi.jmx.*;

def hostname = hostProps.get("system.hostname");

// Your script here

return 0;
`);
    const DEFAULT_PS = normalize(`# LogicMonitor PowerShell Script
# Use ##PROPERTY.NAME## tokens for device properties (e.g., ##SYSTEM.HOSTNAME##)

$hostname = "##SYSTEM.HOSTNAME##"

# Your script here

Exit 0
`);
    return content !== DEFAULT_GROOVY && content !== DEFAULT_PS;
  }, [activeTab]);

  // State for language switch confirmation dialog
  const [pendingLanguage, setPendingLanguage] = useState<ScriptLanguage | null>(null);

  // Handle language toggle click
  const handleLanguageClick = (newLanguage: ScriptLanguage) => {
    if (newLanguage === language) return;
    
    if (isModified) {
      // Show confirmation dialog if content has been modified
      setPendingLanguage(newLanguage);
    } else {
      // Default content, switch directly
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

  // Check if we can execute
  const canExecute = selectedPortalId && selectedCollectorId && !isExecuting;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-b border-border">
      {/* Context Dropdown (Portal/Collector/Device) */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block">
          Context:
        </Label>
        <ContextDropdown />
      </div>

      <Separator orientation="vertical" className="h-8 mx-1" />

      {/* Script Config Group */}
      <div className="flex items-center gap-2">
        {/* Language Toggle */}
        <Label className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block">
          Language:
        </Label>
        <div 
          className="flex items-center rounded-md border border-input bg-background/50 p-0.5 gap-0.5"
          role="group"
          aria-label="Script language selector"
        >
          <Button
            variant={language === 'groovy' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleLanguageClick('groovy')}
            disabled={tabs.length === 0}
            className={cn(
              SIZES.BUTTON_SIDEBAR,
              "px-3 text-xs font-medium",
              language === 'groovy' && "shadow-sm"
            )}
            aria-pressed={language === 'groovy'}
            aria-label="Groovy language"
          >
            Groovy
          </Button>
          <Button
            variant={language === 'powershell' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleLanguageClick('powershell')}
            disabled={tabs.length === 0}
            className={cn(
              SIZES.BUTTON_SIDEBAR,
              "px-3 text-xs font-medium",
              language === 'powershell' && "shadow-sm"
            )}
            aria-pressed={language === 'powershell'}
            aria-label="PowerShell language"
          >
            PowerShell
          </Button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap hidden lg:block">
            Mode:
          </Label>
          <Select 
            value={mode} 
            onValueChange={(value) => setMode(value as ScriptMode)}
            items={MODE_ITEMS}
            disabled={tabs.length === 0}
          >
            <SelectTrigger className="w-[180px] h-8" disabled={tabs.length === 0} aria-label="Script execution mode">
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
        {/* Actions Dropdown */}
        <ActionsDropdown />

        {/* Run Button */}
        <Button
          onClick={executeScript}
          disabled={!canExecute}
          size="sm"
          className={cn(
            "gap-1.5",
            SIZES.BUTTON_TOOLBAR,
            "px-4 font-medium",
            "bg-green-600 hover:bg-green-500 text-white",
            "disabled:bg-green-600/50 disabled:text-white/70"
          )}
          aria-label={isExecuting ? 'Running script' : 'Run script'}
        >
          {isExecuting ? (
            <Loader2 className={SIZES.ICON_MEDIUM} animate-spin />
          ) : (
            <Play className={SIZES.ICON_MEDIUM} />
          )}
          {isExecuting ? 'Running...' : 'Run'}
        </Button>

        {/* Cancel button - only visible when executing */}
        {isExecuting && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCancelDialogOpen(true)}
                  className={cn("gap-1.5", SIZES.BUTTON_TOOLBAR)}
                  aria-label="Cancel script execution"
                >
                  <StopCircle className={SIZES.ICON_MEDIUM} />
                  Cancel
                </Button>
              }
            />
            <TooltipContent>Cancel script execution</TooltipContent>
          </Tooltip>
        )}

        <Separator orientation="vertical" className="h-8 mx-1" aria-hidden="true" />

        {/* Right Sidebar Toggle */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={rightSidebarOpen ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => {
                  setRightSidebarOpen(!rightSidebarOpen);
                  toast.info(rightSidebarOpen ? 'Sidebar closed' : 'Sidebar opened');
                }}
                disabled={tabs.length === 0}
                aria-label={rightSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                aria-pressed={rightSidebarOpen}
              >
                {rightSidebarOpen ? (
                  <PanelRightClose className={SIZES.ICON_MEDIUM} />
                ) : (
                  <PanelRightOpen className={SIZES.ICON_MEDIUM} />
                )}
              </Button>
            }
          />
          <TooltipContent>
            {tabs.length === 0 
              ? 'Open a file to access sidebar' 
              : rightSidebarOpen 
                ? 'Close sidebar' 
                : 'Open sidebar (Properties & Snippets)'}
          </TooltipContent>
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

      {/* Cancel Execution Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <StopCircle className="size-8 text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Cancel Script Execution?</AlertDialogTitle>
            <AlertDialogDescription>
              The script is currently running. Cancelling will stop the execution 
              immediately. Any partial results will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Continue Running
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={cancelExecution}
              className="bg-destructive hover:bg-destructive/90"
            >
              Cancel Execution
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
