import type { ExecuteApiRequest, ExecuteApiResponse } from '@/shared/types';
import { normalizeApiPath } from '@/shared/api-utils';
import type { ExecutorContext } from './script-executor';
import { getNoCsrfTokenMessage } from './error-messages';

export class ApiExecutor {
  private context: ExecutorContext;

  constructor(context: ExecutorContext) {
    this.context = context;
  }

  async execute(request: ExecuteApiRequest): Promise<ExecuteApiResponse> {
    const startTime = Date.now();
    let csrfToken = await this.acquireCsrfToken(request.portalId);

    if (!csrfToken) {
      throw new Error(getNoCsrfTokenMessage());
    }

    const response = await this.executeRequest(request, csrfToken);

    if (response.status === 403) {
      const refreshed = await this.context.refreshCsrfToken(request.portalId);
      if (refreshed) {
        csrfToken = refreshed;
        const retry = await this.executeRequest(request, csrfToken);
        return {
          status: retry.status,
          headers: retry.headers,
          body: retry.body,
          durationMs: Date.now() - startTime,
        };
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      body: response.body,
      durationMs: Date.now() - startTime,
    };
  }

  private async executeRequest(
    request: ExecuteApiRequest,
    csrfToken: string
  ): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    const normalizedPath = normalizeApiPath(request.path);
    const url = new URL(`https://${request.portalId}${normalizedPath}`);

    if (request.queryParams) {
      Object.entries(request.queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).length > 0) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Normalize user headers to check for case-insensitive overrides
    const userHeaderKeys = Object.keys(request.headerParams || {}).map(k => k.toLowerCase());
    
    const headers: Record<string, string> = {
      'X-CSRF-Token': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      // Only set default X-version if user hasn't provided one (case-insensitive check)
      ...(!userHeaderKeys.includes('x-version') && { 'X-version': '3' }),
      // User-provided headers override defaults
      ...request.headerParams,
    };

    const canHaveBody = request.method !== 'GET';
    const hasBody = canHaveBody && request.body && request.body.trim().length > 0;
    if (hasBody && request.contentType) {
      headers['Content-Type'] = request.contentType;
    }

    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      credentials: 'include',
    });

    const body = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      headers: responseHeaders,
      body,
    };
  }

  private async acquireCsrfToken(portalId: string): Promise<string | null> {
    let csrfToken = this.context.getCsrfToken(portalId);
    if (csrfToken) return csrfToken;

    csrfToken = await this.context.refreshCsrfToken(portalId);
    if (csrfToken) return csrfToken;

    await this.context.discoverPortals();
    return this.context.getCsrfToken(portalId);
  }
}
