/**
 * Pure helper functions for document state management.
 * 
 * These functions determine document state (dirty, has changes, etc.)
 * based on the unified DocumentState model.
 */

import type { 
  EditorTab, 
  DocumentType, 
  DocumentState, 
  Portal,
  LogicModuleType,
} from '@/shared/types';
import { filterValidDatapoints } from '@/shared/datapoint-utils';
import { DEFAULT_GROOVY_TEMPLATE, DEFAULT_POWERSHELL_TEMPLATE } from '../config/script-templates';
import { normalizeScript } from '../stores/helpers/slice-helpers';

// ============================================================================
// Document Type Helpers
// ============================================================================

/**
 * Get the document type from an EditorTab.
 * Handles both new DocumentState and legacy fields for backwards compatibility.
 */
export function getDocumentType(tab: EditorTab): DocumentType {
  // Document state is now required - use it directly
  if (tab.document?.type) {
    return tab.document.type;
  }
  
  // Fallback for tabs created before document field was required
  // This should only happen during migration
  if (tab.kind === 'api') {
    return 'api';
  }
  
  if (tab.source?.type === 'history') {
    return 'history';
  }
  
  if (tab.source?.type === 'module') {
    return 'portal';
  }
  
  if (tab.source?.type === 'file') {
    return 'local';
  }
  
  return 'scratch';
}

/**
 * Check if a document type supports local file operations.
 */
export function supportsLocalFile(type: DocumentType): boolean {
  return type === 'local';
}

/**
 * Check if a document type supports portal operations.
 */
export function supportsPortal(type: DocumentType): boolean {
  return type === 'portal';
}

// ============================================================================
// Unified Accessor Helpers
// These functions provide a unified interface for accessing document properties
// while supporting both legacy fields and the new DocumentState model.
// ============================================================================

/**
 * Get the original/baseline content for comparison.
 * 
 * @param tab - The editor tab to get content from
 * @param purpose - The comparison purpose:
 *   - 'local': For detecting local dirty state (unsaved disk changes).
 *              Returns file.lastSavedContent for local files, otherwise portal.lastKnownContent.
 *   - 'portal': For detecting portal conflicts (has the portal changed since last sync?).
 *              Always returns portal.lastKnownContent regardless of local file state.
 */
export function getOriginalContent(
  tab: EditorTab, 
  purpose: 'local' | 'portal' = 'local'
): string | undefined {
  if (purpose === 'portal') {
    // For portal conflict detection: always use the portal baseline
    return tab.document?.portal?.lastKnownContent;
  }
  
  // For local dirty state: prioritize file content for local files
  if (tab.document?.file?.lastSavedContent !== undefined) {
    return tab.document.file.lastSavedContent;
  }
  if (tab.document?.portal?.lastKnownContent !== undefined) {
    return tab.document.portal.lastKnownContent;
  }
  return undefined;
}

/**
 * Check if the tab has an associated file handle (saved local file).
 */
export function hasAssociatedFileHandle(tab: EditorTab): boolean {
  return tab.document?.type === 'local' && !!tab.fileHandleId;
}

/**
 * Check if the tab is a local file (as opposed to scratch or portal).
 */
export function isLocalFileTab(tab: EditorTab): boolean {
  return tab.document?.type === 'local';
}

// ============================================================================
// Dirty State Helpers
// ============================================================================

/**
 * Check if a document has unsaved local file changes.
 * 
 * Returns true for:
 * - 'scratch': Always dirty (never saved)
 * - 'local': content !== file.lastSavedContent
 * 
 * Returns false for:
 * - 'portal': No local file to save
 * - 'history': Readonly
 * - 'api': No dirty concept
 */
export function isFileDirty(tab: EditorTab): boolean {
  const type = getDocumentType(tab);
  
  switch (type) {
    case 'scratch': {
      // Scratch documents are only "dirty" if content differs from default template
      // This prevents showing unsaved changes dialog for unmodified new files
      const normalizedContent = normalizeScript(tab.content);
      const defaultTemplate = tab.language === 'powershell' 
        ? DEFAULT_POWERSHELL_TEMPLATE 
        : DEFAULT_GROOVY_TEMPLATE;
      const normalizedDefault = normalizeScript(defaultTemplate);
      
      // Not dirty if content matches the default template for this language
      return normalizedContent !== normalizedDefault;
    }
      
    case 'local': {
      // Compare against saved content in document state
      if (tab.document?.file?.lastSavedContent !== undefined) {
        return tab.content !== tab.document.file.lastSavedContent;
      }
      // If no reference content, consider dirty
      return true;
    }
    
    case 'portal':
    case 'history':
    case 'api':
      // These types don't have local files
      return false;
      
    default:
      return false;
  }
}

/**
 * Check if a document has unpushed portal changes.
 * 
 * Returns true for:
 * - 'portal': content !== portal.lastKnownContent
 * 
 * Returns false for:
 * - 'scratch': No portal binding
 * - 'local': No portal binding
 * - 'history': Readonly
 * - 'api': No dirty concept
 */
export function hasPortalChanges(tab: EditorTab): boolean {
  const type = getDocumentType(tab);
  
  // For 'local' documents that have a portal binding (directory-saved modules),
  // we still need to check for portal changes
  if (type === 'local' && tab.document?.portal?.lastKnownContent !== undefined) {
    return tab.content !== tab.document.portal.lastKnownContent;
  }
  
  switch (type) {
    case 'portal': {
      // Compare against last known content from portal
      if (tab.document?.portal?.lastKnownContent !== undefined) {
        return tab.content !== tab.document.portal.lastKnownContent;
      }
      // If no reference content, consider dirty if there's actual content
      return tab.content.trim().length > 0;
    }
    
    case 'scratch':
    case 'local':
    case 'history':
    case 'api':
      // These types don't have portal bindings (local without portal was handled above)
      return false;
      
    default:
      return false;
  }
}

/**
 * Check if a document can be pushed to portal.
 * Requires portal binding AND changes to push.
 */
export function canPushToPortal(
  tab: EditorTab,
  selectedPortalId: string | null,
  portals: Portal[]
): boolean {
  const type = getDocumentType(tab);
  
  // Must be a portal-bound document
  if (!supportsPortal(type)) {
    return false;
  }
  
  // Must have changes to push
  if (!hasPortalChanges(tab)) {
    return false;
  }
  
  // Must have portal binding
  const binding = getPortalBinding(tab);
  if (!binding) {
    return false;
  }
  
  // Portal must be active
  const isBindingActive = isPortalBindingActive(tab, selectedPortalId, portals);
  return isBindingActive;
}

/**
 * Get the overall dirty state for a tab (for UI display).
 * Considers both file and portal dirty states.
 */
export function getTabDirtyState(tab: EditorTab): {
  isFileDirty: boolean;
  hasPortalChanges: boolean;
  isDirty: boolean; // Either is true
} {
  const fileDirty = isFileDirty(tab);
  const portalChanges = hasPortalChanges(tab);
  
  return {
    isFileDirty: fileDirty,
    hasPortalChanges: portalChanges,
    isDirty: fileDirty || portalChanges,
  };
}

// ============================================================================
// Portal Binding Helpers
// ============================================================================

/**
 * Get portal binding info from a tab.
 */
export function getPortalBinding(tab: EditorTab): {
  portalId: string;
  portalHostname: string;
  moduleId: number;
  moduleType: LogicModuleType;
  moduleName: string;
  scriptType: 'collection' | 'ad';
  lineageId?: string;
} | null {
  // Check new document state first
  if (tab.document?.portal) {
    return {
      portalId: tab.document.portal.id,
      portalHostname: tab.document.portal.hostname,
      moduleId: tab.document.portal.moduleId,
      moduleType: tab.document.portal.moduleType,
      moduleName: tab.document.portal.moduleName,
      scriptType: tab.document.portal.scriptType,
      lineageId: tab.document.portal.lineageId,
    };
  }
  
  // Fallback to legacy source
  if (tab.source?.type === 'module' && 
      tab.source.portalId && 
      tab.source.moduleId && 
      tab.source.moduleType &&
      tab.source.moduleName &&
      tab.source.scriptType) {
    return {
      portalId: tab.source.portalId,
      portalHostname: tab.source.portalHostname || '',
      moduleId: tab.source.moduleId,
      moduleType: tab.source.moduleType,
      moduleName: tab.source.moduleName,
      scriptType: tab.source.scriptType,
      lineageId: tab.source.lineageId,
    };
  }
  
  return null;
}

/**
 * Check if the portal binding is active (portal connected and selected).
 */
export function isPortalBindingActive(
  tab: EditorTab,
  selectedPortalId: string | null,
  portals: Portal[]
): boolean {
  const binding = getPortalBinding(tab);
  if (!binding) {
    return false;
  }
  
  // Check if portal exists and is active
  const portal = portals.find(p => p.id === binding.portalId);
  if (!portal || portal.status !== 'active') {
    return false;
  }
  
  // Check if portal is selected
  if (selectedPortalId !== binding.portalId) {
    return false;
  }
  
  return true;
}

// ============================================================================
// Document State Factory Functions
// ============================================================================

/**
 * Create a DocumentState for a new scratch document.
 */
export function createScratchDocument(): DocumentState {
  return {
    type: 'scratch',
  };
}

/**
 * Create a DocumentState for a local file.
 */
export function createLocalDocument(
  handleId: string,
  content: string,
  fileName?: string
): DocumentState {
  return {
    type: 'local',
    file: {
      handleId,
      lastSavedContent: content,
      lastSavedAt: Date.now(),
      fileName,
    },
  };
}

/**
 * Create a DocumentState for a portal module.
 */
export function createPortalDocument(
  portalId: string,
  portalHostname: string,
  moduleId: number,
  moduleType: LogicModuleType,
  moduleName: string,
  scriptType: 'collection' | 'ad',
  content: string,
  lineageId?: string
): DocumentState {
  return {
    type: 'portal',
    portal: {
      id: portalId,
      hostname: portalHostname,
      moduleId,
      moduleType,
      moduleName,
      scriptType,
      lineageId,
      lastKnownContent: content,
      lastPulledAt: Date.now(),
    },
  };
}


/**
 * Create a DocumentState for a history entry.
 */
export function createHistoryDocument(): DocumentState {
  return {
    type: 'history',
  };
}

/**
 * Create a DocumentState for an API tab.
 */
export function createApiDocument(): DocumentState {
  return {
    type: 'api',
  };
}

// ============================================================================
// Document State Update Functions
// ============================================================================

/**
 * Update document state after saving to local file.
 */
export function updateDocumentAfterSave(
  current: DocumentState | undefined,
  content: string
): DocumentState {
  if (!current) {
    // Should not happen, but handle gracefully
    return { type: 'scratch' };
  }
  
  if (!current.file) {
    // Document doesn't have file state - shouldn't save
    return current;
  }
  
  return {
    ...current,
    file: {
      ...current.file,
      lastSavedContent: content,
      lastSavedAt: Date.now(),
    },
  };
}

/**
 * Update document state after pushing to portal.
 */
export function updateDocumentAfterPush(
  current: DocumentState | undefined,
  content: string
): DocumentState {
  if (!current) {
    return { type: 'scratch' };
  }
  
  if (!current.portal) {
    return current;
  }
  
  return {
    ...current,
    portal: {
      ...current.portal,
      lastKnownContent: content,
      lastPushedAt: Date.now(),
    },
  };
}

/**
 * Update document state after pulling from portal.
 */
export function updateDocumentAfterPull(
  current: DocumentState | undefined,
  content: string,
  portalVersion?: number
): DocumentState {
  if (!current) {
    return { type: 'scratch' };
  }
  
  if (!current.portal) {
    return current;
  }
  
  const updatedDoc: DocumentState = {
    ...current,
    portal: {
      ...current.portal,
      lastKnownContent: content,
      lastPulledAt: Date.now(),
      lastPulledVersion: portalVersion,
    },
  };
  
  return updatedDoc;
}


/**
 * Convert a scratch document to a local document after saving.
 */
export function convertToLocalDocument(
  handleId: string,
  content: string,
  fileName: string
): DocumentState {
  return createLocalDocument(handleId, content, fileName);
}


// ============================================================================
// Module Script Extraction Utilities
// ============================================================================

/**
 * Extracts script content from a fetched LogicMonitor module based on script type and module type.
 * Centralizes the logic for finding scripts in different module structures.
 * 
 * This function handles the complexity of where scripts are stored in different module types:
 * - PropertySource/DiagnosticSource: Top-level groovyScript
 * - EventSource: Top-level groovyScript or script field
 * - LogSource: Nested in collectionAttribute
 * - DataSource/ConfigSource/TopologySource: Nested in collectorAttribute.groovyScript
 * - AD scripts: Always in autoDiscoveryConfig.method.groovyScript
 * 
 * @param module - The raw module object from the LogicMonitor API
 * @param moduleType - The type of the module (datasource, propertysource, etc.)
 * @param scriptType - Whether to extract 'collection' or 'ad' script
 * @returns The script content, or empty string if not found
 */
 
/**
 * Minimal module shape for script extraction.
 * Covers the fields actually accessed during extraction.
 */
interface ModuleScriptData {
  groovyScript?: string;
  script?: string;
  autoDiscoveryConfig?: {
    method?: {
      groovyScript?: string;
    };
  };
  collectorAttribute?: {
    groovyScript?: string;
  };
  collectionAttribute?: {
    script?: {
      embeddedContent?: string;
    };
    groovyScript?: string;
  };
}

export function extractScriptFromModule(
  module: ModuleScriptData, 
  moduleType: LogicModuleType, 
  scriptType: 'collection' | 'ad'
): string {
  if (scriptType === 'ad') {
    // AD script - always uses groovyScript for scripted modules
    return module.autoDiscoveryConfig?.method?.groovyScript || '';
  }
  
  // Collection script - location varies by module type
  if (moduleType === 'propertysource' || moduleType === 'diagnosticsource') {
    return module.groovyScript || '';
  } else if (moduleType === 'eventsource') {
    return module.groovyScript || module.script || '';
  } else if (moduleType === 'logsource') {
    return module.collectionAttribute?.script?.embeddedContent ||
           module.collectionAttribute?.groovyScript ||
           module.collectorAttribute?.groovyScript || '';
  } else {
    // DataSource, ConfigSource, TopologySource
    return module.collectorAttribute?.groovyScript || '';
  }
}

/**
 * Detects the script language from a LogicMonitor module.
 * 
 * @param module - The raw module object from the LogicMonitor API
 * @returns 'powershell' or 'groovy' based on the module's scriptType
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detectScriptLanguage(module: any): 'powershell' | 'groovy' {
  const scriptType = module.scriptType || module.collectorAttribute?.scriptType || 'embed';
  return scriptType.toLowerCase() === 'powershell' ? 'powershell' : 'groovy';
}

/**
 * Normalizes script content for comparison.
 * Handles line ending differences and trailing whitespace that can cause false mismatches.
 * 
 * @param content - The script content to normalize
 * @returns Normalized content with consistent line endings and trimmed whitespace
 */
export function normalizeScriptContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')  // Normalize CRLF to LF
    .replace(/\r/g, '\n')     // Normalize CR to LF
    .trim();                  // Remove leading/trailing whitespace
}

// ============================================================================
// Module Details Helpers
// ============================================================================

/**
 * List of editable module details fields for comparison and syncing.
 * Used by conflict detection and pull operations.
 */
export const EDITABLE_MODULE_DETAILS_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'displayName', label: 'Display Name' },
  { key: 'description', label: 'Description' },
  { key: 'appliesTo', label: 'Applies To' },
  { key: 'group', label: 'Group' },
  { key: 'technology', label: 'Technical Notes' },
  { key: 'tags', label: 'Tags' },
  { key: 'collectInterval', label: 'Collect Interval' },
  { key: 'accessGroupIds', label: 'Access Groups' },
  { key: 'enableAutoDiscovery', label: 'Auto Discovery' },
  { key: 'alertSubjectTemplate', label: 'Alert Subject' },
  { key: 'alertBodyTemplate', label: 'Alert Body' },
  { key: 'alertLevel', label: 'Alert Level' },
  { key: 'clearAfterAck', label: 'Clear After ACK' },
  { key: 'alertEffectiveIval', label: 'Alert Effective Interval' },
] as const;

/**
 * Module metadata extracted from a LogicMonitor module API response.
 * This is the standardized format used for module details across the application.
 */
export interface ParsedModuleMetadata {
  id: number;
  name: string;
  displayName?: string;
  description?: string;
  appliesTo?: string;
  group?: string;
  technology?: string;
  tags?: string;
  collectInterval?: number;
  accessGroupIds?: number[];
  version: number;
  enableAutoDiscovery?: boolean;
  autoDiscoveryConfig?: Record<string, unknown>;
  dataPoints?: unknown[];
  configChecks?: unknown[];
  alertSubjectTemplate?: string;
  alertBodyTemplate?: string;
  alertLevel?: string;
  clearAfterAck?: boolean;
  alertEffectiveIval?: number;
}

/**
 * Parses module details from a LogicMonitor module API response.
 * Handles schema differences across module types using MODULE_TYPE_SCHEMAS.
 * 
 * @param module - The raw module object from the LogicMonitor API
 * @param schema - The schema for this module type from MODULE_TYPE_SCHEMAS
 * @param getSchemaFieldNameFn - Function to get field name from schema
 * @returns Standardized module metadata object
 */
export function parseModuleDetailsFromResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  module: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSchemaFieldNameFn: (schema: any, field: string) => string
): ParsedModuleMetadata {
  const intervalField = schema.intervalField || 'collectInterval';
  const intervalValue =
    module[intervalField as keyof typeof module] ??
    module.collectInterval ??
    module[getSchemaFieldNameFn(schema, 'collectInterval') as keyof typeof module];
  const collectIntervalValue =
    schema.intervalFormat === 'object' && typeof intervalValue === 'object' && intervalValue
      ? (intervalValue as { offset?: number }).offset
      : intervalValue;
  
  const appliesToValue = module[getSchemaFieldNameFn(schema, 'appliesTo') as keyof typeof module];
  const technologyValue = module[getSchemaFieldNameFn(schema, 'technology') as keyof typeof module];
  const displayNameValue = module[getSchemaFieldNameFn(schema, 'displayName') as keyof typeof module];
  const descriptionValue = module[getSchemaFieldNameFn(schema, 'description') as keyof typeof module];
  const groupValue = module[getSchemaFieldNameFn(schema, 'group') as keyof typeof module];
  const tagsValue = module[getSchemaFieldNameFn(schema, 'tags') as keyof typeof module];
  // Filter out ghost datapoints (no rawDataFieldName AND method is 'none')
  const rawDataPoints = schema.editableList === 'datapoints' ? module.dataPoints || [] : [];
  const dataPoints = filterValidDatapoints(rawDataPoints) as unknown[];
  const configChecks = schema.editableList === 'configChecks' ? module.configChecks || [] : [];
  const autoDiscoveryConfig = schema.autoDiscoveryDefaults
    ? {
        ...schema.autoDiscoveryDefaults,
        ...(module.autoDiscoveryConfig || {}),
        method: {
          ...(module.autoDiscoveryConfig?.method || {}),
        },
      }
    : module.autoDiscoveryConfig;
  
  return {
    id: module.id,
    name: module.name || '',
    displayName: displayNameValue,
    description: descriptionValue,
    appliesTo: appliesToValue,
    group: groupValue,
    technology: technologyValue,
    tags: tagsValue,
    collectInterval: collectIntervalValue,
    accessGroupIds: module.accessGroupIds,
    version: module.version || 0,
    enableAutoDiscovery: module.enableAutoDiscovery,
    autoDiscoveryConfig,
    dataPoints,
    configChecks,
    alertSubjectTemplate: module.alertSubjectTemplate,
    alertBodyTemplate: module.alertBodyTemplate,
    alertLevel: module.alertLevel,
    clearAfterAck: module.clearAfterAck,
    alertEffectiveIval: module.alertEffectiveIval,
  };
}

