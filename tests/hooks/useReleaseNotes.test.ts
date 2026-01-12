/**
 * Tests for useReleaseNotes hook.
 * 
 * Tests version checking logic, blocking dialog detection, and version storage.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReleaseNotes } from '../../src/editor/hooks/useReleaseNotes';
import { resetStore, setStoreState } from '../helpers/store-helpers';

// Mock chrome.runtime.getManifest
const mockGetManifest = vi.fn(() => ({ version: '1.5.0' }));

// Mock chrome.storage.local
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();

// Setup global chrome mock
vi.stubGlobal('chrome', {
  runtime: {
    getManifest: mockGetManifest,
  },
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
  },
});

describe('useReleaseNotes', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    // Default: version has changed (different from stored)
    mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
    mockStorageSet.mockResolvedValue(undefined);
  });

  // ===========================================================================
  // Version Checking
  // ===========================================================================
  describe('version checking', () => {
    it('detects version change when stored version differs', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(true);
      });
    });

    it('does not show when version matches', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.5.0' });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(false);
      });
    });

    it('does not show on first install (no stored version)', async () => {
      mockStorageGet.mockResolvedValue({});
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(false);
      });
      
      // Should store the current version for next time
      expect(mockStorageSet).toHaveBeenCalledWith({ lastSeenVersion: '1.5.0' });
    });
  });

  // ===========================================================================
  // Blocking Conditions
  // ===========================================================================
  describe('blocking conditions', () => {
    it('does not show when pendingUrlContext is present', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: { moduleId: 123, moduleType: 'datasource', portalId: 'p1', moduleName: 'Test' },
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        // Version check complete, but blocked by URL context
        expect(result.current.shouldShow).toBe(false);
      });
    });

    it('does not show when draft restore dialog is showing', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: true,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(false);
      });
    });

    it('does not show when module browser is open', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      setStoreState({ moduleBrowserOpen: true });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(false);
      });
    });

    it('does not show when create module wizard is open', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      setStoreState({ createModuleWizardOpen: true });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(false);
      });
    });

    it('does not show when settings dialog is open', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      setStoreState({ settingsDialogOpen: true });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Mark as Seen
  // ===========================================================================
  describe('markAsSeen', () => {
    it('stores current version when markAsSeen is called', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(true);
      });

      await act(async () => {
        await result.current.markAsSeen();
      });

      expect(mockStorageSet).toHaveBeenCalledWith({ lastSeenVersion: '1.5.0' });
    });

    it('updates shouldShow to false after markAsSeen', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(true);
      });

      await act(async () => {
        await result.current.markAsSeen();
      });

      expect(result.current.shouldShow).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================
  describe('error handling', () => {
    it('handles storage get error gracefully', async () => {
      mockStorageGet.mockRejectedValue(new Error('Storage error'));
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        // Should not throw, just not show the modal
        expect(result.current.shouldShow).toBe(false);
      });
    });

    it('handles storage set error gracefully in markAsSeen', async () => {
      mockStorageGet.mockResolvedValue({ lastSeenVersion: '1.4.0' });
      mockStorageSet.mockRejectedValue(new Error('Storage error'));
      
      const { result } = renderHook(() => useReleaseNotes({
        pendingUrlContext: null,
        showDraftRestoreDialog: false,
      }));

      await waitFor(() => {
        expect(result.current.shouldShow).toBe(true);
      });

      // Should not throw
      await act(async () => {
        await result.current.markAsSeen();
      });
    });
  });
});
