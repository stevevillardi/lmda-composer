/**
 * Collector Health Check Script
 * 
 * This Groovy script runs on a collector and outputs structured JSON
 * containing comprehensive health and diagnostic information.
 */

export const HEALTH_CHECK_SCRIPT = `
import groovy.json.JsonOutput
import java.text.SimpleDateFormat
import java.util.concurrent.TimeUnit
import com.santaba.agent.debugger.TlistTask
import com.santaba.agent.debugger.SPListTask
import com.santaba.agent.debugger.AdlistTask
import com.santaba.agent.debugger.TplistTask
import com.santaba.agent.debugger.AplistTask
import com.santaba.agent.debugger.WindowsCmdTask
import com.santaba.agent.debugger.LinuxCmdTask
import com.santaba.agent.debugger.NetflowTask

// Controls
def showOKonly = false
def tasksRunHigherThanMs = 0
def listAmount = 50
def listAmount_logs = 30

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

// Retrieve hostProps
def hostName = hostProps.get('system.hostname') ?: ''
def deviceId = hostProps.get('system.deviceId') ?: ''
def displayName = hostProps.get('system.displayname') ?: ''
def collectorDesc = hostProps.get('system.collectordesc') ?: ''
def collectorOS = hostProps.get('system.collectorplatform') ?: ''
def collectorID = hostProps.get('system.collectorID') ?: ''
def totalPhysicalMem = hostProps.get('system.totalphysicalmemory') ?: ''
def collectorVersion = hostProps.get('system.collectorversion') ?: ''

// Initialize collections
def collectionTimes = []
def collectionLines = []
def tlistSummaryData = []
def taskListData = []
def tplistData = []
def adlistData = []
def splistData = []
def aplistData = []
def netflowData = []
def collectorConfigs = [:]
def failingThreads = [:]
def collectionTypes = new LinkedHashSet<String>()
def messages_tlist = new LinkedHashMap<String,Integer>()
def messages_adlist = new LinkedHashMap<String,Integer>()
def messages_tplist = new LinkedHashMap<String,Integer>()
def uniqueExecution = new HashSet()
def hostStats = []
def tlistDetails = []

// Times
def startDate = new Date()
def threeDaysAgo = startDate - 3
def sevenDaysAgo = startDate - 7
def fourteenDaysAgo = startDate - 14
def nowEpoch = TimeUnit.MILLISECONDS.toSeconds(startDate.time)
def threeEpoch = TimeUnit.MILLISECONDS.toSeconds(threeDaysAgo.time)
def sevenEpoch = TimeUnit.MILLISECONDS.toSeconds(sevenDaysAgo.time)
def fourteenEpoch = TimeUnit.MILLISECONDS.toSeconds(fourteenDaysAgo.time)

// Process !tlist summary=host
TlistTask tlistHostTask = new TlistTask('!tlist summary=host')
tlistHostTask.run()
tlistHostTask.awaitFinish()
tlistHostTask.output.eachLine { line, count ->
    def s = line.trim()
    if (!s) return
    if (s.startsWith('version=') || s.startsWith('hostname') || s ==~ /^=+\$/) return
    def cols = s.split(/\\s{2,}/)
    if (cols.size() >= 3) {
        def host = cols[0]
        def data = (cols[1] as Integer)
        def event = (cols[2] as Integer)
        hostStats << [host: host, dataTask: data, eventTask: event]
    }
}

// Process !tlist summary=true
TlistTask tlistSummaryTask = new TlistTask('!tlist summary=true')
tlistSummaryTask.run()
tlistSummaryTask.awaitFinish()
def totalInstances = 0
def suggestedCollectors = [:]
tlistSummaryTask.output.eachLine { line, count ->
    def summaryMatcher = ~/(\\w+)\\s+([\\w\\.\\-]+)\\s+(\\d+)\\s+(\\d+)/
    def totalMatcher = ~/Total (\\d+), Chosen (\\d+)/
    def matcher = (line =~ summaryMatcher)
    if (matcher.find()) {
        def type = matcher[0][1]
        def collector = matcher[0][2]
        def total = matcher[0][3].toInteger()
        def interval = matcher[0][4].toInteger()
        def rps = interval > 0 ? (total / interval).round(2) : 0
        tlistSummaryData << [type: type, collector: collector, total: total, interval: interval, rps: rps]
        collectionTypes.add(collector)
    }
    def totalMatch = (line =~ totalMatcher)
    if (totalMatch.find()) {
        totalInstances = totalMatch.group(1).toInteger()
        suggestedCollectors = [
            M: Math.ceil(totalInstances / 12500.0).toInteger(),
            L: Math.ceil(totalInstances / 25000.0).toInteger(),
            XL: Math.ceil(totalInstances / 35000.0).toInteger(),
            XXL: Math.ceil(totalInstances / 40000.0).toInteger()
        ]
    }
}

// Process each collection type for failing threads
def lastHostname = null
def lastDatasource = null
def topModulesMap = [:].withDefault { 0 }
def excessiveInstances = []

collectionTypes.eachWithIndex { type, idx ->
    def threadCount = 0
    def methodThreads = []
    def currentThread = null
    def threadInstanceCount = 0
    
    TlistTask tlistTask = new TlistTask("!tlist c=\${type}")
    tlistTask.run()
    tlistTask.awaitFinish()
    
    tlistTask.output.eachLine { line, count ->
        def isOKLine = (line =~ regexOK || line =~ regexHasNan)
        if (showOKonly) {
            if (!isOKLine) return
        } else {
            if (isOKLine) return
        }
        
        if (line =~ regexDoublePipe) {
            if (line.contains("||") && !line.matches("^id\\\\s.*") && line.trim().endsWith("||")) {
                line += " unknown"
            }
            
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
                def resultText = resultsMatch[0][1].trim().replaceAll(/\\s+/, " ")
                if (!resultText) resultText = "unknown"
                messages_tlist[resultText] = (messages_tlist[resultText] ?: 0) + 1
            }
            
            // Track execution times
            def executionEntry = "\${match.lastExecute} \${match.collector} \${match.hostname} \${match.datasource}"
            if (match.lastExecute >= tasksRunHigherThanMs && uniqueExecution.add(executionEntry)) {
                collectionTimes << [
                    timeMs: match.lastExecute,
                    type: match.collector,
                    device: match.hostname,
                    module: match.datasource
                ]
            }
            
            // Detect new thread
            boolean newThread = (['ping', 'wmi', 'snmp', 'perfmon', 'jdbc', 'jmx',
                 'webpage', 'openmetrics', 'dns', 'esx', 'xen', 'udp', 'tcp']
                    .any { match.collector?.contains(it) }
            ) || (lastHostname != match.hostname) || (lastDatasource != match.datasource)
            
            if (newThread) {
                if (currentThread && threadInstanceCount > 1) {
                    currentThread.additionalInstances = threadInstanceCount - 1
                    if (threadInstanceCount > 10) {
                        excessiveInstances << [
                            device: currentThread.device,
                            module: currentThread.module,
                            count: threadInstanceCount
                        ]
                    }
                }
                
                threadCount++
                topModulesMap[match.datasource]++
                
                currentThread = [
                    device: match.hostname,
                    module: match.datasource,
                    type: match.collector,
                    lastExecuteMs: match.lastExecute,
                    additionalInstances: 0
                ]
                methodThreads << currentThread
                threadInstanceCount = 1
            } else {
                threadInstanceCount++
            }
            
            lastHostname = match.hostname
            lastDatasource = match.datasource
        }
    }
    
    // Close last thread
    if (currentThread && threadInstanceCount > 1) {
        currentThread.additionalInstances = threadInstanceCount - 1
        if (threadInstanceCount > 10) {
            excessiveInstances << [
                device: currentThread.device,
                module: currentThread.module,
                count: threadInstanceCount
            ]
        }
    }
    
    if (threadCount > 0) {
        failingThreads[type] = threadCount
        tlistDetails << [method: type, threadCount: threadCount, threads: methodThreads.take(listAmount)]
    }
}

// Process !splist
SPListTask spListTask = new SPListTask('!splist')
spListTask.run()
spListTask.awaitFinish()
spListTask.output.eachLine { line, count ->
    if (line =~ /.*Executing.*/ || line =~ /^====/ || line =~ /^id\\b/ || line =~ /^Total\\b/) return
    if (!(line =~ /^\\d/)) return
    def isOK = (line =~ /\\bDONE\\b/)
    if (showOKonly && !isOK) return
    if (!showOKonly && isOK) return
    
    def parts = line.tokenize()
    if (parts.size() >= 7) {
        splistData << [
            id: parts[0],
            ruleId: parts[1],
            hostname: parts[2],
            execId: parts[3],
            status: parts[4],
            elapsed: parts[5].isInteger() ? parts[5] as Integer : 0,
            propertySource: parts[6]
        ]
    }
}

// Process !adlist
def adlistCmd = showOKonly ? '!adlist' : '!adlist status=failed'
AdlistTask adListTask = new AdlistTask(adlistCmd)
adListTask.run()
adListTask.awaitFinish()
adListTask.output.eachLine { line, count ->
    if (line =~ /^\\d+/) {
        def isOk = line.contains("OK")
        if ((showOKonly && isOk) || (!showOKonly && !isOk)) {
            def cols = line.trim().split(/\\s{2,}/)
            if (cols.size() >= 7) {
                def msg = cols.size() > 7 ? cols[7]?.trim() : ""
                if (!msg) msg = "unknown"
                msg = msg.replaceAll(/\\s+/, " ")
                messages_adlist[msg] = (messages_adlist[msg] ?: 0) + 1
                
                def waitExec = cols[4] ?: "0/0"
                def execTime = (waitExec.split('/',2)[1] ?: "0") as int
                
                adlistData << [
                    id: cols[0],
                    lastUpdate: cols[1],
                    method: cols[2],
                    status: cols[3],
                    waitExec: waitExec,
                    execTime: execTime,
                    hostname: cols[5],
                    datasource: cols[6],
                    message: msg
                ]
            }
        }
    }
}

// Process !tplist
def tplistCmd = showOKonly ? '!tplist' : '!tplist status=failed'
TplistTask tpListTask = new TplistTask(tplistCmd)
tpListTask.run()
tpListTask.awaitFinish()
tpListTask.output.eachLine { line, count ->
    if (line =~ /^\\d/) {
        def isOk = (line.contains(" OK ") || line.contains(" OK(") || (line =~ /\\bOK\\b/))
        if ((showOKonly && isOk) || (!showOKonly && !isOk)) {
            def parts = line.tokenize()
            if (parts.size() >= 8) {
                def waitExecParts = parts[5].split("/")
                def execTime = waitExecParts.size() > 1 ? waitExecParts[1].toInteger() : 0
                def message = parts.size() > 8 ? parts[8..-1].join(" ") : ""
                
                messages_tplist[message] = (messages_tplist[message] ?: 0) + 1
                
                tplistData << [
                    id: parts[0],
                    lastUpdate: parts[1] + " " + parts[2],
                    method: parts[3],
                    status: parts[4],
                    waitExec: parts[5],
                    execTime: execTime,
                    hostname: parts[6],
                    datasource: parts[7],
                    message: message
                ]
            }
        }
    }
}

// Process !aplist
def aplistCmd = showOKonly ? '!aplist status=done' : '!aplist status=failed'
AplistTask aplistTask = new AplistTask(aplistCmd)
aplistTask.run()
aplistTask.awaitFinish()
aplistTask.output.eachLine { line, count ->
    if (line =~ /^\\d+/) {
        def parts = line.trim().split(/\\s+/)
        if (parts.size() >= 6) {
            def we = parts[4].split('/')
            aplistData << [
                id: parts[0],
                pid: parts[1],
                status: parts[2],
                type: parts[3],
                waitExec: parts[4],
                waitMs: (we.size() > 0 && we[0].isInteger()) ? we[0] as Integer : 0,
                execMs: (we.size() > 1 && we[1].isInteger()) ? we[1] as Integer : 0,
                host: parts[5],
                message: parts.size() > 6 ? parts[6..-1].join(' ') : ""
            ]
        }
    }
}

// Process !netflow
NetflowTask netflowTask = new NetflowTask('!netflow func=listdevices')
netflowTask.run()
netflowTask.awaitFinish()
netflowTask.output.eachLine { line, count ->
    if (line =~ /^\\d+/) {
        def parts = line.trim().split(/\\s{2,}/) as List<String>
        def id = parts.size() > 0 ? parts[0] : ""
        def name = parts.size() > 1 ? parts[1] : ""
        def ifIdx = ""
        def ips = ""
        if (parts.size() >= 4) {
            ifIdx = parts[2]
            ips = parts[3]
        } else if (parts.size() == 3) {
            ips = parts[2]
        }
        netflowData << [id: id, name: name, interfaceIdx: ifIdx ?: null, ips: ips]
    }
}

// Process !tasklist
def capture = false
def headerPattern = ~/^Image Name.*/
WindowsCmdTask debugWin = new WindowsCmdTask('!tasklist')
debugWin.run()
debugWin.awaitFinish()

debugWin.output.eachLine { line, count ->
    if (!capture && (line ==~ headerPattern)) {
        capture = true
        return
    }
    if (capture) {
        def t = line.trim()
        if (t.isEmpty() || t.startsWith("=")) return
        
        def m = line =~ /^(.{25,30})\\s+(\\d+)\\s+(.{0,20}?)\\s+(\\d+)\\s+([\\d,]+\\s*K)\$/
        if (m.matches()) {
            def memUsageStr = m[0][5].replaceAll(/[^\\d]/, "")
            taskListData << [
                name: m[0][1].trim(),
                pid: m[0][2].trim(),
                sessionName: m[0][3].trim(),
                sessionNum: m[0][4].trim(),
                memUsageKB: memUsageStr ? memUsageStr.toInteger() : 0
            ]
        }
    }
}

// If Windows empty, try Linux
if (taskListData.isEmpty()) {
    LinuxCmdTask debugLin = new LinuxCmdTask('!tasklist')
    debugLin.run()
    debugLin.awaitFinish()
    debugLin.output.eachLine { line, count ->
        def parts = line.trim().split(/\\s+/)
        if (parts.size() >= 5 && parts[0].isInteger()) {
            taskListData << [
                pid: parts[0],
                tty: parts[1],
                stat: parts[2],
                time: parts[3],
                command: parts[4..-1].join(' '),
                memUsageKB: 0
            ]
        }
    }
}

// Read configuration files
def memoryToSizeMap = [
    "1 GiB": "Small",
    "2 GiB": "Medium",
    "4 GiB": "Large",
    "8 GiB": "XL",
    "16 GiB": "XXL"
]

def wrapperFile = new File("../conf/wrapper.conf")
def javaMaxMemoryGiB = null
def javaMaxMemoryMB = 0
if (wrapperFile.exists()) {
    wrapperFile.eachLine { line ->
        def matcher = (line =~ /(?<=wrapper\\.java\\.maxmemory=)\\d+/)
        if (matcher.find()) {
            javaMaxMemoryMB = matcher[0].toInteger()
            javaMaxMemoryGiB = (javaMaxMemoryMB / 1024).toString() + " GiB"
        }
    }
}
def collectorSize = memoryToSizeMap.get(javaMaxMemoryGiB, "Unknown")

// Read agent.conf
def agentConfigData = []
def company = ""
def configCollectorId = ""
def agentFile = new File("../conf/agent.conf")
if (agentFile.exists()) {
    def configMap = [:].withDefault { [:] }
    agentFile.eachLine { line ->
        def matcherThreadpool = (line =~ /^(collector\\..*)\\threadpool=(\\d+)\$/)
        def matcherTimeout = (line =~ /^(collector\\..*)\\timeout=(\\d+)\$/)
        def matcherCollectorID = (line =~ /^(id)=(\\d+)\$/)
        def matcherCompany = (line =~ /^(company)=(.*)/)
        
        if (matcherThreadpool.find()) {
            def key = matcherThreadpool[0][1].replaceFirst(/^collector\\./, "")
            configMap[key].threadpool = matcherThreadpool[0][2].toInteger()
        } else if (matcherTimeout.find()) {
            def key = matcherTimeout[0][1].replaceFirst(/^collector\\./, "")
            configMap[key].timeout = matcherTimeout[0][2].toInteger()
        } else if (matcherCollectorID.find()) {
            configCollectorId = matcherCollectorID[0][2]
        } else if (matcherCompany.find()) {
            company = matcherCompany[0][2]
        }
    }
    configMap.each { param, vals ->
        agentConfigData << [
            param: param,
            threadpool: vals.threadpool ?: null,
            timeout: vals.timeout ?: null
        ]
    }
}

// Read logs
def readLogTail = { path, maxLines ->
    def file = new File(path)
    if (!file.exists()) return []
    def lines = file.readLines()
    return lines.size() > maxLines ? lines[-maxLines..-1] : lines
}

def wrapperLogs = readLogTail("../logs/wrapper.log", listAmount_logs)
def sbproxyLogs = readLogTail("../logs/sbproxy.log", listAmount_logs)
def watchdogLogs = readLogTail("../logs/watchdog.log", listAmount_logs)

// Calculate timing
def finishDate = new Date()
def debugRunSeconds = ((finishDate.time - startDate.time) / 1000.0).round(3)

// Build top modules list
def topModules = topModulesMap.collect { module, count ->
    [module: module, deviceCount: count]
}.sort { -it.deviceCount }.take(listAmount)

// Build top messages lists
def topMessagesTlist = messages_tlist.collect { msg, count ->
    [message: msg, count: count]
}.sort { -it.count }.take(listAmount)

def topMessagesAdlist = messages_adlist.collect { msg, count ->
    [message: msg, count: count]
}.sort { -it.count }.take(listAmount)

def topMessagesTplist = messages_tplist.collect { msg, count ->
    [message: msg, count: count]
}.sort { -it.count }.take(listAmount)

// Sort collections
collectionTimes = collectionTimes.sort { -it.timeMs }.take(listAmount)
hostStats = hostStats.sort { -(it.dataTask + it.eventTask) }.take(listAmount)
taskListData = taskListData.sort { -it.memUsageKB }.take(listAmount)
excessiveInstances = excessiveInstances.sort { -it.count }.take(listAmount)
splistData = splistData.sort { -it.elapsed }.take(listAmount)
adlistData = adlistData.sort { -it.execTime }.take(listAmount)
tplistData = tplistData.sort { -it.execTime }.take(listAmount)
aplistData = aplistData.sort { -it.execMs }.take(listAmount)

// Build collection summary
def collectionSummary = failingThreads.collect { type, count ->
    [type: type, threads: count]
}.sort { -it.threads }

// Calculate task summary totals
def taskSummary = [
    tlist: failingThreads.values().sum() ?: 0,
    adlist: adlistData.size(),
    splist: splistData.size(),
    tplist: tplistData.size(),
    aplist: aplistData.size()
]

// Capacity limits reference data
def capacityLimits = [
    currentSize: collectorSize,
    sizes: ["Small", "Medium", "Large", "XL", "XXL"],
    cpu: ["1 CPU", "2 CPUs", "4 CPUs", "8 CPUs", "16 CPUs"],
    systemMemory: ["2 GiB", "4 GiB", "8 GiB", "16 GiB", "32 GiB"],
    jvmMemory: ["1 GiB", "2 GiB", "4 GiB", "8 GiB", "16 GiB"],
    protocols: [
        [name: "SNMPv2", limits: ["300/15000/76", "1000/50000/256", "4000/200000/1024", "8000/400000/2048", "15000/750000/3840"]],
        [name: "SNMPv3", limits: ["855/42750/220", "1087/54350/278", "1520/76000/390", "2660/133000/682", "4180/209000/1074"]],
        [name: "HTTP", limits: ["320/16000/160", "1400/70000/735", "2400/120000/1260", "4500/225000/2000", "7500/375000/3740"]],
        [name: "WMI", limits: ["211/10550/77", "287/14350/102", "760/38000/272", "1140/57000/409", "1330/66500/433"]],
        [name: "BatchScript", limits: ["94/4700/5", "124/6200/7", "180/9000/11", "295/14750/17", "540/27000/32"]],
        [name: "Perfmon", limits: ["200/10000/87", "400/20000/173", "800/40000/347", "TBA", "TBA"]],
        [name: "JMX", limits: ["1000/50000/416", "2500/125000/1041", "5000/250000/2083", "TBA", "TBA"]]
    ]
]

// Default threadpool/timeout reference
def defaultConfig = [
    [param: "batchscript", timeout: 120, threadpools: [20, 20, 20, 40, 80]],
    [param: "esx", timeout: 30, threadpools: [50, 50, 50, 50, 50]],
    [param: "jdbc", timeout: 10, threadpools: [50, 50, 50, 50, 50]],
    [param: "jmx", timeout: 5, threadpools: [200, 200, 200, 200, 200]],
    [param: "perfmon", timeout: 120, threadpools: [10, 10, 10, 10, 10]],
    [param: "ping", timeout: 50, threadpools: [5, 10, 20, 40, 80]],
    [param: "wmi", timeout: 50, threadpools: [5, 10, 20, 40, 80]],
    [param: "script", timeout: 120, threadpools: [100, 200, 300, 400, 600]],
    [param: "snmp", timeout: 120, threadpools: [50, 50, 50, 50, 50]],
    [param: "webpage", timeout: 30, threadpools: [10, 10, 10, 10, 10]]
]

// AppliesTo queries
def appliesToQueries = [
    [
        label: "Devices not updated in 3 days",
        query: "(system.collectorid == \\"\${configCollectorId ?: collectorID}\\") && (system.resourceUpdatedOn <= \\"\${threeEpoch}\\")"
    ],
    [
        label: "Devices not updated in 7 days",
        query: "(system.collectorid == \\"\${configCollectorId ?: collectorID}\\") && (system.resourceUpdatedOn <= \\"\${sevenEpoch}\\")"
    ],
    [
        label: "Devices not updated in 14 days",
        query: "(system.collectorid == \\"\${configCollectorId ?: collectorID}\\") && (system.resourceUpdatedOn <= \\"\${fourteenEpoch}\\")"
    ],
    [
        label: "Dead devices (idleInterval)",
        query: "(system.collectorid == \\"\${configCollectorId ?: collectorID}\\") && (system.hoststatus =~ \\"dead\\")"
    ],
    [
        label: "Collector device being double monitored",
        query: "(system.collectorid == \\"\${configCollectorId ?: collectorID}\\") && isCollectorDevice()"
    ]
]

// Collector portal links
def portalLinks = company ? [
    configuration: "https://\${company}.logicmonitor.com/santaba/uiv4/settings/collectors/collectorConfiguration?id=\${configCollectorId ?: collectorID}",
    events: "https://\${company}.logicmonitor.com/santaba/uiv4/settings/collectors/collectorEvents?id=\${configCollectorId ?: collectorID}",
    logLevels: "https://\${company}.logicmonitor.com/santaba/uiv4/settings/collectors/collectorLogsForm/\${configCollectorId ?: collectorID}",
    status: "https://\${company}.logicmonitor.com/santaba/uiv4/settings/collectors/collectorStatus?id=\${configCollectorId ?: collectorID}"
] : null

// Build final results object
def results = [
    meta: [
        completedAt: new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ").format(finishDate),
        debugRunSeconds: debugRunSeconds,
        showOKonly: showOKonly
    ],
    collectorInfo: [
        id: configCollectorId ?: collectorID,
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
    taskSummary: taskSummary,
    totalInstances: totalInstances,
    suggestedCollectors: suggestedCollectors,
    topModules: topModules,
    excessiveInstances: excessiveInstances,
    longRunning: collectionTimes,
    topMessages: [
        tlist: topMessagesTlist,
        adlist: topMessagesAdlist,
        tplist: topMessagesTplist
    ],
    capacityLimits: capacityLimits,
    defaultConfig: defaultConfig,
    tlistSummary: tlistSummaryData,
    agentConfig: agentConfigData.sort { it.param },
    hostStats: hostStats,
    processes: taskListData,
    netflowDevices: netflowData,
    aplist: aplistData,
    splist: splistData,
    adlist: adlistData,
    tplist: tplistData,
    tlistDetails: tlistDetails,
    appliesToQueries: appliesToQueries,
    logs: [
        wrapper: wrapperLogs,
        sbproxy: sbproxyLogs,
        watchdog: watchdogLogs
    ]
]

println JsonOutput.toJson(results)
return 0
`;

