/**
 * Tests for formatting utility functions.
 *
 * Tests formatNumber, formatLoad, formatGB, and formatBps functions.
 */
import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatLoad,
  formatGB,
  formatBps,
} from '../../../src/editor/utils/collector-calculations';

describe('formatNumber', () => {
  it('formats small numbers without commas', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(999)).toBe('999');
  });

  it('adds commas for thousands', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(9999)).toBe('9,999');
  });

  it('handles larger numbers', () => {
    expect(formatNumber(10000)).toBe('10,000');
    expect(formatNumber(100000)).toBe('100,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('handles very large numbers', () => {
    expect(formatNumber(1000000000)).toBe('1,000,000,000');
  });

  it('rounds decimal numbers to integers', () => {
    expect(formatNumber(1234.56)).toBe('1,235');
    expect(formatNumber(1000.1)).toBe('1,000');
    expect(formatNumber(999.9)).toBe('1,000');
  });
});

describe('formatLoad', () => {
  it('formats small loads as integers', () => {
    expect(formatLoad(0)).toBe('0');
    expect(formatLoad(1)).toBe('1');
    expect(formatLoad(500)).toBe('500');
    expect(formatLoad(999)).toBe('999');
  });

  it('shows K for thousands', () => {
    expect(formatLoad(1000)).toBe('1.0K');
    expect(formatLoad(1500)).toBe('1.5K');
    expect(formatLoad(2500)).toBe('2.5K');
    expect(formatLoad(10000)).toBe('10.0K');
    expect(formatLoad(999999)).toBe('1000.0K');
  });

  it('shows M for millions', () => {
    expect(formatLoad(1000000)).toBe('1.0M');
    expect(formatLoad(1500000)).toBe('1.5M');
    expect(formatLoad(2500000)).toBe('2.5M');
    expect(formatLoad(10000000)).toBe('10.0M');
  });

  it('handles boundary values correctly', () => {
    expect(formatLoad(999)).toBe('999');
    expect(formatLoad(1000)).toBe('1.0K');
    expect(formatLoad(999999)).toBe('1000.0K');
    expect(formatLoad(1000000)).toBe('1.0M');
  });

  it('handles decimal precision', () => {
    expect(formatLoad(1234)).toBe('1.2K');
    expect(formatLoad(1267)).toBe('1.3K');
    expect(formatLoad(1234567)).toBe('1.2M');
  });
});

describe('formatGB', () => {
  it('formats small values as GB', () => {
    expect(formatGB(0)).toBe('0.0 GB');
    expect(formatGB(0.5)).toBe('0.5 GB');
    expect(formatGB(1)).toBe('1.0 GB');
    expect(formatGB(10)).toBe('10.0 GB');
    expect(formatGB(100)).toBe('100.0 GB');
    expect(formatGB(999)).toBe('999.0 GB');
  });

  it('shows TB for large values', () => {
    expect(formatGB(1000)).toBe('1.0 TB');
    expect(formatGB(1500)).toBe('1.5 TB');
    expect(formatGB(2500)).toBe('2.5 TB');
  });

  it('handles decimal precision', () => {
    expect(formatGB(1.23)).toBe('1.2 GB');
    expect(formatGB(1.27)).toBe('1.3 GB');
    expect(formatGB(1234)).toBe('1.2 TB');
    expect(formatGB(1267)).toBe('1.3 TB');
  });

  it('handles boundary values correctly', () => {
    expect(formatGB(999.9)).toBe('999.9 GB');
    expect(formatGB(1000)).toBe('1.0 TB');
  });
});

describe('formatBps', () => {
  it('formats small values as bps', () => {
    expect(formatBps(0)).toBe('0 bps');
    expect(formatBps(1)).toBe('1 bps');
    expect(formatBps(500)).toBe('500 bps');
    expect(formatBps(999)).toBe('999 bps');
  });

  it('shows Kbps for thousands', () => {
    expect(formatBps(1000)).toBe('1.00 Kbps');
    expect(formatBps(1500)).toBe('1.50 Kbps');
    expect(formatBps(10000)).toBe('10.00 Kbps');
    expect(formatBps(999999)).toBe('1000.00 Kbps');
  });

  it('shows Mbps for millions', () => {
    expect(formatBps(1000000)).toBe('1.00 Mbps');
    expect(formatBps(1500000)).toBe('1.50 Mbps');
    expect(formatBps(10000000)).toBe('10.00 Mbps');
    expect(formatBps(100000000)).toBe('100.00 Mbps');
  });

  it('shows Gbps for billions', () => {
    expect(formatBps(1000000000)).toBe('1.00 Gbps');
    expect(formatBps(1500000000)).toBe('1.50 Gbps');
    expect(formatBps(10000000000)).toBe('10.00 Gbps');
  });

  it('handles boundary values correctly', () => {
    expect(formatBps(999)).toBe('999 bps');
    expect(formatBps(1000)).toBe('1.00 Kbps');
    expect(formatBps(999999)).toBe('1000.00 Kbps');
    expect(formatBps(1000000)).toBe('1.00 Mbps');
    expect(formatBps(999999999)).toBe('1000.00 Mbps');
    expect(formatBps(1000000000)).toBe('1.00 Gbps');
  });

  it('handles decimal precision with 2 decimal places', () => {
    expect(formatBps(1234)).toBe('1.23 Kbps');
    expect(formatBps(1235)).toBe('1.24 Kbps'); // Rounding
    expect(formatBps(1234567)).toBe('1.23 Mbps');
    expect(formatBps(1234567890)).toBe('1.23 Gbps');
  });
});
