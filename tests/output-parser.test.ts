import { describe, it, expect } from 'vitest';
import { parseOutput, hasErrors } from '../src/editor/utils/output-parser';

describe('output-parser', () => {
  it('parses AD output and strips warning lines', () => {
    const output = '[Warning: Property fetch failed]\n\ninstance-1##Instance One';
    const result = parseOutput(output, { mode: 'ad' });
    expect(result?.type).toBe('ad');
    expect(result?.instances.length).toBe(1);
    expect(result?.instances[0].id).toBe('instance-1');
  });

  it('parses collection output and flags invalid values', () => {
    const output = 'metric1=1\nmetric2=abc';
    const result = parseOutput(output, { mode: 'collection' });
    expect(result?.type).toBe('collection');
    expect(result?.datapoints.length).toBe(2);
    expect(hasErrors(result!)).toBe(true);
  });

  it('parses batch collection output with wildvalue prefix', () => {
    const output = 'hostA.metric1=5';
    const result = parseOutput(output, { mode: 'batchcollection' });
    expect(result?.type).toBe('batchcollection');
    expect(result?.datapoints[0].wildvalue).toBe('hostA');
  });
});
