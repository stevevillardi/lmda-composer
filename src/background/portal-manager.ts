import type { Portal, Collector, DeviceInfo } from '@/shared/types';

const STORAGE_KEY = 'lm-ide-portals';

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
        // Restore portals with empty tabIds (will be populated by discoverPortals)
        for (const data of persisted) {
          this.portals.set(data.id, {
            id: data.id,
            hostname: data.hostname,
            displayName: data.displayName,
            csrfToken: data.csrfToken,
            csrfTokenTimestamp: data.csrfTokenTimestamp,
            tabIds: [], // Will be populated by discoverPortals
            status: data.csrfToken ? 'active' : 'unknown',
          });
        }
        console.log(`Restored ${persisted.length} portals from storage`);
      }
    } catch (error) {
      console.warn('Failed to restore portal state:', error);
    }
    
    this.initialized = true;
  }

  /**
   * Persist current portal state to storage.
   * Called after any state changes.
   */
  private async persistState(): Promise<void> {
    try {
      const data: PersistedPortalData[] = Array.from(this.portals.values()).map(p => ({
        id: p.id,
        hostname: p.hostname,
        displayName: p.displayName,
        csrfToken: p.csrfToken,
        csrfTokenTimestamp: p.csrfTokenTimestamp,
      }));
      
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (error) {
      console.warn('Failed to persist portal state:', error);
    }
  }

  /**
   * Remove a closed tab from all portals.
   * Called when chrome.tabs.onRemoved fires.
   */
  handleTabRemoved(tabId: number): void {
    let stateChanged = false;
    
    for (const portal of this.portals.values()) {
      const index = portal.tabIds.indexOf(tabId);
      if (index !== -1) {
        portal.tabIds.splice(index, 1);
        console.log(`Removed tab ${tabId} from portal ${portal.hostname}, ${portal.tabIds.length} tabs remaining`);
        stateChanged = true;
        
        // If no more tabs, remove the portal entirely
        if (portal.tabIds.length === 0) {
          this.portals.delete(portal.id);
          console.log(`Portal ${portal.hostname} removed (no more tabs)`);
        }
      }
    }
    
    if (stateChanged) {
      this.persistState();
    }
  }

  /**
   * Get a valid tab ID for a portal, trying alternatives if the first fails.
   * Returns null if no valid tabs remain.
   */
  private async getValidTabId(portal: Portal): Promise<number | null> {
    for (let i = 0; i < portal.tabIds.length; i++) {
      const tabId = portal.tabIds[i];
      try {
        // Check if the tab still exists
        const tab = await chrome.tabs.get(tabId);
        if (tab && tab.url?.includes('logicmonitor.com')) {
          // Move this tab to the front if it wasn't already
          if (i > 0) {
            portal.tabIds.splice(i, 1);
            portal.tabIds.unshift(tabId);
          }
          return tabId;
        }
      } catch {
        // Tab doesn't exist, remove it from the list
        portal.tabIds.splice(i, 1);
        i--; // Adjust index since we removed an element
        console.log(`Removed stale tab ${tabId} from portal ${portal.hostname}`);
      }
    }
    
    // No valid tabs found
    if (portal.tabIds.length === 0) {
      this.portals.delete(portal.id);
      console.log(`Portal ${portal.hostname} removed (all tabs stale)`);
    }
    
    return null;
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
      
      for (const tab of tabs) {
        if (!tab.url || !tab.id) continue;
        
        // Check if this tab has the LogicMonitor meta tag
        const isLMPortal = await this.verifyLogicMonitorPortal(tab.id);
        if (!isLMPortal) {
          console.log(`Tab ${tab.id} (${tab.url}) is not a LogicMonitor portal, skipping`);
          continue;
        }
        
        const url = new URL(tab.url);
        const hostname = url.hostname;
        
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
      
      // Persist updated state
      await this.persistState();

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
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN', // Execute in the main world to access page's window object
        func: () => {
          // Check if LMGlobalData exists on the window object
          return typeof (window as unknown as { LMGlobalData?: unknown }).LMGlobalData !== 'undefined';
        },
      });
      return results?.[0]?.result === true;
    } catch (error) {
      console.warn(`Failed to verify portal for tab ${tabId}:`, error);
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
      if (portal.tabIds.length > 0) {
        refreshPromises.push(this.refreshCsrfToken(portal));
      }
    }

    await Promise.allSettled(refreshPromises);
  }

  private async refreshCsrfToken(portal: Portal): Promise<void> {
    const tabId = await this.getValidTabId(portal);
    if (!tabId) {
      console.warn(`No valid tabs for portal ${portal.hostname} to refresh CSRF token`);
      portal.status = 'expired';
      return;
    }
    
    try {
      // Execute in content script context to fetch CSRF token
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchCsrfToken,
      });

      if (results?.[0]?.result) {
        this.updateCsrfToken(portal.id, results[0].result);
      }
    } catch (error) {
      console.warn(`Failed to refresh CSRF token for ${portal.hostname}:`, error);
      portal.status = 'expired';
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
   * Fetch collectors for a specific portal
   */
  async getCollectors(portalId: string): Promise<Collector[]> {
    const portal = this.portals.get(portalId);
    if (!portal || portal.tabIds.length === 0) {
      console.warn(`No active tabs for portal ${portalId}`);
      return [];
    }

    const tabId = await this.getValidTabId(portal);
    if (!tabId) {
      console.warn(`No valid tabs for portal ${portalId} to fetch collectors`);
      return [];
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchCollectors,
        args: [portal.csrfToken],
      });

      if (results?.[0]?.result) {
        return results[0].result;
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch collectors for ${portalId}:`, error);
      return [];
    }
  }

  /**
   * Fetch devices for a specific collector
   */
  async getDevices(portalId: string, collectorId: number): Promise<{ items: DeviceInfo[]; total: number }> {
    const portal = this.portals.get(portalId);
    if (!portal || portal.tabIds.length === 0) {
      console.warn(`No active tabs for portal ${portalId}`);
      return { items: [], total: 0 };
    }

    const tabId = await this.getValidTabId(portal);
    if (!tabId) {
      console.warn(`No valid tabs for portal ${portalId} to fetch devices`);
      return { items: [], total: 0 };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchDevices,
        args: [portal.csrfToken, collectorId],
      });

      if (results?.[0]?.result) {
        return results[0].result;
      }
      return { items: [], total: 0 };
    } catch (error) {
      console.error(`Failed to fetch devices for collector ${collectorId}:`, error);
      return { items: [], total: 0 };
    }
  }

  /**
   * Fetch a single device by its resource ID
   */
  async getDeviceById(portalId: string, resourceId: number): Promise<{
    id: number;
    name: string;
    displayName: string;
    currentCollectorId: number;
  } | null> {
    const portal = this.portals.get(portalId);
    if (!portal || portal.tabIds.length === 0) {
      console.warn(`No active tabs for portal ${portalId}`);
      return null;
    }

    const tabId = await this.getValidTabId(portal);
    if (!tabId) {
      console.warn(`No valid tabs for portal ${portalId} to fetch device`);
      return null;
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchDeviceById,
        args: [portal.csrfToken, resourceId],
      });

      if (results?.[0]?.result) {
        return results[0].result;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch device ${resourceId} for ${portalId}:`, error);
      return null;
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
    if (!portal) {
      console.warn(`Portal ${portalId} not found for CSRF refresh`);
      return null;
    }

    await this.refreshCsrfToken(portal);
    return portal.csrfToken;
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
function fetchCollectors(csrfToken: string | null): Promise<Array<{
  id: number;
  description: string;
  hostname: string;
  status: number;
  isDown: boolean;
  collectorGroupName: string;
}>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/santaba/rest/setting/collector/collectors?size=1000&fields=id,description,hostname,status,isDown,collectorGroupName', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', '3');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    
    xhr.onload = () => {
      console.log('Collectors API response status:', xhr.status);
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log('Collectors API response:', response);
          // LM API returns items directly, not under data
          const items = response.items || response.data?.items || [];
          const collectors = items.map((c: {
            id: number;
            description: string;
            hostname: string;
            status: number;
            isDown: boolean;
            collectorGroupName: string;
          }) => ({
            id: c.id,
            description: c.description || `Collector ${c.id}`,
            hostname: c.hostname,
            status: c.status,
            isDown: c.isDown,
            collectorGroupName: c.collectorGroupName,
          }));
          console.log('Parsed collectors:', collectors.length);
          resolve(collectors);
        } catch (e) {
          console.error('Failed to parse collectors response:', e);
          resolve([]);
        }
      } else {
        console.error('Failed to fetch collectors:', xhr.status, xhr.statusText);
        resolve([]);
      }
    };
    
    xhr.onerror = () => {
      console.error('Network error fetching collectors');
      resolve([]);
    };
    xhr.send();
  });
}

// Function to be injected into the page to fetch devices for a collector
function fetchDevices(csrfToken: string | null, collectorId: number): Promise<{
  items: Array<{
    id: number;
    name: string;
    displayName: string;
    currentCollectorId: number;
    hostStatus: string;
  }>;
  total: number;
}> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const filter = encodeURIComponent(`currentCollectorId:${collectorId}`);
    xhr.open('GET', `/santaba/rest/device/devices?filter=${filter}&size=1000&fields=id,name,displayName,currentCollectorId,hostStatus`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-version', '3');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    
    xhr.onload = () => {
      console.log('Devices API response status:', xhr.status);
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log('Devices API response:', response);
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
          console.log('Parsed devices:', devices.length);
          resolve({ items: devices, total: response.total || devices.length });
        } catch (e) {
          console.error('Failed to parse devices response:', e);
          resolve({ items: [], total: 0 });
        }
      } else {
        console.error('Failed to fetch devices:', xhr.status, xhr.statusText);
        resolve({ items: [], total: 0 });
      }
    };
    
    xhr.onerror = () => {
      console.error('Network error fetching devices');
      resolve({ items: [], total: 0 });
    };
    xhr.send();
  });
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
      console.log('Device by ID API response status:', xhr.status);
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log('Device by ID API response:', response);
          // API returns the device directly, not wrapped in items array
          const device = response.data || response;
          resolve({
            id: device.id,
            name: device.name,
            displayName: device.displayName || device.name,
            currentCollectorId: device.currentCollectorId,
          });
        } catch (e) {
          console.error('Failed to parse device response:', e);
          resolve(null);
        }
      } else {
        console.error('Failed to fetch device:', xhr.status, xhr.statusText);
        resolve(null);
      }
    };
    
    xhr.onerror = () => {
      console.error('Network error fetching device');
      resolve(null);
    };
    xhr.send();
  });
}

