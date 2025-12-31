import { describe, expect, it } from 'vitest';
import { appendItemsWithLimit, estimateJsonByteLength } from '../src/editor/utils/api-pagination';

describe('api-pagination', () => {
  it('caps aggregation when the byte limit is exceeded', () => {
    const itemA = { id: 'a' };
    const itemB = { id: 'b' };
    const itemC = { id: 'c' };
    const limit =
      estimateJsonByteLength(itemA) + estimateJsonByteLength(itemB);

    let state = { items: [] as unknown[], estimatedBytes: 0, truncated: false };
    state = appendItemsWithLimit(state, [itemA, itemB, itemC], limit);

    expect(state.items).toEqual([itemA, itemB]);
    expect(state.truncated).toBe(true);
  });

  it('does not cap when under the limit', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const limit = estimateJsonByteLength(items) + 100;
    let state = { items: [] as unknown[], estimatedBytes: 0, truncated: false };
    state = appendItemsWithLimit(state, items, limit);

    expect(state.items).toEqual(items);
    expect(state.truncated).toBe(false);
  });
});
