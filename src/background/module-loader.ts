import type { 
  LogicModuleType,
  FetchModulesResponse,
} from '@/shared/types';
import { PortalManager } from './portal-manager';

// API endpoint paths for each module type
const ENDPOINTS: Record<LogicModuleType, string> = {
  datasource: '/setting/datasources',
  configsource: '/setting/configsources',
  topologysource: '/setting/topologysources',
  propertysource: '/setting/propertyrules',
  logsource: '/setting/logsources',
  diagnosticsource: '/setting/diagnosticsources',
  eventsource: '/setting/eventsources',
};

// Batch size for pagination
const PAGE_SIZE = 1000;

export class ModuleLoader {
  constructor(private portalManager: PortalManager) {}

  /**
   * Fetch a page of modules of a specific type from a portal.
   * Automatically re-discovers portals if the requested portal is not found
   * (handles service worker termination/restart)
   * 
   * Note: Returns a single page based on offset/size (defaults to PAGE_SIZE).
   */
  async fetchModules(
    portalId: string,
    moduleType: LogicModuleType,
    offset: number = 0,
    size?: number,
    search: string = ''
  ): Promise<FetchModulesResponse> {
    const pageSize = size ?? PAGE_SIZE;
    const tabId = await this.portalManager.getValidTabIdForPortal(portalId);
    if (!tabId) {
      return { items: [], total: 0, hasMore: false };
    }

    const portal = this.portalManager.getPortal(portalId);
    if (!portal) {
      return { items: [], total: 0, hasMore: false };
    }

    const endpoint = ENDPOINTS[moduleType];

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchModulesFromAPI,
        args: [portal.csrfToken, endpoint, moduleType, offset, pageSize, search],
      });

      if (!results?.[0]?.result) {
        return { items: [], total: 0, hasMore: false };
      }

      const pageResult = results[0].result as FetchModulesResponse;
      return {
        items: pageResult.items,
        total: pageResult.total,
        hasMore: pageResult.hasMore,
      };
    } catch {
      return { items: [], total: 0, hasMore: false };
    }
  }
}

// Types for API response parsing (must match what we receive from LM API)
interface APIModuleResponse {
  items?: APIModule[];
  data?: { items?: APIModule[] };
  total?: number;
}

// API response structure varies by module type
interface APIModule {
  id: number;
  name: string;
  displayName?: string;
  description?: string;
  appliesTo?: string;
  collectMethod?: string;
  lineageId?: string;
  collectInterval?: number;
  dataPoints?: Array<{
    id: number;
    name: string;
    description?: string;
    alertForNoData?: number | boolean;
    alertExpr?: string;
    alertTransitionInterval?: number;
    alertClearTransitionInterval?: number;
  }>;
  enableAutoDiscovery?: boolean;
  autoDiscoveryConfig?: {
    method?: {
      groovyScript?: string;
    };
  };
  // DataSource, ConfigSource, TopologySource use collectorAttribute
  collectorAttribute?: {
    groovyScript?: string;
    scriptType?: string;
  };
  // LogSource uses collectionAttribute with nested script object
  collectionAttribute?: {
    groovyScript?: string;
    scriptType?: string;
    script?: {
      embeddedContent?: string;
      type?: string;
    };
  };
  // PropertySource and DiagnosticSource use groovyScript directly
  groovyScript?: string;
  scriptType?: string;
  // LogSource specific
  collectionMethod?: string;  // uppercase version (e.g., "SCRIPT")
  appliesToScript?: string;   // LogSource uses this instead of appliesTo
  // EventSource specific
  collector?: string;         // e.g., "scriptevent" for script-based eventsources
}

/**
 * Function injected into the page context to fetch modules
 */
async function fetchModulesFromAPI(
  csrfToken: string | null,
  endpoint: string,
  moduleType: string,
  offset: number,
  size: number,
  search: string
): Promise<{
  items: Array<{
    id: number;
    name: string;
    displayName: string;
    moduleType: string;
    appliesTo: string;
    collectMethod: string;
    hasAutoDiscovery: boolean;
    scriptType: string;
    collectionScript?: string;
    adScript?: string;
    collector?: string;
  }>;
  total: number;
  hasMore: boolean;
}> {
  // Embedded lmFetch helper
  const lmFetch = <T = unknown>(url: string, opts: { csrfToken?: string | null } = {}): Promise<{ ok: boolean; data?: T }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', '3');
      if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let data: T | undefined;
        try { data = JSON.parse(xhr.responseText) as T; } catch { /* empty */ }
        resolve({ ok, data });
      };
      xhr.onerror = () => resolve({ ok: false });
      xhr.send();
    });

  // Build URL with query params
  let url = `${endpoint}?size=${size}&offset=${offset}`;
  
  const encodeFilterValue = (value: string): string => {
    const escaped = value.replace(/[()]/g, '\\$&');
    const once = encodeURIComponent(escaped);
    return encodeURIComponent(once);
  };

  if (search && search.trim()) {
    const escaped = search.replace(/"/g, '\\"');
    const encodedValue = encodeFilterValue(`*${escaped}*`);
    const searchFilter = `_all~"${encodedValue}"`;
    url += `&filter=${encodeURIComponent(searchFilter)}`;
  }

  const result = await lmFetch<APIModuleResponse>('/santaba/rest' + url, { csrfToken });

  if (!result.ok || !result.data) {
    return { items: [], total: 0, hasMore: false };
  }

  const response = result.data;
  const rawItems = response.items || response.data?.items || [];

  // Map to unified LogicModuleInfo format
  const normalizeScriptType = (raw?: string): string => {
    const normalized = (raw || '').toLowerCase();
    if (!normalized) return '';
    if (normalized === 'powershell') return 'powerShell';
    if (normalized === 'property') return 'property';
    if (normalized === 'embed' || normalized === 'embedded') return 'embed';
    return normalized;
  };

  const items = rawItems.map((m: APIModule) => {
    // Extract scripts based on module type
    let collectionScript: string | undefined;
    let adScript: string | undefined;
    let scriptType = 'embed';
    let hasAutoDiscovery = false;
    let collectMethod = m.collectMethod || 'script';
    let appliesTo = m.appliesTo || '';

    if (moduleType === 'propertysource') {
      // PropertySource stores script directly on the module in groovyScript
      collectionScript = m.groovyScript || '';
      scriptType = normalizeScriptType(m.scriptType) || 'embed';
      collectMethod = 'script';
    } else if (moduleType === 'diagnosticsource') {
      // DiagnosticSource stores script in groovyScript field
      collectionScript = m.groovyScript || '';
      scriptType = normalizeScriptType(m.scriptType) || 'embed';
      collectMethod = 'script';
    } else if (moduleType === 'eventsource') {
      // EventSource stores script in groovyScript field
      collectionScript = m.groovyScript || '';
      scriptType = normalizeScriptType(m.scriptType) || 'embed';
      collectMethod = 'script';
    } else if (moduleType === 'logsource') {
      // LogSource has different schema:
      // - collectionMethod (uppercase) instead of collectMethod
      // - script is in collectionAttribute.script.embeddedContent (NOT collectorAttribute)
      // - appliesToScript instead of appliesTo
      appliesTo = m.appliesToScript || m.appliesTo || '';
      collectMethod = (m.collectionMethod || m.collectMethod || 'SCRIPT').toLowerCase();
      
      // Primary location is collectionAttribute.script.embeddedContent
      collectionScript = m.collectionAttribute?.script?.embeddedContent
        || m.collectionAttribute?.groovyScript
        || '';
      
      // Determine script type from collectionAttribute
      const detectedType = m.collectionAttribute?.script?.type
        || m.collectionAttribute?.scriptType
        || 'embed';
      scriptType = normalizeScriptType(detectedType) || 'embed';
    } else {
      // DataSource, ConfigSource, TopologySource
      collectionScript = m.collectorAttribute?.groovyScript || '';
      // Normalize scriptType - API may return different casings
      scriptType = normalizeScriptType(m.collectorAttribute?.scriptType) || 'embed';
      
      // Only mark as AD if there's actually an AD script defined
      if (m.enableAutoDiscovery && m.autoDiscoveryConfig?.method) {
        const method = m.autoDiscoveryConfig.method;
        adScript = method.groovyScript || '';
        // Only set hasAutoDiscovery if there's actual script content
        hasAutoDiscovery = !!adScript?.trim();
      }
    }

    return {
      id: m.id,
      name: m.name,
      displayName: m.displayName || m.name,
      description: m.description || '',
      moduleType,
      appliesTo,
      collectMethod,
      collectInterval: m.collectInterval,
      hasAutoDiscovery,
      scriptType,
      lineageId: m.lineageId,
      collectionScript,
      adScript,
      dataPoints: m.dataPoints,
      collector: m.collector, // EventSource uses this to distinguish script vs non-script
    };
  });

  // Return items with actual API total for proper pagination
  const total = response.total || rawItems.length;
  
  return {
    items,
    total,
    hasMore: offset + items.length < total,
  };
}
