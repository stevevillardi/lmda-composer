/**
 * Tests for module-payload-builders utility.
 * 
 * Tests that each module type produces correct API payloads.
 * These tests verify the critical API schema requirements for each module type.
 */
import { describe, expect, it } from 'vitest';
import { buildModulePayload } from '../../src/editor/utils/module-payload-builders';
import type { CreateModuleConfig } from '../../src/shared/types';

describe('module-payload-builders', () => {
  // ===========================================================================
  // Helper to create base config
  // ===========================================================================
  function createBaseConfig(overrides: Partial<CreateModuleConfig> = {}): CreateModuleConfig {
    return {
      moduleType: 'datasource',
      name: 'TestModule',
      collectionLanguage: 'groovy',
      hasMultiInstances: false,
      useBatchScript: false,
      ...overrides,
    };
  }

  // ===========================================================================
  // buildModulePayload - General
  // ===========================================================================
  describe('buildModulePayload', () => {
    it('throws for unsupported module types', () => {
      // @ts-expect-error - Testing invalid type
      const config = createBaseConfig({ moduleType: 'unsupported' });
      
      expect(() => buildModulePayload(config)).toThrow(/not supported/i);
    });

    it('dispatches to correct builder based on moduleType', () => {
      const dsPayload = buildModulePayload(createBaseConfig({ moduleType: 'datasource', name: 'DS' }));
      const csPayload = buildModulePayload(createBaseConfig({ moduleType: 'configsource', name: 'CS' }));
      
      // DataSource should have dataPoints
      expect(dsPayload.dataPoints).toBeDefined();
      expect(dsPayload.configChecks).toBeUndefined();
      
      // ConfigSource should have configChecks
      expect(csPayload.configChecks).toBeDefined();
      expect(csPayload.dataPoints).toBeUndefined();
    });
  });

  // ===========================================================================
  // DataSource Payloads
  // ===========================================================================
  describe('DataSource payload', () => {
    it('creates correct payload for single-instance Groovy DataSource', () => {
      const config = createBaseConfig({
        moduleType: 'datasource',
        name: 'MyDataSource',
        displayName: 'My Data Source',
        collectionLanguage: 'groovy',
        hasMultiInstances: false,
      });

      const payload = buildModulePayload(config);

      expect(payload.name).toBe('MyDataSource');
      expect(payload.displayName).toBe('My Data Source');
      expect(payload.appliesTo).toBe('false()');
      expect(payload.collectMethod).toBe('script');
      expect(payload.collectInterval).toBe(300); // 5 minutes
      expect(payload.hasMultiInstances).toBe(false);
      expect(payload.enableAutoDiscovery).toBe(false);
      expect(payload.collectorAttribute?.scriptType).toBe('embed');
      expect(payload.collectorAttribute?.groovyScript).toBeDefined();
      expect(payload.autoDiscoveryConfig).toBeUndefined();
    });

    it('creates correct payload for multi-instance Groovy DataSource with AD', () => {
      const config = createBaseConfig({
        moduleType: 'datasource',
        name: 'MultiInstanceDS',
        collectionLanguage: 'groovy',
        hasMultiInstances: true,
        adLanguage: 'groovy',
      });

      const payload = buildModulePayload(config);

      expect(payload.hasMultiInstances).toBe(true);
      expect(payload.enableAutoDiscovery).toBe(true);
      expect(payload.autoDiscoveryConfig).toBeDefined();
      expect(payload.autoDiscoveryConfig?.method?.scriptType).toBe('embed');
      expect(payload.autoDiscoveryConfig?.method?.groovyScript).toBeDefined();
    });

    it('creates correct payload for PowerShell DataSource', () => {
      const config = createBaseConfig({
        moduleType: 'datasource',
        name: 'PsDataSource',
        collectionLanguage: 'powershell',
      });

      const payload = buildModulePayload(config);

      expect(payload.collectorAttribute?.scriptType).toBe('powershell');
      expect(payload.collectorAttribute?.groovyScript).toBeUndefined();
    });

    it('creates correct payload for PowerShell AD', () => {
      const config = createBaseConfig({
        moduleType: 'datasource',
        name: 'PsAdDataSource',
        collectionLanguage: 'groovy',
        hasMultiInstances: true,
        adLanguage: 'powershell',
      });

      const payload = buildModulePayload(config);

      expect(payload.autoDiscoveryConfig?.method?.scriptType).toBe('powershell');
    });

    it('includes default exitCode datapoint', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'datasource' }));

      expect(payload.dataPoints).toHaveLength(1);
      expect(payload.dataPoints?.[0].name).toBe('exitCode');
      expect(payload.dataPoints?.[0].type).toBe(2);
      expect(payload.dataPoints?.[0].rawDataFieldName).toBe('exitCode');
    });

    it('uses batchscript when useBatchScript is true', () => {
      const config = createBaseConfig({
        moduleType: 'datasource',
        useBatchScript: true,
      });

      const payload = buildModulePayload(config);

      expect(payload.collectMethod).toBe('batchscript');
      expect(payload.collectorAttribute?.name).toBe('batchscript');
    });
  });

  // ===========================================================================
  // ConfigSource Payloads
  // ===========================================================================
  describe('ConfigSource payload', () => {
    it('creates correct payload for single-instance Groovy ConfigSource', () => {
      const config = createBaseConfig({
        moduleType: 'configsource',
        name: 'MyConfigSource',
        displayName: 'My Config Source',
        collectionLanguage: 'groovy',
      });

      const payload = buildModulePayload(config);

      expect(payload.name).toBe('MyConfigSource');
      expect(payload.displayName).toBe('My Config Source');
      expect(payload.collectInterval).toBe(3600); // 1 hour
      expect(payload.collectorAttribute?.scriptType).toBe('embed');
    });

    it('includes default RetrievalCheck configCheck', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'configsource' }));

      expect(payload.configChecks).toHaveLength(1);
      expect(payload.configChecks?.[0].name).toBe('RetrievalCheck');
      expect(payload.configChecks?.[0].type).toBe('fetch');
      expect(payload.configChecks?.[0].alertLevel).toBe(2); // warn
    });

    it('uses "type" field with "embeded" for Groovy AD (API quirk)', () => {
      const config = createBaseConfig({
        moduleType: 'configsource',
        hasMultiInstances: true,
        adLanguage: 'groovy',
      });

      const payload = buildModulePayload(config);

      // ConfigSource uses 'type' not 'scriptType' for AD
      expect(payload.autoDiscoveryConfig?.method?.type).toBe('embeded');
      expect(payload.autoDiscoveryConfig?.method?.scriptType).toBeUndefined();
    });

    it('uses "type" field with "powershell" for PowerShell AD', () => {
      const config = createBaseConfig({
        moduleType: 'configsource',
        hasMultiInstances: true,
        adLanguage: 'powershell',
      });

      const payload = buildModulePayload(config);

      expect(payload.autoDiscoveryConfig?.method?.type).toBe('powershell');
    });
  });

  // ===========================================================================
  // TopologySource Payloads
  // ===========================================================================
  describe('TopologySource payload', () => {
    it('creates correct payload for TopologySource', () => {
      const config = createBaseConfig({
        moduleType: 'topologysource',
        name: 'MyTopologySource',
        collectionLanguage: 'groovy',
      });

      const payload = buildModulePayload(config);

      expect(payload.name).toBe('MyTopologySource');
      expect(payload.displayName).toBeUndefined(); // TopologySource doesn't support displayName
      expect(payload.appliesTo).toBe('false()');
      expect(payload.collectionMethod).toBe('script');
      expect(payload.collectInterval).toBe(3600); // 1 hour default
      expect(payload.collectorAttribute?.scriptType).toBe('embed');
    });

    it('does not include AD config', () => {
      const config = createBaseConfig({
        moduleType: 'topologysource',
        hasMultiInstances: true, // Should be ignored for TopologySource
      });

      const payload = buildModulePayload(config);

      expect(payload.autoDiscoveryConfig).toBeUndefined();
      expect(payload.hasMultiInstances).toBeUndefined();
    });

    it('does not include dataPoints or configChecks', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'topologysource' }));

      expect(payload.dataPoints).toBeUndefined();
      expect(payload.configChecks).toBeUndefined();
    });
  });

  // ===========================================================================
  // PropertySource Payloads
  // ===========================================================================
  describe('PropertySource payload', () => {
    it('creates correct payload for PropertySource', () => {
      const config = createBaseConfig({
        moduleType: 'propertysource',
        name: 'MyPropertySource',
        collectionLanguage: 'groovy',
      });

      const payload = buildModulePayload(config);

      expect(payload.name).toBe('MyPropertySource');
      expect(payload.displayName).toBeUndefined(); // PropertySource doesn't support displayName
      expect(payload.appliesTo).toBe('false()');
      expect(payload.scriptType).toBe('embed');
      expect(payload.groovyScript).toBeDefined();
    });

    it('uses top-level groovyScript instead of collectorAttribute', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'propertysource' }));

      expect(payload.groovyScript).toBeDefined();
      expect(payload.collectorAttribute).toBeUndefined();
    });

    it('does not include collectInterval', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'propertysource' }));

      expect(payload.collectInterval).toBeUndefined();
    });
  });

  // ===========================================================================
  // LogSource Payloads
  // ===========================================================================
  describe('LogSource payload', () => {
    it('creates correct payload for LogSource', () => {
      const config = createBaseConfig({
        moduleType: 'logsource',
        name: 'MyLogSource',
        collectionLanguage: 'groovy', // Only Groovy supported
      });

      const payload = buildModulePayload(config);

      expect(payload.name).toBe('MyLogSource');
      expect(payload.displayName).toBeUndefined(); // LogSource doesn't support displayName
      expect(payload.appliesToScript).toBe('false()');
      expect(payload.collectionMethod).toBe('SCRIPT');
    });

    it('uses collectionInterval as object with units and offset', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'logsource' }));

      expect(payload.collectionInterval).toEqual({
        units: 'SECONDS',
        offset: 300, // 5 minutes default
      });
    });

    it('uses collectionAttribute.script.embeddedContent for script', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'logsource' }));

      expect(payload.collectionAttribute?.script?.embeddedContent).toBeDefined();
      expect(payload.collectionAttribute?.script?.type).toBe('GROOVY');
    });

    it('includes default logFields', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'logsource' }));

      expect(payload.logFields).toHaveLength(1);
      expect(payload.logFields?.[0].key).toBe('_resource.type');
      expect(payload.logFields?.[0].method).toBe('Token');
      expect(payload.logFields?.[0].value).toBe('##predef.externalResourceType##');
    });

    it('includes default resourceMapping', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'logsource' }));

      expect(payload.resourceMapping).toHaveLength(1);
      expect(payload.resourceMapping?.[0].key).toBe('system.deviceId');
      expect(payload.resourceMapping?.[0].method).toBe('Token');
      expect(payload.resourceMapping?.[0].value).toBe('##system.deviceId##');
    });
  });

  // ===========================================================================
  // EventSource Payloads
  // ===========================================================================
  describe('EventSource payload', () => {
    it('creates correct payload for EventSource', () => {
      const config = createBaseConfig({
        moduleType: 'eventsource',
        name: 'MyEventSource',
        collectionLanguage: 'groovy', // Only Groovy supported
      });

      const payload = buildModulePayload(config);

      expect(payload.name).toBe('MyEventSource');
      expect(payload.displayName).toBeUndefined(); // EventSource doesn't support displayName
      expect(payload.appliesTo).toBe('false()');
      expect(payload.collector).toBe('scriptevent');
      expect(payload.schedule).toBe(1800); // 30 minutes
    });

    it('uses top-level groovyScript and scriptType', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'eventsource' }));

      expect(payload.scriptType).toBe('embed');
      expect(payload.groovyScript).toBeDefined();
    });

    it('includes default alert settings', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'eventsource' }));

      expect(payload.alertLevel).toBe('warn');
      expect(payload.alertEffectiveIval).toBe(60);
      expect(payload.clearAfterAck).toBe(true);
      expect(payload.suppressDuplicatesES).toBe(true);
    });
  });

  // ===========================================================================
  // DiagnosticSource Payloads
  // ===========================================================================
  describe('DiagnosticSource payload', () => {
    it('creates correct payload for Groovy DiagnosticSource', () => {
      const config = createBaseConfig({
        moduleType: 'diagnosticsource',
        name: 'MyDiagnosticSource',
        collectionLanguage: 'groovy',
      });

      const payload = buildModulePayload(config);

      expect(payload.name).toBe('MyDiagnosticSource');
      expect(payload.displayName).toBeUndefined(); // DiagnosticSource doesn't support displayName
      expect(payload.appliesTo).toBe('false()');
      expect(payload.dataType).toBe(0);
      expect(payload.scriptType).toBe('embed');
      expect(payload.groovyScript).toBeDefined();
    });

    it('creates correct payload for PowerShell DiagnosticSource', () => {
      const config = createBaseConfig({
        moduleType: 'diagnosticsource',
        name: 'PsDiagnosticSource',
        collectionLanguage: 'powershell',
      });

      const payload = buildModulePayload(config);

      // DiagnosticSource uses groovyScript field for BOTH languages
      // scriptType indicates the actual language
      expect(payload.scriptType).toBe('powershell');
      expect(payload.groovyScript).toBeDefined();
    });

    it('does not include collectInterval', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'diagnosticsource' }));

      expect(payload.collectInterval).toBeUndefined();
    });

    it('does not include AD config', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'diagnosticsource' }));

      expect(payload.autoDiscoveryConfig).toBeUndefined();
    });
  });

  // ===========================================================================
  // Common Patterns
  // ===========================================================================
  describe('common patterns', () => {
    it('all module types set appliesTo to false()', () => {
      const moduleTypes = [
        'datasource',
        'configsource',
        'topologysource',
        'propertysource',
        'eventsource',
        'diagnosticsource',
      ] as const;

      for (const moduleType of moduleTypes) {
        const payload = buildModulePayload(createBaseConfig({ moduleType }));
        expect(payload.appliesTo).toBe('false()');
      }
    });

    it('LogSource uses appliesToScript', () => {
      const payload = buildModulePayload(createBaseConfig({ moduleType: 'logsource' }));
      expect(payload.appliesToScript).toBe('false()');
    });
  });
});
