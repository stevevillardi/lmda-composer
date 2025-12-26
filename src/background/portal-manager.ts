import type { Portal, Collector, DeviceInfo } from '@/shared/types';

export class PortalManager {
  private portals: Map<string, Portal> = new Map();

  async discoverPortals(): Promise<Portal[]> {
    try {
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

      // Update portals map
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
    const tabId = portal.tabIds[0];
    
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

    const tabId = portal.tabIds[0];

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

    const tabId = portal.tabIds[0];

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

