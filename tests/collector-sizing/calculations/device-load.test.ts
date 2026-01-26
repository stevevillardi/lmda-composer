/**
 * Tests for device load calculation functions.
 *
 * Tests calculateDeviceLoad and calculateTotalPollingLoad functions
 * which compute weighted load scores for collector sizing.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateDeviceLoad,
  calculateTotalPollingLoad,
  createDefaultMethodWeights,
} from '../../../src/editor/utils/collector-calculations';
import {
  createMockDeviceConfig,
  createEmptyDevices,
} from '../../helpers/collector-sizing-helpers';

describe('calculateDeviceLoad', () => {
  const methodWeights = createDefaultMethodWeights();

  it('returns 0 for zero device count', () => {
    const device = createMockDeviceConfig({ count: 0 });
    const result = calculateDeviceLoad(device, methodWeights);
    expect(result).toBe(0);
  });

  it('calculates single method load correctly', () => {
    // Device with 10 devices, 100 instances, 100% SNMPv3 (weight 1.3)
    const device = createMockDeviceConfig({
      count: 10,
      instances: 100,
      methods: { SNMPv3: 1.0 },
    });
    const result = calculateDeviceLoad(device, methodWeights);
    // Expected: 10 * 100 * (1.0 * 1.3) = 1300
    expect(result).toBe(1300);
  });

  it('calculates multi-method load correctly', () => {
    // Device with 10 devices, 100 instances, 80% SNMPv3 + 20% Script
    const device = createMockDeviceConfig({
      count: 10,
      instances: 100,
      methods: { SNMPv3: 0.8, Script: 0.2 },
    });
    const result = calculateDeviceLoad(device, methodWeights);
    // SNMPv3 weight = 1.3, Script weight = 5
    // Expected: 10 * 100 * (0.8 * 1.3 + 0.2 * 5) = 10 * 100 * (1.04 + 1.0) = 2040
    expect(result).toBe(2040);
  });

  it('handles three methods correctly', () => {
    const device = createMockDeviceConfig({
      count: 5,
      instances: 50,
      methods: { SNMPv3: 0.5, Script: 0.3, WMI: 0.2 },
    });
    const result = calculateDeviceLoad(device, methodWeights);
    // SNMPv3=1.3, Script=5, WMI=2.2
    // Expected: 5 * 50 * (0.5*1.3 + 0.3*5 + 0.2*2.2) = 250 * (0.65 + 1.5 + 0.44) = 250 * 2.59 = 647.5
    expect(result).toBe(647.5);
  });

  it('uses default weight 1 for unknown methods', () => {
    const device = createMockDeviceConfig({
      count: 10,
      instances: 10,
      methods: { UnknownMethod: 1.0 },
    });
    const result = calculateDeviceLoad(device, methodWeights);
    // Unknown method falls back to weight 1
    // Expected: 10 * 10 * (1.0 * 1) = 100
    expect(result).toBe(100);
  });

  it('handles mixed known and unknown methods', () => {
    const device = createMockDeviceConfig({
      count: 10,
      instances: 10,
      methods: { SNMPv3: 0.5, UnknownMethod: 0.5 },
    });
    const result = calculateDeviceLoad(device, methodWeights);
    // SNMPv3=1.3, UnknownMethod=1 (default)
    // Expected: 10 * 10 * (0.5*1.3 + 0.5*1) = 100 * (0.65 + 0.5) = 115
    expect(result).toBeCloseTo(115, 5);
  });

  it('handles empty methods object', () => {
    const device = createMockDeviceConfig({
      count: 10,
      instances: 100,
      methods: {},
    });
    const result = calculateDeviceLoad(device, methodWeights);
    // No methods means 0 weighted score
    expect(result).toBe(0);
  });

  it('handles single instance correctly', () => {
    const device = createMockDeviceConfig({
      count: 1,
      instances: 1,
      methods: { Script: 1.0 },
    });
    const result = calculateDeviceLoad(device, methodWeights);
    // Script weight = 5
    // Expected: 1 * 1 * (1.0 * 5) = 5
    expect(result).toBe(5);
  });

  it('scales linearly with device count', () => {
    const baseDevice = createMockDeviceConfig({
      count: 1,
      instances: 100,
      methods: { SNMPv3: 1.0 },
    });
    const doubledDevice = createMockDeviceConfig({
      count: 2,
      instances: 100,
      methods: { SNMPv3: 1.0 },
    });

    const baseLoad = calculateDeviceLoad(baseDevice, methodWeights);
    const doubledLoad = calculateDeviceLoad(doubledDevice, methodWeights);

    expect(doubledLoad).toBe(baseLoad * 2);
  });

  it('scales linearly with instances', () => {
    const baseDevice = createMockDeviceConfig({
      count: 10,
      instances: 50,
      methods: { SNMPv3: 1.0 },
    });
    const doubledDevice = createMockDeviceConfig({
      count: 10,
      instances: 100,
      methods: { SNMPv3: 1.0 },
    });

    const baseLoad = calculateDeviceLoad(baseDevice, methodWeights);
    const doubledLoad = calculateDeviceLoad(doubledDevice, methodWeights);

    expect(doubledLoad).toBe(baseLoad * 2);
  });
});

describe('calculateTotalPollingLoad', () => {
  const methodWeights = createDefaultMethodWeights();

  it('returns 0 for empty devices record', () => {
    const result = calculateTotalPollingLoad(createEmptyDevices(), methodWeights);
    expect(result).toBe(0);
  });

  it('calculates single device type correctly', () => {
    const devices = {
      'Linux Servers': createMockDeviceConfig({
        count: 10,
        instances: 100,
        methods: { SNMPv3: 1.0 },
      }),
    };
    const result = calculateTotalPollingLoad(devices, methodWeights);
    // Expected: 10 * 100 * (1.0 * 1.3) = 1300
    expect(result).toBe(1300);
  });

  it('aggregates multiple device types', () => {
    const devices = {
      'Linux Servers': createMockDeviceConfig({
        count: 10,
        instances: 100,
        methods: { SNMPv3: 1.0 },
      }),
      'Windows Servers': createMockDeviceConfig({
        count: 5,
        instances: 50,
        methods: { Script: 1.0 },
      }),
    };
    const result = calculateTotalPollingLoad(devices, methodWeights);
    // Linux: 10 * 100 * 1.3 = 1300
    // Windows: 5 * 50 * 5 = 1250
    // Total: 2550
    expect(result).toBe(2550);
  });

  it('handles devices with zero counts mixed with non-zero', () => {
    const devices = {
      'Linux Servers': createMockDeviceConfig({
        count: 10,
        instances: 100,
        methods: { SNMPv3: 1.0 },
      }),
      'Zero Devices': createMockDeviceConfig({
        count: 0,
        instances: 100,
        methods: { SNMPv3: 1.0 },
      }),
    };
    const result = calculateTotalPollingLoad(devices, methodWeights);
    // Only Linux contributes: 10 * 100 * 1.3 = 1300
    expect(result).toBe(1300);
  });

  it('returns 0 when all devices have zero counts', () => {
    const devices = {
      'Linux Servers': createMockDeviceConfig({
        count: 0,
        instances: 100,
        methods: { SNMPv3: 1.0 },
      }),
      'Windows Servers': createMockDeviceConfig({
        count: 0,
        instances: 50,
        methods: { Script: 1.0 },
      }),
    };
    const result = calculateTotalPollingLoad(devices, methodWeights);
    expect(result).toBe(0);
  });

  it('handles many device types', () => {
    const devices: Record<string, ReturnType<typeof createMockDeviceConfig>> = {};
    for (let i = 0; i < 10; i++) {
      devices[`Device Type ${i}`] = createMockDeviceConfig({
        count: 1,
        instances: 10,
        methods: { SNMPv3: 1.0 },
      });
    }
    const result = calculateTotalPollingLoad(devices, methodWeights);
    // Each: 1 * 10 * 1.3 = 13, Total: 13 * 10 = 130
    expect(result).toBe(130);
  });

  it('handles custom method weights', () => {
    const customWeights = {
      ...methodWeights,
      SNMPv3: 2.0, // Override default 1.3
    };
    const devices = {
      'Linux Servers': createMockDeviceConfig({
        count: 10,
        instances: 100,
        methods: { SNMPv3: 1.0 },
      }),
    };
    const result = calculateTotalPollingLoad(devices, customWeights);
    // Expected: 10 * 100 * (1.0 * 2.0) = 2000
    expect(result).toBe(2000);
  });
});
