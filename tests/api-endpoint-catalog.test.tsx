/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ApiEndpointCatalog } from '../src/editor/components/api/ApiEndpointCatalog';
import { useEditorStore } from '../src/editor/stores/editor-store';

let retrySpy = vi.fn();
vi.mock('../src/editor/hooks/useApiSchema', () => ({
  useApiSchema: () => ({
    schema: null,
    isLoading: false,
    error: 'Network error',
    retry: retrySpy,
  }),
}));

const initialState = useEditorStore.getState();

describe('ApiEndpointCatalog', () => {
  beforeEach(() => {
    retrySpy = vi.fn();
    useEditorStore.setState(initialState, true);
    useEditorStore.setState({
      tabs: [
        {
          id: 'api-tab',
          kind: 'api',
          displayName: 'API Request',
          content: '',
          language: 'groovy',
          mode: 'freeform',
          source: { type: 'api' },
          api: { request: { method: 'GET', path: '', queryParams: {}, headerParams: {}, body: '', bodyMode: 'form', contentType: 'application/json', pagination: { enabled: false, sizeParam: 'size', offsetParam: 'offset', pageSize: 25 } } },
        },
      ],
      activeTabId: 'api-tab',
    });
  });

  it('renders retry button on schema load error', () => {
    render(<ApiEndpointCatalog />);
    expect(screen.getByText('Failed to load schema')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('invokes retry handler when clicking Retry', () => {
    retrySpy = vi.fn();
    render(<ApiEndpointCatalog />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retrySpy).toHaveBeenCalled();
  });
});
