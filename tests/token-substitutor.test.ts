import { describe, it, expect } from 'vitest';
import { hasTokens, substituteTokens, substituteWithEmpty } from '../src/background/token-substitutor';

describe('token-substitutor', () => {
  it('detects tokens in script', () => {
    expect(hasTokens('Write-Host "no tokens"')).toBe(false);
    expect(hasTokens('Host: ##SYSTEM.HOSTNAME##')).toBe(true);
  });

  it('substitutes tokens case-insensitively', () => {
    const script = 'Host=##system.hostname##, Env=##CUSTOM.ENV##';
    const props = {
      'System.Hostname': 'server-01',
      'custom.env': 'prod',
    };

    const result = substituteTokens(script, props);
    expect(result.script).toBe('Host=server-01, Env=prod');
    expect(result.missing).toEqual([]);
    expect(result.substitutions.length).toBe(2);
  });

  it('substitutes missing tokens with empty string', () => {
    const script = 'Host=##SYSTEM.HOSTNAME##, Missing=##MISSING.VALUE##';
    const result = substituteWithEmpty(script);
    expect(result.script).toBe('Host=, Missing=');
    expect(result.missing).toContain('SYSTEM.HOSTNAME');
    expect(result.missing).toContain('MISSING.VALUE');
  });
});
