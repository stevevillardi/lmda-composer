/**
 * Property Prefetcher
 * 
 * Fetches device properties from the collector's cache via CollectorDb.
 * Used for PowerShell token substitution (REST API redacts sensitive values).
 */

import { executeAndPoll, buildGroovyCommand } from './debug-api';

export interface PrefetchResult {
  success: boolean;
  properties: Record<string, string>;
  error?: string;
}

/**
 * Groovy script to fetch all properties for a host from CollectorDb.
 */
const PREFETCH_SCRIPT_TEMPLATE = `import groovy.json.JsonOutput
import com.santaba.agent.collector3.CollectorDb

def hostname = new String("##HOSTNAMEBASE64##".decodeBase64())
def host = CollectorDb.getInstance().getHost(hostname)
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

function buildPrefetchScript(hostname: string): string {
  const hostnameBase64 = btoa(hostname);
  return PREFETCH_SCRIPT_TEMPLATE.replace('##HOSTNAMEBASE64##', hostnameBase64);
}

/**
 * Fetch device properties from the collector's cache.
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

function parsePropertiesOutput(output: string): Record<string, string> {
  const trimmed = output.trim();
  if (!trimmed) return {};
  
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) return {};
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = value !== null && value !== undefined ? String(value) : '';
    }
    
    return result;
  } catch {
    return {};
  }
}
