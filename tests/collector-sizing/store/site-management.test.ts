/**
 * Tests for site management store actions.
 *
 * Tests addSite, removeSite, renameSite, and related actions
 * in the collector sizing slice.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../../src/editor/stores/editor-store';
import {
  createDefaultDevices,
  createDefaultLogs,
  createDefaultTraps,
  createDefaultFlows,
} from '../../../src/editor/utils/collector-calculations';
import { resetChromeMocks } from '../../setup';

// Get initial state for resets
const initialState = useEditorStore.getState();

function resetStore(): void {
  useEditorStore.setState(initialState, true);
}

describe('Site Management', () => {
  beforeEach(() => {
    resetStore();
    resetChromeMocks();
    // Ensure we start with no sites
    useEditorStore.setState({ sites: [], activeSiteId: null });
  });

  describe('addSite', () => {
    it('creates site with default devices', () => {
      const { addSite } = useEditorStore.getState();
      addSite('Test Site');

      const { sites } = useEditorStore.getState();
      expect(sites).toHaveLength(1);

      const site = sites[0];
      const defaultDevices = createDefaultDevices();
      expect(Object.keys(site.devices)).toEqual(Object.keys(defaultDevices));
    });

    it('creates site with default logs', () => {
      const { addSite } = useEditorStore.getState();
      addSite('Test Site');

      const { sites } = useEditorStore.getState();
      const site = sites[0];
      const defaultLogs = createDefaultLogs();
      expect(Object.keys(site.logs)).toEqual(Object.keys(defaultLogs));
    });

    it('creates site with default traps', () => {
      const { addSite } = useEditorStore.getState();
      addSite('Test Site');

      const { sites } = useEditorStore.getState();
      const site = sites[0];
      const defaultTraps = createDefaultTraps();
      expect(Object.keys(site.traps)).toEqual(Object.keys(defaultTraps));
    });

    it('creates site with default flows', () => {
      const { addSite } = useEditorStore.getState();
      addSite('Test Site');

      const { sites } = useEditorStore.getState();
      const site = sites[0];
      const defaultFlows = createDefaultFlows();
      expect(Object.keys(site.flows)).toEqual(Object.keys(defaultFlows));
    });

    it('sets new site as active', () => {
      const { addSite } = useEditorStore.getState();
      const siteId = addSite('Test Site');

      const { activeSiteId } = useEditorStore.getState();
      expect(activeSiteId).toBe(siteId);
    });

    it('generates unique ID for each site', () => {
      const { addSite } = useEditorStore.getState();
      const id1 = addSite('Site 1');
      const id2 = addSite('Site 2');
      const id3 = addSite('Site 3');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('uses provided name', () => {
      const { addSite } = useEditorStore.getState();
      addSite('My Custom Site');

      const { sites } = useEditorStore.getState();
      expect(sites[0].name).toBe('My Custom Site');
    });

    it('generates default name when not provided', () => {
      const { addSite } = useEditorStore.getState();
      addSite();

      const { sites } = useEditorStore.getState();
      expect(sites[0].name).toBe('Site 1');
    });

    it('generates sequential default names', () => {
      const { addSite } = useEditorStore.getState();
      addSite();
      addSite();
      addSite();

      const { sites } = useEditorStore.getState();
      expect(sites[0].name).toBe('Site 1');
      expect(sites[1].name).toBe('Site 2');
      expect(sites[2].name).toBe('Site 3');
    });

    it('sets site to expanded by default', () => {
      const { addSite } = useEditorStore.getState();
      addSite('Test Site');

      const { sites } = useEditorStore.getState();
      expect(sites[0].isExpanded).toBe(true);
    });

    it('sets activeTab to devices by default', () => {
      const { addSite } = useEditorStore.getState();
      addSite('Test Site');

      const { sites } = useEditorStore.getState();
      expect(sites[0].activeTab).toBe('devices');
    });

    it('marks state as dirty', () => {
      const { addSite } = useEditorStore.getState();
      useEditorStore.setState({ collectorSizingIsDirty: false });

      addSite('Test Site');

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('returns the new site ID', () => {
      const { addSite } = useEditorStore.getState();
      const siteId = addSite('Test Site');

      expect(siteId).toBeDefined();
      expect(typeof siteId).toBe('string');
      expect(siteId.startsWith('site-')).toBe(true);
    });
  });

  describe('removeSite', () => {
    it('deletes specified site', () => {
      const { addSite, removeSite } = useEditorStore.getState();
      const siteId = addSite('Site 1');
      addSite('Site 2');

      removeSite(siteId);

      const { sites } = useEditorStore.getState();
      expect(sites).toHaveLength(1);
      expect(sites.find((s) => s.id === siteId)).toBeUndefined();
    });

    it('selects another site as active when active site is removed', () => {
      const { addSite, removeSite } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      const site2Id = addSite('Site 2');

      // Site 2 is now active (last added)
      expect(useEditorStore.getState().activeSiteId).toBe(site2Id);

      removeSite(site2Id);

      const { activeSiteId } = useEditorStore.getState();
      expect(activeSiteId).toBe(site1Id);
    });

    it('sets activeSiteId to null when last site is removed', () => {
      const { addSite, removeSite } = useEditorStore.getState();
      const siteId = addSite('Only Site');

      removeSite(siteId);

      const { sites, activeSiteId } = useEditorStore.getState();
      expect(sites).toHaveLength(0);
      expect(activeSiteId).toBeNull();
    });

    it('keeps active site unchanged when non-active site is removed', () => {
      const { addSite, removeSite, setActiveSiteId } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      const site2Id = addSite('Site 2');

      // Manually set site1 as active
      setActiveSiteId(site1Id);

      removeSite(site2Id);

      const { activeSiteId } = useEditorStore.getState();
      expect(activeSiteId).toBe(site1Id);
    });

    it('marks state as dirty', () => {
      const { addSite, removeSite } = useEditorStore.getState();
      const siteId = addSite('Test Site');
      useEditorStore.setState({ collectorSizingIsDirty: false });

      removeSite(siteId);

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('handles removing non-existent site gracefully', () => {
      const { addSite, removeSite } = useEditorStore.getState();
      addSite('Site 1');

      // Should not throw
      expect(() => removeSite('non-existent-id')).not.toThrow();

      const { sites } = useEditorStore.getState();
      expect(sites).toHaveLength(1);
    });
  });

  describe('renameSite', () => {
    it('updates site name', () => {
      const { addSite, renameSite } = useEditorStore.getState();
      const siteId = addSite('Original Name');

      renameSite(siteId, 'New Name');

      const { sites } = useEditorStore.getState();
      expect(sites[0].name).toBe('New Name');
    });

    it('marks state as dirty', () => {
      const { addSite, renameSite } = useEditorStore.getState();
      const siteId = addSite('Test Site');
      useEditorStore.setState({ collectorSizingIsDirty: false });

      renameSite(siteId, 'New Name');

      const { collectorSizingIsDirty } = useEditorStore.getState();
      expect(collectorSizingIsDirty).toBe(true);
    });

    it('only renames the specified site', () => {
      const { addSite, renameSite } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      addSite('Site 2');

      renameSite(site1Id, 'Renamed Site');

      const { sites } = useEditorStore.getState();
      const site1 = sites.find((s) => s.id === site1Id);
      const site2 = sites.find((s) => s.id !== site1Id);

      expect(site1?.name).toBe('Renamed Site');
      expect(site2?.name).toBe('Site 2');
    });

    it('handles renaming non-existent site gracefully', () => {
      const { addSite, renameSite } = useEditorStore.getState();
      addSite('Site 1');

      // Should not throw
      expect(() => renameSite('non-existent-id', 'New Name')).not.toThrow();
    });

    it('allows empty name', () => {
      const { addSite, renameSite } = useEditorStore.getState();
      const siteId = addSite('Original Name');

      renameSite(siteId, '');

      const { sites } = useEditorStore.getState();
      expect(sites[0].name).toBe('');
    });
  });

  describe('setActiveSiteId', () => {
    it('changes active site selection', () => {
      const { addSite, setActiveSiteId } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      addSite('Site 2');

      setActiveSiteId(site1Id);

      const { activeSiteId } = useEditorStore.getState();
      expect(activeSiteId).toBe(site1Id);
    });

    it('can set active site to null', () => {
      const { addSite, setActiveSiteId } = useEditorStore.getState();
      addSite('Site 1');

      setActiveSiteId(null);

      const { activeSiteId } = useEditorStore.getState();
      expect(activeSiteId).toBeNull();
    });
  });

  describe('toggleSiteExpanded', () => {
    it('toggles site expansion state', () => {
      const { addSite, toggleSiteExpanded } = useEditorStore.getState();
      const siteId = addSite('Test Site');

      // Initially expanded
      expect(useEditorStore.getState().sites[0].isExpanded).toBe(true);

      toggleSiteExpanded(siteId);
      expect(useEditorStore.getState().sites[0].isExpanded).toBe(false);

      toggleSiteExpanded(siteId);
      expect(useEditorStore.getState().sites[0].isExpanded).toBe(true);
    });

    it('only toggles specified site', () => {
      const { addSite, toggleSiteExpanded } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      addSite('Site 2');

      toggleSiteExpanded(site1Id);

      const { sites } = useEditorStore.getState();
      const site1 = sites.find((s) => s.id === site1Id);
      const site2 = sites.find((s) => s.id !== site1Id);

      expect(site1?.isExpanded).toBe(false);
      expect(site2?.isExpanded).toBe(true);
    });
  });

  describe('setSiteActiveTab', () => {
    it('changes site active tab', () => {
      const { addSite, setSiteActiveTab } = useEditorStore.getState();
      const siteId = addSite('Test Site');

      setSiteActiveTab(siteId, 'logs');

      const { sites } = useEditorStore.getState();
      expect(sites[0].activeTab).toBe('logs');
    });

    it('can switch to recommendations tab', () => {
      const { addSite, setSiteActiveTab } = useEditorStore.getState();
      const siteId = addSite('Test Site');

      setSiteActiveTab(siteId, 'recommendations');

      const { sites } = useEditorStore.getState();
      expect(sites[0].activeTab).toBe('recommendations');
    });

    it('only changes specified site tab', () => {
      const { addSite, setSiteActiveTab } = useEditorStore.getState();
      const site1Id = addSite('Site 1');
      addSite('Site 2');

      setSiteActiveTab(site1Id, 'logs');

      const { sites } = useEditorStore.getState();
      const site1 = sites.find((s) => s.id === site1Id);
      const site2 = sites.find((s) => s.id !== site1Id);

      expect(site1?.activeTab).toBe('logs');
      expect(site2?.activeTab).toBe('devices');
    });
  });
});
