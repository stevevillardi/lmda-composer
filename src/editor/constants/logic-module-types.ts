import {
  Database,
  FileText,
  Network,
  Settings2,
  FileCode,
  Stethoscope,
  Bell,
} from 'lucide-react';
import type { LogicModuleType } from '@/shared/types';

export interface ModuleTypeConfig {
  value: LogicModuleType;
  label: string;
  shortLabel: string;
  icon: typeof Database;
}

export const LOGIC_MODULE_TYPES: ModuleTypeConfig[] = [
  { value: 'datasource', label: 'DataSource', shortLabel: 'DS', icon: Database },
  { value: 'configsource', label: 'ConfigSource', shortLabel: 'CS', icon: FileText },
  { value: 'topologysource', label: 'TopologySource', shortLabel: 'TS', icon: Network },
  { value: 'propertysource', label: 'PropertySource', shortLabel: 'PS', icon: Settings2 },
  { value: 'logsource', label: 'LogSource', shortLabel: 'LS', icon: FileCode },
  { value: 'diagnosticsource', label: 'DiagnosticSource', shortLabel: 'Diag', icon: Stethoscope },
  { value: 'eventsource', label: 'EventSource', shortLabel: 'ES', icon: Bell },
];
