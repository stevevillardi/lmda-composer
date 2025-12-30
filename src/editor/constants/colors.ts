// Standardized color constants for consistent UI
export const COLORS = {
  // Status colors
  SUCCESS: {
    bg: 'bg-green-600',
    hover: 'hover:bg-green-500',
    text: 'text-green-500',
    bgSubtle: 'bg-green-500/10',
    textSubtle: 'text-green-500',
  },
  ERROR: {
    bg: 'bg-destructive',
    hover: 'hover:bg-destructive/90',
    text: 'text-destructive',
    bgSubtle: 'bg-destructive/10',
    textSubtle: 'text-destructive',
  },
  WARNING: {
    bg: 'bg-amber-600',
    hover: 'hover:bg-amber-500',
    text: 'text-amber-500',
    bgSubtle: 'bg-amber-500/10',
    textSubtle: 'text-amber-500',
  },
  WARNING_STRONG: {
    text: 'text-yellow-500',
  },
  ERROR_STRONG: {
    text: 'text-orange-500',
  },
  CRITICAL_STRONG: {
    text: 'text-red-500',
  },
  INFO: {
    bg: 'bg-blue-600',
    hover: 'hover:bg-blue-500',
    text: 'text-blue-500',
    bgSubtle: 'bg-blue-500/10',
    textSubtle: 'text-blue-500',
  },
} as const;

