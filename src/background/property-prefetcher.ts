/**
 * Property Prefetcher
 * 
 * Fetches device properties from the collector's cache via CollectorDb.
 * Used to get properties for PowerShell token substitution.
 * 
 * The REST API cannot be used because it redacts sensitive property values.
 * CollectorDb.getInstance().getHost() returns the full unredacted properties.
 */

import { executeAndPoll, buildGroovyCommand } from './debug-api';

// ============================================================================
// Types
// ============================================================================

export interface PrefetchResult {
  success: boolean;
  properties: Record<string, string>;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Groovy script to fetch all properties for a host from CollectorDb.
 * Returns JSON object with all property key-value pairs.
 * If host is not in cache, returns empty object {}.
 * 
 * Note: ParamMap is a custom LogicMonitor class, not a standard Java Map.
 * It has keySet() but not entrySet(), so we iterate keys and use get().
 */
const PREFETCH_SCRIPT_TEMPLATE = `import groovy.json.JsonOutput
import com.santaba.agent.collector3.CollectorDb

def host = CollectorDb.getInstance().getHost("##HOSTNAME##")
if (host == null) {
  println "{}"
  return 0
}
def props = [:]
def hostProps = host.getProperties()
for (key in hostProps.keySet()) {
  props[key] = hostProps.get(key)?.toString() ?: ""
}
println JsonOutput.toJson(props)
return 0
`;

// ============================================================================
// Functions
// ============================================================================

/**
 * Build the prefetch Groovy script with the hostname inserted.
 */
function buildPrefetchScript(hostname: string): string {
  return PREFETCH_SCRIPT_TEMPLATE.replace('##HOSTNAME##', hostname);
}

/**
 * Fetch device properties from the collector's cache.
 * 
 * @param portal The portal hostname
 * @param collectorId The collector ID to query
 * @param hostname The device hostname to fetch properties for
 * @param csrfToken CSRF token for authentication
 * @returns PrefetchResult with properties map or error
 */
export async function fetchDeviceProperties(
  portal: string,
  collectorId: number,
  hostname: string,
  csrfToken: string
): Promise<PrefetchResult> {
  try {
    const script = buildPrefetchScript(hostname);
    const cmdline = buildGroovyCommand(script);
    
    const output = await executeAndPoll(portal, collectorId, cmdline, csrfToken);
    
    // Parse the JSON output
    const properties = parsePropertiesOutput(output);
    
    return {
      success: true,
      properties,
    };
  } catch (error) {
    return {
      success: false,
      properties: {},
      error: error instanceof Error ? error.message : 'Unknown error fetching properties',
    };
  }
}

/**
 * Parse the JSON output from the prefetch script.
 * Handles edge cases like empty output, non-JSON responses, etc.
 */
function parsePropertiesOutput(output: string): Record<string, string> {
  // Trim whitespace and find JSON object
  const trimmed = output.trim();
  
  if (!trimmed) {
    return {};
  }
  
  // The output might have additional lines before/after the JSON
  // Find the JSON object (starts with { and ends with })
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    console.warn('Property prefetch output did not contain JSON:', trimmed);
    return {};
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Ensure all values are strings
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = value !== null && value !== undefined ? String(value) : '';
    }
    
    return result;
  } catch (error) {
    console.warn('Failed to parse property prefetch JSON:', jsonMatch[0], error);
    return {};
  }
}

