/**
 * Release notes data shared between the editor (modal) and onboarding page.
 * 
 * Update this file when releasing new versions to show users what's new.
 */

export interface ReleaseChange {
  category: 'added' | 'improved' | 'fixed';
  items: string[];
}

export interface ReleaseNote {
  /** Semantic version string, e.g. "1.5.0" */
  version: string;
  /** Human-readable date, e.g. "January 2026" */
  date: string;
  /** Short title for the release */
  title: string;
  /** Key highlights shown prominently (3-4 items max) */
  highlights: string[];
  /** Detailed changes grouped by category */
  changes: ReleaseChange[];
}

/**
 * Release notes ordered by version (newest first).
 * The first entry is considered the "latest" release.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.7.4',
    date: 'February 2026',
    title: 'Workspace Switching Bug Fixes',
    highlights: [
      'Fixed API Explorer to Script Editor switching when no script tabs are open',
      'Unified workspace switching behavior across Actions menu, Collector Sizing, and keyboard navigation',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Switching from API Explorer to Script Editor now correctly shows the Script welcome screen when no script tabs exist',
          'Collector Sizing workspace switching now consistently restores the most recent tab for the selected workspace',
          'Resolved view-toggle edge cases where workspace switches could appear to do nothing',
        ],
      },
      {
        category: 'improved',
        items: [
          'Centralized workspace/tab switching logic to keep dropdown actions, command palette, and keyboard shortcuts in sync',
        ],
      },
    ],
  },
  {
    version: '1.7.3',
    date: 'February 2026',
    title: 'Bug Fixes & Enhancements',
    highlights: [
      'Redesigned API Explorer layout to work more consistently across different chrome engines',
      'Multi file editor improvements',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Script output is now tied to the active script tab, not the entire editor',
        ],
      },
      {
        category: 'fixed',
        items: [
          'API Explorer layout not working consistently across different chrome engines',
        ],
      },
    ],
  },
    {
    version: '1.7.2',
    date: 'February 2026',
    title: 'Bug Fixes',
    highlights: [
      'Fixed issue with certain browser versions not being able to resize panels',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed issue with certain browser versions not being able to resize panels',
        ],
      },
    ],
  },
  {
    version: '1.7.1',
    date: 'January 2026',
    title: 'Bug Fixes & Performance',
    highlights: [
      'Faster portal discovery with multiple browser tabs',
      'Loading indicator when detecting portals',
      'Fixed Collector Sizing context menu',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Portal discovery is now significantly faster, especially with many open tabs',
          'Loading spinner shows when portal detection is in progress',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Collector Sizing workspace context menu not appearing',
        ],
      },
    ],
  },
  {
    version: '1.7.0',
    date: 'January 2026',
    title: 'Collector Sizing Calculator',
    highlights: [
      'Collector Sizing Calculator for estimating hardware requirements',
      'Multi-site support with device, log, and NetFlow configurations',
      'Automatic collector recommendations from SMALL to XXL',
      'Fixed portal discovery hanging on multi-profile Chrome',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Collector Sizing Calculator - Estimate optimal collector configurations across multiple sites',
          'Device categories with pre-configured instance counts and collection method weights',
          'Log sources configuration for System Logs, SNMP Traps, and NetFlow',
          'Automatic collector size recommendations based on load calculations',
          'Data ingestion estimates (GB/day) for logs and NetFlow',
          'Aggregated overview panel showing totals across all sites',
          'Customizable method weights, collector capacities, and device defaults',
          'Persistent state - configurations saved automatically',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Portal discovery hanging on multi-profile Chrome - Added timeout protection',
        ],
      },
    ],
  },
  {
    version: '1.6.0',
    date: 'January 2026',
    title: 'LogSource Editing & Enhanced Search',
    highlights: [
      'Full LogSource editing: Filters, Log Fields, and Resource Mappings',
      'Redesigned Health Check reports with inline AppliesTo testing',
      'Expanded datapoint search across all DataSource types',
      'Save wizard-created modules as local directories',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LogSource editing - Add and edit Filters, Log Fields, and Resource Mappings in Module Details',
          'Sync support for LogSource configurations during push/pull operations',
          'Save wizard-created modules as local directories for Git-friendly workflows',
          'In-app release notes dialog shows what\'s new after updates',
          'Inline AppliesTo testing directly from Health Check report queries',
          'Datapoint search now includes all DataSource types (SNMP, WMI, etc.), not just scripted modules',
          'Match indicators show whether datapoint results matched by name or description',
          'Direct links to LogicMonitor Exchange from search results',
        ],
      },
      {
        category: 'improved',
        items: [
          'Redesigned Health Check report with modern styling and better data visualization',
          'Enhanced Debug Commands dialog with improved layout and collector selection',
          'Refreshed Welcome Screens with streamlined actions and clearer workflows',
          'Better unsaved changes dialog wording for clarity',
          'Consistent button styling throughout UI',
          'Validation for displayNames containing hyphens in DataSource and ConfigSource',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Race conditions with tab state resolved for more reliable navigation',
          'Module search indexing includes all module types for comprehensive datapoint search',
          'Fixed missing API details for ConfigCheck push/pull operations',
        ],
      },
    ],
  },
  {
    version: '1.5.0',
    date: 'January 2026',
    title: 'Create LogicModule Wizard & API Explorer Docs',
    highlights: [
      'Create LogicModules with a guided wizard',
      'API Explorer Docs tab with endpoint documentation',
      'Status Display Names for datapoints',
      'Alert Message Templates with token support',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Create LogicModule Wizard - Build new modules with a guided multi-step workflow supporting all 7 module types',
          'Status Display Names - Translate numeric values to human-readable status strings',
          'Alert Message Templates with LogicMonitor token support',
          'API Explorer Docs tab with endpoint documentation and example generation',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed issue with logged out stale accounts',
          'UI improvements for cursor interactions',
        ],
      },
    ],
  },
  {
    version: '1.4.1',
    date: 'December 2025',
    title: 'Bug Fixes & Improvements',
    highlights: [
      'Improved module details editing',
      'Better error handling for API calls',
      'Performance optimizations',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Module details now refresh after commit',
          'Better handling of large module lists',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed issue with module search not finding all results',
          'Resolved edge case in draft restoration',
        ],
      },
    ],
  },
  {
    version: '1.4.0',
    date: 'December 2025',
    title: 'Module Details & Datapoints',
    highlights: [
      'Edit module details directly in LMDA Composer',
      'Datapoint configuration with thresholds',
      'ConfigCheck editing for ConfigSources',
      'Module lineage history viewer',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Module Details panel for editing module properties',
          'Datapoint editor with threshold configuration',
          'ConfigCheck editor for ConfigSource modules',
          'Module lineage dialog to view and restore historical versions',
          'Pull latest from portal to sync changes',
        ],
      },
      {
        category: 'improved',
        items: [
          'Enhanced module browser with preview panel',
          'Better search across module scripts and datapoints',
        ],
      },
    ],
  },
];

/**
 * Get the latest release notes (first entry in the array).
 */
export function getLatestRelease(): ReleaseNote | undefined {
  return RELEASE_NOTES[0];
}

/**
 * Get release notes for a specific version.
 */
export function getReleaseByVersion(version: string): ReleaseNote | undefined {
  return RELEASE_NOTES.find((r) => r.version === version);
}

/**
 * Get all releases newer than a given version.
 * Useful for showing what changed when user skipped multiple updates.
 */
export function getReleasesNewerThan(version: string): ReleaseNote[] {
  const index = RELEASE_NOTES.findIndex((r) => r.version === version);
  if (index === -1) {
    // Version not found, return all releases
    return RELEASE_NOTES;
  }
  // Return all releases before the found version (newer ones)
  return RELEASE_NOTES.slice(0, index);
}
