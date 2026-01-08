import type { LogicModuleType } from './types';

export interface CollectIntervalOption {
  label: string;
  value: number; // in seconds
}

export type ModuleDetailsSection =
  | 'basic'
  | 'organization'
  | 'access'
  | 'appliesTo'
  | 'activeDiscovery'
  | 'datapoints'
  | 'configChecks'
  | 'alertSettings';

export type IntervalField = 'collectInterval' | 'schedule' | 'collectionInterval';

export interface ModuleTypeSchema {
  editableFields: string[];
  requiredFields: string[];
  sections: ModuleDetailsSection[];
  accessGroupSupport: boolean;
  portalEditUrlPattern: string; // URL pattern for LM portal edit page, e.g., '/santaba/uiv4/modules/toolbox/exchangeDataSources/edit/{moduleId}'
  collectIntervalOptions?: CollectIntervalOption[]; // User-friendly interval options
  intervalField?: IntervalField;
  intervalFormat?: 'seconds' | 'object';
  intervalLabel?: string;
  supportsAutoDiscovery?: boolean; // Whether this module type supports AD config
  autoDiscoveryEditableFields?: string[];
  autoDiscoveryDefaults?: Record<string, unknown>;
  fieldAliases?: Record<string, string>;
  readOnlyList?: 'configChecks';
  /** Editable list type for this module - datapoints can be edited for datasources */
  editableList?: 'datapoints';
  supportsAlertSettings?: boolean;
  alertSettingsFields?: string[];
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

const CONFIGSOURCE_COLLECT_INTERVALS: CollectIntervalOption[] = [
  { label: '1 hour', value: 3600 },
  { label: '4 hours', value: 14400 },
  { label: '8 hours', value: 28800 },
  { label: '24 hours', value: 86400 },
];

const TOPOLOGY_COLLECT_INTERVALS: CollectIntervalOption[] = [
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '4 hours', value: 14400 },
  { label: '12 hours', value: 43200 },
];

const EVENTSOURCE_SCHEDULE_INTERVALS: CollectIntervalOption[] = [
  ...Array.from({ length: 30 }, (_, index) => {
    const minutes = index + 1;
    return {
      label: minutes === 1 ? '1 minute' : `${minutes} minutes`,
      value: minutes * 60,
    };
  }),
  { label: '1 hour', value: 3600 },
  { label: '4 hours', value: 14400 },
  { label: '6 hours', value: 21600 },
  { label: '8 hours', value: 28800 },
  { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
];

const LOGSOURCE_COLLECTION_INTERVALS: CollectIntervalOption[] = DATASOURCE_COLLECT_INTERVALS;

export const MODULE_TYPE_SCHEMAS: Record<LogicModuleType, ModuleTypeSchema> = {
  datasource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'collectInterval', 'accessGroupIds', 'dataPoints'],
    requiredFields: ['name', 'collectInterval'],
    sections: ['basic', 'organization', 'access', 'appliesTo', 'activeDiscovery', 'datapoints'],
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeDataSources/edit/{moduleId}',
    collectIntervalOptions: DATASOURCE_COLLECT_INTERVALS,
    intervalField: 'collectInterval',
    intervalFormat: 'seconds',
    intervalLabel: 'Collect Interval',
    supportsAutoDiscovery: true,
    editableList: 'datapoints',
  },
  configsource: {
    editableFields: ['name', 'displayName', 'description', 'appliesTo', 'group', 'technology', 'tags', 'collectInterval', 'accessGroupIds'],
    requiredFields: ['name', 'collectInterval'],
    sections: ['basic', 'organization', 'access', 'appliesTo', 'activeDiscovery', 'configChecks'],
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeConfigSources/edit/{moduleId}',
    collectIntervalOptions: CONFIGSOURCE_COLLECT_INTERVALS,
    intervalField: 'collectInterval',
    intervalFormat: 'seconds',
    intervalLabel: 'Collect Interval',
    supportsAutoDiscovery: true,
    autoDiscoveryEditableFields: [
      'persistentInstance',
      'deleteInactiveInstance',
      'method',
      'disableInstance',
      'showDeletedInstanceDays',
    ],
    autoDiscoveryDefaults: {
      scheduleInterval: 0,
      instanceAutoGroupMethod: 'none',
      instanceAutoGroupMethodParams: null,
      filters: [],
    },
    readOnlyList: 'configChecks',
  },
  topologysource: {
    editableFields: ['name', 'description', 'appliesTo', 'group', 'technology', 'tags', 'collectInterval', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['basic', 'organization', 'access', 'appliesTo'],
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeTopologySources/edit/{moduleId}',
    collectIntervalOptions: TOPOLOGY_COLLECT_INTERVALS,
    intervalField: 'collectInterval',
    intervalFormat: 'seconds',
    intervalLabel: 'Collect Interval',
  },
  propertysource: {
    editableFields: ['name', 'description', 'appliesTo', 'group', 'technology', 'tags', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['basic', 'organization', 'access', 'appliesTo'],
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangePropertySources/edit/{moduleId}',
  },
  logsource: {
    editableFields: ['name', 'description', 'appliesTo', 'technology', 'tags', 'collectInterval', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['basic', 'organization', 'access', 'appliesTo'],
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeLogSources/edit/{moduleId}',
    collectIntervalOptions: LOGSOURCE_COLLECTION_INTERVALS,
    intervalField: 'collectionInterval',
    intervalFormat: 'object',
    intervalLabel: 'Collection Interval',
    fieldAliases: {
      appliesTo: 'appliesToScript',
      technology: 'technicalNotes',
      collectInterval: 'collectionInterval',
    },
  },
  diagnosticsource: {
    editableFields: ['name', 'description', 'appliesTo', 'group', 'technology', 'tags', 'accessGroupIds'],
    requiredFields: ['name'],
    sections: ['basic', 'organization', 'access', 'appliesTo'],
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeDiagnosticSources/edit/{moduleId}',
  },
  eventsource: {
    editableFields: [
      'name',
      'displayName',
      'description',
      'appliesTo',
      'group',
      'technology',
      'tags',
      'collectInterval',
      'accessGroupIds',
      'alertSubjectTemplate',
      'alertBodyTemplate',
      'alertLevel',
      'clearAfterAck',
      'alertEffectiveIval',
    ],
    requiredFields: ['name', 'collectInterval', 'alertEffectiveIval'],
    sections: ['basic', 'organization', 'access', 'appliesTo', 'alertSettings'],
    accessGroupSupport: true,
    portalEditUrlPattern: '/santaba/uiv4/modules/toolbox/exchangeEventSources/edit/{moduleId}',
    collectIntervalOptions: EVENTSOURCE_SCHEDULE_INTERVALS,
    intervalField: 'schedule',
    intervalFormat: 'seconds',
    intervalLabel: 'Schedule',
    fieldAliases: {
      collectInterval: 'schedule',
    },
    supportsAlertSettings: true,
    alertSettingsFields: [
      'alertSubjectTemplate',
      'alertBodyTemplate',
      'alertLevel',
      'clearAfterAck',
      'alertEffectiveIval',
    ],
  },
};

export function getSchemaFieldName(schema: ModuleTypeSchema, field: string): string {
  return schema.fieldAliases?.[field] || field;
}

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
