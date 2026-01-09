import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../src/editor/stores/editor-store';
import type { EditorTab } from '../src/shared/types';

const initialState = useEditorStore.getState();

describe('editor-store portal binding', () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    // Chrome mock is already installed globally via tests/setup.ts
  });

  afterEach(() => {
    useEditorStore.setState(initialState, true);
    vi.restoreAllMocks();
  });

  it('prevents commits when portal binding does not match active portal', () => {
    const tab: EditorTab = {
      id: 'tab-1',
      displayName: 'Module/collection.groovy',
      content: 'new',
      originalContent: 'old',
      language: 'groovy',
      mode: 'collection',
      source: {
        type: 'module',
        moduleId: 1,
        moduleType: 'datasource',
        scriptType: 'collection',
        portalId: 'portal-a',
        portalHostname: 'a.logicmonitor.com',
      },
    };

    useEditorStore.setState({
      tabs: [tab],
      selectedPortalId: 'portal-b',
      portals: [
        {
          id: 'portal-a',
          hostname: 'a.logicmonitor.com',
          displayName: 'Portal A',
          csrfToken: null,
          csrfTokenTimestamp: null,
          tabIds: [],
          status: 'active',
        },
        {
          id: 'portal-b',
          hostname: 'b.logicmonitor.com',
          displayName: 'Portal B',
          csrfToken: null,
          csrfTokenTimestamp: null,
          tabIds: [],
          status: 'active',
        },
      ],
    });

    const canCommit = useEditorStore.getState().canCommitModule(tab.id);
    expect(canCommit).toBe(false);
  });
});
