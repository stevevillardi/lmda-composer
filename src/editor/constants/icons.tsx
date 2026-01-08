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
  // Action icons
  Play,
  Send,
  Save,
  Download,
  FilePlus,
  FileInput,
  Settings,
  RefreshCw,
  X,
  Plus,
  ChevronDown,
  Loader2,
  CloudDownload,
  FolderSearch,
  Hammer,
  Wrench,
  Puzzle,
  BookOpen,
  ExternalLink,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  History,
  StopCircle,
  ArrowLeftRight,
  Braces,
  Copy,
  // Datapoint icons
  Gauge,
  Timer,
  TrendingUp,
  Calculator,
  FileOutput,
  // Alert severity icons
  CircleAlert,
  TriangleAlert,
  OctagonAlert,
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

/** Run/execute script action */
export function RunIcon({ className, ...props }: LucideProps) {
  return <Play className={cn(className)} {...props} />;
}

/** Send API request action */
export function SendIcon({ className, ...props }: LucideProps) {
  return <Send className={cn(className)} {...props} />;
}

/** Save file action */
export function SaveIcon({ className, ...props }: LucideProps) {
  return <Save className={cn(className)} {...props} />;
}

/** Download/export file action */
export function DownloadIcon({ className, ...props }: LucideProps) {
  return <Download className={cn(className)} {...props} />;
}

/** Create new file action */
export function NewFileIcon({ className, ...props }: LucideProps) {
  return <FilePlus className={cn(className)} {...props} />;
}

/** Open file action */
export function OpenFileIcon({ className, ...props }: LucideProps) {
  return <FileInput className={cn(className)} {...props} />;
}

/** Settings/preferences action */
export function SettingsIcon({ className, ...props }: LucideProps) {
  return <Settings className={cn(className)} {...props} />;
}

/** Refresh/reload action */
export function RefreshIcon({ className, ...props }: LucideProps) {
  return <RefreshCw className={cn(className)} {...props} />;
}

/** Close/dismiss action */
export function CloseIcon({ className, ...props }: LucideProps) {
  return <X className={cn(className)} {...props} />;
}

/** Add/create action */
export function AddIcon({ className, ...props }: LucideProps) {
  return <Plus className={cn(className)} {...props} />;
}

/** Loading/spinner indicator */
export function LoadingIcon({ className, ...props }: LucideProps) {
  return <Loader2 className={cn('animate-spin', className)} {...props} />;
}

/** Import from cloud/LMX action */
export function ImportIcon({ className, ...props }: LucideProps) {
  return <CloudDownload className={cn(className)} {...props} />;
}

/** Search modules action */
export function SearchModulesIcon({ className, ...props }: LucideProps) {
  return <FolderSearch className={cn(className)} {...props} />;
}

/** AppliesTo toolbox action */
export function ToolboxIcon({ className, ...props }: LucideProps) {
  return <Hammer className={cn(className)} {...props} />;
}

/** Debug commands action */
export function DebugCommandsIcon({ className, ...props }: LucideProps) {
  return <Wrench className={cn(className)} {...props} />;
}

/** Snippets/code templates action */
export function SnippetsIcon({ className, ...props }: LucideProps) {
  return <Puzzle className={cn(className)} {...props} />;
}

/** Documentation/help action */
export function DocsIcon({ className, ...props }: LucideProps) {
  return <BookOpen className={cn(className)} {...props} />;
}

/** External link indicator */
export function ExternalLinkIcon({ className, ...props }: LucideProps) {
  return <ExternalLink className={cn('text-muted-foreground', className)} {...props} />;
}

/** Toggle sidebar action */
export function SidebarIcon({ className, ...props }: LucideProps) {
  return <PanelRight className={cn(className)} {...props} />;
}

/** Close sidebar action */
export function SidebarCloseIcon({ className, ...props }: LucideProps) {
  return <PanelRightClose className={cn(className)} {...props} />;
}

/** Open sidebar action */
export function SidebarOpenIcon({ className, ...props }: LucideProps) {
  return <PanelRightOpen className={cn(className)} {...props} />;
}

/** View history/lineage action */
export function HistoryIcon({ className, ...props }: LucideProps) {
  return <History className={cn(className)} {...props} />;
}

/** Stop/cancel execution action */
export function StopIcon({ className, ...props }: LucideProps) {
  return <StopCircle className={cn(className)} {...props} />;
}

/** Switch/toggle view action */
export function SwitchViewIcon({ className, ...props }: LucideProps) {
  return <ArrowLeftRight className={cn(className)} {...props} />;
}

/** API/JSON action */
export function ApiIcon({ className, ...props }: LucideProps) {
  return <Braces className={cn(className)} {...props} />;
}

/** Copy to clipboard action */
export function CopyIcon({ className, ...props }: LucideProps) {
  return <Copy className={cn(className)} {...props} />;
}

/** Expand/collapse chevron */
export function ChevronDownIcon({ className, ...props }: LucideProps) {
  return <ChevronDown className={cn(className)} {...props} />;
}

// ============================================================================
// Datapoint Icons
// ============================================================================

/** Gauge metric type - instantaneous value */
export function GaugeIcon({ className, ...props }: LucideProps) {
  return <Gauge className={cn('text-muted-foreground', className)} {...props} />;
}

/** Counter metric type - cumulative/incrementing value */
export function CounterIcon({ className, ...props }: LucideProps) {
  return <Timer className={cn('text-muted-foreground', className)} {...props} />;
}

/** Derive metric type - rate of change */
export function DeriveIcon({ className, ...props }: LucideProps) {
  return <TrendingUp className={cn('text-muted-foreground', className)} {...props} />;
}

/** Expression/complex datapoint - calculated from other datapoints */
export function ExpressionIcon({ className, ...props }: LucideProps) {
  return <Calculator className={cn('text-amber-500', className)} {...props} />;
}

/** Script output source */
export function OutputIcon({ className, ...props }: LucideProps) {
  return <FileOutput className={cn('text-cyan-500', className)} {...props} />;
}

// ============================================================================
// Alert Severity Icons
// ============================================================================

/** Warning severity alert - yellow */
export function WarningAlertIcon({ className, ...props }: LucideProps) {
  return <CircleAlert className={cn('text-yellow-500', className)} {...props} />;
}

/** Error severity alert - orange */
export function ErrorAlertIcon({ className, ...props }: LucideProps) {
  return <TriangleAlert className={cn('text-orange-500', className)} {...props} />;
}

/** Critical severity alert - red */
export function CriticalAlertIcon({ className, ...props }: LucideProps) {
  return <OctagonAlert className={cn('text-red-500', className)} {...props} />;
}
