import { describe, expect, it } from 'vitest';
import { generateExampleFromSchema } from '../src/editor/utils/api-example';

describe('generateExampleFromSchema', () => {
  it('uses example when provided', () => {
    expect(generateExampleFromSchema({ example: 'value' })).toBe('value');
  });

  it('uses enum first value', () => {
    expect(generateExampleFromSchema({ enum: ['a', 'b'] })).toBe('a');
  });

  it('generates object examples with properties', () => {
    const example = generateExampleFromSchema({
      type: 'object',
      properties: {
        name: { type: 'string' },
        enabled: { type: 'boolean' },
      },
    }) as Record<string, unknown>;
    expect(example).toEqual({ name: 'string', enabled: false });
  });

  it('generates array examples from items', () => {
    expect(generateExampleFromSchema({ type: 'array', items: { type: 'integer' } })).toEqual([0]);
  });
});
