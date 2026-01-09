/**
 * Hook to set up Chrome message listeners for portal events.
 * 
 * Listens for:
 * - Portal disconnection messages from service worker
 */

import { useEffect } from 'react';
import { useEditorStore } from '../stores/editor-store';

export function usePortalEventListeners() {
  const handlePortalDisconnected = useEditorStore((state) => state.handlePortalDisconnected);

  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: { portalId: string; hostname: string } }) => {
      if (message.type === 'PORTAL_DISCONNECTED' && message.payload) {
        handlePortalDisconnected(message.payload.portalId, message.payload.hostname);
      }
      // Don't return true - we're not using sendResponse
      return false;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [handlePortalDisconnected]);
}

