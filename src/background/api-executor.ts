import type { ExecuteApiRequest, ExecuteApiResponse } from '@/shared/types';
import type { ExecutorContext } from './script-executor';

export class ApiExecutor {
  private context: ExecutorContext;

  constructor(context: ExecutorContext) {
    this.context = context;
  }

  async execute(request: ExecuteApiRequest): Promise<ExecuteApiResponse> {
    const startTime = Date.now();
    let csrfToken = await this.acquireCsrfToken(request.portalId);

    if (!csrfToken) {
      throw new Error('No CSRF token available - please ensure you are logged into the LogicMonitor portal');
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
    const normalizedPath = this.normalizePath(request.path);
    const url = new URL(`https://${request.portalId}${normalizedPath}`);

    if (request.queryParams) {
      Object.entries(request.queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).length > 0) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'X-CSRF-Token': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'X-version': '3',
      ...request.headerParams,
    };

    const canHaveBody = request.method !== 'GET' && request.method !== 'HEAD';
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

  private normalizePath(path: string): string {
    const trimmed = path.startsWith('/') ? path : `/${path}`;
    if (trimmed.startsWith('/santaba/rest')) {
      return trimmed;
    }
    return `/santaba/rest${trimmed}`;
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
