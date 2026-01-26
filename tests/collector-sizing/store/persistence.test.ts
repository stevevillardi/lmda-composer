/**
 * Tests for persistence store actions.
 *
 * Tests loadCollectorSizingState, saveCollectorSizingState,
 * and resetCollectorSizing actions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../../src/editor/stores/editor-store';
import { resetChromeMocks, getChromeMock } from '../../setup';
import type { Site, CollectorSizingConfig } from '../../../src/editor/stores/slices/collector-sizing-slice';

// Get initial state for resets
const initialState = useEditorStore.getState();

function resetStore(): void {
  useEditorStore.setState(initialState, true);
}

const STORAGE_KEY = 'lmda-collector-sizing-state';

describe('Persistence', () => {
  let chromeMock: ReturnType<typeof getChromeMock>;

  beforeEach(() => {
    resetStore();
    resetChromeMocks();
    chromeMock = getChromeMock();
    // Ensure we start with no sites
    useEditorStore.setState({ sites: [], activeSiteId: null });
  });

  describe('saveCollectorSizingState', () => {
    it('writes to chrome.storage.local', async () => {
      const { addSite, saveCollectorSizingState } = useEditorStore.getState();
      addSite('Test Site');

      await saveCollectorSizingState();

      expect(chromeMock.storage.local.set).toHaveBeenCalled();
    });

    it('saves sites to storage', async () => {
      const { addSite, saveCollectorSizingState } = useEditorStore.getState();
      const siteId = addSite('Test Site');

      await saveCollectorSizingState();

      const savedData = chromeMock.storage.local.set.mock.calls[0]?.[0];
      expect(savedData).toBeDefined();
      expect(savedData[STORAGE_KEY]).toBeDefined();
      expect(savedData[STORAGE_KEY].sites).toHaveLength(1);
      expect(savedData[STORAGE_KEY].sites[0].id).toBe(siteId);
    });

    it('saves config to storage', async () => {
      const { addSite, setMaxLoadPercent, saveCollectorSizingState } = useEditorStore.getState();
      addSite('Test Site');
      setMaxLoadPercent(70);

      await saveCollectorSizingState();

      const savedData = chromeMock.storage.local.set.mock.calls[0]?.[0];
      expect(savedData[STORAGE_KEY].collectorSizingConfig.maxLoadPercent).toBe(70);
    });

    it('saves activeSiteId to storage', async () => {
      const { addSite, saveCollectorSizingState } = useEditorStore.getState();
      const siteId = addSite('Test Site');

      await saveCollectorSizingState();

      const savedData = chromeMock.storage.local.set.mock.calls[0]?.[0];
      expect(savedData[STORAGE_KEY].activeSiteId).toBe(siteId);
    });

    it('updates collectorSizingLastSaved timestamp', async () => {
      const { addSite, saveCollectorSizingState } = useEditorStore.getState();
      addSite('Test Site');
      const beforeSave = Date.now();

      await saveCollectorSizingState();

      const { collectorSizingLastSaved } = useEditorStore.getState();
      expect(collectorSizingLastSaved).toBeGreaterThanOrEqual(beforeSave);
    });

    it('clears dirty flag after save', async () => {
      const { addSite, saveCollectorSizingState } = useEditorStore.getState();
      addSite('Test Site');
      expect(useEditorStore.getState().collectorSizingIsDirty).toBe(true);

      await saveCollectorSizingState();

      expect(useEditorStore.getState().collectorSizingIsDirty).toBe(false);
    });

    it('handles storage errors gracefully', async () => {
      const { addSite, saveCollectorSizingState } = useEditorStore.getState();
      addSite('Test Site');
      chromeMock.storage.local.set.mockRejectedValueOnce(new Error('Storage error'));

      // Should not throw
      await expect(saveCollectorSizingState()).resolves.not.toThrow();
    });
  });

  describe('loadCollectorSizingState', () => {
    it('reads from chrome.storage.local', async () => {
      const { loadCollectorSizingState } = useEditorStore.getState();

      await loadCollectorSizingState();

      expect(chromeMock.storage.local.get).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('loads sites from storage', async () => {
      const mockSites: Site[] = [
        {
          id: 'site-1',
          name: 'Loaded Site',
          devices: {},
          logs: {},
          traps: {},
          flows: {},
          isExpanded: true,
          activeTab: 'devices',
          calculationResult: null,
        },
      ];

      chromeMock.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          sites: mockSites,
          activeSiteId: 'site-1',
          collectorSizingConfig: {},
        },
      });

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      const { sites } = useEditorStore.getState();
      expect(sites).toHaveLength(1);
      expect(sites[0].name).toBe('Loaded Site');
    });

    it('loads activeSiteId from storage', async () => {
      chromeMock.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          sites: [{ id: 'site-123', name: 'Test', devices: {}, logs: {}, traps: {}, flows: {}, isExpanded: true, activeTab: 'devices', calculationResult: null }],
          activeSiteId: 'site-123',
          collectorSizingConfig: {},
        },
      });

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      const { activeSiteId } = useEditorStore.getState();
      expect(activeSiteId).toBe('site-123');
    });

    it('merges loaded config with defaults', async () => {
      chromeMock.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          sites: [],
          activeSiteId: null,
          collectorSizingConfig: {
            maxLoadPercent: 70,
            // Missing other fields should use defaults
          },
        },
      });

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.maxLoadPercent).toBe(70);
      // Should have default method weights
      expect(collectorSizingConfig.methodWeights.SNMPv3).toBeDefined();
    });

    it('handles missing methodWeights in stored config', async () => {
      chromeMock.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          sites: [],
          activeSiteId: null,
          collectorSizingConfig: {
            maxLoadPercent: 85,
            // No methodWeights
          },
        },
      });

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.methodWeights).toBeDefined();
      expect(collectorSizingConfig.methodWeights.SNMPv3).toBeDefined();
    });

    it('handles missing collectorCapacities in stored config', async () => {
      chromeMock.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          sites: [],
          activeSiteId: null,
          collectorSizingConfig: {
            maxLoadPercent: 85,
            // No collectorCapacities
          },
        },
      });

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.collectorCapacities).toBeDefined();
      expect(collectorSizingConfig.collectorCapacities.MEDIUM).toBeDefined();
    });

    it('handles empty storage gracefully', async () => {
      chromeMock.storage.local.get.mockResolvedValueOnce({});

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      // Should not throw and state should remain valid
      const { sites } = useEditorStore.getState();
      expect(Array.isArray(sites)).toBe(true);
    });

    it('handles storage errors gracefully', async () => {
      chromeMock.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));

      const { loadCollectorSizingState } = useEditorStore.getState();

      // Should not throw
      await expect(loadCollectorSizingState()).resolves.not.toThrow();
    });

    it('clears dirty flag after load', async () => {
      useEditorStore.setState({ collectorSizingIsDirty: true });
      chromeMock.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          sites: [],
          activeSiteId: null,
          collectorSizingConfig: {},
        },
      });

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(false);
    });

    it('recalculates all sites after load', async () => {
      const mockSites: Site[] = [
        {
          id: 'site-1',
          name: 'Test Site',
          devices: {
            'Linux Servers': { count: 100, instances: 100, methods: { SNMPv3: 1.0 }, icon: 'Server' },
          },
          logs: {},
          traps: {},
          flows: {},
          isExpanded: true,
          activeTab: 'devices',
          calculationResult: null, // No calculation result stored
        },
      ];

      chromeMock.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          sites: mockSites,
          activeSiteId: 'site-1',
          collectorSizingConfig: {},
        },
      });

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      const { sites } = useEditorStore.getState();
      // Calculation should have been performed
      expect(sites[0].calculationResult).not.toBeNull();
      expect(sites[0].calculationResult?.polling).not.toBeNull();
    });

    it('loads collectorSizingLastSaved from storage', async () => {
      const savedTimestamp = Date.now() - 10000;
      chromeMock.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          sites: [],
          activeSiteId: null,
          collectorSizingConfig: {},
          collectorSizingLastSaved: savedTimestamp,
        },
      });

      const { loadCollectorSizingState } = useEditorStore.getState();
      await loadCollectorSizingState();

      const { collectorSizingLastSaved } = useEditorStore.getState();
      expect(collectorSizingLastSaved).toBe(savedTimestamp);
    });
  });

  describe('resetCollectorSizing', () => {
    it('clears all sites', () => {
      const { addSite, resetCollectorSizing } = useEditorStore.getState();
      addSite('Site 1');
      addSite('Site 2');

      resetCollectorSizing();

      const { sites } = useEditorStore.getState();
      expect(sites).toHaveLength(0);
    });

    it('clears activeSiteId', () => {
      const { addSite, resetCollectorSizing } = useEditorStore.getState();
      addSite('Test Site');

      resetCollectorSizing();

      const { activeSiteId } = useEditorStore.getState();
      expect(activeSiteId).toBeNull();
    });

    it('resets config to defaults', () => {
      const { addSite, setMaxLoadPercent, resetCollectorSizing } = useEditorStore.getState();
      addSite('Test Site');
      setMaxLoadPercent(70);

      resetCollectorSizing();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.maxLoadPercent).toBe(85); // Default value
    });

    it('marks state as dirty', () => {
      const { addSite, resetCollectorSizing } = useEditorStore.getState();
      addSite('Test Site');
      useEditorStore.setState({ collectorSizingIsDirty: false });

      resetCollectorSizing();

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('clears aggregated results', () => {
      const { addSite, updateDeviceCount, resetCollectorSizing } = useEditorStore.getState();
      const siteId = addSite('Test Site');
      updateDeviceCount(siteId, 'Linux Servers', 100);

      // Verify we have aggregated results
      expect(useEditorStore.getState().aggregatedResults).not.toBeNull();

      resetCollectorSizing();

      const { aggregatedResults } = useEditorStore.getState();
      expect(aggregatedResults).toBeNull();
    });

    it('resets method weights to default', () => {
      const { addSite, setMethodWeight, resetCollectorSizing } = useEditorStore.getState();
      addSite('Test Site');
      setMethodWeight('SNMPv3', 5.0);

      resetCollectorSizing();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.methodWeights.SNMPv3).toBe(1.3); // Default value
    });

    it('resets failover settings', () => {
      const { addSite, setPollingFailover, setLogsFailover, resetCollectorSizing } =
        useEditorStore.getState();
      addSite('Test Site');
      setPollingFailover(true);
      setLogsFailover(true);

      resetCollectorSizing();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.pollingFailover).toBe(false);
      expect(collectorSizingConfig.logsFailover).toBe(false);
    });

    it('resets forced collector size to auto', () => {
      const { addSite, setForcedCollectorSize, resetCollectorSizing } = useEditorStore.getState();
      addSite('Test Site');
      setForcedCollectorSize('LARGE');

      resetCollectorSizing();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.forcedCollectorSize).toBe('auto');
    });
  });

  describe('recalculateSite', () => {
    it('updates calculation result for specific site', () => {
      const { addSite, updateDeviceCount, recalculateSite } = useEditorStore.getState();
      const siteId = addSite('Test Site');

      // Directly modify state to clear calculation (simulating load from storage)
      useEditorStore.setState((state) => ({
        sites: state.sites.map((s) =>
          s.id === siteId ? { ...s, calculationResult: null } : s
        ),
      }));

      // Set device count (which will trigger recalculation internally)
      updateDeviceCount(siteId, 'Linux Servers', 100);

      const site = useEditorStore.getState().sites.find((s) => s.id === siteId);
      expect(site?.calculationResult).not.toBeNull();
    });

    it('updates aggregated results', () => {
      const { addSite, updateDeviceCount } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      const site2Id = addSite('Site 2');

      updateDeviceCount(site1Id, 'Linux Servers', 100);
      updateDeviceCount(site2Id, 'Linux Servers', 100);

      const { aggregatedResults } = useEditorStore.getState();
      expect(aggregatedResults).not.toBeNull();
      expect(aggregatedResults?.polling?.count).toBeGreaterThan(0);
    });
  });

  describe('recalculateAllSites', () => {
    it('recalculates all sites', () => {
      const { addSite, updateDeviceCount, recalculateAllSites } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      const site2Id = addSite('Site 2');
      updateDeviceCount(site1Id, 'Linux Servers', 100);
      updateDeviceCount(site2Id, 'Windows Servers', 100);

      // Clear calculations
      useEditorStore.setState((state) => ({
        sites: state.sites.map((s) => ({ ...s, calculationResult: null })),
      }));

      recalculateAllSites();

      const { sites } = useEditorStore.getState();
      expect(sites[0].calculationResult).not.toBeNull();
      expect(sites[1].calculationResult).not.toBeNull();
    });

    it('updates aggregated results', () => {
      const { addSite, updateDeviceCount, recalculateAllSites } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      const site2Id = addSite('Site 2');
      updateDeviceCount(site1Id, 'Linux Servers', 100);
      updateDeviceCount(site2Id, 'Linux Servers', 100);

      // Clear aggregated results
      useEditorStore.setState({ aggregatedResults: null });

      recalculateAllSites();

      const { aggregatedResults } = useEditorStore.getState();
      expect(aggregatedResults).not.toBeNull();
    });
  });
});
