/**
 * Browser detection utilities
 */

/**
 * Check if the current browser is Brave
 * Uses navigator.brave API if available, otherwise falls back to user agent check
 * Note: navigator.brave.isBrave() returns a Promise, so this function is async
 */
export async function isBraveBrowser(): Promise<boolean> {
  // Check for Brave-specific API (most reliable method)
  if (typeof navigator !== 'undefined' && (navigator as any).brave) {
    try {
      const braveCheck = (navigator as any).brave.isBrave?.();
      // Handle both Promise and direct boolean return
      const isBrave = braveCheck instanceof Promise 
        ? await braveCheck 
        : braveCheck === true;
      return isBrave;
    } catch (_error) {
      // Fall through to user agent check
    }
  }
  
  // Fallback to user agent check
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent.includes('Brave');
  }
  
  return false;
}

export async function isVivaldiBrowser(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return false;

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return Boolean((tab as { vivExtData?: unknown } | undefined)?.vivExtData);
  } catch {
    return false;
  }
}
