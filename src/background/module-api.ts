import type { LogicModuleType, LineageVersion } from '@/shared/types';

const API_VERSION = '3';
const LINEAGE_API_VERSION = '4';

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

const LINEAGE_MODEL_KEYS: Record<LogicModuleType, string> = {
  datasource: 'exchangeDataSources',
  configsource: 'exchangeConfigSources',
  topologysource: 'exchangeTopologySources',
  propertysource: 'exchangePropertySources',
  logsource: 'exchangeLogSources',
  diagnosticsource: 'exchangeDiagnosticSources',
  eventsource: 'exchangeEventSources',
};

// API response structure varies by module type
interface APIModule {
  id: number;
  name: string;
  displayName?: string;
  description?: string;
  appliesTo?: string;
  group?: string;
  technology?: string;
  tags?: string | string[];
  collectInterval?: number;
  collectMethod?: string;
  enableAutoDiscovery?: boolean;
  accessGroupIds?: number[] | string;
  accessGroups?: Array<{
    id: number;
    name: string;
    description?: string;
    createdOn?: number;
    updatedOn?: number;
    createdBy?: string;
    tenantId?: string | null;
  }>;
  version?: number;
  dataPoints?: Array<{
    id: number;
    name: string;
    type?: number;
    description?: string;
    postProcessorMethod?: string;
    alertForNoData?: number | boolean;
    alertExpr?: string;
    alertTransitionInterval?: number;
    alertClearTransitionInterval?: number;
    [key: string]: unknown;
  }>;
  autoDiscoveryConfig?: {
    persistentInstance?: boolean;
    scheduleInterval?: number; // 0|15|60|1440 minutes
    deleteInactiveInstance?: boolean;
    method?: {
      name?: string;
      groovyScript?: string;
    };
    instanceAutoGroupMethod?: string; // none|netscaler|netscalerservicegroup|regex|esx|ilp
    instanceAutoGroupMethodParams?: string;
    filters?: Array<{
      comment?: string;
      attribute: string;
      operation: string; // Equal|NotEqual|GreaterThan|GreaterEqual|LessThan|LessEqual|Contain|NotContain|NotExist|RegexMatch|RegexNotMatch
      value?: string;
    }>;
    disableInstance?: boolean;
    showDeletedInstanceDays?: number; // 0 or 30
  };
  // DataSource, ConfigSource, TopologySource use collectorAttribute
  collectorAttribute?: {
    name?: string;
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

interface AccessGroup {
  id: number;
  name: string;
  description?: string;
  createdOn?: number;
  updatedOn?: number;
  createdBy?: string;
  tenantId?: string | null;
}

interface LineageResponse {
  data?: {
    byId?: Record<string, Record<string, Record<string, unknown>>>;
  };
}

function pickFirstString(values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

function extractLineageScripts(module: Record<string, unknown>, moduleType: LogicModuleType) {
  const script = module['script'] as {
    groovyScript?: string;
    powershellScript?: string;
  } | undefined;

  const collectionAttributes = module['collectionAttributes'] as {
    script?: { groovyScript?: string; powershellScript?: string; embeddedContent?: string };
  } | undefined;

  const activeDiscoveryConfig = module['activeDiscoveryConfig'] as {
    activeDiscoveryParams?: {
      script?: { groovyScript?: string; powershellScript?: string };
    };
  } | undefined;

  if (moduleType === 'topologysource') {
    return {
      collectionScript: pickFirstString([
        script?.groovyScript,
        script?.powershellScript,
      ]),
      adScript: '',
    };
  }

  if (moduleType === 'logsource') {
    return {
      collectionScript: pickFirstString([
        collectionAttributes?.script?.embeddedContent,
      ]),
      adScript: '',
    };
  }

  if (moduleType === 'diagnosticsource') {
    return {
      collectionScript: pickFirstString([
        script?.groovyScript,
        script?.powershellScript,
      ]),
      adScript: '',
    };
  }

  if (moduleType === 'propertysource') {
    return {
      collectionScript: pickFirstString([
        script?.groovyScript,
        script?.powershellScript,
      ]),
      adScript: '',
    };
  }

  if (moduleType === 'configsource') {
    return {
      collectionScript: pickFirstString([
        script?.groovyScript,
        script?.powershellScript,
      ]),
      adScript: pickFirstString([
        activeDiscoveryConfig?.activeDiscoveryParams?.script?.groovyScript,
        activeDiscoveryConfig?.activeDiscoveryParams?.script?.powershellScript,
      ]),
    };
  }

  if (moduleType === 'datasource') {
    return {
      collectionScript: pickFirstString([
        collectionAttributes?.script?.groovyScript,
        collectionAttributes?.script?.powershellScript,
      ]),
      adScript: pickFirstString([
        activeDiscoveryConfig?.activeDiscoveryParams?.script?.groovyScript,
        activeDiscoveryConfig?.activeDiscoveryParams?.script?.powershellScript,
      ]),
    };
  }

  if (moduleType === 'eventsource') {
    return {
      collectionScript: pickFirstString([script?.groovyScript]),
      adScript: '',
    };
  }

  return { collectionScript: '', adScript: '' };
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
    if (moduleType === 'propertysource' || moduleType === 'diagnosticsource' || moduleType === 'eventsource') {
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
async function fetchModuleByIdFromAPI(
  csrfToken: string | null,
  endpoint: string,
  moduleId: number,
  apiVersion: string
): Promise<APIModule | null | { error: string; status?: number; responseText?: string }> {
  // Embedded lmFetch helper
  const lmFetch = <T = unknown>(url: string, opts: { csrfToken?: string | null; apiVersion?: string } = {}): Promise<{ ok: boolean; status: number; data?: T; text?: string; error?: string }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', opts.apiVersion || '3');
      if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let data: T | undefined;
        try { data = JSON.parse(xhr.responseText) as T; } catch { /* empty */ }
        resolve({ ok, status: xhr.status, data, text: xhr.responseText });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, error: 'Network error' });
      xhr.send();
    });

  const url = `/santaba/rest${endpoint}/${moduleId}`;
  const result = await lmFetch<{ data?: APIModule; items?: APIModule[]; id?: number } & APIModule>(
    url,
    { csrfToken, apiVersion }
  );

  if (result.error) {
    console.error(`[fetchModuleByIdFromAPI] XHR error for ${url}`);
    return { error: result.error };
  }

  if (result.ok && result.data) {
    // Try different response formats
    const module = result.data.data || result.data.items?.[0] || result.data;
    if (module && module.id) {
      return module as APIModule;
    }
    console.error(`[fetchModuleByIdFromAPI] Invalid module structure:`, result.data);
    return { error: 'Invalid module structure', status: result.status, responseText: result.text };
  }

  if (result.status === 404) {
    console.error(`[fetchModuleByIdFromAPI] Module not found: ${endpoint}/${moduleId}, status: ${result.status}`);
    return { error: 'Module not found', status: 404 };
  }

  console.error(`[fetchModuleByIdFromAPI] Failed to fetch module: ${endpoint}/${moduleId}, status: ${result.status}, response:`, result.text);
  return { error: `HTTP ${result.status}`, status: result.status, responseText: result.text };
}

/**
 * Function injected into the page context to update a module
 */
async function updateModuleInAPI(
  csrfToken: string | null,
  endpoint: string,
  moduleId: number,
  payload: Partial<APIModule>,
  apiVersion: string,
  reason?: string | null
): Promise<{ success: boolean; error?: string }> {
  // Embedded lmFetch helper with X-Requested-With support
  const lmFetch = <T = unknown>(url: string, opts: { method?: string; csrfToken?: string | null; body?: unknown; apiVersion?: string; xRequestedWith?: boolean } = {}): Promise<{ ok: boolean; status: number; data?: T }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', opts.apiVersion || '3');
      if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
      if (opts.xRequestedWith) xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let data: T | undefined;
        try { data = JSON.parse(xhr.responseText) as T; } catch { /* empty */ }
        resolve({ ok, status: xhr.status, data });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0 });
      xhr.send(opts.body ? JSON.stringify(opts.body) : undefined);
    });

  const reasonParam = reason ? `?reason=${encodeURIComponent(reason.slice(0, 4096))}` : '';
  const result = await lmFetch<{ errorMessage?: string; message?: string; errorDetail?: string; errorCode?: number }>(
    `/santaba/rest${endpoint}/${moduleId}${reasonParam}`,
    { method: 'PATCH', csrfToken, body: payload, apiVersion, xRequestedWith: true }
  );

  if (result.ok) {
    return { success: true };
  }

  if (result.data) {
    const baseMessage = result.data.errorMessage || result.data.message || `Failed to update module: ${result.status}`;
    const detailMessage = result.data.errorDetail ? `\n${result.data.errorDetail}` : '';
    const codeMessage = result.data.errorCode ? `\nError code: ${result.data.errorCode}` : '';
    return { success: false, error: `${baseMessage}${detailMessage}${codeMessage}` };
  }

  return { success: false, error: result.status === 0 ? 'Network error' : `Failed to update module: ${result.status}` };
}

async function fetchLineageVersionsFromAPI(
  csrfToken: string | null,
  lineageId: string,
  apiVersion: string
): Promise<LineageResponse | { error: string; status?: number; responseText?: string }> {
  // Embedded lmFetch helper
  const lmFetch = <T = unknown>(url: string, opts: { method?: string; csrfToken?: string | null; body?: unknown; apiVersion?: string } = {}): Promise<{ ok: boolean; status: number; data?: T; text?: string }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', opts.apiVersion || '3');
      if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let data: T | undefined;
        try { data = JSON.parse(xhr.responseText) as T; } catch { /* empty */ }
        resolve({ ok, status: xhr.status, data, text: xhr.responseText });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, text: '' });
      xhr.send(opts.body ? JSON.stringify(opts.body) : undefined);
    });

  const result = await lmFetch<LineageResponse>(
    `/santaba/rest/exchange/store/lineages/${lineageId}`,
    { method: 'POST', csrfToken, body: {}, apiVersion }
  );

  if (result.ok && result.data) {
    return result.data;
  }
  return { error: result.data ? 'Parse error' : `HTTP ${result.status}`, status: result.status, responseText: result.text };
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
 * Commit script changes to a module (optionally with module details changes)
 */
export async function commitModuleScript(
  portalId: string,
  csrfToken: string | null,
  moduleType: LogicModuleType,
  moduleId: number,
  scriptType: 'collection' | 'ad',
  newScript: string | undefined,
  tabId: number,
  moduleDetails?: Partial<APIModule>,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const endpoint = ENDPOINTS[moduleType];

  // First, fetch the current module to build the update payload
  const currentModule = await fetchModuleById(portalId, csrfToken, moduleType, moduleId, tabId);
  
  if (!currentModule) {
    console.error(`[commitModuleScript] Failed to fetch module ${moduleType}/${moduleId}`);
    return { success: false, error: 'Module not found or could not be fetched' };
  }

  // Build the update payload
  let payload: Partial<APIModule> = {};
  
  // Add script changes if provided
  if (newScript !== undefined) {
    const scriptPayload = buildUpdatePayload(currentModule, moduleType, scriptType, newScript);
    payload = { ...payload, ...scriptPayload };
  }
  
  // Merge module details changes if provided
  if (moduleDetails) {
    const fullModuleDetails = { ...moduleDetails };
    if (moduleDetails.autoDiscoveryConfig) {
      fullModuleDetails.autoDiscoveryConfig = {
        ...(currentModule.autoDiscoveryConfig || {}),
        ...moduleDetails.autoDiscoveryConfig,
        method: {
          ...(currentModule.autoDiscoveryConfig?.method || {}),
          ...(moduleDetails.autoDiscoveryConfig.method || {}),
        },
      };
    }

    if (payload.autoDiscoveryConfig && fullModuleDetails.autoDiscoveryConfig) {
      payload = {
        ...payload,
        ...fullModuleDetails,
        autoDiscoveryConfig: {
          ...fullModuleDetails.autoDiscoveryConfig,
          ...payload.autoDiscoveryConfig,
          method: {
            ...(fullModuleDetails.autoDiscoveryConfig.method || {}),
            ...(payload.autoDiscoveryConfig.method || {}),
          },
        },
      };
    } else {
      payload = { ...payload, ...fullModuleDetails };
    }
  }

  if (payload.autoDiscoveryConfig && currentModule.autoDiscoveryConfig) {
    payload.autoDiscoveryConfig = {
      ...currentModule.autoDiscoveryConfig,
      ...payload.autoDiscoveryConfig,
      method: {
        ...(currentModule.autoDiscoveryConfig.method || {}),
        ...(payload.autoDiscoveryConfig.method || {}),
      },
    };
  }

  // If no changes, return success
  if (Object.keys(payload).length === 0) {
    return { success: true };
  }

  // Update the module
  try {
    // Check if tab exists and is accessible
    try {
      await chrome.tabs.get(tabId);
    } catch (tabError) {
      console.error(`[commitModuleScript] Tab ${tabId} is not accessible:`, tabError);
      return { success: false, error: `Tab ${tabId} is not accessible. Please refresh the LogicMonitor page.` };
    }

    const reasonArg = reason ?? null;
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: updateModuleInAPI,
      args: [csrfToken, endpoint, moduleId, payload, API_VERSION, reasonArg],
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

export async function fetchLineageVersions(
  _portalId: string,
  csrfToken: string | null,
  moduleType: LogicModuleType,
  lineageId: string,
  tabId: number
): Promise<LineageVersion[] | null> {
  try {
    try {
      await chrome.tabs.get(tabId);
    } catch (tabError) {
      console.error(`[fetchLineageVersions] Tab ${tabId} is not accessible:`, tabError);
      return null;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: fetchLineageVersionsFromAPI,
      args: [csrfToken, lineageId, LINEAGE_API_VERSION],
    });

    const result = results?.[0]?.result;
    if (!result) {
      console.error('[fetchLineageVersions] No result from injected script');
      return null;
    }

    if (typeof result === 'object' && 'error' in result) {
      console.error('[fetchLineageVersions] Error from injected script:', result);
      return null;
    }

    const response = result as LineageResponse;
    const byId = response.data?.byId || {};
    const preferredKey = LINEAGE_MODEL_KEYS[moduleType];
    let modelKey = preferredKey in byId ? preferredKey : '';

    if (!modelKey) {
      modelKey =
        Object.keys(byId).find((key) => {
          const entries = byId[key];
          if (!entries || typeof entries !== 'object') return false;
          return Object.values(entries).some((entry) => {
            if (!entry || typeof entry !== 'object') return false;
            return 'lineageId' in entry || 'collectionAttributes' in entry || 'collectorAttribute' in entry || 'collectionAttribute' in entry;
          });
        }) || '';
    }

    const modelEntries = modelKey ? byId[modelKey] : undefined;
    if (!modelEntries) {
      return [];
    }

    const versions = Object.entries(modelEntries).map(([id, raw]) => {
      const module = raw as Record<string, unknown>;
      const { collectionScript, adScript } = extractLineageScripts(module, moduleType);

      return {
        id,
        name: (module['name'] as string) || '',
        displayName: (module['displayName'] as string) || undefined,
        version: (module['version'] as string) || undefined,
        updatedAtMS: (module['updatedAtMS'] as number) || undefined,
        createdAtMS: (module['createdAtMS'] as number) || undefined,
        commitMessage: (module['commitMessage'] as string) || undefined,
        authorUsername: (module['authorUsername'] as string) || undefined,
        isLatest: (module['isLatest'] as boolean) || undefined,
        collectionScript,
        adScript,
      };
    });

    return versions.sort((a, b) => (b.updatedAtMS || 0) - (a.updatedAtMS || 0));
  } catch (error) {
    console.error('[fetchLineageVersions] Error fetching lineage versions:', error);
    return null;
  }
}

/**
 * Fetch module details (metadata only) for editing
 */
export async function fetchModuleDetails(
  portalId: string,
  csrfToken: string | null,
  moduleType: LogicModuleType,
  moduleId: number,
  tabId: number
): Promise<APIModule | null> {
  // Reuse fetchModuleById which already fetches full module
  // We'll only use the metadata fields in the UI
  return await fetchModuleById(portalId, csrfToken, moduleType, moduleId, tabId);
}

/**
 * Function injected into the page context to fetch access groups list
 */
async function fetchAccessGroupsFromAPI(
  csrfToken: string | null,
  apiVersion: string
): Promise<{ items: AccessGroup[]; total?: number } | { error: string; status?: number; responseText?: string }> {
  // Embedded lmFetch helper
  const lmFetch = <T = unknown>(url: string, opts: { method?: string; csrfToken?: string | null; apiVersion?: string } = {}): Promise<{ ok: boolean; status: number; data?: T; text?: string; error?: string }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', opts.apiVersion || '3');
      if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let data: T | undefined;
        try { data = JSON.parse(xhr.responseText) as T; } catch { /* empty */ }
        resolve({ ok, status: xhr.status, data, text: xhr.responseText });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, error: 'Network error' });
      xhr.send();
    });

  const url = `/santaba/rest/setting/accessgroup?size=1000`;
  const result = await lmFetch<{ items?: AccessGroup[]; data?: { items?: AccessGroup[] }; total?: number }>(
    url,
    { csrfToken, apiVersion }
  );

  if (result.ok && result.data) {
    const items = result.data.items || result.data.data?.items || [];
    return { items, total: result.data.total };
  }
  
  if (result.error) {
    console.error(`[fetchAccessGroupsFromAPI] XHR error for ${url}`);
    return { error: result.error };
  }
  
  console.error(`[fetchAccessGroupsFromAPI] Failed to fetch access groups, status: ${result.status}, response:`, result.text);
  return { error: `HTTP ${result.status}`, status: result.status, responseText: result.text };
}

/**
 * Fetch access groups list
 */
export async function fetchAccessGroups(
  _portalId: string,
  csrfToken: string | null,
  tabId: number
): Promise<AccessGroup[]> {
  try {
    // Check if tab exists and is accessible
    try {
      await chrome.tabs.get(tabId);
    } catch (tabError) {
      console.error(`[fetchAccessGroups] Tab ${tabId} is not accessible:`, tabError);
      return [];
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: fetchAccessGroupsFromAPI,
      args: [csrfToken, API_VERSION],
    });

    if (!results || results.length === 0) {
      console.error(`[fetchAccessGroups] No results array from injected script`);
      return [];
    }

    const result = results[0]?.result;
    if (!result) {
      console.error(`[fetchAccessGroups] No result from injected script`);
      return [];
    }

    // Check if result is an error object
    if (typeof result === 'object' && 'error' in result) {
      const errorResult = result as { error: string; status?: number; responseText?: string };
      console.error(`[fetchAccessGroups] Error from injected script:`, errorResult);
      return [];
    }

    const response = result as { items: AccessGroup[]; total?: number };
    return response.items || [];
  } catch (error) {
    console.error('[fetchAccessGroups] Error fetching access groups:', error);
    return [];
  }
}

// ============================================================================
// Module Creation Types and Functions
// ============================================================================

/**
 * Payload structure for creating a new scripted module
 * Supports DataSource, ConfigSource, TopologySource, and PropertySource
 */
export interface CreateDataSourcePayload {
  name: string;
  displayName?: string;
  appliesTo: string;
  /** collectMethod - used by DataSource, ConfigSource, TopologySource */
  collectMethod?: 'script' | 'batchscript';
  /** collectInterval - not used by PropertySource */
  collectInterval?: number;
  /** hasMultiInstances - only for DataSource, ConfigSource */
  hasMultiInstances?: boolean;
  /** enableAutoDiscovery - only for DataSource, ConfigSource */
  enableAutoDiscovery?: boolean;
  /** collectorAttribute - used by DataSource, ConfigSource, TopologySource */
  collectorAttribute?: {
    name: 'script' | 'batchscript';
    groovyScript?: string;
    scriptType?: string;
  };
  /** collectionMethod - used by TopologySource */
  collectionMethod?: string;
  /** groovyScript - used by PropertySource (top-level) */
  groovyScript?: string;
  /** scriptType - used by PropertySource (top-level) */
  scriptType?: string;
  autoDiscoveryConfig?: {
    persistentInstance: boolean;
    scheduleInterval: number;
    deleteInactiveInstance: boolean;
    disableInstance: boolean;
    method: {
      name: 'ad_script';
      groovyScript?: string;
      /** DataSource AD uses 'scriptType', ConfigSource AD uses 'type' */
      scriptType?: string;
      type?: string;
    };
    instanceAutoGroupMethod: string;
    instanceAutoGroupMethodParams: string | null;
    filters: unknown[];
  };
  /** DataPoints - required for datasources */
  dataPoints?: Array<{
    name: string;
    type: number;
    rawDataFieldName?: string;
    description?: string;
    alertExpr?: string;
    alertForNoData?: number;
  }>;
  /** ConfigChecks - required for configsources */
  configChecks?: Array<{
    name: string;
    type: string; // 'fetch' | 'ignore' | 'missing' | 'value' | 'groovy'
    description?: string;
    alertLevel?: number; // 1=none, 2=warn, 3=error, 4=critical
    ackClearAlert?: boolean;
    alertEffectiveIval?: number;
    alertTransitionInterval?: number;
    script?: {
      fetch_check?: { fetch: number };
      format?: string;
    };
  }>;
  
  // LogSource fields
  collectionAttribute?: {
    script?: { embeddedContent?: string; type?: string };
    resourceMappingOp?: string;
    filterOp?: string | null;
  };
  logFields?: Array<{ key: string; method: string; value: string; comment: string }>;
  resourceMapping?: Array<{ index?: string; key: string; method: string; value: string; comment: string }>;
  collectionInterval?: { units: string; offset: number };
  appliesToScript?: string;
  
  // EventSource fields
  collector?: string;
  alertLevel?: string;
  alertEffectiveIval?: number;
  clearAfterAck?: boolean;
  suppressDuplicatesES?: boolean;
  schedule?: number;
}

/**
 * Result from creating a module
 */
export interface CreateModuleResult {
  success: boolean;
  moduleId?: number;
  moduleName?: string;
  error?: string;
}

/**
 * Function injected into the page context to create a new module via POST
 */
async function createModuleInAPI(
  csrfToken: string | null,
  endpoint: string,
  payload: CreateDataSourcePayload,
  apiVersion: string
): Promise<{ success: boolean; moduleId?: number; moduleName?: string; error?: string }> {
  // Embedded lmFetch helper with X-Requested-With support
  const lmFetch = <T = unknown>(
    url: string, 
    opts: { method?: string; csrfToken?: string | null; body?: unknown; apiVersion?: string; xRequestedWith?: boolean } = {}
  ): Promise<{ ok: boolean; status: number; data?: T; text?: string }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', opts.apiVersion || '3');
      if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
      if (opts.xRequestedWith) xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let data: T | undefined;
        try { data = JSON.parse(xhr.responseText) as T; } catch { /* empty */ }
        resolve({ ok, status: xhr.status, data, text: xhr.responseText });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, text: 'Network error' });
      xhr.send(opts.body ? JSON.stringify(opts.body) : undefined);
    });

  const result = await lmFetch<{ 
    id?: number; 
    name?: string;
    errorMessage?: string; 
    message?: string; 
    errorDetail?: string; 
    errorCode?: number 
  }>(
    `/santaba/rest${endpoint}`,
    { method: 'POST', csrfToken, body: payload, apiVersion, xRequestedWith: true }
  );

  // Check for HTTP error status first (4xx, 5xx)
  if (!result.ok) {
    // Try to extract error details from response
    if (result.data) {
      const baseMessage = result.data.errorMessage || result.data.message || `Failed to create module: HTTP ${result.status}`;
      const detailMessage = result.data.errorDetail ? `\n${result.data.errorDetail}` : '';
      const codeMessage = result.data.errorCode ? ` (Error code: ${result.data.errorCode})` : '';
      return { success: false, error: `${baseMessage}${codeMessage}${detailMessage}` };
    }
    return { success: false, error: `Failed to create module: HTTP ${result.status}` };
  }

  // Also check for error response in body (API sometimes returns 200 with error in body)
  if (result.data?.errorMessage || result.data?.errorCode) {
    const baseMessage = result.data.errorMessage || result.data.message || `Failed to create module: ${result.status}`;
    const detailMessage = result.data.errorDetail ? `\n${result.data.errorDetail}` : '';
    const codeMessage = result.data.errorCode ? ` (Error code: ${result.data.errorCode})` : '';
    return { success: false, error: `${baseMessage}${codeMessage}${detailMessage}` };
  }

  // Success case - must have a valid module ID
  if (result.data?.id && typeof result.data.id === 'number' && result.data.id > 0) {
    return { 
      success: true, 
      moduleId: result.data.id,
      moduleName: result.data.name 
    };
  }

  // Fallback error handling - we got 200 but no valid module ID
  if (result.data) {
    const baseMessage = result.data.message || `Failed to create module: no module ID in response`;
    const detailMessage = result.data.errorDetail ? `\n${result.data.errorDetail}` : '';
    const codeMessage = result.data.errorCode ? `\nError code: ${result.data.errorCode}` : '';
    return { success: false, error: `${baseMessage}${detailMessage}${codeMessage}` };
  }

  return { 
    success: false, 
    error: result.status === 0 ? 'Network error' : `Failed to create module: ${result.status}` 
  };
}

/**
 * Create a new module in the portal
 */
export async function createModule(
  _portalId: string,
  csrfToken: string | null,
  moduleType: LogicModuleType,
  payload: CreateDataSourcePayload,
  tabId: number
): Promise<CreateModuleResult> {
  const endpoint = ENDPOINTS[moduleType];

  try {
    // Check if tab exists and is accessible
    try {
      await chrome.tabs.get(tabId);
    } catch (tabError) {
      console.error(`[createModule] Tab ${tabId} is not accessible:`, tabError);
      return { success: false, error: `Tab ${tabId} is not accessible. Please refresh the LogicMonitor page.` };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: createModuleInAPI,
      args: [csrfToken, endpoint, payload, API_VERSION],
    });

    if (!results || results.length === 0) {
      console.error(`[createModule] No results array from injected script`);
      return { success: false, error: 'Failed to execute create script' };
    }

    if (!results[0]?.result) {
      console.error(`[createModule] No result from create script`);
      return { success: false, error: 'Failed to create module' };
    }

    return results[0].result as CreateModuleResult;
  } catch (error) {
    console.error('[createModule] Error creating module:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Build PATCH payload with only changed metadata fields
 */
export function buildModuleDetailsPatchPayload(
  original: Partial<APIModule> | null,
  draft: Partial<APIModule>,
  dirtyFields: Set<string>
): Partial<APIModule> {
  if (!original) {
    return draft;
  }

  const payload: Partial<APIModule> = {};

  // Only include changed fields
  for (const field of dirtyFields) {
    const draftValue = draft[field as keyof APIModule];
    const originalValue = original[field as keyof APIModule];

    // Only include if value actually changed
    if (draftValue !== originalValue) {
      // Handle accessGroupIds - can be array of numbers or comma-separated string
      if (field === 'accessGroupIds') {
        if (Array.isArray(draftValue)) {
          // Ensure it's an array of numbers, not objects
          const numericIds = draftValue.map((id: unknown) => {
            if (typeof id === 'number') return id;
            if (typeof id === 'object' && id !== null && 'id' in id) return (id as { id: number }).id;
            return Number(id);
          }).filter((id: number) => !isNaN(id));
          payload.accessGroupIds = numericIds;
        } else if (typeof draftValue === 'string') {
          payload.accessGroupIds = draftValue;
        }
      } else {
        (payload as Record<string, unknown>)[field] = draftValue;
      }
    }
  }

  return payload;
}
