/**
 * Tests for log, trap, and flow update store actions.
 *
 * Tests updateLogCount, updateTrapCount, updateFlowCount,
 * and their effect on calculations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../../src/editor/stores/editor-store';
import { resetChromeMocks } from '../../setup';

// Get initial state for resets
const initialState = useEditorStore.getState();

function resetStore(): void {
  useEditorStore.setState(initialState, true);
}

describe('Log/Trap/Flow Updates', () => {
  let siteId: string;

  beforeEach(() => {
    resetStore();
    resetChromeMocks();
    // Ensure we start with no sites then add one
    useEditorStore.setState({ sites: [], activeSiteId: null });
    siteId = useEditorStore.getState().addSite('Test Site');
  });

  describe('updateLogCount', () => {
    it('sets log count', () => {
      const { updateLogCount } = useEditorStore.getState();

      updateLogCount(siteId, 'FIREWALLS', 50);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.logs.FIREWALLS.count).toBe(50);
    });

    it('clamps negative values to 0', () => {
      const { updateLogCount } = useEditorStore.getState();

      updateLogCount(siteId, 'FIREWALLS', -10);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.logs.FIREWALLS.count).toBe(0);
    });

    it('allows zero count', () => {
      const { updateLogCount } = useEditorStore.getState();
      // First set a non-zero value
      updateLogCount(siteId, 'FIREWALLS', 50);

      updateLogCount(siteId, 'FIREWALLS', 0);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.logs.FIREWALLS.count).toBe(0);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { updateLogCount } = useEditorStore.getState();

      updateLogCount(siteId, 'FIREWALLS', 50);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('triggers recalculation', () => {
      const { updateLogCount } = useEditorStore.getState();

      updateLogCount(siteId, 'FIREWALLS', 100);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.calculationResult).not.toBeNull();
    });

    it('updates logs recommendation after count change', () => {
      const { updateLogCount } = useEditorStore.getState();

      // Add enough logs to get a recommendation
      updateLogCount(siteId, 'FIREWALLS', 200);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.calculationResult?.logs).not.toBeNull();
    });

    it('only updates specified log type', () => {
      const { updateLogCount } = useEditorStore.getState();

      updateLogCount(siteId, 'FIREWALLS', 50);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.logs.NETWORK.count).toBe(0); // Default is 0
    });

    it('handles non-existent site gracefully', () => {
      const { updateLogCount } = useEditorStore.getState();

      // Should not throw
      expect(() => updateLogCount('non-existent', 'FIREWALLS', 50)).not.toThrow();
    });

    it('handles large log counts', () => {
      const { updateLogCount } = useEditorStore.getState();

      updateLogCount(siteId, 'FIREWALLS', 100000);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.logs.FIREWALLS.count).toBe(100000);
    });

    it('correctly calculates EPS', () => {
      const { updateLogCount } = useEditorStore.getState();

      // FIREWALLS has eps of 1
      updateLogCount(siteId, 'FIREWALLS', 100);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      // Total EPS should be 100 * 1 = 100
      expect(site?.calculationResult?.logs?.totalLoad).toBe(100);
    });
  });

  describe('updateTrapCount', () => {
    it('sets trap count', () => {
      const { updateTrapCount } = useEditorStore.getState();

      updateTrapCount(siteId, 'SNMP', 100);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.traps.SNMP.count).toBe(100);
    });

    it('clamps negative values to 0', () => {
      const { updateTrapCount } = useEditorStore.getState();

      updateTrapCount(siteId, 'SNMP', -10);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.traps.SNMP.count).toBe(0);
    });

    it('allows zero count', () => {
      const { updateTrapCount } = useEditorStore.getState();
      updateTrapCount(siteId, 'SNMP', 50);

      updateTrapCount(siteId, 'SNMP', 0);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.traps.SNMP.count).toBe(0);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { updateTrapCount } = useEditorStore.getState();

      updateTrapCount(siteId, 'SNMP', 100);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('triggers recalculation', () => {
      const { updateTrapCount } = useEditorStore.getState();

      updateTrapCount(siteId, 'SNMP', 100);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.calculationResult).not.toBeNull();
    });

    it('combines with logs for EPS calculation', () => {
      const { updateLogCount, updateTrapCount } = useEditorStore.getState();

      // FIREWALLS eps = 1, SNMP eps = 0.01
      updateLogCount(siteId, 'FIREWALLS', 100); // 100 EPS
      updateTrapCount(siteId, 'SNMP', 1000); // 10 EPS

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      // Total should be 110 EPS
      expect(site?.calculationResult?.logs?.totalLoad).toBe(110);
    });

    it('handles large trap counts', () => {
      const { updateTrapCount } = useEditorStore.getState();

      updateTrapCount(siteId, 'SNMP', 1000000);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.traps.SNMP.count).toBe(1000000);
    });
  });

  describe('updateFlowCount', () => {
    it('sets flow count', () => {
      const { updateFlowCount } = useEditorStore.getState();

      updateFlowCount(siteId, 'NETFLOW', 10);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.flows.NETFLOW.count).toBe(10);
    });

    it('clamps negative values to 0', () => {
      const { updateFlowCount } = useEditorStore.getState();

      updateFlowCount(siteId, 'NETFLOW', -5);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.flows.NETFLOW.count).toBe(0);
    });

    it('allows zero count', () => {
      const { updateFlowCount } = useEditorStore.getState();
      updateFlowCount(siteId, 'NETFLOW', 10);

      updateFlowCount(siteId, 'NETFLOW', 0);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.flows.NETFLOW.count).toBe(0);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { updateFlowCount } = useEditorStore.getState();

      updateFlowCount(siteId, 'NETFLOW', 10);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('triggers recalculation', () => {
      const { updateFlowCount } = useEditorStore.getState();

      updateFlowCount(siteId, 'NETFLOW', 10);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.calculationResult).not.toBeNull();
    });

    it('updates netflow recommendation after count change', () => {
      const { updateFlowCount } = useEditorStore.getState();

      updateFlowCount(siteId, 'NETFLOW', 10);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.calculationResult?.netflow).not.toBeNull();
    });

    it('correctly calculates FPS', () => {
      const { updateFlowCount } = useEditorStore.getState();

      // NETFLOW has fps of 1100
      updateFlowCount(siteId, 'NETFLOW', 5);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      // Total FPS should be 5 * 1100 = 5500
      expect(site?.calculationResult?.netflow?.totalLoad).toBe(5500);
    });

    it('handles large flow counts', () => {
      const { updateFlowCount } = useEditorStore.getState();

      updateFlowCount(siteId, 'NETFLOW', 1000);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);
      expect(site?.flows.NETFLOW.count).toBe(1000);
    });

    it('netflow has no failover regardless of settings', () => {
      const { updateFlowCount, setPollingFailover, setLogsFailover } = useEditorStore.getState();
      setPollingFailover(true);
      setLogsFailover(true);

      updateFlowCount(siteId, 'NETFLOW', 10);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);

      // Compare with a second calculation without failover to verify they're the same
      const countWithFailover = site?.calculationResult?.netflow?.count;

      setPollingFailover(false);
      setLogsFailover(false);

      const { sites: sitesAfter } = useEditorStore.getState();
      const siteAfter = sitesAfter.find((s) => s.id === siteId);
      const countWithoutFailover = siteAfter?.calculationResult?.netflow?.count;

      expect(countWithFailover).toBe(countWithoutFailover);
    });
  });

  describe('combined updates', () => {
    it('all three types can have recommendations simultaneously', () => {
      const { updateDeviceCount, updateLogCount, updateFlowCount } = useEditorStore.getState();

      updateDeviceCount(siteId, 'Linux Servers', 100);
      updateLogCount(siteId, 'FIREWALLS', 200);
      updateFlowCount(siteId, 'NETFLOW', 10);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);

      expect(site?.calculationResult?.polling).not.toBeNull();
      expect(site?.calculationResult?.logs).not.toBeNull();
      expect(site?.calculationResult?.netflow).not.toBeNull();
    });

    it('removing all resources clears recommendations', () => {
      const { updateDeviceCount, updateLogCount, updateFlowCount } = useEditorStore.getState();

      // Add resources
      updateDeviceCount(siteId, 'Linux Servers', 100);
      updateLogCount(siteId, 'FIREWALLS', 200);
      updateFlowCount(siteId, 'NETFLOW', 10);

      // Remove all resources
      updateDeviceCount(siteId, 'Linux Servers', 0);
      updateLogCount(siteId, 'FIREWALLS', 0);
      updateFlowCount(siteId, 'NETFLOW', 0);

      const { sites } = useEditorStore.getState();
      const site = sites.find((s) => s.id === siteId);

      expect(site?.calculationResult?.polling).toBeNull();
      expect(site?.calculationResult?.logs).toBeNull();
      expect(site?.calculationResult?.netflow).toBeNull();
    });
  });
});
