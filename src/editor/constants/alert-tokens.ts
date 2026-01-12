import type { LogicModuleType } from '@/shared/types';

/**
 * Alert token definition for LogicMonitor alert messages.
 */
export interface AlertToken {
  /** Token name without ## markers (e.g., "VALUE") */
  token: string;
  /** Human-readable description of what the token returns */
  description: string;
  /** Which module types this token is available for */
  availableFor: LogicModuleType[];
  /** Category for grouping in the UI */
  category: AlertTokenCategory;
}

/**
 * Categories for organizing alert tokens in the UI.
 */
export type AlertTokenCategory =
  | 'device-properties'
  | 'resource-info'
  | 'datasource-info'
  | 'datapoint-info'
  | 'alert-info'
  | 'collector-info'
  | 'status-display'
  | 'root-cause'
  | 'integration'
  | 'configsource-info'
  | 'eventsource-info'
  | 'jobmonitor-info'
  | 'website-info';

/**
 * Category labels for display in the UI.
 */
export const ALERT_TOKEN_CATEGORY_LABELS: Record<AlertTokenCategory, string> = {
  'device-properties': 'Device Properties',
  'resource-info': 'Resource Info',
  'datasource-info': 'DataSource Info',
  'datapoint-info': 'Datapoint Info',
  'alert-info': 'Alert Info',
  'collector-info': 'Collector Info',
  'status-display': 'Status Display Names',
  'root-cause': 'Root Cause Analysis',
  'integration': 'Integration',
  'configsource-info': 'ConfigSource Info',
  'eventsource-info': 'EventSource Info',
  'jobmonitor-info': 'JobMonitor Info',
  'website-info': 'Website Info',
};

/**
 * Ordered list of categories for display in the UI.
 * Categories are shown in this order after "Frequently Used".
 */
export const ALERT_TOKEN_CATEGORY_ORDER: AlertTokenCategory[] = [
  'device-properties',
  'resource-info',
  'datasource-info',
  'datapoint-info',
  'alert-info',
  'collector-info',
  'status-display',
  'root-cause',
  'integration',
];

/**
 * Tokens that appear in the "Frequently Used" section at the top.
 */
export const FREQUENTLY_USED_TOKENS: string[] = [
  'VALUE',
  'DATAPOINT',
  'DSIDESCRIPTION',
  'EXTERNALTICKETID',
  'HOST',
  'HOSTNAME',
  'INSTANCE',
  'LEVEL',
  'START',
  'WILDVALUE',
  'DURATION',
  'END',
];

/**
 * All available alert tokens with their metadata.
 */
export const ALERT_TOKENS: AlertToken[] = [
  // Device Properties (dynamic)
  {
    token: '<DEVICEPROPERTYNAME>',
    description: 'Value of a device/instance property (custom or system). Replace with actual property name.',
    availableFor: ['datasource'],
    category: 'device-properties',
  },

  // Resource Info
  {
    token: 'HOST',
    description: 'The resource that is in the alert.',
    availableFor: ['datasource', 'eventsource'],
    category: 'resource-info',
  },
  {
    token: 'HOSTNAME',
    description: 'The display name of the resource in the alert.',
    availableFor: ['datasource', 'eventsource'],
    category: 'resource-info',
  },
  {
    token: 'HOSTDESCRIPTION',
    description: 'The text description of the resource. Returns "null" if not available.',
    availableFor: ['datasource', 'eventsource'],
    category: 'resource-info',
  },
  {
    token: 'GROUP',
    description: 'Groups this host or resource is a member of.',
    availableFor: ['datasource', 'eventsource'],
    category: 'resource-info',
  },
  {
    token: 'DEVICEURL',
    description: 'The URL link associated with the device. Returns "null" if not available.',
    availableFor: ['datasource', 'eventsource'],
    category: 'resource-info',
  },

  // DataSource Info
  {
    token: 'DATASOURCE',
    description: 'The DataSource display name. For multi-instance, includes instance name.',
    availableFor: ['datasource'],
    category: 'datasource-info',
  },
  {
    token: 'DSNAME',
    description: 'The DataSource name (technical name, not display name).',
    availableFor: ['datasource'],
    category: 'datasource-info',
  },
  {
    token: 'DSDESCRIPTION',
    description: 'The description of the DataSource. Returns "null" if not available.',
    availableFor: ['datasource'],
    category: 'datasource-info',
  },
  {
    token: 'INSTANCE',
    description: 'The name of the DataSource instance (e.g., "C:\\").',
    availableFor: ['datasource'],
    category: 'datasource-info',
  },
  {
    token: 'DSIDESCRIPTION',
    description: 'The description of the instance. Returns "null" if not available.',
    availableFor: ['datasource'],
    category: 'datasource-info',
  },
  {
    token: 'INSTANCEGROUP',
    description: 'The name of the group to which the alerting instance belongs.',
    availableFor: ['datasource'],
    category: 'datasource-info',
  },
  {
    token: 'WILDVALUE',
    description: 'The instance value (wild value used in Active Discovery).',
    availableFor: ['datasource'],
    category: 'datasource-info',
  },

  // Datapoint Info
  {
    token: 'DATAPOINT',
    description: 'The name of the Datapoint that is in alert.',
    availableFor: ['datasource'],
    category: 'datapoint-info',
  },
  {
    token: 'DPDESCRIPTION',
    description: 'The description of the datapoint. Returns "null" if not available.',
    availableFor: ['datasource'],
    category: 'datapoint-info',
  },
  {
    token: 'VALUE',
    description: 'The value of the datapoint at the time the alert was generated.',
    availableFor: ['datasource', 'eventsource'],
    category: 'datapoint-info',
  },
  {
    token: 'THRESHOLD',
    description: 'The alert threshold that triggered the alert (includes dynamic threshold details).',
    availableFor: ['datasource'],
    category: 'datapoint-info',
  },
  {
    token: 'DTALERTDESCRIPTION',
    description: 'Details of the dynamic threshold configuration that was exceeded.',
    availableFor: ['datasource'],
    category: 'datapoint-info',
  },

  // Alert Info
  {
    token: 'ALERTID',
    description: 'The LMDXXXX LogicMonitor alert ID (not unique per alert session).',
    availableFor: ['datasource', 'eventsource', 'configsource'],
    category: 'alert-info',
  },
  {
    token: 'INTERNALID',
    description: 'A unique alert ID (DSXXXXXXXX) that updates as severity changes.',
    availableFor: ['datasource', 'eventsource', 'configsource'],
    category: 'alert-info',
  },
  {
    token: 'ALERTSTATUS',
    description: 'Whether the alert is active, clear, ack, update, or test.',
    availableFor: ['datasource'],
    category: 'alert-info',
  },
  {
    token: 'LEVEL',
    description: 'The severity of the alert.',
    availableFor: ['datasource', 'eventsource', 'configsource'],
    category: 'alert-info',
  },
  {
    token: 'START',
    description: 'The time the alert condition started.',
    availableFor: ['datasource', 'eventsource', 'configsource'],
    category: 'alert-info',
  },
  {
    token: 'END',
    description: 'Displays the cleared date and time for alert clear messages.',
    availableFor: ['datasource', 'eventsource', 'configsource'],
    category: 'alert-info',
  },
  {
    token: 'DURATION',
    description: 'How long the alert has been in existence.',
    availableFor: ['datasource', 'eventsource'],
    category: 'alert-info',
  },
  {
    token: 'STARTEPOCH',
    description: 'The time (in Unix epoch) when this alert started.',
    availableFor: ['datasource', 'eventsource'],
    category: 'alert-info',
  },
  {
    token: 'ENDEPOCH',
    description: 'The time (in Unix epoch) when this alert cleared.',
    availableFor: ['datasource', 'eventsource', 'configsource'],
    category: 'alert-info',
  },
  {
    token: 'DATE',
    description: 'The date the alert was sent.',
    availableFor: ['datasource', 'eventsource'],
    category: 'alert-info',
  },
  {
    token: 'ALERTDETAILURL',
    description: 'The URL of the Alert Details page.',
    availableFor: ['datasource', 'eventsource', 'configsource'],
    category: 'alert-info',
  },

  // Collector Info
  {
    token: 'AGENT_DESCRIPTION',
    description: 'The name (description) of the Collector assigned to the device.',
    availableFor: ['datasource', 'eventsource'],
    category: 'collector-info',
  },
  {
    token: 'AGENTID',
    description: 'The ID of the Collector assigned to the device.',
    availableFor: ['datasource', 'eventsource'],
    category: 'collector-info',
  },
  {
    token: 'BACKUPAGENT_DESCRIPTION',
    description: 'The name of the failover Collector (if configured).',
    availableFor: ['datasource', 'eventsource'],
    category: 'collector-info',
  },
  {
    token: 'BACKUPAGENTID',
    description: 'The ID of the failover Collector (if configured).',
    availableFor: ['datasource', 'eventsource'],
    category: 'collector-info',
  },

  // Status Display Names (new tokens for gauge datapoints)
  {
    token: 'ALERTVALUEDISPLAYSTATUSNAME',
    description: 'The translated status display name for the alert value.',
    availableFor: ['datasource'],
    category: 'status-display',
  },
  {
    token: 'CLEARALERTVALUEDISPLAYNAME',
    description: 'The translated status display name for the clear value.',
    availableFor: ['datasource'],
    category: 'status-display',
  },

  // Root Cause Analysis
  {
    token: 'ALERTDEPENDENCYROLE',
    description: 'The role of the alert in the root cause incident.',
    availableFor: ['datasource'],
    category: 'root-cause',
  },
  {
    token: 'DEPENDENCYMESSAGE',
    description: 'All root cause details that accompany alerts after root cause analysis.',
    availableFor: ['datasource'],
    category: 'root-cause',
  },
  {
    token: 'DEPENDENTALERTCOUNT',
    description: 'The number of alerts dependent on the current alert.',
    availableFor: ['datasource'],
    category: 'root-cause',
  },
  {
    token: 'DEPENDENTRESOURCECOUNT',
    description: 'The number of resources dependent on the current alert.',
    availableFor: ['datasource'],
    category: 'root-cause',
  },
  {
    token: 'DIRECTCAUSE',
    description: 'The resources determined to be the direct cause of the current alert.',
    availableFor: ['datasource'],
    category: 'root-cause',
  },
  {
    token: 'ORIGINATINGCAUSE',
    description: 'The resources determined to be the originating cause of the current alert.',
    availableFor: ['datasource'],
    category: 'root-cause',
  },
  {
    token: 'ROUTINGSTATE',
    description: 'The status of the current alert\'s notification routing.',
    availableFor: ['datasource'],
    category: 'root-cause',
  },

  // Integration
  {
    token: 'EXTERNALTICKETID',
    description: 'List of integration ticket IDs and associated integration names.',
    availableFor: ['datasource', 'eventsource', 'configsource'],
    category: 'integration',
  },
  {
    token: 'LIMITEDMESSAGE',
    description: 'DataSource: No Data | Infinity | value. EventSource: First 10 words of message.',
    availableFor: ['datasource', 'eventsource'],
    category: 'integration',
  },
];

/**
 * Get tokens available for a specific module type.
 * @param moduleType - The module type to filter tokens for
 * @returns Array of tokens available for the specified module type
 */
export function getTokensForModuleType(moduleType: LogicModuleType): AlertToken[] {
  return ALERT_TOKENS.filter((token) => token.availableFor.includes(moduleType));
}

/**
 * Get tokens grouped by category for a specific module type.
 * @param moduleType - The module type to filter tokens for
 * @returns Map of category to tokens
 */
export function getTokensByCategory(moduleType: LogicModuleType): Map<AlertTokenCategory, AlertToken[]> {
  const tokens = getTokensForModuleType(moduleType);
  const grouped = new Map<AlertTokenCategory, AlertToken[]>();

  for (const category of ALERT_TOKEN_CATEGORY_ORDER) {
    const categoryTokens = tokens.filter((t) => t.category === category);
    if (categoryTokens.length > 0) {
      grouped.set(category, categoryTokens);
    }
  }

  return grouped;
}

/**
 * Get frequently used tokens for a specific module type.
 * @param moduleType - The module type to filter tokens for
 * @returns Array of frequently used tokens
 */
export function getFrequentlyUsedTokens(moduleType: LogicModuleType): AlertToken[] {
  const tokens = getTokensForModuleType(moduleType);
  return FREQUENTLY_USED_TOKENS
    .map((name) => tokens.find((t) => t.token === name))
    .filter((t): t is AlertToken => t !== undefined);
}
