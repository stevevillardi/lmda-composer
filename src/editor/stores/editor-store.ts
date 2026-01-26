import { create, type StoreApi } from 'zustand';
import { createUISlice, type UISlice, uiSliceInitialState } from './slices/ui-slice';
import { createPortalSlice, type PortalSlice, portalSliceInitialState } from './slices/portal-slice';
import { createTabsSlice, type TabsSlice, tabsSliceInitialState } from './slices/tabs-slice';
import { createToolsSlice, type ToolsSlice, toolsSliceInitialState } from './slices/tools-slice';
import { createAPISlice, type APISlice, apiSliceInitialState } from './slices/api-slice';
import { createExecutionSlice, type ExecutionSlice, executionSliceInitialState } from './slices/execution-slice';
import { createModuleSlice, type ModuleSlice, moduleSliceInitialState } from './slices/module-slice';
import { createCollectorSizingSlice, type CollectorSizingSlice, collectorSizingSliceInitialState } from './slices/collector-sizing-slice';

/**
 * Combined EditorState - extends all slice interfaces.
 * All state and actions are defined in their respective slice files:
 * - UISlice: UI state (dialogs, sidebars, preferences)
 * - PortalSlice: Portal/collector/device context
 * - TabsSlice: Tab management, file operations, drafts
 * - ToolsSlice: Device properties, snippets, AppliesTo, debug commands, module snippets/lineage/details
 * - APISlice: API Explorer functionality
 * - ExecutionSlice: Script execution and history
 * - ModuleSlice: Module browser, search, commit, clone, pull
 * - CollectorSizingSlice: Collector sizing calculator
 */
type EditorState = UISlice & PortalSlice & TabsSlice & ToolsSlice & APISlice & ExecutionSlice & ModuleSlice & CollectorSizingSlice;

export const useEditorStore = create<EditorState>((set, get) => ({
  // Portal slice initial state (spread from portalSliceInitialState)
  ...portalSliceInitialState,
  
  // Tabs slice initial state (spread from tabsSliceInitialState)
  ...tabsSliceInitialState,

  // API slice initial state (spread from apiSliceInitialState)
  ...apiSliceInitialState,
  
  // Execution slice initial state (spread from executionSliceInitialState)
  ...executionSliceInitialState,
  
  // Module slice initial state (spread from moduleSliceInitialState)
  ...moduleSliceInitialState,
  
  // UI slice initial state (spread from uiSliceInitialState)
  ...uiSliceInitialState,
  
  // Tools slice initial state (spread from toolsSliceInitialState)
  ...toolsSliceInitialState,

  // Collector Sizing slice initial state (spread from collectorSizingSliceInitialState)
  ...collectorSizingSliceInitialState,

  // Portal slice actions - spread from createPortalSlice
  ...createPortalSlice(set, get, {} as StoreApi<EditorState>),

  // Tabs slice actions - spread from createTabsSlice
  ...createTabsSlice(set, get, {} as StoreApi<EditorState>),

  // UI state actions - spread from createUISlice
  ...createUISlice(set, get, {} as StoreApi<EditorState>),

  // Execution state and actions - spread from createExecutionSlice
  ...createExecutionSlice(set, get, {} as StoreApi<EditorState>),

  // Module state and actions - spread from createModuleSlice
  ...createModuleSlice(set, get, {} as StoreApi<EditorState>),

  // API state and actions - spread from createAPISlice
  ...createAPISlice(set, get, {} as StoreApi<EditorState>),

  // Tools state and actions - spread from createToolsSlice
  ...createToolsSlice(set, get, {} as StoreApi<EditorState>),

  // Collector Sizing state and actions - spread from createCollectorSizingSlice
  ...createCollectorSizingSlice(set, get, {} as StoreApi<EditorState>),
}));
