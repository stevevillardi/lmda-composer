/**
 * Alert threshold parsing utilities.
 * Used for parsing and displaying datapoint alert thresholds.
 */

/**
 * Alert severity level.
 */
export type AlertLevel = 'warning' | 'error' | 'critical';

/**
 * Parsed alert threshold with level, operator, and value.
 */
export interface AlertThreshold {
  level: AlertLevel;
  operator: string;
  value: number;
}

/**
 * Human-readable labels for alert levels.
 */
export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  warning: 'Warning',
  error: 'Error',
  critical: 'Critical',
};

/**
 * Short labels for compact display (e.g., in badges).
 */
export const ALERT_LEVEL_SHORT_LABELS: Record<AlertLevel, string> = {
  warning: 'W',
  error: 'E',
  critical: 'C',
};

/**
 * Text color classes for alert levels.
 */
export const ALERT_LEVEL_TEXT_STYLES: Record<AlertLevel, string> = {
  warning: 'text-yellow-500',
  error: 'text-yellow-700',
  critical: 'text-red-500',
};

/**
 * Background color classes for alert level badges.
 */
export const ALERT_LEVEL_BG_STYLES: Record<AlertLevel, string> = {
  warning: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  error: 'bg-yellow-700/15 text-yellow-700 border-yellow-700/30',
  critical: 'bg-red-500/15 text-red-500 border-red-500/30',
};

/**
 * Parse an alert threshold expression into structured thresholds.
 * 
 * Format: "operator value [value [value]]"
 * Examples:
 *   - "> 60 80 90" → warning: 60, error: 80, critical: 90
 *   - ">= 90 95" → warning: 90, error: 95
 *   - "< 10" → warning: 10
 * 
 * Special cases:
 *   - If 2 values are equal, only the higher severity is returned
 *   - If all 3 values are equal, only critical is returned
 * 
 * @param expression The alert expression string
 * @returns Array of thresholds or null if invalid/empty
 */
export function parseAlertThresholds(expression: string | undefined): AlertThreshold[] | null {
  if (!expression?.trim()) return null;
  
  const tokens = expression.trim().split(/\s+/);
  if (tokens.length < 2) return null;

  const operator = tokens[0];
  const values = tokens.slice(1)
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));
  
  if (values.length === 0) return null;

  const thresholds: AlertThreshold[] = [];

  // Single value: warning only
  if (values.length === 1) {
    thresholds.push({ level: 'warning', operator, value: values[0] });
    return thresholds;
  }

  // Two values: warning and error (or just error if equal)
  if (values.length === 2) {
    const [warningValue, errorValue] = values;
    if (warningValue === errorValue) {
      thresholds.push({ level: 'error', operator, value: errorValue });
      return thresholds;
    }
    thresholds.push({ level: 'warning', operator, value: warningValue });
    thresholds.push({ level: 'error', operator, value: errorValue });
    return thresholds;
  }

  // Three values: warning, error, critical (with deduplication)
  const [warningValue, errorValue, criticalValue] = values;
  
  // If error equals critical but warning is different
  if (errorValue === criticalValue && warningValue !== errorValue) {
    thresholds.push({ level: 'warning', operator, value: warningValue });
    thresholds.push({ level: 'critical', operator, value: errorValue });
    return thresholds;
  }
  
  // If all three are equal, just show critical
  if (warningValue === errorValue && errorValue === criticalValue) {
    thresholds.push({ level: 'critical', operator, value: criticalValue });
    return thresholds;
  }
  
  // Standard case: all three different
  thresholds.push({ level: 'warning', operator, value: warningValue });
  thresholds.push({ level: 'error', operator, value: errorValue });
  thresholds.push({ level: 'critical', operator, value: criticalValue });
  return thresholds;
}

/**
 * Format a threshold for display.
 * @param threshold The threshold to format
 * @param compact If true, use short labels (e.g., "W: 60" instead of "Warning > 60")
 */
export function formatThreshold(threshold: AlertThreshold, compact = false): string {
  if (compact) {
    return `${ALERT_LEVEL_SHORT_LABELS[threshold.level]}: ${threshold.value}`;
  }
  return `${ALERT_LEVEL_LABELS[threshold.level]} ${threshold.operator} ${threshold.value}`;
}
