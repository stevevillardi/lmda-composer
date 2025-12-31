import { beforeEach, describe, expect, it } from 'vitest';
import { isValidSender } from '../src/background/sender-validation';

describe('sender-validation', () => {
  beforeEach(() => {
    (globalThis as any).chrome = { runtime: { id: 'ext-id' } };
  });

  it('rejects senders from other extensions', () => {
    const result = isValidSender({ id: 'other-id' } as chrome.runtime.MessageSender);
    expect(result).toBe(false);
  });

  it('accepts extension pages', () => {
    const result = isValidSender({
      id: 'ext-id',
      url: 'chrome-extension://ext-id/page.html',
    } as chrome.runtime.MessageSender);
    expect(result).toBe(true);
  });

  it('accepts LogicMonitor pages', () => {
    const result = isValidSender({
      id: 'ext-id',
      url: 'https://acme.logicmonitor.com/some/page',
    } as chrome.runtime.MessageSender);
    expect(result).toBe(true);
  });

  it('rejects non-LogicMonitor pages', () => {
    const result = isValidSender({
      id: 'ext-id',
      url: 'https://example.com/page',
    } as chrome.runtime.MessageSender);
    expect(result).toBe(false);
  });

  it('accepts messages without a sender url', () => {
    const result = isValidSender({
      id: 'ext-id',
      url: undefined,
    } as chrome.runtime.MessageSender);
    expect(result).toBe(true);
  });
});
