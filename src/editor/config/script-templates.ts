import type { LogicModuleType, ScriptLanguage } from '@/shared/types';

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function getDefaultGroovyTemplate(): string {
  return `/*******************************************************************************
 * Created via LMDA Composer - ${getFormattedDate()}
 ******************************************************************************/

// Debug mode - set to true for verbose output (script-level binding for closure access)
debug = false

def host = hostProps.get("system.hostname")

/**
 * Helper function for debug output
 * Uses script-level binding so it can be called from other closures
 */
LMDebugPrint = { message ->
    if (debug) {
        println(message.toString())
    }
}

try {
    LMDebugPrint("Starting script for host: \${host}")
    
    // Your code here
    
} catch (Exception e) {
    println "Error: \${e.message}"
    return 1
}

return 0
`;
}

export function getDefaultPowershellTemplate(): string {
  return `<#******************************************************************************
 * Created via LMDA Composer - ${getFormattedDate()}
 *****************************************************************************#>

$hostname = "##SYSTEM.HOSTNAME##"

try {
    # Your code here
    
    Exit 0
} catch {
    Write-Host "Error: $_"
    Exit 1
}
`;
}

// Keep backwards compatibility
export const DEFAULT_GROOVY_TEMPLATE = getDefaultGroovyTemplate();
export const DEFAULT_POWERSHELL_TEMPLATE = getDefaultPowershellTemplate();

export function getDefaultScriptTemplate(language: ScriptLanguage): string {
  return language === 'groovy' ? getDefaultGroovyTemplate() : getDefaultPowershellTemplate();
}

// ============================================================================
// Module-Type-Aware Templates
// ============================================================================

/** Human-readable labels for module types */
const MODULE_TYPE_LABELS: Record<LogicModuleType, string> = {
  datasource: 'DataSource',
  configsource: 'ConfigSource',
  topologysource: 'TopologySource',
  propertysource: 'PropertySource',
  logsource: 'LogSource',
  eventsource: 'EventSource',
  diagnosticsource: 'DiagnosticSource',
};

/**
 * Get the full script template for a specific module type, language, and script type.
 * Used when creating new modules to ensure consistent templates between
 * API payloads and editor tabs.
 */
export function getModuleScriptTemplate(
  moduleType: LogicModuleType,
  language: ScriptLanguage,
  scriptType: 'collection' | 'ad'
): string {
  const moduleLabel = MODULE_TYPE_LABELS[moduleType];
  const scriptLabel = scriptType === 'ad' ? 'Active Discovery' : 'Collection';

  if (language === 'powershell') {
    return getGroovyModulePowershellTemplate(moduleLabel, scriptLabel);
  }
  return getGroovyModuleGroovyTemplate(moduleLabel, scriptLabel);
}

function getGroovyModuleGroovyTemplate(moduleLabel: string, scriptLabel: string): string {
  return `/*******************************************************************************
 * ${moduleLabel} - ${scriptLabel} Script
 * Created via LMDA Composer - ${getFormattedDate()}
 ******************************************************************************/

// Debug mode - set to true for verbose output (script-level binding for closure access)
debug = false

def host = hostProps.get("system.hostname")

/**
 * Helper function for debug output
 * Uses script-level binding so it can be called from other closures
 */
LMDebugPrint = { message ->
    if (debug) {
        println(message.toString())
    }
}

try {
    LMDebugPrint("Starting script for host: \${host}")
    
    // Your code here
    
} catch (Exception e) {
    println "Error: \${e.message}"
    return 1
}

return 0
`;
}

function getGroovyModulePowershellTemplate(moduleLabel: string, scriptLabel: string): string {
  return `<#******************************************************************************
 * ${moduleLabel} - ${scriptLabel} Script
 * Created via LMDA Composer - ${getFormattedDate()}
 *****************************************************************************#>

$hostname = "##SYSTEM.HOSTNAME##"

try {
    # Your code here
    
    Exit 0
} catch {
    Write-Host "Error: $_"
    Exit 1
}
`;
}
