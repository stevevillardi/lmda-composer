/**
 * Tests for ReleaseNotesDialog component.
 * 
 * Tests dialog rendering, content display, and dismiss behavior.
 */
/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ReleaseNotesDialog } from '../../../src/editor/components/shared/ReleaseNotesDialog';
import { 
  resetStore, 
  setStoreState,
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

// Mock release notes data
vi.mock('@/shared/release-notes', () => ({
  getLatestRelease: vi.fn(() => ({
    version: '1.5.0',
    date: 'January 2026',
    title: 'Create LogicModule Wizard and More',
    highlights: [
      'Create new LogicModules directly from the extension',
      'Status Display Names for datapoints',
      'Alert Token templates',
    ],
    changes: [
      {
        category: 'added',
        items: ['Create LogicModule wizard', 'Status Display Names'],
      },
      {
        category: 'improved',
        items: ['Better error messages'],
      },
      {
        category: 'fixed',
        items: ['Fixed save dialog issue'],
      },
    ],
  })),
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('ReleaseNotesDialog', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    resetStore();
    resetCounters();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Basic Rendering
  // ===========================================================================
  describe('basic rendering', () => {
    it('does not render when releaseNotesOpen is false', () => {
      setStoreState({ releaseNotesOpen: false });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      expect(screen.queryByText("What's New")).not.toBeInTheDocument();
    });

    it('renders dialog when releaseNotesOpen is true', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    it('shows version badge', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      expect(screen.getByText('v1.5.0')).toBeInTheDocument();
    });

    it('shows release date', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      expect(screen.getByText('January 2026')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Content Display
  // ===========================================================================
  describe('content display', () => {
    it('displays release title', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      expect(screen.getByText('Create LogicModule Wizard and More')).toBeInTheDocument();
    });

    it('displays all highlights', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      expect(screen.getByText('Create new LogicModules directly from the extension')).toBeInTheDocument();
      expect(screen.getByText('Status Display Names for datapoints')).toBeInTheDocument();
      expect(screen.getByText('Alert Token templates')).toBeInTheDocument();
    });

    it('displays categorized changes', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      // Category headers
      expect(screen.getByText('Added')).toBeInTheDocument();
      expect(screen.getByText('Improved')).toBeInTheDocument();
      expect(screen.getByText('Fixed')).toBeInTheDocument();
      
      // Individual items
      expect(screen.getByText('Create LogicModule wizard')).toBeInTheDocument();
      expect(screen.getByText('Better error messages')).toBeInTheDocument();
      expect(screen.getByText('Fixed save dialog issue')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Footer Links and Buttons
  // ===========================================================================
  describe('footer', () => {
    it('shows changelog link', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      const link = screen.getByText('View full changelog');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href');
    });

    it('shows Got it button', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Dismiss Behavior
  // ===========================================================================
  describe('dismiss behavior', () => {
    it('calls onDismiss when Got it button is clicked', async () => {
      const user = userEvent.setup();
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      await user.click(screen.getByRole('button', { name: /Got it/i }));
      
      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('closes dialog when Got it button is clicked', async () => {
      const user = userEvent.setup();
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      await user.click(screen.getByRole('button', { name: /Got it/i }));
      
      await waitFor(() => {
        expect(screen.queryByText("What's New")).not.toBeInTheDocument();
      });
    });

    it('calls onDismiss when dialog is closed via close button', async () => {
      const user = userEvent.setup();
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      // Click the close button (X)
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);
      
      expect(mockOnDismiss).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Accessibility
  // ===========================================================================
  describe('accessibility', () => {
    it('dialog has proper aria attributes', () => {
      setStoreState({ releaseNotesOpen: true });
      
      render(<ReleaseNotesDialog onDismiss={mockOnDismiss} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
  });
});
