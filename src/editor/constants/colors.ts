// Standardized color constants for consistent UI (Palette 3)
export const COLORS = {
  // Status colors
  SUCCESS: {
    bg: 'bg-teal-600',
    hover: 'hover:bg-teal-500',
    text: 'text-teal-500',
    bgSubtle: 'bg-teal-500/10',
    textSubtle: 'text-teal-500',
  },
  ERROR: {
    bg: 'bg-destructive',
    hover: 'hover:bg-destructive/90',
    text: 'text-destructive',
    bgSubtle: 'bg-destructive/10',
    textSubtle: 'text-destructive',
  },
  WARNING: {
    bg: 'bg-yellow-600',
    hover: 'hover:bg-yellow-500',
    text: 'text-yellow-500',
    bgSubtle: 'bg-yellow-500/10',
    textSubtle: 'text-yellow-500',
  },
  WARNING_STRONG: {
    text: 'text-yellow-400',
  },
  ERROR_STRONG: {
    text: 'text-yellow-700',
  },
  CRITICAL_STRONG: {
    text: 'text-red-500',
  },
  INFO: {
    bg: 'bg-cyan-600',
    hover: 'hover:bg-cyan-500',
    text: 'text-cyan-500',
    bgSubtle: 'bg-cyan-500/10',
    textSubtle: 'text-cyan-500',
  },
  METHOD: {
    GET: {
      bgSubtle: 'bg-cyan-500/15',
      text: 'text-cyan-400',
    },
    POST: {
      bgSubtle: 'bg-teal-500/15',
      text: 'text-teal-400',
    },
    PUT: {
      bgSubtle: 'bg-yellow-500/15',
      text: 'text-yellow-400',
    },
    PATCH: {
      bgSubtle: 'bg-purple-500/15',
      text: 'text-purple-400',
    },
    DELETE: {
      bgSubtle: 'bg-red-500/15',
      text: 'text-red-400',
    },
  },
  HTTP_STATUS: {
    info: {
      bgSubtle: 'bg-cyan-500/15',
      text: 'text-cyan-400',
    },
    success: {
      bgSubtle: 'bg-teal-500/15',
      text: 'text-teal-400',
    },
    redirect: {
      bgSubtle: 'bg-purple-500/15',
      text: 'text-purple-400',
    },
    clientError: {
      bgSubtle: 'bg-yellow-500/15',
      text: 'text-yellow-400',
    },
    serverError: {
      bgSubtle: 'bg-red-500/15',
      text: 'text-red-400',
    },
  },
} as const;
