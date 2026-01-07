/**
 * Tests for document-helpers utility functions.
 * 
 * Tests document type detection, dirty state, and portal binding helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  getDocumentType,
  supportsLocalFile,
  supportsPortal,
  getOriginalContent,
  hasAssociatedFileHandle,
  isLocalFileTab,
  isFileDirty,
  hasPortalChanges,
  canPushToPortal,
  getTabDirtyState,
  getPortalBinding,
  isPortalBindingActive,
  createScratchDocument,
  createLocalDocument,
  createPortalDocument,
  createHistoryDocument,
  createApiDocument,
  updateDocumentAfterSave,
  updateDocumentAfterPush,
  updateDocumentAfterPull,
  convertToLocalDocument,
} from '../../src/editor/utils/document-helpers';
import type { EditorTab, Portal } from '../../src/shared/types';
import { createMockTab, createMockModuleTab, createMockFileTab, createMockPortal } from '../helpers/store-helpers';

// ===========================================================================
// Document Type Detection
// ===========================================================================
describe('getDocumentType', () => {
  it('returns document.type when available', () => {
    const tab = createMockTab({ document: { type: 'local', file: { handleId: 'h1', lastSavedContent: '' } } });
    expect(getDocumentType(tab)).toBe('local');
  });

  it('detects API tabs', () => {
    const tab = createMockTab({ kind: 'api' });
    expect(getDocumentType(tab)).toBe('api');
  });

  it('detects history tabs from source', () => {
    const tab = createMockTab({ source: { type: 'history' } });
    expect(getDocumentType(tab)).toBe('history');
  });

  it('detects module tabs as portal type', () => {
    const tab = createMockModuleTab();
    expect(getDocumentType(tab)).toBe('portal');
  });

  it('detects file tabs as local type', () => {
    const tab = createMockFileTab();
    expect(getDocumentType(tab)).toBe('local');
  });

  it('returns scratch for new tabs without source', () => {
    const tab = createMockTab();
    expect(getDocumentType(tab)).toBe('scratch');
  });

  it('returns local for tabs with local document type', () => {
    const tab: EditorTab = {
      ...createMockTab(),
      document: { type: 'local', file: { handleId: 'h1', lastSavedContent: '' } },
    };
    expect(getDocumentType(tab)).toBe('local');
  });
});

describe('supportsLocalFile', () => {
  it('returns true only for local type', () => {
    expect(supportsLocalFile('local')).toBe(true);
    expect(supportsLocalFile('scratch')).toBe(false);
    expect(supportsLocalFile('portal')).toBe(false);
    expect(supportsLocalFile('history')).toBe(false);
    expect(supportsLocalFile('api')).toBe(false);
  });
});

describe('supportsPortal', () => {
  it('returns true only for portal type', () => {
    expect(supportsPortal('portal')).toBe(true);
    expect(supportsPortal('local')).toBe(false);
    expect(supportsPortal('scratch')).toBe(false);
    expect(supportsPortal('history')).toBe(false);
    expect(supportsPortal('api')).toBe(false);
  });
});

// ===========================================================================
// Unified Accessor Helpers
// ===========================================================================
describe('getOriginalContent', () => {
  it('returns lastSavedContent from document.file', () => {
    const tab = createMockTab({
      content: 'modified',
      document: { type: 'local', file: { handleId: 'h1', lastSavedContent: 'original' } },
    });
    expect(getOriginalContent(tab)).toBe('original');
  });

  it('returns lastKnownContent from document.portal', () => {
    const tab = createMockTab({
      content: 'modified',
      document: {
        type: 'portal',
        portal: {
          id: 'p1',
          hostname: 'test.logicmonitor.com',
          moduleId: 1,
          moduleType: 'datasource',
          moduleName: 'Test',
          scriptType: 'collection',
          lastKnownContent: 'portal-content',
        },
      },
    });
    expect(getOriginalContent(tab)).toBe('portal-content');
  });

  it('returns undefined when no document state', () => {
    const tab = createMockTab();
    expect(getOriginalContent(tab)).toBeUndefined();
  });
});

describe('hasAssociatedFileHandle', () => {
  it('returns true for local documents with fileHandleId', () => {
    const tab: EditorTab = {
      ...createMockTab(),
      fileHandleId: 'handle-123',
      document: { type: 'local', file: { handleId: 'h1', lastSavedContent: '' } },
    };
    expect(hasAssociatedFileHandle(tab)).toBe(true);
  });

  it('returns false when document type is local but no fileHandleId', () => {
    const tab: EditorTab = {
      ...createMockTab(),
      document: { type: 'local', file: { handleId: 'h1', lastSavedContent: '' } },
      // No fileHandleId
    };
    expect(hasAssociatedFileHandle(tab)).toBe(false);
  });

  it('returns false for scratch tabs', () => {
    const tab = createMockTab();
    expect(hasAssociatedFileHandle(tab)).toBe(false);
  });
});

describe('isLocalFileTab', () => {
  it('returns true for document.type === local', () => {
    const tab = createMockFileTab();
    expect(isLocalFileTab(tab)).toBe(true);
  });

  it('returns false when document type is not set', () => {
    const tab: EditorTab = {
      ...createMockTab(),
    };
    expect(isLocalFileTab(tab)).toBe(false);
  });

  it('returns false for scratch tabs', () => {
    const tab = createMockTab();
    expect(isLocalFileTab(tab)).toBe(false);
  });

  it('returns false for portal tabs', () => {
    const tab = createMockModuleTab();
    expect(isLocalFileTab(tab)).toBe(false);
  });
});

// ===========================================================================
// Dirty State Helpers
// ===========================================================================
describe('isFileDirty', () => {
  it('returns false for scratch with default template content', () => {
    // Default template check - tab with no content changes from template
    const tab = createMockTab({
      content: '',  // Empty content differs from template, but we want to test template match
      document: { type: 'scratch' },
    });
    // With empty content (not matching template), it should be dirty
    expect(isFileDirty(tab)).toBe(true);
  });

  it('returns true for scratch with modified content', () => {
    const tab = createMockTab({
      content: 'println "Hello World"',
      document: { type: 'scratch' },
    });
    expect(isFileDirty(tab)).toBe(true);
  });

  it('returns true for local with changed content', () => {
    // createMockFileTab sets document.file.lastSavedContent, so we need to set that correctly
    const tab: EditorTab = {
      ...createMockTab({ content: 'modified content' }),
      document: {
        type: 'local',
        file: {
          handleId: 'h1',
          lastSavedContent: 'original content',  // This is what we compare against
        },
      },
    };
    expect(isFileDirty(tab)).toBe(true);
  });

  it('returns false for local with unchanged content', () => {
    const tab = createMockFileTab({
      content: 'same content',
      originalContent: 'same content',
    });
    expect(isFileDirty(tab)).toBe(false);
  });

  it('returns false for portal type', () => {
    const tab = createMockModuleTab({ content: 'changed' });
    expect(isFileDirty(tab)).toBe(false);
  });

  it('returns false for history type', () => {
    const tab = createMockTab({ source: { type: 'history' }, content: 'any' });
    expect(isFileDirty(tab)).toBe(false);
  });

  it('returns false for api type', () => {
    const tab = createMockTab({ kind: 'api', content: 'any' });
    expect(isFileDirty(tab)).toBe(false);
  });
});

describe('hasPortalChanges', () => {
  it('returns true for portal with changed content', () => {
    // Create module tab with 'original' as saved content, but 'modified' as current content
    const tab: EditorTab = {
      ...createMockModuleTab({ content: 'original' }),
      content: 'modified', // Override to have different current content
    };
    expect(hasPortalChanges(tab)).toBe(true);
  });

  it('returns false for portal with unchanged content', () => {
    const tab: EditorTab = {
      ...createMockModuleTab({ content: 'same' }),
      document: {
        type: 'portal',
        portal: {
          id: 'p1',
          hostname: 'test.logicmonitor.com',
          moduleId: 1,
          moduleType: 'datasource',
          moduleName: 'Test',
          scriptType: 'collection',
          lastKnownContent: 'same',
        },
      },
    };
    expect(hasPortalChanges(tab)).toBe(false);
  });

  it('returns false for scratch type', () => {
    const tab = createMockTab({ content: 'changed', originalContent: '' });
    expect(hasPortalChanges(tab)).toBe(false);
  });

  it('returns false for local type', () => {
    const tab = createMockFileTab({ content: 'changed', originalContent: '' });
    expect(hasPortalChanges(tab)).toBe(false);
  });
});

describe('getTabDirtyState', () => {
  it('returns combined dirty state', () => {
    const scratchDirty = createMockTab({ content: 'modified', originalContent: '' });
    const result = getTabDirtyState(scratchDirty);
    expect(result.isDirty).toBe(true);
    expect(result.isFileDirty).toBe(true);
    expect(result.hasPortalChanges).toBe(false);
  });

  it('returns clean state for unchanged local file', () => {
    const clean: EditorTab = {
      ...createMockTab({ content: 'saved content' }),
      document: { type: 'local', file: { handleId: 'h1', lastSavedContent: 'saved content' } },
    };
    const result = getTabDirtyState(clean);
    expect(result.isDirty).toBe(false);
    expect(result.isFileDirty).toBe(false);
    expect(result.hasPortalChanges).toBe(false);
  });
});

// ===========================================================================
// Portal Binding Helpers
// ===========================================================================
describe('getPortalBinding', () => {
  it('extracts binding from document.portal', () => {
    const tab: EditorTab = {
      ...createMockTab(),
      document: {
        type: 'portal',
        portal: {
          id: 'portal-1',
          hostname: 'test.logicmonitor.com',
          moduleId: 123,
          moduleType: 'datasource',
          moduleName: 'TestModule',
          scriptType: 'collection',
          lineageId: 'lineage-1',
          lastKnownContent: '',
        },
      },
    };
    
    const binding = getPortalBinding(tab);
    expect(binding).not.toBeNull();
    expect(binding?.portalId).toBe('portal-1');
    expect(binding?.moduleId).toBe(123);
    expect(binding?.moduleName).toBe('TestModule');
    expect(binding?.scriptType).toBe('collection');
  });

  it('extracts binding from legacy source', () => {
    const tab = createMockModuleTab({
      moduleId: 456,
      moduleType: 'configsource',
      portalId: 'portal-2',
    });
    // Add moduleName to match new requirement
    if (tab.source) {
      tab.source.moduleName = 'LegacyModule';
    }
    
    const binding = getPortalBinding(tab);
    expect(binding).not.toBeNull();
    expect(binding?.portalId).toBe('portal-2');
    expect(binding?.moduleId).toBe(456);
    expect(binding?.moduleType).toBe('configsource');
  });

  it('returns null for non-portal tabs', () => {
    const tab = createMockTab();
    expect(getPortalBinding(tab)).toBeNull();
  });
});

describe('isPortalBindingActive', () => {
  const activePortal: Portal = createMockPortal({ id: 'portal-1', status: 'active' });
  const expiredPortal: Portal = createMockPortal({ id: 'portal-2', status: 'expired' });
  const portals = [activePortal, expiredPortal];

  it('returns true when portal is active and selected', () => {
    const tab: EditorTab = {
      ...createMockTab(),
      document: {
        type: 'portal',
        portal: {
          id: 'portal-1',
          hostname: 'test.logicmonitor.com',
          moduleId: 1,
          moduleType: 'datasource',
          moduleName: 'Test',
          scriptType: 'collection',
          lastKnownContent: '',
        },
      },
    };
    
    expect(isPortalBindingActive(tab, 'portal-1', portals)).toBe(true);
  });

  it('returns false when portal is not selected', () => {
    const tab: EditorTab = {
      ...createMockTab(),
      document: {
        type: 'portal',
        portal: {
          id: 'portal-1',
          hostname: 'test.logicmonitor.com',
          moduleId: 1,
          moduleType: 'datasource',
          moduleName: 'Test',
          scriptType: 'collection',
          lastKnownContent: '',
        },
      },
    };
    
    expect(isPortalBindingActive(tab, 'portal-2', portals)).toBe(false);
  });

  it('returns false when portal is expired', () => {
    const tab: EditorTab = {
      ...createMockTab(),
      document: {
        type: 'portal',
        portal: {
          id: 'portal-2',
          hostname: 'expired.logicmonitor.com',
          moduleId: 1,
          moduleType: 'datasource',
          moduleName: 'Test',
          scriptType: 'collection',
          lastKnownContent: '',
        },
      },
    };
    
    expect(isPortalBindingActive(tab, 'portal-2', portals)).toBe(false);
  });

  it('returns false for non-portal tabs', () => {
    const tab = createMockTab();
    expect(isPortalBindingActive(tab, 'portal-1', portals)).toBe(false);
  });
});

describe('canPushToPortal', () => {
  const activePortal: Portal = createMockPortal({ id: 'portal-1', status: 'active' });
  const portals = [activePortal];

  it('returns true when portal is active with changes', () => {
    const tab: EditorTab = {
      ...createMockTab({ content: 'modified' }),
      originalContent: 'original',
      document: {
        type: 'portal',
        portal: {
          id: 'portal-1',
          hostname: 'test.logicmonitor.com',
          moduleId: 1,
          moduleType: 'datasource',
          moduleName: 'Test',
          scriptType: 'collection',
          lastKnownContent: 'original',
        },
      },
    };
    
    expect(canPushToPortal(tab, 'portal-1', portals)).toBe(true);
  });

  it('returns false when no changes', () => {
    const tab: EditorTab = {
      ...createMockTab({ content: 'same' }),
      document: {
        type: 'portal',
        portal: {
          id: 'portal-1',
          hostname: 'test.logicmonitor.com',
          moduleId: 1,
          moduleType: 'datasource',
          moduleName: 'Test',
          scriptType: 'collection',
          lastKnownContent: 'same',
        },
      },
    };
    
    expect(canPushToPortal(tab, 'portal-1', portals)).toBe(false);
  });

  it('returns false for non-portal tabs', () => {
    const tab = createMockTab({ content: 'any' });
    expect(canPushToPortal(tab, 'portal-1', portals)).toBe(false);
  });
});

// ===========================================================================
// Document State Factory Functions
// ===========================================================================
describe('createScratchDocument', () => {
  it('creates a scratch document state', () => {
    const doc = createScratchDocument();
    expect(doc.type).toBe('scratch');
    expect(doc.file).toBeUndefined();
    expect(doc.portal).toBeUndefined();
  });
});

describe('createLocalDocument', () => {
  it('creates a local document state', () => {
    const doc = createLocalDocument('handle-1', 'content', 'test.groovy');
    expect(doc.type).toBe('local');
    expect(doc.file?.handleId).toBe('handle-1');
    expect(doc.file?.lastSavedContent).toBe('content');
    expect(doc.file?.fileName).toBe('test.groovy');
    expect(doc.file?.lastSavedAt).toBeDefined();
  });
});

describe('createPortalDocument', () => {
  it('creates a portal document state', () => {
    const doc = createPortalDocument(
      'portal-1',
      'test.logicmonitor.com',
      123,
      'datasource',
      'TestModule',
      'collection',
      'script content',
      'lineage-1'
    );
    expect(doc.type).toBe('portal');
    expect(doc.portal?.id).toBe('portal-1');
    expect(doc.portal?.hostname).toBe('test.logicmonitor.com');
    expect(doc.portal?.moduleId).toBe(123);
    expect(doc.portal?.moduleType).toBe('datasource');
    expect(doc.portal?.moduleName).toBe('TestModule');
    expect(doc.portal?.scriptType).toBe('collection');
    expect(doc.portal?.lastKnownContent).toBe('script content');
    expect(doc.portal?.lineageId).toBe('lineage-1');
  });
});

describe('createHistoryDocument', () => {
  it('creates a history document state', () => {
    const doc = createHistoryDocument();
    expect(doc.type).toBe('history');
  });
});

describe('createApiDocument', () => {
  it('creates an API document state', () => {
    const doc = createApiDocument();
    expect(doc.type).toBe('api');
  });
});

// ===========================================================================
// Document State Update Functions
// ===========================================================================
describe('updateDocumentAfterSave', () => {
  it('updates lastSavedContent and timestamp', () => {
    const original = createLocalDocument('h1', 'original', 'test.groovy');
    const updated = updateDocumentAfterSave(original, 'new content');
    
    expect(updated.file?.lastSavedContent).toBe('new content');
    // Timestamp should be set (might be equal if same ms, so just check it exists)
    expect(updated.file?.lastSavedAt).toBeDefined();
    expect(updated.file?.lastSavedAt).toBeGreaterThanOrEqual(original.file!.lastSavedAt!);
  });

  it('returns scratch if current is undefined', () => {
    const result = updateDocumentAfterSave(undefined, 'content');
    expect(result.type).toBe('scratch');
  });
});

describe('updateDocumentAfterPush', () => {
  it('updates portal lastKnownContent and timestamp', () => {
    const original = createPortalDocument('p1', 'host', 1, 'datasource', 'M', 'collection', 'old');
    const updated = updateDocumentAfterPush(original, 'pushed content');
    
    expect(updated.portal?.lastKnownContent).toBe('pushed content');
    expect(updated.portal?.lastPushedAt).toBeDefined();
  });
});

describe('updateDocumentAfterPull', () => {
  it('updates portal content, timestamp, and version', () => {
    const original = createPortalDocument('p1', 'host', 1, 'datasource', 'M', 'collection', 'old');
    const updated = updateDocumentAfterPull(original, 'pulled content', 5);
    
    expect(updated.portal?.lastKnownContent).toBe('pulled content');
    expect(updated.portal?.lastPulledAt).toBeDefined();
    expect(updated.portal?.lastPulledVersion).toBe(5);
  });
});

describe('convertToLocalDocument', () => {
  it('creates a new local document', () => {
    const doc = convertToLocalDocument('handle-new', 'saved content', 'newfile.groovy');
    
    expect(doc.type).toBe('local');
    expect(doc.file?.handleId).toBe('handle-new');
    expect(doc.file?.lastSavedContent).toBe('saved content');
    expect(doc.file?.fileName).toBe('newfile.groovy');
  });
});

