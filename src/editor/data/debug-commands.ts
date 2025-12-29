/**
 * Debug Commands for LogicMonitor Collector Debug Facility
 * 
 * Centralized definitions of all available debug commands that can be executed
 * on collectors via the debug API.
 */

export interface DebugCommandParameter {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}

export interface DebugCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  example: string;
  parameters?: DebugCommandParameter[];
  category: 'discovery' | 'system' | 'network' | 'health' | 'misc' | 'scripting' | 'fileops' | 'diagnostics' | 'windows' | 'query' | 'taskmgmt';
}

export const DEBUG_COMMANDS: DebugCommand[] = [
  // Discovery Commands
  {
    id: 'adlist',
    name: 'List Active Discovery Tasks',
    command: '!adlist',
    description: 'Displays a list of the Collector\'s Active Discovery tasks. A taskID is returned for each task.',
    example: '!adlist type=get',
    parameters: [
      { name: 'type', description: 'Filter type', required: false, example: 'get' },
      { name: 'method', description: 'Filter by method', required: false, example: 'ad_snmp' }
    ],
    category: 'discovery'
  },
  {
    id: 'adetail',
    name: 'Active Discovery Task Detail',
    command: '!adetail',
    description: 'Displays detailed information about a specific Active Discovery task. The taskId can be found with !adlist.',
    example: '!adetail 142',
    parameters: [
      { name: 'taskId', description: 'Task ID from !adlist output (labeled as "id")', required: true, example: '142' }
    ],
    category: 'discovery'
  },
  {
    id: 'tlist',
    name: 'List Data Collection Tasks',
    command: '!tlist',
    description: 'Lists the Collector\'s data collection tasks, including DataSources, ConfigSources, and EventSources. A taskID is returned for each task.',
    example: '!tlist c=wmi',
    parameters: [
      { name: 'h', description: 'Filter by hostname', required: false, example: 'localhost' },
      { name: 'c', description: 'Filter by collection type', required: false, example: 'wmi' },
      { name: 'summary', description: 'Summary mode (collector or true)', required: false, example: 'collector' },
      { name: 'lasttime', description: 'Show tasks from last N minutes', required: false, example: '10' },
      { name: 'columns', description: 'Number of columns in output', required: false, example: '5' }
    ],
    category: 'discovery'
  },
  {
    id: 'tdetail',
    name: 'Data Collection Task Detail',
    command: '!tdetail',
    description: 'Displays detailed information about a specific data collection task. The taskId can be found with !tlist.',
    example: '!tdetail 12323209239991',
    parameters: [
      { name: 'taskId', description: 'Task ID from !tlist output', required: true, example: '12323209239991' }
    ],
    category: 'discovery'
  },
  {
    id: 'apdetail',
    name: 'AutoProps Task Detail',
    command: '!apdetail',
    description: 'Shows detailed information about a specific AutoProps task.',
    example: '!apdetail 5678',
    parameters: [
      { name: 'taskId', description: 'AutoProps task ID from !aplist output', required: true, example: '5678' }
    ],
    category: 'discovery'
  },
  {
    id: 'aplist',
    name: 'List AutoProps Tasks',
    command: '!aplist',
    description: 'Lists all AutoProps tasks running on the collector.',
    example: '!aplist',
    category: 'discovery'
  },
  {
    id: 'nspdetail',
    name: 'NetScan Task Detail',
    command: '!nspdetail',
    description: 'Shows detailed information about a specific NetScan task.',
    example: '!nspdetail 42',
    parameters: [
      { name: 'taskId', description: 'NetScan task ID from !nsplist output', required: true, example: '42' }
    ],
    category: 'discovery'
  },
  {
    id: 'nsplist',
    name: 'List NetScan Tasks',
    command: '!nsplist',
    description: 'Lists all NetScan tasks running on the collector.',
    example: '!nsplist',
    category: 'discovery'
  },
  {
    id: 'spdetail',
    name: 'Script Property Task Detail',
    command: '!spdetail',
    description: 'Shows detailed information about a specific script property task.',
    example: '!spdetail 1200',
    parameters: [
      { name: 'taskId', description: 'Script property task ID from !splist output', required: true, example: '1200' }
    ],
    category: 'discovery'
  },
  {
    id: 'splist',
    name: 'List Script Property Tasks',
    command: '!splist',
    description: 'Lists all script property tasks running on the collector.',
    example: '!splist',
    category: 'discovery'
  },
  {
    id: 'tpdetail',
    name: 'Topology Task Detail',
    command: '!tpdetail',
    description: 'Shows detailed information about a specific topology task.',
    example: '!tpdetail 201',
    parameters: [
      { name: 'taskId', description: 'Topology task ID from !tplist output', required: true, example: '201' }
    ],
    category: 'discovery'
  },
  {
    id: 'tplist',
    name: 'List Topology Tasks',
    command: '!tplist',
    description: 'Lists all topology tasks running on the collector.',
    example: '!tplist',
    category: 'discovery'
  },
  {
    id: 'slist',
    name: 'Task Details from !tlist',
    command: '!slist',
    description: 'Shows task details from !tlist output.',
    example: '!slist 1023',
    parameters: [
      { name: 'taskId', description: 'Task ID from !tlist output', required: true, example: '1023' }
    ],
    category: 'discovery'
  },
  {
    id: 'sdetail',
    name: 'Internal Task Execution',
    command: '!sdetail',
    description: 'Lists internal task execution details.',
    example: '!sdetail',
    category: 'discovery'
  },

  // System Commands
  {
    id: 'account',
    name: 'Account Information',
    command: '!account',
    description: 'Displays the account information used by sbwinproxy.',
    example: '!account',
    category: 'system'
  },
  {
    id: 'uptime',
    name: 'Collector Uptime',
    command: '!uptime',
    description: 'Displays the uptime of the Collector.',
    example: '!uptime',
    category: 'system'
  },
  {
    id: 'restart',
    name: 'Restart Collector Service',
    command: '!restart',
    description: 'Restarts the specified Collector service.',
    example: '!restart watchdog',
    parameters: [
      { name: 'service', description: 'Service to restart (watchdog or collector)', required: true, example: 'watchdog' }
    ],
    category: 'system'
  },
  {
    id: 'hostproperty',
    name: 'Host Property Management',
    command: '!hostproperty',
    description: 'Adds, updates, or deletes system properties for a host.',
    example: '!hostproperty action=add host=localhost property=ips value=127.0.0.1,192.168.1.1',
    parameters: [
      { name: 'action', description: 'Action to perform (add, update, or del)', required: true, example: 'add' },
      { name: 'host', description: 'Hostname', required: true, example: 'localhost' },
      { name: 'property', description: 'Property name', required: true, example: 'ips' },
      { name: 'value', description: 'Property value (required for add/update)', required: false, example: '127.0.0.1,192.168.1.1' }
    ],
    category: 'system'
  },
  {
    id: 'checkcredential',
    name: 'Check Credential Usage',
    command: '!checkcredential',
    description: 'Enables, disables, and checks credential usage on the specified host to determine source of unexpected login action.',
    example: '!checkcredential proto=snmp user=public',
    parameters: [
      { name: 'proto', description: 'Protocol (snmp, ssh, etc.)', required: true, example: 'snmp' },
      { name: 'user', description: 'Username', required: true, example: 'public' },
      { name: 'usage', description: 'Usage type (optional)', required: false, example: 'AP' }
    ],
    category: 'system'
  },
  {
    id: 'decryptfilesha',
    name: 'Decrypt File SHA',
    command: '!DecryptFileSHA',
    description: 'Gets the SHA256 values of all libraries, DLL and JAR files which are exported when a collector is installed. If filename is specified, gets the decrypted SHA of that file.',
    example: '!DecryptFileSHA logicmonitor-util.jar',
    parameters: [
      { name: 'filename', description: 'Optional filename to get SHA for specific file', required: false, example: 'logicmonitor-util.jar' }
    ],
    category: 'system'
  },
  {
    id: 'checkserverconnectivity',
    name: 'Check Server Connectivity',
    command: '!checkserverconnectivity',
    description: 'Tests connectivity to the LogicMonitor platform.',
    example: '!checkserverconnectivity',
    category: 'system'
  },
  {
    id: 'getconfig',
    name: 'Get Config Value',
    command: '!getconfig',
    description: 'Gets a configuration value from the collector.',
    example: '!getconfig enableAD',
    parameters: [
      { name: 'configKey', description: 'Configuration key to retrieve', required: true, example: 'enableAD' }
    ],
    category: 'system'
  },
  {
    id: 'healthcheckv2',
    name: 'Internal Health Check V2',
    command: '!healthCheckV2',
    description: 'Runs internal health check on the collector.',
    example: '!healthCheckV2',
    category: 'system'
  },
  {
    id: 'ipaddress',
    name: 'Show Agent IP Config',
    command: '!ipaddress',
    description: 'Shows the IP address configuration of the agent/collector.',
    example: '!ipaddress',
    category: 'system'
  },
  {
    id: 'macaddress',
    name: 'Show MAC Address',
    command: '!macaddress',
    description: 'Shows the MAC address of the collector.',
    example: '!macaddress',
    category: 'system'
  },
  {
    id: 'register',
    name: 'Update Collector Description',
    command: '!register',
    description: 'Updates the collector description.',
    example: '!register "Collector 123"',
    parameters: [
      { name: 'description', description: 'New collector description', required: true, example: 'Collector 123' }
    ],
    category: 'system'
  },
  {
    id: 'reload',
    name: 'Reload Config from Portal',
    command: '!reload',
    description: 'Reloads configuration from the LogicMonitor portal.',
    example: '!reload',
    category: 'system'
  },
  {
    id: 'sbshutdown',
    name: 'Shutdown Collector',
    command: '!sbshutdown',
    description: 'Shuts down the collector via sbshutdown.exe (Windows only).',
    example: '!sbshutdown',
    category: 'system'
  },
  {
    id: 'sconfig',
    name: 'Get/Set Internal Site Config',
    command: '!sconfig',
    description: 'Gets or sets internal site configuration.',
    example: '!sconfig view',
    parameters: [
      { name: 'action', description: 'Action to perform: view or set', required: true, example: 'view' },
      { name: 'key', description: 'Config key (required if action=set)', required: false, example: 'key' },
      { name: 'value', description: 'Config value (required if action=set)', required: false, example: 'value' }
    ],
    category: 'system'
  },
  {
    id: 'reducelog',
    name: 'Enable Reduced Logging',
    command: '!reducelog',
    description: 'Enables or disables reduced logging mode.',
    example: '!reducelog true',
    parameters: [
      { name: 'enabled', description: 'Enable reduced logging (true/false)', required: true, example: 'true' }
    ],
    category: 'system'
  },
  {
    id: 'reportercache',
    name: 'Show BufferDataReporter Status',
    command: '!reportercache',
    description: 'Shows the status of BufferDataReporter cache.',
    example: '!reportercache',
    category: 'system'
  },
  {
    id: 'avslist',
    name: 'List Antivirus Software',
    command: '!avslist',
    description: 'Lists antivirus software detected on the system.',
    example: '!avslist',
    category: 'system'
  },

  // Scripting Commands
  {
    id: 'groovy',
    name: 'Run Groovy Script',
    command: '!groovy',
    description: 'Runs a Groovy script on the collector.',
    example: '!groovy myscript.groovy',
    parameters: [
      { name: 'script', description: 'Groovy script file path or script content', required: true, example: 'myscript.groovy' }
    ],
    category: 'scripting'
  },
  {
    id: 'posh',
    name: 'Run PowerShell Script',
    command: '!posh',
    description: 'Runs a PowerShell script on the collector (Windows only).',
    example: '!posh check.ps1',
    parameters: [
      { name: 'script', description: 'PowerShell script file path or script content', required: true, example: 'check.ps1' }
    ],
    category: 'scripting'
  },
  {
    id: 'vbscript',
    name: 'Run VBScript',
    command: '!vbscript',
    description: 'Runs a VBScript on the collector (Windows only).',
    example: '!vbscript script.vbs',
    parameters: [
      { name: 'script', description: 'VBScript file path or script content', required: true, example: 'script.vbs' }
    ],
    category: 'scripting'
  },
  {
    id: 'java',
    name: 'Run Java Command',
    command: '!java',
    description: 'Runs a Java command on the host.',
    example: '!java -version',
    parameters: [
      { name: 'command', description: 'Java command and arguments', required: true, example: '-version' }
    ],
    category: 'scripting'
  },

  // File Operations Commands
  {
    id: 'cp',
    name: 'Copy File',
    command: '!cp',
    description: 'Copies a file in the agentRoot directory.',
    example: '!cp logs/debug.log logs/debug_copy.log',
    parameters: [
      { name: 'source', description: 'Source file path', required: true, example: 'logs/debug.log' },
      { name: 'dest', description: 'Destination file path', required: true, example: 'logs/debug_copy.log' }
    ],
    category: 'fileops'
  },
  {
    id: 'dir',
    name: 'List Files in Folder',
    command: '!dir',
    description: 'Lists files in the specified folder.',
    example: '!dir logs',
    parameters: [
      { name: 'path', description: 'Folder path to list', required: false, example: 'logs' }
    ],
    category: 'fileops'
  },
  {
    id: 'digest',
    name: 'Generate File Checksum',
    command: '!digest',
    description: 'Generates a checksum for the specified file.',
    example: '!digest agent.conf',
    parameters: [
      { name: 'file', description: 'File path to generate checksum for', required: true, example: 'agent.conf' }
    ],
    category: 'fileops'
  },
  {
    id: 'tail',
    name: 'Tail File with Regex',
    command: '!tail',
    description: 'Tails a file with optional regex filtering.',
    example: '!tail debug.log ERROR',
    parameters: [
      { name: 'file', description: 'File path to tail', required: true, example: 'debug.log' },
      { name: 'pattern', description: 'Optional regex pattern to filter lines', required: false, example: 'ERROR' }
    ],
    category: 'fileops'
  },
  {
    id: 'unzip',
    name: 'Unzip File',
    command: '!unzip',
    description: 'Unzips an archive file.',
    example: '!unzip archive.zip',
    parameters: [
      { name: 'archive', description: 'Archive file path to extract', required: true, example: 'archive.zip' },
      { name: 'dest', description: 'Destination directory (optional)', required: false, example: 'extracted' }
    ],
    category: 'fileops'
  },
  {
    id: 'put',
    name: 'Copy Server File to Agent',
    command: '!put',
    description: 'Copies a file from the server to the agent.',
    example: '!put script.sh',
    parameters: [
      { name: 'file', description: 'File path on server to copy', required: true, example: 'script.sh' }
    ],
    category: 'fileops'
  },
  {
    id: 'replace',
    name: 'Move Temp File to Root Dir',
    command: '!replace',
    description: 'Moves a temporary file into the root directory.',
    example: '!replace temp.log logs/debug.log',
    parameters: [
      { name: 'source', description: 'Source temporary file path', required: true, example: 'temp.log' },
      { name: 'dest', description: 'Destination file path in root directory', required: true, example: 'logs/debug.log' }
    ],
    category: 'fileops'
  },
  {
    id: 'logfile',
    name: 'Diagnose Log File Events',
    command: '!logfile',
    description: 'Diagnoses log file events.',
    example: '!logfile debug.log',
    parameters: [
      { name: 'file', description: 'Log file path to diagnose', required: true, example: 'debug.log' }
    ],
    category: 'fileops'
  },
  {
    id: 'uploadlog',
    name: 'Upload Log Files',
    command: '!uploadlog',
    description: 'Uploads log files to the LogicMonitor portal.',
    example: '!uploadlog debug.log',
    parameters: [
      { name: 'file', description: 'Log file path to upload', required: true, example: 'debug.log' }
    ],
    category: 'fileops'
  },

  // Network Commands
  {
    id: 'ping',
    name: 'Ping Host',
    command: '!ping',
    description: 'Pings the specified host.',
    example: '!ping 10.36.11.240',
    parameters: [
      { name: 'host', description: 'Hostname or IP address to ping', required: true, example: '10.36.11.240' },
      { name: 'type', description: 'Ping type (optional, e.g., proxy)', required: false, example: 'proxy' }
    ],
    category: 'network'
  },
  {
    id: 'http',
    name: 'HTTP Request',
    command: '!http',
    description: 'Sends an HTTP request and displays the response. URL is required.',
    example: '!http http://www.google.com/index.html',
    parameters: [
      { name: 'url', description: 'URL to request (required)', required: true, example: 'http://www.google.com/index.html' },
      { name: 'username', description: 'Basic auth username', required: false, example: 'user' },
      { name: 'password', description: 'Basic auth password', required: false, example: 'pass' },
      { name: 'method', description: 'HTTP method (GET, POST, PUT)', required: false, example: 'GET' },
      { name: 'followRedirect', description: 'Follow redirects (true/false)', required: false, example: 'true' },
      { name: 'version', description: 'HTTP version (1 or 1.1)', required: false, example: '1.1' },
      { name: 'timeout', description: 'Timeout in seconds', required: false, example: '30' },
      { name: 'headers', description: 'Custom headers as JSON string', required: false, example: '{"Content-type": "application/json"}' },
      { name: 'body', description: 'Request body as JSON string', required: false, example: '{"key": "value"}' }
    ],
    category: 'network'
  },
  {
    id: 'packetcapture',
    name: 'Packet Capture (Original)',
    command: '!packetcapture',
    description: 'Starts packet capture on the specified interface.',
    example: '!packetcapture eth0 60',
    parameters: [
      { name: 'interface', description: 'Network interface name', required: true, example: 'eth0' },
      { name: 'duration', description: 'Capture duration in seconds', required: true, example: '60' }
    ],
    category: 'network'
  },
  {
    id: 'packetcapture2',
    name: 'Packet Capture',
    command: '!packetcapture2',
    description: 'Captures the network traces of the device on which you are running this command.',
    example: '!packetcapture2 interface=eth0 file=test.pcap timeout=1 "tcp and host 10.10.10.10 and port 443"',
    parameters: [
      { name: 'interface', description: 'Network interface name', required: true, example: 'eth0' },
      { name: 'file', description: 'Output filename', required: true, example: 'test.pcap' },
      { name: 'timeout', description: 'Capture timeout in minutes', required: true, example: '1' },
      { name: 'filter', description: 'Packet filter expression', required: false, example: '"tcp and host 10.10.10.10 and port 443"' }
    ],
    category: 'network'
  },
  {
    id: 'nslookup',
    name: 'Resolve DNS Name',
    command: '!nslookup',
    description: 'Resolves a DNS name to an IP address.',
    example: '!nslookup logicmonitor.com',
    parameters: [
      { name: 'hostname', description: 'Hostname to resolve', required: true, example: 'logicmonitor.com' }
    ],
    category: 'network'
  },
  {
    id: 'opssl',
    name: 'Run OpenSSL Command',
    command: '!opssl',
    description: 'Runs an OpenSSL command against the specified host.',
    example: '!opssl hostname:443',
    parameters: [
      { name: 'target', description: 'Target hostname:port', required: true, example: 'hostname:443' },
      { name: 'command', description: 'OpenSSL command and arguments', required: false, example: 's_client -connect' }
    ],
    category: 'network'
  },
  {
    id: 'jssl',
    name: 'View SSL Info',
    command: '!jssl',
    description: 'Views SSL information for the specified host.',
    example: '!jssl hostname:443',
    parameters: [
      { name: 'target', description: 'Target hostname:port', required: true, example: 'hostname:443' }
    ],
    category: 'network'
  },
  {
    id: 'sslcerts',
    name: 'Print SSL Cert Info',
    command: '!sslcerts',
    description: 'Prints SSL certificate information for the specified host.',
    example: '!sslcerts hostname:443',
    parameters: [
      { name: 'target', description: 'Target hostname:port', required: true, example: 'hostname:443' }
    ],
    category: 'network'
  },
  {
    id: 'ssltest',
    name: 'Test SSL Connection',
    command: '!ssltest',
    description: 'Tests SSL connection to the specified host.',
    example: '!ssltest hostname:443',
    parameters: [
      { name: 'target', description: 'Target hostname:port', required: true, example: 'hostname:443' }
    ],
    category: 'network'
  },
  {
    id: 'webperf',
    name: 'HTTP Metrics Test',
    command: '!webperf',
    description: 'Tests HTTP metrics for the specified URL.',
    example: '!webperf https://example.com',
    parameters: [
      { name: 'url', description: 'URL to test', required: true, example: 'https://example.com' }
    ],
    category: 'network'
  },
  {
    id: 'syslogsender',
    name: 'Send Syslog Message',
    command: '!syslogsender',
    description: 'Sends a syslog message to the specified host.',
    example: '!syslogsender hostname "test message"',
    parameters: [
      { name: 'hostname', description: 'Target hostname', required: true, example: 'hostname' },
      { name: 'message', description: 'Syslog message to send', required: true, example: 'test message' }
    ],
    category: 'network'
  },
  {
    id: 'mongo',
    name: 'Run MongoDB Query',
    command: '!mongo',
    description: 'Runs a MongoDB query on the specified host.',
    example: '!mongo dbhost query',
    parameters: [
      { name: 'host', description: 'MongoDB host', required: true, example: 'dbhost' },
      { name: 'query', description: 'MongoDB query to execute', required: true, example: 'query' }
    ],
    category: 'network'
  },
  {
    id: 'netapp',
    name: 'Call NetApp API',
    command: '!netapp',
    description: 'Calls a NetApp API on the specified host.',
    example: '!netapp hostname apicall',
    parameters: [
      { name: 'hostname', description: 'NetApp hostname', required: true, example: 'hostname' },
      { name: 'apicall', description: 'NetApp API call to execute', required: true, example: 'apicall' }
    ],
    category: 'network'
  },
  {
    id: 'jdbc',
    name: 'JDBC Query',
    command: '!jdbc',
    description: 'Executes a SQL query against the specified host using JDBC connection.',
    example: '!jdbc auth=login username=user password=pass url=\'jdbc:mysql://host:3306/database?user=xxx&password=yyy\' sql',
    parameters: [
      { name: 'auth', description: 'Authentication type: login or integrated', required: false, example: 'login' },
      { name: 'username', description: 'Database username (required if auth=login)', required: false, example: 'user' },
      { name: 'password', description: 'Database password (required if auth=login)', required: false, example: 'pass' },
      { name: 'url', description: 'JDBC connection URL string (required)', required: true, example: 'jdbc:mysql://host:3306/database?user=xxx&password=yyy' },
      { name: 'sql', description: 'SQL query to execute (required)', required: true, example: 'SELECT * FROM table' }
    ],
    category: 'network'
  },

  {
    id: 'snmpget',
    name: 'SNMP GET',
    command: '!snmpget',
    description: 'Get the values of a list of OIDs from the given host using SNMP.',
    example: '!snmpget paz02sql003 .1.2.3.4.5.5',
    parameters: [
      { name: 'host', description: 'Target hostname or IP address (required)', required: true, example: 'paz02sql003' },
      { name: 'oid', description: 'SNMP OID(s) to query (required, space-separated for multiple)', required: true, example: '.1.2.3.4.5.5' },
      { name: 'version', description: 'SNMP version: v1, v2c, or v3', required: false, example: 'v2c' },
      { name: 'port', description: 'SNMP port number (default: 161)', required: false, example: '161' },
      { name: 'useSystem', description: 'Use system command instead of collector (64-bit systems only, default: false)', required: false, example: 'false' },
      { name: 'community', description: 'Community string (required for v1/v2c, uses host property if not specified)', required: false, example: 'public' },
      { name: 'auth', description: 'Authentication protocol for v3: MD5, SHA, SHA224, SHA256, SHA384, SHA512', required: false, example: 'MD5' },
      { name: 'authToken', description: 'Authentication passphrase for v3', required: false, example: 'xxxx' },
      { name: 'security', description: 'Security name (username) for v3', required: false, example: 'bert' },
      { name: 'priv', description: 'Privacy protocol for v3: DES, AES, 3DES, AES128, AES192, AES256, AES1923DES, AES2563DES, AES192C, AES256C', required: false, example: 'AES' },
      { name: 'privToken', description: 'Privacy passphrase for v3', required: false, example: 'xxxx' },
      { name: 'contextEngineId', description: 'Context engine ID for v3', required: false, example: 'engine-id' },
      { name: 'contextName', description: 'Context name for v3', required: false, example: 'context' },
      { name: 'timeout', description: 'Request timeout in seconds', required: false, example: '5' },
      { name: 'mode', description: 'Request mode: batch or oneByOne', required: false, example: 'batch' }
    ],
    category: 'diagnostics'
  },
  {
    id: 'snmpwalk',
    name: 'SNMP Walk',
    command: '!snmpwalk',
    description: 'Walk through SNMP OID tree starting from the given OID.',
    example: '!snmpwalk paz02sql003 .1.2.3.4.5.5',
    parameters: [
      { name: 'host', description: 'Target hostname or IP address (required)', required: true, example: 'paz02sql003' },
      { name: 'oid', description: 'Starting OID for the walk (required)', required: true, example: '.1.2.3.4.5.5' },
      { name: 'version', description: 'SNMP version: v1, v2c, or v3', required: false, example: 'v2c' },
      { name: 'port', description: 'SNMP port number (default: 161)', required: false, example: '161' },
      { name: 'usegetnext', description: 'Use getnext PDU for snmpwalk (default: false)', required: false, example: 'false' },
      { name: 'useSystem', description: 'Use system command instead of collector (64-bit systems only, default: false)', required: false, example: 'false' },
      { name: 'community', description: 'Community string (required for v1/v2c, uses host property if not specified)', required: false, example: 'public' },
      { name: 'auth', description: 'Authentication protocol for v3: MD5, SHA, SHA224, SHA256, SHA384, SHA512', required: false, example: 'MD5' },
      { name: 'authToken', description: 'Authentication passphrase for v3', required: false, example: 'xxxx' },
      { name: 'security', description: 'Security name (username) for v3', required: false, example: 'bert' },
      { name: 'priv', description: 'Privacy protocol for v3: DES, AES, 3DES, AES128, AES192, AES256, AES1923DES, AES2563DES, AES192C, AES256C', required: false, example: 'AES' },
      { name: 'privToken', description: 'Privacy passphrase for v3', required: false, example: 'xxxx' },
      { name: 'contextEngineId', description: 'Context engine ID for v3', required: false, example: 'engine-id' },
      { name: 'contextName', description: 'Context name for v3', required: false, example: 'context' },
      { name: 'timeout', description: 'Whole snmpwalk timeout in seconds', required: false, example: '4' },
      { name: 'pdutimeout', description: 'PDU timeout in snmpwalk operation (snmpwalk may contain more than one PDU)', required: false, example: '2' }
    ],
    category: 'diagnostics'
  },
  {
    id: 'snmpdiagnose',
    name: 'Diagnose SNMP OID',
    command: '!snmpdiagnose',
    description: 'Diagnoses SNMP OID access issues.',
    example: '!snmpdiagnose hostname .1.3.6.1.2.1.1.1.0',
    parameters: [
      { name: 'hostname', description: 'Target hostname or IP address', required: true, example: 'hostname' },
      { name: 'oid', description: 'SNMP OID to diagnose', required: true, example: '.1.3.6.1.2.1.1.1.0' }
    ],
    category: 'diagnostics'
  },
  {
    id: 'snmptrap',
    name: 'Diagnose SNMP Trap Source',
    command: '!snmptrap',
    description: 'Diagnoses SNMP trap source issues.',
    example: '!snmptrap',
    category: 'diagnostics'
  },
  {
    id: 'syslog',
    name: 'Diagnose Syslog Source',
    command: '!syslog',
    description: 'Diagnoses syslog source issues.',
    example: '!syslog',
    category: 'diagnostics'
  },
  {
    id: 'debugdetail',
    name: 'Get Debug Command Output',
    command: '!debugdetail',
    description: 'Gets the output of a previously executed debug command.',
    example: '!debugdetail !pollnow',
    parameters: [
      { name: 'command', description: 'Debug command to get output for', required: true, example: '!pollnow' }
    ],
    category: 'diagnostics'
  },
  {
    id: 'debughistory',
    name: 'Show Debug Command History',
    command: '!debughistory',
    description: 'Shows the history of executed debug commands.',
    example: '!debughistory',
    category: 'diagnostics'
  },
  {
    id: 'wmi',
    name: 'WMI Query',
    command: '!wmi',
    description: 'Execute a WMI query against the given host and print the result.',
    example: '!wmi h=paz02sql002 authType=Kerberos SELECT * FROM Win32_OperatingSystem',
    parameters: [
      { name: 'h', description: 'Host which we are monitoring (mandatory)', required: true, example: 'paz02sql002' },
      { name: 'authType', description: 'Authentication Type, default value is NTLMv2', required: false, example: 'Kerberos' },
      { name: 'username', description: 'WMI User Credentials (will use wmi.user property if not passed)', required: false, example: 'foo' },
      { name: 'password', description: 'WMI Password (will use wmi.pass property if not passed)', required: false, example: 'bar' },
      { name: 'query', description: 'WMI query to execute (required)', required: true, example: 'SELECT * FROM Win32_OperatingSystem' }
    ],
    category: 'query'
  },
  {
    id: 'winrm',
    name: 'WinRM Query',
    command: '!winrm',
    description: 'Execute a WMI query using the WinRM mechanism against the given host and print the result.',
    example: '!winrm host=EC2AMAZ-93376C4.logicmonitor.com auth=Kerberos username=LOGICMONITOR\\user_name password=user_secret useSSL=false certCheck=false',
    parameters: [
      { name: 'host', description: 'Remote Domain Computer which we are monitoring (mandatory)', required: true, example: 'EC2AMAZ-93376C4.logicmonitor.com' },
      { name: 'auth', description: 'Authentication Type, default value is Negotiate', required: false, example: 'Kerberos' },
      { name: 'useSSL', description: 'WinRM data collection over HTTPS, default value is true', required: false, example: 'true' },
      { name: 'certCheck', description: 'Certificate Check, default value is true', required: false, example: 'true' },
      { name: 'username', description: 'Domain User Credentials (will use wmi.user property if not passed)', required: false, example: 'LOGICMONITOR\\user_name' },
      { name: 'password', description: 'Domain Password (will use wmi.pass property if not passed)', required: false, example: 'user_secret' },
      { name: 'query', description: 'WQL Query, default value is select * from Win32_Service', required: false, example: 'select * from Win32_Service' },
      { name: 'timeout', description: 'Timeout value in seconds for the WQL Query, default value is 60 secs', required: false, example: '60' }
    ],
    category: 'query'
  },
  {
    id: 'cim',
    name: 'Run CIM Query',
    command: '!cim',
    description: 'Runs a CIM query on the specified host.',
    example: '!cim hostname query',
    parameters: [
      { name: 'hostname', description: 'Target hostname', required: true, example: 'hostname' },
      { name: 'query', description: 'CIM query to execute', required: true, example: 'query' }
    ],
    category: 'query'
  },
  {
    id: 'esx',
    name: 'Run ESX Query',
    command: '!esx',
    description: 'Runs an ESX query on the specified host.',
    example: '!esx hostname query',
    parameters: [
      { name: 'hostname', description: 'Target hostname', required: true, example: 'hostname' },
      { name: 'query', description: 'ESX query to execute', required: true, example: 'query' }
    ],
    category: 'query'
  },
  {
    id: 'jmx',
    name: 'Query JMX Path',
    command: '!jmx',
    description: 'Queries a JMX path on the specified host.',
    example: '!jmx hostname path.to.metric',
    parameters: [
      { name: 'hostname', description: 'Target hostname', required: true, example: 'hostname' },
      { name: 'path', description: 'JMX path to query', required: true, example: 'path.to.metric' }
    ],
    category: 'query'
  },
  {
    id: 'wmimethod',
    name: 'Call WMI Method',
    command: '!wmimethod',
    description: 'Calls a WMI method on the specified host.',
    example: '!wmimethod hostname class method',
    parameters: [
      { name: 'hostname', description: 'Target hostname', required: true, example: 'hostname' },
      { name: 'class', description: 'WMI class name', required: true, example: 'class' },
      { name: 'method', description: 'WMI method name', required: true, example: 'method' }
    ],
    category: 'query'
  },
  {
    id: 'xen',
    name: 'Query Xen Counters',
    command: '!xen',
    description: 'Queries Xen counters on the specified host.',
    example: '!xen hostname',
    parameters: [
      { name: 'hostname', description: 'Target hostname', required: true, example: 'hostname' }
    ],
    category: 'query'
  },
  {
    id: 'netflow',
    name: 'NetFlow Operations',
    command: '!netflow',
    description: 'Manage and query NetFlow data, diagnose NetFlow problems, and manage NetFlow tables.',
    example: '!netflow func=query select * from INFORMATION_SCHEMA.SYSTEM_TABLES where table_type=\'TABLE\'',
    parameters: [
      { name: 'func', description: 'Function to execute (required)', required: true, example: 'query' },
      { name: 'query', description: 'SQL query (required if func=query or func=update)', required: false, example: 'select * from INFORMATION_SCHEMA.SYSTEM_TABLES' },
      { name: 'deviceId', description: 'Device ID (required for func=diagnose, func=dump, func=parse, func=print)', required: false, example: '123' },
      { name: 'timezone', description: 'Timezone (optional for func=diagnose)', required: false, example: 'UTC' },
      { name: 'netflowType', description: 'NetFlow type: netflow or sflow (required for func=parse)', required: false, example: 'netflow' },
      { name: 'rawPackage', description: 'Raw package data (required for func=parse)', required: false, example: 'raw data' },
      { name: 'netflowSrcId', description: 'NetFlow source ID (required for func=print)', required: false, example: '1' },
      { name: 'netflow9TemplateId', description: 'NetFlow9 template ID (required for func=print)', required: false, example: '256' },
      { name: 'logLevel', description: 'Debug log level: no, all, or error (required for func=debug)', required: false, example: 'all' },
      { name: 'interval', description: 'Time interval in seconds (for func=setExecCheckpointTimeIntervalInSec)', required: false, example: '300' },
      { name: 'dataSize', description: 'Data size (for func=setExecCheckpointDataSize)', required: false, example: '1000' }
    ],
    category: 'network'
  },

  // Windows Commands
  {
    id: 'etw',
    name: 'Capture ETW Data',
    command: '!etw',
    description: 'Captures ETW (Event Tracing for Windows) data (Windows only).',
    example: '!etw',
    category: 'windows'
  },
  {
    id: 'logman',
    name: 'Run Logman Command',
    command: '!logman',
    description: 'Runs a logman command (Windows only).',
    example: '!logman query',
    parameters: [
      { name: 'command', description: 'Logman command and arguments', required: true, example: 'query' }
    ],
    category: 'windows'
  },
  {
    id: 'svc',
    name: 'Windows Service Management',
    command: '!svc',
    description: 'Manages Windows services (Windows only).',
    example: '!svc status "LogicMonitor Collector"',
    parameters: [
      { name: 'action', description: 'Service action: status, start, stop, restart', required: true, example: 'status' },
      { name: 'service', description: 'Service name', required: true, example: 'LogicMonitor Collector' }
    ],
    category: 'windows'
  },
  {
    id: 'typeperf',
    name: 'Run Typeperf',
    command: '!typeperf',
    description: 'Runs typeperf command (Windows only).',
    example: '!typeperf "\\Processor(_Total)\\% Processor Time"',
    parameters: [
      { name: 'counter', description: 'Performance counter path', required: true, example: '\\Processor(_Total)\\% Processor Time' }
    ],
    category: 'windows'
  },
  {
    id: 'winevent',
    name: 'Collect Windows Event Logs',
    command: '!winevent',
    description: 'Collects Windows event logs (Windows only).',
    example: '!winevent',
    category: 'windows'
  },
  {
    id: 'syswmic',
    name: 'Run WMIC Command',
    command: '!syswmic',
    description: 'Runs a WMIC command (Windows only).',
    example: '!syswmic alias list brief',
    parameters: [
      { name: 'command', description: 'WMIC command and arguments', required: true, example: 'alias list brief' }
    ],
    category: 'windows'
  },
  {
    id: 'testwinrmconfig',
    name: 'Test WinRM Setup',
    command: '!testwinrmconfig',
    description: 'Tests WinRM configuration (Windows only).',
    example: '!testwinrmconfig',
    category: 'windows'
  },
  {
    id: 'firewallstatus',
    name: 'Show Firewall Configuration',
    command: '!firewallstatus',
    description: 'Shows firewall configuration (Windows only).',
    example: '!firewallstatus',
    category: 'windows'
  },

  // Health Commands
  {
    id: 'shealthcheck',
    name: 'Collector Health Check',
    command: '!shealthcheck',
    description: 'Helps determine the health of Collector, memory consumed, and number of scheduled tasks. func=trigger schedules a healthcheck, func=show displays summary, func=detail shows full details.',
    example: '!shealthcheck func=show collector=123',
    parameters: [
      { name: 'func', description: 'Function: trigger, show, or detail', required: true, example: 'show' },
      { name: 'collector', description: 'Collector ID', required: true, example: '123' }
    ],
    category: 'health'
  },
  {
    id: 'logsurf',
    name: 'Log Surf',
    command: '!logsurf',
    description: 'Displays log file entries that are of the specified debug level. Optionally filter by seq and taskId.',
    example: '!logsurf level=trace ../logs/wrapper.log taskid=833 seq=75',
    parameters: [
      { name: 'level', description: 'Debug level (trace, debug, info, warn, error)', required: true, example: 'trace' },
      { name: 'file', description: 'Log file path', required: true, example: '../logs/wrapper.log' },
      { name: 'taskid', description: 'Filter by task ID', required: false, example: '833' },
      { name: 'seq', description: 'Filter by sequence number', required: false, example: '75' },
      { name: 'n', description: 'Number of log entries to display', required: false, example: '100' }
    ],
    category: 'health'
  },
  {
    id: 'logingestion',
    name: 'Show Log Ingestion Pipeline Status',
    command: '!logingestion',
    description: 'Shows the status of the log ingestion pipeline.',
    example: '!logingestion',
    category: 'health'
  },
  {
    id: 'loglevel',
    name: 'Change Agent Log Level',
    command: '!loglevel',
    description: 'Changes the agent log level.',
    example: '!loglevel INFO',
    parameters: [
      { name: 'level', description: 'Log level: TRACE, DEBUG, INFO, WARN, ERROR', required: true, example: 'INFO' }
    ],
    category: 'health'
  },
  {
    id: 'log4jloglevel',
    name: 'Adjust Log4j Log Level',
    command: '!log4jloglevel',
    description: 'Adjusts the Log4j log level.',
    example: '!log4jloglevel DEBUG',
    parameters: [
      { name: 'level', description: 'Log4j log level: TRACE, DEBUG, INFO, WARN, ERROR', required: true, example: 'DEBUG' }
    ],
    category: 'health'
  },
  {
    id: 'logsearch',
    name: 'Search Logs',
    command: '!logsearch',
    description: 'Searches logs for the specified pattern.',
    example: '!logsearch error',
    parameters: [
      { name: 'pattern', description: 'Search pattern or keyword', required: true, example: 'error' }
    ],
    category: 'health'
  },
  {
    id: 'keepagentalive',
    name: 'Keep Agent Alive',
    command: '!keepagentalive',
    description: 'Keeps the agent alive for the specified duration.',
    example: '!keepagentalive 300',
    parameters: [
      { name: 'duration', description: 'Duration in seconds to keep agent alive', required: true, example: '300' }
    ],
    category: 'health'
  },
  {
    id: 'dumpheap',
    name: 'Dump JVM Heap Info',
    command: '!dumpheap',
    description: 'Dumps JVM heap information.',
    example: '!dumpheap',
    category: 'health'
  },
  {
    id: 'jcmd',
    name: 'Run jcmd Tool',
    command: '!jcmd',
    description: 'Runs the jcmd tool for JVM diagnostics.',
    example: '!jcmd',
    parameters: [
      { name: 'command', description: 'jcmd command and arguments', required: false, example: 'GC.run' }
    ],
    category: 'health'
  },
  {
    id: 'perfinfo',
    name: 'List Performance Counters',
    command: '!perfinfo',
    description: 'Lists performance counters for the specified host.',
    example: '!perfinfo hostname',
    parameters: [
      { name: 'hostname', description: 'Target hostname', required: true, example: 'hostname' }
    ],
    category: 'health'
  },
  {
    id: 'perfmon',
    name: 'Query Windows Perf Counters',
    command: '!perfmon',
    description: 'Queries Windows performance counters (Windows only).',
    example: '!perfmon hostname',
    parameters: [
      { name: 'hostname', description: 'Target hostname', required: true, example: 'hostname' }
    ],
    category: 'health'
  },

  // Task Management Commands
  {
    id: 'tcancel',
    name: 'Cancel Collection Task',
    command: '!tcancel',
    description: 'Cancels a collection task.',
    example: '!tcancel 321',
    parameters: [
      { name: 'taskId', description: 'Task ID from !tlist output', required: true, example: '321' }
    ],
    category: 'taskmgmt'
  },
  {
    id: 'tremove',
    name: 'Disable Collection Task',
    command: '!tremove',
    description: 'Disables a collection task.',
    example: '!tremove 321',
    parameters: [
      { name: 'taskId', description: 'Task ID from !tlist output', required: true, example: '321' }
    ],
    category: 'taskmgmt'
  },
  {
    id: 'taskkill',
    name: 'Kill a Process',
    command: '!taskkill',
    description: 'Kills a process by process ID.',
    example: '!taskkill 3456',
    parameters: [
      { name: 'pid', description: 'Process ID to kill', required: true, example: '3456' }
    ],
    category: 'taskmgmt'
  },
  {
    id: 'tasklist',
    name: 'List Processes',
    command: '!tasklist',
    description: 'Lists running processes.',
    example: '!tasklist',
    category: 'taskmgmt'
  },
  {
    id: 'upgradeproxy',
    name: 'Upgrade sbproxy',
    command: '!upgradeproxy',
    description: 'Upgrades the sbproxy component.',
    example: '!upgradeproxy',
    category: 'taskmgmt'
  },

  // Misc Commands
  {
    id: 'help',
    name: 'Command Help',
    command: 'help',
    description: 'Displays syntax and usage details for a specific command.',
    example: 'help !adlist',
    parameters: [
      { name: 'command', description: 'Command name to get help for', required: true, example: '!adlist' }
    ],
    category: 'misc'
  }
];

/**
 * Get all commands grouped by category
 */
export function getCommandsByCategory(): Record<string, DebugCommand[]> {
  const grouped: Record<string, DebugCommand[]> = {};
  for (const cmd of DEBUG_COMMANDS) {
    if (!grouped[cmd.category]) {
      grouped[cmd.category] = [];
    }
    grouped[cmd.category].push(cmd);
  }
  return grouped;
}

/**
 * Find a command by ID
 */
export function findCommandById(id: string): DebugCommand | undefined {
  return DEBUG_COMMANDS.find(cmd => cmd.id === id);
}

/**
 * Search commands by name or description
 */
export function searchCommands(query: string): DebugCommand[] {
  const lowerQuery = query.toLowerCase();
  return DEBUG_COMMANDS.filter(cmd => 
    cmd.name.toLowerCase().includes(lowerQuery) ||
    cmd.description.toLowerCase().includes(lowerQuery) ||
    cmd.command.toLowerCase().includes(lowerQuery)
  );
}

