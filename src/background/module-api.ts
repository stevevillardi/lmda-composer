import type { LogicModuleType } from '@/shared/types';

const API_VERSION = '3';

// API endpoint paths for each module type
const ENDPOINTS: Record<LogicModuleType, string> = {
  datasource: '/setting/datasources',
  configsource: '/setting/configsources',
  topologysource: '/setting/topologysources',
  propertysource: '/setting/propertyrules',
  logsource: '/setting/logsources',
  diagnosticsource: '/setting/diagnosticsources',
};

// API response structure varies by module type
interface APIModule {
  id: number;
  name: string;
  displayName?: string;
  appliesTo?: string;
  collectMethod?: string;
  enableAutoDiscovery?: boolean;
  autoDiscoveryConfig?: {
    scheduleInterval?: number;
    method?: {
      groovyScript?: string;
      linuxScript?: string;
      winScript?: string;
    };
  };
  // DataSource, ConfigSource, TopologySource use collectorAttribute
  collectorAttribute?: {
    name?: string;
    groovyScript?: string;
    scriptType?: string;
    linuxScript?: string;
    windowsScript?: string;
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
 * Build update payload for module script
 */
function buildUpdatePayload(
  module: APIModule,
  moduleType: LogicModuleType,
  scriptType: 'collection' | 'ad',
  newScript: string
): Partial<APIModule> {
  const payload: Partial<APIModule> = {};

  if (scriptType === 'ad') {
    // Active Discovery scripts
    if (!module.autoDiscoveryConfig) {
      payload.autoDiscoveryConfig = {
        method: {
          groovyScript: newScript,
        },
      };
    } else {
      payload.autoDiscoveryConfig = {
        ...module.autoDiscoveryConfig,
        method: {
          ...module.autoDiscoveryConfig.method,
          groovyScript: newScript,
        },
      };
    }
  } else {
    // Collection scripts
    if (moduleType === 'propertysource' || moduleType === 'diagnosticsource') {
      payload.groovyScript = newScript;
    } else if (moduleType === 'logsource') {
      // LogSource uses collectionAttribute.script.embeddedContent
      if (!module.collectionAttribute) {
        payload.collectionAttribute = {
          script: {
            embeddedContent: newScript,
            type: 'embedded',
          },
        };
      } else {
        payload.collectionAttribute = {
          ...module.collectionAttribute,
          script: {
            ...module.collectionAttribute.script,
            embeddedContent: newScript,
            type: module.collectionAttribute.script?.type || 'embedded',
          },
        };
      }
    } else {
      // DataSource, ConfigSource, TopologySource
      if (!module.collectorAttribute) {
        payload.collectorAttribute = {
          groovyScript: newScript,
          scriptType: 'embed',
        };
      } else {
        payload.collectorAttribute = {
          ...module.collectorAttribute,
          groovyScript: newScript,
        };
      }
    }
  }

  return payload;
}

/**
 * Function injected into the page context to fetch a single module by ID
 */
function fetchModuleByIdFromAPI(
  csrfToken: string | null,
  endpoint: string,
  moduleId: number,
  apiVersion: string
): Promise<APIModule | null | { error: string; status?: number; responseText?: string }> {
  return new Promise((resolve) => {
    const url = `/santaba/rest${endpoint}/${moduleId}`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    try {
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', apiVersion);
      // Note: fetchModulesFromAPI doesn't use X-Requested-With, so we'll match that pattern
      if (csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }
    } catch (headerError) {
      console.error(`[fetchModuleByIdFromAPI] Error setting headers:`, headerError);
      resolve({ error: `Failed to set headers: ${headerError instanceof Error ? headerError.message : 'Unknown'}` });
      return;
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          // Try different response formats
          const module = response.data || response.items?.[0] || response;
          if (module && module.id) {
            resolve(module as APIModule);
          } else {
            console.error(`[fetchModuleByIdFromAPI] Invalid module structure:`, response);
            resolve({ error: 'Invalid module structure', status: xhr.status, responseText: xhr.responseText });
          }
        } catch (error) {
          console.error('[fetchModuleByIdFromAPI] Error parsing module response:', error, 'Response text:', xhr.responseText);
          resolve({ error: 'Parse error', status: xhr.status, responseText: xhr.responseText });
        }
      } else if (xhr.status === 404) {
        console.error(`[fetchModuleByIdFromAPI] Module not found: ${endpoint}/${moduleId}, status: ${xhr.status}`);
        resolve({ error: 'Module not found', status: 404 });
      } else {
        console.error(`[fetchModuleByIdFromAPI] Failed to fetch module: ${endpoint}/${moduleId}, status: ${xhr.status}, response:`, xhr.responseText);
        resolve({ error: `HTTP ${xhr.status}`, status: xhr.status, responseText: xhr.responseText });
      }
    };

    xhr.onerror = () => {
      console.error(`[fetchModuleByIdFromAPI] XHR error for ${url}`);
      resolve({ error: 'Network error' });
    };
    
    xhr.ontimeout = () => {
      console.error(`[fetchModuleByIdFromAPI] XHR timeout for ${url}`);
      resolve({ error: 'Request timeout' });
    };
    
    try {
      xhr.send();
    } catch (sendError) {
      console.error(`[fetchModuleByIdFromAPI] Error calling xhr.send():`, sendError);
      resolve({ error: `Failed to send request: ${sendError instanceof Error ? sendError.message : 'Unknown error'}` });
    }
  });
}

/**
 * Function injected into the page context to update a module
 */
function updateModuleInAPI(
  csrfToken: string | null,
  endpoint: string,
  moduleId: number,
  payload: Partial<APIModule>,
  apiVersion: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PATCH', `/santaba/rest${endpoint}/${moduleId}`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', apiVersion);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 204) {
        resolve({ success: true });
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          const errorMessage = errorData.errorMessage || errorData.message || `Failed to update module: ${xhr.status}`;
          resolve({ success: false, error: errorMessage });
        } catch {
          resolve({ success: false, error: `Failed to update module: ${xhr.status}` });
        }
      }
    };

    xhr.onerror = () => resolve({ success: false, error: 'Network error' });
    xhr.send(JSON.stringify(payload));
  });
}

/**
 * Fetch a single module by ID
 */
export async function fetchModuleById(
  _portalId: string,
  csrfToken: string | null,
  moduleType: LogicModuleType,
  moduleId: number,
  tabId: number
): Promise<APIModule | null> {
  const endpoint = ENDPOINTS[moduleType];

  try {
    // Check if tab exists and is accessible
    try {
      await chrome.tabs.get(tabId);
    } catch (tabError) {
      console.error(`[fetchModuleById] Tab ${tabId} is not accessible:`, tabError);
      return null;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: fetchModuleByIdFromAPI,
      args: [csrfToken, endpoint, moduleId, API_VERSION],
    });

    if (!results || results.length === 0) {
      console.error(`[fetchModuleById] No results array from injected script`);
      return null;
    }

    const result = results[0]?.result;
    if (!result) {
      console.error(`[fetchModuleById] No result from injected script`);
      return null;
    }

    // Check if result is an error object
    if (typeof result === 'object' && 'error' in result) {
      const errorResult = result as { error: string; status?: number; responseText?: string };
      console.error(`[fetchModuleById] Error from injected script:`, errorResult);
      return null;
    }

    return result as APIModule | null;
  } catch (error) {
    console.error('[fetchModuleById] Error fetching module:', error);
    return null;
  }
}

/**
 * Commit script changes to a module
 */
export async function commitModuleScript(
  portalId: string,
  csrfToken: string | null,
  moduleType: LogicModuleType,
  moduleId: number,
  scriptType: 'collection' | 'ad',
  newScript: string,
  tabId: number
): Promise<{ success: boolean; error?: string }> {
  const endpoint = ENDPOINTS[moduleType];

  // First, fetch the current module to build the update payload
  const currentModule = await fetchModuleById(portalId, csrfToken, moduleType, moduleId, tabId);
  
  if (!currentModule) {
    console.error(`[commitModuleScript] Failed to fetch module ${moduleType}/${moduleId}`);
    return { success: false, error: 'Module not found or could not be fetched' };
  }

  // Build the update payload
  const payload = buildUpdatePayload(currentModule, moduleType, scriptType, newScript);

  // Update the module
  try {
    // Check if tab exists and is accessible
    try {
      await chrome.tabs.get(tabId);
    } catch (tabError) {
      console.error(`[commitModuleScript] Tab ${tabId} is not accessible:`, tabError);
      return { success: false, error: `Tab ${tabId} is not accessible. Please refresh the LogicMonitor page.` };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: updateModuleInAPI,
      args: [csrfToken, endpoint, moduleId, payload, API_VERSION],
    });

    if (!results || results.length === 0) {
      console.error(`[commitModuleScript] No results array from injected script`);
      return { success: false, error: 'Failed to execute update script' };
    }

    if (!results[0]?.result) {
      console.error(`[commitModuleScript] No result from update script`);
      return { success: false, error: 'Failed to update module' };
    }

    return results[0].result as { success: boolean; error?: string };
  } catch (error) {
    console.error('[commitModuleScript] Error committing module script:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

