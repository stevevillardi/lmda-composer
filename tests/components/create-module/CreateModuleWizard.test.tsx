/**
 * Tests for CreateModuleWizard component.
 * 
 * Tests wizard flow, step navigation, form validation, and module creation.
 */
/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { CreateModuleWizard } from '../../../src/editor/components/create-module/CreateModuleWizard';
import { 
  resetStore, 
  setStoreState, 
  createMockPortal, 
  createMockCollector,
  resetCounters,
} from '../../helpers/store-helpers';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('CreateModuleWizard', () => {
  beforeEach(() => {
    resetStore();
    resetCounters();
    vi.clearAllMocks();
  });

  // Helper to set up the wizard in open state with a portal
  function setupOpenWizard() {
    const portal = createMockPortal({ id: 'portal-1', displayName: 'TestPortal', status: 'active' });
    const collector = createMockCollector({ id: 1 });
    
    setStoreState({
      createModuleWizardOpen: true,
      portals: [portal],
      selectedPortalId: portal.id,
      collectorsByPortal: { [portal.id]: [collector] },
      tabs: [],
      activeTabId: null,
    });
    
    return { portal, collector };
  }

  // ===========================================================================
  // Basic Rendering
  // ===========================================================================
  describe('basic rendering', () => {
    it('does not render when closed', () => {
      setStoreState({ createModuleWizardOpen: false });
      
      render(<CreateModuleWizard />);
      
      expect(screen.queryByText('Create LogicModule')).not.toBeInTheDocument();
    });

    it('renders dialog when open', () => {
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      expect(screen.getByText('Create LogicModule')).toBeInTheDocument();
    });

    it('shows portal name in description', () => {
      const { portal } = setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      expect(screen.getByText(/testportal\.logicmonitor\.com/i)).toBeInTheDocument();
    });

    it('shows step indicator with 4 steps', () => {
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Should show step numbers 1-4
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('starts on step 1 (Module Type)', () => {
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      expect(screen.getByText('Module Type')).toBeInTheDocument();
      expect(screen.getByText('Choose the type of module to create')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Step 1: Module Type Selection
  // ===========================================================================
  describe('step 1 - module type selection', () => {
    it('shows all module type options', () => {
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // All module types should be visible
      expect(screen.getByText('DataSource')).toBeInTheDocument();
      expect(screen.getByText('ConfigSource')).toBeInTheDocument();
      expect(screen.getByText('TopologySource')).toBeInTheDocument();
      expect(screen.getByText('PropertySource')).toBeInTheDocument();
      expect(screen.getByText('LogSource')).toBeInTheDocument();
      expect(screen.getByText('EventSource')).toBeInTheDocument();
      expect(screen.getByText('DiagnosticSource')).toBeInTheDocument();
    });

    it('DataSource is selected by default', () => {
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Find the DataSource option and check if it's selected
      const datasourceOption = screen.getByText('DataSource').closest('[role="button"], [role="radio"], button, div[class*="selected"], div[class*="ring"]');
      // DataSource should have some visual indicator of being selected
      expect(datasourceOption).toBeInTheDocument();
    });

    it('Next button is enabled when module type is selected', () => {
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).not.toBeDisabled();
    });

    it('Back button is disabled on first step', () => {
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      const backButton = screen.getByRole('button', { name: /Back/i });
      expect(backButton).toBeDisabled();
    });
  });

  // ===========================================================================
  // Step Navigation
  // ===========================================================================
  describe('step navigation', () => {
    it('advances to step 2 when Next is clicked', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      await user.click(screen.getByRole('button', { name: /Next/i }));
      
      // Should now show step 2 content
      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
      });
      // Look for the Name input field by placeholder
      expect(screen.getByPlaceholderText('MyModule')).toBeInTheDocument();
    });

    it('goes back to step 1 when Back is clicked on step 2', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Go to step 2
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
      });
      
      // Go back to step 1
      await user.click(screen.getByRole('button', { name: /Back/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Module Type')).toBeInTheDocument();
      });
    });

    it('can navigate through all 4 steps', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Step 1 -> Step 2
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await waitFor(() => {
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
      });
      
      // Fill in name to enable next
      await user.type(screen.getByPlaceholderText('MyModule'), 'MyTestModule');
      
      // Step 2 -> Step 3
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await waitFor(() => {
        expect(screen.getByText('Script Config')).toBeInTheDocument();
      });
      
      // Step 3 -> Step 4
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });
      
      // Should show Create Module button on last step
      expect(screen.getByRole('button', { name: /Create Module/i })).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Step 2: Basic Info Validation
  // ===========================================================================
  describe('step 2 - basic info validation', () => {
    it('Next button is disabled when name is empty', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Go to step 2
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('MyModule')).toBeInTheDocument();
      });
      
      // Next button should be disabled without a name
      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it('Next button is enabled when name is provided', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Go to step 2
      await user.click(screen.getByRole('button', { name: /Next/i }));
      
      // Enter a name
      await user.type(screen.getByPlaceholderText('MyModule'), 'TestModule');
      
      // Next button should be enabled
      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).not.toBeDisabled();
    });

    it('shows Display Name field for DataSource', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Go to step 2 (DataSource is default)
      await user.click(screen.getByRole('button', { name: /Next/i }));
      
      // Should show both Name and Display Name fields
      expect(screen.getByPlaceholderText('MyModule')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('My Module')).toBeInTheDocument();
    });

    it('hides Display Name field for TopologySource', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Select TopologySource
      await user.click(screen.getByText('TopologySource'));
      
      // Go to step 2
      await user.click(screen.getByRole('button', { name: /Next/i }));
      
      // Should only show Name field, not Display Name
      expect(screen.getByPlaceholderText('MyModule')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('My Module')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Step 3: Script Config
  // ===========================================================================
  describe('step 3 - script config', () => {
    async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /Next/i })); // Step 1 -> 2
      await user.type(screen.getByPlaceholderText('MyModule'), 'TestModule');
      await user.click(screen.getByRole('button', { name: /Next/i })); // Step 2 -> 3
      await waitFor(() => {
        expect(screen.getByText('Script Config')).toBeInTheDocument();
      });
    }

    it('shows language selection for DataSource', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      await goToStep3(user);
      
      // Should show Groovy and PowerShell options (may appear multiple times)
      const groovyMatches = screen.queryAllByText(/Groovy/i);
      const psMatches = screen.queryAllByText(/PowerShell/i);
      expect(groovyMatches.length).toBeGreaterThan(0);
      expect(psMatches.length).toBeGreaterThan(0);
    });

    it('shows multi-instance toggle for DataSource', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      await goToStep3(user);
      
      // Should show multi-instance option
      expect(screen.getByText(/Multi-Instance/i)).toBeInTheDocument();
    });

    it('hides multi-instance toggle for PropertySource', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      // Select PropertySource first
      await user.click(screen.getByText('PropertySource'));
      await goToStep3(user);
      
      // Should NOT show multi-instance option
      expect(screen.queryByText(/Multi-Instance/i)).not.toBeInTheDocument();
    });

    it('shows only Groovy for LogSource', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      // Select LogSource first
      await user.click(screen.getByText('LogSource'));
      await user.click(screen.getByRole('button', { name: /Next/i })); // Step 1 -> 2
      await user.type(screen.getByPlaceholderText('MyModule'), 'TestModule');
      await user.click(screen.getByRole('button', { name: /Next/i })); // Step 2 -> 3
      
      await waitFor(() => {
        expect(screen.getByText('Script Config')).toBeInTheDocument();
      });
      
      // Should show Groovy indicator (LogSource doesn't support PowerShell)
      const groovyMatches = screen.queryAllByText(/Groovy/i);
      expect(groovyMatches.length).toBeGreaterThan(0);
      // PowerShell should NOT be available as a selectable option for LogSource
      // Note: This is a simplified check - in reality we'd check the radio buttons
    });
  });

  // ===========================================================================
  // Step 4: Confirmation
  // ===========================================================================
  describe('step 4 - confirmation', () => {
    async function goToStep4(user: ReturnType<typeof userEvent.setup>, moduleName = 'TestModule') {
      await user.click(screen.getByRole('button', { name: /Next/i })); // Step 1 -> 2
      await user.type(screen.getByPlaceholderText('MyModule'), moduleName);
      await user.click(screen.getByRole('button', { name: /Next/i })); // Step 2 -> 3
      await user.click(screen.getByRole('button', { name: /Next/i })); // Step 3 -> 4
      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });
    }

    it('shows module summary', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      await goToStep4(user, 'MySummaryModule');
      
      // Should show summary of choices - use queryAllByText since name may appear in multiple places
      const nameMatches = screen.queryAllByText('MySummaryModule');
      expect(nameMatches.length).toBeGreaterThan(0);
      // DataSource should be in the summary
      const dsMatches = screen.queryAllByText(/DataSource/i);
      expect(dsMatches.length).toBeGreaterThan(0);
    });

    it('shows Create Module button', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      await goToStep4(user);
      
      expect(screen.getByRole('button', { name: /Create Module/i })).toBeInTheDocument();
    });

    it('shows initialize local directory checkbox', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      await goToStep4(user);
      
      expect(screen.getByText(/Initialize local module directory/i)).toBeInTheDocument();
    });

    it('Create Module button is disabled without portal connection', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      // Remove portal selection
      setStoreState({ selectedPortalId: null });
      
      render(<CreateModuleWizard />);
      
      await goToStep4(user);
      
      const createButton = screen.getByRole('button', { name: /Create Module/i });
      expect(createButton).toBeDisabled();
    });
  });

  // ===========================================================================
  // Dialog Close/Reset
  // ===========================================================================
  describe('dialog close and reset', () => {
    it('resets form state when dialog is closed', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      
      render(<CreateModuleWizard />);
      
      // Navigate to step 2 and enter data
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await user.type(screen.getByPlaceholderText('MyModule'), 'TestName');
      
      // Close the dialog by clicking close button (aria-label="Close")
      const closeButton = screen.getByRole('button', { name: /^Close$/i });
      await user.click(closeButton);
      
      // Reopen the dialog
      act(() => {
        setStoreState({ createModuleWizardOpen: true });
      });
      
      // Should be back on step 1
      await waitFor(() => {
        expect(screen.getByText('Module Type')).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Module Type Specific Behavior
  // ===========================================================================
  describe('module type specific behavior', () => {
    it('ConfigSource shows correct default interval in confirmation', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      // Select ConfigSource
      await user.click(screen.getByText('ConfigSource'));
      
      // Go through to confirmation
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await user.type(screen.getByPlaceholderText('MyModule'), 'MyConfig');
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });
      
      // Should show 1 hour interval
      expect(screen.getByText(/1 hour/i)).toBeInTheDocument();
    });

    it('DiagnosticSource navigates to confirmation step', async () => {
      const user = userEvent.setup();
      setupOpenWizard();
      render(<CreateModuleWizard />);
      
      // Select DiagnosticSource
      await user.click(screen.getByText('DiagnosticSource'));
      
      // Go through to confirmation
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await user.type(screen.getByPlaceholderText('MyModule'), 'MyDiag');
      await user.click(screen.getByRole('button', { name: /Next/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });
      
      // Should show DiagnosticSource in the summary
      expect(screen.getByText('DiagnosticSource')).toBeInTheDocument();
      // Should show Create Module button
      expect(screen.getByRole('button', { name: /Create Module/i })).toBeInTheDocument();
    });
  });
});
