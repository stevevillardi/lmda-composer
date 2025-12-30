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
   * Fetch ALL modules of a specific type from a portal with automatic pagination.
   * Automatically re-discovers portals if the requested portal is not found
   * (handles service worker termination/restart)
   * 
   * Note: Always fetches all modules with automatic pagination. The offset/size
   * parameters from FetchModulesRequest are ignored; we use internal PAGE_SIZE.
   */
  async fetchModules(
    portalId: string,
    moduleType: LogicModuleType
  ): Promise<FetchModulesResponse> {
    let portal = this.portalManager.getPortal(portalId);
    
    // If portal not found (e.g., after service worker restart), try to rediscover
    if (!portal || portal.tabIds.length === 0) {
      await this.portalManager.discoverPortals();
      portal = this.portalManager.getPortal(portalId);
    }
    
    if (!portal || portal.tabIds.length === 0) {
      return { items: [], total: 0, hasMore: false };
    }

    const tabId = portal.tabIds[0];
    const endpoint = ENDPOINTS[moduleType];
    const needsFilter = NEEDS_SCRIPT_FILTER.includes(moduleType);

    try {
      // Paginate through all results
      let allItems: FetchModulesResponse['items'] = [];
      let offset = 0;
      let total = 0;
      let hasMore = true;

      while (hasMore) {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: fetchModulesFromAPI,
          args: [portal.csrfToken, endpoint, moduleType, needsFilter, offset, PAGE_SIZE],
        });

        if (!results?.[0]?.result) break;

        const pageResult = results[0].result as FetchModulesResponse;
        allItems = allItems.concat(pageResult.items);
        total = pageResult.total;
        
        offset += PAGE_SIZE;
        hasMore = offset < total;
      }

      // Post-filter for LogSource: only include script-based modules
      if (moduleType === 'logsource') {
        allItems = allItems.filter(item => 
          item.collectMethod === 'script' && item.collectionScript
        );
      }

      if (moduleType === 'topologysource') {
        allItems = allItems.filter(item => item.scriptType === 'embed');
      }

      if (moduleType === 'eventsource') {
        allItems = allItems.filter(item => item.scriptType === 'embed');
      }

      return {
        items: allItems,
        total: allItems.length,
        hasMore: false, // We fetched everything
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
  size: number
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
    
    // Add filter for script-based modules only
    if (needsFilter) {
      url += '&filter=collectMethod~"script"';
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
            scriptType = m.scriptType || 'embed';
            collectMethod = 'script';
          } else if (moduleType === 'diagnosticsource') {
            // DiagnosticSource stores script in groovyScript field
            collectionScript = m.groovyScript || '';
            scriptType = m.scriptType || 'embed';
            collectMethod = 'script';
          } else if (moduleType === 'eventsource') {
            // EventSource stores script in groovyScript field
            collectionScript = m.groovyScript || '';
            scriptType = m.scriptType || '';
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
              scriptType = detectedType.toLowerCase() === 'powershell' ? 'powerShell' : 'embed';
            } else {
              // DataSource, ConfigSource, TopologySource
              collectionScript = m.collectorAttribute?.groovyScript || '';
              // Normalize scriptType - API may return different casings
              const rawScriptType = m.collectorAttribute?.scriptType || '';
              if (rawScriptType) {
                const normalizedType = rawScriptType.toLowerCase();
                if (normalizedType === 'powershell') {
                  scriptType = 'powerShell';
                } else if (normalizedType === 'property') {
                  scriptType = 'property';
                } else {
                  scriptType = 'embed';
                }
              } else {
                scriptType = '';
              }
              
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
