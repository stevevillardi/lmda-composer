/**
 * Store slices barrel export.
 * 
 * This file exports all slice types and creators for composing the main store.
 * 
 * Note: The slices are currently placeholder definitions. The actual implementation
 * remains in editor-store.ts. These slices define the typed interfaces and initial
 * state for future extraction.
 */

// Types utility
export * from './types';

// Portal slice
export type { PortalSlice, PortalSliceState, PortalSliceActions } from './portal-slice';
export { createPortalSlice, portalSliceInitialState } from './portal-slice';

// UI slice  
export type { UISlice, UISliceState, UISliceActions } from './ui-slice';
export { createUISlice, uiSliceInitialState } from './ui-slice';

// Tabs slice
export type { TabsSlice, TabsSliceState, TabsSliceActions } from './tabs-slice';
export { createTabsSlice, tabsSliceInitialState } from './tabs-slice';

// Execution slice
export type { ExecutionSlice, ExecutionSliceState, ExecutionSliceActions } from './execution-slice';
export { createExecutionSlice, executionSliceInitialState } from './execution-slice';

// Module slice
export type { ModuleSlice, ModuleSliceState, ModuleSliceActions } from './module-slice';
export { createModuleSlice, moduleSliceInitialState } from './module-slice';

// API slice
export type { APISlice, APISliceState, APISliceActions } from './api-slice';
export { createAPISlice, apiSliceInitialState } from './api-slice';

// Tools slice
export type { ToolsSlice, ToolsSliceState, ToolsSliceActions } from './tools-slice';
export { createToolsSlice, toolsSliceInitialState } from './tools-slice';

/**
 * Combined state type from all slices.
 * 
 * Note: This is the target state shape when all slices are fully extracted.
 * Currently, EditorState in editor-store.ts is the source of truth.
 */
import type { PortalSliceState, PortalSliceActions } from './portal-slice';
import type { UISliceState, UISliceActions } from './ui-slice';
import type { TabsSliceState, TabsSliceActions } from './tabs-slice';
import type { ExecutionSliceState, ExecutionSliceActions } from './execution-slice';
import type { ModuleSliceState, ModuleSliceActions } from './module-slice';
import type { APISliceState, APISliceActions } from './api-slice';
import type { ToolsSliceState, ToolsSliceActions } from './tools-slice';

export type CombinedSliceState = 
  & PortalSliceState 
  & UISliceState 
  & TabsSliceState 
  & ExecutionSliceState 
  & ModuleSliceState 
  & APISliceState 
  & ToolsSliceState;

/**
 * Combined actions type from all slices.
 */
export type CombinedSliceActions = 
  & PortalSliceActions 
  & UISliceActions 
  & TabsSliceActions 
  & ExecutionSliceActions 
  & ModuleSliceActions 
  & APISliceActions 
  & ToolsSliceActions;

