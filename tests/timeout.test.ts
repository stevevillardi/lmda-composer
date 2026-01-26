import { describe, it, expect, vi } from 'vitest';
import { withTimeout, TimeoutError, isTimeoutError } from '@/background/utils/timeout';

describe('timeout utilities', () => {
  describe('withTimeout', () => {
    it('resolves when promise completes before timeout', async () => {
      const result = await withTimeout(
        Promise.resolve('success'),
        1000
      );
      expect(result).toBe('success');
    });

    it('rejects with TimeoutError when promise takes too long', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve('too late'), 500);
      });

      await expect(
        withTimeout(slowPromise, 50, 'Custom timeout message')
      ).rejects.toThrow(TimeoutError);

      await expect(
        withTimeout(slowPromise, 50, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });

    it('preserves the original error when promise rejects', async () => {
      const error = new Error('Original error');
      const failingPromise = Promise.reject(error);

      await expect(withTimeout(failingPromise, 1000)).rejects.toThrow('Original error');
    });

    it('uses default error message when none provided', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve('too late'), 500);
      });

      await expect(
        withTimeout(slowPromise, 50)
      ).rejects.toThrow('Operation timed out after 50ms');
    });

    it('clears timeout when promise resolves quickly', async () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const quickPromise = Promise.resolve('quick');
      const resultPromise = withTimeout(quickPromise, 10000);

      await vi.runAllTimersAsync();
      await resultPromise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('TimeoutError', () => {
    it('has correct name and message', () => {
      const error = new TimeoutError('Test message');
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Test message');
    });

    it('uses default message when none provided', () => {
      const error = new TimeoutError();
      expect(error.message).toBe('Operation timed out');
    });

    it('is an instance of Error', () => {
      const error = new TimeoutError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
    });
  });

  describe('isTimeoutError', () => {
    it('returns true for TimeoutError instances', () => {
      const error = new TimeoutError();
      expect(isTimeoutError(error)).toBe(true);
    });

    it('returns false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(isTimeoutError(error)).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(isTimeoutError('string')).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
      expect(isTimeoutError({ message: 'fake error' })).toBe(false);
    });
  });
});
