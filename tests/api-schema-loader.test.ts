import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadApiSchema, resetApiSchemaCache } from '../src/editor/data/api-schema';

// Store original fetch to restore later
const originalFetch = globalThis.fetch;

describe('api schema loader', () => {
  afterEach(() => {
    resetApiSchemaCache();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('loads and caches schema from remote source', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paths: {
          '/test': {
            get: {
              tags: ['Tests'],
              summary: 'Test endpoint',
              parameters: [
                { name: 'id', in: 'query', required: false, schema: { type: 'string' } },
              ],
            },
          },
        },
      }),
    });
    globalThis.fetch = fetchSpy;

    const first = await loadApiSchema();
    const second = await loadApiSchema();

    expect(first.endpoints.length).toBe(1);
    expect(second.endpoints.length).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when remote schema cannot be loaded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(loadApiSchema()).rejects.toThrow('Failed to load API schema');
  });
});
