import { useEffect } from 'react';
import {
  Play,
  Copy,
  Trash2,
  RefreshCw,
  Globe,
  Settings,
  History,
  Download,
  Save,
  FileUp,
  FilePlus,
  PanelRight,
  CloudDownload,
  FolderSearch,
  Hammer,
  Terminal,
  Braces,
  Send,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { copyOutputToClipboard, handleGlobalKeyDown } from '../utils/keyboard-shortcuts';
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
    executeApiRequest,
    isExecutingApi,
    currentExecution,
    clearOutput,
    refreshPortals,
    refreshCollectors,
    selectedPortalId,
    selectedCollectorId,
    setModuleBrowserOpen,
    setModuleSearchOpen,
    setSettingsDialogOpen,
    setAppliesToTesterOpen,
    setDebugCommandsDialogOpen,
    tabs,
    activeTabId,
    setRightSidebarOpen,
    setRightSidebarTab,
    portals,
    setSelectedPortal,
    toggleRightSidebar,
    exportToFile,
    saveFile,
    saveFileAs,
    openFileFromDisk,
    createNewFile,
    openApiExplorerTab,
  } = useEditorStore();

  // Define command groups
  const scriptCommands: CommandAction[] = [
    {
      id: 'new-file',
      label: 'New File',
      icon: <FilePlus className="size-4" />,
      shortcut: '⌘K',
      action: () => {
        setCommandPaletteOpen(false);
        createNewFile();
      },
    },
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
      id: 'save-file',
      label: 'Save',
      icon: <Save className="size-4" />,
      shortcut: '⌘S',
      action: () => {
        setCommandPaletteOpen(false);
        saveFile();
      },
    },
    {
      id: 'save-file-as',
      label: 'Save As...',
      icon: <Download className="size-4" />,
      shortcut: '⌘⇧S',
      action: () => {
        setCommandPaletteOpen(false);
        saveFileAs();
      },
    },
    {
      id: 'open-file',
      label: 'Open File...',
      icon: <FileUp className="size-4" />,
      shortcut: '⌘O',
      action: () => {
        setCommandPaletteOpen(false);
        openFileFromDisk();
      },
    },
    {
      id: 'export-file',
      label: 'Export (Download)',
      icon: <Download className="size-4" />,
      shortcut: '⌘⇧E',
      action: () => {
        setCommandPaletteOpen(false);
        exportToFile();
      },
    },
  ];

  const apiCommands: CommandAction[] = [
    {
      id: 'new-api-request',
      label: 'New API Request',
      icon: <Braces className="size-4" />,
      shortcut: '⌘K',
      action: () => {
        setCommandPaletteOpen(false);
        openApiExplorerTab();
      },
    },
    {
      id: 'send-api-request',
      label: 'Send API Request',
      icon: <Send className="size-4" />,
      shortcut: '⌘↵',
      action: () => {
        setCommandPaletteOpen(false);
        executeApiRequest(activeTabId ?? undefined);
      },
      disabled: !selectedPortalId || !activeTabId || !tabs.find(t => t.id === activeTabId)?.api?.request.path.trim() || isExecutingApi,
    },
  ];

  const outputCommands: CommandAction[] = [
    {
      id: 'copy-output',
      label: 'Copy Output',
      icon: <Copy className="size-4" />,
      shortcut: '⌘⇧C',
      action: () => {
        void copyOutputToClipboard();
      },
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
      label: 'Import from LMX',
      icon: <CloudDownload className="size-4" />,
      shortcut: '⌘⇧I',
      action: () => {
        setCommandPaletteOpen(false);
        setModuleBrowserOpen(true);
      },
      disabled: !selectedPortalId,
    },
    {
      id: 'module-search',
      label: 'Search LogicModules',
      icon: <FolderSearch className="size-4" />,
      shortcut: '⌘⇧F',
      action: () => {
        setCommandPaletteOpen(false);
        setModuleSearchOpen(true);
      },
      disabled: !selectedPortalId,
    },
    {
      id: 'applies-to-tester',
      label: 'AppliesTo Toolbox',
      icon: <Hammer className="size-4" />,
      shortcut: '⌘⇧A',
      action: () => {
        setCommandPaletteOpen(false);
        setAppliesToTesterOpen(true);
      },
      disabled: !selectedPortalId,
    },
    {
      id: 'debug-commands',
      label: 'Debug Commands',
      icon: <Terminal className="size-4" />,
      shortcut: '⌘D',
      action: () => {
        setCommandPaletteOpen(false);
        setDebugCommandsDialogOpen(true);
      },
      disabled: !selectedPortalId,
    },
    {
      id: 'execution-history',
      label: 'Execution History',
      icon: <History className="size-4" />,
      action: () => {
        setCommandPaletteOpen(false);
        setRightSidebarOpen(true);
        setRightSidebarTab('history');
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
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, []);

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

          <CommandGroup heading="API Explorer">
            {apiCommands.map((cmd) => (
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
