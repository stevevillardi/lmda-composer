import type { Portal, Collector, DeviceInfo, DeviceProperty, AppliesToTestResult, AppliesToTestError, AppliesToTestFrom } from '@/shared/types';

const STORAGE_KEY = 'lm-ide-portals';
const NON_PORTAL_SUBDOMAINS = new Set([
  'www',
  'docs',
  'support',
  'community',
  'developer',
  'status',
  'help',
  'academy',
  'blog',
  'okta',
  'jira',
  'confluence',
  'stash'
]);

function isLikelyPortalHostname(hostname: string): boolean {
  if (!hostname.endsWith('.logicmonitor.com')) return false;
  const parts = hostname.split('.');
  if (parts.length < 3) return false;
  return !NON_PORTAL_SUBDOMAINS.has(parts[0]);
}

interface PersistedPortalData {
  id: string;
  hostname: string;
  displayName: string;
  csrfToken: string | null;
  csrfTokenTimestamp: number | null;
}

export class PortalManager {
  private portals: Map<string, Portal> = new Map();
  private initialized = false;
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly PERSIST_DEBOUNCE_MS = 300;
  private static readonly CSRF_TOKEN_TTL_MS = 10 * 60 * 1000;

  /**
   * Initialize the PortalManager by loading persisted state.
   * Call this on service worker startup.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const persisted = result[STORAGE_KEY] as PersistedPortalData[] | undefined;
      
      if (persisted && Array.isArray(persisted)) {
        for (const data of persisted) {
          this.portals.set(data.id, {
            id: data.id,
            hostname: data.hostname,
            displayName: data.displayName,
            csrfToken: data.csrfToken,
            csrfTokenTimestamp: data.csrfTokenTimestamp,
            tabIds: [],
            status: data.csrfToken ? 'active' : 'unknown',
          });
        }
      }
    } catch {
      // Storage may be unavailable in some contexts
    }
    
    this.initialized = true;
  }

  /**
   * Persist current portal state to storage with debouncing.
   * Debouncing prevents storage thrashing when multiple tabs are active.
   */
  private persistState(): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }
    
    this.persistTimeout = setTimeout(async () => {
      try {
        const data: PersistedPortalData[] = Array.from(this.portals.values()).map(p => ({
          id: p.id,
          hostname: p.hostname,
          displayName: p.displayName,
          csrfToken: p.csrfToken,
          csrfTokenTimestamp: p.csrfTokenTimestamp,
        }));
        
        await chrome.storage.local.set({ [STORAGE_KEY]: data });
      } catch {
        // Storage may be unavailable in some contexts
      }
    }, PortalManager.PERSIST_DEBOUNCE_MS);
  }

  /**
   * Remove a closed tab from all portals.
   * Called when chrome.tabs.onRemoved fires.
   * Returns information about any portal that was deleted (lost all tabs).
   */
  handleTabRemoved(tabId: number): { deletedPortal: { id: string; hostname: string } | null } {
    let stateChanged = false;
    let deletedPortal: { id: string; hostname: string } | null = null;
    
    for (const portal of this.portals.values()) {
      const index = portal.tabIds.indexOf(tabId);
      if (index !== -1) {
        portal.tabIds.splice(index, 1);
        stateChanged = true;
        
        if (portal.tabIds.length === 0) {
          // Capture portal info before deleting
          deletedPortal = { id: portal.id, hostname: portal.hostname };
          this.portals.delete(portal.id);
        }
      }
    }
    
    if (stateChanged) {
      this.persistState();
    }
    
    return { deletedPortal };
  }

  /**
   * Get a valid tab ID for a portal, trying alternatives if the first fails.
   * Returns null if no valid tabs remain.
   * Note: Does NOT delete the portal if tabs are exhausted - caller should handle rediscovery.
   */
  private async getValidTabId(portal: Portal): Promise<number | null> {
    for (let i = 0; i < portal.tabIds.length; i++) {
      const tabId = portal.tabIds[i];
      try {
        // Check if the tab still exists
        const tab = await chrome.tabs.get(tabId);
        const url = tab?.url ? new URL(tab.url) : null;
        if (url && url.hostname.endsWith('.logicmonitor.com')) {
          // Move this tab to the front if it wasn't already
          if (i > 0) {
            portal.tabIds.splice(i, 1);
            portal.tabIds.unshift(tabId);
          }
          return tabId;
        }
        portal.tabIds.splice(i, 1);
        i--;
      } catch {
        portal.tabIds.splice(i, 1);
        i--;
      }
    }
    
    // Don't delete the portal here - let the caller handle rediscovery
    // The portal might be refreshable with discoverPortals()
    return null;
  }

  private async resolvePortalAndTab(
    portalId: string
  ): Promise<{ portal: Portal; tabId: number } | { error: 'PORTAL_NOT_FOUND' | 'NO_VALID_TAB' }> {
    let portal = this.portals.get(portalId);

    if (!portal || portal.tabIds.length === 0) {
      await this.discoverPortals();
      portal = this.portals.get(portalId);
    }

    if (!portal || portal.tabIds.length === 0) {
      return { error: 'PORTAL_NOT_FOUND' };
    }

    let tabId = await this.getValidTabId(portal);
    if (!tabId) {
      await this.discoverPortals();
      portal = this.portals.get(portalId);
      if (!portal) {
        return { error: 'PORTAL_NOT_FOUND' };
      }
      tabId = await this.getValidTabId(portal);
      if (!tabId) {
        return { error: 'NO_VALID_TAB' };
      }
    }

    return { portal, tabId };
  }

  /**
   * Get a valid tab ID for a portal, with auto-rediscovery if needed.
   * Returns null if no valid tab is available.
   */
  async getValidTabIdForPortal(portalId: string): Promise<number | null> {
    const resolved = await this.resolvePortalAndTab(portalId);
    if ('error' in resolved) return null;
    return resolved.tabId;
  }

  async discoverPortals(): Promise<Portal[]> {
    try {
      // Initialize from storage if not already done
      await this.initialize();
      
      // Query all LogicMonitor tabs
      const tabs = await chrome.tabs.query({ 
        url: 'https://*.logicmonitor.com/*' 
      });

      // Group tabs by hostname, but first verify they are actual LM portals
      const portalTabs = new Map<string, number[]>();
      let skippedIncomplete = 0;
      let verifiedPortals = 0;
      let fallbackPortals = 0;
      let nonPortalMatches = 0;
      
      for (const tab of tabs) {
        if (!tab.url || !tab.id) continue;
        
        // Skip tabs that aren't ready - they won't have LMGlobalData loaded yet
        if (tab.status !== 'complete') {
          console.log(`Skipping tab ${tab.id}: status is ${tab.status}`);
          skippedIncomplete += 1;
          continue;
        }
        
        const url = new URL(tab.url);
        const hostname = url.hostname;
        const isLikelyPortal = isLikelyPortalHostname(hostname);
        const isLMPortal = await this.verifyLogicMonitorPortal(tab.id);
        if (!isLMPortal && !isLikelyPortal) {
          nonPortalMatches += 1;
          continue;
        }
        if (isLMPortal) {
          verifiedPortals += 1;
        } else if (isLikelyPortal) {
          fallbackPortals += 1;
        }
        
        if (!portalTabs.has(hostname)) {
          portalTabs.set(hostname, []);
        }
        portalTabs.get(hostname)!.push(tab.id);
      }

      // Update portals map - preserve existing CSRF tokens when possible
      for (const [hostname, tabIds] of portalTabs) {
        const existingPortal = this.portals.get(hostname);
        
        if (existingPortal) {
          existingPortal.tabIds = tabIds;
        } else {
          this.portals.set(hostname, {
            id: hostname,
            hostname,
            displayName: this.extractDisplayName(hostname),
            csrfToken: null,
            csrfTokenTimestamp: null,
            tabIds,
            status: 'unknown',
          });
        }
      }

      // Remove portals that no longer have tabs
      for (const [hostname] of this.portals) {
        if (!portalTabs.has(hostname)) {
          this.portals.delete(hostname);
        }
      }

      // Request CSRF tokens from content scripts
      await this.refreshAllCsrfTokens();
      
      // Persist updated state (debounced)
      this.persistState();

      console.info('[PortalDiscovery] completed', {
        tabsQueried: tabs.length,
        portalsFound: portalTabs.size,
        portalHosts: Array.from(portalTabs.keys()),
        skippedIncomplete,
        verifiedPortals,
        fallbackPortals,
        nonPortalMatches,
      });

      return Array.from(this.portals.values());
    } catch (error) {
      console.error('Error discovering portals:', error);
      return [];
    }
  }

  /**
   * Verify that a tab contains a LogicMonitor portal by checking for:
   * window.LMGlobalData - a global object defined by LogicMonitor's application
   */
  private async verifyLogicMonitorPortal(tabId: number): Promise<boolean> {
    try {
      // First, verify the tab is still valid and ready
      let tab: chrome.tabs.Tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch (error) {
        console.warn(`Tab ${tabId} no longer exists:`, error);
        return false;
      }
      
      // Double-check tab status (should already be filtered in discoverPortals, but be safe)
      if (tab.status !== 'complete') {
        console.log(`Tab ${tabId} not ready for verification (status: ${tab.status})`);
        return false;
      }
      
      // Verify URL matches LogicMonitor pattern
      if (!tab.url || !tab.url.includes('logicmonitor.com')) {
        return false;
      }
      
      // Try to execute script with retry logic for timing issues
      let lastError: Error | null = null;
      const maxRetries = 3;
      const retryDelay = 500; // 500ms between retries
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Wait before retrying (page might still be loading LMGlobalData)
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
          
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN', // Execute in the main world to access page's window object
            func: () => {
              // Check if LMGlobalData exists on the window object
              return typeof (window as unknown as { LMGlobalData?: unknown }).LMGlobalData !== 'undefined';
            },
          });
          
          const isValid = results?.[0]?.result === true;
          
          if (isValid) {
            return true;
          }
          
          // If result is false but no error, the page might still be loading
          // Try again if we have retries left
          if (attempt < maxRetries - 1) {
            console.log(`Portal verification attempt ${attempt + 1} failed: LMGlobalData not found for tab ${tabId}, retrying...`);
            continue;
          }
          
          return false;
        } catch (error) {
          lastError = error as Error;
          
          // Check if it's a scripting error (tab might be in a restricted state)
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Some errors are permanent (e.g., cannot access chrome:// pages)
          if (errorMessage.includes('Cannot access') || errorMessage.includes('No tab with id')) {
            console.warn(`Permanent error verifying tab ${tabId}:`, errorMessage);
            return false;
          }
          
          // If it's a scripting error and we have retries left, try again
          if (attempt < maxRetries - 1) {
            console.warn(`Portal verification attempt ${attempt + 1} failed for tab ${tabId}:`, errorMessage);
            continue;
          }
        }
      }
      
      // Log the final error if all retries failed
      if (lastError) {
        console.error(`Portal verification failed after ${maxRetries} attempts for tab ${tabId}:`, lastError);
      } else {
        console.warn(`Portal verification failed: LMGlobalData not found after ${maxRetries} attempts for tab ${tabId}`);
      }
      
      return false;
    } catch (error) {
      console.error(`Portal verification error for tab ${tabId}:`, error);
      return false;
    }
  }

  private extractDisplayName(hostname: string): string {
    // Extract company name from hostname (e.g., "acme.logicmonitor.com" -> "Acme")
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const company = parts[0];
      return company.charAt(0).toUpperCase() + company.slice(1);
    }
    return hostname;
  }

  async refreshAllCsrfTokens(): Promise<void> {
    const refreshPromises: Promise<void>[] = [];

    for (const portal of this.portals.values()) {
      if (portal.csrfToken && portal.csrfTokenTimestamp) {
        const age = Date.now() - portal.csrfTokenTimestamp;
        if (age < PortalManager.CSRF_TOKEN_TTL_MS) {
          continue;
        }
      }
      if (portal.tabIds.length > 0) {
        refreshPromises.push(this.refreshCsrfToken(portal));
      }
    }

    await Promise.allSettled(refreshPromises);
  }

  private async refreshCsrfToken(portal: Portal): Promise<void> {
    const tabId = await this.getValidTabId(portal);
    if (!tabId) {
      portal.status = 'expired';
      portal.csrfToken = null;
      portal.csrfTokenTimestamp = null;
      this.persistState();
      return;
    }
    
    try {
      // Execute in content script context to fetch CSRF token
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchCsrfToken,
      });

      const token = results?.[0]?.result ?? null;
      if (token) {
        this.updateCsrfToken(portal.id, token);
        return;
      }
      portal.csrfToken = null;
      portal.csrfTokenTimestamp = null;
      portal.status = 'expired';
      this.persistState();
    } catch {
      portal.status = 'expired';
      portal.csrfToken = null;
      portal.csrfTokenTimestamp = null;
      this.persistState();
    }
  }

  updateCsrfToken(portalId: string, token: string): void {
    const portal = this.portals.get(portalId);
    if (portal) {
      portal.csrfToken = token;
      portal.csrfTokenTimestamp = Date.now();
      portal.status = 'active';
      // Persist the updated token
      this.persistState();
    }
  }

  /**
   * Fetch collectors for a specific portal.
   * Includes auto-rediscovery if portal tabs are stale.
   */
  async getCollectors(portalId: string): Promise<Collector[]> {
    const resolved = await this.resolvePortalAndTab(portalId);
    if ('error' in resolved) return [];

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: resolved.tabId },
        func: fetchCollectors,
        args: [resolved.portal.csrfToken],
      });

      return results?.[0]?.result ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch devices for a specific collector.
   * Includes auto-rediscovery if portal tabs are stale.
   */
  async getDevices(portalId: string, collectorId: number): Promise<{ items: DeviceInfo[]; total: number; error?: string }> {
    const resolved = await this.resolvePortalAndTab(portalId);
    if ('error' in resolved) {
      return { items: [], total: 0, error: resolved.error };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: resolved.tabId },
        func: fetchDevices,
        args: [resolved.portal.csrfToken, collectorId],
      });

      return results?.[0]?.result ?? { items: [], total: 0 };
    } catch {
      return { items: [], total: 0, error: 'SCRIPT_EXECUTION_FAILED' };
    }
  }

  /**
   * Fetch a single device by its resource ID.
   * Includes auto-rediscovery if portal tabs are stale.
   */
  async getDeviceById(portalId: string, resourceId: number): Promise<{
    id: number;
    name: string;
    displayName: string;
    currentCollectorId: number;
  } | null> {
    const resolved = await this.resolvePortalAndTab(portalId);
    if ('error' in resolved) return null;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: resolved.tabId },
        func: fetchDeviceById,
        args: [resolved.portal.csrfToken, resourceId],
      });

      return results?.[0]?.result ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch device properties by device ID.
   * Returns all properties (system, custom, inherited, auto) with type labels.
   * Includes auto-rediscovery if portal tabs are stale.
   */
  async getDeviceProperties(portalId: string, deviceId: number): Promise<DeviceProperty[]> {
    const resolved = await this.resolvePortalAndTab(portalId);
    if ('error' in resolved) return [];

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: resolved.tabId },
        func: fetchDeviceProperties,
        args: [resolved.portal.csrfToken, deviceId],
      });

      return results?.[0]?.result ?? [];
    } catch {
      return [];
    }
  }

  getPortal(portalId: string): Portal | undefined {
    return this.portals.get(portalId);
  }

  getPortals(): Portal[] {
    return Array.from(this.portals.values());
  }

  getCsrfToken(portalId: string): string | null {
    return this.portals.get(portalId)?.csrfToken ?? null;
  }

  /**
   * Refresh CSRF token for a specific portal and return the new token.
   * Used when a request fails with 403 (token expired).
   */
  async refreshCsrfTokenForPortal(portalId: string): Promise<string | null> {
    const portal = this.portals.get(portalId);
    if (!portal) return null;

    await this.refreshCsrfToken(portal);
    return portal.csrfToken;
  }

  /**
   * Test an AppliesTo expression against resources in the portal.
   * Includes auto-rediscovery if portal tabs are stale.
   */
  async testAppliesTo(
    portalId: string, 
    currentAppliesTo: string, 
    testFrom: AppliesToTestFrom
  ): Promise<{ result?: AppliesToTestResult; error?: AppliesToTestError }> {
    const resolved = await this.resolvePortalAndTab(portalId);
    if ('error' in resolved) {
      const errorMessage = resolved.error === 'PORTAL_NOT_FOUND' ? 'Portal not found' : 'No valid tab';
      return { error: { errorMessage, errorCode: 404, errorDetail: null } };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: resolved.tabId },
        func: testAppliesToExpression,
        args: [resolved.portal.csrfToken, currentAppliesTo, testFrom],
      });

      return results?.[0]?.result ?? { error: { errorMessage: 'Script execution failed', errorCode: 500, errorDetail: null } };
    } catch {
      return { error: { errorMessage: 'Script execution failed', errorCode: 500, errorDetail: null } };
    }
  }
}

// Function to be injected into the page to fetch CSRF token
function fetchCsrfToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/santaba/rest/functions/dummy', true);
    xhr.setRequestHeader('X-CSRF-Token', 'Fetch');
    xhr.setRequestHeader('X-version', '3');
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const token = xhr.getResponseHeader('X-CSRF-Token');
        resolve(token);
      } else {
        resolve(null);
      }
    };
    
    xhr.onerror = () => resolve(null);
    xhr.send();
  });
}

// Function to be injected into the page to fetch collectors
// Note: Returns plain objects, will be typed as Collector[] by caller
async function fetchCollectors(csrfToken: string | null): Promise<Array<{
  id: number;
  description: string;
  hostname: string;
  status: number;
  isDown: boolean;
  collectorGroupName: string;
  arch?: string;
}>> {
  const pageSize = 1000;

  const fetchPage = (offset: number) => new Promise<{
    items: Array<{
      id: number;
      description: string;
      hostname: string;
      status: number;
      isDown: boolean;
      collectorGroupName: string;
      arch?: string;
    }>;
    total: number;
  }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/santaba/rest/setting/collector/collectors?size=${pageSize}&offset=${offset}&fields=id,description,hostname,status,isDown,collectorGroupName,arch`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', '3');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          const items = response.items || response.data?.items || [];
          const collectors = items.map((c: {
            id: number;
            description: string;
            hostname: string;
            status: number;
            isDown: boolean;
            collectorGroupName: string;
            arch?: string;
          }) => ({
            id: c.id,
            description: c.description || `Collector ${c.id}`,
            hostname: c.hostname,
            status: c.status,
            isDown: c.isDown,
            collectorGroupName: c.collectorGroupName,
            arch: c.arch,
          }));
          const total = typeof response.total === 'number' ? response.total : (response.data?.total ?? 0);
          resolve({ items: collectors, total: total || items.length });
        } catch {
          resolve({ items: [], total: 0 });
        }
      } else {
        resolve({ items: [], total: 0 });
      }
    };
    
    xhr.onerror = () => resolve({ items: [], total: 0 });
    xhr.send();
  });

  const allCollectors: Array<{
    id: number;
    description: string;
    hostname: string;
    status: number;
    isDown: boolean;
    collectorGroupName: string;
    arch?: string;
  }> = [];

  let offset = 0;
  let total = 0;

  while (true) {
    const page = await fetchPage(offset);
    if (page.items.length === 0) break;
    allCollectors.push(...page.items);
    total = page.total;
    offset += page.items.length;
    if (total > 0 && offset >= total) break;
    if (page.items.length < pageSize) break;
  }

  return allCollectors;
}

// Function to be injected into the page to fetch devices for a collector
async function fetchDevices(csrfToken: string | null, collectorId: number): Promise<{
  items: Array<{
    id: number;
    name: string;
    displayName: string;
    currentCollectorId: number;
    hostStatus: string;
  }>;
  total: number;
}> {
  const pageSize = 1000;

  const fetchPage = (offset: number) => new Promise<{
    items: Array<{
      id: number;
      name: string;
      displayName: string;
      currentCollectorId: number;
      hostStatus: string;
    }>;
    total: number;
  }>((resolve) => {
    const xhr = new XMLHttpRequest();
    const filter = encodeURIComponent(`currentCollectorId:${collectorId}`);
    xhr.open('GET', `/santaba/rest/device/devices?filter=${filter}&size=${pageSize}&offset=${offset}&fields=id,name,displayName,currentCollectorId,hostStatus`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', '3');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          const items = response.items || response.data?.items || [];
          const devices = items.map((d: {
            id: number;
            name: string;
            displayName: string;
            currentCollectorId: number;
            hostStatus: string;
          }) => ({
            id: d.id,
            name: d.name,
            displayName: d.displayName || d.name,
            currentCollectorId: d.currentCollectorId,
            hostStatus: d.hostStatus || 'unknown',
          }));
          const total = typeof response.total === 'number' ? response.total : (response.data?.total ?? 0);
          resolve({ items: devices, total: total || items.length });
        } catch {
          resolve({ items: [], total: 0 });
        }
      } else {
        resolve({ items: [], total: 0 });
      }
    };
    
    xhr.onerror = () => resolve({ items: [], total: 0 });
    xhr.send();
  });

  const allDevices: Array<{
    id: number;
    name: string;
    displayName: string;
    currentCollectorId: number;
    hostStatus: string;
  }> = [];

  let offset = 0;
  let total = 0;

  while (true) {
    const page = await fetchPage(offset);
    if (page.items.length === 0) break;
    allDevices.push(...page.items);
    total = page.total;
    offset += page.items.length;
    if (total > 0 && offset >= total) break;
    if (page.items.length < pageSize) break;
  }

  return { items: allDevices, total: total || allDevices.length };
}

// Function to be injected into the page to fetch a single device by ID
function fetchDeviceById(csrfToken: string | null, resourceId: number): Promise<{
  id: number;
  name: string;
  displayName: string;
  currentCollectorId: number;
} | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/santaba/rest/device/devices/${resourceId}?fields=id,name,displayName,currentCollectorId`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', '3');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          const device = response.data || response;
          resolve({
            id: device.id,
            name: device.name,
            displayName: device.displayName || device.name,
            currentCollectorId: device.currentCollectorId,
          });
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
    
    xhr.onerror = () => resolve(null);
    xhr.send();
  });
}

// Function to be injected into the page to fetch device properties
function fetchDeviceProperties(csrfToken: string | null, deviceId: number): Promise<Array<{
  name: string;
  value: string;
  type: 'system' | 'custom' | 'inherited' | 'auto';
}>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    // Fetch device with all property types
    xhr.open('GET', `/santaba/rest/device/devices/${deviceId}?fields=systemProperties,customProperties,inheritedProperties,autoProperties`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', '3');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          const device = response.data || response;
          
          const properties: Array<{
            name: string;
            value: string;
            type: 'system' | 'custom' | 'inherited' | 'auto';
          }> = [];
          
          // Process system properties
          if (device.systemProperties && Array.isArray(device.systemProperties)) {
            device.systemProperties.forEach((prop: { name: string; value: string }) => {
              properties.push({
                name: prop.name,
                value: prop.value || '',
                type: 'system',
              });
            });
          }
          
          // Process custom properties
          if (device.customProperties && Array.isArray(device.customProperties)) {
            device.customProperties.forEach((prop: { name: string; value: string }) => {
              properties.push({
                name: prop.name,
                value: prop.value || '',
                type: 'custom',
              });
            });
          }
          
          // Process inherited properties
          if (device.inheritedProperties && Array.isArray(device.inheritedProperties)) {
            device.inheritedProperties.forEach((prop: { name: string; value: string }) => {
              properties.push({
                name: prop.name,
                value: prop.value || '',
                type: 'inherited',
              });
            });
          }
          
          // Process auto properties
          if (device.autoProperties && Array.isArray(device.autoProperties)) {
            device.autoProperties.forEach((prop: { name: string; value: string }) => {
              properties.push({
                name: prop.name,
                value: prop.value || '',
                type: 'auto',
              });
            });
          }
          
          // Sort by name
          properties.sort((a, b) => a.name.localeCompare(b.name));
          
          resolve(properties);
        } catch {
          resolve([]);
        }
      } else {
        resolve([]);
      }
    };
    
    xhr.onerror = () => resolve([]);
    xhr.send();
  });
}

// Function to be injected into the page to test AppliesTo expressions
function testAppliesToExpression(
  csrfToken: string | null, 
  currentAppliesTo: string, 
  testFrom: 'devicesGroup' | 'websiteGroup'
): Promise<{
  result?: {
    originalAppliesTo: string;
    currentAppliesTo: string;
    originalMatches: Array<{ type: string; id: number; name: string }>;
    currentMatches: Array<{ type: string; id: number; name: string }>;
    warnMessage: string;
  };
  error?: {
    errorMessage: string;
    errorCode: number;
    errorDetail: string | null;
  };
}> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/santaba/rest/functions', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', '3');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    
    const payload = {
      currentAppliesTo,
      originalAppliesTo: '',
      type: 'testAppliesTo',
      needInheritProps: false,
      testFrom,
    };
    
    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        
        if (xhr.status === 200) {
          resolve({
            result: {
              originalAppliesTo: response.originalAppliesTo || '',
              currentAppliesTo: response.currentAppliesTo || currentAppliesTo,
              originalMatches: response.originalMatches || [],
              currentMatches: response.currentMatches || [],
              warnMessage: response.warnMessage || '',
            },
          });
        } else {
          // API returned an error (e.g., 400 for syntax errors)
          resolve({
            error: {
              errorMessage: response.errorMessage || response.message || 'Unknown error',
              errorCode: response.errorCode || xhr.status,
              errorDetail: response.errorDetail || null,
            },
          });
        }
      } catch {
        resolve({
          error: {
            errorMessage: 'Failed to parse response',
            errorCode: 500,
            errorDetail: null,
          },
        });
      }
    };
    
    xhr.onerror = () => resolve({
      error: {
        errorMessage: 'Network error',
        errorCode: 0,
        errorDetail: null,
      },
    });
    
    xhr.send(JSON.stringify(payload));
  });
}
