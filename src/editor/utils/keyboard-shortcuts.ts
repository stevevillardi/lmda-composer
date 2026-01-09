import { KeyCode, KeyMod, type editor } from 'monaco-editor';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';

// ============================================================================
// Types
// ============================================================================

interface SingleShortcut {
  id: string;
  label: string;
  match: (event: KeyboardEvent) => boolean;
  action: () => void;
  monacoKeybinding?: number;
}

interface ChordShortcut {
  id: string;
  label: string;
  followKey: string;
  followShift?: boolean;
  action: () => void;
  monacoKeybinding?: number;
}

// ============================================================================
// State
// ============================================================================

const getState = useEditorStore.getState;

// Chord state management
let pendingChord = false;
let chordTimeout: ReturnType<typeof setTimeout> | null = null;
const CHORD_TIMEOUT_MS = 1500;

// ============================================================================
// Helpers
// ============================================================================

const isModKey = (event: KeyboardEvent) => event.metaKey || event.ctrlKey;

const matchesModKey = (event: KeyboardEvent, key: string, shift: boolean | 'any' = 'any') =>
  isModKey(event)
  && (shift === 'any' || event.shiftKey === shift)
  && event.key.toLowerCase() === key;

const matchesModKeyExact = (event: KeyboardEvent, key: string, shift: boolean | 'any' = 'any') =>
  isModKey(event)
  && (shift === 'any' || event.shiftKey === shift)
  && event.key === key;

// ============================================================================
// Actions
// ============================================================================

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
  const { activeTabId, tabs, activeWorkspace, createNewFile, openApiExplorerTab } = getState();
  const activeTab = activeTabId ? tabs.find(tab => tab.id === activeTabId) : null;

  // Use active tab kind if available, otherwise use workspace state
  const isApiMode = activeTab ? activeTab.kind === 'api' : activeWorkspace === 'api';

  if (isApiMode) {
    openApiExplorerTab();
  } else {
    createNewFile();
  }
};

const toggleView = () => {
  const { activeTabId, tabs, activeWorkspace, setActiveTab, setActiveWorkspace } = getState();
  const activeTab = activeTabId ? tabs.find(tab => tab.id === activeTabId) : null;
  const getLastTabIdByKind = (kind: 'api' | 'script') =>
    [...tabs].reverse().find(tab => (tab.kind ?? 'script') === kind)?.id ?? null;

  // Determine current workspace from active tab or workspace state
  const currentWorkspace = activeTab?.kind === 'api' ? 'api' : activeWorkspace;

  if (currentWorkspace === 'api') {
    // Switch to script workspace
    setActiveWorkspace('script');
    const lastScript = getLastTabIdByKind('script');
    if (lastScript) {
      setActiveTab(lastScript);
    }
    // If no script tabs, shows EditorWelcomeScreen
    return;
  }

  // Switch to API workspace
  setActiveWorkspace('api');
  const lastApi = getLastTabIdByKind('api');
  if (lastApi) {
    setActiveTab(lastApi);
  }
  // If no API tabs, shows ApiWelcomeScreen
};

export const copyOutputToClipboard = async () => {
  const { currentExecution, setCommandPaletteOpen } = getState();
  if (currentExecution?.rawOutput) {
    try {
      await navigator.clipboard.writeText(currentExecution.rawOutput);
      toast.success('Output copied to clipboard');
    } catch {
      toast.error('Failed to copy output', {
        description: 'Could not copy to clipboard',
      });
    }
  }
  setCommandPaletteOpen(false);
};

// ============================================================================
// Single-Combo Shortcuts (Low conflict, universal patterns)
// ============================================================================

const singleShortcuts: SingleShortcut[] = [
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
    id: 'save-file',
    label: 'Save',
    match: (event) => matchesModKey(event, 's', false),
    action: () => {
      const { saveFile } = getState();
      void saveFile();
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyS,
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
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    match: (event) => matchesModKey(event, 'b'),
    action: () => {
      const { toggleRightSidebar } = getState();
      toggleRightSidebar();
    },
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyB,
  },
];

// ============================================================================
// Chord Shortcuts (⌘K + key)
// ============================================================================

const chordShortcuts: ChordShortcut[] = [
  {
    id: 'new-file',
    label: 'New File',
    followKey: 'n',
    action: createNewFileOrApi,
    monacoKeybinding: KeyMod.CtrlCmd | KeyCode.KeyK,
  },
  {
    id: 'open-file',
    label: 'Open File',
    followKey: 'o',
    action: () => {
      const { openFileFromDisk } = getState();
      openFileFromDisk();
    },
  },
  {
    id: 'open-module-folder',
    label: 'Open Module Folder',
    followKey: 'f',
    action: () => {
      const { openModuleFolderFromDisk } = getState();
      void openModuleFolderFromDisk();
    },
  },
  {
    id: 'save-file-as',
    label: 'Save As',
    followKey: 's',
    followShift: true,
    action: () => {
      const { saveFileAs } = getState();
      void saveFileAs();
    },
  },
  {
    id: 'export-file',
    label: 'Export File',
    followKey: 'e',
    action: () => {
      const { exportToFile } = getState();
      exportToFile();
    },
  },
  {
    id: 'toggle-view',
    label: 'Toggle View',
    followKey: 'm',
    action: toggleView,
  },
  {
    id: 'module-browser',
    label: 'Import from LMX',
    followKey: 'i',
    action: () => {
      const { setModuleBrowserOpen, selectedPortalId } = getState();
      if (selectedPortalId) {
        setModuleBrowserOpen(true);
      }
    },
  },
  {
    id: 'module-search',
    label: 'Search LogicModules',
    followKey: 's',
    action: () => {
      const { setModuleSearchOpen, selectedPortalId } = getState();
      if (selectedPortalId) {
        setModuleSearchOpen(true);
      }
    },
  },
  {
    id: 'applies-to-toolbox',
    label: 'AppliesTo Toolbox',
    followKey: 'a',
    action: () => {
      const { setAppliesToTesterOpen, selectedPortalId } = getState();
      if (selectedPortalId) {
        setAppliesToTesterOpen(true);
      }
    },
  },
  {
    id: 'debug-commands',
    label: 'Debug Commands',
    followKey: 'd',
    action: () => {
      const { setDebugCommandsDialogOpen, selectedPortalId } = getState();
      if (selectedPortalId) {
        setDebugCommandsDialogOpen(true);
      }
    },
  },
  {
    id: 'module-snippets',
    label: 'Module Snippets',
    followKey: 'l',
    action: () => {
      const { setModuleSnippetsDialogOpen } = getState();
      setModuleSnippetsDialogOpen(true);
    },
  },
  {
    id: 'copy-output',
    label: 'Copy Output',
    followKey: 'c',
    action: () => {
      void copyOutputToClipboard();
    },
  },
  {
    id: 'refresh-collectors',
    label: 'Refresh Collectors',
    followKey: 'r',
    action: () => {
      const { refreshCollectors, selectedPortalId } = getState();
      if (selectedPortalId) {
        refreshCollectors();
      }
    },
  },
];

// ============================================================================
// Chord State Management
// ============================================================================

const clearChordState = () => {
  pendingChord = false;
  if (chordTimeout) {
    clearTimeout(chordTimeout);
    chordTimeout = null;
  }
  getState().setChordPending(false);
};

const startChord = () => {
  pendingChord = true;
  getState().setChordPending(true);
  
  // Blur any focused element to prevent focus rings during chord
  if (document.activeElement instanceof HTMLElement) {
    const active = document.activeElement;
    // Don't blur if it's an input/textarea/editor
    if (
      active.tagName !== 'INPUT' &&
      active.tagName !== 'TEXTAREA' &&
      !active.closest('.monaco-editor')
    ) {
      active.blur();
    }
  }
  
  chordTimeout = setTimeout(() => {
    clearChordState();
  }, CHORD_TIMEOUT_MS);
};

// ============================================================================
// Global Key Handler
// ============================================================================

// Helper to fully stop an event from propagating
const stopEvent = (event: KeyboardEvent) => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
};

export const handleGlobalKeyDown = (event: KeyboardEvent) => {
  // Always allow command palette
  const commandPalette = singleShortcuts.find(shortcut => shortcut.id === 'command-palette');
  if (commandPalette?.match(event)) {
    stopEvent(event);
    clearChordState();
    commandPalette.action();
    return;
  }

  const { commandPaletteOpen } = getState();
  if (commandPaletteOpen) {
    return;
  }

  // Handle chord follow-up key
  if (pendingChord) {
    const key = event.key.toLowerCase();
    const shift = event.shiftKey;
    
    // Find matching chord shortcut
    const matchedChord = chordShortcuts.find(shortcut => {
      if (shortcut.followKey !== key) return false;
      if (shortcut.followShift && !shift) return false;
      if (!shortcut.followShift && shift) {
        // Check if there's a shifted version of this key
        const hasShiftedVersion = chordShortcuts.some(
          s => s.followKey === key && s.followShift
        );
        if (hasShiftedVersion) return false;
      }
      return true;
    });

    if (matchedChord) {
      stopEvent(event);
      clearChordState();
      matchedChord.action();
      return;
    }

    // If Escape is pressed, cancel the chord
    if (event.key === 'Escape') {
      stopEvent(event);
      clearChordState();
      return;
    }

    // Any other key cancels the chord and falls through
    clearChordState();
  }

  // Check for chord leader (⌘K)
  if (isModKey(event) && event.key.toLowerCase() === 'k' && !event.shiftKey) {
    stopEvent(event);
    startChord();
    return;
  }

  // Handle single-combo shortcuts
  for (const shortcut of singleShortcuts) {
    if (shortcut.id === 'command-palette') continue;
    if (shortcut.match(event)) {
      stopEvent(event);
      shortcut.action();
      return;
    }
  }
};

// ============================================================================
// Monaco Editor Integration
// ============================================================================

const registerActions = (target: editor.IStandaloneCodeEditor) => {
  // Register single shortcuts
  singleShortcuts.forEach((shortcut) => {
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

  // Register chord shortcuts with Monaco's chord support
  // Monaco supports chords via KeyMod.chord()
  chordShortcuts.forEach((shortcut) => {
    const followKeyCode = getKeyCodeForLetter(shortcut.followKey);
    if (!followKeyCode) return;

    const secondPart = shortcut.followShift
      ? KeyMod.Shift | followKeyCode
      : followKeyCode;

    target.addAction({
      id: shortcut.id,
      label: shortcut.label,
      keybindings: [KeyMod.chord(KeyMod.CtrlCmd | KeyCode.KeyK, secondPart)],
      run: () => {
        shortcut.action();
      },
    });
  });
};

// Helper to get Monaco KeyCode for a letter
function getKeyCodeForLetter(letter: string): KeyCode | null {
  const letterMap: Record<string, KeyCode> = {
    a: KeyCode.KeyA,
    b: KeyCode.KeyB,
    c: KeyCode.KeyC,
    d: KeyCode.KeyD,
    e: KeyCode.KeyE,
    f: KeyCode.KeyF,
    g: KeyCode.KeyG,
    h: KeyCode.KeyH,
    i: KeyCode.KeyI,
    j: KeyCode.KeyJ,
    k: KeyCode.KeyK,
    l: KeyCode.KeyL,
    m: KeyCode.KeyM,
    n: KeyCode.KeyN,
    o: KeyCode.KeyO,
    p: KeyCode.KeyP,
    q: KeyCode.KeyQ,
    r: KeyCode.KeyR,
    s: KeyCode.KeyS,
    t: KeyCode.KeyT,
    u: KeyCode.KeyU,
    v: KeyCode.KeyV,
    w: KeyCode.KeyW,
    x: KeyCode.KeyX,
    y: KeyCode.KeyY,
    z: KeyCode.KeyZ,
  };
  return letterMap[letter.toLowerCase()] ?? null;
}

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

// Export for use in UI components
export const isChordPending = () => pendingChord;
