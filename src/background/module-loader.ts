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

// Module types that need script filter (have non-script collection methods)
// Note: logsource uses collectionMethod (uppercase) and has different schema - filter separately
// Note: propertysource and diagnosticsource are always script-based
const NEEDS_SCRIPT_FILTER: LogicModuleType[] = [
  'datasource',
  'configsource', 
  'topologysource',
];

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
    size: number = PAGE_SIZE,
    search: string = ''
  ): Promise<FetchModulesResponse> {
    const tabId = await this.portalManager.getValidTabIdForPortal(portalId);
    if (!tabId) {
      return { items: [], total: 0, hasMore: false };
    }

    const portal = this.portalManager.getPortal(portalId);
    if (!portal) {
      return { items: [], total: 0, hasMore: false };
    }

    const endpoint = ENDPOINTS[moduleType];
    const needsFilter = NEEDS_SCRIPT_FILTER.includes(moduleType);

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchModulesFromAPI,
        args: [portal.csrfToken, endpoint, moduleType, needsFilter, offset, size, search],
      });

      if (!results?.[0]?.result) {
        return { items: [], total: 0, hasMore: false };
      }

      const pageResult = results[0].result as FetchModulesResponse;
      let items = pageResult.items;

      // Post-filter for LogSource: only include script-based modules
      if (moduleType === 'logsource') {
        items = items.filter(item => 
          item.collectMethod === 'script' && item.collectionScript
        );
      }

      if (moduleType === 'topologysource') {
        items = items.filter(item => item.scriptType === 'embed');
      }

      if (moduleType === 'eventsource') {
        items = items.filter(item => item.scriptType === 'embed');
      }

      return {
        items,
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
  enableAutoDiscovery?: boolean;
  autoDiscoveryConfig?: {
    method?: {
      groovyScript?: string;
      linuxScript?: string;
      winScript?: string;
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
}

/**
 * Function injected into the page context to fetch modules
 */
function fetchModulesFromAPI(
  csrfToken: string | null,
  endpoint: string,
  moduleType: string,
  needsFilter: boolean,
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
  }>;
  total: number;
  hasMore: boolean;
}> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    
    // Build URL with query params
    let url = `${endpoint}?size=${size}&offset=${offset}`;
    
    const encodeFilterValue = (value: string): string => {
      const escaped = value.replace(/[()]/g, '\\$&');
      const once = encodeURIComponent(escaped);
      return encodeURIComponent(once);
    };

    const filters: string[] = [];
    if (needsFilter) {
      filters.push('collectMethod~"script"');
    }
    if (search && search.trim()) {
      const escaped = search.replace(/"/g, '\\"');
      const encodedValue = encodeFilterValue(`*${escaped}*`);
      const searchFilter = `_all~"${encodedValue}"`;
      filters.push(searchFilter);
    }
    if (filters.length > 0) {
      url += `&filter=${encodeURIComponent(filters.join(','))}`;
    }

    xhr.open('GET', '/santaba/rest' + url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', '3');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText) as APIModuleResponse;
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
                adScript = method.groovyScript || method.linuxScript || method.winScript || '';
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
              hasAutoDiscovery,
              scriptType,
              lineageId: m.lineageId,
              collectionScript,
              adScript,
            };
          });

          // Return items with actual API total for proper pagination
          const total = response.total || rawItems.length;
          
          resolve({
            items,
            total,
            hasMore: offset + items.length < total,
          });
        } catch {
          resolve({ items: [], total: 0, hasMore: false });
        }
      } else {
        resolve({ items: [], total: 0, hasMore: false });
      }
    };

    xhr.onerror = () => resolve({ items: [], total: 0, hasMore: false });

    xhr.send();
  });
}
