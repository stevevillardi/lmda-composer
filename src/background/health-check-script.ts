/**
 * Collector Health Check Script
 * This is a Groovy script that runs on the collector and outputs structured JSON
 * for display in the Health Check Report UI.
 */

import { setHealthCheckScript } from './debug-api';

// The Groovy script that collects health data and outputs JSON
const HEALTH_CHECK_GROOVY_SCRIPT = `
// Collector Health Check Script - JSON Output Version
// This script includes a preamble to get hostProps from CollectorDb

// Imports
import groovy.json.JsonOutput
import java.text.SimpleDateFormat
import java.util.concurrent.TimeUnit
import com.santaba.agent.debugger.TlistTask
import com.santaba.agent.debugger.SPListTask
import com.santaba.agent.debugger.AdlistTask
import com.santaba.agent.debugger.TplistTask
import com.santaba.agent.debugger.AplistTask
import com.santaba.agent.debugger.NetflowTask
import com.santaba.agent.debugger.WindowsCmdTask
import com.santaba.agent.debugger.LinuxCmdTask
import com.santaba.agent.collector3.CollectorDb

// ----- Preamble: Get hostProps from CollectorDb -----
// This mimics the standard script execution context by looking up the collector device
def hostProps = [:]
def instanceProps = [:]
def taskProps = ["pollinterval": "180"]

// First, get the local hostname
def localHostName = ''
try {
    localHostName = java.net.InetAddress.getLocalHost().getHostName()
} catch (e) {
    localHostName = System.getenv('COMPUTERNAME') ?: System.getenv('HOSTNAME') ?: ''
}

// Try to get hostProps from CollectorDb using the local hostname
try {
    def collectorDb = CollectorDb.getInstance()
    def host = collectorDb.getHost(localHostName)
    if (host != null) {
        hostProps = host.getProperties()
    }
} catch (e) {
    // If CollectorDb fails, hostProps stays empty and we'll use file-based fallbacks
}

// Controls
def showOKonly = false
def tasksRunHigherThanMs = 0
def listAmount = 50
def listAmount_logs = 50

// Regex patterns
def regexCollector = ~/\\S+\\s+\\d+\\s+(\\S+).*/
def regexHostname = ~/\\S+\\s+\\d+\\s+\\S+\\s+\\S+\\s+(\\S+).*/
def regexDatasource = ~/\\S+\\s+\\d+\\s+\\S+\\s+\\S+\\s+\\S+\\s+(.*?)(-|\\s\\s\\s)/
def regexLastExecute = ~/(\\d+)(?=\\s+\\|\\|)/
def regexCollectionType = ~/\\S+\\s+(.*?)\\s+/
def regexOK = ~/\\|\\| OK/
def regexHasNan = ~/\\|\\| Has NaN/
def regexDoublePipe = ~/\\|\\|/
def regexResults = ~/\\|\\|\\s*(.*)$/

// Get collector install directory
def installDir = System.getProperty('user.dir')
def isWindows = System.getProperty('os.name')?.toLowerCase()?.contains('windows')

// ----- Get collector info from hostProps (primary) or files (fallback) -----
// Initialize variables - we'll populate from hostProps first, then override from files
def hostName = hostProps.get('system.hostname') ?: localHostName
def deviceId = hostProps.get('system.deviceId') ?: ''
def displayName = hostProps.get('system.displayname') ?: ''
def collectorDesc = hostProps.get('system.collectordesc') ?: ''
def collectorOS = hostProps.get('system.collectorplatform') ?: (isWindows ? 'windows' : 'linux')
def collectorID = hostProps.get('system.collectorID') ?: ''
def totalPhysicalMem = hostProps.get('system.totalphysicalmemory') ?: ''
def collectorVersion = hostProps.get('system.collectorversion') ?: ''
def company = ''
def collectorConfigs = [:]

// Note: When running via !groovy debug command, hostProps may be empty
// We'll read from config files below to fill in missing values

// Read agent.conf for additional info (collector ID, company, configs)
// The original script uses relative path ../conf/agent.conf from the agent dir
def agentConfFile = new File('../conf/agent.conf')
def regexCollectorID = /^id=(\\d+)$/
def regexCompany = /^company=(.*)$/
def regexThreadpool = /^(collector\\..*)\\.threadpool=(\\d+)$/
def regexCollectorTimeout = /^(collector\\..*)\\.timeout=(\\d+)$/

try {
    if (agentConfFile.exists()) {
        agentConfFile.eachLine { line ->
            // Parse collector ID: format is "id=76" - always override if found (hostProps may be empty)
            def matcherID = (line =~ regexCollectorID)
            if (matcherID.find()) {
                collectorID = matcherID[0][1]
            }
            // Parse company: format is "company=lmstevenvillardi"
            def matcherCompany = (line =~ regexCompany)
            if (matcherCompany.find()) {
                company = matcherCompany[0][1]
            }
            // Parse threadpool settings
            def matcherThreadpool = (line =~ regexThreadpool)
            if (matcherThreadpool.find()) {
                def key = matcherThreadpool[0][1]
                def value = matcherThreadpool[0][2]
                if (!collectorConfigs[key]) {
                    collectorConfigs[key] = [threadpool: null, timeout: null]
                }
                collectorConfigs[key].threadpool = value as Integer
            }
            // Parse timeout settings
            def matcherTimeout = (line =~ regexCollectorTimeout)
            if (matcherTimeout.find()) {
                def key = matcherTimeout[0][1]
                def value = matcherTimeout[0][2]
                if (!collectorConfigs[key]) {
                    collectorConfigs[key] = [threadpool: null, timeout: null]
                }
                collectorConfigs[key].timeout = value as Integer
            }
        }
    }
} catch (e) {}

// Read wrapper.conf for description (using relative path like original, lines 1204-1217)
def wrapperConfFile = new File('../conf/wrapper.conf')
try {
    if (wrapperConfFile.exists()) {
        wrapperConfFile.eachLine { line ->
            if (line.contains('wrapper.console.title=')) {
                def title = line.split('=', 2)[1]?.trim() ?: ''
                if (!collectorDesc) collectorDesc = title
                if (!displayName) displayName = title
            }
        }
    }
} catch (e) {}

// Get physical memory if not in hostProps
if (!totalPhysicalMem) {
    try {
        def os = java.lang.management.ManagementFactory.getOperatingSystemMXBean()
        if (os.hasProperty('totalPhysicalMemorySize')) {
            def totalMem = os.totalPhysicalMemorySize
            totalPhysicalMem = String.format('%.2fGB', totalMem / (1024.0 * 1024 * 1024))
        }
    } catch (e) {}
}

// Fallback: Get physical memory if not in hostProps
if (!totalPhysicalMem) {
    try {
        def os = java.lang.management.ManagementFactory.getOperatingSystemMXBean()
        if (os.hasProperty('totalPhysicalMemorySize')) {
            def totalMem = os.totalPhysicalMemorySize
            totalPhysicalMem = String.format('%.2fGB', totalMem / (1024.0 * 1024 * 1024))
        }
    } catch (e) {}
}

// Ensure displayName has a value
if (!displayName) displayName = collectorDesc ?: hostName

// Initialize data structures
def collectionTimes = []
def collectionLines = []
def tlistSummaryLines = []
def tplistLines = []
def adlistLines = []
def splistLines = []
def aplistLines = []
def netscanLines = []
def taskListLines = []
def collectionTypes = new LinkedHashSet<String>()
def messages_tlist = new LinkedHashMap<String,Integer>()
def messages_adlist = new LinkedHashMap<String,Integer>()
def messages_tplist = new LinkedHashMap<String,Integer>()
def uniqueExecution = new HashSet()
def hostStats = []
def excessiveInstances = []
def totalFailCount = 0
def lastHostname = null
def lastDatasource = null

// Times
def startDate = new Date()

// ----- Helper function to run debug task -----
def runTask = { task ->
    task.run()
    task.awaitFinish()
    return task.output ?: ''
}

// ----- Data Collection -----

// Run !tlist summary=true to get collection types
def tlistSummaryTask = new TlistTask('!tlist summary=true')
def tlistSummaryOutput = runTask(tlistSummaryTask)
tlistSummaryOutput.eachLine { line ->
    tlistSummaryLines << line
    if (line =~ /(^.*Source)\\s+/) {
        def matcher = (line =~ regexCollectionType)
        if (matcher) {
            collectionTypes.add(matcher[0][1])
        }
    }
}

def failingThreads = [:]

// Process each collection type
collectionTypes.eachWithIndex { type, idx ->
    def tempCollection = new StringBuilder()
    tempCollection.append("!tlist c=\${type}\\n")
    int totalThreadCount = 0
    int threadInstanceCount = 0
    boolean hasThreads = false
    
    def tlistTask = new TlistTask("!tlist c=\${type}")
    def output = runTask(tlistTask)
    
    output.eachLine { line ->
        // Filter based on showOKonly
        def isOKLine = (line =~ regexOK || line =~ regexHasNan)
        if (showOKonly) {
            if (!isOKLine) return
        } else {
            if (isOKLine) return
        }
        
        if (line =~ regexDoublePipe) {
            def collectorMatch = (line =~ regexCollector)
            def hostnameMatch = (line =~ regexHostname)
            def datasourceMatch = (line =~ regexDatasource)
            def lastExecuteMatch = (line =~ regexLastExecute)
            
            if (!(collectorMatch && hostnameMatch && datasourceMatch && lastExecuteMatch)) return
            
            def match = [
                collector: collectorMatch[0][1],
                hostname: hostnameMatch[0][1],
                datasource: datasourceMatch[0][1],
                lastExecute: lastExecuteMatch[0][1] as Integer
            ]
            
            // Capture results
            def resultsMatch = (line =~ regexResults)
            if (resultsMatch && resultsMatch[0][1]) {
                def resultText = resultsMatch[0][1].trim().replaceAll(/\\s+/, ' ')
                if (!resultText) resultText = 'unknown'
                messages_tlist[resultText] = (messages_tlist[resultText] ?: 0) + 1
            }
            
            // Track execution times
            def executionEntry = "\${match.lastExecute} \${match.collector} \${match.hostname} \${match.datasource}"
            if (match.lastExecute >= tasksRunHigherThanMs && uniqueExecution.add(executionEntry)) {
                collectionTimes << executionEntry
            }
            
            // Check for new thread
            boolean newThread = (lastHostname != match.hostname) || (lastDatasource != match.datasource)
            
            if (newThread) {
                // Check for excessive instances on previous thread
                if (threadInstanceCount > 1 && lastHostname && lastDatasource) {
                    excessiveInstances << [device: lastHostname, module: lastDatasource, count: threadInstanceCount]
                }
                
                totalThreadCount++
                totalFailCount++
                hasThreads = true
                threadInstanceCount = 1
                tempCollection.append("\\nThread \${totalThreadCount}: \${match.hostname} - \${match.datasource}\\n")
                tempCollection.append("\\t\${line}\\n")
            } else {
                threadInstanceCount++
            }
            
            lastHostname = match.hostname
            lastDatasource = match.datasource
        }
    }
    
    // Capture final thread's instances
    if (threadInstanceCount > 1 && lastHostname && lastDatasource) {
        excessiveInstances << [device: lastHostname, module: lastDatasource, count: threadInstanceCount]
    }
    
    if (hasThreads) {
        collectionLines << tempCollection.toString()
        failingThreads[idx] = "\${type} \${totalThreadCount}"
    }
    
    // Reset for next type
    lastHostname = null
    lastDatasource = null
}

collectionTypes.eachWithIndex { type, idx ->
    // Count threads from collectionLines
    def count = 0
    collectionLines.each { output ->
        if (output.startsWith("!tlist c=\${type}")) {
            output.eachLine { line ->
                if (line =~ /^Thread \\d+:/) count++
            }
        }
    }
    if (count > 0) {
        failingThreads[idx] = "\${type} \${count}"
    }
}

// Run !tlist summary=host
def tlistHostTask = new TlistTask('!tlist summary=host')
def hostOutput = runTask(tlistHostTask)
def hostMatcher = ~/([\\w\\.\\-]+)\\s+(\\d+)\\s+(\\d+)/
hostOutput.eachLine { line ->
    def m = line =~ hostMatcher
    if (m.find()) {
        hostStats << [host: m.group(1), data: m.group(2) as Integer, event: m.group(3) as Integer]
    }
}

// Run !splist
def splistTask = new SPListTask('!splist')
def splistOutput = runTask(splistTask)
splistOutput.eachLine { line ->
    if (line =~ /.*Executing.*/ || line =~ /^====/ || line =~ /^id\\b/ || line =~ /^Total\\b/) return
    if (!(line =~ /^\\d/)) return
    def isOK = (line =~ /\\bDONE\\b/)
    if (showOKonly) {
        if (isOK) splistLines << line
    } else {
        if (!isOK) splistLines << line
    }
}

// Run !adlist
def adlistCmd = showOKonly ? '!adlist' : '!adlist status=failed'
def adlistTask = new AdlistTask(adlistCmd)
def adlistOutput = runTask(adlistTask)
adlistOutput.eachLine { line ->
    if (line =~ /^\\d+/) {
        def isOk = line.contains('OK')
        if (showOKonly) {
            if (isOk) adlistLines << line
        } else {
            if (!isOk) adlistLines << line
        }
        // Extract message
        def parts = line.trim().split(/\\s{2,}/)
        if (parts.size() >= 9) {
            def msg = parts[-1]
            if (msg && msg != '-') {
                messages_adlist[msg] = (messages_adlist[msg] ?: 0) + 1
            }
        }
    }
}

// Run !tplist
def tplistCmd = showOKonly ? '!tplist' : '!tplist status=failed'
def tplistTask = new TplistTask(tplistCmd)
def tplistOutput = runTask(tplistTask)
tplistOutput.eachLine { line ->
    if (line =~ /^\\d+/) {
        def isOk = line.contains('OK')
        if (showOKonly) {
            if (isOk) tplistLines << line
        } else {
            if (!isOk) tplistLines << line
        }
        def parts = line.trim().split(/\\s{2,}/)
        if (parts.size() >= 6) {
            def msg = parts[-1]
            if (msg && msg != '-' && msg.length() > 10) {
                messages_tplist[msg] = (messages_tplist[msg] ?: 0) + 1
            }
        }
    }
}

// Run !aplist
def aplistTask = new AplistTask('!aplist')
def aplistOutput = runTask(aplistTask)
aplistOutput.eachLine { line ->
    if (line =~ /^\\d+/) {
        aplistLines << line
    }
}

// Run !netflow to list devices
def netflowTask = new NetflowTask('!netflow func=listDevices')
def netflowOutput = runTask(netflowTask)
netflowOutput.eachLine { line ->
    // Only capture lines that start with a device ID (number)
    if (line.trim() && line =~ /^\\d+\\s+/) {
        netscanLines << line
    }
}

// Run !tasklist - try Windows first, then Linux (matching original script lines 1159-1188)
def capture = false
def headerPattern = ~/^Image Name.*/

try {
    def debugWin = new WindowsCmdTask('!tasklist')
    def winOutput = runTask(debugWin)
    
    winOutput.eachLine { line ->
        // When we find the header, start capturing
        if (!capture && (line ==~ headerPattern)) {
            capture = true
        }
        // Collect all lines after the header (and the header itself)
        if (capture) {
            taskListLines << line
        }
    }
} catch (e) {}

// If Windows task returns nothing, try Linux
if (taskListLines.isEmpty()) {
    try {
        def debugLin = new LinuxCmdTask('!tasklist')
        def linOutput = runTask(debugLin)
        linOutput.eachLine { line ->
            taskListLines << line
        }
    } catch (e) {}
}

// Determine collector size
def javaMaxMemory = Runtime.getRuntime().maxMemory()
def javaMaxMemoryMB = (int)(javaMaxMemory / (1024 * 1024))
def javaMaxMemoryGiB = String.format('%.1f GiB', javaMaxMemory / (1024.0 * 1024 * 1024))
def collectorSize = 'Unknown'
if (javaMaxMemoryMB <= 1100) collectorSize = 'Small'
else if (javaMaxMemoryMB <= 2200) collectorSize = 'Medium'
else if (javaMaxMemoryMB <= 4400) collectorSize = 'Large'
else if (javaMaxMemoryMB <= 8800) collectorSize = 'XL'
else collectorSize = 'XXL'

// Read logs using relative paths like original script
def wrapperLog = []
def sbproxyLog = []
def watchdogLog = []
try {
    def wrapperLogFile = new File('../logs/wrapper.log')
    def sbproxyLogFile = new File('../logs/sbproxy.log')
    def watchdogLogFile = new File('../logs/watchdog.log')
    
    if (wrapperLogFile.exists()) {
        def lines = wrapperLogFile.readLines()
        wrapperLog = lines.size() > listAmount_logs ? lines[-listAmount_logs..-1] : lines
    }
    if (sbproxyLogFile.exists()) {
        def lines = sbproxyLogFile.readLines()
        sbproxyLog = lines.size() > listAmount_logs ? lines[-listAmount_logs..-1] : lines
    }
    if (watchdogLogFile.exists()) {
        def lines = watchdogLogFile.readLines()
        watchdogLog = lines.size() > listAmount_logs ? lines[-listAmount_logs..-1] : lines
    }
} catch (e) {}

// Calculate total instances from tlist summary
def totalInstances = 0
def suggestedCollectors = [M: 0, L: 0, XL: 0, XXL: 0]
def totalMatcher = ~/Total (\\d+), Chosen (\\d+)/
tlistSummaryLines.each { line ->
    def m = line =~ totalMatcher
    if (m.find()) {
        totalInstances = m.group(1) as Integer
        suggestedCollectors.M = (int) Math.ceil(totalInstances / 12500.0)
        suggestedCollectors.L = (int) Math.ceil(totalInstances / 25000.0)
        suggestedCollectors.XL = (int) Math.ceil(totalInstances / 35000.0)
        suggestedCollectors.XXL = (int) Math.ceil(totalInstances / 40000.0)
    }
}

// Parse collection summary
def collectionSummary = failingThreads.collect { k, v ->
    def parts = (v ?: '').toString().tokenize(' ')
    def type = parts.size() >= 2 ? parts[0..-2].join(' ') : ''
    def count = parts.size() >= 2 ? (parts[-1] as int) : 0
    [type: type, threads: count]
}.findAll { it.threads > 0 }.sort { -it.threads }

// Parse top modules
def topModules = []
def dsCounts = [:].withDefault { 0 }
collectionLines.each { output ->
    output.eachLine { line ->
        def matcher = line =~ /Thread\\s+\\d+:\\s+([^\\s]+)\\s+-\\s+(.+)/
        if (matcher.find()) {
            def ds = matcher.group(2).trim()
            dsCounts[ds]++
        }
    }
}
topModules = dsCounts.sort { -it.value }.take(listAmount).collect { [module: it.key, deviceCount: it.value] }

// Sort and limit excessive instances
excessiveInstances = excessiveInstances.findAll { it.count > 1 }.sort { -it.count }.take(listAmount)

// Parse long running times
def longRunning = collectionTimes.collect { entry ->
    def parts = entry.tokenize(' ')
    if (parts.size() >= 4) {
        [timeMs: parts[0] as Integer, type: parts[1], device: parts[2], module: parts[3..-1].join(' ')]
    } else { null }
}.findAll { it != null }.sort { -it.timeMs }.take(listAmount)

// Parse tlist summary lines
def tlistSummary = []
def summaryMatcher = ~/(\\w+)\\s+([\\w\\.\\-]+)\\s+(\\d+)\\s+(\\d+)/
tlistSummaryLines.each { line ->
    def m = line =~ summaryMatcher
    if (m.find()) {
        def total = m.group(3) as Integer
        def interval = m.group(4) as Integer
        def rps = interval > 0 ? total / interval : 0
        tlistSummary << [type: m.group(1), collector: m.group(2), total: total, interval: interval, rps: rps]
    }
}

// Parse agent config
def agentConfig = collectorConfigs.collect { k, v ->
    [param: k.replaceFirst(/^collector\\./, ''), threadpool: v.threadpool, timeout: v.timeout]
}.sort { it.param }

// Parse host stats
def hostStatsFormatted = hostStats.sort { b, a -> a.data <=> b.data ?: a.event <=> b.event }
    .take(listAmount).collect { [host: it.host, dataTask: it.data as int, eventTask: it.event as int] }

// Parse processes from tasklist (matching original script logic lines 752-796)
def processes = []
def processEntries = []

taskListLines.each { line ->
    if (!line) return
    def t = line.trim()
    // Skip headers or separators
    if (t.isEmpty() || t.startsWith('=') || t.startsWith('Image Name')) return
    
    // Windows format parsing using regex like original
    def m = line =~ /^(.{25,30})\\s+(\\d+)\\s+(.{0,20}?)\\s+(\\d+)\\s+([\\d,]+\\s*K)\$/
    if (m.matches()) {
        def image = m[0][1].trim()
        def pid = m[0][2].trim()
        def sessionName = m[0][3].trim()
        def sessionNum = m[0][4].trim()
        def memUsageStr = m[0][5].replaceAll(/[^\\d]/, '')
        def memUsage = memUsageStr ? memUsageStr.toInteger() : 0
        
        processEntries << [
            name: image,
            pid: pid,
            sessionName: sessionName,
            sessionNum: sessionNum,
            memUsageKB: memUsage
        ]
    } else if (!isWindows) {
        // Linux format
        def parts = line.trim().split(/\\s+/, 5)
        if (parts.size() >= 5) {
            processEntries << [pid: parts[0], tty: parts[1], stat: parts[2], time: parts[3], command: parts[4]]
        }
    }
}

// Sort Windows by memory usage descending and take top entries
if (isWindows) {
    processes = processEntries.sort { -it.memUsageKB }.take(listAmount)
} else {
    processes = processEntries.take(listAmount)
}

// Parse adlist
def parseAdlist = { lines ->
    lines.take(listAmount).collect { line ->
        def parts = line.trim().split(/\\s{2,}/)
        if (parts.size() >= 7) {
            [id: parts[0], lastUpdate: parts.size() > 1 ? parts[1] : '', method: parts.size() > 2 ? parts[2] : '',
             status: parts.size() > 3 ? parts[3] : '', waitExec: parts.size() > 4 ? parts[4] : '',
             execTime: parts.size() > 5 ? (parts[5] ==~ /\\d+/ ? parts[5] as Integer : 0) : 0,
             hostname: parts.size() > 6 ? parts[6] : '', datasource: parts.size() > 7 ? parts[7] : '',
             message: parts.size() > 8 ? parts[8] : '']
        } else { null }
    }.findAll { it != null }
}

def parseSplist = { lines ->
    lines.take(listAmount).collect { line ->
        def parts = line.trim().split(/\\s{2,}/)
        if (parts.size() >= 5) {
            [id: parts[0], ruleId: parts.size() > 1 ? parts[1] : '', hostname: parts.size() > 2 ? parts[2] : '',
             execId: parts.size() > 3 ? parts[3] : '', status: parts.size() > 4 ? parts[4] : '',
             elapsed: parts.size() > 5 ? (parts[5] ==~ /\\d+/ ? parts[5] as Integer : 0) : 0,
             propertySource: parts.size() > 6 ? parts[6] : '']
        } else { null }
    }.findAll { it != null }
}

def parseTplist = { lines ->
    lines.take(listAmount).collect { line ->
        def parts = line.trim().split(/\\s{2,}/)
        if (parts.size() >= 5) {
            // tplist format: ID LastUpdate Method Status Wait/Exec Hostname DataSource Message
            [id: parts[0], lastUpdate: parts.size() > 1 ? parts[1] : '', method: parts.size() > 2 ? parts[2] : '',
             status: parts.size() > 3 ? parts[3] : '', waitExec: parts.size() > 4 ? parts[4] : '',
             execTime: 0, hostname: parts.size() > 5 ? parts[5] : '', datasource: parts.size() > 6 ? parts[6] : '',
             message: parts.size() > 7 ? parts[7] : '']
        } else { null }
    }.findAll { it != null }
}

def parseAplist = { lines ->
    lines.take(listAmount).collect { line ->
        def parts = line.trim().split(/\\s+/)
        if (parts.size() >= 6) {
            def we = parts[4].split('/')
            def waitMs = we.size() > 0 && we[0] ==~ /\\d+/ ? we[0] as Integer : 0
            def execMs = we.size() > 1 && we[1] ==~ /\\d+/ ? we[1] as Integer : 0
            [id: parts[0], pid: parts[1], status: parts[2], type: parts[3],
             waitExec: parts[4], waitMs: waitMs, execMs: execMs, host: parts[5],
             message: parts.size() > 6 ? parts[6..-1].join(' ') : '']
        } else { null }
    }.findAll { it != null }
}

// Parse netflow
def netflowDevices = netscanLines.take(listAmount).collect { raw ->
    def parts = raw.trim().split(/\\s{2,}/) as List<String>
    [id: parts.size() > 0 ? parts[0] : '', name: parts.size() > 1 ? parts[1] : '',
     interfaceIdx: parts.size() >= 4 ? parts[2] : null, ips: parts.size() >= 4 ? parts[3] : (parts.size() == 3 ? parts[2] : '')]
}

// Portal links
def portalLinks = null
if (company && collectorID) {
    def baseUrl = "https://\${company}.logicmonitor.com"
    portalLinks = [
        configuration: "\${baseUrl}/santaba/uiv4/settings/collectors/collectorConfiguration?id=\${collectorID}",
        events: "\${baseUrl}/santaba/uiv4/settings/collectors/collectorEvents?id=\${collectorID}",
        logLevels: "\${baseUrl}/santaba/uiv4/settings/collectors/collectorLogsForm/\${collectorID}",
        status: "\${baseUrl}/santaba/uiv4/settings/collectors/collectorStatus?id=\${collectorID}"
    ]
}

// AppliesTo queries
def appliesToQueries = [
    [label: 'Devices on this collector', query: "system.collectorid == \\"\${collectorID}\\""],
    [label: 'Devices not updated in 3 days', query: "system.collectorid == \\"\${collectorID}\\" && system.resourceUpdatedOn <= \\"\${(long)(System.currentTimeMillis()/1000 - 3*24*60*60)}\\""],
    [label: 'Dead devices', query: "system.collectorid == \\"\${collectorID}\\" && system.hoststatus =~ \\"dead\\""],
    [label: 'Standard device count', query: "system.collectorid == \\"\${collectorID}\\" && system.devicetype == \\"0\\""]
]

// Calculate completion time
def endDate = new Date()
def durationSeconds = (endDate.time - startDate.time) / 1000.0

// Default config reference
def defaultConfig = [
    [param: 'collector.batchscript', timeout: 120, threadpools: [20, 20, 20, 40, 80]],
    [param: 'collector.esx', timeout: 30, threadpools: [50, 50, 50, 50, 50]],
    [param: 'collector.jdbc', timeout: 10, threadpools: [50, 50, 50, 50, 50]],
    [param: 'collector.jmx', timeout: 5, threadpools: [200, 200, 200, 200, 200]],
    [param: 'collector.perfmon', timeout: 120, threadpools: [10, 10, 10, 10, 10]],
    [param: 'collector.ping', timeout: 50, threadpools: [5, 10, 20, 40, 80]],
    [param: 'collector.script', timeout: 120, threadpools: [100, 200, 300, 400, 600]],
    [param: 'collector.snmp', timeout: 120, threadpools: [50, 50, 50, 50, 50]],
    [param: 'collector.webpage', timeout: 30, threadpools: [10, 10, 10, 10, 10]],
    [param: 'collector.wmi', timeout: 50, threadpools: [5, 10, 20, 40, 80]]
]

// Capacity limits
def capacityLimits = [
    currentSize: collectorSize,
    sizes: ['Small', 'Medium', 'Large', 'XL', 'XXL'],
    cpu: ['1 CPU', '2 CPUs', '4 CPUs', '8 CPUs', '16 CPUs'],
    systemMemory: ['2 GiB', '4 GiB', '8 GiB', '16 GiB', '32 GiB'],
    jvmMemory: ['1 GiB', '2 GiB', '4 GiB', '8 GiB', '16 GiB'],
    protocols: [
        [name: 'SNMPv2', limits: ['300/15000/76', '1000/50000/256', '4000/200000/1024', '8000/400000/2048', '15000/750000/3840']],
        [name: 'SNMPv3', limits: ['855/42750/220', '1087/54350/278', '1520/76000/390', '2660/133000/682', '4180/209000/1074']],
        [name: 'HTTP', limits: ['320/16000/160', '1400/70000/735', '2400/120000/1260', '4500/225000/2000', '7500/375000/3740']],
        [name: 'WMI', limits: ['211/10550/77', '287/14350/102', '760/38000/272', '1140/57000/409', '1330/66500/433']],
        [name: 'BatchScript', limits: ['94/4700/5', '124/6200/7', '180/9000/11', '295/14750/17', '540/27000/32']],
        [name: 'Perfmon', limits: ['200/10000/87', '400/20000/173', '800/40000/347', 'TBA', 'TBA']],
        [name: 'JMX', limits: ['1000/50000/416', '2500/125000/1041', '5000/250000/2083', 'TBA', 'TBA']]
    ]
]

// Top messages
def topMessages = [
    tlist: messages_tlist.entrySet().sort { a, b -> b.value <=> a.value }.take(listAmount).collect { [message: it.key, count: it.value] },
    adlist: messages_adlist.entrySet().sort { a, b -> b.value <=> a.value }.take(listAmount).collect { [message: it.key, count: it.value] },
    tplist: messages_tplist.entrySet().sort { a, b -> b.value <=> a.value }.take(listAmount).collect { [message: it.key, count: it.value] }
]

// Calculate task summary counts
def tlistCount = failingThreads.collect { k, v ->
    def p = (v ?: '').toString().tokenize(' ')
    (p.size() >= 2 ? p[-1] as int : 0)
}.sum() ?: 0

// Build result object
def result = [
    meta: [
        completedAt: new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ").format(endDate),
        debugRunSeconds: Math.round(durationSeconds * 100) / 100.0,
        showOKonly: showOKonly
    ],
    collectorInfo: [
        id: collectorID,
        hostname: hostName,
        displayName: displayName,
        description: collectorDesc,
        version: collectorVersion,
        platform: collectorOS,
        size: collectorSize,
        jvmMemoryMB: javaMaxMemoryMB,
        jvmMemory: javaMaxMemoryGiB,
        physicalMemory: totalPhysicalMem,
        company: company,
        portalLinks: portalLinks
    ],
    collectionSummary: collectionSummary,
    taskSummary: [
        tlist: tlistCount,
        adlist: adlistLines.size(),
        splist: splistLines.size(),
        tplist: tplistLines.size(),
        aplist: aplistLines.size()
    ],
    totalInstances: totalInstances,
    suggestedCollectors: suggestedCollectors,
    topModules: topModules,
    excessiveInstances: excessiveInstances,
    longRunning: longRunning,
    topMessages: topMessages,
    capacityLimits: capacityLimits,
    defaultConfig: defaultConfig,
    tlistSummary: tlistSummary,
    agentConfig: agentConfig,
    hostStats: hostStatsFormatted,
    processes: processes,
    netflowDevices: netflowDevices,
    aplist: parseAplist(aplistLines),
    splist: parseSplist(splistLines),
    adlist: parseAdlist(adlistLines),
    tplist: parseTplist(tplistLines),
    appliesToQueries: appliesToQueries,
    logs: [
        wrapper: wrapperLog,
        sbproxy: sbproxyLog,
        watchdog: watchdogLog
    ]
]

// Output as JSON
println JsonOutput.toJson(result)
return 0
`;

// Export the script for use in debug-api.ts
export function initializeHealthCheckScript(): void {
  setHealthCheckScript(HEALTH_CHECK_GROOVY_SCRIPT);
}

// Immediately initialize when this module is loaded
initializeHealthCheckScript();
