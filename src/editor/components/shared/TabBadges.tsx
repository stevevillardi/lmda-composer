/**
 * Reusable badge components for editor tabs and status indicators.
 * 
 * These components provide consistent styling for language, mode, and type badges
 * across the application.
 */
import { cn } from '@/lib/utils';
import { getModeConfig } from '../../constants/mode-config';
import { normalizeMode } from '../../utils/mode-utils';
import type { ScriptMode, ScriptLanguage } from '@/shared/types';

interface BadgeBaseProps {
  className?: string;
}

/**
 * Language badge displaying the script language (Groovy or PowerShell).
 */
export function LanguageBadge({ 
  language, 
  className 
}: BadgeBaseProps & { language: ScriptLanguage }) {
  return (
    <span className={cn(
      "rounded-sm px-1 py-0.5 font-mono text-[10px] font-medium",
      language === 'groovy' 
        ? "bg-cyan-500/20 text-cyan-400" 
        : "bg-cyan-500/20 text-cyan-400",
      className
    )}>
      {language === 'groovy' ? 'GR' : 'PS'}
    </span>
  );
}

/**
 * API badge for API request tabs.
 */
export function ApiBadge({ className }: BadgeBaseProps) {
  return (
    <span className={cn(
      `
        rounded-sm bg-teal-500/20 px-1 py-0.5 text-[10px] font-medium
        text-teal-400
      `,
      className
    )}>
      API
    </span>
  );
}

/**
 * Mode badge displaying the script execution mode.
 * Uses centralized MODE_CONFIG for consistent styling.
 */
export function ModeBadge({ 
  mode, 
  className 
}: BadgeBaseProps & { mode: ScriptMode | string | undefined }) {
  const normalizedMode = normalizeMode(mode ?? 'freeform');
  const config = getModeConfig(normalizedMode);
  
  return (
    <span className={cn(
      "rounded-sm px-1 py-0.5 text-[10px] font-medium",
      config.bgColor,
      config.textColor,
      className
    )}>
      {config.label}
    </span>
  );
}

/**
 * HTTP method badge for API requests.
 */
export function HttpMethodBadge({ 
  method, 
  className 
}: BadgeBaseProps & { method: string }) {
  const methodColors: Record<string, string> = {
    GET: 'bg-cyan-500/15 text-cyan-400',
    POST: 'bg-teal-500/15 text-teal-400',
    PUT: 'bg-yellow-500/15 text-yellow-400',
    PATCH: 'bg-cyan-500/15 text-cyan-400',
    DELETE: 'bg-red-500/15 text-red-400',
  };
  
  return (
    <span className={cn(
      "rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
      methodColors[method.toUpperCase()] ?? 'bg-gray-500/15 text-gray-400',
      className
    )}>
      {method.toUpperCase()}
    </span>
  );
}

