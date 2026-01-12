/**
 * Domain-specific toast utilities for consistent messaging across the application.
 * 
 * These utilities provide a centralized place to manage toast messages,
 * making it easier to maintain consistency and update messaging globally.
 */

import { toast } from 'sonner';

// ============================================================================
// File Operations
// ============================================================================

export const fileToasts = {
  saved: () => toast.success('File saved'),
  
  exported: () => toast.success('File exported'),
  
  saveFailed: (error?: string | Error) => {
    const description = error instanceof Error ? error.message : error || 'Unknown error';
    toast.error('Failed to save file', { description });
  },
  
  openFailed: (error?: string | Error) => {
    const description = error instanceof Error 
      ? error.message 
      : error || 'An unexpected error occurred.';
    toast.error('Failed to open file', { description });
  },
  
  notFound: () => toast.error('File not found', { 
    description: 'This file has been removed from recent files.' 
  }),
  
  noLongerExists: (fileName: string) => toast.error('File no longer exists', {
    description: `"${fileName}" was deleted or moved. It has been removed from recent files.`,
  }),
  
  unableToRead: (fileName: string) => toast.error('Unable to read file', {
    description: `Could not read "${fileName}". It has been removed from recent files.`,
  }),
  
  permissionRequired: (fileName: string) => toast.info('Permission required', {
    description: `Permission to access "${fileName}" was denied. Click again to retry.`,
  }),
  
  handleDisconnected: () => toast.info('File handle disconnected', {
    description: 'The file extension no longer matches. Use "Save As" to create a new file with the correct extension.',
  }),
  
  newFileCreated: (source: string) => toast.success('New file created', {
    description: `Created from ${source}`,
  }),
};

// ============================================================================
// Module Operations
// ============================================================================

export const moduleToasts = {
  created: (name: string) => toast.success('Module created', {
    description: `Successfully created "${name}" in your portal.`,
  }),
  
  createFailed: (error?: string | Error) => {
    const description = error instanceof Error ? error.message : error || 'Unknown error';
    toast.error('Failed to create module', { description });
  },
  
  saved: (directoryName: string, scriptCount: number) => toast.success('Module saved', {
    description: `Saved to "${directoryName}" with ${scriptCount} script(s).`,
  }),
  
  saveFailed: (error?: string | Error) => {
    const description = error instanceof Error 
      ? error.message 
      : error || 'An unexpected error occurred.';
    toast.error('Failed to save', { description });
  },
  
  fetchFailed: () => toast.error('Failed to save', { 
    description: 'Could not fetch module from portal to complete the save.' 
  }),
  
  loadFailed: (error?: string) => toast.error('Failed to load modules', {
    description: error || 'Unable to fetch modules from the portal',
  }),
  
  scriptLoaded: (scriptType: 'ad' | 'collection' | 'both', moduleName: string, scriptCount?: number) => {
    if (scriptType === 'ad') {
      toast.success('Active Discovery script loaded', { description: moduleName });
    } else if (scriptType === 'collection') {
      toast.success('Collection script loaded', { description: moduleName });
    } else {
      toast.success('Scripts loaded', {
        description: `${scriptCount || 2} script${(scriptCount || 2) > 1 ? 's' : ''} from ${moduleName}`,
      });
    }
  },
  
  searchIndexRefreshed: () => toast.success('Module search index refreshed'),
  
  refreshed: (count: number) => toast.success('Modules refreshed', {
    description: `Loaded ${count} modules`,
  }),
  
  refreshFailed: (error?: string | Error) => {
    const description = error instanceof Error ? error.message : error || 'Unknown error';
    toast.error('Failed to refresh modules', { description });
  },
  
  noLineageHistory: () => toast.info('No lineage history found', {
    description: 'This module does not have historical versions available.',
  }),
  
  lineageLoadFailed: (error?: string | Error) => {
    const description = error instanceof Error ? error.message : error || 'Unknown error';
    toast.error('Failed to load lineage', { description });
  },
  
  noScriptToRestore: () => toast.error('No script available to restore for this version'),
  
  lineageRestored: (versionName: string) => toast.success('Lineage version restored', {
    description: versionName,
  }),
  
  openedFromDevice: (moduleName: string) => toast.success('Opened device datasource scripts', {
    description: moduleName,
  }),
  
  openedFromContext: (moduleName: string, portalHostname: string) => toast.success('Opened module scripts', {
    description: `${moduleName} • Portal ${portalHostname}`,
  }),
  
  notScriptBased: (collectMethod: string) => toast.warning('Datasource not script-based', {
    description: `Collect method is ${collectMethod}. Only script or batchscript datasources can be opened.`,
  }),
  
  committed: (message: string) => toast.success(message),
};

// ============================================================================
// Module Directory Operations
// ============================================================================

export const directoryToasts = {
  handleNotFound: () => toast.error('Directory handle not found', { 
    description: 'The saved module directory could not be found.' 
  }),
  
  permissionDenied: () => toast.error('Permission denied', { 
    description: 'Cannot write to the module directory.' 
  }),
  
  notSupported: () => toast.error('Not supported', {
    description: 'Your browser does not support the directory picker.',
  }),
  
  notModuleDirectory: () => toast.error('Not a module directory', {
    description: 'The selected folder does not contain a module.json file. Please select a folder that was created using "Save to Module Directory".',
  }),
  
  invalidModuleJson: () => toast.error('Invalid module directory', {
    description: 'The module.json file is corrupted or invalid.',
  }),
  
  cannotSave: (reason: string) => toast.error('Cannot save', { description: reason }),
  
  notFound: () => toast.error('Directory not found', { 
    description: 'This module directory has been removed from recent files.' 
  }),
  
  permissionRequired: (directoryName: string) => toast.info('Permission required', {
    description: `Permission to access "${directoryName}" was denied. Click again to retry.`,
  }),
  
  missingModuleJson: () => toast.error('Invalid module directory', {
    description: 'Could not find module.json in this directory.',
  }),
  
  noScriptsSelected: () => toast.info('No scripts selected', {
    description: 'Select at least one script to open.',
  }),
  
  scriptNotFound: (fileName: string) => toast.warning(`Script not found: ${fileName}`, {
    description: 'You may need to re-export this script from the portal.',
  }),
  
  noScriptsOpened: () => toast.error('No scripts could be opened', {
    description: 'All selected scripts are missing from the directory.',
  }),
  
  opened: (scriptCount: number, directoryName: string) => toast.success('Module opened', {
    description: `Opened ${scriptCount} script(s) from "${directoryName}".`,
  }),
  
  openFailed: (error?: string | Error) => {
    const description = error instanceof Error 
      ? error.message 
      : error || 'An unexpected error occurred.';
    toast.error('Failed to open', { description });
  },
  
  openModuleFolderFailed: (error?: string | Error) => {
    const description = error instanceof Error 
      ? error.message 
      : error || 'Unknown error occurred';
    toast.error('Failed to open module folder', { description });
  },
  
  removed: (reason: string) => toast.error('Module directory removed', {
    description: reason,
  }),
  
  portalMismatch: (portalHostname: string) => toast.error('Portal mismatch', {
    description: `Switch to portal "${portalHostname}" to re-export this script.`,
  }),
  
  fetchModuleFailed: (error?: string) => toast.error('Failed to fetch module', {
    description: error || 'Could not retrieve module from portal.',
  }),
  
  scriptEmpty: (scriptType: string) => toast.warning('Script is empty', {
    description: `The ${scriptType} script in the portal is empty.`,
  }),
  
  reExported: (fileName: string) => toast.success('Script re-exported', {
    description: `${fileName} has been restored from the portal.`,
  }),
  
  reExportFailed: (error?: string | Error) => {
    const description = error instanceof Error ? error.message : error || 'Unknown error occurred.';
    toast.error('Re-export failed', { description });
  },
};

// ============================================================================
// Portal Operations
// ============================================================================

export const portalToasts = {
  noPortalConnected: () => toast.warning('No Portal Connected', {
    id: 'connect-warning',
    description: 'Connect to a LogicMonitor portal to run scripts and access data.',
  }),
  
  noPortalForAction: () => toast.error('No portal connected', {
    description: 'Please connect to a LogicMonitor portal first.',
  }),
  
  pulledLatest: (parts: string[], moduleName: string) => toast.success('Pulled latest from portal', {
    description: `Updated ${parts.join(' and ')} from ${moduleName || 'module'}`,
  }),
  
  pushFailed: (error: string) => toast.error('Push failed', { description: error }),
  
  preparePushFailed: (error?: string | Error) => {
    const description = error instanceof Error ? error.message : error || 'Unknown error';
    toast.error('Failed to prepare push', { description });
  },
  
  prepareCommitFailed: (error?: string | Error) => {
    const description = error instanceof Error ? error.message : error || 'Unknown error';
    toast.error('Failed to prepare commit', { description });
  },
  
  contextApplied: (portalHostname: string, collectorId: number, hostname: string) => 
    toast.success('Context applied', {
      description: `Portal ${portalHostname} • Collector ${collectorId} • Host ${hostname}`,
    }),
  
  devicesLoadFailed: () => toast.error('Failed to load devices', {
    description: 'Check that you are connected to the portal',
  }),
  
  refreshFailed: () => toast.error('Failed to refresh portals', {
    description: 'Make sure you have a LogicMonitor portal tab open',
  }),
  
  disconnected: (hostname: string, wasSelected: boolean) => {
    if (wasSelected) {
      toast.warning(`Portal disconnected: ${hostname}`, {
        description: 'Open a LogicMonitor tab to reconnect.',
        duration: 8000,
      });
    } else {
      toast.info(`Portal disconnected: ${hostname}`, {
        duration: 5000,
      });
    }
  },
};

// ============================================================================
// Execution Operations
// ============================================================================

export const executionToasts = {
  powershellWindowsOnly: () => toast.info('PowerShell runs only on Windows collectors', {
    description: 'Select a Windows collector to run this script.',
  }),
};

// ============================================================================
// Settings Operations
// ============================================================================

export const settingsToasts = {
  saveFailed: () => toast.error('Failed to save settings', {
    description: 'Your preferences could not be saved',
  }),
};

// ============================================================================
// Clipboard Operations
// ============================================================================

export const clipboardToasts = {
  copied: (what?: string) => toast.success(what ? `Copied ${what}` : 'Copied to clipboard', {
    description: what ? undefined : what,
  }),
  
  copiedWithDescription: (description: string) => toast.success('Copied to clipboard', { description }),
  
  copyFailed: (what?: string) => toast.error('Failed to copy', {
    description: what ? `Could not copy ${what} to clipboard` : undefined,
  }),
  
  pathCopied: () => toast.success('Path copied'),
  
  savedAsVariable: (key: string) => toast.success(`Saved ${key} as variable`),
  
  outputCopied: () => toast.success('Output copied to clipboard'),
  
  commandCopied: () => toast.success('Executed command copied'),
  
  downloaded: (what?: string) => toast.success(what ? `${what} downloaded` : 'Downloaded'),
};

// ============================================================================
// AppliesTo Operations
// ============================================================================

export const appliesToToasts = {
  functionLoaded: (name: string) => toast.success(`Function "${name}" loaded into editor`),
  
  functionUnloaded: () => toast.info('Function unloaded'),
  
  functionCreated: (name: string) => toast.success(`Custom function "${name}" created successfully!`),
  
  functionUpdated: (name: string) => toast.success(`Custom function "${name}" updated successfully!`),
  
  functionDeleted: () => toast.success('Custom function deleted successfully!'),
  
  functionFailed: (action: 'create' | 'update' | 'delete', error?: string | Error) => {
    const message = error instanceof Error ? error.message : error || `Failed to ${action} function`;
    toast.error(message);
  },
};

// ============================================================================
// Collector/Debug Operations
// ============================================================================

export const collectorToasts = {
  debugFailed: (error?: string) => toast.error('Debug command execution failed', {
    description: error,
  }),
  
  debugCancelled: () => toast.info('Debug command execution cancelled'),
  
  cancelFailed: (error?: string) => toast.error('Failed to cancel debug command', {
    description: error,
  }),
  
  noCollectorSelected: () => toast.error('No portal or collector selected', {
    description: 'Please select a portal and collector first.',
  }),
  
  resultsExported: () => toast.success('All results exported'),
  
  selectCommandAndCollector: () => toast.error('Please select a command and at least one collector'),
  
  parameterRequired: (paramName: string) => toast.error(`Parameter "${paramName}" is required`),
};

// ============================================================================
// Snippet Operations
// ============================================================================

export const snippetToasts = {
  loaded: (count: number) => toast.success('Module snippets loaded', {
    description: `Found ${count} module snippets.`,
  }),
  
  loadFailed: (error?: string) => toast.error('Failed to fetch module snippets', {
    description: error,
  }),
  
  sourceFetchFailed: (error?: string) => toast.error('Failed to fetch snippet source', {
    description: error,
  }),
  
  importInserted: (name: string, isNewFile?: boolean) => toast.success('Import inserted', {
    description: isNewFile ? `Created new file with ${name} import` : `Added import for ${name}`,
  }),
  
  cacheCleared: () => toast.success('Module snippets cache cleared'),
  
  cacheClearFailed: (error?: string) => toast.error('Failed to clear cache', {
    description: error,
  }),
  
  inserted: (isTemplate?: boolean) => toast.success('Snippet inserted', {
    description: isTemplate ? 'Template applied to editor' : 'Code inserted into editor',
  }),
  
  deleted: (name: string) => toast.success('Snippet deleted', {
    description: `"${name}" has been removed`,
  }),
};

// ============================================================================
// Module Details Operations
// ============================================================================

export const moduleDetailsToasts = {
  refreshed: () => toast.success('Module details refreshed from portal'),
  
  saved: () => toast.success('Module details saved', { 
    description: 'Changes persisted to module directory.' 
  }),
  
  saveFailed: () => toast.error('Failed to save', { 
    description: 'Could not persist module details to directory.' 
  }),
  
  permissionDenied: () => toast.error('Permission denied', { 
    description: 'Could not write to module directory.' 
  }),
};

// ============================================================================
// Device/Properties Operations
// ============================================================================

export const deviceToasts = {
  propertiesLoadFailed: (error?: string) => toast.error('Failed to load properties', {
    description: error || 'Unable to fetch device properties',
  }),
  
  propertiesCopied: () => toast.success('Properties copied to clipboard'),
  
  propertyInserted: (propertyName: string) => toast.success('Property access inserted', {
    description: propertyName,
  }),
};

// ============================================================================
// API Explorer Operations
// ============================================================================

export const apiToasts = {
  responseCopied: () => toast.success('Response copied to clipboard'),
  
  urlCopied: () => toast.success('URL copied to clipboard'),
  
  requestFailed: (error?: string | Error) => {
    const message = error instanceof Error ? error.message : error || 'API request failed.';
    toast.error(message);
  },
  
  variableSaved: (name: string) => toast.success(`Saved "${name}" as variable`),
  
  noPortalSelected: () => toast.error('Select a portal to send API requests.'),
};
