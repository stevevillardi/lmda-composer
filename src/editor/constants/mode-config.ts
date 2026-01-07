/**
 * Centralized configuration for script execution modes.
 * 
 * This provides a single source of truth for mode metadata including
 * labels, colors, and icons used across the application.
 */
import { type LucideIcon, Terminal, Target, Activity, Layers } from 'lucide-react';
import type { ScriptMode } from '@/shared/types';

interface ModeConfig {
  /** Display label for the mode */
  label: string;
  /** Short label for badges (e.g., in tabs) */
  shortLabel?: string;
  /** Icon component for the mode */
  icon: LucideIcon;
  /** Tailwind background color class for badges */
  bgColor: string;
  /** Tailwind text color class for badges */
  textColor: string;
}

/**
 * Configuration for all script execution modes.
 * Use this for consistent mode display across the application.
 */
export const MODE_CONFIG: Record<ScriptMode, ModeConfig> = {
  freeform: {
    label: 'Freeform',
    icon: Terminal,
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
  },
  ad: {
    label: 'Active Discovery',
    shortLabel: 'AD',
    icon: Target,
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
  collection: {
    label: 'Collection',
    icon: Activity,
    bgColor: 'bg-green-500/20',
    textColor: 'text-green-400',
  },
  batchcollection: {
    label: 'Batch Collection',
    shortLabel: 'Batch',
    icon: Layers,
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
} as const;

/**
 * Array of mode items for use in dropdowns and selectors.
 * Pre-computed for performance.
 */
export const MODE_ITEMS = Object.entries(MODE_CONFIG).map(([value, config]) => ({
  value: value as ScriptMode,
  label: config.label,
  icon: config.icon,
}));

/**
 * Get mode configuration for a given mode value.
 * Falls back to 'freeform' for unknown modes.
 */
export function getModeConfig(mode: string | undefined): ModeConfig {
  if (mode && mode in MODE_CONFIG) {
    return MODE_CONFIG[mode as ScriptMode];
  }
  return MODE_CONFIG.freeform;
}

