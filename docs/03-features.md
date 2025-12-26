# LM IDE - Feature Specifications

## Feature Overview

| Feature | Priority | Phase |
|---------|----------|-------|
| Multi-portal detection | P0 | 1 |
| Multi-collector selection | P0 | 1 |
| Monaco Editor with Groovy/PowerShell | P0 | 1 |
| Script execution via Debug API | P0 | 2 |
| PowerShell hostProps support | P0 | 2 |
| Active Discovery mode with validation | P1 | 3 |
| Collection mode with validation | P1 | 3 |
| LogicModule browser (read-only) | P1 | 4 |
| Resource tree context menu | P2 | 5 |
| Command palette | P2 | 5 |
| Execution history | P2 | 5 |

---

## Phase 1 Features

### F1.1 Multi-Portal Detection

**Description:**  
Automatically detect all LogicMonitor portals the user has open in browser tabs.

**User Story:**  
As a user with access to multiple LM portals, I want the IDE to detect all my open portals so I can switch between them without re-authenticating.

**Behavior:**
1. On editor open, query all tabs matching `https://*.logicmonitor.com/*`
2. Group tabs by hostname (portal)
3. For each portal, fetch CSRF token via content script
4. Display portals in dropdown with status indicator

**Acceptance Criteria:**
- [ ] Detects all open LM tabs
- [ ] Groups by unique portal hostname
- [ ] Shows portal status (active session / expired)
- [ ] Allows switching portals without page reload
- [ ] Refreshes on window focus

**Edge Cases:**
- User not logged in → Show "Login required" status
- Session expired mid-use → Prompt to refresh
- No LM tabs open → Show empty state with instructions

---

### F1.2 Multi-Collector Selection

**Description:**  
Fetch and display all collectors for the selected portal, allowing execution on any collector.

**User Story:**  
As a user, I want to select any collector in my portal to run scripts against, not just the one from my current page.

**Behavior:**
1. When portal is selected, fetch collector list via API
2. Display in searchable combobox
3. Show collector status (online/offline/warning)
4. Cache results, refresh on demand

**Acceptance Criteria:**
- [ ] Lists all collectors for selected portal
- [ ] Searchable by name/description
- [ ] Shows status indicator
- [ ] Disables offline collectors (with explanation)
- [ ] Remembers last selected collector per portal

**API Endpoint:**
```
GET /santaba/rest/setting/collector/collectors
```

---

### F1.3 Monaco Editor Integration

**Description:**  
Integrate Monaco Editor with syntax highlighting for Groovy and PowerShell.

**User Story:**  
As a developer, I want a professional code editor with syntax highlighting and code assistance so I can write scripts efficiently.

**Behavior:**
1. Load Monaco Editor asynchronously
2. Configure for Groovy or PowerShell based on mode
3. Apply dark theme matching overall UI
4. Enable standard editor features (find, replace, folding)

**Acceptance Criteria:**
- [ ] Groovy syntax highlighting works
- [ ] PowerShell syntax highlighting works
- [ ] Theme matches UI (dark mode)
- [ ] Line numbers displayed
- [ ] Bracket matching works
- [ ] Ctrl+F opens find dialog
- [ ] Undo/Redo works

**LM-Specific Completions (P1):**
```typescript
// Groovy
hostProps.get("property.name")
instanceProps.get("property.name")
Snmp.get(hostname, oid)
Snmp.walk(hostname, oid)
WMI.query(hostname, query)
// etc.
```

---

## Phase 2 Features

### F2.1 Script Execution via Debug API

**Description:**  
Execute scripts directly via LogicMonitor's Debug API, bypassing the native debug UI.

**User Story:**  
As a user, I want to run my script and see results directly in the IDE without switching to the LM debug console.

**Behavior:**
1. User clicks "Run" or presses Ctrl+Enter
2. Script sent to service worker
3. Service worker calls Debug API with script
4. Poll for results until complete
5. Display output in Output Panel

**Acceptance Criteria:**
- [ ] Groovy scripts execute successfully
- [ ] PowerShell scripts execute successfully
- [ ] Shows execution progress indicator
- [ ] Displays full output on completion
- [ ] Handles errors gracefully
- [ ] Supports cancellation (if possible)

**API Flow:**
```
POST /santaba/rest/debug/?collectorId={id}
Body: { "cmdline": "!groovy hostId={id} \n {script}" }
Response: { "sessionId": "abc123" }

GET /santaba/rest/debug/{sessionId}?collectorId={id}
Response: { "output": "...", "status": "complete" }
```

---

### F2.2 PowerShell hostProps Support

**Description:**  
Provide hostProps and instanceProps to PowerShell scripts by pre-fetching via Groovy.

**User Story:**  
As a user writing PowerShell scripts, I want access to device properties just like I have in Groovy so I can write context-aware scripts.

**Behavior:**
1. If language is PowerShell and hostname is provided:
   a. Execute small Groovy script to fetch hostProps as JSON
   b. Parse JSON response
   c. Inject as PowerShell hashtable at top of user script
2. Execute combined script

**Groovy Prefetch Script:**
```groovy
import groovy.json.JsonOutput
import com.santaba.agent.collector3.CollectorDb

def host = CollectorDb.getInstance().getHost("##HOSTNAME##")
def props = host?.getProperties() ?: [:]
println JsonOutput.toJson(props)
return 0
```

**PowerShell Injection:**
```powershell
$hostProps = @{
    "system.hostname" = "10.0.0.1"
    "system.displayname" = "WebServer01"
    # ... all properties
}
$hostname = $hostProps["system.hostname"]

# User script below
```

**Acceptance Criteria:**
- [ ] hostProps available in PowerShell scripts
- [ ] Works with any device in the collector's cache
- [ ] JSON parsing handles all property types
- [ ] Error handling if device not found
- [ ] User informed if device not in cache

**Open Question:**  
> ⚠️ What happens if the device is not in the collector's cache? Need to investigate `CollectorDb.getInstance().getHost()` behavior for uncached devices.

---

## Phase 3 Features

### F3.1 Active Discovery Mode

**Description:**  
Parse and validate script output as Active Discovery format, showing instances in a table.

**User Story:**  
As a module developer, I want to see my AD output parsed and validated so I can ensure correct format before deploying.

**AD Output Format:**
```
instance_id##instance_name
instance_id##instance_name##description
instance_id##instance_name##description####auto.prop=value&auto.prop2=value
```

**Validation Rules:**
| Rule | Severity |
|------|----------|
| Instance ID is required | Error |
| Instance ID max 1024 chars | Error |
| Instance ID no spaces, =, :, \, # | Error |
| Instance name max 255 chars | Warning |
| Description optional | Info |
| Properties must be key=value format | Error |

**Acceptance Criteria:**
- [ ] Parses `##` delimited format
- [ ] Displays instances in table
- [ ] Shows validation errors inline
- [ ] Counts valid/invalid instances
- [ ] Explains errors clearly

---

### F3.2 Collection Mode

**Description:**  
Parse and validate script output as Collection format, showing datapoints in a table.

**User Story:**  
As a module developer, I want to see my collection output parsed so I can verify datapoint values.

**Collection Method Types:**

| Method | WildValue Behavior | Output Format |
|--------|-------------------|---------------|
| `script` | Each instance runs separately with its wildvalue | `datapoint=value` |
| `batchscript` | All instances run at once in single execution | `wildvalue.datapoint=value` |

**Standard Script Output Format:**
```
datapoint_name=numeric_value
another_datapoint=123.45
```

**Batchscript Output Format:**
```
eth0.InOctets=12345678
eth0.OutOctets=87654321
eth1.InOctets=11111111
eth1.OutOctets=22222222
```

**Validation Rules:**
| Rule | Severity |
|------|----------|
| Must be key=value format | Error |
| Value must be numeric | Error |
| Datapoint name valid chars | Warning |
| Batchscript: wildvalue prefix required | Error (if batchscript mode) |

**Acceptance Criteria:**
- [ ] Parses `=` delimited format
- [ ] Displays datapoints in table
- [ ] Validates numeric values
- [ ] Shows errors for non-numeric
- [ ] Ignores non-matching lines (with warning)
- [ ] Supports batchscript format with wildvalue prefix
- [ ] Groups by instance when in batchscript mode

---

## Phase 4 Features

### F4.1 LogicModule Browser (Read-Only)

**Description:**  
Search and browse LogicModules in the selected portal, loading their scripts into the editor.

**User Story:**  
As a user, I want to load existing DataSource scripts so I can test and debug them without navigating the LM UI.

**Behavior:**
1. Open module browser (Ctrl+O or button)
2. Search by name
3. Display matching modules with metadata
4. Click "Load AD" or "Load Collection" to load script
5. Script replaces editor content

**Acceptance Criteria:**
- [ ] Search DataSources by name
- [ ] Show module type, collection method
- [ ] Load Groovy AD scripts
- [ ] Load Groovy Collection scripts
- [ ] Load PowerShell scripts
- [ ] Clear indication of what's being loaded

**API Endpoint:**
```
GET /santaba/rest/setting/datasources?filter=name~"{query}"
GET /santaba/rest/setting/datasources/{id}
```

**Open Question:**  
> ⚠️ Need to verify exact field names for script content in DataSource response (groovyScript? scriptContent?). Investigate API response structure.

---

## Phase 5 Features

### F5.1 Resource Tree Context Menu

**Description:**  
Add a context menu item to the LM resource tree to open the IDE with device context pre-filled.

**User Story:**  
As a user browsing devices in LM, I want to right-click and "Open in LM IDE" to quickly debug scripts for that device.

**Behavior:**
1. Content script monitors for context menu opens
2. Injects "Open in LM IDE" menu item
3. Extracts device info (hostname, collector, properties)
4. Opens editor with context pre-populated

**Acceptance Criteria:**
- [ ] Menu item appears on device right-click
- [ ] Opens editor window
- [ ] Pre-fills hostname
- [ ] Pre-selects correct collector
- [ ] Loads device properties

---

### F5.2 Command Palette

**Description:**  
Quick-access command palette for common actions and navigation.

**User Story:**  
As a power user, I want keyboard-driven access to all IDE functions via a command palette.

**Commands:**
- Run Script
- Copy Output
- Clear Output
- Refresh Collectors
- Switch Portal
- Load Module
- Open Settings
- Toggle Output Panel
- Toggle Context Panel

**Acceptance Criteria:**
- [ ] Opens with Ctrl+K or Cmd+K
- [ ] Fuzzy search commands
- [ ] Shows keyboard shortcuts
- [ ] Recent commands at top
- [ ] Closes on Escape

---

### F5.3 Execution History

**Description:**  
Track and display history of script executions for reference.

**User Story:**  
As a user, I want to see my recent executions so I can compare results or re-run previous scripts.

**Stored Data:**
```typescript
interface ExecutionRecord {
  id: string;
  timestamp: Date;
  script: string;
  language: 'groovy' | 'powershell';
  mode: 'ad' | 'collection' | 'freeform';
  portal: string;
  collector: string;
  hostname?: string;
  output: string;
  status: 'success' | 'error';
  duration: number;
}
```

**Acceptance Criteria:**
- [ ] Stores last 50 executions
- [ ] Shows in sidebar or panel
- [ ] Click to view details
- [ ] Option to reload script
- [ ] Clear history option

---

## Future Features (Backlog)

### Script Templates
- Pre-built templates for common tasks
- User-defined templates

### Export to LogicModule
- Create new DataSource from script
- Update existing DataSource (careful!)

### Multi-Collector Comparison
- Run same script on multiple collectors
- Side-by-side output comparison

### Collaboration
- Share scripts via URL
- Import/export scripts

### Local File System
- Save scripts to local files
- Open from file system

