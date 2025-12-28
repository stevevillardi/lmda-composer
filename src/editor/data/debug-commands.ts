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
  category: 'discovery' | 'system' | 'network' | 'health' | 'misc';
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
    id: 'jdbc',
    name: 'JDBC Query',
    command: '!jdbc',
    description: 'Executes a SQL query against the specified host.',
    example: '!jdbc \'url=jdbc:mysql://host:3306 username=user password=pass\' select Name, ID from DB.Employees',
    parameters: [
      { name: 'connection', description: 'JDBC connection string with url, username, password', required: true, example: 'url=jdbc:mysql://host:3306 username=user password=pass' },
      { name: 'query', description: 'SQL query to execute', required: true, example: 'select Name, ID from DB.Employees' }
    ],
    category: 'network'
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

