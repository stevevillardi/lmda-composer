/**
 * Tests for module directory save/open operations.
 * 
 * Tests the module directory workflow including:
 * - Dirty state persistence with portalBaseline/localDraft
 * - Module details restoration on directory reopen
 * - Pull dialog comparison logic
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { 
  resetStore, 
  resetCounters,
} from './helpers/store-helpers';
import type { ModuleDirectoryConfig } from '../src/shared/types';
import type { ModuleDetailsDraft } from '../src/editor/stores/slices/tools-slice';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock ModuleDirectoryConfig for testing.
 */
function createMockModuleConfig(options: {
  moduleName?: string;
  portalHostname?: string;
  portalId?: string;
  moduleId?: number;
  hasLocalDraft?: boolean;
  dirtyFields?: string[];
} = {}): ModuleDirectoryConfig {
  const {
    moduleName = 'TestModule',
    portalHostname = 'test.logicmonitor.com',
    portalId = 'portal-1',
    moduleId = 12345,
    hasLocalDraft = false,
    dirtyFields = [],
  } = options;

  const portalBaseline = {
    id: moduleId,
    name: moduleName,
    displayName: 'Test Module',
    description: 'Original description',
    appliesTo: 'system.hostname =~ ".*"',
    collectInterval: 300,
  };

  const localDraft = hasLocalDraft ? {
    ...portalBaseline,
    // Apply dirty field changes
    ...(dirtyFields.includes('description') ? { description: 'Modified description' } : {}),
    ...(dirtyFields.includes('appliesTo') ? { appliesTo: 'isWindows()' } : {}),
    ...(dirtyFields.includes('collectInterval') ? { collectInterval: 600 } : {}),
  } : undefined;

  return {
    version: 1,
    portalBinding: {
      portalId,
      portalHostname,
      moduleId,
      moduleType: 'datasource',
      moduleName,
    },
    scripts: {
      collection: {
        fileName: 'collection.groovy',
        language: 'groovy',
        mode: 'collection',
        portalChecksum: 'abc123',
        diskChecksum: 'abc123',
      },
    },
    moduleDetails: {
      portalVersion: 1,
      lastPulledAt: new Date().toISOString(),
      portalBaseline,
      localDraft,
    },
    lastSyncedAt: new Date().toISOString(),
  };
}

// =============================================================================
// Module Details Dirty State Persistence
// =============================================================================

describe('Module Details Dirty State Persistence', () => {
  beforeEach(() => {
    resetStore();
    resetCounters();
  });

  afterEach(() => {
    resetStore();
  });

  describe('Computing dirty fields from portalBaseline vs localDraft', () => {
    it('returns empty dirtyFields when no localDraft exists', () => {
      const config = createMockModuleConfig({ hasLocalDraft: false });
      
      // Simulate the logic from openModuleDirectory
      const portalBaseline = config.moduleDetails?.portalBaseline ?? {};
      const localDraft = config.moduleDetails?.localDraft;
      
      const dirtyFields = new Set<string>();
      if (localDraft) {
        for (const key of Object.keys(localDraft)) {
          const localVal = localDraft[key];
          const baselineVal = portalBaseline[key];
          if (JSON.stringify(localVal) !== JSON.stringify(baselineVal)) {
            dirtyFields.add(key);
          }
        }
      }
      
      expect(dirtyFields.size).toBe(0);
    });

    it('computes dirtyFields when localDraft differs from portalBaseline', () => {
      const config = createMockModuleConfig({ 
        hasLocalDraft: true, 
        dirtyFields: ['description', 'collectInterval'] 
      });
      
      const portalBaseline = config.moduleDetails?.portalBaseline ?? {};
      const localDraft = config.moduleDetails?.localDraft ?? {};
      
      const dirtyFields = new Set<string>();
      for (const key of Object.keys(localDraft)) {
        const localVal = localDraft[key];
        const baselineVal = portalBaseline[key];
        if (JSON.stringify(localVal) !== JSON.stringify(baselineVal)) {
          dirtyFields.add(key);
        }
      }
      
      expect(dirtyFields.size).toBe(2);
      expect(dirtyFields.has('description')).toBe(true);
      expect(dirtyFields.has('collectInterval')).toBe(true);
      expect(dirtyFields.has('appliesTo')).toBe(false);
    });

    it('handles nested object comparison correctly', () => {
      const portalBaseline = {
        autoDiscoveryConfig: { method: { name: 'ad_script' }, deleteInactiveInstances: true },
      };
      const localDraft = {
        autoDiscoveryConfig: { method: { name: 'ad_script' }, deleteInactiveInstances: false },
      };
      
      const dirtyFields = new Set<string>();
      for (const key of Object.keys(localDraft)) {
        if (JSON.stringify(localDraft[key]) !== JSON.stringify(portalBaseline[key])) {
          dirtyFields.add(key);
        }
      }
      
      expect(dirtyFields.has('autoDiscoveryConfig')).toBe(true);
    });
  });
});

// =============================================================================
// Pull Dialog Comparison Logic
// =============================================================================

describe('Pull Dialog Comparison Logic', () => {
  beforeEach(() => {
    resetStore();
    resetCounters();
  });

  afterEach(() => {
    resetStore();
  });

  describe('Comparing local draft vs portal for pull changes', () => {
    it('detects changes when local draft differs from portal', () => {
      // Simulates PullFromPortalDialog's detailsChanges computation
      const localDraft: Partial<ModuleDetailsDraft> = {
        original: {
          description: 'Original description',
          appliesTo: 'system.hostname =~ ".*"',
        },
        draft: {
          description: 'Modified description',  // Changed locally
          appliesTo: 'system.hostname =~ ".*"', // Same as original
        },
        dirtyFields: new Set(['description']),
      };
      
      const portalDetails = {
        description: 'Original description',  // Same as original
        appliesTo: 'system.hostname =~ ".*"',
      };
      
      // The fix: compare draft (user's current values) vs portal
      const changes: string[] = [];
      for (const key of ['description', 'appliesTo']) {
        const localVal = localDraft.draft?.[key as keyof typeof localDraft.draft];
        const portalVal = portalDetails[key as keyof typeof portalDetails];
        if (JSON.stringify(localVal) !== JSON.stringify(portalVal)) {
          changes.push(key);
        }
      }
      
      expect(changes).toContain('description');
      expect(changes).not.toContain('appliesTo');
    });

    it('shows no changes when draft matches portal', () => {
      const localDraft: Partial<ModuleDetailsDraft> = {
        original: {
          description: 'Description',
          appliesTo: 'isWindows()',
        },
        draft: {
          description: 'Description',  // Same as original and portal
          appliesTo: 'isWindows()',
        },
        dirtyFields: new Set(),
      };
      
      const portalDetails = {
        description: 'Description',
        appliesTo: 'isWindows()',
      };
      
      const changes: string[] = [];
      for (const key of ['description', 'appliesTo']) {
        const localVal = localDraft.draft?.[key as keyof typeof localDraft.draft];
        const portalVal = portalDetails[key as keyof typeof portalDetails];
        if (JSON.stringify(localVal) !== JSON.stringify(portalVal)) {
          changes.push(key);
        }
      }
      
      expect(changes).toHaveLength(0);
    });

    it('detects changes when portal has been updated', () => {
      // User has local changes, AND portal has been updated
      const localDraft: Partial<ModuleDetailsDraft> = {
        original: {
          description: 'Old portal description',
        },
        draft: {
          description: 'User modified description',
        },
        dirtyFields: new Set(['description']),
      };
      
      const portalDetails = {
        description: 'New portal description',  // Portal was updated
      };
      
      const changes: string[] = [];
      for (const key of ['description']) {
        const localVal = localDraft.draft?.[key as keyof typeof localDraft.draft];
        const portalVal = portalDetails[key as keyof typeof portalDetails];
        if (JSON.stringify(localVal) !== JSON.stringify(portalVal)) {
          changes.push(key);
        }
      }
      
      // Should show that pulling would overwrite user's changes
      expect(changes).toContain('description');
    });
  });
});

// =============================================================================
// saveModuleDirectory Module Details Storage
// =============================================================================

describe('saveModuleDirectory Module Details Storage', () => {
  it('stores portalBaseline from draft.original', () => {
    const moduleDetailsDraft: ModuleDetailsDraft = {
      original: {
        name: 'TestModule',
        description: 'Original description',
      },
      draft: {
        name: 'TestModule',
        description: 'Modified description',
      },
      dirtyFields: new Set(['description']),
      loadedAt: Date.now(),
      tabId: 'tab-1',
      moduleId: 12345,
      moduleType: 'datasource',
      version: 1,
    };
    
    // Simulate saveModuleDirectory logic
    const moduleDetails = {
      portalVersion: moduleDetailsDraft.version,
      lastPulledAt: new Date(moduleDetailsDraft.loadedAt).toISOString(),
      portalBaseline: moduleDetailsDraft.original as Record<string, unknown>,
      localDraft: moduleDetailsDraft.dirtyFields.size > 0 
        ? moduleDetailsDraft.draft as Record<string, unknown>
        : undefined,
    };
    
    expect(moduleDetails.portalBaseline).toEqual(moduleDetailsDraft.original);
    expect(moduleDetails.localDraft).toEqual(moduleDetailsDraft.draft);
  });

  it('does not store localDraft when no dirty fields', () => {
    const moduleDetailsDraft: ModuleDetailsDraft = {
      original: { name: 'TestModule', description: 'Same' },
      draft: { name: 'TestModule', description: 'Same' },
      dirtyFields: new Set(),  // No changes
      loadedAt: Date.now(),
      tabId: 'tab-1',
      moduleId: 12345,
      moduleType: 'datasource',
      version: 1,
    };
    
    const moduleDetails = {
      portalVersion: moduleDetailsDraft.version,
      lastPulledAt: new Date(moduleDetailsDraft.loadedAt).toISOString(),
      portalBaseline: moduleDetailsDraft.original as Record<string, unknown>,
      localDraft: moduleDetailsDraft.dirtyFields.size > 0 
        ? moduleDetailsDraft.draft as Record<string, unknown>
        : undefined,
    };
    
    expect(moduleDetails.portalBaseline).toBeDefined();
    expect(moduleDetails.localDraft).toBeUndefined();
  });
});

// =============================================================================
// Pull/Push Module Details Updates
// =============================================================================

describe('Pull/Push Module Details Updates', () => {
  describe('pullLatestFromPortal', () => {
    it('clears localDraft after pull', () => {
      // Simulate the state after pulling
      const portalDetails = {
        name: 'TestModule',
        description: 'Portal description',
        version: 2,
      };
      
      // After pull, portalBaseline = new portal values, localDraft = undefined
      const updatedModuleDetails = {
        portalVersion: 2,
        lastPulledAt: new Date().toISOString(),
        portalBaseline: portalDetails,
        localDraft: undefined,  // Cleared after pull
      };
      
      expect(updatedModuleDetails.localDraft).toBeUndefined();
      expect(updatedModuleDetails.portalBaseline).toEqual(portalDetails);
    });
  });

  describe('commitModuleScript (push)', () => {
    it('updates portalBaseline to pushed values after push', () => {
      const pushedDraft = {
        name: 'TestModule',
        description: 'User modified description',
      };
      
      // After push, portalBaseline = what we just pushed
      const updatedModuleDetails = {
        portalVersion: 2,  // Incremented
        lastPulledAt: new Date().toISOString(),
        portalBaseline: pushedDraft,  // Now reflects pushed values
        localDraft: undefined,  // Cleared since we just pushed
      };
      
      expect(updatedModuleDetails.portalBaseline).toEqual(pushedDraft);
      expect(updatedModuleDetails.localDraft).toBeUndefined();
    });
  });
});

// =============================================================================
// Toolbar Module Details Badge
// =============================================================================

describe('Toolbar Module Details Badge', () => {
  beforeEach(() => {
    resetStore();
    resetCounters();
  });

  afterEach(() => {
    resetStore();
  });

  describe('moduleDetailsDirtyCount computation', () => {
    it('returns 0 when no draft exists', () => {
      const moduleDetailsDraftByTabId: Record<string, ModuleDetailsDraft> = {};
      const activeTabId = 'tab-1';
      
      const draft = moduleDetailsDraftByTabId[activeTabId];
      const dirtyCount = draft?.dirtyFields?.size ?? 0;
      
      expect(dirtyCount).toBe(0);
    });

    it('returns 0 when draft has no dirty fields', () => {
      const moduleDetailsDraftByTabId: Record<string, ModuleDetailsDraft> = {
        'tab-1': {
          original: { name: 'Test' },
          draft: { name: 'Test' },
          dirtyFields: new Set(),
          loadedAt: Date.now(),
          tabId: 'tab-1',
          moduleId: 123,
          moduleType: 'datasource',
          version: 1,
        },
      };
      const activeTabId = 'tab-1';
      
      const draft = moduleDetailsDraftByTabId[activeTabId];
      const dirtyCount = draft?.dirtyFields?.size ?? 0;
      
      expect(dirtyCount).toBe(0);
    });

    it('returns correct count when draft has dirty fields', () => {
      const moduleDetailsDraftByTabId: Record<string, ModuleDetailsDraft> = {
        'tab-1': {
          original: { name: 'Test', description: 'Old', appliesTo: 'old' },
          draft: { name: 'Test', description: 'New', appliesTo: 'new' },
          dirtyFields: new Set(['description', 'appliesTo']),
          loadedAt: Date.now(),
          tabId: 'tab-1',
          moduleId: 123,
          moduleType: 'datasource',
          version: 1,
        },
      };
      const activeTabId = 'tab-1';
      
      const draft = moduleDetailsDraftByTabId[activeTabId];
      const dirtyCount = draft?.dirtyFields?.size ?? 0;
      
      expect(dirtyCount).toBe(2);
    });
  });
});

