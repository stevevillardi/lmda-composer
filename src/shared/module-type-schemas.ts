import type { LogicModuleType } from './types';

export interface CollectIntervalOption {
  label: string;
  value: number; // in seconds
}

export interface ModuleTypeSchema {
  editableFields: string[];
  requiredFields: string[];
  sections: ('overview' | 'datapoints' | 'scripts' | 'rules' | 'topology')[];
  datapointSupport: boolean; // false for v1, deferred to future iteration
  accessGroupSupport: boolean;
  portalEditUrlPattern: string; // URL pattern for LM portal edit page, e.g., '/santaba/uiv4/modules/toolbox/exchangeDataSources/edit/{moduleId}'
  collectIntervalOptions?: CollectIntervalOption[]; // User-friendly collect interval options
  supportsAutoDiscovery?: boolean; // Whether this module type supports AD config
}

// Collect interval options for datasources: 1-30 min and 1,4,6,8,12,24 hours
const DATASOURCE_COLLECT_INTERVALS: CollectIntervalOption[] = [
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '3 minutes', value: 180 },
  { label: '4 minutes', value: 240 },
  { label: '5 minutes', value: 300 },
  { label: '6 minutes', value: 360 },
  { label: '7 minutes', value: 420 },
  { label: '8 minutes', value: 480 },
  { label: '9 minutes', value: 540 },
  { label: '10 minutes', value: 600 },
  { label: '15 minutes', value: 900 },
  { label: '20 minutes', value: 1200 },
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '4 hours', value: 14400 },
  { label: '6 hours', value: 21600 },
  { label: '8 hours', value: 28800 },
  { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
];

export const MODULE_TYPE_SCHEMAS: Record<LogicModuleType, ModuleTypeSchema> = {
  datasource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'collectInterval', 'accessGroupIds'],
    requiredFields: ['name', 'collectInterval'],
    sections: ['overview', 'datapoints'], // datapoints tab shows notice
    datapointSupport: false, // Deferred to future iteration
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeDataSources/edit/{moduleId}',
    collectIntervalOptions: DATASOURCE_COLLECT_INTERVALS,
    supportsAutoDiscovery: true,
  },
  configsource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['overview'],
    datapointSupport: false,
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeConfigSources/edit/{moduleId}',
  },
  topologysource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['overview'],
    datapointSupport: false,
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeTopologySources/edit/{moduleId}',
  },
  propertysource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['overview'],
    datapointSupport: false,
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangePropertySources/edit/{moduleId}',
  },
  logsource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['overview'],
    datapointSupport: false,
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeLogSources/edit/{moduleId}',
  },
  diagnosticsource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['overview'],
    datapointSupport: false,
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeDiagnosticSources/edit/{moduleId}',
  },
  eventsource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['overview'],
    datapointSupport: false,
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeEventSources/edit/{moduleId}',
  },
};

/**
 * Build LM portal edit URL for a module
 */
export function buildPortalEditUrl(
  portalHostname: string,
  moduleType: LogicModuleType,
  moduleId: number
): string {
  const schema = MODULE_TYPE_SCHEMAS[moduleType];
  const urlPath = schema.portalEditUrlPattern.replace('{moduleId}', moduleId.toString());
  return `https://${portalHostname}${urlPath}`;
}

