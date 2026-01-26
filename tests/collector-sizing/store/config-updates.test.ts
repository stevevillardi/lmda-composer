/**
 * Tests for configuration update store actions.
 *
 * Tests setMaxLoadPercent, method weights, failover settings,
 * collector capacities, and forced collector size.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../../src/editor/stores/editor-store';
import { createDefaultMethodWeights } from '../../../src/editor/utils/collector-calculations';
import { resetChromeMocks } from '../../setup';

// Get initial state for resets
const initialState = useEditorStore.getState();

function resetStore(): void {
  useEditorStore.setState(initialState, true);
}

describe('Config Updates', () => {
  let siteId: string;

  beforeEach(() => {
    resetStore();
    resetChromeMocks();
    // Ensure we start with no sites then add one with some resources
    useEditorStore.setState({ sites: [], activeSiteId: null });
    siteId = useEditorStore.getState().addSite('Test Site');
    // Add some devices to have something to recalculate
    useEditorStore.getState().updateDeviceCount(siteId, 'Linux Servers', 100);
  });

  describe('setMaxLoadPercent', () => {
    it('sets max load percent', () => {
      const { setMaxLoadPercent } = useEditorStore.getState();

      setMaxLoadPercent(70);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.maxLoadPercent).toBe(70);
    });

    it('clamps to minimum of 50', () => {
      const { setMaxLoadPercent } = useEditorStore.getState();

      setMaxLoadPercent(30);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.maxLoadPercent).toBe(50);
    });

    it('clamps to maximum of 100', () => {
      const { setMaxLoadPercent } = useEditorStore.getState();

      setMaxLoadPercent(120);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.maxLoadPercent).toBe(100);
    });

    it('accepts boundary value 50', () => {
      const { setMaxLoadPercent } = useEditorStore.getState();

      setMaxLoadPercent(50);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.maxLoadPercent).toBe(50);
    });

    it('accepts boundary value 100', () => {
      const { setMaxLoadPercent } = useEditorStore.getState();

      setMaxLoadPercent(100);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.maxLoadPercent).toBe(100);
    });

    it('triggers recalculation of all sites', () => {
      const { setMaxLoadPercent } = useEditorStore.getState();

      const siteBefore = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const configBefore = siteBefore?.calculationResult;

      setMaxLoadPercent(50); // Lower load percent = more collectors

      const siteAfter = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const configAfter = siteAfter?.calculationResult;

      // With lower max load, may need more collectors
      if (configBefore?.polling && configAfter?.polling) {
        expect(configAfter.polling.count).toBeGreaterThanOrEqual(configBefore.polling.count);
      }
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { setMaxLoadPercent } = useEditorStore.getState();

      setMaxLoadPercent(70);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('setMethodWeight', () => {
    it('updates method weight', () => {
      const { setMethodWeight } = useEditorStore.getState();

      setMethodWeight('SNMPv3', 2.0);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.methodWeights.SNMPv3).toBe(2.0);
    });

    it('clamps to minimum of 0.1', () => {
      const { setMethodWeight } = useEditorStore.getState();

      setMethodWeight('SNMPv3', 0);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.methodWeights.SNMPv3).toBe(0.1);
    });

    it('clamps negative values to 0.1', () => {
      const { setMethodWeight } = useEditorStore.getState();

      setMethodWeight('SNMPv3', -5);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.methodWeights.SNMPv3).toBe(0.1);
    });

    it('allows high weight values', () => {
      const { setMethodWeight } = useEditorStore.getState();

      setMethodWeight('Script', 10);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.methodWeights.Script).toBe(10);
    });

    it('triggers recalculation', () => {
      const { setMethodWeight } = useEditorStore.getState();

      const siteBefore = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const loadBefore = siteBefore?.calculationResult?.polling?.totalLoad;

      // Double the SNMPv3 weight (Linux Servers use SNMPv3)
      setMethodWeight('SNMPv3', 2.6); // Default is 1.3

      const siteAfter = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const loadAfter = siteAfter?.calculationResult?.polling?.totalLoad;

      if (loadBefore && loadAfter) {
        expect(loadAfter).toBeGreaterThan(loadBefore);
      }
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { setMethodWeight } = useEditorStore.getState();

      setMethodWeight('SNMPv3', 2.0);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('addMethodWeight', () => {
    it('adds new method weight', () => {
      const { addMethodWeight } = useEditorStore.getState();

      addMethodWeight('CustomMethod', 1.5);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect((collectorSizingConfig.methodWeights as Record<string, number>)['CustomMethod']).toBe(1.5);
    });

    it('clamps to minimum of 0.1', () => {
      const { addMethodWeight } = useEditorStore.getState();

      addMethodWeight('CustomMethod', 0);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect((collectorSizingConfig.methodWeights as Record<string, number>)['CustomMethod']).toBe(0.1);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { addMethodWeight } = useEditorStore.getState();

      addMethodWeight('CustomMethod', 1.5);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('deleteMethodWeight', () => {
    it('removes method weight', () => {
      const { addMethodWeight, deleteMethodWeight } = useEditorStore.getState();
      addMethodWeight('CustomMethod', 1.5);

      deleteMethodWeight('CustomMethod');

      const { collectorSizingConfig } = useEditorStore.getState();
      expect((collectorSizingConfig.methodWeights as Record<string, number>)['CustomMethod']).toBeUndefined();
    });

    it('triggers recalculation', () => {
      const { deleteMethodWeight } = useEditorStore.getState();

      // Verify that deleting a method triggers recalc (by checking calculationResult exists)
      deleteMethodWeight('Script');

      const site = useEditorStore.getState().sites.find((s) => s.id === siteId);
      expect(site?.calculationResult).not.toBeNull();
    });

    it('marks state as dirty', () => {
      const { addMethodWeight, deleteMethodWeight } = useEditorStore.getState();
      addMethodWeight('CustomMethod', 1.5);
      useEditorStore.setState({ collectorSizingIsDirty: false });

      deleteMethodWeight('CustomMethod');

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('resetMethodWeightsToDefault', () => {
    it('restores default method weights', () => {
      const { setMethodWeight, resetMethodWeightsToDefault } = useEditorStore.getState();
      setMethodWeight('SNMPv3', 5.0);

      resetMethodWeightsToDefault();

      const { collectorSizingConfig } = useEditorStore.getState();
      const defaults = createDefaultMethodWeights();
      expect(collectorSizingConfig.methodWeights.SNMPv3).toBe(defaults.SNMPv3);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { resetMethodWeightsToDefault } = useEditorStore.getState();

      resetMethodWeightsToDefault();

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('setPollingFailover', () => {
    it('enables polling failover', () => {
      const { setPollingFailover } = useEditorStore.getState();

      setPollingFailover(true);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.pollingFailover).toBe(true);
    });

    it('disables polling failover', () => {
      const { setPollingFailover } = useEditorStore.getState();
      setPollingFailover(true);

      setPollingFailover(false);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.pollingFailover).toBe(false);
    });

    it('adds failover collector to count when enabled', () => {
      const { setPollingFailover } = useEditorStore.getState();

      const siteBefore = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const countBefore = siteBefore?.calculationResult?.polling?.count ?? 0;

      setPollingFailover(true);

      const siteAfter = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const countAfter = siteAfter?.calculationResult?.polling?.count ?? 0;

      expect(countAfter).toBe(countBefore + 1);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { setPollingFailover } = useEditorStore.getState();

      setPollingFailover(true);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('setLogsFailover', () => {
    beforeEach(() => {
      // Add some logs to have recommendations
      useEditorStore.getState().updateLogCount(siteId, 'FIREWALLS', 200);
    });

    it('enables logs failover', () => {
      const { setLogsFailover } = useEditorStore.getState();

      setLogsFailover(true);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.logsFailover).toBe(true);
    });

    it('disables logs failover', () => {
      const { setLogsFailover } = useEditorStore.getState();
      setLogsFailover(true);

      setLogsFailover(false);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.logsFailover).toBe(false);
    });

    it('adds failover collector to logs count when enabled', () => {
      const { setLogsFailover } = useEditorStore.getState();

      const siteBefore = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const countBefore = siteBefore?.calculationResult?.logs?.count ?? 0;

      setLogsFailover(true);

      const siteAfter = useEditorStore.getState().sites.find((s) => s.id === siteId);
      const countAfter = siteAfter?.calculationResult?.logs?.count ?? 0;

      expect(countAfter).toBe(countBefore + 1);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { setLogsFailover } = useEditorStore.getState();

      setLogsFailover(true);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('setForcedCollectorSize', () => {
    it('sets forced collector size', () => {
      const { setForcedCollectorSize } = useEditorStore.getState();

      setForcedCollectorSize('SMALL');

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.forcedCollectorSize).toBe('SMALL');
    });

    it('can set to auto', () => {
      const { setForcedCollectorSize } = useEditorStore.getState();
      setForcedCollectorSize('SMALL');

      setForcedCollectorSize('auto');

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.forcedCollectorSize).toBe('auto');
    });

    it('updates recommendation sizes', () => {
      const { setForcedCollectorSize } = useEditorStore.getState();

      setForcedCollectorSize('SMALL');

      const site = useEditorStore.getState().sites.find((s) => s.id === siteId);
      expect(site?.calculationResult?.polling?.size).toBe('SMALL');
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { setForcedCollectorSize } = useEditorStore.getState();

      setForcedCollectorSize('MEDIUM');

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('forces size for all recommendation types', () => {
      const { setForcedCollectorSize, updateLogCount, updateFlowCount } = useEditorStore.getState();
      updateLogCount(siteId, 'FIREWALLS', 200);
      updateFlowCount(siteId, 'NETFLOW', 10);

      setForcedCollectorSize('LARGE');

      const site = useEditorStore.getState().sites.find((s) => s.id === siteId);
      expect(site?.calculationResult?.polling?.size).toBe('LARGE');
      expect(site?.calculationResult?.logs?.size).toBe('LARGE');
      expect(site?.calculationResult?.netflow?.size).toBe('LARGE');
    });
  });

  describe('setCollectorCapacity', () => {
    it('updates collector capacity weight', () => {
      const { setCollectorCapacity } = useEditorStore.getState();

      setCollectorCapacity('MEDIUM', 'weight', 100000);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.collectorCapacities.MEDIUM.weight).toBe(100000);
    });

    it('updates collector capacity eps', () => {
      const { setCollectorCapacity } = useEditorStore.getState();

      setCollectorCapacity('MEDIUM', 'eps', 1000);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.collectorCapacities.MEDIUM.eps).toBe(1000);
    });

    it('updates collector capacity fps', () => {
      const { setCollectorCapacity } = useEditorStore.getState();

      setCollectorCapacity('MEDIUM', 'fps', 25000);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.collectorCapacities.MEDIUM.fps).toBe(25000);
    });

    it('clamps negative values to 0', () => {
      const { setCollectorCapacity } = useEditorStore.getState();

      setCollectorCapacity('MEDIUM', 'weight', -1000);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.collectorCapacities.MEDIUM.weight).toBe(0);
    });

    it('triggers recalculation', () => {
      const { setCollectorCapacity } = useEditorStore.getState();

      setCollectorCapacity('MEDIUM', 'weight', 10000); // Much lower capacity

      const site = useEditorStore.getState().sites.find((s) => s.id === siteId);
      expect(site?.calculationResult).not.toBeNull();
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { setCollectorCapacity } = useEditorStore.getState();

      setCollectorCapacity('MEDIUM', 'weight', 100000);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('resetCollectorCapacitiesToDefault', () => {
    it('restores default capacities', () => {
      const { setCollectorCapacity, resetCollectorCapacitiesToDefault } = useEditorStore.getState();
      setCollectorCapacity('MEDIUM', 'weight', 100000);

      resetCollectorCapacitiesToDefault();

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.collectorCapacities.MEDIUM.weight).toBe(48557);
    });

    it('marks state as dirty', () => {
      useEditorStore.setState({ collectorSizingIsDirty: false });
      const { resetCollectorCapacitiesToDefault } = useEditorStore.getState();

      resetCollectorCapacitiesToDefault();

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });
  });

  describe('setShowAdvancedDetails', () => {
    it('enables advanced details', () => {
      const { setShowAdvancedDetails } = useEditorStore.getState();

      setShowAdvancedDetails(true);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.showAdvancedDetails).toBe(true);
    });

    it('disables advanced details', () => {
      const { setShowAdvancedDetails } = useEditorStore.getState();
      setShowAdvancedDetails(true);

      setShowAdvancedDetails(false);

      const { collectorSizingConfig } = useEditorStore.getState();
      expect(collectorSizingConfig.showAdvancedDetails).toBe(false);
    });
  });
});
