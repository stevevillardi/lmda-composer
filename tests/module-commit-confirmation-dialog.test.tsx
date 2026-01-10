/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PushToPortalDialog } from '../src/editor/components/import-from-lmx/PushToPortalDialog';
import { useEditorStore } from '../src/editor/stores/editor-store';
import type { EditorTab } from '../src/shared/types';

vi.mock('../src/editor/components/composer/DiffEditor', () => ({
  DiffEditor: () => <div data-testid="diff-editor" />,
}));

const initialState = useEditorStore.getState();

describe('PushToPortalDialog', () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);

    const tab: EditorTab = {
      id: 'tab-1',
      displayName: 'Module/collection.groovy',
      content: 'same',
      originalContent: 'same',
      language: 'groovy',
      mode: 'collection',
      source: {
        type: 'module',
        moduleId: 1,
        moduleType: 'datasource',
        scriptType: 'collection',
        portalId: 'portal-a',
      },
    };

    useEditorStore.setState({
      activeTabId: tab.id,
      tabs: [tab],
      accessGroups: [],
      moduleDetailsDraftByTabId: {
        [tab.id]: {
          original: { tags: '' },
          draft: { tags: 'alpha' },
          dirtyFields: new Set(['tags']),
          loadedAt: Date.now(),
          tabId: tab.id,
          moduleId: 1,
          moduleType: 'datasource',
          portalId: 'portal-a',
          version: 1,
        },
      },
    });
  });

  it('shows empty state when only module details change', () => {
    render(
      <PushToPortalDialog
        open={true}
        onOpenChange={() => {}}
        onConfirm={async () => {}}
        moduleName="Example"
        moduleType="datasource"
        scriptType="collection"
        originalScript="same"
        newScript="same"
      />
    );

    expect(screen.getByText('No script changes will be pushed for this update.')).toBeInTheDocument();
  });
});
