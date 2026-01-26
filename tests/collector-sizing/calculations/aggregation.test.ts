/**
 * Tests for aggregation calculation functions.
 *
 * Tests aggregateSiteRecommendations which combines results
 * from multiple sites into a total summary.
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateSiteRecommendations,
  createDefaultCollectorCapacities,
  type SiteCalculationResult,
} from '../../../src/editor/utils/collector-calculations';
import { createMockCollectorRecommendation } from '../../helpers/collector-sizing-helpers';

describe('aggregateSiteRecommendations', () => {
  describe('empty results', () => {
    it('returns empty result for empty array', () => {
      const result = aggregateSiteRecommendations([]);

      expect(result.polling).toBeNull();
      expect(result.logs).toBeNull();
      expect(result.netflow).toBeNull();
    });

    it('returns empty result when all sites have null recommendations', () => {
      const siteResults: SiteCalculationResult[] = [
        { polling: null, logs: null, netflow: null },
        { polling: null, logs: null, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.polling).toBeNull();
      expect(result.logs).toBeNull();
      expect(result.netflow).toBeNull();
    });
  });

  describe('single site', () => {
    it('returns same result for single site', () => {
      const polling = createMockCollectorRecommendation({
        count: 2,
        size: 'MEDIUM',
        totalLoad: 50000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling, logs: null, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.polling).not.toBeNull();
      expect(result.polling!.count).toBe(2);
      expect(result.polling!.size).toBe('MEDIUM');
      expect(result.polling!.totalLoad).toBe(50000);
    });

    it('handles single site with all types', () => {
      const polling = createMockCollectorRecommendation({
        count: 2,
        size: 'MEDIUM',
        totalLoad: 50000,
      });
      const logs = createMockCollectorRecommendation({
        count: 1,
        size: 'SMALL',
        totalLoad: 100,
      });
      const netflow = createMockCollectorRecommendation({
        count: 1,
        size: 'LARGE',
        totalLoad: 5000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling, logs, netflow },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.polling).not.toBeNull();
      expect(result.logs).not.toBeNull();
      expect(result.netflow).not.toBeNull();
    });
  });

  describe('collector count aggregation', () => {
    it('sums collector counts across sites for polling', () => {
      const site1Polling = createMockCollectorRecommendation({
        count: 2,
        size: 'MEDIUM',
        totalLoad: 50000,
      });
      const site2Polling = createMockCollectorRecommendation({
        count: 3,
        size: 'MEDIUM',
        totalLoad: 75000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: site1Polling, logs: null, netflow: null },
        { polling: site2Polling, logs: null, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.polling!.count).toBe(5); // 2 + 3
    });

    it('sums collector counts across sites for logs', () => {
      const site1Logs = createMockCollectorRecommendation({
        count: 1,
        size: 'SMALL',
        totalLoad: 100,
      });
      const site2Logs = createMockCollectorRecommendation({
        count: 2,
        size: 'MEDIUM',
        totalLoad: 300,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: null, logs: site1Logs, netflow: null },
        { polling: null, logs: site2Logs, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.logs!.count).toBe(3); // 1 + 2
    });

    it('sums collector counts across sites for netflow', () => {
      const site1Netflow = createMockCollectorRecommendation({
        count: 1,
        size: 'MEDIUM',
        totalLoad: 5000,
      });
      const site2Netflow = createMockCollectorRecommendation({
        count: 1,
        size: 'LARGE',
        totalLoad: 10000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: null, logs: null, netflow: site1Netflow },
        { polling: null, logs: null, netflow: site2Netflow },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.netflow!.count).toBe(2); // 1 + 1
    });
  });

  describe('size selection', () => {
    it('uses largest size from all sites for polling', () => {
      const site1Polling = createMockCollectorRecommendation({
        count: 2,
        size: 'SMALL',
        totalLoad: 20000,
      });
      const site2Polling = createMockCollectorRecommendation({
        count: 1,
        size: 'LARGE',
        totalLoad: 50000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: site1Polling, logs: null, netflow: null },
        { polling: site2Polling, logs: null, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.polling!.size).toBe('LARGE'); // Largest of SMALL and LARGE
    });

    it('uses largest size from all sites for logs', () => {
      const site1Logs = createMockCollectorRecommendation({
        count: 1,
        size: 'MEDIUM',
        totalLoad: 200,
      });
      const site2Logs = createMockCollectorRecommendation({
        count: 1,
        size: 'XL',
        totalLoad: 2000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: null, logs: site1Logs, netflow: null },
        { polling: null, logs: site2Logs, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.logs!.size).toBe('XL');
    });

    it('correctly orders sizes: SMALL < MEDIUM < LARGE < XL < XXL', () => {
      const sizes = ['SMALL', 'MEDIUM', 'LARGE', 'XL', 'XXL'] as const;

      for (let i = 0; i < sizes.length; i++) {
        for (let j = i + 1; j < sizes.length; j++) {
          const smallerSite = createMockCollectorRecommendation({
            count: 1,
            size: sizes[i],
            totalLoad: 1000,
          });
          const largerSite = createMockCollectorRecommendation({
            count: 1,
            size: sizes[j],
            totalLoad: 2000,
          });

          const siteResults: SiteCalculationResult[] = [
            { polling: smallerSite, logs: null, netflow: null },
            { polling: largerSite, logs: null, netflow: null },
          ];

          const result = aggregateSiteRecommendations(siteResults);
          expect(result.polling!.size).toBe(sizes[j]);
        }
      }
    });
  });

  describe('load aggregation', () => {
    it('sums total loads correctly for polling', () => {
      const site1Polling = createMockCollectorRecommendation({
        count: 1,
        size: 'MEDIUM',
        totalLoad: 30000,
      });
      const site2Polling = createMockCollectorRecommendation({
        count: 1,
        size: 'MEDIUM',
        totalLoad: 45000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: site1Polling, logs: null, netflow: null },
        { polling: site2Polling, logs: null, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.polling!.totalLoad).toBe(75000); // 30000 + 45000
    });

    it('sums total loads correctly for logs', () => {
      const site1Logs = createMockCollectorRecommendation({
        count: 1,
        size: 'SMALL',
        totalLoad: 50,
      });
      const site2Logs = createMockCollectorRecommendation({
        count: 1,
        size: 'SMALL',
        totalLoad: 75,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: null, logs: site1Logs, netflow: null },
        { polling: null, logs: site2Logs, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.logs!.totalLoad).toBe(125); // 50 + 75
    });

    it('sums total loads correctly for netflow', () => {
      const site1Netflow = createMockCollectorRecommendation({
        count: 1,
        size: 'MEDIUM',
        totalLoad: 5000,
      });
      const site2Netflow = createMockCollectorRecommendation({
        count: 1,
        size: 'MEDIUM',
        totalLoad: 7500,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: null, logs: null, netflow: site1Netflow },
        { polling: null, logs: null, netflow: site2Netflow },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.netflow!.totalLoad).toBe(12500); // 5000 + 7500
    });
  });

  describe('utilization and per-collector load', () => {
    it('calculates utilization based on aggregated values', () => {
      const capacities = createDefaultCollectorCapacities();
      const site1Polling = createMockCollectorRecommendation({
        count: 1,
        size: 'MEDIUM',
        totalLoad: 30000,
      });
      const site2Polling = createMockCollectorRecommendation({
        count: 1,
        size: 'LARGE',
        totalLoad: 50000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: site1Polling, logs: null, netflow: null },
        { polling: site2Polling, logs: null, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults, capacities);

      // Total collectors: 2, Largest size: LARGE
      // LARGE weight capacity: 104714
      // Total capacity: 2 * 104714 = 209428
      // Total load: 80000
      // Utilization: (80000 / 209428) * 100
      const expectedUtil = (80000 / (2 * capacities.LARGE.weight)) * 100;
      expect(result.polling!.utilizationPercent).toBeCloseTo(expectedUtil, 2);
    });

    it('calculates per-collector load correctly', () => {
      const site1Polling = createMockCollectorRecommendation({
        count: 2,
        size: 'MEDIUM',
        totalLoad: 40000,
      });
      const site2Polling = createMockCollectorRecommendation({
        count: 3,
        size: 'MEDIUM',
        totalLoad: 60000,
      });

      const siteResults: SiteCalculationResult[] = [
        { polling: site1Polling, logs: null, netflow: null },
        { polling: site2Polling, logs: null, netflow: null },
      ];

      const result = aggregateSiteRecommendations(siteResults);

      // Total load: 100000, Total collectors: 5
      // Per collector: 100000 / 5 = 20000
      expect(result.polling!.perCollectorLoad).toBe(20000);
    });
  });

  describe('mixed presence', () => {
    it('handles sites with different resource types', () => {
      const site1 = {
        polling: createMockCollectorRecommendation({ count: 1, size: 'MEDIUM', totalLoad: 30000 }),
        logs: null,
        netflow: null,
      };
      const site2 = {
        polling: null,
        logs: createMockCollectorRecommendation({ count: 1, size: 'SMALL', totalLoad: 100 }),
        netflow: null,
      };
      const site3 = {
        polling: null,
        logs: null,
        netflow: createMockCollectorRecommendation({ count: 1, size: 'MEDIUM', totalLoad: 5000 }),
      };

      const result = aggregateSiteRecommendations([site1, site2, site3]);

      expect(result.polling).not.toBeNull();
      expect(result.logs).not.toBeNull();
      expect(result.netflow).not.toBeNull();
      expect(result.polling!.count).toBe(1);
      expect(result.logs!.count).toBe(1);
      expect(result.netflow!.count).toBe(1);
    });

    it('aggregates correctly when some sites lack certain types', () => {
      const site1: SiteCalculationResult = {
        polling: createMockCollectorRecommendation({ count: 2, size: 'MEDIUM', totalLoad: 40000 }),
        logs: createMockCollectorRecommendation({ count: 1, size: 'SMALL', totalLoad: 50 }),
        netflow: null,
      };
      const site2: SiteCalculationResult = {
        polling: createMockCollectorRecommendation({ count: 1, size: 'LARGE', totalLoad: 80000 }),
        logs: null,
        netflow: createMockCollectorRecommendation({ count: 1, size: 'MEDIUM', totalLoad: 5000 }),
      };

      const result = aggregateSiteRecommendations([site1, site2]);

      expect(result.polling!.count).toBe(3); // 2 + 1
      expect(result.polling!.totalLoad).toBe(120000); // 40000 + 80000
      expect(result.logs!.count).toBe(1); // Only site1 has logs
      expect(result.logs!.totalLoad).toBe(50);
      expect(result.netflow!.count).toBe(1); // Only site2 has netflow
      expect(result.netflow!.totalLoad).toBe(5000);
    });
  });

  describe('many sites', () => {
    it('handles aggregating many sites', () => {
      const siteResults: SiteCalculationResult[] = [];
      for (let i = 0; i < 10; i++) {
        siteResults.push({
          polling: createMockCollectorRecommendation({
            count: 1,
            size: 'MEDIUM',
            totalLoad: 10000,
          }),
          logs: null,
          netflow: null,
        });
      }

      const result = aggregateSiteRecommendations(siteResults);

      expect(result.polling!.count).toBe(10);
      expect(result.polling!.totalLoad).toBe(100000);
    });
  });
});
