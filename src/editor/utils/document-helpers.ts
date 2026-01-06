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

// ============================================================================
// Document Type Helpers
// ============================================================================

/**
 * Get the document type from an EditorTab.
 * Handles both new DocumentState and legacy fields for backwards compatibility.
 */
export function getDocumentType(tab: EditorTab): DocumentType {
  // Use new unified document state if available
  if (tab.document?.type) {
    return tab.document.type;
  }
  
  // Fallback to legacy detection for backwards compatibility
  if (tab.kind === 'api') {
    return 'api';
  }
  
  if (tab.source?.type === 'history') {
    return 'history';
  }
  
  if (tab.source?.type === 'module') {
    // Module can be either 'portal' (no file) or 'repository' (has file)
    if (tab.isLocalFile && tab.hasFileHandle) {
      return 'repository';
    }
    return 'portal';
  }
  
  if (tab.source?.type === 'file' || tab.isLocalFile) {
    return 'local';
  }
  
  if (tab.source?.type === 'new' || !tab.source) {
    // Check if it has been saved (has file handle)
    if (tab.hasFileHandle) {
      return 'local';
    }
    return 'scratch';
  }
  
  return 'scratch';
}

/**
 * Check if a document type supports local file operations.
 */
export function supportsLocalFile(type: DocumentType): boolean {
  return type === 'local' || type === 'repository';
}

/**
 * Check if a document type supports portal operations.
 */
export function supportsPortal(type: DocumentType): boolean {
  return type === 'portal' || type === 'repository';
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
 * - 'repository': content !== file.lastSavedContent
 * 
 * Returns false for:
 * - 'portal': No local file to save
 * - 'history': Readonly
 * - 'api': No dirty concept
 */
export function isFileDirty(tab: EditorTab): boolean {
  const type = getDocumentType(tab);
  
  switch (type) {
    case 'scratch':
      // Scratch documents are always "dirty" (never saved)
      return true;
      
    case 'local':
    case 'repository': {
      // Check against new document state first
      if (tab.document?.file?.lastSavedContent !== undefined) {
        return tab.content !== tab.document.file.lastSavedContent;
      }
      // Fallback to legacy originalContent
      if (tab.originalContent !== undefined) {
        return tab.content !== tab.originalContent;
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
 * - 'repository': content !== portal.lastKnownContent
 * 
 * Returns false for:
 * - 'scratch': No portal binding
 * - 'local': No portal binding
 * - 'history': Readonly
 * - 'api': No dirty concept
 */
export function hasPortalChanges(tab: EditorTab): boolean {
  const type = getDocumentType(tab);
  
  switch (type) {
    case 'portal':
    case 'repository': {
      // Check against new document state first
      if (tab.document?.portal?.lastKnownContent !== undefined) {
        return tab.content !== tab.document.portal.lastKnownContent;
      }
      // Fallback to legacy portalContent
      if (tab.portalContent !== undefined) {
        return tab.content !== tab.portalContent;
      }
      // For portal type without reference, compare to originalContent
      // (which was the content when imported from portal)
      if (type === 'portal' && tab.originalContent !== undefined) {
        return tab.content !== tab.originalContent;
      }
      // If no reference content, consider dirty if there's actual content
      return tab.content.trim().length > 0;
    }
    
    case 'scratch':
    case 'local':
    case 'history':
    case 'api':
      // These types don't have portal bindings
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
 * Create a DocumentState for a repository document.
 */
export function createRepositoryDocument(
  handleId: string,
  content: string,
  fileName: string,
  portalId: string,
  portalHostname: string,
  moduleId: number,
  moduleType: LogicModuleType,
  moduleName: string,
  scriptType: 'collection' | 'ad',
  repositoryId: string,
  repositoryDisplayPath: string,
  modulePath: string,
  lineageId?: string
): DocumentState {
  return {
    type: 'repository',
    file: {
      handleId,
      lastSavedContent: content,
      lastSavedAt: Date.now(),
      fileName,
    },
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
    repository: {
      id: repositoryId,
      displayPath: repositoryDisplayPath,
      modulePath,
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
  
  // Also update file state if this is a repository document
  if (current.type === 'repository' && current.file) {
    updatedDoc.file = {
      ...current.file,
      lastSavedContent: content,
      lastSavedAt: Date.now(),
    };
  }
  
  return updatedDoc;
}

/**
 * Convert a portal document to a repository document after cloning.
 */
export function convertToRepositoryDocument(
  current: DocumentState | undefined,
  handleId: string,
  fileName: string,
  repositoryId: string,
  repositoryDisplayPath: string,
  modulePath: string
): DocumentState {
  if (!current || current.type !== 'portal' || !current.portal) {
    throw new Error('Can only convert portal documents to repository');
  }
  
  return {
    type: 'repository',
    file: {
      handleId,
      lastSavedContent: current.portal.lastKnownContent,
      lastSavedAt: Date.now(),
      fileName,
    },
    portal: current.portal,
    repository: {
      id: repositoryId,
      displayPath: repositoryDisplayPath,
      modulePath,
    },
  };
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

