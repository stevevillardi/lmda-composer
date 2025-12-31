export interface AggregationState {
  items: unknown[];
  estimatedBytes: number;
  truncated: boolean;
}

export interface AggregationMeta {
  itemsFetched: number;
  pagesFetched: number;
  limit: number;
  truncated: boolean;
  reason?: string;
}

export function estimateJsonByteLength(value: unknown): number {
  const text = JSON.stringify(value);
  return new TextEncoder().encode(text).length;
}

export function appendItemsWithLimit(
  state: AggregationState,
  newItems: unknown[],
  limit: number
): AggregationState {
  if (state.truncated) {
    return state;
  }

  for (const item of newItems) {
    const itemSize = estimateJsonByteLength(item);
    if (state.estimatedBytes + itemSize > limit) {
      return {
        ...state,
        truncated: true,
      };
    }
    state.items.push(item);
    state.estimatedBytes += itemSize;
  }

  return state;
}
