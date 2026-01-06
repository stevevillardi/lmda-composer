/**
 * Editor-specific types barrel export.
 * 
 * This file re-exports commonly used types from shared/types.ts
 * and provides editor-specific type definitions.
 * 
 * Future work: Migrate editor-only types from shared/types.ts to this directory.
 */

// Re-export all shared types for convenient imports
export type {
  // Core entities
  Portal,
  Collector,
  DeviceInfo,
  DeviceProperty,
  
  // Tabs
  EditorTab,
  EditorTabSource,
  EditorTabSourceType,
  EditorTabContextOverride,
  DocumentState,
  DraftScript,
  DraftTabs,
  
  // Modules
  LogicModule,
  LogicModuleInfo,
  LogicModuleType,
  
  // Script
  ScriptLanguage,
  ScriptMode,
  
  // Execution
  ExecutionResult,
  ExecutionHistoryEntry,
  
  // Preferences
  UserPreferences,
  
  // API Explorer
  ApiTabState,
  ApiHistoryEntry,
  
  // Messages
  EditorToSWMessage,
  SWToEditorMessage,
} from '@/shared/types';

// Re-export constants
export { DEFAULT_PREFERENCES } from '@/shared/types';

