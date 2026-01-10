/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ModuleDetailsBasicInfo } from '../src/editor/components/module-details-sections/BasicInfo';
import { useEditorStore } from '../src/editor/stores/editor-store';
import type { LogicModuleType, EditorTab } from '../src/shared/types';

const initialState = useEditorStore.getState();

describe('ModuleDetailsBasicInfo validation', () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it('shows validation error for invalid name characters', () => {
    const tabId = 'tab-basic';
    const moduleType: LogicModuleType = 'datasource';
    const tab: EditorTab = {
      id: tabId,
      displayName: 'Module/collection.groovy',
      content: 'same',
      originalContent: 'same',
      language: 'groovy',
      mode: 'collection',
      source: {
        type: 'module',
        moduleId: 100,
        moduleType,
        scriptType: 'collection',
        portalId: 'portal-a',
      },
    };

    useEditorStore.setState({
      tabs: [tab],
      moduleDetailsDraftByTabId: {
        [tabId]: {
          original: { name: 'bad$name', collectInterval: 60 },
          draft: { name: 'bad$name', collectInterval: 60 },
          dirtyFields: new Set(),
          loadedAt: Date.now(),
          tabId,
          moduleId: 100,
          moduleType,
          portalId: 'portal-a',
          version: 1,
        },
      },
    });

    render(<ModuleDetailsBasicInfo tabId={tabId} moduleType={moduleType} />);

    expect(screen.getByText('Name cannot include special characters: " $ ^ * ( )')).toBeInTheDocument();
  });
});
