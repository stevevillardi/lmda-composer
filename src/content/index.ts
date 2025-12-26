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

  return context;
}

// Watch for resource tree menu and inject "Open in LM IDE" option
function setupResourceTreeObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Look for the popover/menu that appears on resource tree right-click
          const menuItems = node.querySelectorAll('[role="menuitem"], [class*="MenuItem"]');
          if (menuItems.length > 0 && !node.querySelector('.lm-ide-menu-item')) {
            injectMenuItem(node);
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
  // Find the menu list
  const menuList = menuContainer.querySelector('[role="menu"], ul');
  if (!menuList) return;

  // Create our menu item
  const menuItem = document.createElement('div');
  menuItem.className = 'lm-ide-menu-item';
  menuItem.setAttribute('role', 'menuitem');
  menuItem.style.cssText = `
    padding: 8px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: inherit;
  `;
  menuItem.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16,18 22,12 16,6"></polyline>
      <polyline points="8,6 2,12 8,18"></polyline>
    </svg>
    Open in LM IDE
  `;

  menuItem.addEventListener('mouseenter', () => {
    menuItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  });

  menuItem.addEventListener('mouseleave', () => {
    menuItem.style.backgroundColor = 'transparent';
  });

  menuItem.addEventListener('click', () => {
    const context = extractDeviceContext();
    const message: ContentToSWMessage = {
      type: 'OPEN_EDITOR',
      payload: context,
    };
    chrome.runtime.sendMessage(message);
  });

  // Add separator and menu item
  const separator = document.createElement('div');
  separator.style.cssText = 'height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0;';
  
  menuList.appendChild(separator);
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

