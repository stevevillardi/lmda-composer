/**
 * Tests for EPS and FPS calculation functions.
 *
 * Tests calculateTotalEPS and calculateTotalFPS functions
 * which compute events/flows per second for collector sizing.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateTotalEPS,
  calculateTotalFPS,
} from '../../../src/editor/utils/collector-calculations';
import {
  createMockLogConfig,
  createMockTrapConfig,
  createMockFlowConfig,
  createEmptyLogs,
  createEmptyTraps,
  createEmptyFlows,
} from '../../helpers/collector-sizing-helpers';

describe('calculateTotalEPS', () => {
  it('returns 0 for empty logs and traps', () => {
    const result = calculateTotalEPS(createEmptyLogs(), createEmptyTraps());
    expect(result).toBe(0);
  });

  it('correctly sums log EPS', () => {
    const logs = {
      FIREWALLS: createMockLogConfig({ count: 10, eps: 1 }),
      NETWORK: createMockLogConfig({ count: 20, eps: 0.75 }),
    };
    const result = calculateTotalEPS(logs, createEmptyTraps());
    // Firewalls: 10 * 1 = 10, Network: 20 * 0.75 = 15, Total: 25
    expect(result).toBe(25);
  });

  it('correctly sums trap EPS', () => {
    const traps = {
      SNMP: createMockTrapConfig({ count: 100, eps: 0.01 }),
      CUSTOM: createMockTrapConfig({ count: 50, eps: 0.02 }),
    };
    const result = calculateTotalEPS(createEmptyLogs(), traps);
    // SNMP: 100 * 0.01 = 1, CUSTOM: 50 * 0.02 = 1, Total: 2
    expect(result).toBe(2);
  });

  it('combines logs and traps EPS', () => {
    const logs = {
      FIREWALLS: createMockLogConfig({ count: 10, eps: 1 }),
    };
    const traps = {
      SNMP: createMockTrapConfig({ count: 100, eps: 0.01 }),
    };
    const result = calculateTotalEPS(logs, traps);
    // Logs: 10, Traps: 1, Total: 11
    expect(result).toBe(11);
  });

  it('handles zero counts in logs', () => {
    const logs = {
      FIREWALLS: createMockLogConfig({ count: 0, eps: 1 }),
      NETWORK: createMockLogConfig({ count: 10, eps: 0.75 }),
    };
    const result = calculateTotalEPS(logs, createEmptyTraps());
    // Only Network: 10 * 0.75 = 7.5
    expect(result).toBe(7.5);
  });

  it('handles zero counts in traps', () => {
    const traps = {
      SNMP: createMockTrapConfig({ count: 0, eps: 0.01 }),
      CUSTOM: createMockTrapConfig({ count: 50, eps: 0.02 }),
    };
    const result = calculateTotalEPS(createEmptyLogs(), traps);
    // Only CUSTOM: 50 * 0.02 = 1
    expect(result).toBe(1);
  });

  it('handles fractional EPS values', () => {
    const logs = {
      LOW_EPS: createMockLogConfig({ count: 100, eps: 0.05 }),
    };
    const result = calculateTotalEPS(logs, createEmptyTraps());
    // 100 * 0.05 = 5
    expect(result).toBe(5);
  });

  it('handles high EPS values', () => {
    const logs = {
      HIGH_EPS: createMockLogConfig({ count: 10, eps: 6.20 }),
    };
    const result = calculateTotalEPS(logs, createEmptyTraps());
    // 10 * 6.20 = 62
    expect(result).toBe(62);
  });

  it('handles single log source', () => {
    const logs = {
      SINGLE: createMockLogConfig({ count: 1, eps: 1 }),
    };
    const result = calculateTotalEPS(logs, createEmptyTraps());
    expect(result).toBe(1);
  });

  it('scales linearly with count', () => {
    const logsBase = {
      TEST: createMockLogConfig({ count: 10, eps: 1 }),
    };
    const logsDoubled = {
      TEST: createMockLogConfig({ count: 20, eps: 1 }),
    };

    const baseEPS = calculateTotalEPS(logsBase, createEmptyTraps());
    const doubledEPS = calculateTotalEPS(logsDoubled, createEmptyTraps());

    expect(doubledEPS).toBe(baseEPS * 2);
  });
});

describe('calculateTotalFPS', () => {
  it('returns 0 for empty flows', () => {
    const result = calculateTotalFPS(createEmptyFlows());
    expect(result).toBe(0);
  });

  it('correctly calculates FPS for single flow type', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1100 }),
    };
    const result = calculateTotalFPS(flows);
    // 5 * 1100 = 5500
    expect(result).toBe(5500);
  });

  it('correctly sums multiple flow types', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1100 }),
      SFLOW: createMockFlowConfig({ count: 3, fps: 500 }),
    };
    const result = calculateTotalFPS(flows);
    // NetFlow: 5 * 1100 = 5500, sFlow: 3 * 500 = 1500, Total: 7000
    expect(result).toBe(7000);
  });

  it('handles zero count flows', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 0, fps: 1100 }),
    };
    const result = calculateTotalFPS(flows);
    expect(result).toBe(0);
  });

  it('handles mixed zero and non-zero counts', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1100 }),
      ZERO: createMockFlowConfig({ count: 0, fps: 500 }),
    };
    const result = calculateTotalFPS(flows);
    // Only NetFlow: 5 * 1100 = 5500
    expect(result).toBe(5500);
  });

  it('handles high FPS values', () => {
    const flows = {
      HIGH_FPS: createMockFlowConfig({ count: 10, fps: 10000 }),
    };
    const result = calculateTotalFPS(flows);
    // 10 * 10000 = 100000
    expect(result).toBe(100000);
  });

  it('handles low FPS values', () => {
    const flows = {
      LOW_FPS: createMockFlowConfig({ count: 100, fps: 10 }),
    };
    const result = calculateTotalFPS(flows);
    // 100 * 10 = 1000
    expect(result).toBe(1000);
  });

  it('scales linearly with count', () => {
    const flowsBase = {
      TEST: createMockFlowConfig({ count: 5, fps: 1100 }),
    };
    const flowsDoubled = {
      TEST: createMockFlowConfig({ count: 10, fps: 1100 }),
    };

    const baseFPS = calculateTotalFPS(flowsBase);
    const doubledFPS = calculateTotalFPS(flowsDoubled);

    expect(doubledFPS).toBe(baseFPS * 2);
  });

  it('handles many flow types', () => {
    const flows: Record<string, ReturnType<typeof createMockFlowConfig>> = {};
    for (let i = 0; i < 5; i++) {
      flows[`FLOW_${i}`] = createMockFlowConfig({ count: 1, fps: 100 });
    }
    const result = calculateTotalFPS(flows);
    // 5 * (1 * 100) = 500
    expect(result).toBe(500);
  });
});
