import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../src/editor/stores/editor-store';
import type { FetchDevicesResponse, SWToEditorMessage } from '../src/shared/types';
import { getChromeMock } from './setup';

const initialState = useEditorStore.getState();

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('editor-store device fetch', () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
  });

  afterEach(() => {
    useEditorStore.setState(initialState, true);
    vi.restoreAllMocks();
  });

  it('ignores stale device responses after selection changes', async () => {
    const deferred = createDeferred<SWToEditorMessage>();
    const chrome = getChromeMock();
    chrome.runtime.sendMessage.mockReturnValue(deferred.promise);

    useEditorStore.setState({
      selectedPortalId: 'portal-a',
      selectedCollectorId: 1,
      devices: [],
      isFetchingDevices: false,
    });

    const fetchPromise = useEditorStore.getState().fetchDevices();

    useEditorStore.setState({
      selectedPortalId: 'portal-b',
      selectedCollectorId: 2,
      devices: [],
      isFetchingDevices: false,
    });

    deferred.resolve({
      type: 'DEVICES_UPDATE',
      payload: {
        items: [
          {
            id: 1,
            name: 'device-a',
            displayName: 'Device A',
            currentCollectorId: 1,
            hostStatus: 'normal',
          },
        ],
        total: 1,
      } satisfies FetchDevicesResponse,
    });

    await fetchPromise;

    expect(useEditorStore.getState().devices).toEqual([]);
    expect(useEditorStore.getState().isFetchingDevices).toBe(false);
  });
});
