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
      "text-[10px] font-mono font-medium px-1 py-0.5 rounded",
      language === 'groovy' 
        ? "bg-blue-500/20 text-blue-400" 
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
      "text-[10px] font-medium px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400",
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
      "text-[10px] font-medium px-1 py-0.5 rounded",
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
    GET: 'bg-blue-500/15 text-blue-400',
    POST: 'bg-emerald-500/15 text-emerald-400',
    PUT: 'bg-amber-500/15 text-amber-400',
    PATCH: 'bg-cyan-500/15 text-cyan-400',
    DELETE: 'bg-rose-500/15 text-rose-400',
  };
  
  return (
    <span className={cn(
      "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded uppercase",
      methodColors[method.toUpperCase()] ?? 'bg-gray-500/15 text-gray-400',
      className
    )}>
      {method.toUpperCase()}
    </span>
  );
}

