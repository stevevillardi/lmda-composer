/**
 * Tests for mode-utils utility functions.
 * 
 * Tests mode normalization and validation.
 */
import { describe, expect, it } from 'vitest';
import { normalizeMode, isValidMode } from '../../src/editor/utils/mode-utils';

describe('normalizeMode', () => {
  it('passes through valid modes unchanged', () => {
    expect(normalizeMode('freeform')).toBe('freeform');
    expect(normalizeMode('ad')).toBe('ad');
    expect(normalizeMode('collection')).toBe('collection');
    expect(normalizeMode('batchcollection')).toBe('batchcollection');
  });

  it('normalizes legacy modes to collection', () => {
    // These were removed in UX simplification
    expect(normalizeMode('topology')).toBe('collection');
    expect(normalizeMode('config')).toBe('collection');
    expect(normalizeMode('event')).toBe('collection');
    expect(normalizeMode('property')).toBe('collection');
    expect(normalizeMode('log')).toBe('collection');
    expect(normalizeMode('batchconfig')).toBe('collection');
  });

  it('normalizes unknown modes to collection', () => {
    expect(normalizeMode('unknown')).toBe('collection');
    expect(normalizeMode('')).toBe('collection');
    expect(normalizeMode('script')).toBe('collection');
  });
});

describe('isValidMode', () => {
  it('returns true for valid modes', () => {
    expect(isValidMode('freeform')).toBe(true);
    expect(isValidMode('ad')).toBe(true);
    expect(isValidMode('collection')).toBe(true);
    expect(isValidMode('batchcollection')).toBe(true);
  });

  it('returns false for legacy modes', () => {
    expect(isValidMode('topology')).toBe(false);
    expect(isValidMode('config')).toBe(false);
    expect(isValidMode('event')).toBe(false);
    expect(isValidMode('property')).toBe(false);
    expect(isValidMode('log')).toBe(false);
  });

  it('returns false for invalid modes', () => {
    expect(isValidMode('')).toBe(false);
    expect(isValidMode('unknown')).toBe(false);
    expect(isValidMode('script')).toBe(false);
  });
});

