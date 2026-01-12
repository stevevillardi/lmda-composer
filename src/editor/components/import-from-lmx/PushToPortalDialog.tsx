import { useState, useEffect, useMemo } from 'react';
import { Upload, Loader2, AlertCircle, type LucideIcon, Info, FolderTree, Shield, Filter, Target, Database, Bell, FileCode, FolderSearch, Settings, Tags, Link2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DiffEditor } from '../composer/DiffEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { portalToasts } from '../../utils/toast-utils';
import { useEditorStore } from '../../stores/editor-store';
import type { LogicModuleType, ScriptLanguage } from '@/shared/types';
import { MODULE_TYPE_SCHEMAS } from '@/shared/module-type-schemas';

interface PushToPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason?: string) => Promise<void>;
  moduleName: string;
  moduleType: LogicModuleType;
  scriptType: 'collection' | 'ad';
  scriptLanguage?: ScriptLanguage;
  originalScript: string;
  newScript: string;
  hasConflict?: boolean;
  conflictMessage?: string;
  isPushing?: boolean;
}

const MODULE_TYPE_LABELS: Record<LogicModuleType, string> = {
  datasource: 'DataSource',
  configsource: 'ConfigSource',
  topologysource: 'TopologySource',
  propertysource: 'PropertySource',
  logsource: 'LogSource',
  diagnosticsource: 'DiagnosticSource',
  eventsource: 'EventSource',
};

export function PushToPortalDialog({
  open,
  onOpenChange,
  onConfirm,
  moduleName,
  moduleType,
  scriptType,
  scriptLanguage = 'groovy',
  originalScript,
  newScript,
  hasConflict = false,
  conflictMessage,
  isPushing = false,
}: PushToPortalDialogProps) {
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushReason, setPushReason] = useState('');
  
  // Backwards compatibility alias
  const isCommitting = isPushing;
  const commitReason = pushReason;
  const setCommitReason = setPushReason;
  const commitError = pushError;
  const setCommitError = setPushError;
  const { preferences, activeTabId, moduleDetailsDraftByTabId, accessGroups, directoryScriptsForCommit, selectedScriptsForCommit, toggleScriptForCommit } = useEditorStore();
  
  // Get module details changes
  const moduleDetailsDraft = activeTabId ? moduleDetailsDraftByTabId[activeTabId] : null;
  const hasModuleDetailsChanges = moduleDetailsDraft && moduleDetailsDraft.dirtyFields.size > 0;
  const hasScriptChanges = originalScript.trim() !== newScript.trim();
  const hasAdConfigPayload = scriptType === 'ad' && hasScriptChanges && !!moduleDetailsDraft?.draft?.autoDiscoveryConfig;
  const scriptTypeLabel = scriptType === 'ad' ? 'Active Discovery Script' : 'Collection Script';
  
  // Directory scripts support
  const hasDirectoryScripts = directoryScriptsForCommit && directoryScriptsForCommit.length > 0;
  const scriptsWithChanges = directoryScriptsForCommit?.filter(s => s.hasChanges) ?? [];
  const hasSelectedScripts = selectedScriptsForCommit.size > 0;
  const normalizeAccessGroupIds = (value: unknown): number[] => {
    if (Array.isArray(value)) {
      return value
        .map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
        .filter((id) => typeof id === 'number' && !Number.isNaN(id))
        .sort((a, b) => a - b);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !Number.isNaN(id))
        .sort((a, b) => a - b);
    }
    return [];
  };

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const deepEqual = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) {
      return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepEqual(item, b[index]));
    }
    if (isPlainObject(a) && isPlainObject(b)) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) => deepEqual(a[key], b[key]));
    }
    return false;
  };

  const schema = MODULE_TYPE_SCHEMAS[moduleType];
  const collectIntervalOptions = schema.collectIntervalOptions || [];
  const scheduleIntervalOptions = [
    { label: 'On host/data source change (0 min)', value: 0 },
    { label: '15 minutes', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '24 hours', value: 1440 },
  ];
  const instanceAutoGroupMethodOptions = [
    { label: 'None', value: 'none' },
    { label: 'Regex', value: 'regex' },
    { label: 'ILP', value: 'ilp' },
  ];

  const formatCollectInterval = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (typeof value !== 'number') return String(value);
    const option = collectIntervalOptions.find((opt) => opt.value === value);
    return option?.label || `${value} seconds`;
  };

  const formatAccessGroups = (value: unknown) => {
    const ids = normalizeAccessGroupIds(value);
    if (ids.length === 0) return '(none)';
    return ids
      .map((id) => accessGroups.find((group) => group.id === id)?.name || `#${id}`)
      .join(', ');
  };

  const formatBoolean = (value: unknown) => {
    if (value === null || value === undefined) return '(empty)';
    return value ? 'Yes' : 'No';
  };

  const formatScheduleInterval = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (typeof value !== 'number') return String(value);
    return scheduleIntervalOptions.find((opt) => opt.value === value)?.label || `${value} minutes`;
  };

  const formatAutoGroupMethod = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    const option = instanceAutoGroupMethodOptions.find((opt) => opt.value === value);
    return option?.label || String(value);
  };

  const formatFiltersLines = (value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value
      .map((filter) => {
        if (!filter || typeof filter !== 'object') return '';
        const entry = filter as { attribute?: string; operation?: string; value?: string };
        const attribute = entry.attribute || '(attribute)';
        const operation = entry.operation || '(operation)';
        const filterValue = entry.value ? ` ${entry.value}` : '';
        return `${attribute} ${operation}${filterValue}`;
      })
      .filter(Boolean);
  };

  // Sort object keys recursively for consistent JSON output
  const sortObjectKeys = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
      return obj.map(sortObjectKeys);
    }
    if (obj !== null && typeof obj === 'object') {
      const sorted: Record<string, unknown> = {};
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .forEach((key) => {
          sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
        });
      return sorted;
    }
    return obj;
  };

  // Sort datapoints by name and sort keys within each datapoint for consistent diffs
  const sortDatapoints = <T extends { name?: string }>(datapoints: T[]): T[] => {
    const sorted = [...datapoints].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return sorted.map((dp) => sortObjectKeys(dp)) as T[];
  };

  // Datapoint change status for display
  type DatapointChangeStatus = 'added' | 'removed' | 'modified' | 'unchanged';
  
  interface DatapointDisplayItem {
    name: string;
    status: DatapointChangeStatus;
  }

  // Compare datapoints and return items with change status
  const compareDatapoints = (
    originalDps: Array<Record<string, unknown>>,
    modifiedDps: Array<Record<string, unknown>>
  ): DatapointDisplayItem[] => {
    const originalByName = new Map(originalDps.map(dp => [dp.name as string, dp]));
    const modifiedByName = new Map(modifiedDps.map(dp => [dp.name as string, dp]));
    
    const allNames = new Set([...originalByName.keys(), ...modifiedByName.keys()]);
    const sortedNames = [...allNames].sort((a, b) => a.localeCompare(b));
    
    return sortedNames.map(name => {
      const original = originalByName.get(name);
      const modified = modifiedByName.get(name);
      
      if (!original && modified) {
        return { name, status: 'added' as const };
      }
      if (original && !modified) {
        return { name, status: 'removed' as const };
      }
      // Both exist - check if modified
      if (!deepEqual(original, modified)) {
        return { name, status: 'modified' as const };
      }
      return { name, status: 'unchanged' as const };
    });
  };

  // Config check change status for display (same pattern as datapoints)
  type ConfigCheckChangeStatus = 'added' | 'removed' | 'modified' | 'unchanged';
  
  interface ConfigCheckDisplayItem {
    name: string;
    status: ConfigCheckChangeStatus;
  }

  // Sort config checks by name and sort keys within each check
  const sortConfigChecks = <T extends { name?: string }>(checks: T[]): T[] => {
    const sorted = [...checks].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return sorted.map((c) => sortObjectKeys(c)) as T[];
  };

  // Compare config checks and return items with change status
  const compareConfigChecks = (
    originalChecks: Array<Record<string, unknown>>,
    modifiedChecks: Array<Record<string, unknown>>
  ): ConfigCheckDisplayItem[] => {
    const originalByName = new Map(originalChecks.map(c => [c.name as string, c]));
    const modifiedByName = new Map(modifiedChecks.map(c => [c.name as string, c]));
    
    const allNames = new Set([...originalByName.keys(), ...modifiedByName.keys()]);
    const sortedNames = [...allNames].sort((a, b) => a.localeCompare(b));
    
    return sortedNames.map(name => {
      const original = originalByName.get(name);
      const modified = modifiedByName.get(name);
      
      if (!original && modified) {
        return { name, status: 'added' as const };
      }
      if (original && !modified) {
        return { name, status: 'removed' as const };
      }
      // Both exist - check if modified
      if (!deepEqual(original, modified)) {
        return { name, status: 'modified' as const };
      }
      return { name, status: 'unchanged' as const };
    });
  };

  // LogSource filter change status for display
  type LogSourceItemChangeStatus = 'added' | 'removed' | 'modified' | 'unchanged';
  
  interface LogSourceFilterDisplayItem {
    value: string;
    operator: string;
    status: LogSourceItemChangeStatus;
  }

  interface LogSourceLogFieldDisplayItem {
    key: string;
    method: string;
    status: LogSourceItemChangeStatus;
  }

  interface LogSourceResourceMappingDisplayItem {
    key: string;
    method: string;
    index: number;
    status: LogSourceItemChangeStatus;
  }

  // Compare LogSource filters
  const compareLogSourceFilters = (
    originalFilters: Array<Record<string, unknown>>,
    modifiedFilters: Array<Record<string, unknown>>
  ): LogSourceFilterDisplayItem[] => {
    // Use value+operator as key since filters don't have a name
    const getFilterKey = (f: Record<string, unknown>) => `${f.operator}:${f.value}`;
    const originalByKey = new Map(originalFilters.map(f => [getFilterKey(f), f]));
    const modifiedByKey = new Map(modifiedFilters.map(f => [getFilterKey(f), f]));
    
    const allKeys = new Set([...originalByKey.keys(), ...modifiedByKey.keys()]);
    const sortedKeys = [...allKeys].sort();
    
    return sortedKeys.map(key => {
      const original = originalByKey.get(key);
      const modified = modifiedByKey.get(key);
      const parts = key.split(':');
      const operator = parts[0] || '';
      const value = parts.slice(1).join(':') || '';
      
      if (!original && modified) {
        return { value, operator, status: 'added' as const };
      }
      if (original && !modified) {
        return { value, operator, status: 'removed' as const };
      }
      if (!deepEqual(original, modified)) {
        return { value, operator, status: 'modified' as const };
      }
      return { value, operator, status: 'unchanged' as const };
    });
  };

  // Compare LogSource log fields
  const compareLogSourceLogFields = (
    originalFields: Array<Record<string, unknown>>,
    modifiedFields: Array<Record<string, unknown>>
  ): LogSourceLogFieldDisplayItem[] => {
    const originalByKey = new Map(originalFields.map(f => [f.key as string, f]));
    const modifiedByKey = new Map(modifiedFields.map(f => [f.key as string, f]));
    
    const allKeys = new Set([...originalByKey.keys(), ...modifiedByKey.keys()]);
    const sortedKeys = [...allKeys].sort((a, b) => a.localeCompare(b));
    
    return sortedKeys.map(key => {
      const original = originalByKey.get(key);
      const modified = modifiedByKey.get(key);
      const method = (modified?.method || original?.method || '') as string;
      
      if (!original && modified) {
        return { key, method, status: 'added' as const };
      }
      if (original && !modified) {
        return { key, method, status: 'removed' as const };
      }
      if (!deepEqual(original, modified)) {
        return { key, method, status: 'modified' as const };
      }
      return { key, method, status: 'unchanged' as const };
    });
  };

  // Compare LogSource resource mappings
  const compareLogSourceResourceMappings = (
    originalMappings: Array<Record<string, unknown>>,
    modifiedMappings: Array<Record<string, unknown>>
  ): LogSourceResourceMappingDisplayItem[] => {
    const originalByKey = new Map(originalMappings.map(m => [m.key as string, m]));
    const modifiedByKey = new Map(modifiedMappings.map(m => [m.key as string, m]));
    
    const allKeys = new Set([...originalByKey.keys(), ...modifiedByKey.keys()]);
    const sortedKeys = [...allKeys].sort((a, b) => a.localeCompare(b));
    
    return sortedKeys.map(key => {
      const original = originalByKey.get(key);
      const modified = modifiedByKey.get(key);
      const method = (modified?.method || original?.method || '') as string;
      const index = (modified?.index ?? original?.index ?? 0) as number;
      
      if (!original && modified) {
        return { key, method, index, status: 'added' as const };
      }
      if (original && !modified) {
        return { key, method, index, status: 'removed' as const };
      }
      if (!deepEqual(original, modified)) {
        return { key, method, index, status: 'modified' as const };
      }
      return { key, method, index, status: 'unchanged' as const };
    });
  };

  const readableModuleDetailsChanges = useMemo(() => {
    if (!moduleDetailsDraft || !hasModuleDetailsChanges) return [];
    const changes: Array<{
      key: string;
      section: string;
      label: string;
      original: string;
      modified: string;
      originalLines?: string[];
      modifiedLines?: string[];
      datapointItems?: DatapointDisplayItem[];
      configCheckItems?: ConfigCheckDisplayItem[];
      logSourceFilterItems?: LogSourceFilterDisplayItem[];
      logSourceLogFieldItems?: LogSourceLogFieldDisplayItem[];
      logSourceResourceMappingItems?: LogSourceResourceMappingDisplayItem[];
    }> = [];

    const pushChange = (key: string, section: string, label: string, original: unknown, modified: unknown) => {
      const formatValue = (val: unknown) => {
        if (val === null || val === undefined || val === '') return '(empty)';
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
      };
      changes.push({
        key,
        section,
        label,
        original: formatValue(original),
        modified: formatValue(modified),
      });
    };

    const formatTags = (val: unknown) => {
      if (val === null || val === undefined) return '(none)';
      if (Array.isArray(val)) return val.length ? val.join(', ') : '(none)';
      const text = String(val).trim();
      return text.length ? text : '(none)';
    };

    for (const field of moduleDetailsDraft.dirtyFields) {
      const original = moduleDetailsDraft.original?.[field as keyof typeof moduleDetailsDraft.original];
      const modified = moduleDetailsDraft.draft[field as keyof typeof moduleDetailsDraft.draft];

      switch (field) {
        case 'name':
          pushChange(field, 'Basic', 'Name', original, modified);
          break;
        case 'displayName':
          pushChange(field, 'Basic', 'Resource Label', original, modified);
          break;
        case 'description':
          pushChange(field, 'Basic', 'Description', original, modified);
          break;
        case 'collectInterval': {
          const intervalLabel = schema.intervalLabel || 'Collect Interval';
          changes.push({
            key: field,
            section: 'Basic',
            label: intervalLabel,
            original: formatCollectInterval(original),
            modified: formatCollectInterval(modified),
          });
          break;
        }
        case 'group':
          pushChange(field, 'Organization', 'Group', original, modified);
          break;
        case 'tags':
          changes.push({
            key: field,
            section: 'Organization',
            label: 'Tags',
            original: formatTags(original),
            modified: formatTags(modified),
          });
          break;
        case 'technology':
          pushChange(
            field,
            'Organization',
            schema.fieldAliases?.technology === 'technicalNotes' ? 'Technical Notes' : 'Technology',
            original,
            modified
          );
          break;
        case 'appliesTo':
          pushChange(
            field,
            'Applies To',
            schema.fieldAliases?.appliesTo === 'appliesToScript' ? 'Applies To Script' : 'Applies To',
            original,
            modified
          );
          break;
        case 'accessGroupIds':
          changes.push({
            key: field,
            section: 'Access',
            label: 'Access Groups',
            original: formatAccessGroups(original),
            modified: formatAccessGroups(modified),
          });
          break;
        case 'enableAutoDiscovery':
          changes.push({
            key: field,
            section: 'Active Discovery',
            label: 'Auto Discovery Enabled',
            original: formatBoolean(original),
            modified: formatBoolean(modified),
          });
          break;
        case 'alertSubjectTemplate':
          pushChange(field, 'Alert Settings', 'Alert Subject Template', original, modified);
          break;
        case 'alertBodyTemplate':
          pushChange(field, 'Alert Settings', 'Alert Body Template', original, modified);
          break;
        case 'alertLevel':
          pushChange(field, 'Alert Settings', 'Alert Level', original, modified);
          break;
        case 'clearAfterAck':
          pushChange(field, 'Alert Settings', 'Clear After ACK', formatBoolean(original), formatBoolean(modified));
          break;
        case 'alertEffectiveIval':
          pushChange(field, 'Alert Settings', 'Auto Clear After (minutes)', original, modified);
          break;
        case 'autoDiscoveryConfig': {
          const originalConfig = (original || {}) as Record<string, unknown>;
          const modifiedConfig = (modified || {}) as Record<string, unknown>;
          const adFields: Array<{
            key: string;
            label: string;
            format: (value: unknown) => string;
          }> = [
            { key: 'scheduleInterval', label: 'Schedule Interval', format: formatScheduleInterval },
            { key: 'persistentInstance', label: 'Persistent Instance', format: formatBoolean },
            { key: 'deleteInactiveInstance', label: 'Delete Inactive Instance', format: formatBoolean },
            { key: 'showDeletedInstanceDays', label: 'Show Deleted Instance Days', format: (val) => (val === 30 ? '30 days' : '0 days') },
            { key: 'disableInstance', label: 'Disable Instance', format: formatBoolean },
            { key: 'instanceAutoGroupMethod', label: 'Instance Auto Group Method', format: formatAutoGroupMethod },
            { key: 'instanceAutoGroupMethodParams', label: 'Instance Auto Group Method Parameters', format: (val) => (val ? String(val) : '(empty)') },
            { key: 'filters', label: 'Filters', format: (val) => (formatFiltersLines(val).length ? formatFiltersLines(val).join('; ') : '(none)') },
          ];

          adFields.forEach((entry) => {
            const originalValue = originalConfig[entry.key];
            const modifiedValue = modifiedConfig[entry.key];
            if (!deepEqual(originalValue, modifiedValue)) {
              const originalLines = entry.key === 'filters' ? formatFiltersLines(originalValue) : undefined;
              const modifiedLines = entry.key === 'filters' ? formatFiltersLines(modifiedValue) : undefined;
              changes.push({
                key: `${field}.${entry.key}`,
                section: 'Active Discovery',
                label: entry.label,
                original: entry.format(originalValue),
                modified: entry.format(modifiedValue),
                originalLines,
                modifiedLines,
              });
            }
          });
          break;
        }
        case 'dataPoints': {
          const originalDps = Array.isArray(original) ? (original as Array<Record<string, unknown>>) : [];
          const modifiedDps = Array.isArray(modified) ? (modified as Array<Record<string, unknown>>) : [];
          const datapointItems = compareDatapoints(originalDps, modifiedDps);
          const changedCount = datapointItems.filter(dp => dp.status !== 'unchanged').length;
          changes.push({
            key: field,
            section: 'Datapoints',
            label: `Datapoints (${changedCount} changed)`,
            original: `${originalDps.length} datapoint${originalDps.length !== 1 ? 's' : ''}`,
            modified: `${modifiedDps.length} datapoint${modifiedDps.length !== 1 ? 's' : ''}`,
            datapointItems,
          });
          break;
        }
        case 'configChecks': {
          const originalChecks = Array.isArray(original) ? (original as Array<Record<string, unknown>>) : [];
          const modifiedChecks = Array.isArray(modified) ? (modified as Array<Record<string, unknown>>) : [];
          const configCheckItems = compareConfigChecks(originalChecks, modifiedChecks);
          const changedCount = configCheckItems.filter(c => c.status !== 'unchanged').length;
          changes.push({
            key: field,
            section: 'Config Checks',
            label: `Config Checks (${changedCount} changed)`,
            original: `${originalChecks.length} check${originalChecks.length !== 1 ? 's' : ''}`,
            modified: `${modifiedChecks.length} check${modifiedChecks.length !== 1 ? 's' : ''}`,
            configCheckItems,
          });
          break;
        }
        case 'filters': {
          const originalFilters = Array.isArray(original) ? (original as Array<Record<string, unknown>>) : [];
          const modifiedFilters = Array.isArray(modified) ? (modified as Array<Record<string, unknown>>) : [];
          const logSourceFilterItems = compareLogSourceFilters(originalFilters, modifiedFilters);
          const changedCount = logSourceFilterItems.filter(f => f.status !== 'unchanged').length;
          changes.push({
            key: field,
            section: 'Include Filters',
            label: `Include Filters (${changedCount} changed)`,
            original: `${originalFilters.length} filter${originalFilters.length !== 1 ? 's' : ''}`,
            modified: `${modifiedFilters.length} filter${modifiedFilters.length !== 1 ? 's' : ''}`,
            logSourceFilterItems,
          });
          break;
        }
        case 'logFields': {
          const originalFields = Array.isArray(original) ? (original as Array<Record<string, unknown>>) : [];
          const modifiedFields = Array.isArray(modified) ? (modified as Array<Record<string, unknown>>) : [];
          const logSourceLogFieldItems = compareLogSourceLogFields(originalFields, modifiedFields);
          const changedCount = logSourceLogFieldItems.filter(f => f.status !== 'unchanged').length;
          changes.push({
            key: field,
            section: 'Log Fields',
            label: `Log Fields (${changedCount} changed)`,
            original: `${originalFields.length} field${originalFields.length !== 1 ? 's' : ''}`,
            modified: `${modifiedFields.length} field${modifiedFields.length !== 1 ? 's' : ''}`,
            logSourceLogFieldItems,
          });
          break;
        }
        case 'resourceMapping': {
          const originalMappings = Array.isArray(original) ? (original as Array<Record<string, unknown>>) : [];
          const modifiedMappings = Array.isArray(modified) ? (modified as Array<Record<string, unknown>>) : [];
          const logSourceResourceMappingItems = compareLogSourceResourceMappings(originalMappings, modifiedMappings);
          const changedCount = logSourceResourceMappingItems.filter(m => m.status !== 'unchanged').length;
          changes.push({
            key: field,
            section: 'Resource Mappings',
            label: `Resource Mappings (${changedCount} changed)`,
            original: `${originalMappings.length} mapping${originalMappings.length !== 1 ? 's' : ''}`,
            modified: `${modifiedMappings.length} mapping${modifiedMappings.length !== 1 ? 's' : ''}`,
            logSourceResourceMappingItems,
          });
          break;
        }
        case 'collectionAttribute': {
          const originalConfig = (original || {}) as Record<string, unknown>;
          const modifiedConfig = (modified || {}) as Record<string, unknown>;
          // Check for filterOp change
          if (!deepEqual(originalConfig.filterOp, modifiedConfig.filterOp)) {
            changes.push({
              key: `${field}.filterOp`,
              section: 'Include Filters',
              label: 'Filter Operation',
              original: originalConfig.filterOp === 'OR' ? 'OR' : 'AND',
              modified: modifiedConfig.filterOp === 'OR' ? 'OR' : 'AND',
            });
          }
          // Check for resourceMappingOp change
          if (!deepEqual(originalConfig.resourceMappingOp, modifiedConfig.resourceMappingOp)) {
            changes.push({
              key: `${field}.resourceMappingOp`,
              section: 'Resource Mappings',
              label: 'Mapping Operation',
              original: originalConfig.resourceMappingOp === 'OR' ? 'OR' : 'AND',
              modified: modifiedConfig.resourceMappingOp === 'OR' ? 'OR' : 'AND',
            });
          }
          break;
        }
        default:
          pushChange(field, 'Module', field, original, modified);
      }
    }

    return changes;
  }, [moduleDetailsDraft, hasModuleDetailsChanges, accessGroups, collectIntervalOptions, schema]);

  const groupedReadableChanges = useMemo(() => {
    const groups = new Map<string, typeof readableModuleDetailsChanges>();
    readableModuleDetailsChanges.forEach((change) => {
      const group = groups.get(change.section) || [];
      group.push(change);
      groups.set(change.section, group);
    });
    return Array.from(groups.entries()).map(([section, items]) => ({
      section,
      items,
    }));
  }, [readableModuleDetailsChanges]);

  const moduleDetailsPayload = useMemo(() => {
    if (!moduleDetailsDraft || (!hasModuleDetailsChanges && !hasAdConfigPayload)) return null;
    const payload: Record<string, unknown> = {};
    if (hasModuleDetailsChanges) {
      for (const field of moduleDetailsDraft.dirtyFields) {
        const draftValue = moduleDetailsDraft.draft[field as keyof typeof moduleDetailsDraft.draft];
        if (field === 'accessGroupIds') {
          payload.accessGroupIds = normalizeAccessGroupIds(draftValue);
        } else if (field === 'autoDiscoveryConfig') {
          payload.autoDiscoveryConfig = draftValue;
        } else if (field === 'dataPoints' && Array.isArray(draftValue)) {
          // Sort datapoints by name for consistent diff display
          payload.dataPoints = sortDatapoints(draftValue as Array<{ name?: string }>);
        } else if (field === 'configChecks' && Array.isArray(draftValue)) {
          // Sort config checks by name for consistent diff display
          payload.configChecks = sortConfigChecks(draftValue as Array<{ name?: string }>);
        } else {
          payload[field] = draftValue;
        }
      }
    }
    if (hasAdConfigPayload) {
      const baseConfig =
        (moduleDetailsDraft?.draft?.autoDiscoveryConfig as Record<string, unknown> | undefined) ||
        (payload.autoDiscoveryConfig as Record<string, unknown> | undefined) ||
        {};
      const method = (baseConfig.method || {}) as Record<string, unknown>;
      payload.autoDiscoveryConfig = {
        ...baseConfig,
        method: {
          ...method,
          groovyScript: newScript,
        },
      };
    }
    return payload;
  }, [moduleDetailsDraft, hasModuleDetailsChanges, hasAdConfigPayload, newScript]);

  const moduleDetailsOriginalPayload = useMemo(() => {
    if (!moduleDetailsDraft || (!hasModuleDetailsChanges && !hasAdConfigPayload)) return null;
    const payload: Record<string, unknown> = {};
    if (hasModuleDetailsChanges) {
      for (const field of moduleDetailsDraft.dirtyFields) {
        const originalValue = moduleDetailsDraft.original?.[field as keyof typeof moduleDetailsDraft.original];
        if (field === 'accessGroupIds') {
          payload.accessGroupIds = normalizeAccessGroupIds(originalValue);
        } else if (field === 'autoDiscoveryConfig') {
          payload.autoDiscoveryConfig = originalValue || {};
        } else if (field === 'dataPoints' && Array.isArray(originalValue)) {
          // Sort datapoints by name for consistent diff display
          payload.dataPoints = sortDatapoints(originalValue as Array<{ name?: string }>);
        } else if (field === 'configChecks' && Array.isArray(originalValue)) {
          // Sort config checks by name for consistent diff display
          payload.configChecks = sortConfigChecks(originalValue as Array<{ name?: string }>);
        } else {
          payload[field] = originalValue;
        }
      }
    }
    if (hasAdConfigPayload) {
      const baseConfig =
        (moduleDetailsDraft?.original?.autoDiscoveryConfig as Record<string, unknown> | undefined) ||
        (payload.autoDiscoveryConfig as Record<string, unknown> | undefined) ||
        {};
      const method = (baseConfig.method || {}) as Record<string, unknown>;
      payload.autoDiscoveryConfig = {
        ...baseConfig,
        method: {
          ...method,
          groovyScript: originalScript,
        },
      };
    }
    return payload;
  }, [moduleDetailsDraft, hasModuleDetailsChanges, hasAdConfigPayload, originalScript]);

  const moduleDetailsPayloadJson = useMemo(() => {
    if (!moduleDetailsPayload) return '{}';
    return JSON.stringify(moduleDetailsPayload, null, 2);
  }, [moduleDetailsPayload]);

  const moduleDetailsOriginalPayloadJson = useMemo(() => {
    if (!moduleDetailsOriginalPayload) return '{}';
    return JSON.stringify(moduleDetailsOriginalPayload, null, 2);
  }, [moduleDetailsOriginalPayload]);

  const renderFilterLines = (lines?: string[]) => {
    if (!lines || lines.length === 0) {
      return <span className="text-xs text-muted-foreground">(none)</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {lines.map((line, index) => (
          <Badge key={`${line}-${index}`} variant="secondary" className="
            font-mono text-[11px]
          ">
            {line}
          </Badge>
        ))}
      </div>
    );
  };

  const renderDatapointItems = (items?: DatapointDisplayItem[]) => {
    if (!items || items.length === 0) {
      return <span className="text-xs text-muted-foreground">(none)</span>;
    }
    
    const statusStyles: Record<DatapointChangeStatus, string> = {
      added: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
      removed: 'bg-red-500/15 text-red-600 border-red-500/30 line-through',
      modified: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
      unchanged: '',
    };
    
    const statusIndicators: Record<DatapointChangeStatus, string> = {
      added: '+',
      removed: '−',
      modified: '~',
      unchanged: '',
    };

    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge 
            key={item.name} 
            variant={item.status === 'unchanged' ? 'secondary' : 'outline'} 
            className={`
              font-mono text-[11px]
              ${statusStyles[item.status]}
            `}
          >
            {statusIndicators[item.status] && (
              <span className="mr-0.5 font-bold">{statusIndicators[item.status]}</span>
            )}
            {item.name}
          </Badge>
        ))}
      </div>
    );
  };

  const renderConfigCheckItems = (items?: ConfigCheckDisplayItem[]) => {
    if (!items || items.length === 0) {
      return <span className="text-xs text-muted-foreground">(none)</span>;
    }
    
    const statusStyles: Record<ConfigCheckChangeStatus, string> = {
      added: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
      removed: 'bg-red-500/15 text-red-600 border-red-500/30 line-through',
      modified: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
      unchanged: '',
    };
    
    const statusIndicators: Record<ConfigCheckChangeStatus, string> = {
      added: '+',
      removed: '−',
      modified: '~',
      unchanged: '',
    };

    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge 
            key={item.name} 
            variant={item.status === 'unchanged' ? 'secondary' : 'outline'} 
            className={`
              font-mono text-[11px]
              ${statusStyles[item.status]}
            `}
          >
            {statusIndicators[item.status] && (
              <span className="mr-0.5 font-bold">{statusIndicators[item.status]}</span>
            )}
            {item.name}
          </Badge>
        ))}
      </div>
    );
  };

  const renderLogSourceFilterItems = (items?: LogSourceFilterDisplayItem[]) => {
    if (!items || items.length === 0) {
      return <span className="text-xs text-muted-foreground">(none)</span>;
    }
    
    const statusStyles: Record<LogSourceItemChangeStatus, string> = {
      added: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
      removed: 'bg-red-500/15 text-red-600 border-red-500/30 line-through',
      modified: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
      unchanged: '',
    };
    
    const statusIndicators: Record<LogSourceItemChangeStatus, string> = {
      added: '+',
      removed: '−',
      modified: '~',
      unchanged: '',
    };

    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item, idx) => (
          <Badge 
            key={`${item.operator}-${item.value}-${idx}`}
            variant={item.status === 'unchanged' ? 'secondary' : 'outline'} 
            className={`
              font-mono text-[11px]
              ${statusStyles[item.status]}
            `}
          >
            {statusIndicators[item.status] && (
              <span className="mr-0.5 font-bold">{statusIndicators[item.status]}</span>
            )}
            {item.operator}: {item.value.length > 30 ? item.value.slice(0, 30) + '...' : item.value}
          </Badge>
        ))}
      </div>
    );
  };

  const renderLogSourceLogFieldItems = (items?: LogSourceLogFieldDisplayItem[]) => {
    if (!items || items.length === 0) {
      return <span className="text-xs text-muted-foreground">(none)</span>;
    }
    
    const statusStyles: Record<LogSourceItemChangeStatus, string> = {
      added: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
      removed: 'bg-red-500/15 text-red-600 border-red-500/30 line-through',
      modified: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
      unchanged: '',
    };
    
    const statusIndicators: Record<LogSourceItemChangeStatus, string> = {
      added: '+',
      removed: '−',
      modified: '~',
      unchanged: '',
    };

    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge 
            key={item.key}
            variant={item.status === 'unchanged' ? 'secondary' : 'outline'} 
            className={`
              font-mono text-[11px]
              ${statusStyles[item.status]}
            `}
          >
            {statusIndicators[item.status] && (
              <span className="mr-0.5 font-bold">{statusIndicators[item.status]}</span>
            )}
            {item.key} ({item.method})
          </Badge>
        ))}
      </div>
    );
  };

  const renderLogSourceResourceMappingItems = (items?: LogSourceResourceMappingDisplayItem[]) => {
    if (!items || items.length === 0) {
      return <span className="text-xs text-muted-foreground">(none)</span>;
    }
    
    const statusStyles: Record<LogSourceItemChangeStatus, string> = {
      added: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
      removed: 'bg-red-500/15 text-red-600 border-red-500/30 line-through',
      modified: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
      unchanged: '',
    };
    
    const statusIndicators: Record<LogSourceItemChangeStatus, string> = {
      added: '+',
      removed: '−',
      modified: '~',
      unchanged: '',
    };

    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge 
            key={item.key}
            variant={item.status === 'unchanged' ? 'secondary' : 'outline'} 
            className={`
              font-mono text-[11px]
              ${statusStyles[item.status]}
            `}
          >
            {statusIndicators[item.status] && (
              <span className="mr-0.5 font-bold">{statusIndicators[item.status]}</span>
            )}
            {item.key} ({item.method})
          </Badge>
        ))}
      </div>
    );
  };

  const sectionIcons: Record<string, LucideIcon> = {
    Basic: Info,
    Organization: FolderTree,
    Access: Shield,
    'Applies To': Filter,
    'Active Discovery': Target,
    Datapoints: Database,
    'Config Checks': Settings,
    'Alert Settings': Bell,
    'Include Filters': Filter,
    'Log Fields': Tags,
    'Resource Mappings': Link2,
  };

  // Map theme preference to Monaco theme
  const monacoTheme = useMemo(() => {
    if (preferences.theme === 'light') return 'vs';
    if (preferences.theme === 'dark') return 'vs-dark';
    // System: check prefers-color-scheme
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'vs';
    }
    return 'vs-dark';
  }, [preferences.theme]);

  // Reset error when dialog opens
  useEffect(() => {
    if (open) {
      setCommitError(null);
      setCommitReason('');
    }
  }, [open]);

  useEffect(() => {
    if (commitError) {
      portalToasts.pushFailed(commitError);
    }
  }, [commitError]);

  const handleConfirm = async () => {
    try {
      setCommitError(null);
      const trimmedReason = commitReason.trim();
      await onConfirm(trimmedReason.length > 0 ? trimmedReason : undefined);
    } catch (error) {
      setCommitError(error instanceof Error ? error.message : 'Failed to push changes');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const hasDetailsSection = hasModuleDetailsChanges || hasAdConfigPayload;
  const hasChanges = hasScriptChanges || hasModuleDetailsChanges || hasSelectedScripts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="
        flex max-h-[90vh] max-w-[95vw]! flex-col gap-0 p-0
        sm:max-w-[1500px]!
      ">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Push Changes to Portal
          </DialogTitle>
          <DialogDescription>
            {hasScriptChanges && hasModuleDetailsChanges
              ? `This will push the ${scriptTypeLabel.toLowerCase()} and module metadata to LogicMonitor for module "${moduleName}".`
              : hasScriptChanges
              ? `This will push the ${scriptTypeLabel.toLowerCase()} to LogicMonitor for module "${moduleName}".`
              : hasModuleDetailsChanges
              ? `This will push module metadata to LogicMonitor for module "${moduleName}".`
              : `This will push the changes to LogicMonitor for module "${moduleName}".`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
          {/* Module info */}
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm font-medium select-none">Module:</Label>
            <Badge variant="outline">{moduleName}</Badge>
            <Badge variant="secondary">{MODULE_TYPE_LABELS[moduleType]}</Badge>
            <Badge variant="default">{scriptTypeLabel}</Badge>
          </div>

          {/* Conflict warning */}
          {hasConflict && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                <div className="mb-1 font-medium">Conflict Detected</div>
                {conflictMessage || 'The module has been changed externally. Review the changes below before pushing.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium select-none">Change Reason (optional)</Label>
            <Textarea
              value={commitReason}
              onChange={(event) => setCommitReason(event.target.value.slice(0, 4096))}
              placeholder="Add a reason for this change (visible in LogicMonitor history)"
              rows={1}
              className="min-h-9 resize-y"
            />
            <div className="text-xs text-muted-foreground select-none">
              {commitReason.length} / 4096
            </div>
          </div>

          {/* Directory Scripts Selection - shown when pushing from a saved module directory */}
          {hasDirectoryScripts && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderSearch className="size-4 text-muted-foreground" />
                <Label className="text-sm font-medium select-none">Scripts to Push</Label>
                <Badge variant="secondary" className="text-xs select-none">
                  {scriptsWithChanges.length} changed
                </Badge>
              </div>
              <div className="
                divide-y divide-border rounded-md border border-border
              ">
                {directoryScriptsForCommit!.map((script) => (
                  <label
                    key={script.scriptType}
                    className="
                      flex cursor-pointer items-center gap-3 p-3
                      transition-colors
                      hover:bg-muted/40
                    "
                  >
                    <Checkbox
                      checked={selectedScriptsForCommit.has(script.scriptType)}
                      onCheckedChange={() => toggleScriptForCommit(script.scriptType)}
                      disabled={!script.hasChanges}
                      aria-label={`Include ${script.scriptType === 'ad' ? 'Active Discovery' : 'Collection'} script`}
                    />
                    <div className="flex flex-1 items-center gap-2">
                      <FileCode className="size-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium select-none">
                          {script.scriptType === 'ad' ? 'Active Discovery Script' : 'Collection Script'}
                        </span>
                        <span className="
                          text-xs text-muted-foreground select-none
                        ">
                          {script.fileName}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={script.language === 'powershell' ? 'default' : 'secondary'} className="
                        text-xs
                      ">
                        {script.language === 'powershell' ? 'PowerShell' : 'Groovy'}
                      </Badge>
                      {script.hasChanges ? (
                        <Badge variant="outline" className="
                          border-amber-600/50 text-xs text-yellow-600
                        ">
                          Modified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="
                          text-xs text-muted-foreground
                        ">
                          No changes
                        </Badge>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {!hasSelectedScripts && scriptsWithChanges.length > 0 && (
                <p className="text-xs text-muted-foreground select-none">
                  Select at least one script to push, or push module details only.
                </p>
              )}
            </div>
          )}

          {/* Script comparison - Directory mode shows selected scripts, single mode shows active tab */}
          {(hasScriptChanges || hasModuleDetailsChanges || hasDirectoryScripts) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium select-none">Script Preview</Label>
              {hasDirectoryScripts ? (
                // Directory mode - show diffs for selected scripts
                selectedScriptsForCommit.size > 0 ? (
                  <Tabs defaultValue={Array.from(selectedScriptsForCommit)[0]} className="
                    flex flex-col gap-2
                  ">
                    <TabsList variant="line" className="h-7">
                      {directoryScriptsForCommit!
                        .filter(s => selectedScriptsForCommit.has(s.scriptType))
                        .map((script) => (
                          <TabsTrigger key={script.scriptType} value={script.scriptType} className="
                            h-6 px-2 text-xs
                          ">
                            {script.scriptType === 'ad' ? 'Active Discovery' : 'Collection'}
                          </TabsTrigger>
                        ))}
                    </TabsList>
                    {directoryScriptsForCommit!
                      .filter(s => selectedScriptsForCommit.has(s.scriptType))
                      .map((script) => (
                        <TabsContent key={script.scriptType} value={script.scriptType}>
                          <div className="
                            overflow-hidden rounded-md border border-border
                          ">
                            <div className="
                              grid grid-cols-2 border-b border-border
                              bg-muted/30
                            ">
                              <div className="
                                border-r border-border px-4 py-2 text-xs
                                font-medium text-muted-foreground select-none
                              ">
                                Portal (Current)
                              </div>
                              <div className="
                                px-4 py-2 text-xs font-medium
                                text-muted-foreground select-none
                              ">
                                Local (Disk)
                              </div>
                            </div>
                            <DiffEditor
                              original={script.portalContent}
                              modified={script.diskContent}
                              language={script.language}
                              height="350px"
                              theme={monacoTheme}
                              readOnly={true}
                            />
                          </div>
                        </TabsContent>
                      ))}
                  </Tabs>
                ) : (
                  <div className="
                    flex items-center gap-2 rounded-md border border-dashed
                    border-border bg-muted/20 p-3 text-xs text-muted-foreground
                    select-none
                  ">
                    <Info className="size-4" />
                    No scripts selected. Select scripts above or push module details only.
                  </div>
                )
              ) : hasScriptChanges ? (
                // Single script mode - show active tab diff
                originalScript !== undefined && newScript !== undefined ? (
                  <div className="
                    overflow-hidden rounded-md border border-border
                  ">
                    <div className="
                      grid grid-cols-2 border-b border-border bg-muted/30
                    ">
                      <div className="
                        border-r border-border px-4 py-2 text-xs font-medium
                        text-muted-foreground select-none
                      ">
                        Original
                      </div>
                      <div className="
                        px-4 py-2 text-xs font-medium text-muted-foreground
                        select-none
                      ">
                        Modified
                      </div>
                    </div>
                    <DiffEditor
                      original={originalScript}
                      modified={newScript}
                      language={scriptLanguage}
                      height="400px"
                      theme={monacoTheme}
                      readOnly={true}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground select-none">Loading diff...</p>
                )
              ) : (
                <div className="
                  flex items-center gap-2 rounded-md border border-dashed
                  border-border bg-muted/20 p-3 text-xs text-muted-foreground
                  select-none
                ">
                  <Info className="size-4" />
                  No script changes will be pushed for this update.
                </div>
              )}
            </div>
          )}

          {/* Module Details Changes */}
          {hasDetailsSection && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium select-none">
                  Module Details Changes ({readableModuleDetailsChanges.length} item{readableModuleDetailsChanges.length !== 1 ? 's' : ''})
                </Label>
              </div>
              <Tabs defaultValue="readable" className="flex flex-col gap-3">
                <TabsList variant="line" className="h-7">
                  <TabsTrigger value="readable" className="h-6 px-2 text-xs">
                    Human Readable
                  </TabsTrigger>
                  <TabsTrigger value="payload" className="h-6 px-2 text-xs">
                    Payload Diff
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="readable">
                  <div className="
                    space-y-4 rounded-md border border-border bg-muted/20 p-4
                  ">
                    {readableModuleDetailsChanges.length === 0 && hasAdConfigPayload && (
                      <div className="text-xs text-muted-foreground select-none">
                        Active Discovery config is included to support the script update.
                      </div>
                    )}
                    {groupedReadableChanges.map((group, index) => {
                      const Icon = sectionIcons[group.section] || Info;
                      return (
                        <div
                          key={group.section}
                          className={index === 0 ? 'space-y-3' : `
                            space-y-3 border-t border-border/60 pt-4
                          `}
                        >
                          <div className="
                            flex items-center justify-between border-b
                            border-border/60 pb-2
                          ">
                            <div className="
                              flex items-center gap-2 text-sm font-semibold
                              select-none
                            ">
                              <Icon className="size-4 text-muted-foreground" />
                              {group.section}
                            </div>
                            <div className="
                              text-xs text-muted-foreground select-none
                            ">
                              {group.items.length} change{group.items.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="space-y-3 pt-3">
                            {group.items.map((change) => (
                              change.datapointItems ? (
                                // Special rendering for datapoints - unified view with change indicators
                                <div key={change.key} className="space-y-2">
                                  <div className="
                                    flex items-center justify-between
                                  ">
                                    <div className="
                                      text-sm font-medium select-none
                                    ">{change.label}</div>
                                    <div className="
                                      flex items-center gap-3 text-[11px]
                                      select-none
                                    ">
                                      <span className="
                                        flex items-center gap-1 text-teal-600
                                      ">
                                        <span className="font-bold">+</span> Added
                                      </span>
                                      <span className="
                                        flex items-center gap-1 text-yellow-600
                                      ">
                                        <span className="font-bold">~</span> Modified
                                      </span>
                                      <span className="
                                        flex items-center gap-1 text-red-600
                                      ">
                                        <span className="font-bold">−</span> Removed
                                      </span>
                                    </div>
                                  </div>
                                  <div className="
                                    rounded-sm border bg-background p-2
                                    font-mono text-xs
                                  ">
                                    {renderDatapointItems(change.datapointItems)}
                                  </div>
                                </div>
                              ) : change.configCheckItems ? (
                                // Special rendering for config checks - unified view with change indicators
                                <div key={change.key} className="space-y-2">
                                  <div className="
                                    flex items-center justify-between
                                  ">
                                    <div className="
                                      text-sm font-medium select-none
                                    ">{change.label}</div>
                                    <div className="
                                      flex items-center gap-3 text-[11px]
                                      select-none
                                    ">
                                      <span className="
                                        flex items-center gap-1 text-teal-600
                                      ">
                                        <span className="font-bold">+</span> Added
                                      </span>
                                      <span className="
                                        flex items-center gap-1 text-yellow-600
                                      ">
                                        <span className="font-bold">~</span> Modified
                                      </span>
                                      <span className="
                                        flex items-center gap-1 text-red-600
                                      ">
                                        <span className="font-bold">−</span> Removed
                                      </span>
                                    </div>
                                  </div>
                                  <div className="
                                    rounded-sm border bg-background p-2
                                    font-mono text-xs
                                  ">
                                    {renderConfigCheckItems(change.configCheckItems)}
                                  </div>
                                </div>
                              ) : change.logSourceFilterItems ? (
                                // Special rendering for LogSource filters
                                <div key={change.key} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium select-none">{change.label}</div>
                                    <div className="flex items-center gap-3 text-[11px] select-none">
                                      <span className="flex items-center gap-1 text-teal-600">
                                        <span className="font-bold">+</span> Added
                                      </span>
                                      <span className="flex items-center gap-1 text-yellow-600">
                                        <span className="font-bold">~</span> Modified
                                      </span>
                                      <span className="flex items-center gap-1 text-red-600">
                                        <span className="font-bold">−</span> Removed
                                      </span>
                                    </div>
                                  </div>
                                  <div className="rounded-sm border bg-background p-2 font-mono text-xs">
                                    {renderLogSourceFilterItems(change.logSourceFilterItems)}
                                  </div>
                                </div>
                              ) : change.logSourceLogFieldItems ? (
                                // Special rendering for LogSource log fields
                                <div key={change.key} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium select-none">{change.label}</div>
                                    <div className="flex items-center gap-3 text-[11px] select-none">
                                      <span className="flex items-center gap-1 text-teal-600">
                                        <span className="font-bold">+</span> Added
                                      </span>
                                      <span className="flex items-center gap-1 text-yellow-600">
                                        <span className="font-bold">~</span> Modified
                                      </span>
                                      <span className="flex items-center gap-1 text-red-600">
                                        <span className="font-bold">−</span> Removed
                                      </span>
                                    </div>
                                  </div>
                                  <div className="rounded-sm border bg-background p-2 font-mono text-xs">
                                    {renderLogSourceLogFieldItems(change.logSourceLogFieldItems)}
                                  </div>
                                </div>
                              ) : change.logSourceResourceMappingItems ? (
                                // Special rendering for LogSource resource mappings
                                <div key={change.key} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium select-none">{change.label}</div>
                                    <div className="flex items-center gap-3 text-[11px] select-none">
                                      <span className="flex items-center gap-1 text-teal-600">
                                        <span className="font-bold">+</span> Added
                                      </span>
                                      <span className="flex items-center gap-1 text-yellow-600">
                                        <span className="font-bold">~</span> Modified
                                      </span>
                                      <span className="flex items-center gap-1 text-red-600">
                                        <span className="font-bold">−</span> Removed
                                      </span>
                                    </div>
                                  </div>
                                  <div className="rounded-sm border bg-background p-2 font-mono text-xs">
                                    {renderLogSourceResourceMappingItems(change.logSourceResourceMappingItems)}
                                  </div>
                                </div>
                              ) : (
                                // Standard two-column rendering for other fields
                                <div key={change.key} className="
                                  grid grid-cols-1 gap-3
                                  md:grid-cols-[220px_1fr_1fr]
                                ">
                                  <div className="space-y-1">
                                    <div className="
                                      text-xs text-muted-foreground select-none
                                    ">Field</div>
                                    <div className="
                                      text-sm font-medium select-none
                                    ">{change.label}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="
                                      text-xs text-muted-foreground select-none
                                    ">Original</div>
                                    <div className="
                                      rounded-sm border bg-background p-2
                                      font-mono text-xs
                                    ">
                                      {change.originalLines ? renderFilterLines(change.originalLines) : change.original}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="
                                      text-xs text-muted-foreground select-none
                                    ">Modified</div>
                                    <div className="
                                      rounded-sm border border-cyan-500/50
                                      bg-background p-2 font-mono text-xs
                                    ">
                                      {change.modifiedLines ? renderFilterLines(change.modifiedLines) : change.modified}
                                    </div>
                                  </div>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
                <TabsContent value="payload">
                  <div className="
                    overflow-hidden rounded-md border border-border
                  ">
                    <div className="
                      grid grid-cols-2 border-b border-border bg-muted/30
                    ">
                      <div className="
                        border-r border-border px-4 py-2 text-xs font-medium
                        text-muted-foreground select-none
                      ">
                        Original Payload (changed fields)
                      </div>
                      <div className="
                        px-4 py-2 text-xs font-medium text-muted-foreground
                        select-none
                      ">
                        Updated Payload (changed fields)
                      </div>
                    </div>
                    <DiffEditor
                      original={moduleDetailsOriginalPayloadJson}
                      modified={moduleDetailsPayloadJson}
                      language="json"
                      height="260px"
                      theme={monacoTheme}
                      readOnly={true}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Warning message */}
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>
              This will update the module in LogicMonitor. Make sure you've tested your changes.
            </AlertDescription>
          </Alert>

          {commitError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                <pre className="font-mono text-xs/relaxed whitespace-pre-wrap">
                  {commitError}
                </pre>
              </AlertDescription>
            </Alert>
          )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 pt-4 pb-6">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isCommitting}>
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="commit"
            onClick={handleConfirm} 
            disabled={isCommitting || !hasChanges}
          >
            {isCommitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Pushing...
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" />
                Push to Portal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
