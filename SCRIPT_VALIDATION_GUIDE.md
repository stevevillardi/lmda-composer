# Script Validation Guide

This document describes how script validation works for each LogicMonitor module type in the LMDA Composer extension.

## Script Modes Overview

The extension uses 4 user-facing script modes:

| Mode | Label | Description |
|------|-------|-------------|
| `freeform` | Freeform | No validation - raw output displayed as-is |
| `ad` | Active Discovery | Parses instance discovery output |
| `collection` | Collection | Parses output based on module type |
| `batchcollection` | Batch Collection | Parses JSON batch output for multiple instances |

**Important:** While the UI shows only 4 modes, the parser internally uses the `moduleType` from the loaded script to apply specialized validation. This means a TopologySource script shows "Collection" mode but gets topology-specific validation.

---

## Module Type → Mode Mapping

### DataSource

| Script Type | Collect Method | UI Mode | Internal Parsing |
|-------------|----------------|---------|------------------|
| Active Discovery | N/A | `ad` | Instance parsing (##-delimited) |
| Collection | `script` | `collection` | Key=value datapoints |
| Collection | `batchscript` | `batchcollection` | JSON with values |

### ConfigSource

| Script Type | Collect Method | UI Mode | Internal Parsing |
|-------------|----------------|---------|------------------|
| Active Discovery | N/A | `ad` | Instance parsing (##-delimited) |
| Collection | `script` | `collection` | Raw configuration text |
| Collection | `batchscript` | `batchcollection` | JSON with configuration |

### TopologySource

| Script Type | UI Mode | Internal Parsing |
|-------------|---------|------------------|
| Collection | `collection` | JSON with vertices/edges arrays |

### EventSource

| Script Type | UI Mode | Internal Parsing |
|-------------|---------|------------------|
| Collection | `collection` | JSON array of events |

### PropertySource

| Script Type | UI Mode | Internal Parsing |
|-------------|---------|------------------|
| Collection | `collection` | Key=value properties |

### LogSource

| Script Type | UI Mode | Internal Parsing |
|-------------|---------|------------------|
| Collection | `collection` | JSON or line-by-line log entries |

---

## Validation Details by Mode

### Freeform Mode
- **No validation performed**
- Output is displayed as raw text
- Used when no module is loaded or for manual script testing
- User can manually inspect the output

---

### Active Discovery Mode (`ad`)

**Expected Output Format:**
```
instanceID##instanceName##instanceDescription####auto.prop=value&prop2=value
```

**Parsing Rules:**
- Each line represents one discovered instance
- Fields are separated by `##`
- Optional properties section after `####`
- Empty lines and comment lines are skipped

**Validation Checks:**
| Check | Severity | Message |
|-------|----------|---------|
| Missing instance ID | Error | "Instance ID is required" |
| ID exceeds 1024 chars | Error | "Instance ID exceeds maximum length" |
| ID has invalid chars (space, =, :, \, #) | Error | "Instance ID contains invalid characters" |
| Name exceeds 255 chars | Warning | "Instance name exceeds recommended length" |
| Invalid property format | Error | "Invalid property format" |

**Example Valid Output:**
```
disk-C##C: Drive##Primary disk####auto.type=local&auto.size=500GB
disk-D##D: Drive##Secondary disk
eth0##Ethernet 0##Primary network interface####auto.speed=1Gbps
```

---

### Collection Mode - DataSource (`collection`)

**Expected Output Format:**
```
datapointName=numericValue
```

**Validation Checks:**
| Check | Severity | Message |
|-------|----------|---------|
| Missing `=` delimiter | — | Marked as unparsed line |
| Empty datapoint name | Error | "Datapoint name is empty" |
| Non-numeric value | Error | "Value 'X' is not a valid number" |
| Non-standard name chars | Warning | "Datapoint name contains non-standard characters" |

**Example Valid Output:**
```
CPUUsage=45.5
MemoryUsage=78.2
DiskIOPS=1250
```

---

### Collection Mode - ConfigSource (`collection`)

**Expected Output:** Raw configuration text

**Validation Checks:**
| Check | Severity | Message |
|-------|----------|---------|
| Empty output | Warning | "Configuration output is empty" |

**Example Valid Output:**
```
hostname: server01
version: 1.2.3
last_updated: 2024-01-15
```

---

### Collection Mode - TopologySource (`collection`)

**Expected Output Format:**
```json
{
  "vertices": [
    { "id": "node1", "name": "Node 1", "type": "Device" }
  ],
  "edges": [
    { "from": "node1", "to": "node2", "type": "Network" }
  ]
}
```

**Validation Checks:**
| Check | Severity | Message |
|-------|----------|---------|
| Invalid JSON | — | Marked as unparsed with error |
| Vertex missing id/name | Error | "Vertex must have an id or name" |
| Edge missing `from` | Error | "Edge must have a 'from' field" |
| Edge missing `to` | Error | "Edge must have a 'to' field" |
| Missing vertices array | — | Listed in unparsed lines |
| Missing edges array | — | Listed in unparsed lines |

---

### Collection Mode - EventSource (`collection`)

**Expected Output Format:**
```json
[
  {
    "happenedOn": "2024-01-15T10:30:00Z",
    "severity": "error",
    "message": "Disk failure detected",
    "source": "storage-controller"
  }
]
```

Or nested under "events" key:
```json
{
  "events": [...]
}
```

**Validation Checks:**
| Check | Severity | Message |
|-------|----------|---------|
| Invalid JSON | — | Marked as unparsed with error |
| Event missing message and timestamp | Warning | "Event should have a message or timestamp" |
| Unknown severity | Warning | "Unknown severity. Expected: critical, error, warn, info, debug" |

---

### Collection Mode - PropertySource (`collection`)

**Expected Output Format:**
```
propertyName=propertyValue
```

**Validation Checks:**
| Check | Severity | Message |
|-------|----------|---------|
| Missing `=` delimiter | — | Marked as unparsed line |
| Empty property name | Error | "Property name cannot be empty" |
| Non-standard name chars | Warning | "Property name contains non-standard characters" |
| Duplicate property name | Warning | "Duplicate property name" |

**Example Valid Output:**
```
auto.os.version=Ubuntu 22.04
auto.kernel=5.15.0
auto.memory.total=32GB
```

---

### Collection Mode - LogSource (`collection`)

**Expected Output Format (JSON):**
```json
[
  {
    "timestamp": "2024-01-15T10:30:00Z",
    "message": "Application started"
  }
]
```

Or plain text (one entry per line):
```
2024-01-15T10:30:00Z Application started
2024-01-15T10:30:01Z Loading configuration
```

**Validation Checks:**
| Check | Severity | Message |
|-------|----------|---------|
| Non-standard timestamp format | Warning | "Timestamp may not be in a standard format" |

---

### Batch Collection Mode (`batchcollection`)

DataSource BatchScript supports **two output formats**: JSON and line-based. The parser tries JSON first, then falls back to line-based parsing.

#### DataSource Batch Output - JSON Format
```json
{
  "data": {
    "instance1": {
      "values": {
        "metric1": 100,
        "metric2": 200
      }
    },
    "instance2": {
      "values": {
        "metric1": 150,
        "metric2": 250
      }
    }
  }
}
```

#### DataSource Batch Output - Line-Based Format
```
instance1.metric1=100
instance1.metric2=200
instance2.metric1=150
instance2.metric2=250
```

**Validation Checks (Both Formats):**
| Check | Severity | Message |
|-------|----------|---------|
| Wildvalue has invalid chars (space, =, :, \, #) | Error | "Wildvalue contains invalid characters" |
| Wildvalue exceeds 1024 chars | Error | "Wildvalue exceeds maximum length" |
| Non-numeric metric value | Error | "Value 'X' is not a valid number" |
| Missing wildvalue prefix (line format) | Error | "Batchscript output requires wildvalue prefix" |

#### ConfigSource Batch Output - JSON Format
```json
{
  "data": {
    "instance1": {
      "configuration": "Config text for instance1"
    },
    "instance2": {
      "configuration": "Config text for instance2"
    }
  }
}
```

**Validation Checks:**
| Check | Severity | Message |
|-------|----------|---------|
| Wildvalue has invalid chars (:, #, \, space) | Error | "Wildvalue contains invalid characters" |
| Configuration not a string | Error | "Configuration must be a string" |
| Empty configuration | Warning | "Configuration is empty" |

---

## Script Execution Error Detection

Before parsing, the extension checks if the output contains a script execution error.

**Detected Patterns:**
- `Error when executing the script - <error message>`
- `Error when executing the script -\noutput:\n<output>`
- Lines starting with `Error:` or `ERROR:`

**When an error is detected:**
- The parser returns a `script_error` result type
- The Parsed tab shows a red error banner with the error message
- Any script output after the error is displayed below
- Validation tab shows the error in the issues list

**Example Error Output:**
```
Error when executing the script - NullPointerException at line 42
output:
Partial output before the error occurred
```

---

## Output Normalization

Before parsing, the extension strips common execution headers from script output:

**Stripped Lines:**
- Lines starting with `[Warning:`
- Empty lines (at the start)
- Lines matching `returns X` (exit code)
- Lines matching `output:` (output header)

**Example Raw Output:**
```
returns 0
output:
CPUUsage=45.5
MemoryUsage=78.2
```

**After Normalization:**
```
CPUUsage=45.5
MemoryUsage=78.2
```

---

## UI Display

### Tab Badge
Each tab shows a colored badge indicating the current mode:
- **Freeform**: Gray badge
- **Active Discovery**: Blue badge
- **Collection**: Green badge
- **Batch Collection**: Purple badge

### Parsed Output Tab
The Parsed Output tab shows specialized views based on the module type:
- **DataSource Collection**: Datapoints table with name, value, status
- **TopologySource**: Vertices table + Edges table
- **EventSource**: Events table with timestamp, severity, message
- **PropertySource**: Properties table with name, value
- **LogSource**: Log entries table with timestamp, message
- **ConfigSource**: Raw configuration viewer

### Validation Tab
The Validation tab shows:
1. **Summary Cards**: Total, Valid, Errors, Warnings counts
2. **All Valid Message**: Green card when no issues
3. **Issues List**: Grouped by line number with severity icons

---

## Testing Checklist

### DataSource - Active Discovery
- [ ] Load a DataSource with AD script
- [ ] Verify mode badge shows "Active Discovery" (blue)
- [ ] Run script and verify instances are parsed
- [ ] Test with duplicate instance IDs
- [ ] Test with invalid characters in ID (space, =, :, \, #)
- [ ] Test with empty instance ID

### DataSource - Collection (Script)
- [ ] Load a DataSource with script collect method
- [ ] Verify mode badge shows "Collection" (green)
- [ ] Run script and verify datapoints are parsed
- [ ] Test with non-numeric values
- [ ] Test with missing `=` delimiter

### DataSource - Batch Collection
- [ ] Load a DataSource with batchscript collect method
- [ ] Verify mode badge shows "Batch Collection" (purple)
- [ ] Run script and verify JSON is parsed
- [ ] Verify each instance's metrics are displayed with wildvalue
- [ ] Test with invalid JSON (should fall back to line parsing)

### ConfigSource - Active Discovery
- [ ] Load a ConfigSource with AD script
- [ ] Verify mode badge shows "Active Discovery" (blue)
- [ ] Same validation as DataSource AD

### ConfigSource - Collection (Script)
- [ ] Load a ConfigSource with script collect method
- [ ] Verify mode badge shows "Collection" (green)
- [ ] Verify raw configuration is displayed
- [ ] Test with empty configuration (should show warning)

### ConfigSource - Batch Collection
- [ ] Load a ConfigSource with batchscript collect method
- [ ] Verify mode badge shows "Batch Collection" (purple)
- [ ] Run script and verify JSON is parsed
- [ ] Verify configuration data is displayed for each instance
- [ ] Test with empty configuration (should show warning)

### TopologySource
- [ ] Load a TopologySource module
- [ ] Verify mode badge shows "Collection" (green)
- [ ] Run script and verify vertices table is displayed
- [ ] Verify edges table is displayed
- [ ] Test with missing vertices array
- [ ] Test with missing edge "from"/"to" fields
- [ ] Test with invalid JSON

### EventSource
- [ ] Load an EventSource module
- [ ] Verify mode badge shows "Collection" (green)
- [ ] Run script and verify events table is displayed
- [ ] Test with various severity levels
- [ ] Test with unknown severity value

### PropertySource
- [ ] Load a PropertySource module
- [ ] Verify mode badge shows "Collection" (green)
- [ ] Run script and verify properties table is displayed
- [ ] Test with duplicate property names
- [ ] Test with non-standard property name characters

### LogSource
- [ ] Load a LogSource module
- [ ] Verify mode badge shows "Collection" (green)
- [ ] Run script and verify log entries are displayed
- [ ] Test with JSON format
- [ ] Test with plain text format
- [ ] Test with various timestamp formats

### Mode Switching
- [ ] Create a new freeform script
- [ ] Switch to AD mode manually
- [ ] Write AD-formatted output and verify parsing
- [ ] Switch to Collection mode
- [ ] Write collection-formatted output and verify parsing
- [ ] Switch to Batch Collection mode
- [ ] Write JSON batch output and verify parsing
