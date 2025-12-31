import { describe, expect, it } from 'vitest';
import { buildApiVariableResolver } from '../src/editor/utils/api-variables';

describe('api-variables', () => {
  it('resolves known variables and preserves unknown ones', () => {
    const resolve = buildApiVariableResolver([
      { key: 'portal', value: 'acme.logicmonitor.com' },
    ]);

    expect(resolve('https://{{portal}}/santaba/rest')).toBe('https://acme.logicmonitor.com/santaba/rest');
    expect(resolve('{{unknown}}')).toBe('{{unknown}}');
  });
});
