/**
 * Tests for storage estimation calculation functions.
 *
 * Tests GB/day and bps calculations for logs and netflow.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateLogsGBPerDay,
  calculateNetflowGBPerDay,
  calculateNetflowGBPerDayRange,
  calculateNetflowBps,
  NETFLOW_BYTES_PER_FLOW_MIN,
  NETFLOW_BYTES_PER_FLOW_MAX,
} from '../../../src/editor/utils/collector-calculations';
import {
  createMockLogConfig,
  createMockTrapConfig,
  createMockFlowConfig,
  createEmptyLogs,
  createEmptyTraps,
  createEmptyFlows,
} from '../../helpers/collector-sizing-helpers';

const BYTES_PER_GB = 1024 ** 3;
const SECONDS_PER_DAY = 86400;

describe('calculateLogsGBPerDay', () => {
  it('returns 0 for empty logs and traps', () => {
    const result = calculateLogsGBPerDay(createEmptyLogs(), createEmptyTraps());
    expect(result).toBe(0);
  });

  it('calculates GB/day for single log source', () => {
    const logs = {
      TEST: createMockLogConfig({ count: 10, eps: 1, bytes: 300 }),
    };
    const result = calculateLogsGBPerDay(logs, createEmptyTraps());

    // Formula: (count * eps * bytes * 86400) / (1024^3)
    // (10 * 1 * 300 * 86400) / 1073741824 = 0.2414...
    const expected = (10 * 1 * 300 * SECONDS_PER_DAY) / BYTES_PER_GB;
    expect(result).toBeCloseTo(expected, 6);
  });

  it('calculates GB/day for multiple log sources', () => {
    const logs = {
      FIREWALLS: createMockLogConfig({ count: 10, eps: 1, bytes: 300 }),
      NETWORK: createMockLogConfig({ count: 20, eps: 0.75, bytes: 150 }),
    };
    const result = calculateLogsGBPerDay(logs, createEmptyTraps());

    // Firewalls: 10 * 1 * 300 = 3000 bytes/sec
    // Network: 20 * 0.75 * 150 = 2250 bytes/sec
    // Total: 5250 bytes/sec
    const expected = (5250 * SECONDS_PER_DAY) / BYTES_PER_GB;
    expect(result).toBeCloseTo(expected, 6);
  });

  it('calculates GB/day for traps only', () => {
    const traps = {
      SNMP: createMockTrapConfig({ count: 100, eps: 0.01, bytes: 1000 }),
    };
    const result = calculateLogsGBPerDay(createEmptyLogs(), traps);

    // 100 * 0.01 * 1000 = 1000 bytes/sec
    const expected = (1000 * SECONDS_PER_DAY) / BYTES_PER_GB;
    expect(result).toBeCloseTo(expected, 6);
  });

  it('combines logs and traps', () => {
    const logs = {
      TEST: createMockLogConfig({ count: 10, eps: 1, bytes: 300 }),
    };
    const traps = {
      SNMP: createMockTrapConfig({ count: 100, eps: 0.01, bytes: 1000 }),
    };
    const result = calculateLogsGBPerDay(logs, traps);

    // Logs: 10 * 1 * 300 = 3000 bytes/sec
    // Traps: 100 * 0.01 * 1000 = 1000 bytes/sec
    // Total: 4000 bytes/sec
    const expected = (4000 * SECONDS_PER_DAY) / BYTES_PER_GB;
    expect(result).toBeCloseTo(expected, 6);
  });

  it('handles zero count sources', () => {
    const logs = {
      ZERO: createMockLogConfig({ count: 0, eps: 1, bytes: 300 }),
      TEN: createMockLogConfig({ count: 10, eps: 1, bytes: 300 }),
    };
    const result = calculateLogsGBPerDay(logs, createEmptyTraps());

    // Only TEN contributes: 10 * 1 * 300 = 3000 bytes/sec
    const expected = (3000 * SECONDS_PER_DAY) / BYTES_PER_GB;
    expect(result).toBeCloseTo(expected, 6);
  });

  it('handles high volume scenario', () => {
    const logs = {
      HIGH: createMockLogConfig({ count: 1000, eps: 6.20, bytes: 2005 }),
    };
    const result = calculateLogsGBPerDay(logs, createEmptyTraps());

    // 1000 * 6.20 * 2005 = 12,431,000 bytes/sec
    const expected = (12431000 * SECONDS_PER_DAY) / BYTES_PER_GB;
    expect(result).toBeCloseTo(expected, 6);
  });
});

describe('calculateNetflowGBPerDay', () => {
  it('returns 0 for empty flows', () => {
    const result = calculateNetflowGBPerDay(createEmptyFlows());
    expect(result).toBe(0);
  });

  it('calculates GB/day for single flow type', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1100, bytes: 1000 }),
    };
    const result = calculateNetflowGBPerDay(flows);

    // 5 * 1100 * 1000 = 5,500,000 bytes/sec
    const expected = (5500000 * SECONDS_PER_DAY) / BYTES_PER_GB;
    expect(result).toBeCloseTo(expected, 6);
  });

  it('calculates GB/day for multiple flow types', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1100, bytes: 1000 }),
      SFLOW: createMockFlowConfig({ count: 3, fps: 500, bytes: 800 }),
    };
    const result = calculateNetflowGBPerDay(flows);

    // NetFlow: 5 * 1100 * 1000 = 5,500,000 bytes/sec
    // sFlow: 3 * 500 * 800 = 1,200,000 bytes/sec
    // Total: 6,700,000 bytes/sec
    const expected = (6700000 * SECONDS_PER_DAY) / BYTES_PER_GB;
    expect(result).toBeCloseTo(expected, 6);
  });

  it('handles zero count flows', () => {
    const flows = {
      ZERO: createMockFlowConfig({ count: 0, fps: 1100, bytes: 1000 }),
    };
    const result = calculateNetflowGBPerDay(flows);
    expect(result).toBe(0);
  });
});

describe('calculateNetflowGBPerDayRange', () => {
  it('returns zero range for empty flows', () => {
    const result = calculateNetflowGBPerDayRange(createEmptyFlows());
    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
  });

  it('calculates min/max range for flows', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 10, fps: 1000, bytes: 0 }), // bytes ignored
    };
    const result = calculateNetflowGBPerDayRange(flows);

    // Total FPS: 10 * 1000 = 10,000
    // Min bytes/sec: 10000 * 100 = 1,000,000
    // Max bytes/sec: 10000 * 250 = 2,500,000
    const expectedMin = (10000 * NETFLOW_BYTES_PER_FLOW_MIN * SECONDS_PER_DAY) / BYTES_PER_GB;
    const expectedMax = (10000 * NETFLOW_BYTES_PER_FLOW_MAX * SECONDS_PER_DAY) / BYTES_PER_GB;

    expect(result.min).toBeCloseTo(expectedMin, 6);
    expect(result.max).toBeCloseTo(expectedMax, 6);
  });

  it('max is always greater than or equal to min', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1100, bytes: 0 }),
    };
    const result = calculateNetflowGBPerDayRange(flows);
    expect(result.max).toBeGreaterThanOrEqual(result.min);
  });

  it('range scales with FPS', () => {
    const flows1 = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1000, bytes: 0 }),
    };
    const flows2 = {
      NETFLOW: createMockFlowConfig({ count: 10, fps: 1000, bytes: 0 }),
    };

    const range1 = calculateNetflowGBPerDayRange(flows1);
    const range2 = calculateNetflowGBPerDayRange(flows2);

    expect(range2.min).toBeCloseTo(range1.min * 2, 6);
    expect(range2.max).toBeCloseTo(range1.max * 2, 6);
  });
});

describe('calculateNetflowBps', () => {
  it('returns 0 for empty flows', () => {
    const result = calculateNetflowBps(createEmptyFlows());
    expect(result).toBe(0);
  });

  it('calculates bps using midpoint of bytes range', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 10, fps: 1000, bytes: 0 }),
    };
    const result = calculateNetflowBps(flows);

    // Total FPS: 10 * 1000 = 10,000
    // Avg bytes per flow: (100 + 250) / 2 = 175
    // Bytes per second: 10000 * 175 = 1,750,000
    // Bits per second: 1,750,000 * 8 = 14,000,000
    const avgBytesPerFlow = (NETFLOW_BYTES_PER_FLOW_MIN + NETFLOW_BYTES_PER_FLOW_MAX) / 2;
    const expected = 10000 * avgBytesPerFlow * 8;
    expect(result).toBe(expected);
  });

  it('scales linearly with flow count', () => {
    const flows1 = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1000, bytes: 0 }),
    };
    const flows2 = {
      NETFLOW: createMockFlowConfig({ count: 10, fps: 1000, bytes: 0 }),
    };

    const bps1 = calculateNetflowBps(flows1);
    const bps2 = calculateNetflowBps(flows2);

    expect(bps2).toBe(bps1 * 2);
  });

  it('scales linearly with fps', () => {
    const flows1 = {
      NETFLOW: createMockFlowConfig({ count: 10, fps: 500, bytes: 0 }),
    };
    const flows2 = {
      NETFLOW: createMockFlowConfig({ count: 10, fps: 1000, bytes: 0 }),
    };

    const bps1 = calculateNetflowBps(flows1);
    const bps2 = calculateNetflowBps(flows2);

    expect(bps2).toBe(bps1 * 2);
  });

  it('handles multiple flow types', () => {
    const flows = {
      NETFLOW: createMockFlowConfig({ count: 5, fps: 1000, bytes: 0 }),
      SFLOW: createMockFlowConfig({ count: 5, fps: 500, bytes: 0 }),
    };
    const result = calculateNetflowBps(flows);

    // Total FPS: (5 * 1000) + (5 * 500) = 5000 + 2500 = 7500
    const avgBytesPerFlow = (NETFLOW_BYTES_PER_FLOW_MIN + NETFLOW_BYTES_PER_FLOW_MAX) / 2;
    const expected = 7500 * avgBytesPerFlow * 8;
    expect(result).toBe(expected);
  });
});
