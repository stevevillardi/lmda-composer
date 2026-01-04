import { KeyCode, KeyMod, type editor } from 'monaco-editor';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';

type ShortcutDescriptor = {
  id: string;
  label: string;
  match: (event: KeyboardEvent) => boolean;
  action: () => void;
  monacoKeybinding?: number;
};

const getState = useEditorStore.getState;

const isModKey = (event: KeyboardEvent) => event.metaKey || event.ctrlKey;

const matchesModKey = (event: KeyboardEvent, key: string, shift: boolean | 'any' = 'any') =>
  isModKey(event)
  && (shift === 'any' || event.shiftKey === shift)
  && event.key.toLowerCase() === key;

const matchesModKeyExact = (event: KeyboardEvent, key: string, shift: boolean | 'any' = 'any') =>
  isModKey(event)
  && (shift === 'any' || event.shiftKey === shift)
  && event.key === key;

const runPrimaryAction = () => {
  const {
    activeTabId,
    tabs,
    executeApiRequest,
    executeScript,
    isExecuting,
    selectedPortalId,
    selectedCollectorId,
  } = getState();
  const activeTab = activeTabId ? tabs.find(tab => tab.id === activeTabId) : null;

  if (activeTab?.kind === 'api') {
    executeApiRequest(activeTabId ?? undefined);
    return;
  }

  if (!isExecuting && selectedPortalId && selectedCollectorId) {
    executeScript();
  }
};

const openCommandPalette = () => {
  const { commandPaletteOpen, setCommandPaletteOpen } = getState();
  setCommandPaletteOpen(!commandPaletteOpen);
};

const createNewFileOrApi = () => {
  const { activeTabId, tabs, createNewFile, openApiExplorerTab } = getState();
  const activeTab = activeTabId ? tabs.find(tab => tab.id === activeTabId) : null;

  if (activeTab?.kind === 'api') {
    openApiExplorerTab();
  } else {
    createNewFile();
  }
};

const toggleView = () => {
  const { activeTabId, tabs, setActiveTab, createNewFile, openApiExplorerTab } = getState();
  const activeTab = activeTabId ? tabs.find(tab => tab.id === activeTabId) : null;
  const getLastTabIdByKind = (kind: 'api' | 'script') =>
    [...tabs].reverse().find(tab => (tab.kind ?? 'script') === kind)?.id ?? null;

  if (activeTab?.kind === 'api') {
    const lastScript = getLastTabIdByKind('script');
    if (lastScript) {
      setActiveTab(lastScript);
    } else {
      createNewFile();
    }
    return;
  }

  const lastApi = getLastTabIdByKind('api');
  if (lastApi) {
    setActiveTab(lastApi);
  } else {
    openApiExplorerTab();
  }
};

export const copyOutputToClipboard = async () => {
  const { currentExecution, setCommandPaletteOpen } = getState();
  if (currentExecution?.rawOutput) {
    try {
      await navigator.clipboard.writeText(currentExecution.rawOutput);
      toast.success('Output copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy output', {
        description: 'Could not copy to clipboard',
      });
    }
  }
  setCommandPaletteOpen(false);
};

const saveWithToast = (save: () => Promise<unknown>) => {
  void save()
    .then(() => {
      toast.success('File saved');
    })
    .catch((error) => {
      toast.error('Failed to save file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    });
};

const shortcuts: ShortcutDescriptor[] = [
  {
    id: 'command-palette',
    label: 'Command Palette',
    match: (event) => matchesModKey(event, 'p', true),
    action: openCommandPalette,
    monacoKeybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP,
  },
  {
    id: 'run-primary',
    label: 'Run Script',
    match: (event) => matchesModKeyExact(event, 'Enter'),
    action: runPrimaryAction,
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.Enter,
  },
  {
    id: 'run-primary-f5',
    label: 'Run Script',
    match: (event) => event.key === 'F5',
    action: runPrimaryAction,
    monacoKeybinding: KeyCode.F5,
  },
  {
    id: 'copy-output',
    label: 'Copy Output',
    match: (event) => matchesModKey(event, 'c', true),
    action: () => {
      void copyOutputToClipboard();
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
  },
  {
    id: 'new-file',
    label: 'New File',
    match: (event) => matchesModKey(event, 'k', false),
    action: createNewFileOrApi,
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyK,
  },
  {
    id: 'toggle-view',
    label: 'Toggle View',
    match: (event) => matchesModKey(event, 'm', true),
    action: toggleView,
    monacoKeybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyM,
  },
  {
    id: 'open-file',
    label: 'Open File',
    match: (event) => matchesModKey(event, 'o'),
    action: () => {
      const { openFileFromDisk } = getState();
      openFileFromDisk();
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyO,
  },
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    match: (event) => matchesModKey(event, 'b'),
    action: () => {
      const { toggleRightSidebar } = getState();
      toggleRightSidebar();
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyB,
  },
  {
    id: 'open-settings',
    label: 'Settings',
    match: (event) => matchesModKeyExact(event, ','),
    action: () => {
      const { setSettingsDialogOpen } = getState();
      setSettingsDialogOpen(true);
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.Comma,
  },
  {
    id: 'save-file',
    label: 'Save',
    match: (event) => matchesModKey(event, 's', false),
    action: () => {
      const { saveFile } = getState();
      saveWithToast(saveFile);
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyS,
  },
  {
    id: 'save-file-as',
    label: 'Save As',
    match: (event) => matchesModKey(event, 's', true),
    action: () => {
      const { saveFileAs } = getState();
      saveWithToast(saveFileAs);
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS,
  },
  {
    id: 'refresh-collectors',
    label: 'Refresh Collectors',
    match: (event) => matchesModKey(event, 'r'),
    action: () => {
      const { refreshCollectors, selectedPortalId } = getState();
      if (selectedPortalId) {
        refreshCollectors();
      }
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyR,
  },
  {
    id: 'applies-to-toolbox',
    label: 'AppliesTo Toolbox',
    match: (event) => matchesModKey(event, 'a', true),
    action: () => {
      const { setAppliesToTesterOpen, selectedPortalId } = getState();
      if (selectedPortalId) {
        setAppliesToTesterOpen(true);
      }
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA,
  },
  {
    id: 'debug-commands',
    label: 'Debug Commands',
    match: (event) => matchesModKey(event, 'd', false),
    action: () => {
      const { setDebugCommandsDialogOpen, selectedPortalId } = getState();
      if (selectedPortalId) {
        setDebugCommandsDialogOpen(true);
      }
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyD,
  },
  {
    id: 'export-file',
    label: 'Export File',
    match: (event) => matchesModKey(event, 'e', true),
    action: () => {
      const { exportToFile } = getState();
      exportToFile();
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE,
  },
  {
    id: 'module-search',
    label: 'Search LogicModules',
    match: (event) => matchesModKey(event, 'f', true),
    action: () => {
      const { setModuleSearchOpen, selectedPortalId } = getState();
      if (selectedPortalId) {
        setModuleSearchOpen(true);
      }
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF,
  },
  {
    id: 'module-browser',
    label: 'Import from LMX',
    match: (event) => matchesModKey(event, 'i', true),
    action: () => {
      const { setModuleBrowserOpen, selectedPortalId } = getState();
      if (selectedPortalId) {
        setModuleBrowserOpen(true);
      }
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI,
  },
];

export const handleGlobalKeyDown = (event: KeyboardEvent) => {
  const commandPalette = shortcuts.find(shortcut => shortcut.id === 'command-palette');
  if (commandPalette?.match(event)) {
    event.preventDefault();
    commandPalette.action();
    return;
  }

  const { commandPaletteOpen } = getState();
  if (commandPaletteOpen) {
    return;
  }

  for (const shortcut of shortcuts) {
    if (shortcut.id === 'command-palette') continue;
    if (shortcut.match(event)) {
      event.preventDefault();
      shortcut.action();
      return;
    }
  }
};

const registerActions = (target: editor.IStandaloneCodeEditor) => {
  shortcuts.forEach((shortcut) => {
    if (!shortcut.monacoKeybinding) return;
    target.addAction({
      id: shortcut.id,
      label: shortcut.label,
      keybindings: [shortcut.monacoKeybinding],
      run: () => {
        shortcut.action();
      },
    });
  });
};

export const registerMonacoShortcuts = (
  instance: editor.IStandaloneCodeEditor | editor.IStandaloneDiffEditor
) => {
  if ('getModifiedEditor' in instance) {
    registerActions(instance.getModifiedEditor());
    registerActions(instance.getOriginalEditor());
    return;
  }

  registerActions(instance);
};
