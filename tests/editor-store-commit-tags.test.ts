import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../src/editor/stores/editor-store';
import type { EditorTab } from '../src/shared/types';
import { getChromeMock } from './setup';

const initialState = useEditorStore.getState();

describe('editor-store commit tags payload', () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    const chrome = getChromeMock();
    chrome.runtime.sendMessage.mockResolvedValue({
      type: 'MODULE_COMMITTED',
      payload: { moduleId: 1, moduleType: 'logsource' },
    });
  });

  afterEach(() => {
    useEditorStore.setState(initialState, true);
    vi.restoreAllMocks();
  });

  it('sends tags as array for logsource commits', async () => {
    const tab: EditorTab = {
      id: 'tab-log',
      displayName: 'Module/collection.groovy',
      content: 'same',
      originalContent: 'same',
      language: 'groovy',
      mode: 'collection',
      source: {
        type: 'module',
        moduleId: 1,
        moduleType: 'logsource',
        scriptType: 'collection',
        portalId: 'portal-a',
      },
    };

    useEditorStore.setState({
      tabs: [tab],
      selectedPortalId: 'portal-a',
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
      ],
      moduleDetailsDraftByTabId: {
        [tab.id]: {
          original: { tags: 'a,b' },
          draft: { tags: 'a, b' },
          dirtyFields: new Set(['tags']),
          loadedAt: Date.now(),
          tabId: tab.id,
          moduleId: 1,
          moduleType: 'logsource',
          portalId: 'portal-a',
          version: 1,
        },
      },
    });

    await useEditorStore.getState().commitModuleScript(tab.id);

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COMMIT_MODULE_SCRIPT',
        payload: expect.objectContaining({
          moduleDetails: expect.objectContaining({
            tags: ['a', 'b'],
          }),
        }),
      })
    );
  });

  it('sends tags as string for non-logsource commits', async () => {
    const tab: EditorTab = {
      id: 'tab-data',
      displayName: 'Module/collection.groovy',
      content: 'same',
      originalContent: 'same',
      language: 'groovy',
      mode: 'collection',
      source: {
        type: 'module',
        moduleId: 2,
        moduleType: 'datasource',
        scriptType: 'collection',
        portalId: 'portal-a',
      },
    };

    useEditorStore.setState({
      tabs: [tab],
      selectedPortalId: 'portal-a',
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
      ],
      moduleDetailsDraftByTabId: {
        [tab.id]: {
          original: { tags: 'a,b' },
          draft: { tags: 'a, b' },
          dirtyFields: new Set(['tags']),
          loadedAt: Date.now(),
          tabId: tab.id,
          moduleId: 2,
          moduleType: 'datasource',
          portalId: 'portal-a',
          version: 1,
        },
      },
    });

    await useEditorStore.getState().commitModuleScript(tab.id);

    expect(getChromeMock().runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COMMIT_MODULE_SCRIPT',
        payload: expect.objectContaining({
          moduleDetails: expect.objectContaining({
            tags: 'a, b',
          }),
        }),
      })
    );
  });
});
