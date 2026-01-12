/**
 * ConfigSource integration tests.
 */

import type { TestSuite, TestCase, TestContext } from '../test-types';
import {
  createConfigSourcePayload,
  createConfigSourceWithMultipleChecksPayload,
} from '../test-data';
import {
  assertModuleCreated,
  assertApiSuccess,
  assertDefined,
  assertEqual,
  assertGreaterThan,
} from '../assertions';

/**
 * Helper to create a ConfigSource and verify it was created.
 */
async function createAndVerifyConfigSource(
  context: TestContext,
  payload: ReturnType<typeof createConfigSourcePayload>
): Promise<number> {
  context.log(`Creating ConfigSource: ${payload.name}`);
  
  // Capture the request payload for debugging
  context.captureRequest({
    type: 'CREATE_MODULE',
    moduleType: 'configsource',
    modulePayload: payload,
  });
  
  const result = await context.sendMessage({
    type: 'CREATE_MODULE',
    payload: {
      portalId: context.portalId,
      moduleType: 'configsource',
      modulePayload: payload,
    },
  });
  
  // Capture the response for debugging
  context.captureResponse(result);
  
  assertModuleCreated(result, 'Failed to create ConfigSource');
  const moduleId = result.data.moduleId;
  
  context.registerModuleForCleanup('configsource', moduleId);
  context.log(`Created ConfigSource with ID: ${moduleId}`);
  
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
      moduleType: 'configsource',
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

const createBasicConfigSourceTest: TestCase = {
  id: 'cs-create-basic',
  name: 'Create Basic ConfigSource',
  description: 'Creates a ConfigSource with a single config check and verifies creation',
  moduleType: 'configsource',
  variant: 'groovy',
  tags: ['create'],
  run: async (context) => {
    const payload = createConfigSourcePayload();
    const moduleId = await createAndVerifyConfigSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
    assertDefined(module.id, 'Module ID not set');
    
    // Verify config checks were created
    const configChecks = module.configChecks as unknown[];
    assertDefined(configChecks, 'Config checks should be present');
    assertGreaterThan(configChecks.length, 0, 'Should have at least one config check');
  },
};

const createMultiCheckConfigSourceTest: TestCase = {
  id: 'cs-create-multi-check',
  name: 'Create ConfigSource with Multiple Checks',
  description: 'Creates a ConfigSource with multiple config checks and verifies all are created',
  moduleType: 'configsource',
  tags: ['create', 'config-checks'],
  run: async (context) => {
    const payload = createConfigSourceWithMultipleChecksPayload();
    const moduleId = await createAndVerifyConfigSource(context, payload);
    
    const module = await fetchModuleDetails(context, moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
    
    const configChecks = module.configChecks as unknown[];
    assertDefined(configChecks, 'Config checks should be present');
    assertEqual(configChecks.length, 2, 'Should have exactly 2 config checks');
    
    context.log(`Created ConfigSource with ${configChecks.length} config checks`);
  },
};

const modifyConfigChecksTest: TestCase = {
  id: 'cs-modify-config-checks',
  name: 'Modify ConfigSource Config Checks',
  description: 'Creates a ConfigSource, adds a config check, and verifies it persists',
  moduleType: 'configsource',
  tags: ['modify', 'config-checks'],
  run: async (context) => {
    const payload = createConfigSourcePayload();
    const moduleId = await createAndVerifyConfigSource(context, payload);
    
    // Fetch initial state
    const initialModule = await fetchModuleDetails(context, moduleId);
    const initialChecks = (initialModule.configChecks as unknown[]) || [];
    context.log(`Initial config checks count: ${initialChecks.length}`);
    
    // Add a new config check - every configCheck needs a script object
    const newCheck = {
      name: 'AddedCheck',
      type: 'value',
      description: 'Added by integration test',
      alertLevel: 2,
      ackClearAlert: false,
      alertEffectiveIval: 0,
      alertTransitionInterval: 0,
      script: {
        value_check: {
          value: '',
          criteria: 'none',
        },
        format: 'arbitrary',
      },
    };
    
    const updatedChecks = [...initialChecks, newCheck];
    
    const commitPayload = {
      portalId: context.portalId,
      moduleType: 'configsource' as const,
      moduleId,
      scriptType: 'collection' as const,
      moduleDetails: {
        configChecks: updatedChecks,
      },
    };
    
    context.log('Pushing updated config checks...');
    // Capture the commit request/response for debugging
    context.captureRequest({ type: 'COMMIT_MODULE_SCRIPT', ...commitPayload });
    
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: commitPayload,
    });
    
    context.captureResponse(commitResult);
    
    assertApiSuccess(commitResult, 'Failed to commit config check changes');
    
    // Fetch and verify
    const updatedModule = await fetchModuleDetails(context, moduleId);
    const finalChecks = (updatedModule.configChecks as unknown[]) || [];
    
    assertGreaterThan(finalChecks.length, initialChecks.length, 'Config check count should have increased');
    context.log(`Final config checks count: ${finalChecks.length}`);
  },
};

const pushPullRoundTripTest: TestCase = {
  id: 'cs-push-pull-roundtrip',
  name: 'ConfigSource Push/Pull Round Trip',
  description: 'Creates a ConfigSource, modifies it, pushes changes, then fetches to verify persistence',
  moduleType: 'configsource',
  tags: ['push', 'pull', 'roundtrip'],
  run: async (context) => {
    const payload = createConfigSourcePayload();
    const moduleId = await createAndVerifyConfigSource(context, payload);
    
    // Modify multiple fields
    const modifications = {
      description: 'Updated ConfigSource description',
      technology: 'ConfigSource integration test notes',
    };
    
    context.log('Pushing modifications...');
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: {
        portalId: context.portalId,
        moduleType: 'configsource',
        moduleId,
        scriptType: 'collection',
        moduleDetails: modifications,
      },
    });
    
    assertApiSuccess(commitResult, 'Failed to commit modifications');
    
    // Fetch and verify
    const updatedModule = await fetchModuleDetails(context, moduleId);
    
    assertEqual(updatedModule.description, modifications.description, 'Description mismatch');
    assertEqual(updatedModule.technology, modifications.technology, 'Technology mismatch');
    
    context.log('Push/pull round-trip successful');
  },
};

// =============================================================================
// Test Suite
// =============================================================================

export const configSourceTestSuite: TestSuite = {
  id: 'configsource-suite',
  name: 'ConfigSource Tests',
  description: 'Integration tests for ConfigSource CRUD operations',
  moduleType: 'configsource',
  tests: [
    createBasicConfigSourceTest,
    createMultiCheckConfigSourceTest,
    modifyConfigChecksTest,
    pushPullRoundTripTest,
  ],
};
