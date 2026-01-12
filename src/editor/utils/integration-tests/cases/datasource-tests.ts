/**
 * DataSource integration tests.
 */

import type { TestSuite, TestCase, TestContext } from '../test-types';
import {
  createDataSourceGroovyPayload,
  createDataSourcePowerShellPayload,
  createDataSourceBatchScriptPayload,
  createDataSourceWithADPayload,
} from '../test-data';
import {
  assertModuleCreated,
  assertApiSuccess,
  assertDefined,
  assertEqual,
  assertGreaterThan,
} from '../assertions';

/**
 * Helper to create a DataSource and verify it was created.
 */
async function createAndVerifyDataSource(
  context: TestContext,
  payload: ReturnType<typeof createDataSourceGroovyPayload>
): Promise<number> {
  context.log(`Creating DataSource: ${payload.name}`);
  
  // Capture the request payload for debugging
  context.captureRequest({
    type: 'CREATE_MODULE',
    moduleType: 'datasource',
    modulePayload: payload,
  });
  
  const result = await context.sendMessage({
    type: 'CREATE_MODULE',
    payload: {
      portalId: context.portalId,
      moduleType: 'datasource',
      modulePayload: payload,
    },
  });
  
  // Capture the response for debugging
  context.captureResponse(result);
  
  assertModuleCreated(result, 'Failed to create DataSource');
  const moduleId = result.data.moduleId;
  
  context.registerModuleForCleanup('datasource', moduleId);
  context.log(`Created DataSource with ID: ${moduleId}`);
  
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
      moduleType: 'datasource',
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

const createGroovyDataSourceTest: TestCase = {
  id: 'ds-create-groovy',
  name: 'Create Groovy DataSource',
  description: 'Creates a DataSource with a Groovy collection script and verifies creation',
  moduleType: 'datasource',
  variant: 'groovy',
  tags: ['create', 'groovy'],
  run: async (context) => {
    const payload = createDataSourceGroovyPayload();
    const moduleId = await createAndVerifyDataSource(context, payload);
    
    // Verify the module was created correctly
    const module = await fetchModuleDetails(context, moduleId);
    
    assertEqual(module.name, payload.name, 'Module name mismatch');
    assertDefined(module.id, 'Module ID not set');
    assertGreaterThan(module.id as number, 0, 'Module ID should be positive');
  },
};

const createPowerShellDataSourceTest: TestCase = {
  id: 'ds-create-powershell',
  name: 'Create PowerShell DataSource',
  description: 'Creates a DataSource with a PowerShell collection script and verifies creation',
  moduleType: 'datasource',
  variant: 'powershell',
  tags: ['create', 'powershell'],
  run: async (context) => {
    const payload = createDataSourcePowerShellPayload();
    const moduleId = await createAndVerifyDataSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
  },
};

const createBatchScriptDataSourceTest: TestCase = {
  id: 'ds-create-batchscript',
  name: 'Create BatchScript DataSource',
  description: 'Creates a DataSource with a batch script and verifies creation',
  moduleType: 'datasource',
  variant: 'batchscript',
  tags: ['create', 'batchscript'],
  run: async (context) => {
    const payload = createDataSourceBatchScriptPayload();
    const moduleId = await createAndVerifyDataSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
  },
};

const createDataSourceWithADTest: TestCase = {
  id: 'ds-create-with-ad',
  name: 'Create DataSource with Auto-Discovery',
  description: 'Creates a DataSource with auto-discovery enabled and verifies AD configuration',
  moduleType: 'datasource',
  variant: 'with-ad',
  tags: ['create', 'auto-discovery'],
  run: async (context) => {
    const payload = createDataSourceWithADPayload();
    const moduleId = await createAndVerifyDataSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
    assertEqual(module.enableAutoDiscovery, true, 'Auto-discovery should be enabled');
    assertDefined(module.autoDiscoveryConfig, 'Auto-discovery config should be present');
  },
};

const modifyDatapointsTest: TestCase = {
  id: 'ds-modify-datapoints',
  name: 'Modify DataSource Datapoints',
  description: 'Creates a DataSource, adds datapoints, and verifies they persist',
  moduleType: 'datasource',
  variant: 'groovy',
  tags: ['modify', 'datapoints'],
  run: async (context) => {
    // Create initial DataSource
    const payload = createDataSourceGroovyPayload();
    const moduleId = await createAndVerifyDataSource(context, payload);
    
    // Fetch initial state
    const initialModule = await fetchModuleDetails(context, moduleId);
    const initialDatapoints = (initialModule.dataPoints as unknown[]) || [];
    context.log(`Initial datapoints count: ${initialDatapoints.length}`);
    
    // Add a new datapoint via commit
    const newDatapoint = {
      name: 'NewTestMetric',
      description: 'Added by integration test',
      type: 7,
      alertForNoData: 0,
    };
    
    const updatedDatapoints = [...initialDatapoints, newDatapoint];
    
    context.log('Pushing updated datapoints...');
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: {
        portalId: context.portalId,
        moduleType: 'datasource',
        moduleId,
        scriptType: 'collection',
        moduleDetails: {
          dataPoints: updatedDatapoints,
        },
      },
    });
    
    assertApiSuccess(commitResult, 'Failed to commit datapoint changes');
    
    // Fetch and verify
    const updatedModule = await fetchModuleDetails(context, moduleId);
    const finalDatapoints = (updatedModule.dataPoints as unknown[]) || [];
    
    assertGreaterThan(finalDatapoints.length, initialDatapoints.length, 'Datapoint count should have increased');
    context.log(`Final datapoints count: ${finalDatapoints.length}`);
  },
};

const modifyAppliesToTest: TestCase = {
  id: 'ds-modify-appliesto',
  name: 'Modify DataSource AppliesTo',
  description: 'Creates a DataSource, modifies appliesTo, and verifies the change persists',
  moduleType: 'datasource',
  tags: ['modify', 'appliesTo'],
  run: async (context) => {
    const payload = createDataSourceGroovyPayload();
    const moduleId = await createAndVerifyDataSource(context, payload);
    
    // Modify appliesTo
    const newAppliesTo = 'system.displayname == "__LMDA_MODIFIED_APPLIESTO__"';
    
    context.log('Pushing updated appliesTo...');
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: {
        portalId: context.portalId,
        moduleType: 'datasource',
        moduleId,
        scriptType: 'collection',
        moduleDetails: {
          appliesTo: newAppliesTo,
        },
      },
    });
    
    assertApiSuccess(commitResult, 'Failed to commit appliesTo change');
    
    // Fetch and verify
    const updatedModule = await fetchModuleDetails(context, moduleId);
    assertEqual(updatedModule.appliesTo, newAppliesTo, 'AppliesTo was not updated');
    context.log('AppliesTo successfully updated');
  },
};

const pushPullRoundTripTest: TestCase = {
  id: 'ds-push-pull-roundtrip',
  name: 'DataSource Push/Pull Round Trip',
  description: 'Creates a DataSource, modifies it, pushes changes, then fetches to verify persistence',
  moduleType: 'datasource',
  tags: ['push', 'pull', 'roundtrip'],
  run: async (context) => {
    const payload = createDataSourceGroovyPayload();
    const moduleId = await createAndVerifyDataSource(context, payload);
    
    // Modify multiple fields
    const modifications = {
      description: 'Updated description by integration test',
      technology: 'Integration test technical notes',
    };
    
    context.log('Pushing modifications...');
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: {
        portalId: context.portalId,
        moduleType: 'datasource',
        moduleId,
        scriptType: 'collection',
        moduleDetails: modifications,
      },
    });
    
    assertApiSuccess(commitResult, 'Failed to commit modifications');
    
    // Fetch (simulate pull) and verify all changes persisted
    const updatedModule = await fetchModuleDetails(context, moduleId);
    
    assertEqual(updatedModule.description, modifications.description, 'Description mismatch after round-trip');
    assertEqual(updatedModule.technology, modifications.technology, 'Technology mismatch after round-trip');
    
    context.log('Push/pull round-trip successful');
  },
};

// =============================================================================
// Test Suite
// =============================================================================

export const dataSourceTestSuite: TestSuite = {
  id: 'datasource-suite',
  name: 'DataSource Tests',
  description: 'Integration tests for DataSource CRUD operations',
  moduleType: 'datasource',
  tests: [
    createGroovyDataSourceTest,
    createPowerShellDataSourceTest,
    createBatchScriptDataSourceTest,
    createDataSourceWithADTest,
    modifyDatapointsTest,
    modifyAppliesToTest,
    pushPullRoundTripTest,
  ],
};
