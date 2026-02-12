import { describe, expect, it, vi } from 'vitest';
import { handleCsrfToken } from '../../src/background/handlers/portal-handlers';

describe('portal-handlers', () => {
  describe('handleCsrfToken', () => {
    it('responds with success when token is received', async () => {
      const sendResponse = vi.fn();
      const receiveCsrfTokenFromContentScript = vi.fn().mockResolvedValue(undefined);
      const context = {
        portalManager: {
          receiveCsrfTokenFromContentScript,
        },
      } as never;

      handleCsrfToken(
        { portalId: 'test.logicmonitor.com', token: 'token-123' },
        sendResponse,
        context
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
      });

      expect(receiveCsrfTokenFromContentScript).toHaveBeenCalledWith('test.logicmonitor.com', 'token-123');
    });

    it('responds with failure when token receipt fails', async () => {
      const sendResponse = vi.fn();
      const receiveCsrfTokenFromContentScript = vi.fn().mockRejectedValue(new Error('portal missing'));
      const context = {
        portalManager: {
          receiveCsrfTokenFromContentScript,
        },
      } as never;

      handleCsrfToken(
        { portalId: 'test.logicmonitor.com', token: 'token-123' },
        sendResponse,
        context
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'portal missing',
        });
      });
    });
  });
});
