/**
 * Test helpers for Zustand store testing.
 * 
 * Provides factory functions for creating mock data structures
 * and utilities for store state management in tests.
 */
import type { 
  EditorTab, 
  Portal, 
  Collector,
  DeviceInfo,
  EditorTabSource,
  DocumentState,
  ScriptLanguage,
  ScriptMode,
  LogicModuleType,
} from '../../src/shared/types';
import { useEditorStore } from '../../src/editor/stores/editor-store';

// =============================================================================
// Store State Management
// =============================================================================

/** Capture initial state for reset */
const initialState = useEditorStore.getState();

/**
 * Reset the editor store to its initial state.
 * Call in beforeEach() to ensure clean state between tests.
 */
export function resetStore(): void {
  useEditorStore.setState(initialState, true);
}

/**
 * Get the current store state (useful for assertions).
 */
export function getStoreState() {
  return useEditorStore.getState();
}

/**
 * Set partial store state for test setup.
 */
export function setStoreState(partial: Partial<ReturnType<typeof useEditorStore.getState>>): void {
  useEditorStore.setState(partial);
}

// =============================================================================
// EditorTab Factory
// =============================================================================

interface CreateMockTabOptions {
  id?: string;
  displayName?: string;
  content?: string;
  language?: ScriptLanguage;
  mode?: ScriptMode;
  source?: EditorTabSource;
  document?: DocumentState;
  kind?: 'script' | 'api';
}

let tabCounter = 0;

/**
 * Create a mock EditorTab with sensible defaults.
 * All properties can be overridden.
 * Document type is inferred from kind/source if not explicitly provided.
 */
export function createMockTab(options: CreateMockTabOptions = {}): EditorTab {
  const id = options.id ?? `tab-${++tabCounter}`;
  
  // Infer document type from kind/source if not provided
  let document = options.document;
  if (!document) {
    if (options.kind === 'api') {
      document = { type: 'api' };
    } else if (options.source?.type === 'history') {
      document = { type: 'history' };
    } else {
      document = { type: 'scratch' };
    }
  }
  
  return {
    id,
    displayName: options.displayName ?? 'Untitled.groovy',
    content: options.content ?? '',
    language: options.language ?? 'groovy',
    mode: options.mode ?? 'freeform',
    kind: options.kind ?? 'script',
    source: options.source,
    document,
  };
}

/**
 * Create a mock module-bound tab (imported from portal).
 */
export function createMockModuleTab(overrides: Partial<CreateMockTabOptions & {
  moduleId?: number;
  moduleType?: LogicModuleType;
  scriptType?: 'collection' | 'ad';
  portalId?: string;
  portalHostname?: string;
}> = {}): EditorTab {
  const {
    moduleId = 12345,
    moduleType = 'datasource',
    scriptType = 'collection',
    portalId = 'portal-1',
    portalHostname = 'test.logicmonitor.com',
    ...tabOptions
  } = overrides;

  const content = tabOptions.content ?? '';

  return createMockTab({
    displayName: `TestModule/${scriptType}.groovy`,
    mode: scriptType === 'ad' ? 'ad' : 'collection',
    source: {
      type: 'module',
      moduleId,
      moduleType,
      scriptType,
      portalId,
      portalHostname,
    },
    document: {
      type: 'portal',
      portal: {
        id: portalId,
        hostname: portalHostname,
        moduleId,
        moduleType,
        moduleName: 'TestModule',
        scriptType,
        lastKnownContent: content,
      },
    },
    content,
    ...tabOptions,
  });
}

/**
 * Create a mock local file tab.
 */
export function createMockFileTab(overrides: Partial<CreateMockTabOptions & {
  fileName?: string;
}> = {}): EditorTab {
  const { fileName = 'test-script.groovy', ...tabOptions } = overrides;
  
  return createMockTab({
    displayName: fileName,
    source: { type: 'file' },
    document: {
      type: 'local',
      file: {
        handleId: `handle-${Date.now()}`,
        lastSavedContent: tabOptions.content ?? '',
        fileName,
      },
    },
    ...tabOptions,
  });
}

// =============================================================================
// Portal Factory
// =============================================================================

interface CreateMockPortalOptions {
  id?: string;
  hostname?: string;
  displayName?: string;
  csrfToken?: string | null;
  csrfTokenTimestamp?: number | null;
  tabIds?: number[];
  status?: 'active' | 'expired' | 'unknown';
}

let portalCounter = 0;

/**
 * Create a mock Portal with sensible defaults.
 */
export function createMockPortal(options: CreateMockPortalOptions = {}): Portal {
  const counter = ++portalCounter;
  
  return {
    id: options.id ?? `portal-${counter}`,
    hostname: options.hostname ?? `test${counter}.logicmonitor.com`,
    displayName: options.displayName ?? `Test Portal ${counter}`,
    csrfToken: options.csrfToken ?? 'mock-csrf-token',
    csrfTokenTimestamp: options.csrfTokenTimestamp ?? Date.now(),
    tabIds: options.tabIds ?? [1000 + counter],
    status: options.status ?? 'active',
  };
}

// =============================================================================
// Collector Factory
// =============================================================================

interface CreateMockCollectorOptions {
  id?: number;
  description?: string;
  hostname?: string;
  status?: number;
  isDown?: boolean;
  collectorGroupName?: string;
  arch?: string;
}

let collectorCounter = 0;

/**
 * Create a mock Collector with sensible defaults.
 */
export function createMockCollector(options: CreateMockCollectorOptions = {}): Collector {
  const counter = ++collectorCounter;
  
  return {
    id: options.id ?? counter,
    description: options.description ?? `Collector ${counter}`,
    hostname: options.hostname ?? `collector-${counter}.local`,
    status: options.status ?? 0,
    isDown: options.isDown ?? false,
    collectorGroupName: options.collectorGroupName ?? 'Default',
    arch: options.arch ?? 'amd64',
  };
}

// =============================================================================
// Device Factory
// =============================================================================

interface CreateMockDeviceOptions {
  id?: number;
  name?: string;
  displayName?: string;
  currentCollectorId?: number;
  hostStatus?: string;
}

let deviceCounter = 0;

/**
 * Create a mock DeviceInfo with sensible defaults.
 */
export function createMockDevice(options: CreateMockDeviceOptions = {}): DeviceInfo {
  const counter = ++deviceCounter;
  
  return {
    id: options.id ?? counter,
    name: options.name ?? `device-${counter}`,
    displayName: options.displayName ?? `Device ${counter}`,
    currentCollectorId: options.currentCollectorId ?? 1,
    hostStatus: options.hostStatus ?? 'normal',
  };
}

// =============================================================================
// Test Scenario Builders
// =============================================================================

/**
 * Set up store with a basic portal-connected state.
 * Useful for testing features that require an active portal.
 */
export function setupConnectedPortal(options: {
  portal?: Partial<CreateMockPortalOptions>;
  collector?: Partial<CreateMockCollectorOptions>;
  tabs?: EditorTab[];
} = {}) {
  const portal = createMockPortal(options.portal);
  const collector = createMockCollector(options.collector);
  const tabs = options.tabs ?? [createMockTab()];
  
  setStoreState({
    portals: [portal],
    selectedPortalId: portal.id,
    collectorsByPortal: {
      [portal.id]: [collector],
    },
    selectedCollectorByPortal: {
      [portal.id]: collector.id,
    },
    tabs,
    activeTabId: tabs[0]?.id ?? null,
  });

  return { portal, collector, tabs };
}

/**
 * Reset counter values between tests.
 * Call in afterEach() if you need predictable IDs.
 */
export function resetCounters(): void {
  tabCounter = 0;
  portalCounter = 0;
  collectorCounter = 0;
  deviceCounter = 0;
}

