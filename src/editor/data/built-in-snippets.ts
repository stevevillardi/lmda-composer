import type { Snippet } from '@/shared/types';

export const BUILT_IN_SNIPPETS: Snippet[] = [
  // ==================== TEMPLATES ====================
  
  // Groovy Templates
  {
    id: 'template-snmp-walk',
    name: 'SNMP Walk',
    description: 'Walk an SNMP OID tree and process results',
    language: 'groovy',
    category: 'template',
    tags: ['snmp', 'network', 'discovery'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.snmp.Snmp;

def hostname = hostProps.get("system.hostname");
def community = hostProps.get("snmp.community") ?: "public";
def version = hostProps.get("snmp.version") ?: "v2c";

// OID to walk
def oid = "1.3.6.1.2.1.2.2.1.2"; // ifDescr

try {
  def results = Snmp.walk(hostname, oid);
  
  results.each { entry ->
    def index = entry.key.tokenize('.')[-1];
    def value = entry.value;
    println "\${index}##\${value}";
  }
} catch (Exception e) {
  println "Error: \${e.message}";
  return 1;
}

return 0;
`,
  },
  {
    id: 'template-http-api',
    name: 'HTTP API Collector',
    description: 'Make HTTP API calls and parse JSON response',
    language: 'groovy',
    category: 'template',
    tags: ['http', 'api', 'rest', 'json'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.http.*;
import groovy.json.JsonSlurper;

def hostname = hostProps.get("system.hostname");
def apiKey = hostProps.get("api.key");
def apiUrl = "https://\${hostname}/api/v1/data";

try {
  def httpClient = HTTP.open(apiUrl, 443);
  httpClient.setHeader("Authorization", "Bearer \${apiKey}");
  httpClient.setHeader("Content-Type", "application/json");
  
  def response = httpClient.get("/endpoint");
  def statusCode = httpClient.getStatusCode();
  
  if (statusCode != 200) {
    println "Error: HTTP \${statusCode}";
    return 1;
  }
  
  def jsonSlurper = new JsonSlurper();
  def data = jsonSlurper.parseText(response);
  
  // Process the data
  data.items?.each { item ->
    println "\${item.name}=\${item.value}";
  }
  
  httpClient.close();
} catch (Exception e) {
  println "Error: \${e.message}";
  return 1;
}

return 0;
`,
  },
  {
    id: 'template-ssh-command',
    name: 'SSH Command Execution',
    description: 'Execute commands via SSH and parse output',
    language: 'groovy',
    category: 'template',
    tags: ['ssh', 'linux', 'command'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.expect.Expect;

def hostname = hostProps.get("system.hostname");
def user = hostProps.get("ssh.user");
def pass = hostProps.get("ssh.pass");
def port = hostProps.get("ssh.port")?.toInteger() ?: 22;

try {
  def ssh = Expect.open(hostname, port, user, pass);
  ssh.expect("#");
  
  // Execute command
  ssh.send("df -h\\n");
  ssh.expect("#");
  def output = ssh.before;
  
  // Parse output
  output.eachLine { line ->
    if (line.contains("/dev/")) {
      def parts = line.split("\\\\s+");
      if (parts.length >= 5) {
        def mount = parts[-1];
        def usedPercent = parts[-2].replace("%", "");
        println "\${mount}.usedPercent=\${usedPercent}";
      }
    }
  }
  
  ssh.send("exit\\n");
  ssh.expectClose();
} catch (Exception e) {
  println "Error: \${e.message}";
  return 1;
}

return 0;
`,
  },
  {
    id: 'template-ad-groovy',
    name: 'Active Discovery Boilerplate',
    description: 'Basic structure for Active Discovery scripts',
    language: 'groovy',
    category: 'template',
    tags: ['discovery', 'ad', 'instances'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.snmp.Snmp;

def hostname = hostProps.get("system.hostname");

// Output format: wildvalue##wildname##description####auto.property=value
// Minimum: wildvalue##wildname

try {
  // Example: Discover interfaces
  def interfaces = [:];
  
  // Get interface names
  def ifDescr = Snmp.walk(hostname, "1.3.6.1.2.1.2.2.1.2");
  ifDescr.each { oid, name ->
    def index = oid.tokenize('.')[-1];
    interfaces[index] = [name: name];
  }
  
  // Get interface types
  def ifType = Snmp.walk(hostname, "1.3.6.1.2.1.2.2.1.3");
  ifType.each { oid, type ->
    def index = oid.tokenize('.')[-1];
    if (interfaces[index]) {
      interfaces[index].type = type;
    }
  }
  
  // Output discovered instances
  interfaces.each { index, data ->
    def name = data.name ?: "Interface \${index}";
    def description = "Type: \${data.type ?: 'Unknown'}";
    println "\${index}##\${name}##\${description}";
  }
  
} catch (Exception e) {
  println "Error: \${e.message}";
  return 1;
}

return 0;
`,
  },
  {
    id: 'template-batch-collection',
    name: 'Batch Collection Boilerplate',
    description: 'Basic structure for batch collection scripts',
    language: 'groovy',
    category: 'template',
    tags: ['collection', 'batch', 'datapoints'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.snmp.Snmp;

def hostname = hostProps.get("system.hostname");

// Output format: wildvalue.datapoint=value
// The wildvalue must match instances from Active Discovery

try {
  // Get all instance data in one sweep
  def ifInOctets = Snmp.walk(hostname, "1.3.6.1.2.1.2.2.1.10");
  def ifOutOctets = Snmp.walk(hostname, "1.3.6.1.2.1.2.2.1.16");
  def ifSpeed = Snmp.walk(hostname, "1.3.6.1.2.1.2.2.1.5");
  
  // Collect all unique indices
  def indices = (ifInOctets.keySet() + ifOutOctets.keySet()).collect { 
    it.tokenize('.')[-1] 
  }.unique();
  
  // Output datapoints for each instance
  indices.each { index ->
    def inOctets = ifInOctets.find { it.key.endsWith(".\${index}") }?.value ?: 0;
    def outOctets = ifOutOctets.find { it.key.endsWith(".\${index}") }?.value ?: 0;
    def speed = ifSpeed.find { it.key.endsWith(".\${index}") }?.value ?: 0;
    
    println "\${index}.InOctets=\${inOctets}";
    println "\${index}.OutOctets=\${outOctets}";
    println "\${index}.Speed=\${speed}";
  }
  
} catch (Exception e) {
  println "Error: \${e.message}";
  return 1;
}

return 0;
`,
  },
  
  // PowerShell Templates
  {
    id: 'template-wmi-query',
    name: 'WMI Query',
    description: 'Query WMI classes for Windows monitoring',
    language: 'powershell',
    category: 'template',
    tags: ['wmi', 'windows', 'performance'],
    isBuiltIn: true,
    code: `# WMI Query Template
$hostname = "##SYSTEM.HOSTNAME##"
$username = "##WMI.USER##"
$password = "##WMI.PASS##"

try {
    # Create credential object if credentials are provided
    if ($username -and $password) {
        $securePass = ConvertTo-SecureString $password -AsPlainText -Force
        $cred = New-Object System.Management.Automation.PSCredential($username, $securePass)
        $wmiParams = @{
            ComputerName = $hostname
            Credential = $cred
        }
    } else {
        $wmiParams = @{
            ComputerName = $hostname
        }
    }
    
    # Query WMI
    $cpuInfo = Get-WmiObject -Class Win32_Processor @wmiParams
    $memInfo = Get-WmiObject -Class Win32_OperatingSystem @wmiParams
    
    # Output datapoints
    $cpuUsage = ($cpuInfo | Measure-Object -Property LoadPercentage -Average).Average
    $memUsed = [math]::Round(($memInfo.TotalVisibleMemorySize - $memInfo.FreePhysicalMemory) / 1MB, 2)
    $memTotal = [math]::Round($memInfo.TotalVisibleMemorySize / 1MB, 2)
    
    Write-Host "CPUUsage=$cpuUsage"
    Write-Host "MemoryUsedGB=$memUsed"
    Write-Host "MemoryTotalGB=$memTotal"
    
    Exit 0
} catch {
    Write-Host "Error: $_"
    Exit 1
}
`,
  },
  {
    id: 'template-winrm-remote',
    name: 'WinRM Remote Execution',
    description: 'Execute PowerShell commands on remote Windows hosts',
    language: 'powershell',
    category: 'template',
    tags: ['winrm', 'windows', 'remote'],
    isBuiltIn: true,
    code: `# WinRM Remote Execution Template
$hostname = "##SYSTEM.HOSTNAME##"
$username = "##WINRM.USER##"
$password = "##WINRM.PASS##"
$port = "##WINRM.PORT##"
if (-not $port) { $port = "5985" }

try {
    # Create credential
    $securePass = ConvertTo-SecureString $password -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential($username, $securePass)
    
    # Create session
    $sessionOption = New-PSSessionOption -SkipCACheck -SkipCNCheck
    $session = New-PSSession -ComputerName $hostname -Port $port -Credential $cred -SessionOption $sessionOption -ErrorAction Stop
    
    # Execute commands remotely
    $result = Invoke-Command -Session $session -ScriptBlock {
        $disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
        @{
            FreeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
            TotalSpaceGB = [math]::Round($disk.Size / 1GB, 2)
            UsedPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 1)
        }
    }
    
    # Output datapoints
    Write-Host "DiskFreeSpaceGB=$($result.FreeSpaceGB)"
    Write-Host "DiskTotalSpaceGB=$($result.TotalSpaceGB)"
    Write-Host "DiskUsedPercent=$($result.UsedPercent)"
    
    Remove-PSSession $session
    Exit 0
} catch {
    Write-Host "Error: $_"
    Exit 1
}
`,
  },
  
  // ==================== PATTERNS ====================
  
  // Groovy Patterns
  {
    id: 'pattern-property-access',
    name: 'Property Access',
    description: 'Access host, instance, and task properties',
    language: 'groovy',
    category: 'pattern',
    tags: ['properties', 'hostprops'],
    isBuiltIn: true,
    code: `// Host properties
def hostname = hostProps.get("system.hostname");
def displayname = hostProps.get("system.displayname");
def collector = hostProps.get("system.collectorid");

// Instance properties (in collection scripts)
def wildvalue = instanceProps.get("wildvalue");
def customProp = instanceProps.get("auto.custom.property");

// Task properties
def pollInterval = taskProps.get("pollinterval");
`,
  },
  {
    id: 'pattern-error-handling',
    name: 'Error Handling Try/Catch',
    description: 'Proper error handling with return codes',
    language: 'groovy',
    category: 'pattern',
    tags: ['error', 'exception', 'try-catch'],
    isBuiltIn: true,
    code: `try {
    // Your code here
    
} catch (Exception e) {
    // Log the error
    println "Error: \${e.message}";
    
    // Optionally print stack trace for debugging
    // e.printStackTrace();
    
    // Return non-zero to indicate failure
    return 1;
}

return 0;
`,
  },
  {
    id: 'pattern-json-parsing',
    name: 'JSON Parsing',
    description: 'Parse and navigate JSON data structures',
    language: 'groovy',
    category: 'pattern',
    tags: ['json', 'parsing', 'api'],
    isBuiltIn: true,
    code: `import groovy.json.JsonSlurper;
import groovy.json.JsonOutput;

def jsonSlurper = new JsonSlurper();

// Parse JSON string
def jsonString = '{"name": "test", "values": [1, 2, 3]}';
def data = jsonSlurper.parseText(jsonString);

// Access fields
def name = data.name;
def firstValue = data.values[0];

// Iterate arrays
data.values.each { value ->
    println "Value: \${value}";
}

// Convert back to JSON string
def outputJson = JsonOutput.toJson(data);
def prettyJson = JsonOutput.prettyPrint(outputJson);
`,
  },
  {
    id: 'pattern-credential-retrieval',
    name: 'Credential Retrieval',
    description: 'Retrieve credentials with fallbacks',
    language: 'groovy',
    category: 'pattern',
    tags: ['credentials', 'security', 'authentication'],
    isBuiltIn: true,
    code: `// Credential retrieval with fallbacks
// Check instance -> host -> default

def getCredential(hostProps, instanceProps, propName, defaultValue = "") {
    return instanceProps?.get(propName) ?: 
           hostProps.get(propName) ?: 
           defaultValue;
}

def username = getCredential(hostProps, instanceProps, "ssh.user", "admin");
def password = getCredential(hostProps, instanceProps, "ssh.pass", "");
def port = getCredential(hostProps, instanceProps, "ssh.port", "22");

// SNMP credentials
def community = hostProps.get("snmp.community") ?: "public";
def snmpVersion = hostProps.get("snmp.version") ?: "v2c";
def snmpPort = hostProps.get("snmp.port")?.toInteger() ?: 161;
`,
  },
  {
    id: 'pattern-debug-logging',
    name: 'Debug Logging',
    description: 'Add debug output for troubleshooting',
    language: 'groovy',
    category: 'pattern',
    tags: ['debug', 'logging', 'troubleshooting'],
    isBuiltIn: true,
    code: `// Debug flag - set to true for verbose output
def DEBUG = true;

def debug(message) {
    if (DEBUG) {
        println "[DEBUG] \${new Date().format('HH:mm:ss')} - \${message}";
    }
}

// Usage
debug("Starting script execution");
debug("Hostname: \${hostProps.get('system.hostname')}");

try {
    debug("Attempting connection...");
    // Your code here
    debug("Connection successful");
} catch (Exception e) {
    debug("Error occurred: \${e.message}");
    debug("Stack trace: \${e.getStackTrace().take(5).join('\\n')}");
}
`,
  },
  
  // PowerShell Patterns
  {
    id: 'pattern-ps-property-tokens',
    name: 'Property Tokens',
    description: 'Use property tokens in PowerShell scripts',
    language: 'powershell',
    category: 'pattern',
    tags: ['properties', 'tokens'],
    isBuiltIn: true,
    code: `# Property tokens are replaced before script execution
# Use the format: ##PROPERTY.NAME##

$hostname = "##SYSTEM.HOSTNAME##"
$displayname = "##SYSTEM.DISPLAYNAME##"
$collector = "##SYSTEM.COLLECTORID##"

# Custom properties
$apiKey = "##API.KEY##"
$environment = "##CUSTOM.ENVIRONMENT##"

# Credentials
$wmiUser = "##WMI.USER##"
$wmiPass = "##WMI.PASS##"
`,
  },
  {
    id: 'pattern-ps-error-handling',
    name: 'Error Handling',
    description: 'PowerShell error handling pattern',
    language: 'powershell',
    category: 'pattern',
    tags: ['error', 'exception', 'try-catch'],
    isBuiltIn: true,
    code: `# Enable strict error handling
$ErrorActionPreference = "Stop"

try {
    # Your code here
    
} catch [System.Net.WebException] {
    # Handle specific exception types
    Write-Host "Network Error: $_"
    Exit 1
} catch {
    # Handle all other exceptions
    Write-Host "Error: $_"
    Write-Host "Error Type: $($_.Exception.GetType().FullName)"
    Exit 1
} finally {
    # Cleanup code (always runs)
    # Close connections, dispose objects, etc.
}

Exit 0
`,
  },
  {
    id: 'pattern-ps-output-format',
    name: 'Output Formatting',
    description: 'Format datapoint output correctly',
    language: 'powershell',
    category: 'pattern',
    tags: ['output', 'datapoints', 'format'],
    isBuiltIn: true,
    code: `# Standard collection output: datapoint=value
Write-Host "CPUUsage=45.2"
Write-Host "MemoryUsed=8192"
Write-Host "DiskFreePercent=25.5"

# Batch collection output: wildvalue.datapoint=value
Write-Host "eth0.InOctets=12345678"
Write-Host "eth0.OutOctets=87654321"
Write-Host "eth1.InOctets=11111111"

# Active Discovery output: wildvalue##name##description
Write-Host "disk_C##C: Drive##System Drive"
Write-Host "disk_D##D: Drive##Data Drive"

# With auto-properties: wildvalue##name##description####auto.prop=value&auto.prop2=value
Write-Host "svc_spooler##Print Spooler##Windows Print Service####auto.starttype=automatic&auto.status=running"
`,
  },
];

