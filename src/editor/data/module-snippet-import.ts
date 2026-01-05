/**
 * Generates import boilerplate code for LogicMonitor Module Snippets
 */

/**
 * Derive a variable name from a snippet name
 * Examples:
 *   lm.emit -> emit
 *   cisco.meraki -> meraki
 *   lm.data.topo -> topo
 *   proto.http -> http
 */
export function deriveVariableName(snippetName: string): string {
  // Split by dots and take the last part
  const parts = snippetName.split('.');
  const lastPart = parts[parts.length - 1] ?? snippetName;
  
  // Clean up any non-alphanumeric characters and ensure it's a valid identifier
  const cleaned = lastPart.replace(/[^a-zA-Z0-9]/g, '');
  
  // If it starts with a number, prefix with underscore
  if (/^\d/.test(cleaned)) {
    return `_${cleaned}`;
  }
  
  return cleaned || 'snippet';
}

/**
 * Extract the major version from a version string
 * Examples:
 *   1.3.0 -> 1
 *   0.4.1 -> 0
 */
export function extractMajorVersion(version: string): string {
  const parts = version.split('.');
  return parts[0] ?? '0';
}

/**
 * Generate the import boilerplate code for a Module Snippet
 */
export function generateModuleSnippetImport(snippetName: string, version: string): string {
  const variableName = deriveVariableName(snippetName);
  const majorVersion = extractMajorVersion(version);
  
  return `/*******************************************************************************
 * Module Snippet: ${snippetName}
 ******************************************************************************/
import com.logicmonitor.common.sse.utils.GroovyScriptHelper as GSH
import com.logicmonitor.mod.Snippets

def modLoader = GSH.getInstance()._getScript("Snippets", Snippets.getLoader()).withBinding(getBinding())
def ${variableName} = modLoader.load("${snippetName}", "${majorVersion}")
`;
}

/**
 * Generate a minimal import statement (just the load line, for inserting into existing scripts)
 */
export function generateMinimalImport(snippetName: string, version: string): string {
  const variableName = deriveVariableName(snippetName);
  const majorVersion = extractMajorVersion(version);
  
  return `def ${variableName} = modLoader.load("${snippetName}", "${majorVersion}")`;
}

