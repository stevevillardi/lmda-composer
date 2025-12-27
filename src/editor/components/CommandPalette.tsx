import { useEffect, useCallback } from 'react';
import {
  Play,
  Copy,
  Trash2,
  RefreshCw,
  Globe,
  FolderOpen,
  Settings,
  History,
  Download,
  PanelRight,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

interface CommandAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    executeScript,
    isExecuting,
    currentExecution,
    clearOutput,
    refreshPortals,
    refreshCollectors,
    selectedPortalId,
    selectedCollectorId,
    setModuleBrowserOpen,
    setSettingsDialogOpen,
    setExecutionHistoryOpen,
    portals,
    setSelectedPortal,
    toggleRightSidebar,
    exportToFile,
  } = useEditorStore();

  // Copy output to clipboard
  const copyOutput = useCallback(() => {
    if (currentExecution?.rawOutput) {
      navigator.clipboard.writeText(currentExecution.rawOutput);
    }
    setCommandPaletteOpen(false);
  }, [currentExecution, setCommandPaletteOpen]);

  // Define command groups
  const scriptCommands: CommandAction[] = [
    {
      id: 'run-script',
      label: 'Run Script',
      icon: <Play className="size-4" />,
      shortcut: '⌘↵',
      action: () => {
        setCommandPaletteOpen(false);
        executeScript();
      },
      disabled: isExecuting || !selectedPortalId || !selectedCollectorId,
    },
    {
      id: 'export-file',
      label: 'Export to File',
      icon: <Download className="size-4" />,
      shortcut: '⌘S',
      action: () => {
        setCommandPaletteOpen(false);
        exportToFile();
      },
    },
  ];

  const outputCommands: CommandAction[] = [
    {
      id: 'copy-output',
      label: 'Copy Output',
      icon: <Copy className="size-4" />,
      shortcut: '⌘⇧C',
      action: copyOutput,
      disabled: !currentExecution?.rawOutput,
    },
    {
      id: 'clear-output',
      label: 'Clear Output',
      icon: <Trash2 className="size-4" />,
      action: () => {
        clearOutput();
        setCommandPaletteOpen(false);
      },
      disabled: !currentExecution,
    },
  ];

  const navigationCommands: CommandAction[] = [
    {
      id: 'open-module-browser',
      label: 'Open from LogicModule',
      icon: <FolderOpen className="size-4" />,
      shortcut: '⌘O',
      action: () => {
        setCommandPaletteOpen(false);
        setModuleBrowserOpen(true);
      },
      disabled: !selectedPortalId,
    },
    {
      id: 'execution-history',
      label: 'Execution History',
      icon: <History className="size-4" />,
      action: () => {
        setCommandPaletteOpen(false);
        setExecutionHistoryOpen(true);
      },
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      icon: <PanelRight className="size-4" />,
      shortcut: '⌘B',
      action: () => {
        setCommandPaletteOpen(false);
        toggleRightSidebar();
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="size-4" />,
      shortcut: '⌘,',
      action: () => {
        setCommandPaletteOpen(false);
        setSettingsDialogOpen(true);
      },
    },
  ];

  const refreshCommands: CommandAction[] = [
    {
      id: 'refresh-portals',
      label: 'Refresh Portals',
      icon: <RefreshCw className="size-4" />,
      action: () => {
        refreshPortals();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'refresh-collectors',
      label: 'Refresh Collectors',
      icon: <RefreshCw className="size-4" />,
      shortcut: '⌘R',
      action: () => {
        refreshCollectors();
        setCommandPaletteOpen(false);
      },
      disabled: !selectedPortalId,
    },
  ];

  // Portal switch commands
  const portalCommands: CommandAction[] = portals
    .filter(p => p.id !== selectedPortalId)
    .map(portal => ({
      id: `switch-portal-${portal.id}`,
      label: `Switch to ${portal.hostname}`,
      icon: <Globe className="size-4" />,
      action: () => {
        setSelectedPortal(portal.id);
        setCommandPaletteOpen(false);
      },
    }));

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
        return;
      }

      // Skip shortcuts when palette is open (it handles its own)
      if (commandPaletteOpen) return;

      // Cmd/Ctrl + Enter or F5 to run
      if (((e.metaKey || e.ctrlKey) && e.key === 'Enter') || e.key === 'F5') {
        e.preventDefault();
        if (!isExecuting && selectedPortalId && selectedCollectorId) {
          executeScript();
        }
        return;
      }

      // Cmd/Ctrl + Shift + C to copy output
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        if (currentExecution?.rawOutput) {
          navigator.clipboard.writeText(currentExecution.rawOutput);
        }
        return;
      }

      // Cmd/Ctrl + O to open module browser
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        if (selectedPortalId) {
          setModuleBrowserOpen(true);
        }
        return;
      }

      // Cmd/Ctrl + B to toggle right sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleRightSidebar();
        return;
      }

      // Cmd/Ctrl + , to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsDialogOpen(true);
        return;
      }

      // Cmd/Ctrl + S to export file
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        exportToFile();
        return;
      }

      // Cmd/Ctrl + R to refresh collectors
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        if (selectedPortalId) {
          refreshCollectors();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commandPaletteOpen,
    setCommandPaletteOpen,
    executeScript,
    isExecuting,
    selectedPortalId,
    selectedCollectorId,
    currentExecution,
    setModuleBrowserOpen,
    setSettingsDialogOpen,
    exportToFile,
    refreshCollectors,
    toggleRightSidebar,
  ]);

  return (
    <CommandDialog 
      open={commandPaletteOpen} 
      onOpenChange={setCommandPaletteOpen}
      title="Command Palette"
      description="Search for commands and actions"
    >
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          <CommandGroup heading="Script">
            {scriptCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={cmd.action}
                disabled={cmd.disabled}
              >
                {cmd.icon}
                <span>{cmd.label}</span>
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Output">
            {outputCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={cmd.action}
                disabled={cmd.disabled}
              >
                {cmd.icon}
                <span>{cmd.label}</span>
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigation">
            {navigationCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={cmd.action}
                disabled={cmd.disabled}
              >
                {cmd.icon}
                <span>{cmd.label}</span>
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Refresh">
            {refreshCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={cmd.action}
                disabled={cmd.disabled}
              >
                {cmd.icon}
                <span>{cmd.label}</span>
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          {portalCommands.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Switch Portal">
                {portalCommands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={cmd.action}
                  >
                    {cmd.icon}
                    <span>{cmd.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

