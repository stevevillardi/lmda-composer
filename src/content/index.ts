import type { ContentToSWMessage, DeviceContext } from '@/shared/types';

// ============================================================================
// Content Script - Injected into LogicMonitor pages
// ============================================================================

console.log('LM IDE Content Script loaded');

// Send CSRF token to service worker on page load
async function sendCsrfToken() {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/santaba/rest/functions/dummy', true);
    xhr.setRequestHeader('X-CSRF-Token', 'Fetch');
    xhr.setRequestHeader('X-version', '3');
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const token = xhr.getResponseHeader('X-CSRF-Token');
        if (token) {
          const message: ContentToSWMessage = {
            type: 'CSRF_TOKEN',
            payload: {
              portalId: window.location.hostname,
              token,
            },
          };
          chrome.runtime.sendMessage(message);
        }
      }
    };
    
    xhr.send();
  } catch (error) {
    console.error('LM IDE: Failed to fetch CSRF token:', error);
  }
}

// Extract device context from current page
function extractDeviceContext(): DeviceContext {
  const context: DeviceContext = {
    portalId: window.location.hostname,
  };

  // Try to extract device info from URL
  const url = new URL(window.location.href);
  
  // Pattern: /device/devices/{id} or /device/index.jsp#layer*/d/{id}
  const deviceIdMatch = url.hash.match(/\/d\/(\d+)/) || url.pathname.match(/\/devices\/(\d+)/);
  if (deviceIdMatch) {
    context.deviceId = parseInt(deviceIdMatch[1], 10);
  }

  // Pattern: collectorId in query params
  const collectorId = url.searchParams.get('collectorId');
  if (collectorId) {
    context.collectorId = parseInt(collectorId, 10);
  }

  // Try to extract hostname from the page content
  // Look for common patterns in the LM UI
  try {
    // Look for the device header which often contains the hostname
    const deviceHeader = document.querySelector('[data-testid="device-header"]');
    if (deviceHeader) {
      const hostnameEl = deviceHeader.querySelector('[data-testid="device-hostname"]');
      if (hostnameEl?.textContent) {
        context.hostname = hostnameEl.textContent.trim();
      }
    }
    
    // Alternative: Look in the properties panel
    if (!context.hostname) {
      const propsTable = document.querySelector('[data-testid="properties-table"]');
      if (propsTable) {
        const rows = propsTable.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const propName = cells[0]?.textContent?.trim().toLowerCase();
            if (propName === 'system.hostname' || propName === 'hostname') {
              context.hostname = cells[1]?.textContent?.trim();
              break;
            }
          }
        }
      }
    }
    
    // Alternative: Try to extract from the selected resource tree node
    if (!context.hostname) {
      const selectedNode = document.querySelector('[class*="selected"] [class*="resourceName"]');
      if (selectedNode?.textContent) {
        // This might be the display name, not hostname
        // But it's better than nothing
        context.hostname = selectedNode.textContent.trim();
      }
    }
  } catch (error) {
    console.warn('LM IDE: Failed to extract hostname:', error);
  }

  return context;
}

// Watch for resource tree menu and inject "Open in LM IDE" option
function setupResourceTreeObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Look for the popover/menu that appears on resource tree right-click
          // Target LM's MUI popover menus
          const isPopover = node.classList.contains('MuiPopover-root') || 
                           node.querySelector('.MuiPopover-paper') ||
                           node.querySelector('[role="menu"]');
          
          const menuItems = node.querySelectorAll('[role="menuitem"], .MuiMenuItem-root, [class*="MenuItem"]');
          if ((isPopover || menuItems.length > 0) && !node.querySelector('.lm-ide-menu-item')) {
            // Small delay to let the menu fully render
            setTimeout(() => injectMenuItem(node), 50);
          }
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
    padding: 6px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: inherit;
    min-height: 36px;
    transition: background-color 0.15s ease;
  `;
  menuItem.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16,18 22,12 16,6"></polyline>
      <polyline points="8,6 2,12 8,18"></polyline>
    </svg>
    <span>Open in LM IDE</span>
  `;

  menuItem.addEventListener('mouseenter', () => {
    menuItem.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
  });

  menuItem.addEventListener('mouseleave', () => {
    menuItem.style.backgroundColor = 'transparent';
  });

  menuItem.addEventListener('click', (e) => {
    e.stopPropagation();
    
    const context = extractDeviceContext();
    const message: ContentToSWMessage = {
      type: 'OPEN_EDITOR',
      payload: context,
    };
    chrome.runtime.sendMessage(message);
    
    // Close the menu by clicking outside
    document.body.click();
  });

  // Add a divider before our item
  const divider = document.createElement('li');
  divider.className = 'MuiDivider-root';
  divider.setAttribute('role', 'separator');
  divider.style.cssText = 'height: 1px; margin: 4px 0; background-color: rgba(0, 0, 0, 0.12); list-style: none;';
  
  menuList.appendChild(divider);
  menuList.appendChild(menuItem);
}

// Initialize
sendCsrfToken();
setupResourceTreeObserver();

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CONTEXT') {
    sendResponse(extractDeviceContext());
  }
  return true;
});

