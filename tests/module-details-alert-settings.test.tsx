/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ModuleDetailsAlertSettings } from '../src/editor/components/ModuleDetailsSections/AlertSettings';
import { useEditorStore } from '../src/editor/stores/editor-store';
import type { EditorTab, LogicModuleType } from '../src/shared/types';

const initialState = useEditorStore.getState();

describe('ModuleDetailsAlertSettings validation', () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it('shows range validation for alert effective interval', () => {
    const tabId = 'tab-alert';
    const moduleType: LogicModuleType = 'eventsource';
    const tab: EditorTab = {
      id: tabId,
      displayName: 'Module/collection.groovy',
      content: 'same',
      originalContent: 'same',
      language: 'groovy',
      mode: 'collection',
      source: {
        type: 'module',
        moduleId: 50,
        moduleType,
        scriptType: 'collection',
        portalId: 'portal-a',
      },
    };

    useEditorStore.setState({
      tabs: [tab],
      activeTabId: tabId,
      moduleDetailsDraftByTabId: {
        [tabId]: {
          original: { alertEffectiveIval: 60, clearAfterAck: false },
          draft: { alertEffectiveIval: 2, clearAfterAck: false },
          dirtyFields: new Set(['alertEffectiveIval']),
          loadedAt: Date.now(),
          tabId,
          moduleId: 50,
          moduleType,
          portalId: 'portal-a',
          version: 1,
        },
      },
    });

    render(<ModuleDetailsAlertSettings tabId={tabId} moduleType={moduleType} />);

    expect(screen.getByText('Auto Clear After must be between 5 and 5760 minutes')).toBeInTheDocument();
  });
});
