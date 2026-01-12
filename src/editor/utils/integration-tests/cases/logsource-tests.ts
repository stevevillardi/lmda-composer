/**
 * LogSource integration tests.
 */

import type { TestSuite, TestCase, TestContext } from '../test-types';
import {
  createLogSourcePayload,
  createLogSourceWithFiltersPayload,
  createLogSourceWithLogFieldsPayload,
  createLogSourceWithResourceMappingsPayload,
} from '../test-data';
import {
  assertModuleCreated,
  assertApiSuccess,
  assertDefined,
  assertEqual,
  assertGreaterThan,
} from '../assertions';

/**
 * Helper to create a LogSource and verify it was created.
 */
async function createAndVerifyLogSource(
  context: TestContext,
  payload: ReturnType<typeof createLogSourcePayload>
): Promise<number> {
  context.log(`Creating LogSource: ${payload.name}`);
  
  // Capture the request payload for debugging
  context.captureRequest({
    type: 'CREATE_MODULE',
    moduleType: 'logsource',
    modulePayload: payload,
  });
  
  const result = await context.sendMessage({
    type: 'CREATE_MODULE',
    payload: {
      portalId: context.portalId,
      moduleType: 'logsource',
      modulePayload: payload,
    },
  });
  
  // Capture the response for debugging
  context.captureResponse(result);
  
  assertModuleCreated(result, 'Failed to create LogSource');
  const moduleId = result.data.moduleId;
  
  context.registerModuleForCleanup('logsource', moduleId);
  context.log(`Created LogSource with ID: ${moduleId}`);
  
  return moduleId;
}

/**
 * Helper to fetch module details.
 */
async function fetchModuleDetails(
  context: TestContext,
  moduleId: number
): Promise<Record<string, unknown>> {
  context.log(`Fetching module details for ID: ${moduleId}`);
  
  const result = await context.sendMessage({
    type: 'FETCH_MODULE_DETAILS',
    payload: {
      portalId: context.portalId,
      moduleType: 'logsource',
      moduleId,
    },
  });
  
  assertApiSuccess(result, 'Failed to fetch module details');
  assertDefined(result.data.module, 'Module details not returned');
  
  return result.data.module as Record<string, unknown>;
}

// =============================================================================
// Test Cases
// =============================================================================

const createBasicLogSourceTest: TestCase = {
  id: 'ls-create-basic',
  name: 'Create Basic LogSource',
  description: 'Creates a basic LogSource and verifies creation',
  moduleType: 'logsource',
  tags: ['create'],
  run: async (context) => {
    const payload = createLogSourcePayload();
    const moduleId = await createAndVerifyLogSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
    assertDefined(module.id, 'Module ID not set');
  },
};

const createLogSourceWithFiltersTest: TestCase = {
  id: 'ls-create-with-filters',
  name: 'Create LogSource with Filters',
  description: 'Creates a LogSource with filters and verifies they are persisted',
  moduleType: 'logsource',
  variant: 'with-filters',
  tags: ['create', 'filters'],
  run: async (context) => {
    const payload = createLogSourceWithFiltersPayload();
    const moduleId = await createAndVerifyLogSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
    
    // Verify filters
    const filters = module.filters as unknown[];
    assertDefined(filters, 'Filters should be present');
    assertEqual(filters.length, 2, 'Should have 2 filters');
    
    // Verify filter operator
    const collectionAttr = module.collectionAttribute as Record<string, unknown> | undefined;
    assertEqual(collectionAttr?.filterOp, 'AND', 'Filter operator should be AND');
    
    context.log(`Created LogSource with ${filters.length} filters`);
  },
};

const createLogSourceWithLogFieldsTest: TestCase = {
  id: 'ls-create-with-log-fields',
  name: 'Create LogSource with Log Fields',
  description: 'Creates a LogSource with log fields (Static, Regex, Token) and verifies',
  moduleType: 'logsource',
  variant: 'with-log-fields',
  tags: ['create', 'log-fields'],
  run: async (context) => {
    const payload = createLogSourceWithLogFieldsPayload();
    const moduleId = await createAndVerifyLogSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
    
    // Verify log fields
    const logFields = module.logFields as Array<{ method: string }>;
    assertDefined(logFields, 'Log fields should be present');
    assertEqual(logFields.length, 3, 'Should have 3 log fields');
    
    // Verify methods
    const methods = logFields.map(f => f.method);
    assertEqual(methods.includes('Static'), true, 'Should have Static method');
    assertEqual(methods.includes('Regex'), true, 'Should have Regex method');
    assertEqual(methods.includes('Token'), true, 'Should have Token method');
    
    context.log(`Created LogSource with ${logFields.length} log fields`);
  },
};

const createLogSourceWithResourceMappingsTest: TestCase = {
  id: 'ls-create-with-resource-mappings',
  name: 'Create LogSource with Resource Mappings',
  description: 'Creates a LogSource with resource mappings and verifies indexing',
  moduleType: 'logsource',
  variant: 'with-resource-mappings',
  tags: ['create', 'resource-mappings'],
  run: async (context) => {
    const payload = createLogSourceWithResourceMappingsPayload();
    const moduleId = await createAndVerifyLogSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
    
    // Verify resource mappings
    const mappings = module.resourceMapping as Array<{ index: number; key: string }>;
    assertDefined(mappings, 'Resource mappings should be present');
    assertEqual(mappings.length, 3, 'Should have 3 resource mappings');
    
    // Verify operator
    const collectionAttr = module.collectionAttribute as Record<string, unknown> | undefined;
    assertEqual(collectionAttr?.resourceMappingOp, 'OR', 'Resource mapping operator should be OR');
    
    context.log(`Created LogSource with ${mappings.length} resource mappings`);
  },
};

const modifyFiltersTest: TestCase = {
  id: 'ls-modify-filters',
  name: 'Modify LogSource Filters',
  description: 'Creates a LogSource, adds a filter, and verifies it persists',
  moduleType: 'logsource',
  tags: ['modify', 'filters'],
  run: async (context) => {
    const payload = createLogSourcePayload();
    const moduleId = await createAndVerifyLogSource(context, payload);
    
    // Add filters via commit
    const newFilters = [
      {
        index: '',
        attribute: 'Message',
        operator: 'Contain',
        value: 'added_filter_test',
        comment: 'Added by test',
        include: 'y',
      },
    ];
    
    const commitPayload = {
      portalId: context.portalId,
      moduleType: 'logsource' as const,
      moduleId,
      scriptType: 'collection' as const,
      moduleDetails: {
        filters: newFilters,
        collectionAttribute: {
          filterOp: 'AND',
        },
      },
    };
    
    context.log('Pushing filters...');
    // Capture the commit request/response for debugging
    context.captureRequest({ type: 'COMMIT_MODULE_SCRIPT', ...commitPayload });
    
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: commitPayload,
    });
    
    context.captureResponse(commitResult);
    
    assertApiSuccess(commitResult, 'Failed to commit filter changes');
    
    // Verify
    const updatedModule = await fetchModuleDetails(context, moduleId);
    const filters = (updatedModule.filters as unknown[]) || [];
    
    assertGreaterThan(filters.length, 0, 'Should have at least one filter');
    context.log(`Final filters count: ${filters.length}`);
  },
};

const modifyResourceMappingOrderTest: TestCase = {
  id: 'ls-modify-resource-mapping-order',
  name: 'Modify Resource Mapping Order',
  description: 'Creates a LogSource with resource mappings, reorders them, and verifies indices update',
  moduleType: 'logsource',
  tags: ['modify', 'resource-mappings', 'reorder'],
  run: async (context) => {
    const payload = createLogSourceWithResourceMappingsPayload();
    const moduleId = await createAndVerifyLogSource(context, payload);
    
    // Fetch initial mappings
    const initialModule = await fetchModuleDetails(context, moduleId);
    const initialMappings = (initialModule.resourceMapping as Array<{ index: number; key: string; id?: string; method?: string; value?: string; comment?: string }>) || [];
    assertEqual(initialMappings.length, 3, 'Should have 3 initial mappings');
    
    // Log initial state for debugging
    context.log(`Initial mappings: ${JSON.stringify(initialMappings.map(m => ({ id: m.id, index: m.index, key: m.key })))}`);
    
    // Get the keys in their initial order (sorted by index)
    const sortedInitial = [...initialMappings].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const thirdKey = sortedInitial[2]?.key;
    const firstKey = sortedInitial[0]?.key;
    const secondKey = sortedInitial[1]?.key;
    
    // Reorder: move what was at index 2 to index 0, shift others down
    // Include all fields from the original mappings including id
    const reorderedMappings = [
      { 
        id: sortedInitial[2]?.id,
        index: 0, 
        key: sortedInitial[2]?.key,
        method: sortedInitial[2]?.method,
        value: sortedInitial[2]?.value,
        comment: sortedInitial[2]?.comment,
      },
      { 
        id: sortedInitial[0]?.id,
        index: 1, 
        key: sortedInitial[0]?.key,
        method: sortedInitial[0]?.method,
        value: sortedInitial[0]?.value,
        comment: sortedInitial[0]?.comment,
      },
      { 
        id: sortedInitial[1]?.id,
        index: 2, 
        key: sortedInitial[1]?.key,
        method: sortedInitial[1]?.method,
        value: sortedInitial[1]?.value,
        comment: sortedInitial[1]?.comment,
      },
    ];
    
    context.log(`Reordered mappings to send: ${JSON.stringify(reorderedMappings.map(m => ({ id: m.id, index: m.index, key: m.key })))}`);
    
    const commitPayload = {
      portalId: context.portalId,
      moduleType: 'logsource' as const,
      moduleId,
      scriptType: 'collection' as const,
      moduleDetails: {
        resourceMapping: reorderedMappings,
      },
    };
    
    context.log('Pushing reordered mappings...');
    context.captureRequest({ type: 'COMMIT_MODULE_SCRIPT', ...commitPayload });
    
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: commitPayload,
    });
    
    context.captureResponse(commitResult);
    
    assertApiSuccess(commitResult, 'Failed to commit reordered mappings');
    
    // Verify order changed
    const updatedModule = await fetchModuleDetails(context, moduleId);
    const finalMappings = (updatedModule.resourceMapping as Array<{ index: number; key: string }>) || [];
    
    assertEqual(finalMappings.length, 3, 'Should still have 3 mappings');
    
    // Sort by index to check the new order
    const sortedFinal = [...finalMappings].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    context.log(`Final mappings: ${JSON.stringify(sortedFinal.map(m => ({ index: m.index, key: m.key })))}`);
    
    // The mapping at index 0 should now have the key that was previously at index 2
    assertEqual(sortedFinal[0]?.key, thirdKey, `Mapping at index 0 should now be "${thirdKey}" (was at index 2)`);
    // The mapping at index 1 should now have the key that was previously at index 0
    assertEqual(sortedFinal[1]?.key, firstKey, `Mapping at index 1 should now be "${firstKey}" (was at index 0)`);
    // The mapping at index 2 should now have the key that was previously at index 1
    assertEqual(sortedFinal[2]?.key, secondKey, `Mapping at index 2 should now be "${secondKey}" (was at index 1)`);
    
    context.log('Resource mapping reorder successful');
  },
};

const pushPullRoundTripTest: TestCase = {
  id: 'ls-push-pull-roundtrip',
  name: 'LogSource Push/Pull Round Trip',
  description: 'Full round-trip test with filters, log fields, and resource mappings',
  moduleType: 'logsource',
  tags: ['push', 'pull', 'roundtrip'],
  run: async (context) => {
    const payload = createLogSourcePayload();
    const moduleId = await createAndVerifyLogSource(context, payload);
    
    // Add all types of LogSource-specific data
    const modifications = {
      description: 'Updated LogSource description',
      filters: [
        {
          index: '',
          attribute: 'Message',
          operator: 'Contain',
          value: 'roundtrip_test',
          comment: 'Round-trip test filter',
          include: 'y',
        },
      ],
      logFields: [
        {
          key: 'roundtrip_field',
          method: 'Static',
          value: 'roundtrip_value',
          comment: 'Round-trip test field',
        },
      ],
      resourceMapping: [
        {
          index: 0,
          key: 'system.hostname',
          method: 'Static',
          value: 'roundtrip_host',
          comment: 'Round-trip test mapping',
        },
      ],
      collectionAttribute: {
        filterOp: 'OR',
        resourceMappingOp: 'AND',
      },
    };
    
    const commitPayload = {
      portalId: context.portalId,
      moduleType: 'logsource' as const,
      moduleId,
      scriptType: 'collection' as const,
      moduleDetails: modifications,
    };
    
    context.log('Pushing comprehensive modifications...');
    // Capture the commit request/response for debugging
    context.captureRequest({ type: 'COMMIT_MODULE_SCRIPT', ...commitPayload });
    
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: commitPayload,
    });
    
    context.captureResponse(commitResult);
    
    assertApiSuccess(commitResult, 'Failed to commit modifications');
    
    // Fetch and verify all changes persisted
    const updatedModule = await fetchModuleDetails(context, moduleId);
    
    assertEqual(updatedModule.description, modifications.description, 'Description mismatch');
    
    const filters = (updatedModule.filters as unknown[]) || [];
    assertGreaterThan(filters.length, 0, 'Filters should be present');
    
    const logFields = (updatedModule.logFields as unknown[]) || [];
    assertGreaterThan(logFields.length, 0, 'Log fields should be present');
    
    const mappings = (updatedModule.resourceMapping as unknown[]) || [];
    assertGreaterThan(mappings.length, 0, 'Resource mappings should be present');
    
    const collectionAttr = updatedModule.collectionAttribute as Record<string, unknown> | undefined;
    assertEqual(collectionAttr?.filterOp, 'OR', 'Filter operator should be OR');
    assertEqual(collectionAttr?.resourceMappingOp, 'AND', 'Resource mapping operator should be AND');
    
    context.log('Push/pull round-trip successful with all LogSource fields');
  },
};

// =============================================================================
// Test Suite
// =============================================================================

export const logSourceTestSuite: TestSuite = {
  id: 'logsource-suite',
  name: 'LogSource Tests',
  description: 'Integration tests for LogSource CRUD operations including filters, log fields, and resource mappings',
  moduleType: 'logsource',
  tests: [
    createBasicLogSourceTest,
    createLogSourceWithFiltersTest,
    createLogSourceWithLogFieldsTest,
    createLogSourceWithResourceMappingsTest,
    modifyFiltersTest,
    modifyResourceMappingOrderTest,
    pushPullRoundTripTest,
  ],
};
