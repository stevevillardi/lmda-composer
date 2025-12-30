import type { ContentToSWMessage, DeviceContext } from '@/shared/types';

// ============================================================================
// Content Script - Injected into LogicMonitor pages
// ============================================================================


/**
 * Check if the extension context is still valid.
 * Returns false if the extension has been reloaded/updated since this content script was injected.
 */
function isExtensionContextValid(): boolean {
  try {
    // Accessing chrome.runtime.id will throw if context is invalidated
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Safely send a message to the service worker.
 * Returns false if the context is invalid (extension was reloaded).
 */
function safeSendMessage(message: ContentToSWMessage): boolean {
  if (!isExtensionContextValid()) {
    console.warn('LogicMonitor IDE: Extension context invalidated. Please refresh the page.');
    showRefreshNotification();
    return false;
  }
  
  try {
    chrome.runtime.sendMessage(message);
    return true;
  } catch (error) {
    console.error('LogicMonitor IDE: Failed to send message:', error);
    showRefreshNotification();
    return false;
  }
}

/**
 * Show a notification asking the user to refresh the page.
 */
function showRefreshNotification() {
  // Don't show multiple notifications
  if (document.querySelector('.lm-ide-refresh-notification')) return;
  
  const notification = document.createElement('div');
  notification.className = 'lm-ide-refresh-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1a1a2e;
    color: #fff;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 400px;
    animation: slideIn 0.3s ease;
  `;
  
  notification.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <div style="flex: 1;">
      <div style="font-weight: 600; margin-bottom: 4px;">LMDA Composer Updated</div>
      <div style="opacity: 0.8; font-size: 13px;">Please refresh the page to use LMDA Composer.</div>
    </div>
    <button style="
      background: #3b82f6;
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    ">Refresh</button>
    <button style="
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 4px;
      font-size: 18px;
      line-height: 1;
    ">×</button>
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Handle refresh button
  const refreshBtn = notification.querySelector('button:first-of-type');
  refreshBtn?.addEventListener('click', () => {
    window.location.reload();
  });
  
  // Handle close button
  const closeBtn = notification.querySelector('button:last-of-type');
  closeBtn?.addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
}

const CSRF_TOKEN_TTL_MS = 10 * 60 * 1000;

let cachedCsrfToken: { token: string | null; timestamp: number } = {
  token: null,
  timestamp: 0,
};

function isCachedTokenFresh(): boolean {
  if (!cachedCsrfToken.token) return false;
  return Date.now() - cachedCsrfToken.timestamp < CSRF_TOKEN_TTL_MS;
}

async function requestCsrfToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/santaba/rest/functions/dummy', true);
    xhr.setRequestHeader('X-CSRF-Token', 'Fetch');
    xhr.setRequestHeader('X-version', '3');

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.getResponseHeader('X-CSRF-Token'));
      } else {
        resolve(null);
      }
    };

    xhr.onerror = () => resolve(null);
    xhr.send();
  });
}

async function getCsrfToken(forceRefresh: boolean = false): Promise<string | null> {
  if (!forceRefresh && isCachedTokenFresh()) {
    return cachedCsrfToken.token;
  }

  const token = await requestCsrfToken();
  if (token) {
    cachedCsrfToken = { token, timestamp: Date.now() };
  }

  return token;
}

// Send CSRF token to service worker on page load
async function sendCsrfToken() {
  // Don't try to send if context is invalid
  if (!isExtensionContextValid()) return;
  
  try {
    const token = await getCsrfToken();
    if (token) {
      const message: ContentToSWMessage = {
        type: 'CSRF_TOKEN',
        payload: {
          portalId: window.location.hostname,
          token,
        },
      };
      safeSendMessage(message);
    }
  } catch (error) {
    console.error('LogicMonitor IDE: Failed to fetch CSRF token:', error);
  }
}

async function fetchCsrfTokenForRequest(): Promise<string | null> {
  return getCsrfToken();
}

async function fetchDeviceDatasourceInfo(
  deviceId: number,
  resourceDatasourceId: number
): Promise<{ dataSourceId: number; collectMethod: string } | null> {
  const csrfToken = await fetchCsrfTokenForRequest();

  const requestWithToken = (token: string | null) => new Promise<{ dataSourceId: number; collectMethod: string } | null>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'GET',
      `/santaba/rest/device/devices/${deviceId}/devicedatasources/${resourceDatasourceId}`,
      true
    );
    xhr.setRequestHeader('X-version', '3');
    if (token) {
      xhr.setRequestHeader('X-CSRF-Token', token);
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          const data = response?.data ?? response;
          const dataSourceId = data?.dataSourceId ?? data?.dataSourceID;
          const collectMethod = data?.collectMethod;
          if (typeof dataSourceId === 'number' && typeof collectMethod === 'string') {
            resolve({ dataSourceId, collectMethod });
            return;
          }
        } catch (error) {
          console.error('LogicMonitor IDE: Failed to parse device datasource response:', error);
        }
      }
      resolve(null);
    };

    xhr.onerror = () => resolve(null);
    xhr.send();
  });

  const firstAttempt = await requestWithToken(csrfToken);
  if (firstAttempt) return firstAttempt;

  // Retry once on possible token expiry
  const refreshedToken = await getCsrfToken(true);
  if (!refreshedToken) return null;
  return requestWithToken(refreshedToken);
}

// Extract device context from current page URL
// Simplified: only extracts portalId and resourceId from URL
// Device details (hostname, collectorId) are fetched via API in the editor
function extractDeviceContext(): DeviceContext {
  const context: DeviceContext = {
    portalId: window.location.hostname,
  };

  const url = new URL(window.location.href);
  
  // Extract resource ID from URL like:
  // .../treeNodes?resourcePath=resourceGroups-1*,...,resources-5132
  const resourcePath = url.searchParams.get('resourcePath');
  if (resourcePath) {
    const match = resourcePath.match(/resources-(\d+)/);
    if (match) {
      context.resourceId = parseInt(match[1], 10);
    }
    const datasourceMatch = resourcePath.match(/resourceDataSources-(\d+)/);
    if (datasourceMatch) {
      context.resourceDatasourceId = parseInt(datasourceMatch[1], 10);
    }
  }

  return context;
}

// Resource menu item text patterns that indicate a resource options menu
const RESOURCE_MENU_INDICATORS = [
  'Add Monitored Instance',
  'Add Additional Monitoring', 

];

// Resource menu item text patterns that indicate a resource options menu
const COLLECTOR_MENU_INDICATORS = [
  'Collector Status',
  'Restart Collector', 

];

const iconButtonCleanups = new WeakMap<HTMLElement, () => void>();

function registerIconButtonCleanup(wrapper: HTMLElement, cleanup: () => void) {
  iconButtonCleanups.set(wrapper, cleanup);
}

function setupIconButtonCleanupObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.classList.contains('lm-ide-icon-button')) {
          iconButtonCleanups.get(node)?.();
          iconButtonCleanups.delete(node);
          continue;
        }
        node.querySelectorAll?.('.lm-ide-icon-button').forEach((child) => {
          if (!(child instanceof HTMLElement)) return;
          iconButtonCleanups.get(child)?.();
          iconButtonCleanups.delete(child);
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Check if a menu appears to be a resource options menu based on its items
function isResourceOptionsMenu(menuContainer: HTMLElement): boolean {
  const menuText = menuContainer.textContent || '';
  // Check if menu contains at least 2 of our indicator phrases
  const matchCount = RESOURCE_MENU_INDICATORS.filter(indicator => 
    menuText.includes(indicator)
  ).length;
  return matchCount >= 2;
}

// Check if a menu appears to be a collector options menu based on its items
function isCollectorOptionsMenu(menuContainer: HTMLElement): boolean {
  const menuText = menuContainer.textContent || '';
  // Check if menu contains at least 2 of our indicator phrases
  const matchCount = COLLECTOR_MENU_INDICATORS.filter(indicator => 
    menuText.includes(indicator)
  ).length;
  return matchCount >= 2;
}

// Watch for resource tree menu and inject "Open in LogicMonitor IDE" option
function setupResourceTreeObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Look for MUI popover/menu elements
          const isPopover = node.classList.contains('MuiPopover-root') || 
                           node.querySelector('.MuiPopover-paper') ||
                           node.querySelector('[role="menu"]');
          
          if (!isPopover) continue;
          
          // Already has our menu item
          if (node.querySelector('.lm-ide-menu-item')) continue;
          
          // Small delay to let the menu fully render, then check if it's a resource menu
          setTimeout(() => {
            if (isResourceOptionsMenu(node) || isCollectorOptionsMenu(node)) {
              injectMenuItem(node);
            }
          }, 100);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function injectMenuItem(menuContainer: HTMLElement) {
  // Find the menu list - try various LM menu patterns
  const menuList = menuContainer.querySelector('.MuiList-root, .MuiMenu-list, [role="menu"], ul');
  if (!menuList) return;
  
  // Don't add if already present
  if (menuList.querySelector('.lm-ide-menu-item')) return;

  // Try to match LM's existing menu item style
  const existingMenuItem = menuList.querySelector('.MuiMenuItem-root, [role="menuitem"]');
  const baseClasses = existingMenuItem?.className || '';
  
  // Create our menu item
  const menuItem = document.createElement('li');
  menuItem.className = `lm-ide-menu-item ${baseClasses}`;
  menuItem.setAttribute('role', 'menuitem');
  menuItem.setAttribute('tabindex', '-1');
  menuItem.style.cssText = `
    padding: 4px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: inherit;
    min-height: 22px;
    transition: background-color 0.15s ease;
  `;
  menuItem.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(0, 27, 102)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16,18 22,12 16,6"></polyline>
      <polyline points="8,6 2,12 8,18"></polyline>
    </svg>
    <span>Open in LMDA Composer</span>
  `;

  menuItem.addEventListener('mouseenter', () => {
    menuItem.style.backgroundColor = 'rgb(240, 242, 245)';
  });

  menuItem.addEventListener('mouseleave', () => {
    menuItem.style.backgroundColor = 'transparent';
  });

  menuItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    const context = extractDeviceContext();
    if (context.resourceId && context.resourceDatasourceId) {
      const info = await fetchDeviceDatasourceInfo(context.resourceId, context.resourceDatasourceId);
      if (info) {
        context.dataSourceId = info.dataSourceId;
        context.collectMethod = info.collectMethod;
      }
    }
    const message: ContentToSWMessage = {
      type: 'OPEN_EDITOR',
      payload: context,
    };
    
    // Try to send the message - this will show a refresh notification if context is invalid
    if (safeSendMessage(message)) {
      // Close the menu by clicking outside
      document.body.click();
    }
  });

  // Add a divider before our item
  const divider = document.createElement('li');
  divider.className = 'MuiDivider-root';
  divider.setAttribute('role', 'separator');
  divider.style.cssText = 'height: 1px; margin: 4px 0; background-color: rgba(0, 0, 0, 0.12); list-style: none;';
  
  menuList.appendChild(divider);
  menuList.appendChild(menuItem);
}

// Watch for button bars with Edit button and inject icon button
function setupButtonBarObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Check if this node or its children contain a button with title="Edit"
          const editButtonContainer = node.querySelector?.('[title="Edit"]');
          if (editButtonContainer) {
            // Find the parent container (the div.d-f.ai-c)
            const buttonBar = editButtonContainer.closest('.d-f.ai-c');
            if (buttonBar && buttonBar instanceof HTMLElement) {
              // Small delay to ensure DOM is fully rendered
              setTimeout(() => {
                injectIconButton(buttonBar, editButtonContainer as HTMLElement);
              }, 50);
            }
          }
        }
      }
    }
  });

  // Also check existing elements on page load
  const checkExistingElements = () => {
    const editButtonContainers = document.querySelectorAll('[title="Edit"]');
    editButtonContainers.forEach((editButtonContainer) => {
      const buttonBar = editButtonContainer.closest('.d-f.ai-c');
      if (buttonBar && buttonBar instanceof HTMLElement) {
        injectIconButton(buttonBar, editButtonContainer as HTMLElement);
      }
    });
  };

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Check existing elements after a short delay
  setTimeout(checkExistingElements, 500);
}

function injectIconButton(buttonBar: HTMLElement, editButtonContainer: HTMLElement) {
  // Don't add if already present
  if (buttonBar.querySelector('.lm-ide-icon-button')) return;

  // Create wrapper div similar to other button containers
  const wrapper = document.createElement('div');
  wrapper.className = 'lm-ide-icon-button';
  
  // Create Material-UI IconButton matching the existing structure
  const button = document.createElement('button');
  button.className = 'MuiButtonBase-root MuiIconButton-root MuiIconButton-colorPrimary';
  button.setAttribute('tabindex', '0');
  button.setAttribute('type', 'button');
  
  const iconButtonLabel = document.createElement('span');
  iconButtonLabel.className = 'MuiIconButton-label';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'MuiSvgIcon-root icon-width-24 icon-height-24');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  
  // Create the code/editor icon SVG path (code brackets icon)
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z');
  path.setAttribute('fill', 'currentColor');
  
  svg.appendChild(path);
  iconButtonLabel.appendChild(svg);
  button.appendChild(iconButtonLabel);
  wrapper.appendChild(button);

  // Create Material-UI style tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'MuiTooltip-tooltip MuiTooltip-tooltipPlacementBottom lm-ide-tooltip';
  tooltip.textContent = 'Open in LMDA Composer';
  tooltip.style.cssText = `
    position: fixed;
    transform-origin: top center;
    z-index: 1500;
    pointer-events: none;
    color: #fff;
    background-color: rgba(4, 28, 91);
    font-family: "Circular", "Helvetica", "Arial", "sans-serif";
    font-size: 0.75rem;
    line-height: 1.4em;
    padding: 4px 8px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateX(-50%) translateY(0) scale(0);
    white-space: nowrap;
    left: 0;
    top: 0;
  `;
  
  document.body.appendChild(tooltip);
  
  let tooltipTimeout: number | null = null;
  let hideTimeout: number | null = null;
  const controller = new AbortController();
  
  const updateTooltipPosition = () => {
    const rect = wrapper.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom}px`;
  };
  
  const showTooltip = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    
    tooltipTimeout = window.setTimeout(() => {
      updateTooltipPosition();
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    }, 500); // Material-UI default delay
  };
  
  const hideTooltip = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = null;
    }
    
    hideTimeout = window.setTimeout(() => {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateX(-50%) translateY(0) scale(0)';
    }, 100);
  };
  
  button.addEventListener('mouseenter', showTooltip, { signal: controller.signal });
  button.addEventListener('mouseleave', hideTooltip, { signal: controller.signal });
  button.addEventListener('focus', showTooltip, { signal: controller.signal });
  button.addEventListener('blur', hideTooltip, { signal: controller.signal });
  
  // Update tooltip position on scroll/resize
  const handlePositionUpdate = () => {
    if (tooltip.style.opacity === '1') {
      updateTooltipPosition();
    }
  };
  
  window.addEventListener('scroll', handlePositionUpdate, { capture: true, signal: controller.signal });
  window.addEventListener('resize', handlePositionUpdate, { signal: controller.signal });

  // Add click handler
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltip();
    
    const context = extractDeviceContext();
    const message: ContentToSWMessage = {
      type: 'OPEN_EDITOR',
      payload: context,
    };
    
    safeSendMessage(message);
  });

  // Insert before the Edit button container
  editButtonContainer.parentNode?.insertBefore(wrapper, editButtonContainer);

  registerIconButtonCleanup(wrapper, () => {
    controller.abort();
    tooltip.remove();
  });
}

// Initialize
sendCsrfToken();
setupResourceTreeObserver();
setupButtonBarObserver();
setupIconButtonCleanupObserver();

// Listen for messages from service worker (only if context is valid)
if (isExtensionContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_CONTEXT') {
      sendResponse(extractDeviceContext());
    }
    return true;
  });
}
