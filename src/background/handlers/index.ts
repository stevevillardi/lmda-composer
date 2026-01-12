/**
 * Message handler barrel exports and registry.
 */

export * from './types';

// Portal handlers
export {
  handleDiscoverPortals,
  handleCsrfToken,
  handleGetCollectors,
  handleGetDevices,
  handleGetDeviceById,
  handleGetDeviceProperties,
  handleOpenEditor,
  openEditorWindow,
} from './portal-handlers';

// Execution handlers
export {
  handleExecuteScript,
  handleExecuteApiRequest,
  handleCancelExecution,
  handleTestAppliesTo,
  handleExecuteDebugCommand,
  handleCancelDebugCommand,
} from './execution-handlers';

// Module handlers
export {
  handleFetchModules,
  handleFetchModule,
  handleFetchLineageVersions,
  handleFetchModuleDetails,
  handleFetchAccessGroups,
  handleCommitModuleScript,
  handleCreateModule,
  handleDeleteModule,
  handleSearchModuleScripts,
  handleSearchDatapoints,
  handleCancelModuleSearch,
  handleRefreshModuleIndex,
} from './module-handlers';

// Custom function handlers
export {
  handleFetchCustomFunctions,
  handleCreateCustomFunction,
  handleUpdateCustomFunction,
  handleDeleteCustomFunction,
} from './custom-function-handlers';

// Snippets handlers
export {
  handleGetModuleSnippetsCache,
  handleClearModuleSnippetsCache,
  handleFetchModuleSnippets,
  handleFetchModuleSnippetSource,
} from './snippets-handlers';

