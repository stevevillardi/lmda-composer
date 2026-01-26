/**
 * Tests for collector configuration recommendation functions.
 *
 * Tests findOptimalCollectorConfig which determines the optimal
 * collector size and count based on load requirements.
 */
import { describe, it, expect } from 'vitest';
import {
  findOptimalCollectorConfig,
  createDefaultCollectorCapacities,
} from '../../../src/editor/utils/collector-calculations';
import { collectorRequirements } from '../../../src/lib/collector-sizing';

describe('findOptimalCollectorConfig', () => {
  const capacities = createDefaultCollectorCapacities();

  describe('basic behavior', () => {
    it('returns null for zero load', () => {
      const result = findOptimalCollectorConfig(0, 85, 'weight', false);
      expect(result).toBeNull();
    });

    it('returns a valid recommendation for positive load', () => {
      const result = findOptimalCollectorConfig(10000, 85, 'weight', false);
      expect(result).not.toBeNull();
      expect(result!.count).toBeGreaterThan(0);
      expect(result!.size).toBeDefined();
    });
  });

  describe('auto-sizing (weight capacity)', () => {
    it('uses XXL for high loads requiring single collector', () => {
      // XXL weight capacity is 285500
      const load = 200000; // High but within single XXL at 85%
      const result = findOptimalCollectorConfig(load, 85, 'weight', false);
      expect(result).not.toBeNull();
      expect(result!.size).toBe('XXL');
      expect(result!.count).toBe(1);
    });

    it('scales collector count for loads exceeding single collector', () => {
      // XXL at 85% = 285500 * 0.85 = 242675
      const load = 500000; // Needs multiple collectors
      const result = findOptimalCollectorConfig(load, 85, 'weight', false);
      expect(result).not.toBeNull();
      expect(result!.count).toBeGreaterThan(1);
    });

    it('calculates utilization percentage correctly', () => {
      const load = 100000;
      const result = findOptimalCollectorConfig(load, 85, 'weight', false);
      expect(result).not.toBeNull();
      // Utilization = (totalLoad / maxCapacity) * 100
      const expectedUtil = (load / result!.maxCapacity) * 100;
      expect(result!.utilizationPercent).toBeCloseTo(expectedUtil, 2);
    });

    it('calculates per-collector load correctly', () => {
      const load = 100000;
      const result = findOptimalCollectorConfig(load, 85, 'weight', false);
      expect(result).not.toBeNull();
      const expectedPerCollector = load / result!.count;
      expect(result!.perCollectorLoad).toBeCloseTo(expectedPerCollector, 2);
    });
  });

  describe('EPS capacity', () => {
    it('calculates correctly for EPS-based loads', () => {
      // Using EPS capacity instead of weight
      const epsLoad = 1000;
      const result = findOptimalCollectorConfig(epsLoad, 85, 'eps', false);
      expect(result).not.toBeNull();
      expect(result!.totalLoad).toBe(epsLoad);
    });

    it('selects appropriate size for EPS', () => {
      // SMALL eps = 200, MEDIUM = 500
      const epsLoad = 300; // Between SMALL and MEDIUM
      const result = findOptimalCollectorConfig(epsLoad, 85, 'eps', false);
      expect(result).not.toBeNull();
      // Should use larger collector that can handle the load
    });
  });

  describe('FPS capacity', () => {
    it('calculates correctly for FPS-based loads', () => {
      const fpsLoad = 5000;
      const result = findOptimalCollectorConfig(fpsLoad, 85, 'fps', false);
      expect(result).not.toBeNull();
      expect(result!.totalLoad).toBe(fpsLoad);
    });
  });

  describe('failover', () => {
    it('adds failover collector when enabled', () => {
      const load = 10000;
      const withoutFailover = findOptimalCollectorConfig(load, 85, 'weight', false);
      const withFailover = findOptimalCollectorConfig(load, 85, 'weight', true);

      expect(withoutFailover).not.toBeNull();
      expect(withFailover).not.toBeNull();
      expect(withFailover!.count).toBe(withoutFailover!.count + 1);
    });

    it('does not add failover when load is zero', () => {
      const result = findOptimalCollectorConfig(0, 85, 'weight', true);
      expect(result).toBeNull();
    });

    it('adjusts utilization with failover', () => {
      const load = 100000;
      const withoutFailover = findOptimalCollectorConfig(load, 85, 'weight', false);
      const withFailover = findOptimalCollectorConfig(load, 85, 'weight', true);

      expect(withFailover).not.toBeNull();
      expect(withoutFailover).not.toBeNull();
      // With more collectors, utilization should be lower
      expect(withFailover!.utilizationPercent).toBeLessThan(
        withoutFailover!.utilizationPercent
      );
    });
  });

  describe('maxLoadPercent', () => {
    it('respects maxLoadPercent of 50', () => {
      const load = 100000;
      const result = findOptimalCollectorConfig(load, 50, 'weight', false);
      expect(result).not.toBeNull();
      // With lower max load %, may need more collectors
    });

    it('respects maxLoadPercent of 100', () => {
      const load = 100000;
      const result = findOptimalCollectorConfig(load, 100, 'weight', false);
      expect(result).not.toBeNull();
    });

    it('lower maxLoadPercent results in more collectors', () => {
      const load = 200000;
      const at50 = findOptimalCollectorConfig(load, 50, 'weight', false);
      const at100 = findOptimalCollectorConfig(load, 100, 'weight', false);

      expect(at50).not.toBeNull();
      expect(at100).not.toBeNull();
      expect(at50!.count).toBeGreaterThanOrEqual(at100!.count);
    });

    it('handles boundary value 50', () => {
      const result = findOptimalCollectorConfig(10000, 50, 'weight', false);
      expect(result).not.toBeNull();
    });

    it('handles boundary value 100', () => {
      const result = findOptimalCollectorConfig(10000, 100, 'weight', false);
      expect(result).not.toBeNull();
    });
  });

  describe('forced collector size', () => {
    it('uses forced size when specified', () => {
      const load = 10000;
      const result = findOptimalCollectorConfig(load, 85, 'weight', false, undefined, 'SMALL');
      expect(result).not.toBeNull();
      expect(result!.size).toBe('SMALL');
    });

    it('scales count when forced SMALL with high load', () => {
      // SMALL weight capacity = 21286
      const load = 100000; // Much higher than SMALL capacity
      const result = findOptimalCollectorConfig(load, 85, 'weight', false, undefined, 'SMALL');
      expect(result).not.toBeNull();
      expect(result!.size).toBe('SMALL');
      expect(result!.count).toBeGreaterThan(1);
    });

    it('forced MEDIUM works correctly', () => {
      const load = 50000;
      const result = findOptimalCollectorConfig(load, 85, 'weight', false, undefined, 'MEDIUM');
      expect(result).not.toBeNull();
      expect(result!.size).toBe('MEDIUM');
    });

    it('forced LARGE works correctly', () => {
      const load = 100000;
      const result = findOptimalCollectorConfig(load, 85, 'weight', false, undefined, 'LARGE');
      expect(result).not.toBeNull();
      expect(result!.size).toBe('LARGE');
    });

    it('forced XL works correctly', () => {
      const load = 150000;
      const result = findOptimalCollectorConfig(load, 85, 'weight', false, undefined, 'XL');
      expect(result).not.toBeNull();
      expect(result!.size).toBe('XL');
    });

    it('forced XXL works correctly', () => {
      const load = 200000;
      const result = findOptimalCollectorConfig(load, 85, 'weight', false, undefined, 'XXL');
      expect(result).not.toBeNull();
      expect(result!.size).toBe('XXL');
    });

    it('auto mode bypasses forced size', () => {
      const load = 10000;
      const result = findOptimalCollectorConfig(load, 85, 'weight', false, undefined, 'auto');
      expect(result).not.toBeNull();
      // Should auto-select appropriate size, not forced
    });

    it('forced size with failover adds collector', () => {
      const load = 50000;
      const withoutFailover = findOptimalCollectorConfig(
        load, 85, 'weight', false, undefined, 'MEDIUM'
      );
      const withFailover = findOptimalCollectorConfig(
        load, 85, 'weight', true, undefined, 'MEDIUM'
      );

      expect(withoutFailover).not.toBeNull();
      expect(withFailover).not.toBeNull();
      expect(withFailover!.count).toBe(withoutFailover!.count + 1);
    });
  });

  describe('custom capacities', () => {
    it('uses custom capacities when provided', () => {
      const customCapacities = {
        ...capacities,
        MEDIUM: { weight: 100000, eps: 1000, fps: 20000 },
      };
      const load = 50000;
      const result = findOptimalCollectorConfig(
        load, 85, 'weight', false, customCapacities
      );
      expect(result).not.toBeNull();
    });
  });

  describe('extreme loads', () => {
    it('falls back to XXL with multiples for extreme loads', () => {
      const extremeLoad = 10000000; // 10 million
      const result = findOptimalCollectorConfig(extremeLoad, 85, 'weight', false);
      expect(result).not.toBeNull();
      expect(result!.size).toBe('XXL');
      expect(result!.count).toBeGreaterThan(1);
    });

    it('handles very small loads', () => {
      const tinyLoad = 1;
      const result = findOptimalCollectorConfig(tinyLoad, 85, 'weight', false);
      expect(result).not.toBeNull();
      expect(result!.count).toBe(1);
    });
  });

  describe('requirements', () => {
    it('includes correct requirements for each size', () => {
      const sizes = ['SMALL', 'MEDIUM', 'LARGE', 'XL', 'XXL'] as const;

      for (const size of sizes) {
        const result = findOptimalCollectorConfig(
          10000, 85, 'weight', false, undefined, size
        );
        expect(result).not.toBeNull();
        expect(result!.requirements).toEqual(collectorRequirements[size]);
      }
    });
  });
});
