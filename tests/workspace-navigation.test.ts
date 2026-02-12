import { describe, expect, it, vi } from 'vitest';
import type { EditorTab } from '../src/shared/types';
import {
  getLastTabIdByKind,
  getWorkspaceFromState,
  getWorkspaceVisibilityState,
  switchWorkspaceWithLastTab,
} from '../src/editor/utils/workspace-navigation';

function createScriptTab(id: string): EditorTab {
  return {
    id,
    kind: 'script',
    displayName: `${id}.groovy`,
    content: '',
    language: 'groovy',
    mode: 'freeform',
  };
}

function createApiTab(id: string): EditorTab {
  return {
    id,
    kind: 'api',
    displayName: `${id}.api`,
    content: '',
    language: 'groovy',
    mode: 'freeform',
  };
}

describe('workspace-navigation', () => {
  describe('getWorkspaceVisibilityState', () => {
    it('shows script welcome when no script tabs exist even if api tabs are open', () => {
      const state = getWorkspaceVisibilityState(
        [createApiTab('api-1')],
        'script',
        true
      );

      expect(state.showScriptWelcome).toBe(true);
      expect(state.showWelcome).toBe(true);
      expect(state.showApiWelcome).toBe(false);
    });

    it('shows api welcome when api workspace has zero api tabs', () => {
      const state = getWorkspaceVisibilityState(
        [createScriptTab('script-1')],
        'api',
        true
      );

      expect(state.showApiWelcome).toBe(true);
      expect(state.showWelcome).toBe(true);
      expect(state.showScriptWelcome).toBe(false);
    });
  });

  describe('switchWorkspaceWithLastTab', () => {
    it('switches to script and selects most recent script tab', () => {
      const tabs = [
        createScriptTab('script-1'),
        createApiTab('api-1'),
        createScriptTab('script-2'),
      ];
      const setActiveWorkspace = vi.fn();
      const setActiveTab = vi.fn();

      switchWorkspaceWithLastTab({
        targetWorkspace: 'script',
        tabs,
        setActiveWorkspace,
        setActiveTab,
      });

      expect(setActiveWorkspace).toHaveBeenCalledWith('script');
      expect(setActiveTab).toHaveBeenCalledWith('script-2');
    });

    it('switches workspace and clears active tab when target has no tabs', () => {
      const tabs = [createApiTab('api-1')];
      const setActiveWorkspace = vi.fn();
      const setActiveTab = vi.fn();

      switchWorkspaceWithLastTab({
        targetWorkspace: 'script',
        tabs,
        setActiveWorkspace,
        setActiveTab,
      });

      expect(setActiveWorkspace).toHaveBeenCalledWith('script');
      expect(setActiveTab).toHaveBeenCalledWith(null);
    });
  });

  describe('helpers', () => {
    it('getLastTabIdByKind returns latest matching tab', () => {
      const tabs = [
        createScriptTab('script-1'),
        createApiTab('api-1'),
        createScriptTab('script-2'),
      ];

      expect(getLastTabIdByKind(tabs, 'script')).toBe('script-2');
      expect(getLastTabIdByKind(tabs, 'api')).toBe('api-1');
    });

    it('getWorkspaceFromState prefers active api tab', () => {
      const activeTab = createApiTab('api-1');
      const currentWorkspace = getWorkspaceFromState(activeTab, 'script');

      expect(currentWorkspace).toBe('api');
    });
  });
});
