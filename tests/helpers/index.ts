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

// Chrome mock helpers (re-exported from setup)
export {
  resetChromeMocks,
  mockSendMessageResponse,
  mockSendMessageError,
  getChromeMock,
} from '../setup';

