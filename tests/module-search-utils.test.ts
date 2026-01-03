import { describe, expect, it } from 'vitest';
import { buildSearchRegex, findMatchRanges, textMatches } from '../src/shared/module-search-utils';

describe('module-search-utils', () => {
  it('builds exact word-boundary regex for exact match', () => {
    const regex = buildSearchRegex('cpu', 'exact', false);
    expect(regex.test('cpu usage')).toBe(true);
    expect(regex.test('cpus')).toBe(false);
  });

  it('supports regex match type', () => {
    const regex = buildSearchRegex('c.*', 'regex', false);
    expect(regex.test('cpu')).toBe(true);
  });

  it('finds match ranges across lines', () => {
    const text = 'alpha\nbeta\nalpha';
    const ranges = findMatchRanges(text, 'alpha', 'contains', false);
    expect(ranges).toEqual([
      { line: 1, startColumn: 1, endColumn: 6 },
      { line: 3, startColumn: 1, endColumn: 6 },
    ]);
  });

  it('textMatches respects case sensitivity', () => {
    expect(textMatches('Alpha', 'alpha', 'contains', false)).toBe(true);
    expect(textMatches('Alpha', 'alpha', 'contains', true)).toBe(false);
  });
});
