/**
 * Tests for site-level calculation functions.
 *
 * Tests calculateSiteRecommendations which produces complete
 * collector recommendations for polling, logs, and netflow.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSiteRecommendations,
  createDefaultMethodWeights,
  createDefaultCollectorCapacities,
} from '../../../src/editor/utils/collector-calculations';
import {
  createMockDeviceConfig,
  createMockLogConfig,
  createMockTrapConfig,
  createMockFlowConfig,
  createZeroCountDevices,
  createZeroCountLogs,
  createZeroCountTraps,
  createZeroCountFlows,
} from '../../helpers/collector-sizing-helpers';

describe('calculateSiteRecommendations', () => {
  const baseConfig = {
    maxLoadPercent: 85,
    methodWeights: createDefaultMethodWeights(),
    pollingFailover: false,
    logsFailover: false,
    collectorCapacities: createDefaultCollectorCapacities(),
    forcedCollectorSize: 'auto' as const,
  };

  describe('empty site', () => {
    it('returns all null when no resources', () => {
      const result = calculateSiteRecommendations(
        createZeroCountDevices(),
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        baseConfig
      );

      expect(result.polling).toBeNull();
      expect(result.logs).toBeNull();
      expect(result.netflow).toBeNull();
    });

    it('returns all null for empty records', () => {
      const result = calculateSiteRecommendations({}, {}, {}, {}, baseConfig);

      expect(result.polling).toBeNull();
      expect(result.logs).toBeNull();
      expect(result.netflow).toBeNull();
    });
  });

  describe('polling only', () => {
    it('returns polling recommendation when only devices present', () => {
      const devices = {
        'Linux Servers': createMockDeviceConfig({ count: 100, instances: 100, methods: { SNMPv3: 1.0 } }),
      };

      const result = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        baseConfig
      );

      expect(result.polling).not.toBeNull();
      expect(result.logs).toBeNull();
      expect(result.netflow).toBeNull();
    });

    it('calculates correct polling load', () => {
      const devices = {
        'Linux Servers': createMockDeviceConfig({ count: 10, instances: 100, methods: { SNMPv3: 1.0 } }),
      };

      const result = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        baseConfig
      );

      expect(result.polling).not.toBeNull();
      // 10 * 100 * 1.3 = 1300
      expect(result.polling!.totalLoad).toBe(1300);
    });

    it('respects polling failover setting', () => {
      const devices = {
        'Linux Servers': createMockDeviceConfig({ count: 100, instances: 100, methods: { SNMPv3: 1.0 } }),
      };

      const withoutFailover = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        { ...baseConfig, pollingFailover: false }
      );

      const withFailover = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        { ...baseConfig, pollingFailover: true }
      );

      expect(withFailover.polling!.count).toBe(withoutFailover.polling!.count + 1);
    });
  });

  describe('logs only', () => {
    it('returns logs recommendation when only logs present', () => {
      const logs = {
        FIREWALLS: createMockLogConfig({ count: 100, eps: 1 }),
      };

      const result = calculateSiteRecommendations(
        createZeroCountDevices(),
        logs,
        createZeroCountTraps(),
        createZeroCountFlows(),
        baseConfig
      );

      expect(result.polling).toBeNull();
      expect(result.logs).not.toBeNull();
      expect(result.netflow).toBeNull();
    });

    it('combines logs and traps for EPS', () => {
      const logs = {
        FIREWALLS: createMockLogConfig({ count: 10, eps: 1 }),
      };
      const traps = {
        SNMP: createMockTrapConfig({ count: 100, eps: 0.1 }),
      };

      const result = calculateSiteRecommendations(
        createZeroCountDevices(),
        logs,
        traps,
        createZeroCountFlows(),
        baseConfig
      );

      expect(result.logs).not.toBeNull();
      // Logs: 10 * 1 = 10, Traps: 100 * 0.1 = 10, Total: 20
      expect(result.logs!.totalLoad).toBe(20);
    });

    it('respects logs failover setting', () => {
      const logs = {
        FIREWALLS: createMockLogConfig({ count: 100, eps: 1 }),
      };

      const withoutFailover = calculateSiteRecommendations(
        createZeroCountDevices(),
        logs,
        createZeroCountTraps(),
        createZeroCountFlows(),
        { ...baseConfig, logsFailover: false }
      );

      const withFailover = calculateSiteRecommendations(
        createZeroCountDevices(),
        logs,
        createZeroCountTraps(),
        createZeroCountFlows(),
        { ...baseConfig, logsFailover: true }
      );

      expect(withFailover.logs!.count).toBe(withoutFailover.logs!.count + 1);
    });
  });

  describe('netflow only', () => {
    it('returns netflow recommendation when only flows present', () => {
      const flows = {
        NETFLOW: createMockFlowConfig({ count: 10, fps: 1100 }),
      };

      const result = calculateSiteRecommendations(
        createZeroCountDevices(),
        createZeroCountLogs(),
        createZeroCountTraps(),
        flows,
        baseConfig
      );

      expect(result.polling).toBeNull();
      expect(result.logs).toBeNull();
      expect(result.netflow).not.toBeNull();
    });

    it('calculates correct FPS load', () => {
      const flows = {
        NETFLOW: createMockFlowConfig({ count: 5, fps: 1100 }),
      };

      const result = calculateSiteRecommendations(
        createZeroCountDevices(),
        createZeroCountLogs(),
        createZeroCountTraps(),
        flows,
        baseConfig
      );

      expect(result.netflow).not.toBeNull();
      // 5 * 1100 = 5500
      expect(result.netflow!.totalLoad).toBe(5500);
    });

    it('netflow never has failover', () => {
      const flows = {
        NETFLOW: createMockFlowConfig({ count: 10, fps: 1100 }),
      };

      // Even with both failover options enabled
      const result = calculateSiteRecommendations(
        createZeroCountDevices(),
        createZeroCountLogs(),
        createZeroCountTraps(),
        flows,
        { ...baseConfig, pollingFailover: true, logsFailover: true }
      );

      // NetFlow should not have an extra failover collector
      // Compare with base count
      const baseResult = calculateSiteRecommendations(
        createZeroCountDevices(),
        createZeroCountLogs(),
        createZeroCountTraps(),
        flows,
        baseConfig
      );

      expect(result.netflow!.count).toBe(baseResult.netflow!.count);
    });
  });

  describe('all three types', () => {
    it('returns recommendations for all types when all present', () => {
      const devices = {
        'Linux Servers': createMockDeviceConfig({ count: 50, instances: 100, methods: { SNMPv3: 1.0 } }),
      };
      const logs = {
        FIREWALLS: createMockLogConfig({ count: 100, eps: 1 }),
      };
      const traps = {
        SNMP: createMockTrapConfig({ count: 50, eps: 0.1 }),
      };
      const flows = {
        NETFLOW: createMockFlowConfig({ count: 10, fps: 1100 }),
      };

      const result = calculateSiteRecommendations(devices, logs, traps, flows, baseConfig);

      expect(result.polling).not.toBeNull();
      expect(result.logs).not.toBeNull();
      expect(result.netflow).not.toBeNull();
    });

    it('calculations are independent', () => {
      const devices = {
        'Linux Servers': createMockDeviceConfig({ count: 50, instances: 100, methods: { SNMPv3: 1.0 } }),
      };
      const logs = {
        FIREWALLS: createMockLogConfig({ count: 100, eps: 1 }),
      };
      const flows = {
        NETFLOW: createMockFlowConfig({ count: 10, fps: 1100 }),
      };

      const result = calculateSiteRecommendations(
        devices, logs, createZeroCountTraps(), flows, baseConfig
      );

      // Polling: 50 * 100 * 1.3 = 6500
      expect(result.polling!.totalLoad).toBe(6500);
      // Logs: 100 * 1 = 100
      expect(result.logs!.totalLoad).toBe(100);
      // NetFlow: 10 * 1100 = 11000
      expect(result.netflow!.totalLoad).toBe(11000);
    });
  });

  describe('configuration options', () => {
    it('respects maxLoadPercent', () => {
      const devices = {
        'Linux Servers': createMockDeviceConfig({ count: 500, instances: 100, methods: { SNMPv3: 1.0 } }),
      };

      const at50 = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        { ...baseConfig, maxLoadPercent: 50 }
      );

      const at100 = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        { ...baseConfig, maxLoadPercent: 100 }
      );

      // Lower max load should result in more collectors
      expect(at50.polling!.count).toBeGreaterThanOrEqual(at100.polling!.count);
    });

    it('respects forced collector size', () => {
      const devices = {
        'Linux Servers': createMockDeviceConfig({ count: 10, instances: 100, methods: { SNMPv3: 1.0 } }),
      };

      const result = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        { ...baseConfig, forcedCollectorSize: 'SMALL' }
      );

      expect(result.polling!.size).toBe('SMALL');
    });

    it('respects custom method weights', () => {
      const devices = {
        'Linux Servers': createMockDeviceConfig({ count: 10, instances: 100, methods: { SNMPv3: 1.0 } }),
      };

      const customWeights = {
        ...createDefaultMethodWeights(),
        SNMPv3: 2.0, // Double the default
      };

      const defaultResult = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        baseConfig
      );

      const customResult = calculateSiteRecommendations(
        devices,
        createZeroCountLogs(),
        createZeroCountTraps(),
        createZeroCountFlows(),
        { ...baseConfig, methodWeights: customWeights }
      );

      // Custom weight is higher, so load should be higher
      expect(customResult.polling!.totalLoad).toBeGreaterThan(defaultResult.polling!.totalLoad);
    });
  });
});
