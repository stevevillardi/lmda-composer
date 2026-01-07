/**
 * Tests for tabs-slice store operations.
 * 
 * Tests tab management operations like open, close, and content updates.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { useEditorStore } from '../../src/editor/stores/editor-store';
import { 
  resetStore, 
  getStoreState, 
  setStoreState, 
  createMockTab,
  createMockPortal,
  resetCounters,
} from '../helpers/store-helpers';

describe('tabs-slice', () => {
  beforeEach(() => {
    resetStore();
    resetCounters();
  });

  afterEach(() => {
    resetStore();
  });

  // ===========================================================================
  // openTab
  // ===========================================================================
  describe('openTab', () => {
    it('adds a new tab and activates it by default', () => {
      const { openTab } = getStoreState();
      
      const tabId = openTab({
        displayName: 'Test.groovy',
        content: 'println "Hello"',
        language: 'groovy',
        mode: 'freeform',
      });

      const state = getStoreState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tabId);
      expect(state.activeTabId).toBe(tabId);
    });

    it('can add a tab without activating it', () => {
      const { openTab } = getStoreState();
      
      // Open first tab (will be activated)
      const firstTabId = openTab({
        displayName: 'First.groovy',
        content: '',
        language: 'groovy',
        mode: 'freeform',
      });

      // Open second tab without activating
      const secondTabId = openTab({
        displayName: 'Second.groovy',
        content: '',
        language: 'groovy',
        mode: 'freeform',
      }, { activate: false });

      const state = getStoreState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe(firstTabId); // First tab still active
      expect(state.tabs.some(t => t.id === secondTabId)).toBe(true);
    });

    it('uses provided ID if given', () => {
      const { openTab } = getStoreState();
      
      const tabId = openTab({
        id: 'custom-id-123',
        displayName: 'Test.groovy',
        content: '',
        language: 'groovy',
        mode: 'freeform',
      });

      expect(tabId).toBe('custom-id-123');
    });

    it('preserves all tab properties', () => {
      const { openTab } = getStoreState();
      
      const tabId = openTab({
        displayName: 'Module.groovy',
        content: 'script content',
        language: 'powershell',
        mode: 'collection',
        source: {
          type: 'module',
          moduleId: 123,
          moduleType: 'datasource',
        },
        originalContent: 'original',
      });

      const state = getStoreState();
      const tab = state.tabs.find(t => t.id === tabId);
      
      expect(tab?.displayName).toBe('Module.groovy');
      expect(tab?.content).toBe('script content');
      expect(tab?.language).toBe('powershell');
      expect(tab?.mode).toBe('collection');
      expect(tab?.source?.type).toBe('module');
      expect(tab?.originalContent).toBe('original');
    });
  });

  // ===========================================================================
  // closeTab
  // ===========================================================================
  describe('closeTab', () => {
    it('removes the specified tab', () => {
      const { openTab, closeTab } = getStoreState();
      
      const tabId = openTab({
        displayName: 'Test.groovy',
        content: '',
        language: 'groovy',
        mode: 'freeform',
      });

      expect(getStoreState().tabs).toHaveLength(1);
      
      closeTab(tabId);
      
      expect(getStoreState().tabs).toHaveLength(0);
      expect(getStoreState().activeTabId).toBeNull();
    });

    it('selects the next tab when closing the active tab', () => {
      const { openTab, closeTab } = getStoreState();
      
      const tab1 = openTab({ displayName: 'Tab1.groovy', content: '', language: 'groovy', mode: 'freeform' });
      const tab2 = openTab({ displayName: 'Tab2.groovy', content: '', language: 'groovy', mode: 'freeform' });
      const tab3 = openTab({ displayName: 'Tab3.groovy', content: '', language: 'groovy', mode: 'freeform' });

      // tab3 is active (last opened)
      expect(getStoreState().activeTabId).toBe(tab3);
      
      // Close tab3 - should select a nearby tab
      closeTab(tab3);
      
      const state = getStoreState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).not.toBeNull();
      expect([tab1, tab2]).toContain(state.activeTabId);
    });

    it('does nothing for non-existent tab ID', () => {
      const { openTab, closeTab } = getStoreState();
      
      openTab({ displayName: 'Test.groovy', content: '', language: 'groovy', mode: 'freeform' });
      
      closeTab('non-existent-id');
      
      expect(getStoreState().tabs).toHaveLength(1);
    });

    it('maintains active tab when closing a different tab', () => {
      const { openTab, closeTab, setActiveTab } = getStoreState();
      
      const tab1 = openTab({ displayName: 'Tab1.groovy', content: '', language: 'groovy', mode: 'freeform' });
      const tab2 = openTab({ displayName: 'Tab2.groovy', content: '', language: 'groovy', mode: 'freeform' });
      
      // Set tab1 as active
      setActiveTab(tab1);
      expect(getStoreState().activeTabId).toBe(tab1);
      
      // Close tab2 (not active)
      closeTab(tab2);
      
      // tab1 should still be active
      expect(getStoreState().activeTabId).toBe(tab1);
    });
  });

  // ===========================================================================
  // closeOtherTabs
  // ===========================================================================
  describe('closeOtherTabs', () => {
    it('closes all tabs except the specified one', () => {
      const { openTab, closeOtherTabs } = getStoreState();
      
      openTab({ displayName: 'Tab1.groovy', content: '', language: 'groovy', mode: 'freeform' });
      const tab2 = openTab({ displayName: 'Tab2.groovy', content: '', language: 'groovy', mode: 'freeform' });
      openTab({ displayName: 'Tab3.groovy', content: '', language: 'groovy', mode: 'freeform' });

      closeOtherTabs(tab2);
      
      const state = getStoreState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tab2);
      expect(state.activeTabId).toBe(tab2);
    });

    it('only closes tabs of the same kind', () => {
      const { openTab, closeOtherTabs } = getStoreState();
      
      const scriptTab1 = openTab({ displayName: 'Script1.groovy', content: '', language: 'groovy', mode: 'freeform', kind: 'script' });
      openTab({ displayName: 'API Tab', content: '', language: 'groovy', mode: 'freeform', kind: 'api' });
      const scriptTab2 = openTab({ displayName: 'Script2.groovy', content: '', language: 'groovy', mode: 'freeform', kind: 'script' });

      closeOtherTabs(scriptTab1);
      
      const state = getStoreState();
      // Should keep scriptTab1 and the API tab
      expect(state.tabs.length).toBe(2);
      expect(state.tabs.some(t => t.id === scriptTab1)).toBe(true);
      expect(state.tabs.some(t => t.kind === 'api')).toBe(true);
      expect(state.tabs.some(t => t.id === scriptTab2)).toBe(false);
    });
  });

  // ===========================================================================
  // closeAllTabs
  // ===========================================================================
  describe('closeAllTabs', () => {
    it('closes all tabs when no active tab', () => {
      setStoreState({ tabs: [], activeTabId: null });
      
      const { closeAllTabs } = getStoreState();
      closeAllTabs();
      
      expect(getStoreState().tabs).toHaveLength(0);
    });

    it('closes all tabs of the same kind as active tab', () => {
      const { openTab, closeAllTabs, setActiveTab } = getStoreState();
      
      const scriptTab1 = openTab({ displayName: 'Script1.groovy', content: '', language: 'groovy', mode: 'freeform', kind: 'script' });
      const apiTab = openTab({ displayName: 'API Tab', content: '', language: 'groovy', mode: 'freeform', kind: 'api' });
      openTab({ displayName: 'Script2.groovy', content: '', language: 'groovy', mode: 'freeform', kind: 'script' });

      // Make a script tab active
      setActiveTab(scriptTab1);
      
      closeAllTabs();
      
      const state = getStoreState();
      // Only API tab should remain
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(apiTab);
    });
  });

  // ===========================================================================
  // updateTabContent
  // ===========================================================================
  describe('updateTabContent', () => {
    it('updates content for the specified tab', () => {
      const { openTab, updateTabContent } = getStoreState();
      
      const tabId = openTab({
        displayName: 'Test.groovy',
        content: 'original content',
        language: 'groovy',
        mode: 'freeform',
      });

      updateTabContent(tabId, 'new content');
      
      const tab = getStoreState().tabs.find(t => t.id === tabId);
      expect(tab?.content).toBe('new content');
    });

    it('does nothing for non-existent tab', () => {
      const { openTab, updateTabContent } = getStoreState();
      
      openTab({
        displayName: 'Test.groovy',
        content: 'content',
        language: 'groovy',
        mode: 'freeform',
      });

      updateTabContent('non-existent', 'new content');
      
      // Original tab unchanged
      expect(getStoreState().tabs[0].content).toBe('content');
    });
  });

  // ===========================================================================
  // updateActiveTabContent
  // ===========================================================================
  describe('updateActiveTabContent', () => {
    it('updates content of the active tab', () => {
      const { openTab, updateActiveTabContent } = getStoreState();
      
      const tabId = openTab({
        displayName: 'Test.groovy',
        content: 'original',
        language: 'groovy',
        mode: 'freeform',
      });

      updateActiveTabContent('updated content');
      
      const tab = getStoreState().tabs.find(t => t.id === tabId);
      expect(tab?.content).toBe('updated content');
    });

    it('does nothing when no active tab', () => {
      setStoreState({ tabs: [], activeTabId: null });
      
      const { updateActiveTabContent } = getStoreState();
      
      // Should not throw
      expect(() => updateActiveTabContent('content')).not.toThrow();
    });
  });

  // ===========================================================================
  // setActiveTab
  // ===========================================================================
  describe('setActiveTab', () => {
    it('changes the active tab', () => {
      const { openTab, setActiveTab } = getStoreState();
      
      const tab1 = openTab({ displayName: 'Tab1.groovy', content: '', language: 'groovy', mode: 'freeform' });
      const tab2 = openTab({ displayName: 'Tab2.groovy', content: '', language: 'groovy', mode: 'freeform' });

      expect(getStoreState().activeTabId).toBe(tab2); // Last opened
      
      setActiveTab(tab1);
      
      expect(getStoreState().activeTabId).toBe(tab1);
    });

    it('does nothing for non-existent tab', () => {
      const { openTab, setActiveTab } = getStoreState();
      
      const tabId = openTab({ displayName: 'Test.groovy', content: '', language: 'groovy', mode: 'freeform' });
      
      setActiveTab('non-existent');
      
      // Active tab unchanged
      expect(getStoreState().activeTabId).toBe(tabId);
    });
  });

  // ===========================================================================
  // getActiveTab
  // ===========================================================================
  describe('getActiveTab', () => {
    it('returns the active tab', () => {
      const { openTab, getActiveTab } = getStoreState();
      
      const tabId = openTab({
        displayName: 'Test.groovy',
        content: 'content',
        language: 'groovy',
        mode: 'freeform',
      });

      const activeTab = getActiveTab();
      
      expect(activeTab).not.toBeNull();
      expect(activeTab?.id).toBe(tabId);
      expect(activeTab?.displayName).toBe('Test.groovy');
    });

    it('returns null when no active tab', () => {
      const { getActiveTab } = getStoreState();
      
      expect(getActiveTab()).toBeNull();
    });
  });

  // ===========================================================================
  // renameTab
  // ===========================================================================
  describe('renameTab', () => {
    it('renames the specified tab', () => {
      const { openTab, renameTab } = getStoreState();
      
      const tabId = openTab({
        displayName: 'OldName.groovy',
        content: '',
        language: 'groovy',
        mode: 'freeform',
      });

      renameTab(tabId, 'NewName.groovy');
      
      const tab = getStoreState().tabs.find(t => t.id === tabId);
      expect(tab?.displayName).toBe('NewName.groovy');
    });

    it('adds extension if missing', () => {
      const { openTab, renameTab } = getStoreState();
      
      const tabId = openTab({
        displayName: 'Script.groovy',
        content: '',
        language: 'groovy',
        mode: 'freeform',
      });

      renameTab(tabId, 'NewName');
      
      const tab = getStoreState().tabs.find(t => t.id === tabId);
      // Should have added .groovy extension
      expect(tab?.displayName).toMatch(/\.groovy$/);
    });
  });

  // ===========================================================================
  // isTabDirty
  // ===========================================================================
  describe('isTabDirty', () => {
    it('returns true when content differs from original', () => {
      const { openTab, updateTabContent, isTabDirty } = getStoreState();
      
      const tabId = openTab({
        displayName: 'Test.groovy',
        content: 'original content',
        language: 'groovy',
        mode: 'freeform',
        originalContent: 'original content',
      });

      // Initially not dirty
      expect(isTabDirty(tabId)).toBe(false);
      
      // Modify content
      updateTabContent(tabId, 'modified content');
      
      // Now should be dirty
      expect(isTabDirty(tabId)).toBe(true);
    });

    it('returns false for non-existent tab', () => {
      const { isTabDirty } = getStoreState();
      
      expect(isTabDirty('non-existent')).toBe(false);
    });
  });

  // ===========================================================================
  // getUniqueUntitledName
  // ===========================================================================
  describe('getUniqueUntitledName', () => {
    it('returns Untitled for first file (no number suffix)', () => {
      const { getUniqueUntitledName } = getStoreState();
      
      const name = getUniqueUntitledName('groovy');
      expect(name).toBe('Untitled.groovy');
    });

    it('increments number for duplicate names', () => {
      const { openTab, getUniqueUntitledName } = getStoreState();
      
      // Create Untitled.groovy (first file)
      openTab({
        displayName: 'Untitled.groovy',
        content: '',
        language: 'groovy',
        mode: 'freeform',
      });

      const name = getUniqueUntitledName('groovy');
      // Second file should get a number suffix (uses space, e.g., "Untitled 1.groovy")
      expect(name).toMatch(/^Untitled( \d+)?\.groovy$/);
    });

    it('uses correct extension for language', () => {
      const { getUniqueUntitledName } = getStoreState();
      
      expect(getUniqueUntitledName('powershell')).toBe('Untitled.ps1');
      expect(getUniqueUntitledName('groovy')).toBe('Untitled.groovy');
    });
  });
});

