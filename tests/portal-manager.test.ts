import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetChromeMocks, getChromeMock } from './setup';
import { PortalManager } from '../src/background/portal-manager';

describe('PortalManager', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('discovers portals even when tabs are unloaded/loading (no complete tab)', async () => {
    const chromeMock = getChromeMock() as unknown as {
      tabs: {
        query: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
      };
      scripting: {
        executeScript: ReturnType<typeof vi.fn>;
      };
      storage: {
        local: {
          get: ReturnType<typeof vi.fn>;
          set: ReturnType<typeof vi.fn>;
        };
      };
    };

    chromeMock.tabs.query.mockResolvedValueOnce([
      { id: 1, url: 'https://acme.logicmonitor.com/santaba/home', status: 'unloaded' },
      { id: 2, url: 'https://acme.logicmonitor.com/santaba/home', status: 'loading' },
      { id: 3, url: 'https://beta.logicmonitor.com/santaba/home', status: 'unloaded' },
      // Non-portal subdomain should be ignored
      { id: 4, url: 'https://docs.logicmonitor.com/', status: 'complete' },
    ]);

    // discoverPortals() should not attempt LMGlobalData verification for incomplete tabs,
    // but it *will* try to refresh CSRF tokens after discovery; ensure it doesn't crash.
    chromeMock.tabs.get.mockImplementation(async (tabId: number) => {
      const map: Record<number, chrome.tabs.Tab> = {
        1: { id: 1, url: 'https://acme.logicmonitor.com/santaba/home', status: 'unloaded', discarded: true, active: false, lastAccessed: 10, index: 0, pinned: false, highlighted: false, windowId: 1, incognito: false, selected: false, autoDiscardable: true, groupId: -1 },
        2: { id: 2, url: 'https://acme.logicmonitor.com/santaba/home', status: 'loading', discarded: false, active: false, lastAccessed: 20, index: 1, pinned: false, highlighted: false, windowId: 1, incognito: false, selected: false, autoDiscardable: true, groupId: -1 },
        3: { id: 3, url: 'https://beta.logicmonitor.com/santaba/home', status: 'unloaded', discarded: true, active: false, lastAccessed: 30, index: 2, pinned: false, highlighted: false, windowId: 1, incognito: false, selected: false, autoDiscardable: true, groupId: -1 },
      };
      return map[tabId] ?? null;
    });

    const pm = new PortalManager();
    const portals = await pm.discoverPortals();

    expect(portals.map(p => p.hostname).sort()).toEqual(['acme.logicmonitor.com', 'beta.logicmonitor.com']);
  });

  it('prefers an active/usable complete tab when multiple tabs exist for a portal', async () => {
    const chromeMock = getChromeMock() as unknown as {
      tabs: {
        query: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
      };
      scripting: {
        executeScript: ReturnType<typeof vi.fn>;
      };
    };

    chromeMock.tabs.query.mockResolvedValueOnce([
      // Query order intentionally puts the inactive tab first
      { id: 10, url: 'https://acme.logicmonitor.com/santaba/home', status: 'complete' },
      { id: 11, url: 'https://acme.logicmonitor.com/santaba/home', status: 'complete' },
    ]);

    // LMGlobalData verification should pass for both
    chromeMock.scripting.executeScript.mockResolvedValue([{ result: { hasLMGlobalData: true, isPopulated: true } }]);

    chromeMock.tabs.get.mockImplementation(async (tabId: number) => {
      const map: Record<number, chrome.tabs.Tab> = {
        10: { id: 10, url: 'https://acme.logicmonitor.com/santaba/home', status: 'complete', discarded: false, active: false, lastAccessed: 100, index: 0, pinned: false, highlighted: false, windowId: 1, incognito: false, selected: false, autoDiscardable: true, groupId: -1 },
        11: { id: 11, url: 'https://acme.logicmonitor.com/santaba/home', status: 'complete', discarded: false, active: true, lastAccessed: 50, index: 1, pinned: false, highlighted: false, windowId: 1, incognito: false, selected: false, autoDiscardable: true, groupId: -1 },
      };
      return map[tabId] ?? null;
    });

    const pm = new PortalManager();
    await pm.discoverPortals();

    const tabId = await pm.getValidTabIdForPortal('acme.logicmonitor.com');
    expect(tabId).toBe(11);
  });

  it('clears active status when a loaded tab shows LMGlobalData as empty (logged out)', async () => {
    const chromeMock = getChromeMock() as unknown as {
      tabs: {
        query: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
      };
      scripting: {
        executeScript: ReturnType<typeof vi.fn>;
      };
      storage: {
        local: {
          get: ReturnType<typeof vi.fn>;
        };
      };
    };

    // Seed persisted state as active (token present) to mirror the "still green" report.
    chromeMock.storage.local.get.mockResolvedValueOnce({
      'lm-ide-portals': [
        {
          id: 'acme.logicmonitor.com',
          hostname: 'acme.logicmonitor.com',
          displayName: 'Acme',
          csrfToken: 'old-token',
          csrfTokenTimestamp: Date.now(),
        },
      ],
    });

    chromeMock.tabs.query.mockResolvedValueOnce([
      { id: 55, url: 'https://acme.logicmonitor.com/santaba/home', status: 'complete' },
    ]);

    chromeMock.tabs.get.mockResolvedValue({
      id: 55,
      url: 'https://acme.logicmonitor.com/santaba/home',
      status: 'complete',
      discarded: false,
      active: true,
      lastAccessed: 100,
    });

    // Make the mock deterministic:
    // - MAIN world probe (LMGlobalData check) => present but empty (logged out)
    // - CSRF fetch (no world) => even if it returns a token, we should NOT mark portal active
    chromeMock.scripting.executeScript.mockImplementation(async (params: chrome.scripting.ScriptInjection) => {
      if (params?.world === 'MAIN') return [{ result: { hasLMGlobalData: true, isPopulated: false } }];
      return [{ result: 'token-even-when-logged-out' }];
    });

    const pm = new PortalManager();
    const portals = await pm.discoverPortals();
    const acme = portals.find(p => p.id === 'acme.logicmonitor.com');

    expect(acme?.status).toBe('expired');
    expect(acme?.csrfToken).toBeNull();
  });
});

