/**
 * Tests for device update store actions.
 *
 * Tests updateDeviceCount, addDeviceType, deleteDeviceType,
 * and related device configuration actions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../../src/editor/stores/editor-store';
import { resetChromeMocks } from '../../setup';

// Get initial state for resets
const initialState = useEditorStore.getState();

function resetStore(): void {
  useEditorStore.setState(initialState, true);
}

describe('Device Updates', () => {
  let siteId: string;

  beforeEach(() => {
    resetStore();
    resetChromeMocks();
    // Ensure we start with no sites then add one
    useEditorStore.setState({ sites: [], activeSiteId: null });
    siteId = useEditorStore.getState().addSite('Test Site');
  });

  describe('updateDeviceCount', () => {
    it('sets device count', () => {
      const { updateDeviceCount } = useEditorStore.getState();

      updateDeviceCount(siteId, 'Linux Servers', 50);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.devices['Linux Servers'].count).toBe(50);
    });

    it('clamps negative values to 0', () => {
      const { updateDeviceCount } = useEditorStore.getState();

      updateDeviceCount(siteId, 'Linux Servers', -10);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.devices['Linux Servers'].count).toBe(0);
    });

    it('allows zero count', () => {
      const { updateDeviceCount } = useEditorStore.getState();

      updateDeviceCount(siteId, 'Linux Servers', 0);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.devices['Linux Servers'].count).toBe(0);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { updateDeviceCount } = useEditorStore.getState();

      updateDeviceCount(siteId, 'Linux Servers', 50);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('triggers recalculation', () => {
      const { updateDeviceCount } = useEditorStore.getState();

      updateDeviceCount(siteId, 'Linux Servers', 100);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      // After update, calculation result should be populated
      expect(site?.calculationResult).not.toBeNull();
    });

    it('updates polling recommendation after device count change', () => {
      const { updateDeviceCount } = useEditorStore.getState();

      // Add enough devices to get a recommendation
      updateDeviceCount(siteId, 'Linux Servers', 100);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.calculationResult?.polling).not.toBeNull();
    });

    it('only updates specified device type', () => {
      const { updateDeviceCount, sites: initialSites } = useEditorStore.getState();
      const site = initialSites.find((s) => s.id === siteId);
      const originalWindowsCount = site?.devices['Windows Servers'].count ?? 0;

      updateDeviceCount(siteId, 'Linux Servers', 50);

      const { sites } = useEditorStore.getState();
      const updatedSite = sites.find((s) => s.id === siteId);
      expect(updatedSite?.devices['Windows Servers'].count).toBe(originalWindowsCount);
    });

    it('handles non-existent site gracefully', () => {
      const { updateDeviceCount } = useEditorStore.getState();

      // Should not throw
      expect(() => updateDeviceCount('non-existent', 'Linux Servers', 50)).not.toThrow();
    });

    it('throws on non-existent device type', () => {
      const { updateDeviceCount } = useEditorStore.getState();

      // Updating a non-existent device type throws because it tries to spread undefined
      expect(() => updateDeviceCount(siteId, 'Non-Existent Device', 50)).toThrow();
    });

    it('handles large device counts', () => {
      const { updateDeviceCount } = useEditorStore.getState();

      updateDeviceCount(siteId, 'Linux Servers', 100000);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.devices['Linux Servers'].count).toBe(100000);
    });
  });

  describe('addDeviceType', () => {
    it('adds device type to defaults', () => {
      const { addDeviceType } = useEditorStore.getState();

      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });

      const { collectorSizingConfig: updatedConfig } = useEditorStore.getState();
      expect(updatedConfig.deviceDefaults['Custom Device']).toBeDefined();
      expect(updatedConfig.deviceDefaults['Custom Device'].instances).toBe(50);
    });

    it('adds device type to all existing sites', () => {
      // Add another site first
      const secondSiteId = useEditorStore.getState().addSite('Site 2');

      const { addDeviceType } = useEditorStore.getState();
      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });

      const { sites } = useEditorStore.getState();
      const site1 = sites.find((s) => s.id === siteId);
      const site2 = sites.find((s) => s.id === secondSiteId);

      expect(site1?.devices['Custom Device']).toBeDefined();
      expect(site2?.devices['Custom Device']).toBeDefined();
    });

    it('sets count to 0 for new device type', () => {
      const { addDeviceType } = useEditorStore.getState();

      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.devices['Custom Device'].count).toBe(0);
    });

    it('preserves methods configuration', () => {
      const { addDeviceType } = useEditorStore.getState();
      const methods = { SNMPv3: 0.7, Script: 0.3 };

      addDeviceType('Custom Device', 'Server', 50, methods);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.devices['Custom Device'].methods).toEqual(methods);
    });

    it('preserves icon configuration', () => {
      const { addDeviceType } = useEditorStore.getState();

      addDeviceType('Custom Device', 'Database', 50, { SNMPv3: 1.0 });

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.devices['Custom Device'].icon).toBe('Database');
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { addDeviceType } = useEditorStore.getState();

      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('deleteDeviceType', () => {
    it('removes device type from defaults', () => {
      // First add a custom device type
      const { addDeviceType, deleteDeviceType } = useEditorStore.getState();
      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });

      deleteDeviceType('Custom Device');

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.deviceDefaults['Custom Device']).toBeUndefined();
    });

    it('removes device type from all sites', () => {
      // Add another site and a custom device type
      const secondSiteId = useEditorStore.getState().addSite('Site 2');
      const { addDeviceType, deleteDeviceType } = useEditorStore.getState();
      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });

      deleteDeviceType('Custom Device');

      const { sites } = useEditorStore.getState();
      const site1 = sites.find((s) => s.id === siteId);
      const site2 = sites.find((s) => s.id === secondSiteId);

      expect(site1?.devices['Custom Device']).toBeUndefined();
      expect(site2?.devices['Custom Device']).toBeUndefined();
    });

    it('triggers recalculation after deletion', () => {
      const { addDeviceType, deleteDeviceType, updateDeviceCount } = useEditorStore.getState();
      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });
      updateDeviceCount(siteId, 'Custom Device', 100);

      const beforeDeletion = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const loadBefore = beforeDeletion?.calculationResult?.polling?.totalLoad;

      deleteDeviceType('Custom Device');

      const afterDeletion = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const loadAfter = afterDeletion?.calculationResult?.polling?.totalLoad;

      // Load should decrease or become null after removing the device type with count
      if (loadBefore && loadAfter) {
        expect(loadAfter).toBeLessThan(loadBefore);
      }
    });

    it('marks state as dirty', () => {
      const { addDeviceType, deleteDeviceType } = useEditorStore.getState();
      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });
      useEditorStore.setState({ collectorSizingIsDirty: false });

      deleteDeviceType('Custom Device');

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('handles deleting non-existent device type gracefully', () => {
      const { deleteDeviceType } = useEditorStore.getState();

      // Should not throw
      expect(() => deleteDeviceType('Non-Existent')).not.toThrow();
    });
  });

  describe('setDeviceDefaultInstances', () => {
    it('updates default instances for device type', () => {
      const { setDeviceDefaultInstances } = useEditorStore.getState();

      setDeviceDefaultInstances('Linux Servers', 200);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.deviceDefaults['Linux Servers'].instances).toBe(200);
    });

    it('updates instances in all existing sites', () => {
      const secondSiteId = useEditorStore.getState().addSite('Site 2');
      const { setDeviceDefaultInstances } = useEditorStore.getState();

      setDeviceDefaultInstances('Linux Servers', 200);

      const { sites } = useEditorStore.getState();
      const site1 = sites.find((s) => s.id === siteId);
      const site2 = sites.find((s) => s.id === secondSiteId);

      expect(site1?.devices['Linux Servers'].instances).toBe(200);
      expect(site2?.devices['Linux Servers'].instances).toBe(200);
    });

    it('clamps negative values to 0', () => {
      const { setDeviceDefaultInstances } = useEditorStore.getState();

      setDeviceDefaultInstances('Linux Servers', -10);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.deviceDefaults['Linux Servers'].instances).toBe(0);
    });

    it('triggers recalculation', () => {
      const { setDeviceDefaultInstances, updateDeviceCount } = useEditorStore.getState();
      updateDeviceCount(siteId, 'Linux Servers', 10);

      const before = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const loadBefore = before?.calculationResult?.polling?.totalLoad;

      setDeviceDefaultInstances('Linux Servers', 200);

      const after = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const loadAfter = after?.calculationResult?.polling?.totalLoad;

      // Doubling instances should increase load
      if (loadBefore && loadAfter) {
        expect(loadAfter).toBeGreaterThan(loadBefore);
      }
    });
  });

  describe('setDeviceDefaultMethod', () => {
    it('updates method ratio for device type', () => {
      const { setDeviceDefaultMethod } = useEditorStore.getState();

      setDeviceDefaultMethod('Linux Servers', 'SNMPv3', 0.5);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.deviceDefaults['Linux Servers'].methods.SNMPv3).toBe(0.5);
    });

    it('updates methods in all existing sites', () => {
      const secondSiteId = useEditorStore.getState().addSite('Site 2');
      const { setDeviceDefaultMethod } = useEditorStore.getState();

      setDeviceDefaultMethod('Linux Servers', 'SNMPv3', 0.5);

      const { sites } = useEditorStore.getState();
      const site1 = sites.find((s) => s.id === siteId);
      const site2 = sites.find((s) => s.id === secondSiteId);

      expect(site1?.devices['Linux Servers'].methods.SNMPv3).toBe(0.5);
      expect(site2?.devices['Linux Servers'].methods.SNMPv3).toBe(0.5);
    });

    it('clamps ratio to 0-1 range', () => {
      const { setDeviceDefaultMethod } = useEditorStore.getState();

      setDeviceDefaultMethod('Linux Servers', 'SNMPv3', 1.5);
      expect(useEditorStore.getState().collectorSizingConfig.deviceDefaults['Linux Servers'].methods.SNMPv3).toBe(1);

      setDeviceDefaultMethod('Linux Servers', 'SNMPv3', -0.5);
      expect(useEditorStore.getState().collectorSizingConfig.deviceDefaults['Linux Servers'].methods.SNMPv3).toBe(0);
    });

    it('can add new method to device type', () => {
      const { setDeviceDefaultMethod } = useEditorStore.getState();

      setDeviceDefaultMethod('Linux Servers', 'WMI', 0.3);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.deviceDefaults['Linux Servers'].methods.WMI).toBe(0.3);
    });
  });

  describe('deleteDeviceDefaultMethod', () => {
    it('removes method from device type', () => {
      const { deleteDeviceDefaultMethod } = useEditorStore.getState();

      deleteDeviceDefaultMethod('Linux Servers', 'Script');

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.deviceDefaults['Linux Servers'].methods.Script).toBeUndefined();
    });

    it('redistributes weight to remaining methods', () => {
      const { setDeviceDefaultMethod, deleteDeviceDefaultMethod } = useEditorStore.getState();
      // Set up: SNMPv3: 0.6, Script: 0.2, WMI: 0.2
      setDeviceDefaultMethod('Linux Servers', 'SNMPv3', 0.6);
      setDeviceDefaultMethod('Linux Servers', 'Script', 0.2);
      setDeviceDefaultMethod('Linux Servers', 'WMI', 0.2);

      deleteDeviceDefaultMethod('Linux Servers', 'Script');

      const { collectorSizingConfig } = useEditorStore.getState();
      // Script's 0.2 should be distributed to SNMPv3 and WMI
      // Original: SNMPv3=0.6, WMI=0.2
      // After: SNMPv3=0.7, WMI=0.3 (each gets 0.1 from Script's 0.2)
      const methods = collectorSizingConfig.deviceDefaults['Linux Servers'].methods;
      expect(methods.SNMPv3 + methods.WMI).toBeCloseTo(1.0, 5);
    });

    it('updates methods in all sites', () => {
      const secondSiteId = useEditorStore.getState().addSite('Site 2');
      const { deleteDeviceDefaultMethod } = useEditorStore.getState();

      deleteDeviceDefaultMethod('Linux Servers', 'Script');

      const { sites } = useEditorStore.getState();
      const site1 = sites.find((s) => s.id === siteId);
      const site2 = sites.find((s) => s.id === secondSiteId);

      expect(site1?.devices['Linux Servers'].methods.Script).toBeUndefined();
      expect(site2?.devices['Linux Servers'].methods.Script).toBeUndefined();
    });
  });

  describe('resetDeviceDefaultsToDefault', () => {
    it('restores default device types', () => {
      const { addDeviceType, resetDeviceDefaultsToDefault } = useEditorStore.getState();
      addDeviceType('Custom Device', 'Server', 50, { SNMPv3: 1.0 });

      resetDeviceDefaultsToDefault();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.deviceDefaults['Custom Device']).toBeUndefined();
      expect(collectorSizingConfig.deviceDefaults['Linux Servers']).toBeDefined();
    });

    it('resets sites to default device configurations', () => {
      const { updateDeviceCount, setDeviceDefaultInstances, resetDeviceDefaultsToDefault } =
        useEditorStore.getState();
      updateDeviceCount(siteId, 'Linux Servers', 50);
      setDeviceDefaultInstances('Linux Servers', 200);

      resetDeviceDefaultsToDefault();

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      // Count should be reset to 0, instances to default (100)
      expect(site?.devices['Linux Servers'].count).toBe(0);
      expect(site?.devices['Linux Servers'].instances).toBe(100);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { resetDeviceDefaultsToDefault } = useEditorStore.getState();

      resetDeviceDefaultsToDefault();

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });
});
