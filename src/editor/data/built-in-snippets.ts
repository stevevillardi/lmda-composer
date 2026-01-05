import type { Snippet } from '@/shared/types';

export const BUILT_IN_SNIPPETS: Snippet[] = [
  // ==================== TEMPLATES ====================
  
  // Groovy Templates
  {
    id: 'template-snmp-walk',
    name: 'SNMP Walk',
    description: 'Walk an SNMP OID tree with timeout, retry, and debug support',
    language: 'groovy',
    category: 'template',
    tags: ['snmp', 'network', 'discovery', 'timeout', 'retry'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.snmp.Snmp
import com.santaba.agent.util.Settings

// Debug mode - set to true for verbose output
def debug = false

def host = hostProps.get("system.hostname")
Map props = hostProps.toProperties().collectEntries { k, v -> [(k.toLowerCase()): v] }

// Calculate timeout from collector settings
def timeoutStart = System.currentTimeMillis()
def timeout = Settings.getSettingInt("collector.script.timeout", 120) * 1000
timeout -= 2500 // Buffer for cleanup

// OIDs to walk
def oidDescr = "1.3.6.1.2.1.2.2.1.2"  // ifDescr
def oidType = "1.3.6.1.2.1.2.2.1.3"   // ifType

/**
 * Helper function for debug output
 */
def LMDebugPrint(message) {
    if (debug) {
        println(message.toString())
    }
}

/**
 * SNMP walk with retry logic and timeout management
 */
def walkWithRetry(hostname, oid, props, timeout, timeoutStart, maxRetries = 5) {
    def retries = 0
    while (retries < maxRetries) {
        def remainingTime = Math.max(0, timeout - (System.currentTimeMillis() - timeoutStart)).intValue()
        if (remainingTime == 0) throw new Exception("Timeout waiting on SNMP Walk")
        
        try {
            return Snmp.walkAsMap(hostname, oid, props, remainingTime)
        } catch (IOException e) {
            retries++
            LMDebugPrint("SNMP walk attempt \${retries} failed: \${e.message}")
            Thread.sleep(25)
        }
    }
    throw new Exception("SNMP walk failed after \${maxRetries} retries")
}

try {
    LMDebugPrint("Starting SNMP walk for host: \${host}")
    
    // Walk interface descriptions
    def ifDescr = walkWithRetry(host, oidDescr, props, timeout, timeoutStart)
    LMDebugPrint("Found \${ifDescr.size()} interfaces")
    
    // Walk interface types
    def ifType = walkWithRetry(host, oidType, props, timeout, timeoutStart)
    
    // Process and output results
    ifDescr.each { index, name ->
        def type = ifType.get(index) ?: "unknown"
        LMDebugPrint("Interface \${index}: \${name} (type: \${type})")
        println "\${index}##\${name}"
    }
    
} catch (Exception e) {
    println "Error: \${e.message}"
    return 1
}

return 0
`,
  },
  {
    id: 'template-http-api',
    name: 'HTTP API Collector',
    description: 'Make HTTP API calls with authentication and JSON parsing',
    language: 'groovy',
    category: 'template',
    tags: ['http', 'api', 'rest', 'json', 'authentication'],
    isBuiltIn: true,
    code: `import groovy.json.JsonSlurper

// Debug mode - set to true for verbose output
def debug = false

def hostname = hostProps.get("system.hostname")
def apiKey = hostProps.get("api.key")
def apiSecret = hostProps.get("api.secret")
def apiPort = hostProps.get("api.port")?.toInteger() ?: 443

/**
 * Helper function for debug output
 */
def LMDebugPrint(message) {
    if (debug) {
        println(message.toString())
    }
}

/**
 * Make HTTP GET request with proper error handling
 */
def httpGet(url, headers = [:], timeout = 30000) {
    def connection = url.toURL().openConnection()
    connection.setRequestMethod("GET")
    connection.setConnectTimeout(timeout)
    connection.setReadTimeout(timeout)
    
    headers.each { k, v ->
        connection.addRequestProperty(k, v)
    }
    
    def responseCode = connection.getResponseCode()
    def responseBody = ""
    
    try {
        responseBody = connection.getInputStream().getText()
    } catch (Exception e) {
        responseBody = connection.getErrorStream()?.getText() ?: ""
    }
    
    return [code: responseCode, body: responseBody]
}

try {
    def apiUrl = "https://\${hostname}:\${apiPort}/api/v1/data"
    
    LMDebugPrint("Making API request to: \${apiUrl}")
    
    def headers = [
        "Authorization": "Bearer \${apiKey}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    ]
    
    def response = httpGet(apiUrl, headers)
    
    LMDebugPrint("Response code: \${response.code}")
    
    if (response.code != 200) {
        println "Error: HTTP \${response.code}"
        LMDebugPrint("Response body: \${response.body}")
        return 1
    }
    
    def jsonSlurper = new JsonSlurper()
    def data = jsonSlurper.parseText(response.body)
    
    // Process the data - customize based on your API
    data.items?.each { item ->
        println "\${item.name}=\${item.value}"
    }
    
} catch (Exception e) {
    println "Error: \${e.message}"
    if (debug) e.printStackTrace()
    return 1
}

return 0
`,
  },
  {
    id: 'template-ssh-command',
    name: 'SSH Command Execution',
    description: 'Execute commands via SSH with credential fallbacks and proper cleanup',
    language: 'groovy',
    category: 'template',
    tags: ['ssh', 'linux', 'command', 'credentials', 'cleanup'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.expect.Expect
import com.santaba.agent.util.Settings

// Debug mode - set to true for verbose output
def debug = false

// Credential retrieval with fallbacks (instance -> host -> config)
def host = hostProps.get("config.hostname") ?: hostProps.get("system.hostname")
def user = hostProps.get("ssh.user") ?: hostProps.get("config.user")
def pass = hostProps.get("ssh.pass") ?: hostProps.get("config.pass")
def port = hostProps.get("ssh.port")?.toInteger() ?: 22

// Timeout configuration
def timeout = Settings.getSettingInt("collector.script.timeout", 120) * 1000
timeout -= 5000 // Buffer for cleanup

def ssh = null

/**
 * Helper function for debug output
 */
def LMDebugPrint(message) {
    if (debug) {
        println(message.toString())
    }
}

try {
    LMDebugPrint("Connecting to \${host}:\${port} as \${user}")
    
    ssh = Expect.open(host, port, user, pass)
    ssh.expect("#|\\\$|>")  // Common prompt patterns
    
    LMDebugPrint("Connected successfully")
    
    // Execute command
    ssh.send("df -h\\n")
    ssh.expect("#|\\\$|>")
    def output = ssh.before
    
    LMDebugPrint("Command output received")
    
    // Parse output
    output.eachLine { line ->
        if (line.contains("/dev/")) {
            def parts = line.split("\\\\s+")
            if (parts.length >= 5) {
                def mount = parts[-1]
                def usedPercent = parts[-2].replace("%", "")
                println "\${mount}.usedPercent=\${usedPercent}"
            }
        }
    }
    
} catch (Exception e) {
    println "Error: \${e.message}"
    LMDebugPrint("Stack trace: \${e.getStackTrace().take(5).join('\\n')}")
    return 1
} finally {
    // Always clean up the SSH connection
    try {
        if (ssh) {
            ssh.send("exit\\n")
            ssh.expectClose()
            LMDebugPrint("SSH connection closed")
        }
    } catch (Exception e) {
        LMDebugPrint("Error closing SSH: \${e.message}")
    }
}

return 0
`,
  },
  {
    id: 'template-ad-groovy',
    name: 'Active Discovery Boilerplate',
    description: 'Production-quality Active Discovery with ILP encoding and debug support',
    language: 'groovy',
    category: 'template',
    tags: ['discovery', 'ad', 'instances', 'ilp', 'encoding'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.snmp.Snmp
import com.santaba.agent.util.Settings

// Debug mode - set to true for verbose output
def debug = false

def host = hostProps.get("system.hostname")
Map props = hostProps.toProperties().collectEntries { k, v -> [(k.toLowerCase()): v] }

// Timeout configuration
def timeoutStart = System.currentTimeMillis()
def timeout = Settings.getSettingInt("discover.script.timeoutInSec", 300) * 1000
timeout -= 5000 // Buffer for cleanup

/**
 * Helper function for debug output
 */
def LMDebugPrint(message) {
    if (debug) {
        println(message.toString())
    }
}

/**
 * Sanitize string for instance output (remove invalid chars)
 */
def sanitize(str) {
    str?.toString()
        ?.trim()
        ?.replaceAll(/\\s+/, " ")  // Collapse whitespace
        ?.replaceAll(/#/, "")      // Remove hash marks
}

/**
 * URL-encode string for ILP values
 */
def encode(str) {
    str?.toString()
        ?.replaceAll(/\\+/, "%2B")  // Encode plus
        ?.replaceAll(/=/, "%3D")   // Encode equals
        ?.replaceAll(/&/, "%26")   // Encode ampersand
}

/**
 * Output format: wildvalue##wildalias##description####auto.prop1=val1&auto.prop2=val2
 */
def outputInstance(wildvalue, wildalias, description, Map ilps = [:]) {
    def output = "\${wildvalue}##\${sanitize(wildalias)}##\${sanitize(description)}"
    
    if (ilps) {
        def ilpString = ilps.collect { k, v -> 
            "auto.\${k}=\${encode(sanitize(v))}" 
        }.join("&")
        output += "####\${ilpString}"
    }
    
    println output
}

try {
    LMDebugPrint("Starting Active Discovery for: \${host}")
    
    def interfaces = [:]
    
    // Get interface names
    def ifDescr = Snmp.walkAsMap(host, "1.3.6.1.2.1.2.2.1.2", props, timeout)
    ifDescr.each { oid, name ->
        def index = oid.tokenize('.')[-1]
        interfaces[index] = [name: name]
    }
    
    LMDebugPrint("Found \${interfaces.size()} interfaces")
    
    // Get interface types
    def ifType = Snmp.walkAsMap(host, "1.3.6.1.2.1.2.2.1.3", props, timeout)
    ifType.each { oid, type ->
        def index = oid.tokenize('.')[-1]
        if (interfaces[index]) {
            interfaces[index].type = type
        }
    }
    
    // Get interface MACs
    def ifMac = Snmp.walkAsMap(host, "1.3.6.1.2.1.2.2.1.6", props, timeout)
    ifMac.each { oid, mac ->
        def index = oid.tokenize('.')[-1]
        if (interfaces[index]) {
            interfaces[index].mac = mac
        }
    }
    
    // Output discovered instances with ILPs
    interfaces.each { index, data ->
        def name = data.name ?: "Interface \${index}"
        def description = "Type: \${data.type ?: 'Unknown'}"
        
        def ilps = [
            "ifindex": index,
            "type": data.type ?: "unknown",
            "mac": data.mac ?: ""
        ]
        
        outputInstance(index, name, description, ilps)
    }
    
    LMDebugPrint("Active Discovery complete")
    
} catch (Exception e) {
    println "Error: \${e.message}"
    LMDebugPrint("Stack trace: \${e.getStackTrace().take(5).join('\\n')}")
    return 1
}

return 0
`,
  },
  {
    id: 'template-batch-collection',
    name: 'Batch Collection Boilerplate',
    description: 'Production-quality batch collection with instance props and timeout management',
    language: 'groovy',
    category: 'template',
    tags: ['collection', 'batch', 'datapoints', 'timeout', 'instances'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.snmp.Snmp
import com.santaba.agent.util.Settings

// Debug mode - set to true for verbose output
def debug = false

def host = hostProps.get("system.hostname")
Map props = hostProps.toProperties().collectEntries { k, v -> [(k.toLowerCase()): v] }

// Determine interface mode (32-bit vs 64-bit counters)
def ifMode = props.getOrDefault("interface.mode", 
             props.getOrDefault("auto.interface.mode", "64")).toInteger()

// Timeout configuration
def timeoutStart = System.currentTimeMillis()
def timeout = Settings.getSettingInt("collector.batchscript.timeout",
              Settings.getSettingInt("collector.script.timeout", 120)) * 1000
timeout -= 2500 // Buffer for cleanup

/**
 * Helper function for debug output
 */
def LMDebugPrint(message) {
    if (debug) {
        println(message.toString())
    }
}

// Get all instance properties from datasource
// Available in batch scripts via datasourceinstanceProps
def allInstanceProps = [:]
try {
    datasourceinstanceProps.each { instance, instanceProperties ->
        def instanceProp = [:]
        instanceProperties.keySet().each { key ->
            instanceProp[key] = instanceProperties.get(key)
        }
        // Use ifindex from auto properties as key
        def ifIndex = instanceProperties.get("auto.interface.ifindex") ?: 
                      instanceProperties.get("wildvalue")
        allInstanceProps[ifIndex] = instanceProp
    }
} catch (Exception e) {
    LMDebugPrint("datasourceinstanceProps not available (may be running in debug mode)")
}

LMDebugPrint("Processing \${allInstanceProps.size()} instances")

// Define OIDs based on interface mode
Map counters = [:]
if (ifMode == 64) {
    LMDebugPrint("Using 64-bit interface mode")
    counters = [
        'InOctets':  '1.3.6.1.2.1.31.1.1.1.6',
        'OutOctets': '1.3.6.1.2.1.31.1.1.1.10',
        'InErrors':  '1.3.6.1.2.1.2.2.1.14',
        'OutErrors': '1.3.6.1.2.1.2.2.1.20'
    ]
} else {
    LMDebugPrint("Using 32-bit interface mode")
    counters = [
        'InOctets':  '1.3.6.1.2.1.2.2.1.10',
        'OutOctets': '1.3.6.1.2.1.2.2.1.16',
        'InErrors':  '1.3.6.1.2.1.2.2.1.14',
        'OutErrors': '1.3.6.1.2.1.2.2.1.20'
    ]
}

try {
    // Collect all data with SNMP walks
    def dataMap = [:]
    
    counters.each { dpName, oid ->
        def remainingTime = Math.max(0, timeout - (System.currentTimeMillis() - timeoutStart)).intValue()
        if (remainingTime == 0) throw new Exception("Timeout during collection")
        
        dataMap[dpName] = Snmp.walkAsMap(host, oid, props, remainingTime)
        LMDebugPrint("Collected \${dpName}: \${dataMap[dpName].size()} values")
    }
    
    // Output datapoints for each known instance
    def indices = allInstanceProps.keySet() ?: dataMap.InOctets?.keySet() ?: []
    
    indices.each { index ->
        counters.keySet().each { dpName ->
            def value = dataMap[dpName]?.get(index) ?: 0
            println "\${index}.\${dpName}=\${value}"
        }
    }
    
    LMDebugPrint("Batch collection complete")
    
} catch (Exception e) {
    println "Error: \${e.message}"
    LMDebugPrint("Stack trace: \${e.getStackTrace().take(5).join('\\n')}")
    return 1
}

return 0
`,
  },
  
  // New Template: LM API Collector
  {
    id: 'template-lm-api-collector',
    name: 'LogicMonitor API Collector',
    description: 'Query LogicMonitor API with LMv1 auth, pagination, and proxy support',
    language: 'groovy',
    category: 'template',
    tags: ['api', 'logicmonitor', 'lmv1', 'authentication', 'pagination', 'proxy'],
    isBuiltIn: true,
    code: `import com.santaba.agent.util.Settings
import groovy.json.JsonSlurper
import org.apache.commons.codec.binary.Hex
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

// Debug mode - set to true for verbose output
def debug = false

// API credentials with fallbacks
String apiId = hostProps.get("lmaccess.id") ?: hostProps.get("logicmonitor.access.id")
String apiKey = hostProps.get("lmaccess.key") ?: hostProps.get("logicmonitor.access.key")
def apiVersion = hostProps.get("lmapi.version") ?: "3"

// Portal configuration
def portalName = hostProps.get("lmaccount")
def portalUrl = Settings.getSetting(Settings.AGENT_SERVER)

if (portalName) {
    def domainIndex = portalUrl.indexOf(".")
    if (domainIndex > 0) {
        def domain = portalUrl.substring(domainIndex)
        portalUrl = portalName + domain
    }
}

/**
 * Helper function for debug output
 */
def LMDebugPrint(message) {
    if (debug) {
        println(message.toString())
    }
}

/**
 * Get collector proxy settings
 */
Map getProxyInfo() {
    Boolean deviceProxy = hostProps.get("proxy.enable")?.toBoolean()
    deviceProxy = (deviceProxy != null) ? deviceProxy : true
    Boolean collectorProxy = Settings.getSetting("proxy.enable")?.toBoolean()
    collectorProxy = (collectorProxy != null) ? collectorProxy : false

    Map proxyInfo = [enabled: false]

    if (deviceProxy && collectorProxy) {
        proxyInfo = [
            enabled: true,
            host: hostProps.get("proxy.host") ?: Settings.getSetting("proxy.host"),
            port: hostProps.get("proxy.port") ?: Settings.getSetting("proxy.port") ?: 3128,
            user: Settings.getSetting("proxy.user"),
            pass: Settings.getSetting("proxy.pass")
        ]
        proxyInfo["proxy"] = new Proxy(Proxy.Type.HTTP, 
            new InetSocketAddress(proxyInfo.host, proxyInfo.port.toInteger()))
    }
    return proxyInfo
}

/**
 * Generate LMv1 API authentication signature
 */
static String generateAuth(id, key, path) {
    Long epochTime = System.currentTimeMillis()
    Mac hmac = Mac.getInstance("HmacSHA256")
    hmac.init(new SecretKeySpec(key.getBytes(), "HmacSHA256"))
    def signature = Hex.encodeHexString(
        hmac.doFinal("GET\${epochTime}\${path}".getBytes())
    ).bytes.encodeBase64()
    return "LMv1 \${id}:\${signature}:\${epochTime}"
}

/**
 * Simple GET request
 */
def apiGet(portalName, apiId, apiKey, apiVersion, endPoint, proxyInfo, Map args = [:]) {
    def auth = generateAuth(apiId, apiKey, endPoint)
    def headers = [
        "Authorization": auth, 
        "Content-Type": "application/json", 
        "X-Version": apiVersion
    ]
    def url = "https://\${portalName}/santaba/rest\${endPoint}"

    if (args) {
        def encodedArgs = args.collect { k, v ->
            "\${k}=\${URLEncoder.encode(v.toString(), 'UTF-8')}"
        }
        url += "?\${encodedArgs.join('&')}"
    }
    
    LMDebugPrint("Querying \${url}...")

    def request
    if (proxyInfo.enabled) {
        request = url.toURL().openConnection(proxyInfo.proxy)
    } else {
        request = url.toURL().openConnection()
    }
    request.setRequestMethod("GET")
    headers.each { k, v -> request.addRequestProperty(k, v) }

    def rc = request.getResponseCode()
    if (rc == 200) {
        return new JsonSlurper().parseText(request.content.text)
    } else {
        throw new Exception("HTTP \${rc}")
    }
}

/**
 * Paginated GET request
 */
List apiGetMany(portalName, apiId, apiKey, apiVersion, endPoint, proxyInfo, Map args = [:]) {
    def pageSize = args.get('size', 1000)
    List items = []
    args['size'] = pageSize

    while (true) {
        args['offset'] = items.size()
        def response = apiGet(portalName, apiId, apiKey, apiVersion, endPoint, proxyInfo, args)
        
        if (response.get("errmsg", "OK") != "OK") {
            throw new Exception("API Error: \${response?.errmsg}")
        }
        items.addAll(response.items)
        
        // Stop when we've received less than requested
        if (response.items.size() < pageSize) break
    }
    return items
}

// Main execution
Map proxyInfo = getProxyInfo()

if (proxyInfo.enabled) {
    LMDebugPrint("Using proxy: \${proxyInfo.host}:\${proxyInfo.port}")
}

try {
    // Example: Get all devices
    def devices = apiGetMany(portalUrl, apiId, apiKey, apiVersion, 
        "/device/devices", proxyInfo, ['size': 1000, 'fields': 'id,displayName,hostStatus'])
    
    println "TotalDevices=\${devices.size()}"
    println "AliveDevices=\${devices.findAll { it.hostStatus == 'normal' }.size()}"
    println "DeadDevices=\${devices.findAll { it.hostStatus == 'dead' }.size()}"
    
} catch (Exception e) {
    println "Error: \${e.message}"
    LMDebugPrint("Stack trace: \${e.getStackTrace().take(5).join('\\n')}")
    return 1
}

return 0
`,
  },
  
  // New Template: WMI Service Check (PropertySource)
  {
    id: 'template-wmi-service-check',
    name: 'WMI Service Check',
    description: 'PropertySource to add categories based on Windows service detection',
    language: 'groovy',
    category: 'template',
    tags: ['wmi', 'windows', 'propertysource', 'categories', 'services'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.win32.WMI

def host = hostProps.get("system.hostname")

// Service to check for
def serviceName = "DNS"  // Change this to your target service
def categoryToAdd = "Windows_DNS"  // Category to add if service exists

try {
    // Open WMI session
    def session = WMI.open(host)
    
    // Query for the specific service
    def wmiQuery = "SELECT Name, State FROM Win32_Service WHERE Name='\${serviceName}'"
    def result = session.queryFirst("CIMv2", wmiQuery, 10)
    
    // Check if service exists and is running
    if (result?.STATE == "Running") {
        println "system.categories=\${categoryToAdd}"
    }
    
    session.close()
    
} catch (Exception e) {
    // Service not found or WMI error - this is often expected
    // Don't print error, just return success
}

return 0
`,
  },
  
  // New Template: Module Snippets Loader
  {
    id: 'template-module-snippets-loader',
    name: 'Module Snippets Loader',
    description: 'Load and use LogicMonitor module snippets (lm.remote, lm.emit, etc.)',
    language: 'groovy',
    category: 'template',
    tags: ['modules', 'snippets', 'lm.remote', 'lm.emit', 'reusable'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovy.utils.GroovyScriptHelper as GSH
import com.logicmonitor.mod.Snippets

// Load the snippet loader
def loader = GSH.getInstance(GroovySystem.version).getScript("Snippets", Snippets.getLoader())

// Load lm.remote module for SSH/remote execution
def remote = loader.load("lm.remote", "0").create(hostProps)

// Optional: Configure remote connection
def azureHost = hostProps.get("auto.network.resolves") == "false" ? 
    hostProps.get("system.azure.privateIpAddress") : null

remote = remote.withHost(azureHost ?: hostProps.get("system.hostname"))
               .withTimeout(15000)

// Execute remote command
def output = remote.exec('uname -a')

output.eachLine { line ->
    println line
}

return 0

/*
 * Other commonly used modules:
 * 
 * lm.emit - For emitting data/events
 * def emit = loader.load("lm.emit", "0").create(hostProps)
 * 
 * lm.topo - For topology mapping
 * def topo = loader.load("lm.topo", "0")
 * 
 * lm.topo.snmp - SNMP topology helpers
 * def topoSnmp = loader.load("lm.topo.snmp", "0")
 */
`,
  },
  
  // New Template: PowerShell AD with ILPs
  {
    id: 'template-ps-ad-with-ilps',
    name: 'PowerShell Active Discovery',
    description: 'PowerShell AD with proper instance output and auto-properties formatting',
    language: 'powershell',
    category: 'template',
    tags: ['discovery', 'ad', 'powershell', 'ilp', 'instances'],
    isBuiltIn: true,
    code: `<# PowerShell Active Discovery Template #>

$hostname = '##SYSTEM.HOSTNAME##'
$username = @'
##WMI.USER##
'@
$password = @'
##WMI.PASS##
'@

# Validate that tokens were substituted
# If still contains ## pattern, the property wasn't set
$domain = if('##SYSTEM.DOMAIN##' -match "^##.*##$" -or '##SYSTEM.DOMAIN##' -eq "") { 
    $null 
} else { 
    '##SYSTEM.DOMAIN##' 
}

try {
    # Build credentials if provided
    $wmiParams = @{ ComputerName = $hostname }
    
    if ($username -and $password -and $username -notmatch "^##.*##$") {
        $securePass = ConvertTo-SecureString $password -AsPlainText -Force
        $cred = New-Object System.Management.Automation.PSCredential($username, $securePass)
        $wmiParams['Credential'] = $cred
    }
    
    # Query for services (example discovery)
    $services = Get-WmiObject -Class Win32_Service @wmiParams | 
        Where-Object { $_.StartMode -eq 'Auto' -and $_.State -eq 'Running' }
    
    foreach ($svc in $services) {
        # Build instance-level properties array
        $ilps = @(
            "auto.startmode=$($svc.StartMode)",
            "auto.state=$($svc.State)",
            "auto.processid=$($svc.ProcessId)",
            "auto.pathname=$($svc.PathName -replace '[&=]', '_')"  # Sanitize special chars
        )
        
        # Get display name, fallback to service name
        $wildalias = if ($svc.DisplayName) { $svc.DisplayName } else { $svc.Name }
        
        # Output format: wildvalue##wildalias##description####ilp1&ilp2&ilp3
        Write-Output "$($svc.Name)##$($wildalias)##$($svc.Description)####$([String]::Join('&', $ilps))"
    }
    
    exit 0
} catch {
    Write-Host "Error: $_"
    exit 1
}
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
    if ($username -and $password -and $username -notmatch "^##.*##$") {
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
if (-not $port -or $port -match "^##.*##$") { $port = "5985" }

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
def hostname = hostProps.get("system.hostname")
def displayname = hostProps.get("system.displayname")
def collector = hostProps.get("system.collectorid")

// Instance properties (in collection scripts)
def wildvalue = instanceProps.get("wildvalue")
def customProp = instanceProps.get("auto.custom.property")

// Task properties
def pollInterval = taskProps.get("pollinterval")

// Case-insensitive property access (production pattern)
Map props = hostProps.toProperties().collectEntries { k, v -> [(k.toLowerCase()): v] }
def sysoid = props.get("system.sysoid")
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
    println "Error: \${e.message}"
    
    // Optionally print stack trace for debugging
    // e.printStackTrace()
    
    // Return non-zero to indicate failure
    return 1
}

return 0
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
    code: `import groovy.json.JsonSlurper
import groovy.json.JsonOutput

def jsonSlurper = new JsonSlurper()

// Parse JSON string
def jsonString = '{"name": "test", "values": [1, 2, 3]}'
def data = jsonSlurper.parseText(jsonString)

// Access fields
def name = data.name
def firstValue = data.values[0]

// Iterate arrays
data.values.each { value ->
    println "Value: \${value}"
}

// Convert back to JSON string
def outputJson = JsonOutput.toJson(data)
def prettyJson = JsonOutput.prettyPrint(outputJson)
`,
  },
  {
    id: 'pattern-credential-retrieval',
    name: 'Credential Retrieval',
    description: 'Retrieve credentials with multiple fallback patterns',
    language: 'groovy',
    category: 'pattern',
    tags: ['credentials', 'security', 'authentication', 'fallback'],
    isBuiltIn: true,
    code: `// Production credential retrieval with multiple fallbacks
// Pattern: instance -> host property -> config property -> collector setting -> default

import com.santaba.agent.util.Settings

/**
 * Get credential with fallback chain
 */
def getCredential(hostProps, instanceProps, primaryProp, fallbackProp = null, defaultValue = "") {
    return instanceProps?.get(primaryProp) ?:
           hostProps.get(primaryProp) ?:
           (fallbackProp ? hostProps.get(fallbackProp) : null) ?:
           defaultValue
}

// SSH credentials with fallbacks
def sshUser = getCredential(hostProps, instanceProps, "ssh.user", "config.user", "admin")
def sshPass = getCredential(hostProps, instanceProps, "ssh.pass", "config.pass", "")
def sshPort = getCredential(hostProps, instanceProps, "ssh.port", "config.port", "22")

// SSH key authentication
def sshKey = hostProps.get("ssh.cert") ?: hostProps.get("ssh.publickey") ?: ""
def sshKeyPass = hostProps.get("ssh.cert.pass") ?: hostProps.get("ssh.publickey.pass") ?: ""

// SNMP credentials
def community = hostProps.get("snmp.community") ?: "public"
def snmpVersion = hostProps.get("snmp.version") ?: "v2c"
def snmpPort = hostProps.get("snmp.port")?.toInteger() ?: 161

// API credentials with standard LM patterns
def apiId = hostProps.get("lmaccess.id") ?: hostProps.get("logicmonitor.access.id")
def apiKey = hostProps.get("lmaccess.key") ?: hostProps.get("logicmonitor.access.key")

// Enable/escalation passwords
def enablePass = hostProps.get("ssh.enable.pass") ?: hostProps.get("config.enable.pass") ?: ""
`,
  },
  {
    id: 'pattern-debug-logging',
    name: 'Debug Logging',
    description: 'Production-quality debug output pattern used in LogicMonitor modules',
    language: 'groovy',
    category: 'pattern',
    tags: ['debug', 'logging', 'troubleshooting'],
    isBuiltIn: true,
    code: `// Debug flag - set to true for verbose output during development
def debug = false

/**
 * Helper function for conditional debug output
 * Used consistently across all production LM scripts
 */
def LMDebugPrint(message) {
    if (debug) {
        println(message.toString())
    }
}

// Usage examples
LMDebugPrint("Starting script execution")
LMDebugPrint("Hostname: \${hostProps.get('system.hostname')}")

// With multi-line messages
LMDebugPrint("""Configuration:
    Host: \${host}
    Port: \${port}
    Timeout: \${timeout}ms
""")

// Logging data structures
LMDebugPrint("Results: \${results}")

// In try/catch blocks
try {
    LMDebugPrint("Attempting connection...")
    // Your code here
    LMDebugPrint("Connection successful")
} catch (Exception e) {
    LMDebugPrint("Error occurred: \${e.message}")
    // Always log errors regardless of debug flag
    println "Error: \${e.message}"
}
`,
  },
  
  // New Pattern: LMv1 API Authentication
  {
    id: 'pattern-lmv1-auth',
    name: 'LMv1 API Authentication',
    description: 'Generate HMAC-SHA256 signature for LogicMonitor API calls',
    language: 'groovy',
    category: 'pattern',
    tags: ['api', 'authentication', 'lmv1', 'hmac', 'signature'],
    isBuiltIn: true,
    code: `import org.apache.commons.codec.binary.Hex
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Generate LMv1 API authentication header
 * 
 * @param id - API Access ID
 * @param key - API Access Key  
 * @param httpMethod - HTTP method (GET, POST, PUT, DELETE)
 * @param path - API endpoint path (e.g., "/device/devices")
 * @param data - Request body (for POST/PUT, empty string for GET)
 * @return Authorization header value
 */
static String generateLMv1Auth(String id, String key, String httpMethod, String path, String data = "") {
    Long epochTime = System.currentTimeMillis()
    
    // Create signature string: HTTP_METHOD + EPOCH + DATA + PATH
    String signatureString = httpMethod.toUpperCase() + epochTime + data + path
    
    // Generate HMAC-SHA256 signature
    Mac hmac = Mac.getInstance("HmacSHA256")
    hmac.init(new SecretKeySpec(key.getBytes(), "HmacSHA256"))
    byte[] signatureBytes = hmac.doFinal(signatureString.getBytes())
    
    // Base64 encode the hex-encoded signature
    String signature = Hex.encodeHexString(signatureBytes).bytes.encodeBase64().toString()
    
    return "LMv1 \${id}:\${signature}:\${epochTime}"
}

// Usage example
def apiId = hostProps.get("lmaccess.id")
def apiKey = hostProps.get("lmaccess.key")

def auth = generateLMv1Auth(apiId, apiKey, "GET", "/device/devices")
// Add to request: request.addRequestProperty("Authorization", auth)
`,
  },
  
  // New Pattern: Proxy Settings
  {
    id: 'pattern-proxy-settings',
    name: 'Proxy Settings Retrieval',
    description: 'Get proxy configuration from device and collector settings',
    language: 'groovy',
    category: 'pattern',
    tags: ['proxy', 'network', 'settings', 'collector'],
    isBuiltIn: true,
    code: `import com.santaba.agent.util.Settings

/**
 * Get collector proxy settings
 * Checks both device-level and collector-level proxy configuration
 * 
 * @return Map with proxy settings (enabled, host, port, user, pass, proxy object)
 */
Map getProxyInfo() {
    // Device-level proxy setting (defaults to true if not set)
    Boolean deviceProxy = hostProps.get("proxy.enable")?.toBoolean()
    deviceProxy = (deviceProxy != null) ? deviceProxy : true
    
    // Collector-level proxy setting (defaults to false if not set)
    Boolean collectorProxy = Settings.getSetting("proxy.enable")?.toBoolean()
    collectorProxy = (collectorProxy != null) ? collectorProxy : false

    Map proxyInfo = [enabled: false]

    // Both device and collector must allow proxy
    if (deviceProxy && collectorProxy) {
        proxyInfo = [
            enabled: true,
            host: hostProps.get("proxy.host") ?: Settings.getSetting("proxy.host"),
            port: hostProps.get("proxy.port") ?: Settings.getSetting("proxy.port") ?: 3128,
            user: Settings.getSetting("proxy.user"),
            pass: Settings.getSetting("proxy.pass")
        ]
        
        // Create Java Proxy object for URL connections
        proxyInfo["proxy"] = new Proxy(
            Proxy.Type.HTTP, 
            new InetSocketAddress(proxyInfo.host, proxyInfo.port.toInteger())
        )
    }

    return proxyInfo
}

// Usage
Map proxyInfo = getProxyInfo()

if (proxyInfo.enabled) {
    println "Using proxy: \${proxyInfo.host}:\${proxyInfo.port}"
    def connection = url.toURL().openConnection(proxyInfo.proxy)
} else {
    def connection = url.toURL().openConnection()
}
`,
  },
  
  // New Pattern: Paginated API Calls
  {
    id: 'pattern-paginated-api',
    name: 'Paginated API Calls',
    description: 'Handle paginated API responses with automatic page fetching',
    language: 'groovy',
    category: 'pattern',
    tags: ['api', 'pagination', 'rest'],
    isBuiltIn: true,
    code: `import groovy.json.JsonSlurper

/**
 * Fetch all items from a paginated API endpoint
 * 
 * @param baseUrl - Base URL for API
 * @param endpoint - API endpoint path
 * @param headers - Request headers map
 * @param pageSize - Items per page (default 1000)
 * @return List of all items across all pages
 */
List fetchAllPaginated(String baseUrl, String endpoint, Map headers, int pageSize = 1000) {
    List allItems = []
    int offset = 0
    def jsonSlurper = new JsonSlurper()
    
    while (true) {
        // Build URL with pagination params
        def url = "\${baseUrl}\${endpoint}?size=\${pageSize}&offset=\${offset}"
        
        def connection = url.toURL().openConnection()
        connection.setRequestMethod("GET")
        headers.each { k, v -> connection.addRequestProperty(k, v) }
        
        def response = jsonSlurper.parseText(connection.content.text)
        
        // Check for API errors
        if (response.get("errmsg", "OK") != "OK") {
            throw new Exception("API Error: \${response.errmsg}")
        }
        
        // Add items from this page
        def items = response.items ?: response.data ?: []
        allItems.addAll(items)
        
        // Check if we've received all items
        // (received less than requested = last page)
        if (items.size() < pageSize) {
            break
        }
        
        offset += pageSize
    }
    
    return allItems
}

// Usage example
def headers = [
    "Authorization": "Bearer \${apiKey}",
    "Content-Type": "application/json"
]

def allDevices = fetchAllPaginated("https://api.example.com", "/devices", headers)
println "Total devices: \${allDevices.size()}"
`,
  },
  
  // New Pattern: Concurrent SNMP Operations
  {
    id: 'pattern-concurrent-snmp',
    name: 'Concurrent SNMP Operations',
    description: 'Thread pool with locks for parallel SNMP GET operations',
    language: 'groovy',
    category: 'pattern',
    tags: ['snmp', 'concurrent', 'threading', 'performance'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.snmp.Snmp
import com.santaba.agent.util.Settings
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock

def host = hostProps.get("system.hostname")
Map props = hostProps.toProperties().collectEntries { k, v -> [(k.toLowerCase()): v] }

// Configure thread pool size (bounded between 1-30)
def poolSize = Math.max(Math.min(
    (hostProps.get("interface.poolsize") ?: "20").toInteger(), 30), 1)

def timeout = Settings.getSettingInt("collector.batchscript.timeout", 120) * 1000
def timerStart = System.currentTimeMillis()

// OIDs to collect and known interface indices
Map oids = ['InOctets': '1.3.6.1.2.1.31.1.1.1.6', 'OutOctets': '1.3.6.1.2.1.31.1.1.1.10']
List indices = ['1', '2', '3', '4', '5']  // From discovery

// Thread-safe results map
Map dataMap = [:]
def lock = new ReentrantLock()
def threadPool = Executors.newFixedThreadPool(poolSize)

try {
    // Submit SNMP GET tasks for each OID/index combination
    oids.each { metric, oid ->
        indices.each { index ->
            threadPool.submit {
                def oidToGet = "\${oid}.\${index}"
                def result = null
                
                // Retry logic with timeout awareness
                def retries = 0
                while (retries < 5 && result == null) {
                    def remainingTime = Math.max(0, timeout - (System.currentTimeMillis() - timerStart)).intValue()
                    if (remainingTime == 0) break
                    
                    try {
                        result = Snmp.get(host, oidToGet, props, Math.min(remainingTime, 1500))
                    } catch (IOException e) {
                        retries++
                        Thread.sleep(25)
                    }
                }
                
                // Thread-safe update of results
                lock.lock()
                try {
                    if (!dataMap[metric]) dataMap[metric] = [:]
                    dataMap[metric][index] = result
                } finally {
                    lock.unlock()
                }
            }
        }
    }
} finally {
    // Graceful shutdown
    threadPool.shutdown()
    def remainingTime = timeout - (System.currentTimeMillis() - timerStart) - 2000
    threadPool.awaitTermination(remainingTime, TimeUnit.MILLISECONDS)
    threadPool.shutdownNow()
}

// Output results
dataMap.each { metric, values ->
    values.each { index, value ->
        println "\${index}.\${metric}=\${value ?: 0}"
    }
}
`,
  },
  
  // New Pattern: SNMP Retry Logic
  {
    id: 'pattern-snmp-retry',
    name: 'SNMP Retry Logic',
    description: 'Retry SNMP operations with timeout awareness',
    language: 'groovy',
    category: 'pattern',
    tags: ['snmp', 'retry', 'timeout', 'resilience'],
    isBuiltIn: true,
    code: `import com.santaba.agent.groovyapi.snmp.Snmp
import com.santaba.agent.util.Settings

def host = hostProps.get("system.hostname")
Map props = hostProps.toProperties().collectEntries { k, v -> [(k.toLowerCase()): v] }

def timeoutStart = System.currentTimeMillis()
def timeout = Settings.getSettingInt("collector.script.timeout", 120) * 1000
timeout -= 2500 // Buffer for cleanup

/**
 * SNMP GET with retry logic and timeout management
 */
def snmpGetWithRetry(hostname, oid, props, timeout, timeoutStart, maxRetries = 5) {
    def retries = 0
    while (retries < maxRetries) {
        retries++
        
        // Calculate remaining time
        def remainingTime = Math.max(0, timeout - (System.currentTimeMillis() - timeoutStart)).intValue()
        if (remainingTime == 0) break
        
        // Cap individual request timeout
        remainingTime = Math.min(remainingTime, 1500)
        
        try {
            return Snmp.get(hostname, oid, props, remainingTime)
        } catch (IOException e) {
            // Silently retry on timeout
            Thread.sleep(25)
        }
    }
    return null  // Return null if all retries failed
}

/**
 * SNMP WALK with retry logic
 */
def snmpWalkWithRetry(hostname, oid, props, timeout, timeoutStart, maxRetries = 5) {
    def retries = 0
    while (retries < maxRetries) {
        def remainingTime = Math.max(0, timeout - (System.currentTimeMillis() - timeoutStart)).intValue()
        if (remainingTime == 0) throw new Exception("Timeout waiting on SNMP Walk")
        
        retries++
        try {
            def response = Snmp.walkAsMap(hostname, oid, props, remainingTime)
            if (response != null) return response
        } catch (IOException e) {
            Thread.sleep(25)
        }
    }
    throw new Exception("SNMP walk failed after \${maxRetries} retries")
}

// Usage
def sysDescr = snmpGetWithRetry(host, "1.3.6.1.2.1.1.1.0", props, timeout, timeoutStart)
def ifTable = snmpWalkWithRetry(host, "1.3.6.1.2.1.2.2.1.2", props, timeout, timeoutStart)
`,
  },
  
  // New Pattern: Timeout Management
  {
    id: 'pattern-timeout-management',
    name: 'Timeout Management',
    description: 'Calculate and manage script timeouts from collector settings',
    language: 'groovy',
    category: 'pattern',
    tags: ['timeout', 'settings', 'collector', 'time'],
    isBuiltIn: true,
    code: `import com.santaba.agent.util.Settings

// Record script start time
def scriptStartTime = System.currentTimeMillis()

// Get timeout from collector settings with fallbacks
// Different script types have different timeout settings

// For standard collection scripts
def collectionTimeout = Settings.getSettingInt("collector.script.timeout", 120) * 1000

// For batch collection scripts  
def batchTimeout = Settings.getSettingInt("collector.batchscript.timeout",
                   Settings.getSettingInt("collector.script.timeout", 120)) * 1000

// For discovery scripts
def discoveryTimeout = Settings.getSettingInt("discover.script.timeoutInSec", 300) * 1000

// For config collection scripts
def configTimeout = Settings.getSettingInt("configcollector.script.timeout", 300) * 1000

// Always reserve buffer time for cleanup (2.5-5 seconds)
def timeout = collectionTimeout - 2500

/**
 * Calculate remaining time for operations
 */
def getRemainingTime(startTime, totalTimeout) {
    return Math.max(0, totalTimeout - (System.currentTimeMillis() - startTime)).intValue()
}

/**
 * Check if we're running out of time
 */
def isTimedOut(startTime, totalTimeout) {
    return getRemainingTime(startTime, totalTimeout) == 0
}

// Usage in loops
while (!isTimedOut(scriptStartTime, timeout)) {
    def remaining = getRemainingTime(scriptStartTime, timeout)
    // Use 'remaining' for operation timeout
    
    // ... do work ...
    
    if (isTimedOut(scriptStartTime, timeout)) {
        println "Script timeout reached"
        break
    }
}
`,
  },
  
  // New Pattern: Device Keep-Alive
  {
    id: 'pattern-keepalive',
    name: 'Device Keep-Alive',
    description: 'Flag device as alive using LiveHostSet for API-collected resources',
    language: 'groovy',
    category: 'pattern',
    tags: ['keepalive', 'device', 'api', 'livehost'],
    isBuiltIn: true,
    code: `import com.santaba.agent.live.LiveHostSet

/**
 * Flag device as alive in the collector's live host tracking
 * 
 * Use this when collecting data via API calls rather than direct
 * device polling. Without this, the collector may mark the device
 * as dead since it never directly communicates with it.
 */
def keepAlive(hostProps) {
    def hostId = hostProps.get("system.deviceId").toInteger()
    def liveHostSet = LiveHostSet.getInstance()
    liveHostSet.flag(hostId)
}

// Usage at end of successful collection
try {
    // ... collection logic ...
    
    // If we get here, collection was successful
    // Flag the device as alive
    keepAlive(hostProps)
    
} catch (Exception e) {
    println "Error: \${e.message}"
    return 1
}

return 0
`,
  },
  
  // New Pattern: Property Normalization
  {
    id: 'pattern-property-normalize',
    name: 'Property Normalization',
    description: 'Case-insensitive property access for consistent lookups',
    language: 'groovy',
    category: 'pattern',
    tags: ['properties', 'normalize', 'case-insensitive'],
    isBuiltIn: true,
    code: `/**
 * Normalize host properties for case-insensitive access
 * 
 * This pattern is used in production scripts to avoid issues
 * with inconsistent property name casing (e.g., "system.sysOid" vs "system.sysoid")
 */
Map props = hostProps.toProperties().collectEntries { k, v -> 
    [(k.toLowerCase()): v] 
}

// Now access properties case-insensitively
def sysoid = props.get("system.sysoid")
def ifMode = props.getOrDefault("interface.mode", 
             props.getOrDefault("auto.interface.mode", "64")).toInteger()
def snmpMethod = props.get("interface.snmp.method")

// With default values
def timeout = props.getOrDefault("script.timeout", "120").toInteger()

// Check for property existence
if (props.containsKey("custom.setting")) {
    // Property exists
}

// Useful for device-specific behavior based on sysoid
Map devicePreferences = [
    "1.3.6.1.4.1.2636.1.1.1.2.43": "getconcurrent",  // Juniper
    "1.3.6.1.4.1.9.12.3.1.3.1354": "getconcurrent"   // Cisco
]

def method = devicePreferences.getOrDefault(sysoid, "walk")
`,
  },
  
  // New Pattern: AD Output Formatting
  {
    id: 'pattern-ad-output-format',
    name: 'AD Output Formatting',
    description: 'Proper Active Discovery output with sanitization and ILP encoding',
    language: 'groovy',
    category: 'pattern',
    tags: ['discovery', 'ad', 'output', 'format', 'ilp'],
    isBuiltIn: true,
    code: `/**
 * Active Discovery Output Format
 * 
 * Full format: wildvalue##wildalias##description####ilp1=val1&ilp2=val2
 * Minimum:     wildvalue##wildalias
 * 
 * ILP names should be prefixed with "auto." for auto-properties
 */

/**
 * Sanitize string for instance output
 * Removes/replaces characters that break parsing
 */
def sanitize(str) {
    str?.toString()
        ?.trim()
        ?.replaceAll(/\\s+/, " ")    // Collapse whitespace to single space
        ?.replaceAll(/#/, "")        // Remove hash marks (breaks parsing)
        ?.replaceAll(/\\r?\\n/, " ") // Remove newlines
}

/**
 * URL-encode string for ILP values
 * Required to handle special characters in property values
 */
def encode(str) {
    str?.toString()
        ?.replaceAll(/\\+/, "%2B")   // Encode plus signs
        ?.replaceAll(/=/, "%3D")    // Encode equals
        ?.replaceAll(/&/, "%26")    // Encode ampersand
}

/**
 * Output a discovered instance with properties
 */
def outputInstance(wildvalue, wildalias, description = "", Map ilps = [:]) {
    def output = "\${sanitize(wildvalue)}##\${sanitize(wildalias)}"
    
    if (description) {
        output += "##\${sanitize(description)}"
    }
    
    if (ilps) {
        def ilpPairs = ilps.collect { k, v ->
            // Prefix with auto. if not already prefixed
            def key = k.startsWith("auto.") ? k : "auto.\${k}"
            "\${key}=\${encode(sanitize(v))}"
        }
        output += "####\${ilpPairs.join('&')}"
    }
    
    println output
}

// Usage examples

// Simple instance
outputInstance("eth0", "Ethernet 0")

// With description
outputInstance("eth0", "Ethernet 0", "Primary network interface")

// With auto-properties
outputInstance("eth0", "Ethernet 0", "Primary interface", [
    "mac": "00:11:22:33:44:55",
    "speed": "1000000000",
    "type": "ethernetCsmacd"
])

// Output: eth0##Ethernet 0##Primary interface####auto.mac=00:11:22:33:44:55&auto.speed=1000000000&auto.type=ethernetCsmacd
`,
  },
  
  // New Pattern: ILP Encoding
  {
    id: 'pattern-ilp-encoding',
    name: 'ILP URL Encoding',
    description: 'Sanitize and URL-encode instance-level properties',
    language: 'groovy',
    category: 'pattern',
    tags: ['ilp', 'encoding', 'url', 'sanitize', 'properties'],
    isBuiltIn: true,
    code: `/**
 * Instance-Level Property (ILP) encoding utilities
 * 
 * ILPs are appended to AD output after #### separator
 * Format: auto.prop1=value1&auto.prop2=value2
 * 
 * Special characters must be URL-encoded to prevent parsing issues
 */

/**
 * Sanitize a field value for ILP output
 */
def sanitize(str) {
    str?.toString()
        ?.trim()
        ?.replaceAll(/\\s+/, " ")
        ?.replaceAll(/#/, "")
}

/**
 * URL-encode a field for ILP values
 * Handles the most common problematic characters
 */
def encode(str) {
    str?.toString()
        ?.replaceAll(/\\+/, "%2B")   // Plus sign
        ?.replaceAll(/=/, "%3D")    // Equals sign
        ?.replaceAll(/&/, "%26")    // Ampersand
}

/**
 * Full URL encoding using Java's URLEncoder
 * Use this for values that may contain any special characters
 */
def fullEncode(str) {
    URLEncoder.encode(str?.toString() ?: "", "UTF-8")
}

/**
 * Build ILP string from a map of properties
 */
def buildIlpString(Map properties) {
    properties.collect { key, value ->
        // Ensure key starts with auto.
        def ilpKey = key.startsWith("auto.") ? key : "auto.\${key}"
        "\${ilpKey}=\${encode(sanitize(value))}"
    }.join("&")
}

// Usage
def ilps = [
    "description": "Server #1 - Primary",   // Has # and spaces
    "path": "/opt/app/bin",                 // Has slashes  
    "params": "key=value&other=123"         // Has = and &
]

def ilpString = buildIlpString(ilps)
// Output: auto.description=Server 1 - Primary&auto.path=/opt/app/bin&auto.params=key%3Dvalue%26other%3D123

// In AD output
println "server1##Server 1##Primary server####\${ilpString}"
`,
  },
  
  // New Pattern: Resource Cleanup
  {
    id: 'pattern-finally-cleanup',
    name: 'Resource Cleanup',
    description: 'Proper try/finally pattern for closing connections and resources',
    language: 'groovy',
    category: 'pattern',
    tags: ['cleanup', 'finally', 'resources', 'connections'],
    isBuiltIn: true,
    code: `/**
 * Resource Cleanup Pattern
 * 
 * Always use try/finally to ensure resources are properly closed,
 * even when exceptions occur. This prevents resource leaks.
 */

// Example 1: SSH Connection
def ssh = null
try {
    ssh = Expect.open(host, port, user, pass)
    ssh.expect("#")
    // ... do work ...
    
} catch (Exception e) {
    println "Error: \${e.message}"
    return 1
} finally {
    // Always attempt cleanup
    try {
        if (ssh) {
            ssh.send("exit\\n")
            ssh.expectClose()
        }
    } catch (Exception e) {
        // Log but don't fail on cleanup errors
        LMDebugPrint("Cleanup error: \${e.message}")
    }
}

// Example 2: Multiple Resources
def client = null
def session = null  
def shell = null

try {
    client = new SSHClient()
    client.connect(host, port)
    client.auth(user, types)
    
    session = client.startSession()
    shell = session.startShell()
    
    // ... do work ...
    
} catch (Exception e) {
    println "Error: \${e.message}"
    return 1
} finally {
    // Close in reverse order of creation
    try { shell?.close() } catch (Exception e) { /* ignore */ }
    try { session?.close() } catch (Exception e) { /* ignore */ }
    try { client?.disconnect() } catch (Exception e) { /* ignore */ }
}

// Example 3: Thread Pool
def threadPool = Executors.newFixedThreadPool(10)
try {
    // Submit tasks
    // ... 
} finally {
    threadPool.shutdown()
    threadPool.awaitTermination(30, TimeUnit.SECONDS)
    threadPool.shutdownNow()
}

return 0
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

# Credentials (use here-strings for passwords with special chars)
$wmiUser = @'
##WMI.USER##
'@
$wmiPass = @'
##WMI.PASS##
'@
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
  
  // New PowerShell Pattern: Token Validation
  {
    id: 'pattern-ps-token-validation',
    name: 'Token Validation',
    description: 'Check if property tokens were properly substituted',
    language: 'powershell',
    category: 'pattern',
    tags: ['tokens', 'validation', 'properties'],
    isBuiltIn: true,
    code: `# Property tokens that weren't set remain as ##PROPERTY.NAME##
# Use regex to detect unsubstituted tokens

$hostname = "##SYSTEM.HOSTNAME##"
$customProp = "##CUSTOM.PROPERTY##"

# Check if token was NOT substituted (still has ## wrapper)
if ($customProp -match "^##.*##$") {
    # Property was not set - use default or skip
    $customProp = "default_value"
}

# Alternative: Check if token IS valid (was substituted)
if ($hostname -notmatch "^##.*##$" -and $hostname -ne "") {
    # Property was properly set
    Write-Host "Hostname: $hostname"
} else {
    Write-Host "Error: hostname property not set"
    Exit 1
}

# Common pattern for optional properties with fallback
$domain = if ('##SYSTEM.DOMAIN##' -match "^##.*##$" -or 
              '##SYSTEM.DOMAIN##' -eq "" -or 
              '##SYSTEM.DOMAIN##' -eq $null) { 
    $null 
} else { 
    '##SYSTEM.DOMAIN##' 
}

# Validate required credentials
$username = '##API.USER##'
$password = '##API.PASS##'

if ($username -match "^##.*##$" -or $password -match "^##.*##$") {
    Write-Host "Error: API credentials not configured"
    Exit 1
}
`,
  },
  
  // New PowerShell Pattern: Hostname Resolution
  {
    id: 'pattern-ps-hostname-resolution',
    name: 'Hostname Resolution',
    description: 'Resolve IP addresses to FQDN with fallback handling',
    language: 'powershell',
    category: 'pattern',
    tags: ['hostname', 'dns', 'resolution', 'fqdn'],
    isBuiltIn: true,
    code: `# Hostname resolution with multiple fallbacks
# Some APIs require FQDN instead of IP address

$hostname = '##SYSTEM.HOSTNAME##'

# Check if hostname is an IP address
if ($hostname -match "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b") {
    try {
        # Resolve IP to FQDN via reverse DNS
        $hostname = [System.Net.Dns]::GetHostbyAddress($hostname).HostName
    } catch {
        # DNS resolution failed - keep original IP
        Write-Host "Warning: Could not resolve $hostname to FQDN"
    }
}
# Check if it's a valid FQDN (contains at least two dots)
elseif ($hostname -notmatch "\\b[\\w-]+\\.[\\w-]+\\.[\\w-]+\\b") {
    # Not a fully qualified name - try custom property or system hostname
    $altHostname = '##CUSTOM.HOSTNAME##'
    if ($altHostname -notmatch "^##.*##$" -and $altHostname -ne "") {
        $hostname = $altHostname
    }
}

# Final validation
if (-not $hostname -or $hostname -match "^##.*##$") {
    Write-Host "Error: Could not determine valid hostname"
    Exit 1
}

Write-Host "Using hostname: $hostname"
`,
  },
  
  // New PowerShell Pattern: Credential Here-String
  {
    id: 'pattern-ps-credential-herestring',
    name: 'Credential Here-String',
    description: 'Safe credential handling with here-strings for special characters',
    language: 'powershell',
    category: 'pattern',
    tags: ['credentials', 'password', 'here-string', 'special-characters'],
    isBuiltIn: true,
    code: `# Here-strings preserve special characters in passwords
# Use @' ... '@ for literal strings (no variable expansion)
# Use @" ... "@ if you need variable expansion

# Literal here-string - safest for passwords
$password = @'
##API.PASS##
'@

# Double-quoted here-string - allows variables
$username = @"
##API.USER##
"@

# Why use here-strings?
# Passwords may contain special chars: dollar, backtick, quotes, backslash
# Regular strings can have issues with special character interpretation
# Here-strings preserve the literal value exactly as written

# Building credentials
if ($username -and $password -and 
    $username -notmatch "^##.*##$" -and 
    $password -notmatch "^##.*##$") {
    
    $securePass = ConvertTo-SecureString $password -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential(
        $username, 
        $securePass
    )
    
    # Use credential with commands
    $wmiParams = @{
        ComputerName = $hostname
        Credential = $credential
    }
} else {
    # No credentials - use current context
    $wmiParams = @{
        ComputerName = $hostname
    }
}

# Alternative: Build credentials inline
$cred = New-Object PSCredential -ArgumentList @(
    $username,
    (ConvertTo-SecureString -String $password -AsPlainText -Force)
)
`,
  },
];
