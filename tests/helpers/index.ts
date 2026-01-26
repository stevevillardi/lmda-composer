/**
 * Test helpers barrel export.
 *
 * Usage:
 *   import { createMockTab, resetStore, mockSendMessageResponse } from './helpers';
 */

// Store helpers
export {
  resetStore,
  getStoreState,
  setStoreState,
  createMockTab,
  createMockModuleTab,
  createMockFileTab,
  createMockPortal,
  createMockCollector,
  createMockDevice,
  setupConnectedPortal,
  resetCounters,
} from './store-helpers';

// Collector sizing helpers
export {
  createMockDeviceConfig,
  createMockLogConfig,
  createMockTrapConfig,
  createMockFlowConfig,
  createMockCollectorRecommendation,
  createMockSite,
  createMockSiteWithDevices,
  createMockSiteWithLogs,
  createMockSiteWithFlows,
  createMockConfig,
  resetSiteCounter,
  createEmptyDevices,
  createEmptyLogs,
  createEmptyTraps,
  createEmptyFlows,
  createZeroCountDevices,
  createZeroCountLogs,
  createZeroCountTraps,
  createZeroCountFlows,
  createDefaultDevices,
  createDefaultLogs,
  createDefaultTraps,
  createDefaultFlows,
  createDefaultMethodWeights,
  createDefaultCollectorCapacities,
  createDefaultDeviceTypeDefaults,
} from './collector-sizing-helpers';

// Chrome mock helpers (re-exported from setup)
export {
  resetChromeMocks,
  mockSendMessageResponse,
  mockSendMessageError,
  getChromeMock,
} from '../setup';

