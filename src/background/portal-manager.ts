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
   * 
   * This method builds a new array of valid tab IDs and updates atomically to avoid
   * race conditions when called concurrently.
   */
  private async getValidTabId(portal: Portal): Promise<number | null> {
    interface Candidate {
      tabId: number;
      isUsable: boolean;
      isActive: boolean;
      lastAccessed: number;
    }

    const candidates: Candidate[] = [];
    const validTabIds: number[] = [];
    
    for (const tabId of portal.tabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab?.url) continue;

        const hostname = new URL(tab.url).hostname;
        if (!hostname.endsWith('.logicmonitor.com')) continue;

          validTabIds.push(tabId);

        const isUsable =
          tab.status === 'complete' &&
          tab.discarded !== true &&
          tab.url.startsWith('https://');

        candidates.push({
          tabId,
          isUsable,
          isActive: tab.active === true,
          lastAccessed: typeof tab.lastAccessed === 'number' ? tab.lastAccessed : 0,
        });
      } catch {
        // Tab no longer exists, skip it
      }
    }
    
    // Atomic update - replace the entire array at once
    portal.tabIds = validTabIds;
    
    // We must be able to inject scripts into the tab. If no loaded/usable tab exists,
    // treat this as no valid tab rather than returning an unloaded/discarded tab ID.
    const best = candidates
      .filter(c => c.isUsable)
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return b.lastAccessed - a.lastAccessed;
      })[0];

    return best?.tabId ?? null;
  }

  private async getUsableTabCandidates(portal: Portal): Promise<Array<{ tabId: number; isActive: boolean; lastAccessed: number }>> {
    const candidates: Array<{ tabId: number; isActive: boolean; lastAccessed: number }> = [];

    for (const tabId of portal.tabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab?.url) continue;

        const hostname = new URL(tab.url).hostname;
        if (!hostname.endsWith('.logicmonitor.com')) continue;

        const isUsable =
          tab.status === 'complete' &&
          tab.discarded !== true &&
          tab.url.startsWith('https://');

        if (!isUsable) continue;

        candidates.push({
          tabId,
          isActive: tab.active === true,
          lastAccessed: typeof tab.lastAccessed === 'number' ? tab.lastAccessed : 0,
        });
      } catch {
        // ignore
      }
    }

    return candidates.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.lastAccessed - a.lastAccessed;
    });
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
      const portalHasCompleteTab = new Map<string, boolean>();
      const portalHasActiveSession = new Map<string, boolean>();
      let skippedIncomplete = 0;
      let verifiedPortals = 0;
      let fallbackPortals = 0;
      let nonPortalMatches = 0;
      let includedIncomplete = 0;
      
      for (const tab of tabs) {
        if (!tab.url || !tab.id) continue;
        
        const url = new URL(tab.url);
        const hostname = url.hostname;
        const isLikelyPortal = isLikelyPortalHostname(hostname);

        // If it doesn't even look like a portal hostname, ignore it.
        // (tabs.query matches *.logicmonitor.com, which includes docs/support/etc.)
        if (!isLikelyPortal) {
          nonPortalMatches += 1;
          continue;
        }

        // If the tab isn't fully loaded, we can't reliably verify LMGlobalData (or fetch CSRF).
        // Still include the hostname so the user can see the portal and we preserve state.
        if (tab.status !== 'complete') {
          console.log(`Including incomplete tab ${tab.id}: status is ${tab.status}`);
          skippedIncomplete += 1;
          includedIncomplete += 1;
        } else {
          portalHasCompleteTab.set(hostname, true);
          const isLMPortal = await this.verifyLogicMonitorPortal(tab.id);
        if (isLMPortal) {
          verifiedPortals += 1;
            portalHasActiveSession.set(hostname, true);
          } else {
            // Heuristic fallback: hostname looks like a portal, but LM app didn't expose LMGlobalData
            // (often due to login page / expired session / alternate LM page).
          fallbackPortals += 1;
          }
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

          // If we can see at least one loaded tab for this portal, but none of them have a populated
          // LMGlobalData, we should not treat the portal as "active" (green). This commonly indicates
          // the login page (LMGlobalData = {}) / expired session.
          const hasComplete = portalHasCompleteTab.get(hostname) === true;
          const hasActiveSession = portalHasActiveSession.get(hostname) === true;
          if (hasComplete && !hasActiveSession) {
            existingPortal.status = 'expired';
            existingPortal.csrfToken = null;
            existingPortal.csrfTokenTimestamp = null;
          } else if (hasActiveSession && existingPortal.status === 'expired') {
            // User likely re-logged-in; don't leave the portal stuck in expired.
            // We'll refresh CSRF below to confirm and set active.
            existingPortal.status = 'unknown';
          }
        } else {
          const hasComplete = portalHasCompleteTab.get(hostname) === true;
          const hasActiveSession = portalHasActiveSession.get(hostname) === true;
          this.portals.set(hostname, {
            id: hostname,
            hostname,
            displayName: this.extractDisplayName(hostname),
            csrfToken: null,
            csrfTokenTimestamp: null,
            tabIds,
            status: hasComplete && !hasActiveSession ? 'expired' : 'unknown',
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
        includedIncomplete,
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
   * Verify that a tab is a *usable* LogicMonitor portal tab by checking for:
   * window.LMGlobalData being present and populated.
   *
   * Note: On logged-out/login pages, LogicMonitor may define `LMGlobalData` as an empty object (`{}`).
   * In that case we treat the tab as NOT verified for an active session.
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
              const lmgd = (window as unknown as { LMGlobalData?: unknown }).LMGlobalData;
              if (typeof lmgd === 'undefined' || lmgd === null) {
                return { hasLMGlobalData: false, isPopulated: false };
              }
              if (typeof lmgd !== 'object') {
                // Unexpected shape, but it exists and is "not empty"
                return { hasLMGlobalData: true, isPopulated: true };
              }
              // Login pages can have LMGlobalData = {}. Treat that as not authenticated.
              const keys = Object.keys(lmgd as Record<string, unknown>);
              return { hasLMGlobalData: true, isPopulated: keys.length > 0 };
            },
          });
          
          const result = results?.[0]?.result as
            | { hasLMGlobalData: boolean; isPopulated: boolean }
            | undefined;
          
          if (result?.hasLMGlobalData && result.isPopulated) return true;

          // If LMGlobalData exists but is empty, it may still be initializing, but it's also the
          // logged-out/login-page shape. We'll retry a couple times before giving up.
          if (result?.hasLMGlobalData && !result.isPopulated) {
            if (attempt < maxRetries - 1) {
              console.log(`Portal verification attempt ${attempt + 1} failed: LMGlobalData empty for tab ${tabId}, retrying...`);
              continue;
            }
            return false;
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

  private async hasActiveSessionForTab(tabId: number): Promise<boolean> {
    // Keep this cheap: no retries/delays here. Callers can decide when to retry.
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const lmgd = (window as unknown as { LMGlobalData?: unknown }).LMGlobalData;
          if (typeof lmgd === 'undefined' || lmgd === null) return false;
          if (typeof lmgd !== 'object') return true;
          return Object.keys(lmgd as Record<string, unknown>).length > 0;
        },
      });
      return results?.[0]?.result === true;
    } catch {
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
        // If we already consider the portal active and the token is fresh, skip refresh.
        // Otherwise, refresh even if the token is "fresh" so we can recover when a user
        // re-logs-in after being marked expired/unknown.
        if (portal.status === 'active' && age < PortalManager.CSRF_TOKEN_TTL_MS) {
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
    const candidates = await this.getUsableTabCandidates(portal);
    if (candidates.length === 0) {
      // No *loaded* tab available (tabs may be discarded/unloaded). Don't assume the session is expired.
      portal.status = portal.csrfToken ? portal.status : 'unknown';
      this.persistState();
      return;
    }
    
    try {
      for (const { tabId } of candidates) {
        // A CSRF token can be returned even while logged out; don't treat that as an active portal.
        // Only accept a token when the tab also indicates an active session.
        const hasActiveSession = await this.hasActiveSessionForTab(tabId);
        if (!hasActiveSession) {
          continue;
        }

      // Execute in content script context to fetch CSRF token
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchCsrfToken,
      });

      const token = results?.[0]?.result ?? null;
      if (token) {
          this.setActiveCsrfToken(portal.id, token);
        return;
      }
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

  /**
   * Accept a CSRF token reported by the content script.
   *
   * IMPORTANT: A CSRF token may be obtainable even while logged out, so we must NOT
   * automatically mark the portal as active based on token presence alone.
   */
  async receiveCsrfTokenFromContentScript(portalId: string, token: string): Promise<void> {
    const portal = this.portals.get(portalId);
    if (!portal) return;

      portal.csrfToken = token;
      portal.csrfTokenTimestamp = Date.now();

    // Only mark active if we can confirm an active session from a usable portal tab.
    const candidates = await this.getUsableTabCandidates(portal);
    const bestTabId = candidates[0]?.tabId;
    if (bestTabId) {
      const hasActiveSession = await this.hasActiveSessionForTab(bestTabId);
      if (hasActiveSession) {
      portal.status = 'active';
      } else {
        // Keep non-green; discovery will set expired if it sees a loaded login page.
        if (portal.status === 'active') portal.status = 'unknown';
      }
    }

      this.persistState();
    }

  /**
   * Internal helper for when we already know a request succeeded under an active session.
   */
  private setActiveCsrfToken(portalId: string, token: string): void {
    const portal = this.portals.get(portalId);
    if (!portal) return;
    portal.csrfToken = token;
    portal.csrfTokenTimestamp = Date.now();
    portal.status = 'active';
    this.persistState();
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
// Note: This function has special header requirements (X-CSRF-Token: Fetch)
// and needs to read response headers, so it doesn't use the standard lmFetch pattern.
function fetchCsrfToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/santaba/rest/functions/dummy', true);
    xhr.setRequestHeader('X-CSRF-Token', 'Fetch'); // Special value to request token
    xhr.setRequestHeader('X-version', '3');
    xhr.onload = () => resolve(xhr.status === 200 ? xhr.getResponseHeader('X-CSRF-Token') : null);
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

  type CollectorItem = { id: number; description: string; hostname: string; status: number; isDown: boolean; collectorGroupName: string; arch?: string };
  type CollectorResponse = { items?: CollectorItem[]; data?: { items?: CollectorItem[]; total?: number }; total?: number };

  const pageSize = 1000;
  const allCollectors: CollectorItem[] = [];
  let offset = 0;
  let total = 0;

  while (true) {
    const result = await lmFetch<CollectorResponse>(
      `/santaba/rest/setting/collector/collectors?size=${pageSize}&offset=${offset}&fields=id,description,hostname,status,isDown,collectorGroupName,arch`,
      { csrfToken }
    );

    if (!result.ok || !result.data) break;

    const items = result.data.items || result.data.data?.items || [];
    if (items.length === 0) break;

    const collectors = items.map((c) => ({
      id: c.id,
      description: c.description || `Collector ${c.id}`,
      hostname: c.hostname,
      status: c.status,
      isDown: c.isDown,
      collectorGroupName: c.collectorGroupName,
      arch: c.arch,
    }));

    allCollectors.push(...collectors);
    total = typeof result.data.total === 'number' ? result.data.total : (result.data.data?.total ?? 0);
    offset += items.length;

    if (total > 0 && offset >= total) break;
    if (items.length < pageSize) break;
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

  type DeviceItem = { id: number; name: string; displayName: string; currentCollectorId: number; hostStatus: string };
  type DeviceResponse = { items?: DeviceItem[]; data?: { items?: DeviceItem[]; total?: number }; total?: number };

  const pageSize = 1000;
  const filter = encodeURIComponent(`currentCollectorId:${collectorId}`);
  const allDevices: DeviceItem[] = [];
  let offset = 0;
  let total = 0;

  while (true) {
    const result = await lmFetch<DeviceResponse>(
      `/santaba/rest/device/devices?filter=${filter}&size=${pageSize}&offset=${offset}&fields=id,name,displayName,currentCollectorId,hostStatus`,
      { csrfToken }
    );

    if (!result.ok || !result.data) break;

    const items = result.data.items || result.data.data?.items || [];
    if (items.length === 0) break;

    const devices = items.map((d) => ({
      id: d.id,
      name: d.name,
      displayName: d.displayName || d.name,
      currentCollectorId: d.currentCollectorId,
      hostStatus: d.hostStatus || 'unknown',
    }));

    allDevices.push(...devices);
    total = typeof result.data.total === 'number' ? result.data.total : (result.data.data?.total ?? 0);
    offset += items.length;

    if (total > 0 && offset >= total) break;
    if (items.length < pageSize) break;
  }

  return { items: allDevices, total: total || allDevices.length };
}

// Function to be injected into the page to fetch a single device by ID
async function fetchDeviceById(csrfToken: string | null, resourceId: number): Promise<{
  id: number;
  name: string;
  displayName: string;
  currentCollectorId: number;
} | null> {
  // Embedded lmFetch helper
  const lmFetch = <T = unknown>(url: string, opts: { method?: string; csrfToken?: string | null; body?: unknown } = {}): Promise<{ ok: boolean; status: number; data?: T }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', '3');
      if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let data: T | undefined;
        try { data = JSON.parse(xhr.responseText) as T; } catch { /* empty */ }
        resolve({ ok, status: xhr.status, data });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0 });
      xhr.send(opts.body ? JSON.stringify(opts.body) : undefined);
    });

  const result = await lmFetch<{ data?: { id: number; name: string; displayName: string; currentCollectorId: number }; id?: number; name?: string; displayName?: string; currentCollectorId?: number }>(
    `/santaba/rest/device/devices/${resourceId}?fields=id,name,displayName,currentCollectorId`,
    { csrfToken }
  );

  if (result.ok && result.data) {
    const device = result.data.data || result.data;
    return {
      id: device.id!,
      name: device.name!,
      displayName: device.displayName || device.name!,
      currentCollectorId: device.currentCollectorId!,
    };
  }
  return null;
}

// Function to be injected into the page to fetch device properties
async function fetchDeviceProperties(csrfToken: string | null, deviceId: number): Promise<Array<{
  name: string;
  value: string;
  type: 'system' | 'custom' | 'inherited' | 'auto';
}>> {
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

  type DevicePropsResponse = {
    data?: {
      systemProperties?: Array<{ name: string; value: string }>;
      customProperties?: Array<{ name: string; value: string }>;
      inheritedProperties?: Array<{ name: string; value: string }>;
      autoProperties?: Array<{ name: string; value: string }>;
    };
    systemProperties?: Array<{ name: string; value: string }>;
    customProperties?: Array<{ name: string; value: string }>;
    inheritedProperties?: Array<{ name: string; value: string }>;
    autoProperties?: Array<{ name: string; value: string }>;
  };

  const result = await lmFetch<DevicePropsResponse>(
    `/santaba/rest/device/devices/${deviceId}?fields=systemProperties,customProperties,inheritedProperties,autoProperties`,
    { csrfToken }
  );

  if (!result.ok || !result.data) return [];

  const device = result.data.data || result.data;
  const properties: Array<{ name: string; value: string; type: 'system' | 'custom' | 'inherited' | 'auto' }> = [];

  // Process each property type
  const propTypes = ['system', 'custom', 'inherited', 'auto'] as const;
  for (const propType of propTypes) {
    const propsKey = `${propType}Properties` as keyof typeof device;
    const props = device[propsKey];
    if (Array.isArray(props)) {
      for (const prop of props) {
        properties.push({ name: prop.name, value: prop.value || '', type: propType });
      }
    }
  }

  // Sort by name
  properties.sort((a, b) => a.name.localeCompare(b.name));
  return properties;
}

// Function to be injected into the page to test AppliesTo expressions
async function testAppliesToExpression(
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
  // Embedded lmFetch helper
  const lmFetch = <T = unknown>(url: string, opts: { method?: string; csrfToken?: string | null; body?: unknown } = {}): Promise<{ ok: boolean; status: number; data?: T }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-version', '3');
      if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-Token', opts.csrfToken);
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        let data: T | undefined;
        try { data = JSON.parse(xhr.responseText) as T; } catch { /* empty */ }
        resolve({ ok, status: xhr.status, data });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0 });
      xhr.send(opts.body ? JSON.stringify(opts.body) : undefined);
    });

  type AppliesToResponse = {
    originalAppliesTo?: string;
    currentAppliesTo?: string;
    originalMatches?: Array<{ type: string; id: number; name: string }>;
    currentMatches?: Array<{ type: string; id: number; name: string }>;
    warnMessage?: string;
    errorMessage?: string;
    message?: string;
    errorCode?: number;
    errorDetail?: string | null;
  };

  const result = await lmFetch<AppliesToResponse>('/santaba/rest/functions', {
    method: 'POST',
    csrfToken,
    body: {
      currentAppliesTo,
      originalAppliesTo: '',
      type: 'testAppliesTo',
      needInheritProps: false,
      testFrom,
    },
  });

  if (!result.data) {
    return { error: { errorMessage: 'Network error', errorCode: 0, errorDetail: null } };
  }

  if (result.ok) {
    return {
      result: {
        originalAppliesTo: result.data.originalAppliesTo || '',
        currentAppliesTo: result.data.currentAppliesTo || currentAppliesTo,
        originalMatches: result.data.originalMatches || [],
        currentMatches: result.data.currentMatches || [],
        warnMessage: result.data.warnMessage || '',
      },
    };
  }

  // API returned an error (e.g., 400 for syntax errors)
  return {
    error: {
      errorMessage: result.data.errorMessage || result.data.message || 'Unknown error',
      errorCode: result.data.errorCode || result.status,
      errorDetail: result.data.errorDetail || null,
    },
  };
}
