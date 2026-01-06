/**
 * Hook to manage File System Access API warnings for unsupported browsers.
 * 
 * Checks for Brave and Vivaldi browsers which may have limited or disabled
 * File System Access API support.
 */

import { useState, useEffect, useCallback } from 'react';
import { isFileSystemAccessSupported } from '../utils/document-store';
import { isBraveBrowser, isVivaldiBrowser } from '../utils/browser-detection';

interface BrowserWarningReturn {
  showBraveWarning: boolean;
  setShowBraveWarning: (show: boolean) => void;
  fileSystemWarningBrowser: 'brave' | 'vivaldi' | null;
  handleBraveWarningDismiss: () => void;
}

export function useBrowserFileSystemWarning(): BrowserWarningReturn {
  const [showBraveWarning, setShowBraveWarning] = useState(false);
  const [fileSystemWarningBrowser, setFileSystemWarningBrowser] = useState<'brave' | 'vivaldi' | null>(null);

  useEffect(() => {
    // Check if user has already dismissed this warning
    const dismissed = localStorage.getItem('lm-ide-fs-api-warning-dismissed')
      ?? localStorage.getItem('lm-ide-brave-fs-api-warning-dismissed');
    if (dismissed === 'true') {
      return;
    }

    const checkBrowser = async () => {
      if (await isVivaldiBrowser()) {
        setFileSystemWarningBrowser('vivaldi');
        setTimeout(() => {
          setShowBraveWarning(true);
        }, 500);
        return;
      }

      const fsApiSupported = isFileSystemAccessSupported();
      if (!fsApiSupported) {
        const isBrave = await isBraveBrowser();
        if (isBrave) {
          setFileSystemWarningBrowser('brave');
          setTimeout(() => {
            setShowBraveWarning(true);
          }, 500);
        }
      }
    };

    checkBrowser().catch((error) => {
      console.error('Error checking browser for File System Access warning:', error);
    });
  }, []);

  const handleBraveWarningDismiss = useCallback(() => {
    localStorage.setItem('lm-ide-fs-api-warning-dismissed', 'true');
    localStorage.setItem('lm-ide-brave-fs-api-warning-dismissed', 'true');
    setShowBraveWarning(false);
  }, []);

  return {
    showBraveWarning,
    setShowBraveWarning,
    fileSystemWarningBrowser,
    handleBraveWarningDismiss,
  };
}

