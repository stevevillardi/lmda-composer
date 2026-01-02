/**
 * Centralized semantic icon components
 * 
 * These icons encapsulate both the lucide icon and its semantic color,
 * ensuring consistent usage across the application.
 */
import {
  Target,
  Activity,
  Database,
  Layers,
  Terminal,
  Bell,
  Filter,
  Shield,
  FolderTree,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  FileText,
  Network,
  Tag,
  ScrollText,
  type LucideProps,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Script Mode Icons
// ============================================================================

/** Freeform script mode - general purpose scripting */
export function FreeformIcon({ className, ...props }: LucideProps) {
  return <Terminal className={cn(className)} {...props} />;
}

/** Active Discovery script mode - device/instance discovery */
export function ActiveDiscoveryIcon({ className, ...props }: LucideProps) {
  return <Target className={cn('text-blue-500', className)} {...props} />;
}

/** Collection script mode - metric/data collection */
export function CollectionIcon({ className, ...props }: LucideProps) {
  return <Activity className={cn('text-green-500', className)} {...props} />;
}

/** Batch Collection script mode - bulk data collection */
export function BatchCollectionIcon({ className, ...props }: LucideProps) {
  return <Layers className={cn('text-purple-500', className)} {...props} />;
}

/** ConfigSource mode - configuration collection */
export function ConfigSourceIcon({ className, ...props }: LucideProps) {
  return <FileText className={cn('text-slate-500', className)} {...props} />;
}

/** EventSource mode - event generation */
export function EventSourceIcon({ className, ...props }: LucideProps) {
  return <Bell className={cn('text-orange-500', className)} {...props} />;
}

/** TopologySource mode - network topology */
export function TopologySourceIcon({ className, ...props }: LucideProps) {
  return <Network className={cn('text-cyan-500', className)} {...props} />;
}

/** PropertySource mode - property discovery */
export function PropertySourceIcon({ className, ...props }: LucideProps) {
  return <Tag className={cn('text-pink-500', className)} {...props} />;
}

/** LogSource mode - log collection */
export function LogSourceIcon({ className, ...props }: LucideProps) {
  return <ScrollText className={cn('text-teal-500', className)} {...props} />;
}

// ============================================================================
// Module Section Icons
// ============================================================================

/** Basic module information section */
export function BasicInfoIcon({ className, ...props }: LucideProps) {
  return <Info className={cn(className)} {...props} />;
}

/** Organization/grouping section */
export function OrganizationIcon({ className, ...props }: LucideProps) {
  return <FolderTree className={cn(className)} {...props} />;
}

/** Access control section */
export function AccessIcon({ className, ...props }: LucideProps) {
  return <Shield className={cn(className)} {...props} />;
}

/** AppliesTo expression section */
export function AppliesToIcon({ className, ...props }: LucideProps) {
  return <Filter className={cn(className)} {...props} />;
}

/** Datapoints section */
export function DatapointsIcon({ className, ...props }: LucideProps) {
  return <Database className={cn(className)} {...props} />;
}

/** Config checks section */
export function ConfigChecksIcon({ className, ...props }: LucideProps) {
  return <Database className={cn(className)} {...props} />;
}

/** Alert settings section */
export function AlertSettingsIcon({ className, ...props }: LucideProps) {
  return <Bell className={cn(className)} {...props} />;
}

// ============================================================================
// Status Icons
// ============================================================================

/** Success/complete status */
export function SuccessIcon({ className, ...props }: LucideProps) {
  return <CheckCircle2 className={cn('text-green-500', className)} {...props} />;
}

/** Error/failure status */
export function ErrorIcon({ className, ...props }: LucideProps) {
  return <XCircle className={cn('text-red-500', className)} {...props} />;
}

/** Warning/caution status */
export function WarningIcon({ className, ...props }: LucideProps) {
  return <AlertTriangle className={cn('text-amber-500', className)} {...props} />;
}

// ============================================================================
// Action Icons
// ============================================================================

/** Commit/upload action */
export function CommitIcon({ className, ...props }: LucideProps) {
  return <Upload className={cn(className)} {...props} />;
}

/** Debug/terminal action */
export function DebugIcon({ className, ...props }: LucideProps) {
  return <Terminal className={cn(className)} {...props} />;
}

// ============================================================================
// Raw Icon Exports (for cases where color should not be applied)
// ============================================================================

export {
  Target as TargetIcon,
  Activity as ActivityIcon,
  Database as DatabaseIcon,
  Layers as LayersIcon,
  Terminal as TerminalIcon,
  Bell as BellIcon,
  Filter as FilterIcon,
  Shield as ShieldIcon,
  FolderTree as FolderTreeIcon,
  Info as InfoIcon,
  CheckCircle2 as CheckCircle2Icon,
  XCircle as XCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  Upload as UploadIcon,
  FileText as FileTextIcon,
  Network as NetworkIcon,
  Tag as TagIcon,
  ScrollText as ScrollTextIcon,
};

