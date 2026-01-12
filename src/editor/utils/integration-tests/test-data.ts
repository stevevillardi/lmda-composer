/**
 * Sample payloads for integration tests.
 * These payloads are modeled after the actual payload builders in module-payload-builders.ts
 * to ensure they match what the Create Module Wizard sends.
 */

import type { CreateModulePayload, LogicModuleType } from '@/shared/types';

/**
 * Generates a unique test module name with timestamp to avoid conflicts.
 */
export function generateTestModuleName(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `LMDA_Test_${prefix}_${timestamp}_${random}`;
}

/**
 * Base appliesTo that matches nothing (safe for testing).
 */
export const SAFE_APPLIES_TO = 'false()';

// =============================================================================
// DataSource Payloads
// Based on buildDataSourcePayload in module-payload-builders.ts
// =============================================================================

export function createDataSourceGroovyPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('DS_Groovy'),
    displayName: 'LMDA Test DataSource (Groovy)',
    appliesTo: SAFE_APPLIES_TO,
    collectMethod: 'script',
    collectInterval: 300, // 5 minutes
    hasMultiInstances: false,
    enableAutoDiscovery: false,
    collectorAttribute: {
      name: 'script',
      scriptType: 'embed',
      groovyScript: `// LMDA Integration Test Script
println "Test script executed at: " + new Date()
return 0`,
    },
    dataPoints: [
      {
        name: 'exitCode',
        type: 2, // exitCode type
        rawDataFieldName: 'exitCode',
        description: 'Script exit code (0 = success)',
        alertExpr: '',
        alertForNoData: 0,
      },
    ],
  };
}

export function createDataSourcePowerShellPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('DS_PowerShell'),
    displayName: 'LMDA Test DataSource (PowerShell)',
    appliesTo: SAFE_APPLIES_TO,
    collectMethod: 'script',
    collectInterval: 300,
    hasMultiInstances: false,
    enableAutoDiscovery: false,
    collectorAttribute: {
      name: 'script',
      scriptType: 'powershell',
      // Note: groovyScript field is used for all script types
    },
    dataPoints: [
      {
        name: 'exitCode',
        type: 2,
        rawDataFieldName: 'exitCode',
        description: 'Script exit code (0 = success)',
        alertExpr: '',
        alertForNoData: 0,
      },
    ],
  };
}

export function createDataSourceBatchScriptPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('DS_Batch'),
    displayName: 'LMDA Test DataSource (BatchScript)',
    appliesTo: SAFE_APPLIES_TO,
    collectMethod: 'batchscript',
    collectInterval: 300,
    hasMultiInstances: false,
    enableAutoDiscovery: false,
    collectorAttribute: {
      name: 'batchscript',
      scriptType: 'embed',
      groovyScript: `@echo off
REM LMDA Integration Test Script
echo Test script executed at: %DATE% %TIME%
exit /b 0`,
    },
    dataPoints: [
      {
        name: 'exitCode',
        type: 2,
        rawDataFieldName: 'exitCode',
        description: 'Script exit code (0 = success)',
        alertExpr: '',
        alertForNoData: 0,
      },
    ],
  };
}

export function createDataSourceWithADPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('DS_WithAD'),
    displayName: 'LMDA Test DataSource (With AD)',
    appliesTo: SAFE_APPLIES_TO,
    collectMethod: 'script',
    collectInterval: 300,
    hasMultiInstances: true,
    enableAutoDiscovery: true,
    collectorAttribute: {
      name: 'script',
      scriptType: 'embed',
      groovyScript: `// LMDA Integration Test Collection Script
println "Collecting data..."
return 0`,
    },
    autoDiscoveryConfig: {
      persistentInstance: true,
      scheduleInterval: 15,
      deleteInactiveInstance: false,
      disableInstance: false,
      method: {
        name: 'ad_script',
        scriptType: 'embed',
        groovyScript: `// LMDA Integration Test AD Script
// Returns empty list (no instances discovered)
return []`,
      },
      instanceAutoGroupMethod: 'none',
      instanceAutoGroupMethodParams: null,
      filters: [],
    },
    dataPoints: [
      {
        name: 'exitCode',
        type: 2,
        rawDataFieldName: 'exitCode',
        description: 'Script exit code (0 = success)',
        alertExpr: '',
        alertForNoData: 0,
      },
    ],
  };
}

// =============================================================================
// ConfigSource Payloads
// Based on buildConfigSourcePayload in module-payload-builders.ts
// =============================================================================

export function createConfigSourcePayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('CS'),
    displayName: 'LMDA Test ConfigSource-', // ConfigSource displayName can't have hyphens except at the end
    appliesTo: SAFE_APPLIES_TO,
    collectMethod: 'script',
    collectInterval: 3600, // 1 hour
    hasMultiInstances: false,
    enableAutoDiscovery: false,
    collectorAttribute: {
      name: 'script',
      scriptType: 'embed',
      groovyScript: `// LMDA Integration Test ConfigSource Script
println "Fetching config..."
return "test_config_value"`,
    },
    configChecks: [
      {
        name: 'RetrievalCheck',
        type: 'fetch',
        description: 'Config cannot be retrieved',
        alertLevel: 2, // warn
        ackClearAlert: false,
        alertEffectiveIval: 0,
        alertTransitionInterval: 0,
        script: {
          fetch_check: { fetch: 0 },
          format: 'arbitrary',
        },
      },
    ],
  };
}

export function createConfigSourceWithMultipleChecksPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('CS_MultiCheck'),
    displayName: 'LMDA Test ConfigSource MultiCheck-', // ConfigSource displayName can't have hyphens except at the end
    appliesTo: SAFE_APPLIES_TO,
    collectMethod: 'script',
    collectInterval: 3600,
    hasMultiInstances: false,
    enableAutoDiscovery: false,
    collectorAttribute: {
      name: 'script',
      scriptType: 'embed',
      groovyScript: `// LMDA Integration Test ConfigSource Script
println "Fetching multiple configs..."
return "config1=value1\\nconfig2=value2"`,
    },
    configChecks: [
      {
        name: 'RetrievalCheck',
        type: 'fetch',
        description: 'Config cannot be retrieved',
        alertLevel: 2,
        ackClearAlert: false,
        alertEffectiveIval: 0,
        alertTransitionInterval: 0,
        script: {
          fetch_check: { fetch: 0 },
          format: 'arbitrary',
        },
      },
      {
        name: 'Check2',
        type: 'value',
        description: 'Second test check',
        alertLevel: 2,
        ackClearAlert: true,
        alertEffectiveIval: 0,
        alertTransitionInterval: 0,
        // Every configCheck needs a script object
        script: {
          value_check: {
            value: '',
            criteria: 'none',
          },
          format: 'arbitrary',
        },
      },
    ],
  };
}

// =============================================================================
// LogSource Payloads
// Based on buildLogSourcePayload in module-payload-builders.ts
// =============================================================================

export function createLogSourcePayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('LS'),
    // LogSource uses appliesToScript instead of appliesTo
    appliesToScript: SAFE_APPLIES_TO,
    appliesTo: SAFE_APPLIES_TO,
    collectionMethod: 'SCRIPT',
    collectionInterval: {
      units: 'SECONDS',
      offset: 300, // 5 minutes
    },
    collectionAttribute: {
      resourceMappingOp: 'AND',
      filterOp: null,
      script: {
        embeddedContent: `// LMDA Integration Test LogSource Script
println "Collecting logs..."
return []`,
        type: 'GROOVY',
      },
    },
    logFields: [
      {
        key: '_resource.type',
        method: 'Token',
        value: '##predef.externalResourceType##',
        comment: '',
      },
    ],
    resourceMapping: [
      {
        index: '',
        key: 'system.deviceId',
        method: 'Token',
        value: '##system.deviceId##',
        comment: '',
      },
    ],
  };
}

export function createLogSourceWithFiltersPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('LS_Filters'),
    appliesToScript: SAFE_APPLIES_TO,
    appliesTo: SAFE_APPLIES_TO,
    collectionMethod: 'SCRIPT',
    collectionInterval: {
      units: 'SECONDS',
      offset: 300,
    },
    collectionAttribute: {
      resourceMappingOp: 'AND',
      filterOp: 'AND',
      script: {
        embeddedContent: `// LMDA Integration Test LogSource Script
println "Collecting logs with filters..."
return []`,
        type: 'GROOVY',
      },
    },
    logFields: [
      {
        key: '_resource.type',
        method: 'Token',
        value: '##predef.externalResourceType##',
        comment: '',
      },
    ],
    resourceMapping: [
      {
        index: '',
        key: 'system.deviceId',
        method: 'Token',
        value: '##system.deviceId##',
        comment: '',
      },
    ],
    filters: [
      {
        index: '',
        attribute: 'Message',
        operator: 'Contain',
        value: 'test_filter_value',
        comment: 'Test filter 1',
        include: 'y',
      },
      {
        index: '',
        attribute: 'Message',
        operator: 'NotContain',
        value: 'exclude_this',
        comment: 'Test filter 2',
        include: 'y',
      },
    ],
  };
}

export function createLogSourceWithLogFieldsPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('LS_LogFields'),
    appliesToScript: SAFE_APPLIES_TO,
    appliesTo: SAFE_APPLIES_TO,
    collectionMethod: 'SCRIPT',
    collectionInterval: {
      units: 'SECONDS',
      offset: 300,
    },
    collectionAttribute: {
      resourceMappingOp: 'AND',
      filterOp: null,
      script: {
        embeddedContent: `// LMDA Integration Test LogSource Script
println "Collecting logs with log fields..."
return []`,
        type: 'GROOVY',
      },
    },
    logFields: [
      {
        key: '_resource.type',
        method: 'Token',
        value: '##predef.externalResourceType##',
        comment: '',
      },
      {
        key: 'test_static_field',
        method: 'Static',
        value: 'static_value',
        comment: 'Static test field',
      },
      {
        key: 'test_regex_field',
        method: 'Regex',
        value: 'field=(.+)',
        comment: 'Regex test field',
      },
    ],
    resourceMapping: [
      {
        index: '',
        key: 'system.deviceId',
        method: 'Token',
        value: '##system.deviceId##',
        comment: '',
      },
    ],
  };
}

export function createLogSourceWithResourceMappingsPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('LS_ResMaps'),
    appliesToScript: SAFE_APPLIES_TO,
    appliesTo: SAFE_APPLIES_TO,
    collectionMethod: 'SCRIPT',
    collectionInterval: {
      units: 'SECONDS',
      offset: 300,
    },
    collectionAttribute: {
      resourceMappingOp: 'OR',
      filterOp: null,
      script: {
        embeddedContent: `// LMDA Integration Test LogSource Script
println "Collecting logs with resource mappings..."
return []`,
        type: 'GROOVY',
      },
    },
    logFields: [
      {
        key: '_resource.type',
        method: 'Token',
        value: '##predef.externalResourceType##',
        comment: '',
      },
    ],
    resourceMapping: [
      {
        index: 0,
        key: 'system.deviceId',
        method: 'Token',
        value: '##system.deviceId##',
        comment: '',
      },
      {
        index: 1,
        key: 'system.hostname',
        method: 'Static',
        value: 'test_host',
        comment: 'Static mapping',
      },
      {
        index: 2,
        key: 'custom.property',
        method: 'Regex',
        value: 'device=(.+)',
        comment: 'Regex mapping',
      },
    ],
  };
}

// =============================================================================
// PropertySource Payloads
// Based on buildPropertySourcePayload in module-payload-builders.ts
// =============================================================================

export function createPropertySourceGroovyPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('PS_Groovy'),
    // PropertySource does not support displayName
    appliesTo: SAFE_APPLIES_TO,
    scriptType: 'embed',
    groovyScript: `// LMDA Integration Test PropertySource Script
println "Fetching properties..."
return [:]`,
  };
}

export function createPropertySourcePowerShellPayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('PS_PowerShell'),
    // PropertySource does not support displayName
    appliesTo: SAFE_APPLIES_TO,
    scriptType: 'powershell',
    // Note: groovyScript field is not included for PowerShell - script is empty initially
  };
}

// =============================================================================
// EventSource Payloads
// Based on buildEventSourcePayload in module-payload-builders.ts
// =============================================================================

export function createEventSourcePayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('ES'),
    // EventSource does not support displayName
    appliesTo: SAFE_APPLIES_TO,
    collector: 'scriptevent',
    schedule: 1800, // 30 minutes
    scriptType: 'embed',
    groovyScript: `// LMDA Integration Test EventSource Script
println "Checking for events..."
return []`,
    alertLevel: 'warn',
    alertEffectiveIval: 60,
    clearAfterAck: true,
    suppressDuplicatesES: true,
  };
}

// =============================================================================
// TopologySource Payloads
// Based on buildTopologySourcePayload in module-payload-builders.ts
// =============================================================================

export function createTopologySourcePayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('TS'),
    // TopologySource does not support displayName
    appliesTo: SAFE_APPLIES_TO,
    collectionMethod: 'script',
    collectInterval: 3600, // 1 hour
    collectorAttribute: {
      name: 'script',
      scriptType: 'embed',
      groovyScript: `// LMDA Integration Test TopologySource Script
println "Fetching topology..."
return [:]`,
    },
  };
}

// =============================================================================
// DiagnosticSource Payloads
// Based on buildDiagnosticSourcePayload in module-payload-builders.ts
// =============================================================================

export function createDiagnosticSourcePayload(): CreateModulePayload {
  return {
    name: generateTestModuleName('DiagS'),
    // DiagnosticSource does not support displayName
    appliesTo: SAFE_APPLIES_TO,
    dataType: 0,
    scriptType: 'embed',
    groovyScript: `// LMDA Integration Test DiagnosticSource Script
println "Running diagnostics..."
return "OK"`,
  };
}

// =============================================================================
// Payload Registry
// =============================================================================

export interface TestPayloadInfo {
  moduleType: LogicModuleType;
  variant: string;
  description: string;
  createPayload: () => CreateModulePayload;
}

/**
 * Registry of all test payloads.
 */
export const TEST_PAYLOADS: TestPayloadInfo[] = [
  // DataSource
  { moduleType: 'datasource', variant: 'groovy', description: 'DataSource with Groovy script', createPayload: createDataSourceGroovyPayload },
  { moduleType: 'datasource', variant: 'powershell', description: 'DataSource with PowerShell script', createPayload: createDataSourcePowerShellPayload },
  { moduleType: 'datasource', variant: 'batchscript', description: 'DataSource with Batch script', createPayload: createDataSourceBatchScriptPayload },
  { moduleType: 'datasource', variant: 'with-ad', description: 'DataSource with Auto-Discovery', createPayload: createDataSourceWithADPayload },
  
  // ConfigSource
  { moduleType: 'configsource', variant: 'basic', description: 'ConfigSource with single check', createPayload: createConfigSourcePayload },
  { moduleType: 'configsource', variant: 'multi-check', description: 'ConfigSource with multiple checks', createPayload: createConfigSourceWithMultipleChecksPayload },
  
  // LogSource
  { moduleType: 'logsource', variant: 'basic', description: 'LogSource basic', createPayload: createLogSourcePayload },
  { moduleType: 'logsource', variant: 'with-filters', description: 'LogSource with filters', createPayload: createLogSourceWithFiltersPayload },
  { moduleType: 'logsource', variant: 'with-log-fields', description: 'LogSource with log fields', createPayload: createLogSourceWithLogFieldsPayload },
  { moduleType: 'logsource', variant: 'with-resource-mappings', description: 'LogSource with resource mappings', createPayload: createLogSourceWithResourceMappingsPayload },
  
  // PropertySource
  { moduleType: 'propertysource', variant: 'groovy', description: 'PropertySource with Groovy', createPayload: createPropertySourceGroovyPayload },
  { moduleType: 'propertysource', variant: 'powershell', description: 'PropertySource with PowerShell', createPayload: createPropertySourcePowerShellPayload },
  
  // EventSource
  { moduleType: 'eventsource', variant: 'basic', description: 'EventSource basic', createPayload: createEventSourcePayload },
  
  // TopologySource
  { moduleType: 'topologysource', variant: 'basic', description: 'TopologySource basic', createPayload: createTopologySourcePayload },
  
  // DiagnosticSource
  { moduleType: 'diagnosticsource', variant: 'basic', description: 'DiagnosticSource basic', createPayload: createDiagnosticSourcePayload },
];

/**
 * Get payloads for a specific module type.
 */
export function getPayloadsForModuleType(moduleType: LogicModuleType): TestPayloadInfo[] {
  return TEST_PAYLOADS.filter(p => p.moduleType === moduleType);
}
