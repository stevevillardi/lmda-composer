import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../src/editor/stores/editor-store';
import type { EditorTab } from '../src/shared/types';

const initialState = useEditorStore.getState();

describe('editor-store module details dirty tracking', () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
  });

  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it('clears dirty state for accessGroupIds when values match (order-insensitive)', () => {
    const tab: EditorTab = {
      id: 'tab-1',
      displayName: 'Module/collection.groovy',
      content: 'same',
      originalContent: 'same',
      language: 'groovy',
      mode: 'collection',
      source: {
        type: 'module',
        moduleId: 10,
        moduleType: 'datasource',
        scriptType: 'collection',
        portalId: 'portal-a',
      },
    };

    useEditorStore.setState({
      tabs: [tab],
      moduleDetailsDraftByTabId: {
        [tab.id]: {
          original: { accessGroupIds: [1, 2] },
          draft: { accessGroupIds: [2, 1] },
          dirtyFields: new Set(['accessGroupIds']),
          loadedAt: Date.now(),
          tabId: tab.id,
          moduleId: 10,
          moduleType: 'datasource',
          portalId: 'portal-a',
          version: 1,
        },
      },
    });

    useEditorStore.getState().updateModuleDetailsField(tab.id, 'accessGroupIds', [1, 2]);

    const draft = useEditorStore.getState().moduleDetailsDraftByTabId[tab.id];
    expect(draft.dirtyFields.has('accessGroupIds')).toBe(false);
  });

  it('clears dirty state for autoDiscoveryConfig when values match', () => {
    const tab: EditorTab = {
      id: 'tab-2',
      displayName: 'Module/ad.groovy',
      content: 'same',
      originalContent: 'same',
      language: 'groovy',
      mode: 'ad',
      source: {
        type: 'module',
        moduleId: 11,
        moduleType: 'datasource',
        scriptType: 'ad',
        portalId: 'portal-a',
      },
    };

    const originalConfig = {
      scheduleInterval: 0,
      filters: [],
    };

    useEditorStore.setState({
      tabs: [tab],
      moduleDetailsDraftByTabId: {
        [tab.id]: {
          original: { autoDiscoveryConfig: originalConfig },
          draft: { autoDiscoveryConfig: { ...originalConfig } },
          dirtyFields: new Set(['autoDiscoveryConfig']),
          loadedAt: Date.now(),
          tabId: tab.id,
          moduleId: 11,
          moduleType: 'datasource',
          portalId: 'portal-a',
          version: 1,
        },
      },
    });

    useEditorStore.getState().updateModuleDetailsField(tab.id, 'autoDiscoveryConfig', { ...originalConfig });

    const draft = useEditorStore.getState().moduleDetailsDraftByTabId[tab.id];
    expect(draft.dirtyFields.has('autoDiscoveryConfig')).toBe(false);
  });
});
