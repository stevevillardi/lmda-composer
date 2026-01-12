/**
 * Centralized application configuration constants
 */

/** Base URL for LMDA Composer documentation site */
export const DOCS_BASE_URL = 'https://stevevillardi.github.io/lmda-composer';
export const GITHUB_BASE_URL = 'https://github.com/stevevillardi/lmda-composer';
export const LMDA_MODULE_DOCS_BASE_URL = 'https://logicmonitor.github.io/';

/** Documentation URLs */
export const DOCS_URLS = {
  home: DOCS_BASE_URL,
  changelog: `${DOCS_BASE_URL}/release-notes/changelog/`,
  gettingStarted: `${DOCS_BASE_URL}/getting-started/installation/`,
  moduleManagement: `${DOCS_BASE_URL}/module-management/creating-modules/`,
  apiExplorer: `${DOCS_BASE_URL}/api-explorer/overview/`,
} as const;

/** GitHub repository URLs */
export const GITHUB_URLS = {
  repo: GITHUB_BASE_URL,
  issues: `${GITHUB_BASE_URL}/issues`,
  releases: `${GITHUB_BASE_URL}/releases`,
} as const;

/** LogicMonitor PowerShell Module Documentation URLs */
export const LMDA_MODULE_DOCS_URLS = {
  docs: `${LMDA_MODULE_DOCS_BASE_URL}/lm-powershell-module-docs/`,
} as const;