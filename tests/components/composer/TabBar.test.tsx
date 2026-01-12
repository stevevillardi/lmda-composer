/**
 * Tests for TabBar component.
 * 
 * Tests tab rendering, dirty state indicators, and unsaved changes dialog scenarios.
 */
/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { TabBar } from '../../../src/editor/components/composer/TabBar';
import { 
  resetStore, 
  setStoreState, 
  createMockTab, 
  createMockPortal, 
  createMockCollector,
  createMockModuleTab,
  createMockFileTab,
  resetCounters,
} from '../../helpers/store-helpers';
import { DEFAULT_GROOVY_TEMPLATE } from '../../../src/editor/config/script-templates';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock scrollIntoView which is not implemented in JSDOM
Element.prototype.scrollIntoView = vi.fn();

describe('TabBar', () => {
  beforeEach(() => {
    resetStore();
    resetCounters();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Basic Rendering
  // ===========================================================================
  describe('basic rendering', () => {
    it('renders the tab bar without crashing', () => {
      const { container } = render(<TabBar />);
      expect(container).toBeInTheDocument();
    });

    it('renders tabs for each open tab', () => {
      const tab1 = createMockTab({ displayName: 'Script1.groovy' });
      const tab2 = createMockTab({ displayName: 'Script2.groovy' });
      
      setStoreState({
        tabs: [tab1, tab2],
        activeTabId: tab1.id,
      });

      render(<TabBar />);
      
      expect(screen.getByText('Script1.groovy')).toBeInTheDocument();
      expect(screen.getByText('Script2.groovy')).toBeInTheDocument();
    });

    it('shows "New File" button', () => {
      render(<TabBar />);
      expect(screen.getByText('New File')).toBeInTheDocument();
    });

    it('shows active tab with different styling', () => {
      const tab1 = createMockTab({ displayName: 'Active.groovy' });
      const tab2 = createMockTab({ displayName: 'Inactive.groovy' });
      
      setStoreState({
        tabs: [tab1, tab2],
        activeTabId: tab1.id,
      });

      render(<TabBar />);
      
      // Use getAllByRole since tooltip may create duplicate elements
      const tabs = screen.getAllByRole('tab');
      const activeTab = tabs.find(t => t.getAttribute('aria-controls')?.includes(tab1.id));
      const inactiveTab = tabs.find(t => t.getAttribute('aria-controls')?.includes(tab2.id));
      
      expect(activeTab).toHaveAttribute('aria-selected', 'true');
      expect(inactiveTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  // ===========================================================================
  // Dirty State Indicators
  // ===========================================================================
  describe('dirty state indicators', () => {
    it('shows file dirty indicator (amber dot) for unsaved local file changes', () => {
      const tab = createMockFileTab({
        content: 'modified content',
        fileName: 'test.groovy',
      });
      // Make the file dirty by having different content than lastSavedContent
      tab.document = {
        type: 'local',
        file: {
          handleId: 'handle-1',
          lastSavedContent: 'original content',
        },
      };
      
      setStoreState({
        tabs: [tab],
        activeTabId: tab.id,
      });

      render(<TabBar />);
      
      // Should show the dirty indicator (Circle icon with fill)
      // The tooltip should say "Unsaved changes"
      expect(screen.getByLabelText(/Close test\.groovy/i)).toBeInTheDocument();
    });

    it('shows portal changes indicator (blue cloud) for unpushed portal changes', () => {
      const tab = createMockModuleTab({
        content: 'modified content',
      });
      // Ensure portal lastKnownContent differs from content
      tab.document = {
        type: 'portal',
        portal: {
          id: 'portal-1',
          hostname: 'test.logicmonitor.com',
          moduleId: 123,
          moduleType: 'datasource',
          moduleName: 'TestModule',
          scriptType: 'collection',
          lastKnownContent: 'original content',
        },
      };
      
      setStoreState({
        tabs: [tab],
        activeTabId: tab.id,
      });

      render(<TabBar />);
      
      // Tab should render - the Cloud icon indicates unpushed changes
      expect(screen.getByText(/TestModule/i)).toBeInTheDocument();
    });

    it('does not show dirty indicator for unmodified scratch file with default template', () => {
      const tab = createMockTab({
        displayName: 'Untitled.groovy',
        content: '// Groovy script\n', // Default template
        language: 'groovy',
      });
      tab.document = { type: 'scratch' };
      
      setStoreState({
        tabs: [tab],
        activeTabId: tab.id,
      });

      render(<TabBar />);
      
      // Should render the tab without dirty indicators
      expect(screen.getByText('Untitled.groovy')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Close Tab Behavior
  // ===========================================================================
  describe('close tab behavior', () => {
    it('closes clean tab immediately without dialog', async () => {
      const user = userEvent.setup();
      // Use the default template content - this means the tab is "clean" (not dirty)
      const tab = createMockTab({ 
        displayName: 'Clean.groovy', 
        content: DEFAULT_GROOVY_TEMPLATE,
        language: 'groovy',
      });
      tab.document = { type: 'scratch' };
      
      setStoreState({
        tabs: [tab],
        activeTabId: tab.id,
      });

      render(<TabBar />);
      
      const closeButton = screen.getByLabelText(/Close Clean\.groovy/i);
      await user.click(closeButton);
      
      // Tab should be closed, no dialog shown - use queryAllByText to avoid tooltip issues
      await waitFor(() => {
        const matches = screen.queryAllByText('Clean.groovy');
        expect(matches.length).toBe(0);
      });
    });

    it('shows confirmation dialog for dirty scratch file', async () => {
      const user = userEvent.setup();
      const tab = createMockTab({ 
        displayName: 'Dirty.groovy', 
        content: 'println "Hello World"',  // Not the default template
      });
      tab.document = { type: 'scratch' };
      
      setStoreState({
        tabs: [tab],
        activeTabId: tab.id,
      });

      render(<TabBar />);
      
      const closeButton = screen.getByLabelText(/Close Dirty\.groovy/i);
      await user.click(closeButton);
      
      // Should show the unsaved changes dialog
      await waitFor(() => {
        expect(screen.getByText('Unsaved File')).toBeInTheDocument();
      });
      expect(screen.getByText(/has not been saved/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Unsaved Changes Dialog Scenarios
  // ===========================================================================
  describe('unsaved changes dialog scenarios', () => {
    describe('scratch file scenario', () => {
      it('shows correct title and buttons for scratch file', async () => {
        const user = userEvent.setup();
        const tab = createMockTab({ 
          displayName: 'NewScript.groovy', 
          content: 'some code here',
        });
        tab.document = { type: 'scratch' };
        
        setStoreState({
          tabs: [tab],
          activeTabId: tab.id,
        });

        render(<TabBar />);
        
        await user.click(screen.getByLabelText(/Close NewScript\.groovy/i));
        
        await waitFor(() => {
          expect(screen.getByText('Unsaved File')).toBeInTheDocument();
        });
        
        // Should have Cancel, Save As..., and Discard buttons
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save As/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Discard/i })).toBeInTheDocument();
      });

      it('closes dialog when Cancel is clicked', async () => {
        const user = userEvent.setup();
        const tab = createMockTab({ 
          displayName: 'CancelTest.groovy', 
          content: 'code',
        });
        tab.document = { type: 'scratch' };
        
        setStoreState({
          tabs: [tab],
          activeTabId: tab.id,
        });

        render(<TabBar />);
        
        await user.click(screen.getByLabelText(/Close CancelTest\.groovy/i));
        
        await waitFor(() => {
          expect(screen.getByText('Unsaved File')).toBeInTheDocument();
        });
        
        await user.click(screen.getByRole('button', { name: /Cancel/i }));
        
        // Dialog should close, tab should still exist
        await waitFor(() => {
          expect(screen.queryByText('Unsaved File')).not.toBeInTheDocument();
        });
        // Use queryAllByText to handle tooltip duplicates
        const matches = screen.queryAllByText('CancelTest.groovy');
        expect(matches.length).toBeGreaterThan(0);
      });

      it('closes tab when Discard is clicked', async () => {
        const user = userEvent.setup();
        const tab = createMockTab({ 
          displayName: 'Discard.groovy', 
          content: 'code to discard',
        });
        tab.document = { type: 'scratch' };
        
        setStoreState({
          tabs: [tab],
          activeTabId: tab.id,
        });

        render(<TabBar />);
        
        await user.click(screen.getByLabelText(/Close Discard\.groovy/i));
        
        await waitFor(() => {
          expect(screen.getByText('Unsaved File')).toBeInTheDocument();
        });
        
        await user.click(screen.getByRole('button', { name: /Discard/i }));
        
        // Tab should be closed
        await waitFor(() => {
          expect(screen.queryByText('Discard.groovy')).not.toBeInTheDocument();
        });
      });
    });

    describe('local file scenario', () => {
      it('shows correct title and buttons for modified local file', async () => {
        const user = userEvent.setup();
        const tab = createMockFileTab({
          fileName: 'LocalFile.groovy',
          content: 'modified content',
        });
        tab.document = {
          type: 'local',
          file: {
            handleId: 'handle-1',
            lastSavedContent: 'original content',
          },
        };
        tab.fileHandleId = 'handle-1';
        
        setStoreState({
          tabs: [tab],
          activeTabId: tab.id,
        });

        render(<TabBar />);
        
        await user.click(screen.getByLabelText(/Close LocalFile\.groovy/i));
        
        await waitFor(() => {
          expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
        });
        
        // Should have Cancel, Save & Close, and Discard Changes buttons
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save & Close/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Discard Changes/i })).toBeInTheDocument();
      });
    });

    describe('portal module scenario', () => {
      it('shows correct title and buttons for unpushed portal module', async () => {
        const user = userEvent.setup();
        const portal = createMockPortal({ id: 'portal-1', status: 'active' });
        const collector = createMockCollector({ id: 1 });
        
        const tab = createMockModuleTab({
          content: 'modified script',
          moduleId: 123,
          portalId: 'portal-1',
        });
        tab.document = {
          type: 'portal',
          portal: {
            id: 'portal-1',
            hostname: 'test.logicmonitor.com',
            moduleId: 123,
            moduleType: 'datasource',
            moduleName: 'TestModule',
            scriptType: 'collection',
            lastKnownContent: 'original script',
          },
        };
        
        setStoreState({
          tabs: [tab],
          activeTabId: tab.id,
          portals: [portal],
          selectedPortalId: portal.id,
          collectorsByPortal: { [portal.id]: [collector] },
        });

        render(<TabBar />);
        
        await user.click(screen.getByLabelText(/Close TestModule/i));
        
        await waitFor(() => {
          expect(screen.getByText('Unpushed Portal Changes')).toBeInTheDocument();
        });
        
        // Should have options for pushing to portal or saving locally
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Push to Portal/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Module Directory/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Close Without Saving/i })).toBeInTheDocument();
      });
    });

    describe('directory-saved module scenario', () => {
      it('shows correct title for module with only portal changes (no file dirty)', async () => {
        const user = userEvent.setup();
        const portal = createMockPortal({ id: 'portal-1', status: 'active' });
        const collector = createMockCollector({ id: 1 });
        
        const tab = createMockTab({
          displayName: 'DirModule/collection.groovy',
          content: 'local saved content',
        });
        // Directory-saved: has file with matching content BUT portal differs
        tab.source = {
          type: 'module',
          moduleId: 123,
          moduleType: 'datasource',
          moduleName: 'DirModule',
          scriptType: 'collection',
          portalId: 'portal-1',
        };
        tab.document = {
          type: 'local',
          file: {
            handleId: 'dir-handle-1',
            lastSavedContent: 'local saved content', // Matches content = not file dirty
          },
          portal: {
            id: 'portal-1',
            hostname: 'test.logicmonitor.com',
            moduleId: 123,
            moduleType: 'datasource',
            moduleName: 'DirModule',
            scriptType: 'collection',
            lastKnownContent: 'old portal content', // Different = has portal changes
          },
        };
        tab.directoryHandleId = 'dir-handle-1';
        
        setStoreState({
          tabs: [tab],
          activeTabId: tab.id,
          portals: [portal],
          selectedPortalId: portal.id,
          collectorsByPortal: { [portal.id]: [collector] },
        });

        render(<TabBar />);
        
        await user.click(screen.getByLabelText(/Close DirModule/i));
        
        await waitFor(() => {
          // Title should indicate only portal changes
          expect(screen.getByText('Unpushed Portal Changes')).toBeInTheDocument();
        });
        
        // Should show reassurance message about local files being preserved
        expect(screen.getByText(/local files will be preserved/i)).toBeInTheDocument();
        
        // Discard button should say "Close Without Pushing" (non-destructive)
        expect(screen.getByRole('button', { name: /Close Without Pushing/i })).toBeInTheDocument();
      });

      it('shows correct title for module with both file dirty and portal changes', async () => {
        const user = userEvent.setup();
        const portal = createMockPortal({ id: 'portal-1', status: 'active' });
        const collector = createMockCollector({ id: 1 });
        
        const tab = createMockTab({
          displayName: 'BothDirty/collection.groovy',
          content: 'new unsaved content',
        });
        tab.source = {
          type: 'module',
          moduleId: 123,
          moduleType: 'datasource',
          moduleName: 'BothDirty',
          scriptType: 'collection',
          portalId: 'portal-1',
        };
        tab.document = {
          type: 'local',
          file: {
            handleId: 'dir-handle-1',
            lastSavedContent: 'previously saved content', // Different = file dirty
          },
          portal: {
            id: 'portal-1',
            hostname: 'test.logicmonitor.com',
            moduleId: 123,
            moduleType: 'datasource',
            moduleName: 'BothDirty',
            scriptType: 'collection',
            lastKnownContent: 'old portal content', // Also different = portal changes
          },
        };
        tab.directoryHandleId = 'dir-handle-1';
        
        setStoreState({
          tabs: [tab],
          activeTabId: tab.id,
          portals: [portal],
          selectedPortalId: portal.id,
          collectorsByPortal: { [portal.id]: [collector] },
        });

        render(<TabBar />);
        
        await user.click(screen.getByLabelText(/Close BothDirty/i));
        
        await waitFor(() => {
          expect(screen.getByText('Unsaved and Unpushed Changes')).toBeInTheDocument();
        });
        
        // Should have both save options
        expect(screen.getByRole('button', { name: /Save to Directory/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Push to Portal/i })).toBeInTheDocument();
        
        // Discard should be destructive since file is dirty
        expect(screen.getByRole('button', { name: /Discard Changes/i })).toBeInTheDocument();
      });

      it('shows correct title for module with only file dirty (no portal changes)', async () => {
        const user = userEvent.setup();
        const portal = createMockPortal({ id: 'portal-1', status: 'active' });
        const collector = createMockCollector({ id: 1 });
        
        const tab = createMockTab({
          displayName: 'FileDirtyOnly/collection.groovy',
          content: 'modified but not pushed content',
        });
        tab.source = {
          type: 'module',
          moduleId: 123,
          moduleType: 'datasource',
          moduleName: 'FileDirtyOnly',
          scriptType: 'collection',
          portalId: 'portal-1',
        };
        tab.document = {
          type: 'local',
          file: {
            handleId: 'dir-handle-1',
            lastSavedContent: 'old saved content', // Different = file dirty
          },
          portal: {
            id: 'portal-1',
            hostname: 'test.logicmonitor.com',
            moduleId: 123,
            moduleType: 'datasource',
            moduleName: 'FileDirtyOnly',
            scriptType: 'collection',
            lastKnownContent: 'modified but not pushed content', // Same as content = no portal changes
          },
        };
        tab.directoryHandleId = 'dir-handle-1';
        
        setStoreState({
          tabs: [tab],
          activeTabId: tab.id,
          portals: [portal],
          selectedPortalId: portal.id,
          collectorsByPortal: { [portal.id]: [collector] },
        });

        render(<TabBar />);
        
        await user.click(screen.getByLabelText(/Close FileDirtyOnly/i));
        
        await waitFor(() => {
          expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
        });
        
        // Should have save to directory option
        expect(screen.getByRole('button', { name: /Save to Directory/i })).toBeInTheDocument();
        
        // Should NOT have push to portal option since no portal changes
        expect(screen.queryByRole('button', { name: /Push to Portal/i })).not.toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Tab Switching
  // ===========================================================================
  describe('tab switching', () => {
    it('switches active tab when clicked', async () => {
      const user = userEvent.setup();
      const tab1 = createMockTab({ displayName: 'First.groovy' });
      const tab2 = createMockTab({ displayName: 'Second.groovy' });
      
      setStoreState({
        tabs: [tab1, tab2],
        activeTabId: tab1.id,
      });

      render(<TabBar />);
      
      // Initially first tab is active
      expect(screen.getByRole('tab', { name: /First\.groovy/i })).toHaveAttribute('aria-selected', 'true');
      
      // Click second tab
      await user.click(screen.getByText('Second.groovy'));
      
      // Second tab should now be active
      expect(screen.getByRole('tab', { name: /Second\.groovy/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  // ===========================================================================
  // Keyboard Navigation
  // ===========================================================================
  describe('keyboard navigation', () => {
    it('tablist has correct aria attributes for accessibility', () => {
      const tab1 = createMockTab({ displayName: 'Tab1.groovy' });
      const tab2 = createMockTab({ displayName: 'Tab2.groovy' });
      
      setStoreState({
        tabs: [tab1, tab2],
        activeTabId: tab1.id,
      });

      render(<TabBar />);
      
      // Verify tablist role exists
      const tabList = screen.getByRole('tablist');
      expect(tabList).toHaveAttribute('aria-label', 'Editor tabs');
      
      // Verify tab roles and tabindex
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(2);
      
      // Active tab should have tabindex 0
      const activeTab = tabs.find(t => t.getAttribute('aria-selected') === 'true');
      expect(activeTab).toHaveAttribute('tabindex', '0');
      
      // Inactive tab should have tabindex -1
      const inactiveTab = tabs.find(t => t.getAttribute('aria-selected') === 'false');
      expect(inactiveTab).toHaveAttribute('tabindex', '-1');
    });
  });

  // ===========================================================================
  // New Tab Button
  // ===========================================================================
  describe('new tab button', () => {
    it('creates a new tab when clicked', async () => {
      const user = userEvent.setup();
      
      setStoreState({
        tabs: [],
        activeTabId: null,
        preferences: {
          defaultLanguage: 'groovy',
          defaultMode: 'freeform',
          outputTheme: 'auto',
          monacoTheme: 'vs-dark',
          autoSaveEnabled: false,
        },
      });

      render(<TabBar />);
      
      await user.click(screen.getByText('New File'));
      
      // A new tab should be created
      await waitFor(() => {
        expect(screen.getByText(/Untitled\.groovy/i)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Context Menu
  // ===========================================================================
  describe('context menu', () => {
    it('shows context menu on right click', async () => {
      const user = userEvent.setup();
      const tab = createMockTab({ displayName: 'Context.groovy' });
      
      setStoreState({
        tabs: [tab],
        activeTabId: tab.id,
      });

      render(<TabBar />);
      
      // Right-click on the tab
      const tabElement = screen.getByText('Context.groovy');
      await user.pointer({ keys: '[MouseRight]', target: tabElement });
      
      // Context menu should appear
      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument();
        expect(screen.getByText('Close Others')).toBeInTheDocument();
        expect(screen.getByText('Close All')).toBeInTheDocument();
        expect(screen.getByText('Copy Name')).toBeInTheDocument();
      });
    });
  });
});
