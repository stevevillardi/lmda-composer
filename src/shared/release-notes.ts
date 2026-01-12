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
    version: '1.5.0',
    date: 'January 2026',
    title: 'Create LogicModule Wizard',
    highlights: [
      'Create LogicModules with a guided wizard',
      'Status display names for datapoints',
      'Alert token templates support',
      'API Explorer documentation tab',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Create LogicModule Wizard - Build new modules directly from LMDA Composer with a guided multi-step workflow',
          'Support for all 7 module types: DataSource, ConfigSource, TopologySource, PropertySource, LogSource, EventSource, and DiagnosticSource',
          'Smart defaults per module type (exitCode datapoint, RetrievalCheck, alert settings, etc.)',
          'Option to initialize local module directory after portal creation',
          'Status Display Names - Translate numeric datapoint values to human-readable status strings',
          'Alert Message Templates - Use LogicMonitor tokens in alert subject and body fields',
          'API Explorer Docs tab - View endpoint documentation, parameters, and generate example requests',
        ],
      },
      {
        category: 'improved',
        items: [
          'Unsaved Changes dialog now shows context-specific actions based on document type',
          'Better button labels for portal-only vs local file scenarios',
          'Centralized toast notifications for consistency across the app',
          'Fixed race condition in portal tab validation',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Script stubs now consistent between portal creation and local saving',
          'Module creation error handling properly surfaces API errors',
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
    date: 'November 2025',
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
