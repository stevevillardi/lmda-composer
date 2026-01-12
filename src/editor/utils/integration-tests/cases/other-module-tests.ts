/**
 * Integration tests for other module types:
 * - PropertySource
 * - EventSource
 * - TopologySource
 * - DiagnosticSource
 */

import type { TestSuite, TestCase, TestContext } from '../test-types';
import type { LogicModuleType, CreateModulePayload } from '@/shared/types';
import {
  createPropertySourceGroovyPayload,
  createPropertySourcePowerShellPayload,
  createEventSourcePayload,
  createTopologySourcePayload,
  createDiagnosticSourcePayload,
} from '../test-data';
import {
  assertModuleCreated,
  assertApiSuccess,
  assertDefined,
  assertEqual,
} from '../assertions';

/**
 * Generic helper to create a module and verify it was created.
 */
async function createAndVerifyModule(
  context: TestContext,
  moduleType: LogicModuleType,
  payload: CreateModulePayload
): Promise<number> {
  context.log(`Creating ${moduleType}: ${payload.name}`);
  
  // Capture the request payload for debugging
  context.captureRequest({
    type: 'CREATE_MODULE',
    moduleType,
    modulePayload: payload,
  });
  
  const result = await context.sendMessage({
    type: 'CREATE_MODULE',
    payload: {
      portalId: context.portalId,
      moduleType,
      modulePayload: payload,
    },
  });
  
  // Capture the response for debugging
  context.captureResponse(result);
  
  assertModuleCreated(result, `Failed to create ${moduleType}`);
  const moduleId = result.data.moduleId;
  
  context.registerModuleForCleanup(moduleType, moduleId);
  context.log(`Created ${moduleType} with ID: ${moduleId}`);
  
  return moduleId;
}

/**
 * Generic helper to fetch module details.
 */
async function fetchModuleDetails(
  context: TestContext,
  moduleType: LogicModuleType,
  moduleId: number
): Promise<Record<string, unknown>> {
  context.log(`Fetching module details for ${moduleType} ID: ${moduleId}`);
  
  const result = await context.sendMessage({
    type: 'FETCH_MODULE_DETAILS',
    payload: {
      portalId: context.portalId,
      moduleType,
      moduleId,
    },
  });
  
  assertApiSuccess(result, 'Failed to fetch module details');
  assertDefined(result.data.module, 'Module details not returned');
  
  return result.data.module as Record<string, unknown>;
}

// =============================================================================
// PropertySource Tests
// =============================================================================

const createPropertySourceGroovyTest: TestCase = {
  id: 'ps-create-groovy',
  name: 'Create Groovy PropertySource',
  description: 'Creates a PropertySource with a Groovy script',
  moduleType: 'propertysource',
  variant: 'groovy',
  tags: ['create', 'groovy'],
  run: async (context) => {
    const payload = createPropertySourceGroovyPayload();
    const moduleId = await createAndVerifyModule(context, 'propertysource', payload);
    
    const module = await fetchModuleDetails(context, 'propertysource', moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
    assertDefined(module.groovyScript, 'Groovy script should be present');
  },
};

const createPropertySourcePowerShellTest: TestCase = {
  id: 'ps-create-powershell',
  name: 'Create PowerShell PropertySource',
  description: 'Creates a PropertySource with a PowerShell script',
  moduleType: 'propertysource',
  variant: 'powershell',
  tags: ['create', 'powershell'],
  run: async (context) => {
    const payload = createPropertySourcePowerShellPayload();
    const moduleId = await createAndVerifyModule(context, 'propertysource', payload);
    
    const module = await fetchModuleDetails(context, 'propertysource', moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
  },
};

const propertySourceRoundTripTest: TestCase = {
  id: 'ps-push-pull-roundtrip',
  name: 'PropertySource Push/Pull Round Trip',
  description: 'Creates a PropertySource, modifies it, and verifies changes persist',
  moduleType: 'propertysource',
  tags: ['push', 'pull', 'roundtrip'],
  run: async (context) => {
    const payload = createPropertySourceGroovyPayload();
    const moduleId = await createAndVerifyModule(context, 'propertysource', payload);
    
    const modifications = {
      description: 'Updated PropertySource description',
    };
    
    context.log('Pushing modifications...');
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: {
        portalId: context.portalId,
        moduleType: 'propertysource',
        moduleId,
        scriptType: 'collection',
        moduleDetails: modifications,
      },
    });
    
    assertApiSuccess(commitResult, 'Failed to commit modifications');
    
    const updatedModule = await fetchModuleDetails(context, 'propertysource', moduleId);
    assertEqual(updatedModule.description, modifications.description, 'Description mismatch');
    
    context.log('Round-trip successful');
  },
};

// =============================================================================
// EventSource Tests
// =============================================================================

const createEventSourceTest: TestCase = {
  id: 'es-create-basic',
  name: 'Create Basic EventSource',
  description: 'Creates an EventSource and verifies creation',
  moduleType: 'eventsource',
  tags: ['create'],
  run: async (context) => {
    const payload = createEventSourcePayload();
    const moduleId = await createAndVerifyModule(context, 'eventsource', payload);
    
    const module = await fetchModuleDetails(context, 'eventsource', moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
  },
};

const eventSourceRoundTripTest: TestCase = {
  id: 'es-push-pull-roundtrip',
  name: 'EventSource Push/Pull Round Trip',
  description: 'Creates an EventSource, modifies it, and verifies changes persist',
  moduleType: 'eventsource',
  tags: ['push', 'pull', 'roundtrip'],
  run: async (context) => {
    const payload = createEventSourcePayload();
    const moduleId = await createAndVerifyModule(context, 'eventsource', payload);
    
    const modifications = {
      description: 'Updated EventSource description',
    };
    
    context.log('Pushing modifications...');
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: {
        portalId: context.portalId,
        moduleType: 'eventsource',
        moduleId,
        scriptType: 'collection',
        moduleDetails: modifications,
      },
    });
    
    assertApiSuccess(commitResult, 'Failed to commit modifications');
    
    const updatedModule = await fetchModuleDetails(context, 'eventsource', moduleId);
    assertEqual(updatedModule.description, modifications.description, 'Description mismatch');
    
    context.log('Round-trip successful');
  },
};

// =============================================================================
// TopologySource Tests
// =============================================================================

const createTopologySourceTest: TestCase = {
  id: 'ts-create-basic',
  name: 'Create Basic TopologySource',
  description: 'Creates a TopologySource and verifies creation',
  moduleType: 'topologysource',
  tags: ['create'],
  run: async (context) => {
    const payload = createTopologySourcePayload();
    const moduleId = await createAndVerifyModule(context, 'topologysource', payload);
    
    const module = await fetchModuleDetails(context, 'topologysource', moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
  },
};

const topologySourceRoundTripTest: TestCase = {
  id: 'ts-push-pull-roundtrip',
  name: 'TopologySource Push/Pull Round Trip',
  description: 'Creates a TopologySource, modifies it, and verifies changes persist',
  moduleType: 'topologysource',
  tags: ['push', 'pull', 'roundtrip'],
  run: async (context) => {
    const payload = createTopologySourcePayload();
    const moduleId = await createAndVerifyModule(context, 'topologysource', payload);
    
    const modifications = {
      description: 'Updated TopologySource description',
    };
    
    context.log('Pushing modifications...');
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: {
        portalId: context.portalId,
        moduleType: 'topologysource',
        moduleId,
        scriptType: 'collection',
        moduleDetails: modifications,
      },
    });
    
    assertApiSuccess(commitResult, 'Failed to commit modifications');
    
    const updatedModule = await fetchModuleDetails(context, 'topologysource', moduleId);
    assertEqual(updatedModule.description, modifications.description, 'Description mismatch');
    
    context.log('Round-trip successful');
  },
};

// =============================================================================
// DiagnosticSource Tests
// =============================================================================

const createDiagnosticSourceTest: TestCase = {
  id: 'diags-create-basic',
  name: 'Create Basic DiagnosticSource',
  description: 'Creates a DiagnosticSource and verifies creation',
  moduleType: 'diagnosticsource',
  tags: ['create'],
  run: async (context) => {
    const payload = createDiagnosticSourcePayload();
    const moduleId = await createAndVerifyModule(context, 'diagnosticsource', payload);
    
    const module = await fetchModuleDetails(context, 'diagnosticsource', moduleId);
    assertEqual(module.name, payload.name, 'Module name mismatch');
  },
};

const diagnosticSourceRoundTripTest: TestCase = {
  id: 'diags-push-pull-roundtrip',
  name: 'DiagnosticSource Push/Pull Round Trip',
  description: 'Creates a DiagnosticSource, modifies it, and verifies changes persist',
  moduleType: 'diagnosticsource',
  tags: ['push', 'pull', 'roundtrip'],
  run: async (context) => {
    const payload = createDiagnosticSourcePayload();
    const moduleId = await createAndVerifyModule(context, 'diagnosticsource', payload);
    
    const modifications = {
      description: 'Updated DiagnosticSource description',
    };
    
    context.log('Pushing modifications...');
    const commitResult = await context.sendMessage({
      type: 'COMMIT_MODULE_SCRIPT',
      payload: {
        portalId: context.portalId,
        moduleType: 'diagnosticsource',
        moduleId,
        scriptType: 'collection',
        moduleDetails: modifications,
      },
    });
    
    assertApiSuccess(commitResult, 'Failed to commit modifications');
    
    const updatedModule = await fetchModuleDetails(context, 'diagnosticsource', moduleId);
    assertEqual(updatedModule.description, modifications.description, 'Description mismatch');
    
    context.log('Round-trip successful');
  },
};

// =============================================================================
// Test Suites
// =============================================================================

export const propertySourceTestSuite: TestSuite = {
  id: 'propertysource-suite',
  name: 'PropertySource Tests',
  description: 'Integration tests for PropertySource CRUD operations',
  moduleType: 'propertysource',
  tests: [
    createPropertySourceGroovyTest,
    createPropertySourcePowerShellTest,
    propertySourceRoundTripTest,
  ],
};

export const eventSourceTestSuite: TestSuite = {
  id: 'eventsource-suite',
  name: 'EventSource Tests',
  description: 'Integration tests for EventSource CRUD operations',
  moduleType: 'eventsource',
  tests: [
    createEventSourceTest,
    eventSourceRoundTripTest,
  ],
};

export const topologySourceTestSuite: TestSuite = {
  id: 'topologysource-suite',
  name: 'TopologySource Tests',
  description: 'Integration tests for TopologySource CRUD operations',
  moduleType: 'topologysource',
  tests: [
    createTopologySourceTest,
    topologySourceRoundTripTest,
  ],
};

export const diagnosticSourceTestSuite: TestSuite = {
  id: 'diagnosticsource-suite',
  name: 'DiagnosticSource Tests',
  description: 'Integration tests for DiagnosticSource CRUD operations',
  moduleType: 'diagnosticsource',
  tests: [
    createDiagnosticSourceTest,
    diagnosticSourceRoundTripTest,
  ],
};
