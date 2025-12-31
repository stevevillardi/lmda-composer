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
  METHOD: {
    GET: {
      bgSubtle: 'bg-blue-500/15',
      text: 'text-blue-400',
    },
    POST: {
      bgSubtle: 'bg-emerald-500/15',
      text: 'text-emerald-400',
    },
    PUT: {
      bgSubtle: 'bg-amber-500/15',
      text: 'text-amber-400',
    },
    PATCH: {
      bgSubtle: 'bg-cyan-500/15',
      text: 'text-cyan-400',
    },
    DELETE: {
      bgSubtle: 'bg-rose-500/15',
      text: 'text-rose-400',
    },
  },
  HTTP_STATUS: {
    info: {
      bgSubtle: 'bg-sky-500/15',
      text: 'text-sky-400',
    },
    success: {
      bgSubtle: 'bg-emerald-500/15',
      text: 'text-emerald-400',
    },
    redirect: {
      bgSubtle: 'bg-indigo-500/15',
      text: 'text-indigo-400',
    },
    clientError: {
      bgSubtle: 'bg-amber-500/15',
      text: 'text-amber-400',
    },
    serverError: {
      bgSubtle: 'bg-rose-500/15',
      text: 'text-rose-400',
    },
  },
} as const;
