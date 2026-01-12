/**
 * Module Payload Builders
 * 
 * Dedicated builder functions for each LogicModule type.
 * Each builder handles the module type's unique API requirements:
 * - Default collect intervals
 * - Required fields (dataPoints, configChecks, etc.)
 * - AD method field names and script type values
 */

import type { CreateModuleConfig, CreateModulePayload, LogicModuleType } from '@/shared/types';
import { getModuleScriptTemplate } from '@/editor/config/script-templates';

/**
 * Builder function signature for creating module payloads
 */
type PayloadBuilder = (config: CreateModuleConfig) => CreateModulePayload;

/**
 * Registry of payload builders by module type
 */
const PAYLOAD_BUILDERS: Partial<Record<LogicModuleType, PayloadBuilder>> = {
  datasource: buildDataSourcePayload,
  configsource: buildConfigSourcePayload,
  topologysource: buildTopologySourcePayload,
  propertysource: buildPropertySourcePayload,
  logsource: buildLogSourcePayload,
  eventsource: buildEventSourcePayload,
  diagnosticsource: buildDiagnosticSourcePayload,
};

/**
 * Build the API payload for creating a new module.
 * Dispatches to the appropriate builder based on module type.
 * 
 * @throws Error if module type is not supported
 */
export function buildModulePayload(config: CreateModuleConfig): CreateModulePayload {
  const builder = PAYLOAD_BUILDERS[config.moduleType];
  if (!builder) {
    throw new Error(`Module creation not supported for type: ${config.moduleType}`);
  }
  return builder(config);
}

/**
 * Build base fields common to all scripted modules
 */
function buildBasePayload(
  config: CreateModuleConfig,
  collectInterval: number
): Omit<CreateModulePayload, 'dataPoints' | 'configChecks' | 'autoDiscoveryConfig'> {
  const collectMethod = config.useBatchScript ? 'batchscript' : 'script';
  const collectorAttributeName = config.useBatchScript ? 'batchscript' : 'script';

  const collectorAttribute: CreateModulePayload['collectorAttribute'] = {
    name: collectorAttributeName,
  };

  if (config.collectionLanguage === 'powershell') {
    collectorAttribute.scriptType = 'powershell';
  } else {
    collectorAttribute.scriptType = 'embed';
    collectorAttribute.groovyScript = getModuleScriptTemplate(config.moduleType, 'groovy', 'collection');
  }

  return {
    name: config.name,
    displayName: config.displayName,
    appliesTo: 'false()',
    collectMethod,
    collectInterval,
    hasMultiInstances: config.hasMultiInstances,
    enableAutoDiscovery: config.hasMultiInstances,
    collectorAttribute,
  };
}

/**
 * Build DataSource-specific payload
 * 
 * DataSource specifics:
 * - Default collect interval: 5 minutes (300s)
 * - Requires at least one dataPoint
 * - AD method uses 'scriptType' field with 'embed' for Groovy
 */
function buildDataSourcePayload(config: CreateModuleConfig): CreateModulePayload {
  const payload: CreateModulePayload = {
    ...buildBasePayload(config, 300), // 5 minutes
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

  // Add AD config if multi-instance
  if (config.hasMultiInstances && config.adLanguage) {
    payload.autoDiscoveryConfig = buildDataSourceADConfig(config);
  }

  return payload;
}

/**
 * Build DataSource Active Discovery config
 * Uses 'scriptType' field with 'embed' for Groovy
 */
function buildDataSourceADConfig(
  config: CreateModuleConfig
): CreateModulePayload['autoDiscoveryConfig'] {
  const method: NonNullable<CreateModulePayload['autoDiscoveryConfig']>['method'] = {
    name: 'ad_script',
  };

  if (config.adLanguage === 'powershell') {
    method.scriptType = 'powershell';
  } else {
    method.scriptType = 'embed';
    method.groovyScript = getModuleScriptTemplate('datasource', 'groovy', 'ad');
  }

  return {
    persistentInstance: true,
    scheduleInterval: 15,
    deleteInactiveInstance: false,
    disableInstance: false,
    method,
    instanceAutoGroupMethod: 'none',
    instanceAutoGroupMethodParams: null,
    filters: [],
  };
}

/**
 * Build ConfigSource-specific payload
 * 
 * ConfigSource specifics:
 * - Default collect interval: 1 hour (3600s)
 * - Requires at least one configCheck
 * - AD method uses 'type' field with 'embeded' for Groovy
 */
function buildConfigSourcePayload(config: CreateModuleConfig): CreateModulePayload {
  const payload: CreateModulePayload = {
    ...buildBasePayload(config, 3600), // 1 hour
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

  // Add AD config if multi-instance
  if (config.hasMultiInstances && config.adLanguage) {
    payload.autoDiscoveryConfig = buildConfigSourceADConfig(config);
  }

  return payload;
}

/**
 * Build ConfigSource Active Discovery config
 * Uses 'type' field with 'embeded' for Groovy (note the typo is intentional - API quirk)
 */
function buildConfigSourceADConfig(
  config: CreateModuleConfig
): CreateModulePayload['autoDiscoveryConfig'] {
  const method: NonNullable<CreateModulePayload['autoDiscoveryConfig']>['method'] = {
    name: 'ad_script',
  };

  if (config.adLanguage === 'powershell') {
    // ConfigSource AD also uses 'type' for PowerShell
    method.type = 'powershell';
  } else {
    // ConfigSource AD uses 'type' with 'embeded' (intentional typo - API quirk)
    method.type = 'embeded';
    method.groovyScript = getModuleScriptTemplate('configsource', 'groovy', 'ad');
  }

  return {
    persistentInstance: true,
    scheduleInterval: 15,
    deleteInactiveInstance: false,
    disableInstance: false,
    method,
    instanceAutoGroupMethod: 'none',
    instanceAutoGroupMethodParams: null,
    filters: [],
  };
}

/**
 * Build TopologySource-specific payload
 * 
 * TopologySource specifics:
 * - Default collect interval: 1 hour (3600s), options: 30min, 1hr, 4hr, 12hr
 * - Uses collectorAttribute for script
 * - Requires collectionMethod: 'script'
 * - No Active Discovery support
 * - No dataPoints or configChecks required
 */
function buildTopologySourcePayload(config: CreateModuleConfig): CreateModulePayload {
  const collectorAttribute: CreateModulePayload['collectorAttribute'] = {
    name: 'script',
  };

  if (config.collectionLanguage === 'powershell') {
    collectorAttribute.scriptType = 'powershell';
  } else {
    collectorAttribute.scriptType = 'embed';
    collectorAttribute.groovyScript = getModuleScriptTemplate('topologysource', 'groovy', 'collection');
  }

  return {
    name: config.name,
    // TopologySource does not support displayName
    appliesTo: 'false()',
    collectionMethod: 'script',
    collectInterval: 3600, // 1 hour default
    collectorAttribute,
  };
}

/**
 * Build PropertySource-specific payload
 * 
 * PropertySource specifics:
 * - No collect interval (runs on device discovery/property change)
 * - Uses groovyScript at top level (not in collectorAttribute)
 * - No Active Discovery support
 * - No dataPoints or configChecks required
 */
function buildPropertySourcePayload(config: CreateModuleConfig): CreateModulePayload {
  const payload: CreateModulePayload = {
    name: config.name,
    // PropertySource does not support displayName
    appliesTo: 'false()',
  };

  if (config.collectionLanguage === 'powershell') {
    payload.scriptType = 'powershell';
  } else {
    payload.scriptType = 'embed';
    payload.groovyScript = getModuleScriptTemplate('propertysource', 'groovy', 'collection');
  }

  return payload;
}

/**
 * Build LogSource-specific payload
 * 
 * LogSource specifics:
 * - Groovy only (no PowerShell support)
 * - Default collection interval: 5 minutes (300s)
 * - Uses collectionAttribute.script.embeddedContent for script
 * - Uses collectionInterval as object { units, offset }
 * - Uses appliesToScript instead of appliesTo
 * - Requires logFields and resourceMapping defaults
 * - collectionMethod: 'SCRIPT'
 */
function buildLogSourcePayload(config: CreateModuleConfig): CreateModulePayload {
  return {
    name: config.name,
    // LogSource does not support displayName
    // LogSource uses appliesToScript instead of appliesTo
    appliesToScript: 'false()',
    appliesTo: 'false()',
    collectionMethod: 'SCRIPT',
    collectionInterval: {
      units: 'SECONDS',
      offset: 300, // 5 minutes default
    },
    collectionAttribute: {
      resourceMappingOp: 'AND',
      filterOp: null,
      script: {
        embeddedContent: getModuleScriptTemplate('logsource', 'groovy', 'collection'),
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

/**
 * Build EventSource-specific payload
 * 
 * EventSource specifics:
 * - Groovy only (no PowerShell support)
 * - Default schedule: 30 minutes (1800s)
 * - Uses top-level groovyScript and scriptType
 * - Uses schedule instead of collectInterval
 * - Requires collector: 'scriptevent'
 * - Default alert settings
 */
function buildEventSourcePayload(config: CreateModuleConfig): CreateModulePayload {
  return {
    name: config.name,
    // EventSource does not support displayName
    appliesTo: 'false()',
    collector: 'scriptevent',
    schedule: 1800, // 30 minutes default
    scriptType: 'embed',
    groovyScript: getModuleScriptTemplate('eventsource', 'groovy', 'collection'),
    alertLevel: 'warn',
    alertEffectiveIval: 60,
    clearAfterAck: true,
    suppressDuplicatesES: true,
  };
}

/**
 * Build DiagnosticSource-specific payload
 * 
 * DiagnosticSource specifics:
 * - Supports both Groovy and PowerShell
 * - No collect interval (on-demand or via Diagnostic Rules)
 * - Uses top-level groovyScript for both languages, scriptType indicates language
 * - Requires dataType: 0
 * - No Active Discovery support
 */
function buildDiagnosticSourcePayload(config: CreateModuleConfig): CreateModulePayload {
  const payload: CreateModulePayload = {
    name: config.name,
    // DiagnosticSource does not support displayName
    appliesTo: 'false()',
    dataType: 0,
  };

  if (config.collectionLanguage === 'powershell') {
    payload.scriptType = 'powershell';
    payload.groovyScript = getModuleScriptTemplate('diagnosticsource', 'powershell', 'collection');
  } else {
    payload.scriptType = 'embed';
    payload.groovyScript = getModuleScriptTemplate('diagnosticsource', 'groovy', 'collection');
  }

  return payload;
}
