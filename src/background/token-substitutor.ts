/**
 * Token Substitutor
 * 
 * Handles ##PROPERTY.NAME## token substitution in scripts.
 * Used primarily for PowerShell scripts to inject device properties.
 */

// ============================================================================
// Types
// ============================================================================

export interface SubstitutionResult {
  /** The script with tokens replaced */
  script: string;
  /** List of tokens that were successfully substituted */
  substitutions: Array<{ token: string; value: string }>;
  /** List of tokens that had no matching property (substituted with empty string) */
  missing: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Regex to match ##TOKEN## patterns.
 * Tokens can contain letters, numbers, underscores, dots, and hyphens.
 * Examples: ##SYSTEM.HOSTNAME##, ##snmp.community##, ##auto.instance_name##
 */
const TOKEN_REGEX = /##([A-Za-z0-9_.-]+)##/gi;

// ============================================================================
// Functions
// ============================================================================

/**
 * Check if a script contains any ##TOKEN## patterns.
 * Use this for quick optimization before fetching properties.
 */
export function hasTokens(script: string): boolean {
  // Reset regex state since we use global flag
  TOKEN_REGEX.lastIndex = 0;
  return TOKEN_REGEX.test(script);
}

/**
 * Extract all unique token names from a script.
 * Returns token names in lowercase for case-insensitive matching.
 */
export function extractTokens(script: string): string[] {
  const tokens = new Set<string>();
  
  // Reset regex state
  TOKEN_REGEX.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(script)) !== null) {
    // Store token name in lowercase for case-insensitive matching
    tokens.add(match[1].toLowerCase());
  }
  
  return Array.from(tokens);
}

/**
 * Substitute all ##TOKEN## patterns in a script with property values.
 * 
 * @param script The script containing ##TOKEN## patterns
 * @param props Property map (keys should be lowercase for case-insensitive lookup)
 * @returns SubstitutionResult with the modified script and substitution details
 */
export function substituteTokens(
  script: string,
  props: Record<string, string>
): SubstitutionResult {
  const substitutions: Array<{ token: string; value: string }> = [];
  const missing: string[] = [];
  
  // Create lowercase property map for case-insensitive lookup
  const propsLower: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    propsLower[key.toLowerCase()] = value;
  }
  
  // Reset regex state
  TOKEN_REGEX.lastIndex = 0;
  
  const resultScript = script.replace(TOKEN_REGEX, (_fullMatch, tokenName: string) => {
    const tokenLower = tokenName.toLowerCase();
    const value = propsLower[tokenLower];
    
    if (value !== undefined) {
      substitutions.push({ token: tokenName, value });
      return value;
    } else {
      // Token not found - substitute with empty string
      missing.push(tokenName);
      return '';
    }
  });
  
  return {
    script: resultScript,
    substitutions,
    missing,
  };
}

/**
 * Create an empty substitution result (all tokens replaced with empty strings).
 * Used when no hostname is provided but tokens are present.
 */
export function substituteWithEmpty(script: string): SubstitutionResult {
  return substituteTokens(script, {});
}

