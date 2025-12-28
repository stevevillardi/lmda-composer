import type { AppliesToFunction } from '@/shared/types';

export const APPLIES_TO_FUNCTIONS: AppliesToFunction[] = [
  // ==================== BASIC FUNCTIONS ====================
  {
    name: 'true',
    syntax: 'true()',
    parameters: 'None',
    description: 'Matches all resources in your environment. Use with caution as it applies to every device.',
    example: 'true()',
  },
  {
    name: 'false',
    syntax: 'false()',
    parameters: 'None',
    description: 'Matches no resources. Useful to globally disable a LogicModule without deleting it, or to prevent a module under development from being applied prematurely.',
    example: 'false()',
  },

  // ==================== PROPERTY FUNCTIONS ====================
  {
    name: 'exists',
    syntax: 'exists("<property value>")',
    parameters: '<property value> - The value to check for in any property',
    description: 'Returns TRUE if the specified value is assigned to any of the resource\'s properties.',
    example: 'exists("Linux")',
  },
  {
    name: 'getPropValue',
    syntax: 'getPropValue("<property name>")',
    parameters: '<property name> - The name of the property (supports special characters)',
    description: 'Returns the value of a property. Required when property names contain special characters like ":", "/", "*", "=", or spaces. When used alone, returns TRUE for resources that have a value set for the specified property.',
    example: 'getPropValue("SiteA:unit") =~ "[10-19]"',
  },
  {
    name: 'getCollectorVersion',
    syntax: 'getCollectorVersion()',
    parameters: 'None',
    description: 'Returns the value of the system.collectorversion property.',
    example: 'getCollectorVersion() >= 30000',
  },

  // ==================== CATEGORY FUNCTIONS ====================
  {
    name: 'hasCategory',
    syntax: 'hasCategory("<string>")',
    parameters: '<string> - The category name to match',
    description: 'Queries the system.categories property for an array element that is a complete, case insensitive match for the specified string. Returns TRUE if there is a match. Regex is not supported.',
    example: 'hasCategory("Linux")',
  },

  // ==================== ARRAY FUNCTIONS ====================
  {
    name: 'contains',
    syntax: 'contains(<array>, "<string>")',
    parameters: '<array> - The array property to search; <string> - The string to find',
    description: 'Returns TRUE if the specified string matches an array element. The match is a complete match on the search string, case insensitive. Regex is not supported.',
    example: 'contains(system.groups, "Production")',
  },
  {
    name: 'join',
    syntax: 'join(<array>, "<separator>")',
    parameters: '<array> - The array to flatten; <separator> - The separator string',
    description: 'Flattens an array to a string with array elements separated by the designated separator. Partial match and regex are supported. When used alone, returns TRUE for resources which have any value set for the specified array property.',
    example: 'join(system.groups, ",") =~ "Prod"',
  },

  // ==================== STRING FUNCTIONS ====================
  {
    name: 'startsWith',
    syntax: 'startsWith(<property>, "<value>")',
    parameters: '<property> - The property to check; <value> - The prefix to match',
    description: 'Returns TRUE if the property value starts with the value specified. Partial match from the beginning is supported. Regex is not supported.',
    example: 'startsWith(system.hostname, "web-")',
  },

  // ==================== MATH FUNCTIONS ====================
  {
    name: 'sum',
    syntax: 'sum(x, y, z)',
    parameters: 'Any number of numeric arguments',
    description: 'Returns the sum of the numbers passed as parameters.',
    example: 'sum(1, 2, 3) == 6',
  },

  // ==================== DEVICE TYPE FUNCTIONS ====================
  {
    name: 'isDevice',
    syntax: 'isDevice()',
    parameters: 'None',
    description: 'Returns TRUE if the value of the system.devicetype property is "0" or if "collectorDataSources" is contained in the system.categories property.',
    example: 'isDevice()',
  },
  {
    name: 'isCollectorDevice',
    syntax: 'isCollectorDevice()',
    parameters: 'None',
    description: 'Returns TRUE if the value of the system.collector property is "true".',
    example: 'isCollectorDevice()',
  },

  // ==================== CLOUD SERVICE FUNCTIONS ====================
  {
    name: 'isAWSService',
    syntax: 'isAWSService()',
    parameters: 'None',
    description: 'Returns TRUE if the value of the system.devicetype property is "2".',
    example: 'isAWSService()',
  },
  {
    name: 'isAzureService',
    syntax: 'isAzureService()',
    parameters: 'None',
    description: 'Returns TRUE if the value of the system.devicetype property is "4".',
    example: 'isAzureService()',
  },
  {
    name: 'isGCPService',
    syntax: 'isGCPService()',
    parameters: 'None',
    description: 'Returns TRUE if the value of the system.devicetype property is "7".',
    example: 'isGCPService()',
  },

  // ==================== OS TYPE FUNCTIONS ====================
  {
    name: 'isWindows',
    syntax: 'isWindows()',
    parameters: 'None',
    description: 'Returns TRUE if "windows" or "hyper-v" is contained in the system.sysinfo or system.categories property.',
    example: 'isWindows()',
  },
  {
    name: 'isLinux',
    syntax: 'isLinux()',
    parameters: 'None',
    description: 'Returns TRUE if "linux" is contained in the system.sysinfo or system.categories property and "Cisco IOS" is not present in the system.sysinfo property.',
    example: 'isLinux()',
  },
  {
    name: 'isLinux(excludek8spod)',
    syntax: 'isLinux("excludeK8sPod")',
    parameters: 'None',
    description: 'Applies modules on only Linux devices, excluding Kubernetes pods.',
    example: 'isLinux("excludeK8sPod")',
  },
  {
    name: 'isUnix',
    syntax: 'isUnix()',
    parameters: 'None',
    description: 'Returns TRUE if "solaris", "linux", or "freebsd" is contained in the system.sysinfo or system.categories property.',
    example: 'isUnix()',
  },
  {
    name: 'isSolaris',
    syntax: 'isSolaris()',
    parameters: 'None',
    description: 'Returns TRUE if "solaris" is contained in the system.sysinfo or system.categories property.',
    example: 'isSolaris()',
  },
  {
    name: 'isFreebsd',
    syntax: 'isFreebsd()',
    parameters: 'None',
    description: 'Returns TRUE if "freebsd" is contained in the system.sysinfo or system.categories property.',
    example: 'isFreebsd()',
  },

  // ==================== INFRASTRUCTURE TYPE FUNCTIONS ====================
  {
    name: 'isNetwork',
    syntax: 'isNetwork()',
    parameters: 'None',
    description: 'Returns TRUE if the system.sysinfo or system.categories property contains a value representing network systems. A large number of values are inclusive.',
    example: 'isNetwork()',
  },
  {
    name: 'isStorage',
    syntax: 'isStorage()',
    parameters: 'None',
    description: 'Returns TRUE if the system.sysinfo or system.categories property contains a value representing storage systems.',
    example: 'isStorage()',
  },
  {
    name: 'isVirtualization',
    syntax: 'isVirtualization()',
    parameters: 'None',
    description: 'Returns TRUE if "vmware" or "xen" is in the system.virtualization property or "hyperv" is in the system.categories property.',
    example: 'isVirtualization()',
  },
  {
    name: 'isMisc',
    syntax: 'isMisc()',
    parameters: 'None',
    description: 'Returns TRUE if none of the criteria for isWindows(), isLinux(), isNetwork(), isStorage(), and isVirtualization() are met.',
    example: 'isMisc()',
  },

  // ==================== VENDOR-SPECIFIC FUNCTIONS ====================
  {
    name: 'isCisco',
    syntax: 'isCisco()',
    parameters: 'None',
    description: 'Returns TRUE if "cisco" is contained in the system.sysinfo or system.categories property.',
    example: 'isCisco()',
  },
  {
    name: 'isF5',
    syntax: 'isF5()',
    parameters: 'None',
    description: 'Returns TRUE if the system.sysoid property begins with "1.3.6.1.4.1.3375.2.1.3.4.4" or "f5" is in the system.categories property.',
    example: 'isF5()',
  },
  {
    name: 'isNetApp',
    syntax: 'isNetApp()',
    parameters: 'None',
    description: 'Returns TRUE if "netapp" is contained in the system.sysinfo or system.categories property.',
    example: 'isNetApp()',
  },
  {
    name: 'isNetscaler',
    syntax: 'isNetscaler()',
    parameters: 'None',
    description: 'Returns TRUE if "netscaler" is contained in the system.sysinfo or system.categories property.',
    example: 'isNetscaler()',
  },
  {
    name: 'isArubaSwitch',
    syntax: 'isArubaSwitch()',
    parameters: 'None',
    description: 'Returns TRUE if auto.endpoint.manufacturer is "Aruba" and predef.externalResourceType is "Switch".',
    example: 'isArubaSwitch()',
  },

  // ==================== FEATURE-SPECIFIC FUNCTIONS ====================
  {
    name: 'isNetflow',
    syntax: 'isNetflow()',
    parameters: 'None',
    description: 'Returns TRUE if the value of the system.enablenetflow property is "true".',
    example: 'isNetflow()',
  },
  {
    name: 'isK8sPod',
    syntax: 'isK8sPod()',
    parameters: 'None',
    description: 'Applies the modules only on Kubernetes pods.',
    example: 'isK8sPod()',
  },
];

// Group functions by category for the reference panel
export const APPLIES_TO_FUNCTION_CATEGORIES = [
  {
    name: 'Basic',
    functions: ['true', 'false'],
  },
  {
    name: 'Properties',
    functions: ['exists', 'getPropValue', 'getCollectorVersion'],
  },
  {
    name: 'Categories',
    functions: ['hasCategory'],
  },
  {
    name: 'Arrays',
    functions: ['contains', 'join'],
  },
  {
    name: 'Strings',
    functions: ['startsWith'],
  },
  {
    name: 'Math',
    functions: ['sum'],
  },
  {
    name: 'Device Types',
    functions: ['isDevice', 'isCollectorDevice'],
  },
  {
    name: 'Cloud Services',
    functions: ['isAWSService', 'isAzureService', 'isGCPService'],
  },
  {
    name: 'Operating Systems',
    functions: ['isWindows', 'isLinux', 'isLinux(excludek8spod)', 'isUnix', 'isSolaris', 'isFreebsd'],
  },
  {
    name: 'Infrastructure',
    functions: ['isNetwork', 'isStorage', 'isVirtualization', 'isMisc'],
  },
  {
    name: 'Vendors',
    functions: ['isCisco', 'isF5', 'isNetApp', 'isNetscaler', 'isArubaSwitch'],
  },
  {
    name: 'Features',
    functions: ['isNetflow', 'isK8sPod'],
  },
];

// Get function by name for autocomplete/tooltips
export function getAppliesToFunction(name: string): AppliesToFunction | undefined {
  return APPLIES_TO_FUNCTIONS.find(f => f.name.toLowerCase() === name.toLowerCase());
}

// Get all function names for autocomplete
export function getAppliesToFunctionNames(): string[] {
  return APPLIES_TO_FUNCTIONS.map(f => f.name);
}

