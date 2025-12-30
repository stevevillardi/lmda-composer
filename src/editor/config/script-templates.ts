import type { ScriptLanguage } from '@/shared/types';

export const DEFAULT_GROOVY_TEMPLATE = `import com.santaba.agent.groovyapi.expect.Expect;
import com.santaba.agent.groovyapi.snmp.Snmp;
import com.santaba.agent.groovyapi.http.*;
import com.santaba.agent.groovyapi.jmx.*;

def hostname = hostProps.get("system.hostname");

// Your script here

return 0;
`;

export const DEFAULT_POWERSHELL_TEMPLATE = `# LogicMonitor PowerShell Script

$hostname = "##SYSTEM.HOSTNAME##"

# Your script here

Exit 0
`;

export function getDefaultScriptTemplate(language: ScriptLanguage): string {
  return language === 'groovy' ? DEFAULT_GROOVY_TEMPLATE : DEFAULT_POWERSHELL_TEMPLATE;
}
