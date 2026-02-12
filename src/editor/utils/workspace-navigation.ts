import type { EditorTab } from '@/shared/types';

export type WorkspaceKind = 'script' | 'api';
export type EditorWorkspace = WorkspaceKind | 'collector-sizing' | 'devtools';

interface SwitchWorkspaceOptions {
  targetWorkspace: WorkspaceKind;
  tabs: EditorTab[];
  setActiveWorkspace: (workspace: EditorWorkspace) => void;
  setActiveTab: (tabId: string) => void;
}

export interface WorkspaceVisibilityState {
  showWelcome: boolean;
  showApiWelcome: boolean;
  showScriptWelcome: boolean;
  showDevTools: boolean;
  showCollectorSizing: boolean;
}

export function getLastTabIdByKind(tabs: EditorTab[], kind: WorkspaceKind): string | null {
  return [...tabs].reverse().find(tab => (tab.kind ?? 'script') === kind)?.id ?? null;
}

export function getWorkspaceFromState(
  activeTab: EditorTab | null,
  activeWorkspace: EditorWorkspace
): EditorWorkspace {
  if (activeTab?.kind === 'api') {
    return 'api';
  }
  return activeWorkspace;
}

export function switchWorkspaceWithLastTab({
  targetWorkspace,
  tabs,
  setActiveWorkspace,
  setActiveTab,
}: SwitchWorkspaceOptions): void {
  setActiveWorkspace(targetWorkspace);
  const lastTab = getLastTabIdByKind(tabs, targetWorkspace);
  if (lastTab) {
    setActiveTab(lastTab);
  }
}

export function getWorkspaceVisibilityState(
  tabs: EditorTab[],
  activeWorkspace: EditorWorkspace,
  isDev: boolean
): WorkspaceVisibilityState {
  const apiTabCount = tabs.filter(tab => tab.kind === 'api').length;
  const scriptTabCount = tabs.filter(tab => (tab.kind ?? 'script') === 'script').length;

  const showDevTools = activeWorkspace === 'devtools' && isDev;
  const showCollectorSizing = activeWorkspace === 'collector-sizing';
  const showApiWelcome = activeWorkspace === 'api' && apiTabCount === 0;
  const showScriptWelcome = activeWorkspace === 'script' && scriptTabCount === 0;
  const showWelcome = showApiWelcome || showScriptWelcome;

  return {
    showWelcome,
    showApiWelcome,
    showScriptWelcome,
    showDevTools,
    showCollectorSizing,
  };
}
