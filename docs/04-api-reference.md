# LogicMonitor IDE - LogicMonitor API Reference

## Overview

This document covers the LogicMonitor REST API v3 endpoints required for the LogicMonitor IDE extension. All endpoints are relative to the portal hostname (e.g., `https://acme.logicmonitor.com`).

**Base URL:** `https://{portal}.logicmonitor.com/santaba/rest`

**API Documentation:** [LogicMonitor Swagger UI](https://www.logicmonitor.com/swagger-ui-master/api-v3/dist/#/)

---

## Authentication

### CSRF Token

All POST/PUT/DELETE requests require a CSRF token. The extension obtains this token from a content-script XHR executed in the portal page.

**Endpoint:**
```
GET /santaba/rest/functions/dummy
```

**Headers (Request):**
```
X-CSRF-Token: Fetch
X-version: 3
```

**Headers (Response):**
```
X-CSRF-Token: {token_value}
```

**Usage:**
```typescript
function fetchCsrfToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/santaba/rest/functions/dummy', true);
    xhr.setRequestHeader('X-CSRF-Token', 'Fetch');
    xhr.setRequestHeader('X-version', '3');
    xhr.onload = () => resolve(xhr.status === 200 ? xhr.getResponseHeader('X-CSRF-Token') : null);
    xhr.onerror = () => resolve(null);
    xhr.send();
  });
}
```

**Notes:**
- Token is tied to the user's session
- Token may expire; refresh if 403 received
- Must include `credentials: 'include'` for cookies

---

## Debug API

### Execute Debug Command

Submit a command to be executed on a collector.

**Endpoint:**
```
POST /santaba/rest/debug/?collectorId={collectorId}
```

**Headers:**
```
Content-Type: application/json
X-CSRF-Token: {token}
X-Requested-With: XMLHttpRequest
X-version: 3
```

**Request Body:**
```json
{
  "cmdline": "!groovy hostId=null \n import com.santaba.agent.groovyapi.snmp.Snmp;\n..."
}
```

**Response:**
```json
{
  "sessionId": "abc123-def456"
}
```

**Command Formats:**

| Type | Command Prefix |
|------|----------------|
| Groovy | `!groovy hostId=null \n {script}` |
| PowerShell | `!posh \n {script}` |

**Groovy Command Options:**
```
!groovy [options] \nscriptbody

Options:
    timeout: timeout in seconds, default 180 seconds
    runner: where to run the script (agent or sse, default: agent)
    hostId: send which host (in the portal) properties to groovy runner
    h: indicates which host (in the collector) the hostProps will bound to
```

**Notes:**
- We always use `hostId=null` and inject a Groovy preamble to populate `hostProps`, `instanceProps`, and `datasourceinstanceProps` from `CollectorDb`
- PowerShell does not support `hostId` natively (hence our Groovy prefetch solution)
- Maximum execution timeout: **120 seconds** (script will be terminated if exceeded)

---

### Get Debug Command Result

Poll for the result of an executed command.

**Endpoint:**
```
GET /santaba/rest/debug/{sessionId}?collectorId={collectorId}
```

**Headers:**
```
X-CSRF-Token: {token}
X-Requested-With: XMLHttpRequest
X-version: 3
```

**Response (In Progress):**
```
HTTP 202 Accepted
```

**Response (Complete):**
```json
{
  "output": "eth0##Ethernet 0\neth1##Ethernet 1\n",
  "sessionId": "abc123-def456"
}
```

**Polling Strategy:**
```typescript
async function pollResult(
  portal: string,
  sessionId: string,
  collectorId: number,
  csrfToken: string,
  maxAttempts = 60,
  intervalMs = 1000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://${portal}/santaba/rest/debug/${sessionId}?collectorId=${collectorId}`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'X-version': '3'
        },
        credentials: 'include'
      }
    );
    
    if (response.status === 200) {
      const data = await response.json();
      return data.output;
    }
    
    if (response.status !== 202) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    
    await new Promise(r => setTimeout(r, intervalMs));
  }
  
  throw new Error('Execution timed out');
}
```

---

## Collector API

### List Collectors

Get all collectors for the portal.

**Endpoint:**
```
GET /santaba/rest/setting/collector/collectors
```

**Headers:**
```
X-CSRF-Token: {token}
X-version: 3
```

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `size` | Number of results (default 50, max 1000) |
| `offset` | Pagination offset |
| `fields` | Comma-separated field list |
| `filter` | Filter expression |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "description": "Production Collector 01",
      "hostname": "collector-prod-01.example.com",
      "status": 0,
      "upTime": 1234567890,
      "collectorGroupId": 1,
      "collectorGroupName": "Production",
      "build": "32001",
      "platform": "linux64",
      "isDown": false,
      "numberOfHosts": 150
    }
  ],
  "total": 5,
  "searchId": null
}
```

**Status Codes:**
| Value | Meaning |
|-------|---------|
| 0 | OK |
| 1 | Warning |
| 2 | Critical |
| 3 | Dead |

**TypeScript Interface (API response subset used by the UI):**
```typescript
interface Collector {
  id: number;
  description: string;
  hostname: string;
  status: number;
  collectorGroupName: string;
  isDown: boolean;
}
```

---

## Device/Resource API

### List Devices (for dropdown)

Fetch lightweight device data for the current portal.

**Endpoint:**
```
GET /santaba/rest/device/devices?filter={filter}&size=1000&fields=id,name,displayName,currentCollectorId,hostStatus
```

**Response:**
```json
{
  "id": 12345,
  "name": "webserver-01",
  "displayName": "Web Server 01",
  "hostGroupIds": "1,2,3",
  "preferredCollectorId": 1,
  "preferredCollectorGroupId": 1,
  "systemProperties": [
    { "name": "system.hostname", "value": "10.0.0.1" },
    { "name": "system.displayname", "value": "Web Server 01" }
  ],
  "customProperties": [
    { "name": "customer", "value": "ACME Corp" }
  ],
  "inheritedProperties": [
    { "name": "snmp.community", "value": "public" }
  ]
}
```

**Filter Examples:**
- `displayName~"router"`
- `name~"web"`

**TypeScript Interface:**
```typescript
interface DeviceInfo {
  id: number;
  name: string;
  displayName: string;
  currentCollectorId: number;
  hostStatus: string;
}
```

### Get Device by ID (lightweight)

Used when opening the editor with a `resourceId` from the LM UI.

**Endpoint:**
```
GET /santaba/rest/device/devices/{resourceId}?fields=id,name,displayName,currentCollectorId
```

### Get Device Properties (for sidebar)

Fetch properties for a single device.

**Endpoint:**
```
GET /santaba/rest/device/devices/{deviceId}?fields=systemProperties,customProperties,inheritedProperties,autoProperties
```

**Response:** Contains property arrays grouped by type.

---

## DataSource API

### List DataSources

Search and list DataSources.

**Endpoint:**
```
GET /santaba/rest/setting/datasources
```

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `filter` | e.g., `name~"Linux"` |
| `size` | Results per page |
| `fields` | Fields to include |

**Response:**
```json
{
  "items": [
    {
      "id": 12345,
      "name": "Linux_SSH_NetworkInterfaces",
      "displayName": "Linux SSH Network Interfaces",
      "appliesTo": "system.sysinfo =~ \"Linux\"",
      "collectMethod": "script",
      "hasMultiInstances": true,
      "collectInterval": 300
    }
  ],
  "total": 42
}
```

---

### Get DataSource Details

Fetch full DataSource definition including scripts.

**Endpoint:**
```
GET /santaba/rest/setting/datasources/{id}
```

**Response (verified structure):**

For a **batchscript** (Groovy, multi-instance) DataSource:
```json
{
  "id": 33656117,
  "name": "7Signal_Organization_Sensor_KPIs",
  "displayName": "7Signal Organization Sensor KPIs",
  "collectMethod": "batchscript",
  "collectInterval": 900,
  "hasMultiInstances": true,
  
  "collectorAttribute": {
    "name": "batchscript",
    "groovyScript": "/*******************************************************************************\n * Collection Script\n ******************************************************************************/\nimport groovy.json.*\n...",
    "scriptType": "embed",
    "linuxScript": "",
    "windowsScript": "",
    "linuxCmdline": "",
    "windowsCmdline": ""
  },
  
  "enableAutoDiscovery": true,
  "autoDiscoveryConfig": {
    "scheduleInterval": 60,
    "method": {
      "name": "ad_script",
      "type": "embeded",
      "groovyScript": "/* AD Script */\nimport groovy.json.*\n...",
      "linuxScript": null,
      "winScript": null,
      "linuxCmdline": null,
      "winCmdline": null
    }
  },
  
  "dataPoints": [
    {
      "name": "slaValue",
      "dataType": 7,
      "description": "SLA percentage value",
      "postProcessorMethod": "namevalue",
      "postProcessorParam": "##WILDVALUE##.slaValue"
    }
  ]
}
```

For a **script** (PowerShell, single-instance) DataSource:
```json
{
  "id": 12693547,
  "name": "WinMemory64_WinRM",
  "displayName": "Memory Stats(WinRM)",
  "collectMethod": "script",
  "collectInterval": 120,
  "hasMultiInstances": false,
  
  "collectorAttribute": {
    "name": "script",
    "groovyScript": "<# PowerShell script here #>\n$WinRmUser = '##WINRM.USER##'\n...",
    "scriptType": "powerShell",
    "linuxScript": "",
    "windowsScript": "",
    "linuxCmdline": "",
    "windowsCmdline": ""
  },
  
  "enableAutoDiscovery": false,
  "autoDiscoveryConfig": null,
  
  "dataPoints": [
    {
      "name": "AvailableBytes",
      "dataType": 7,
      "description": "Amount of physical memory available",
      "postProcessorMethod": "namevalue",
      "postProcessorParam": "AvailableBytes"
    }
  ]
}
```

**Key Observations:**
- PowerShell scripts are stored in `collectorAttribute.groovyScript` (confusing naming!)
- The `collectorAttribute.scriptType` field indicates the actual language: `"embed"` (Groovy), `"powerShell"`, etc.
- AD scripts are in `autoDiscoveryConfig.method.groovyScript`
- For `batchscript`, datapoint params use `##WILDVALUE##.datapointName` format

**TypeScript Interface:**
```typescript
interface CollectorAttribute {
  name: string;                    // "script", "batchscript", etc.
  groovyScript: string;            // The actual script (may be PowerShell!)
  scriptType: ScriptType;          // "embed" | "powerShell" | "file"
  linuxScript: string;
  windowsScript: string;
  linuxCmdline: string;
  windowsCmdline: string;
}

type ScriptType = 'embed' | 'powerShell' | 'file';

interface ADMethod {
  name: string;                    // "ad_script", "ad_snmp", etc.
  type: string;                    // "embeded", "file"
  groovyScript: string | null;
  linuxScript: string | null;
  winScript: string | null;
  linuxCmdline: string | null;
  winCmdline: string | null;
}

interface AutoDiscoveryConfig {
  scheduleInterval: number;
  method: ADMethod;
  persistentInstance: boolean;
  disableInstance: boolean;
  deleteInactiveInstance: boolean;
}

interface DataPoint {
  id: number;
  name: string;
  dataType: number;
  description: string;
  postProcessorMethod: string;     // "namevalue", "regex", etc.
  postProcessorParam: string;      // The extraction pattern
  alertExpr: string;
  alertForNoData: number;
}

interface DataSource {
  id: number;
  name: string;
  displayName: string;
  description: string;
  appliesTo: string;
  technology: string;
  collectMethod: CollectMethod;
  collectInterval: number;
  hasMultiInstances: boolean;
  useWildValueAsUUID: boolean;
  collectorAttribute: CollectorAttribute;
  enableAutoDiscovery: boolean;
  autoDiscoveryConfig: AutoDiscoveryConfig | null;
  dataPoints: DataPoint[];
}

type CollectMethod = 
  | 'script'       // Single script per instance
  | 'batchscript'  // One script for all instances
  | 'snmp'
  | 'wmi'
  | 'jdbc'
  | 'jmx'
  | 'perfmon'
  | 'webpage'
  | 'dns'
  | 'internal';
```

### Script Extraction Helper

```typescript
function extractScripts(ds: DataSource): { 
  collection: string | null; 
  ad: string | null; 
  language: 'groovy' | 'powershell' | 'linux' | 'windows';
} {
  // Determine language from scriptType
  const scriptType = ds.collectorAttribute?.scriptType;
  let language: 'groovy' | 'powershell' | 'linux' | 'windows' = 'groovy';
  
  if (scriptType === 'powerShell') {
    language = 'powershell';
  } else if (ds.collectorAttribute?.linuxScript) {
    language = 'linux';
  } else if (ds.collectorAttribute?.windowsScript) {
    language = 'windows';
  }
  
  // Extract collection script
  let collection: string | null = null;
  if (ds.collectorAttribute?.groovyScript) {
    collection = ds.collectorAttribute.groovyScript;
  } else if (ds.collectorAttribute?.linuxScript) {
    collection = ds.collectorAttribute.linuxScript;
  } else if (ds.collectorAttribute?.windowsScript) {
    collection = ds.collectorAttribute.windowsScript;
  }
  
  // Extract AD script
  let ad: string | null = null;
  if (ds.autoDiscoveryConfig?.method?.groovyScript) {
    ad = ds.autoDiscoveryConfig.method.groovyScript;
  } else if (ds.autoDiscoveryConfig?.method?.linuxScript) {
    ad = ds.autoDiscoveryConfig.method.linuxScript;
  } else if (ds.autoDiscoveryConfig?.method?.winScript) {
    ad = ds.autoDiscoveryConfig.method.winScript;
  }
  
  return { collection, ad, language };
}
```

---

## PropertySource API

### List PropertySources

**Endpoint:**
```
GET /santaba/rest/setting/propertyrules
```

### Get PropertySource Details

**Endpoint:**
```
GET /santaba/rest/setting/propertyrules/{id}
```

**Response Structure:**
Similar to DataSource but focused on property discovery.

> ⚠️ **NEEDS VERIFICATION:** Confirm exact response structure.

---

## EventSource API

### List EventSources

**Endpoint:**
```
GET /santaba/rest/setting/eventsources
```

### Get EventSource Details

**Endpoint:**
```
GET /santaba/rest/setting/eventsources/{id}
```

---

## ConfigSource API

### List ConfigSources

**Endpoint:**
```
GET /santaba/rest/setting/configsources
```

### Get ConfigSource Details

**Endpoint:**
```
GET /santaba/rest/setting/configsources/{id}
```

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "errorMessage": "Authentication failed",
  "errorCode": 1401
}
```
*Action: Prompt user to re-authenticate in LM tab*

**403 Forbidden:**
```json
{
  "errorMessage": "CSRF token validation failed",
  "errorCode": 1403
}
```
*Action: Refresh CSRF token and retry*

**404 Not Found:**
```json
{
  "errorMessage": "Resource not found",
  "errorCode": 1404
}
```
*Action: Show user-friendly error, resource may have been deleted*

**429 Too Many Requests:**
```json
{
  "errorMessage": "Rate limit exceeded",
  "errorCode": 1429
}
```
*Action: Implement exponential backoff*

---

## Rate Limiting

### Rate Limit Headers

LogicMonitor returns rate limit information in response headers:

| Header | Description |
|--------|-------------|
| `X-Rate-Limit-Limit` | Request limit per window |
| `X-Rate-Limit-Remaining` | Requests left in current window |
| `X-Rate-Limit-Window` | Rolling window duration in seconds |

### Default Limits

| HTTP Method | Limit |
|-------------|-------|
| GET | 500/min |
| POST | 200/min |
| PUT | 200/min |
| PATCH | 250/min |
| DELETE | 300/min |

### Implementation Strategy

1. **Request Throttling:** Check `X-Rate-Limit-Remaining` before requests
2. **Exponential Backoff:** On 429, wait 1s, 2s, 4s, 8s...
3. **Caching:** Cache collector list, module search results

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Remaining Unknowns

1. **Collector cache behavior:** What happens when `CollectorDb.getInstance().getHost(hostname)` is called for a device not in the collector's cache? Returns null? Throws exception? Need to handle gracefully.

2. **PropertySource/EventSource/ConfigSource scripts:** Same structure as DataSource? Need to verify field names when implementing.
