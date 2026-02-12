# LogicMonitor IDE - Feature Specifications

## Feature Overview

| Feature | Priority | Phase | Status |
|---------|----------|-------|--------|
| Multi-portal detection | P0 | 1 | ✅ |
| Multi-collector selection | P0 | 1 | ✅ |
| Monaco Editor with Groovy/PowerShell | P0 | 1 | ✅ |
| Script execution via Debug API | P0 | 2 | ✅ |
| PowerShell token substitution | P0 | 2 | ✅ |
| Active Discovery mode with validation | P1 | 3 | ✅ |
| Collection mode with validation | P1 | 3 | ✅ |
| Batch Collection mode with validation | P1 | 3 | ✅ |
| LogicModule browser | P1 | 4 | ✅ |
| LogicModule search | P1 | 4 | ✅ |
| Module lineage & diff | P1 | 4 | ✅ |
| Module commit from IDE | P1 | 4 | ✅ |
| Snippet library | P2 | 5 | ✅ |
| Execution history | P2 | 5 | ✅ |
| Command palette | P2 | 5 | ✅ |
| Resource tree context menu | P2 | 5 | ✅ |
| Local file open/save | P2 | 6 | ✅ |

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

## Phase 2 Features ✅ COMPLETE

### F2.1 Script Execution via Debug API ✅

**Description:**  
Execute scripts directly via LogicMonitor's Debug API, bypassing the native debug UI.

**User Story:**  
As a user, I want to run my script and see results directly in the IDE without switching to the LM debug console.

**Implementation:**

1. **ScriptExecutor** orchestrates the full flow
2. **CSRF Token Acquisition** with 3-level fallback:
   - Try cached token
   - Try refresh for portal
   - Re-discover all portals and retry
3. **Groovy Execution:**
   - Prepends hostProps preamble if hostname provided
   - Uses `hostId=null` with CollectorDb preamble approach
4. **PowerShell Execution:**
   - Detects `##TOKEN##` patterns
   - Prefetches properties via Groovy if tokens found
   - Substitutes tokens with property values
   - Missing properties become empty strings

**Acceptance Criteria:**
- [x] Groovy scripts execute successfully
- [x] PowerShell scripts execute successfully
- [x] Shows execution progress indicator (spinner)
- [x] Displays full output on completion
- [x] Handles errors gracefully
- [x] Status badges (Running, Complete, Error)
- [x] Duration and timing display
- [x] Copy output button

**API Flow:**
```
POST /santaba/rest/debug/?collectorId={id}
Body: { "cmdline": "!groovy hostId=null \n {preamble}{script}" }
Response: { "sessionId": "abc123" }

GET /santaba/rest/debug/{sessionId}?collectorId={id}
Response: { "output": "...", "cmdline": null (when complete) }
```

---

### F2.2 PowerShell Property Token Substitution ✅

**Description:**  
Provide device properties to PowerShell scripts via `##PROPERTY.NAME##` token substitution, matching LogicMonitor's native behavior.

**User Story:**  
As a user writing PowerShell scripts, I want to use `##SYSTEM.HOSTNAME##` tokens just like in real DataSources so my scripts are directly usable in LogicMonitor.

**Implementation:**

Uses token substitution (not `$hostProps` injection) to match LM's native approach:

1. **Token Detection:** Check script for `##PROPERTY.NAME##` patterns
2. **Property Prefetch:** If tokens found AND hostname provided:
   - Execute Groovy script via CollectorDb
   - Parse JSON response into property map
3. **Token Substitution:**
   - Replace `##PROPERTY.NAME##` with actual values
   - Case-insensitive property lookup
   - Missing properties → empty string
4. **Execute:** Run the substituted script

**Groovy Prefetch Script:**
```groovy
import groovy.json.JsonOutput
import com.santaba.agent.collector3.CollectorDb

def host = CollectorDb.getInstance().getHost("hostname")
if (host == null) {
  println "{}"
  return 0
}
def props = [:]
def hostProps = host.getProperties()
for (key in hostProps.keySet()) {
  props[key] = hostProps.get(key)?.toString() ?: ""
}
println JsonOutput.toJson(props)
return 0
```

**PowerShell Token Pattern:**
```powershell
# Before substitution
$hostname = "##SYSTEM.HOSTNAME##"
$displayName = "##SYSTEM.DISPLAYNAME##"

# After substitution
$hostname = "10.0.0.1"
$displayName = "WebServer01"
```

**Acceptance Criteria:**
- [x] `##TOKEN##` patterns detected correctly
- [x] Property prefetch via CollectorDb works
- [x] Case-insensitive property lookup
- [x] Missing properties replaced with empty string
- [x] Warning shown for missing properties
- [x] Warning shown if prefetch fails
- [x] Prefetch skipped if no tokens in script (optimization)

**Resolved Questions:**
- **Device not in cache:** `CollectorDb.getInstance().getHost()` returns `null`. We handle this by returning empty JSON `{}` and substituting all tokens with empty strings.
- **ParamMap iteration:** Use `keySet()` + `get(key)`, not `.each { k, v -> }` or `.entrySet()`.

---

### F2.3 Language Switch Confirmation ✅

**Description:**  
When switching languages (Groovy ↔ PowerShell) with unsaved changes, show a confirmation dialog.

**User Story:**  
As a user, I want to be warned before losing my script changes when switching languages.

**Implementation:**

1. **Dirty Detection:** Track if script has been modified via `isDirty` flag
2. **Toggle Handler:** Check `isDirty` before switching languages
3. **Confirmation Dialog:** AlertDialog with warning icon
   - Title: "Switch to {language}?"
   - Description: Explains changes will be lost
   - Cancel: Closes dialog, keeps current script
   - "Switch & Reset": Confirms switch, loads default template

**Acceptance Criteria:**
- [x] Dialog appears when switching with unsaved changes
- [x] Correct template loaded for new language
- [x] Cancel preserves current script
- [x] Confirm resets to default template
- [x] `isDirty` flag reset after template load

---

## Phase 3 Features ✅ COMPLETE

### F3.1 Active Discovery Mode ✅

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
- [x] Parses `##` delimited format
- [x] Displays instances in table
- [x] Shows validation errors inline
- [x] Counts valid/invalid instances
- [x] Explains errors clearly

---

### F3.2 Collection Mode ✅

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
| Batchscript: wildvalue no spaces, =, :, \, # | Error (same rules as instance ID) |
| Batchscript: wildvalue max 1024 chars | Error |

**Acceptance Criteria:**
- [x] Parses `=` delimited format
- [x] Displays datapoints in table
- [x] Validates numeric values
- [x] Shows errors for non-numeric
- [x] Ignores non-matching lines (with warning)
- [x] Supports batchscript format with wildvalue prefix
- [x] Groups by instance when in batchscript mode
- [x] Validates wildvalue with same rules as instance ID

### F3.3 Execution Context Dialog ✅

**Description:**  
Prompt users for execution context (wildvalue or datasourceId) based on the selected mode.

**User Story:**  
As a user running collection scripts, I want to provide the correct context (wildvalue for single instance, datasourceId for batch) so my scripts execute properly.

**Behavior:**
1. **Collection Mode:** Prompts for wildvalue (the instance to collect data for)
2. **Batch Collection Mode:** Prompts for datasourceId (to fetch datasourceinstanceProps)

**Implementation:**
- `ExecutionContextDialog` component renders based on `pendingExecution.mode`
- Values are persisted and pre-filled on subsequent runs
- Dialog always appears for collection/batchcollection modes

**Acceptance Criteria:**
- [x] Dialog prompts for wildvalue in collection mode
- [x] Dialog prompts for datasourceId in batch collection mode
- [x] Values are pre-filled from previous runs
- [x] Dialog validates required fields
- [x] Appropriate icons and descriptions per mode

### F3.4 Groovy Preamble with Batch Collection Support ✅

**Description:**  
Enhanced Groovy preamble that provides `datasourceinstanceProps` for batch collection scripts.

**User Story:**  
As a developer running batch collection scripts, I want `datasourceinstanceProps` to be populated so my scripts can access instance properties.

**Implementation:**
Uses `CollectorDb.getInstance().getDatasourceInstanceProps(hostname, datasourceId)` to fetch instance properties:

```groovy
def dsId = new String("BASE64_DATASOURCEID".decodeBase64());
if (dsId) {
  def dsParam = dsId.isInteger() ? dsId.toInteger() : dsId;
  datasourceinstanceProps = collectorDb.getDatasourceInstanceProps(hostname, dsParam);
}
```

**Acceptance Criteria:**
- [x] Preamble defines `datasourceinstanceProps` map
- [x] Preamble defines `taskProps` with pollinterval
- [x] datasourceId is base64-encoded to handle special chars
- [x] Supports both numeric ID and string name for datasource

---

## Phase 4 Features ✅ COMPLETE

### F4.1 LogicModule Browser ✅

**Description:**  
Browse LogicModules across 7 module types in the selected portal, preview scripts in read-only Monaco editors, and load them into the main editor.

**User Story:**  
As a user, I want to load existing LogicModule scripts so I can test and debug them without navigating the LM UI.

**Supported Module Types:**
| Type | Endpoint | Filter |
|------|----------|--------|
| DataSource | `/setting/datasources` | `collectMethod~"script"` |
| ConfigSource | `/setting/configsources` | `collectMethod~"script"` |
| TopologySource | `/setting/topologysources` | `collectMethod~"script"` |
| PropertySource | `/setting/propertyrules` | None (always script) |
| LogSource | `/setting/logsources` | `collectMethod~"script"` (post-filtered) |
| DiagnosticSource | `/setting/diagnosticsources` | None |
| EventSource | `/setting/eventsources` | Script-only (embedded) |

**Behavior:**
1. Click "Open from LMX" button in toolbar (requires portal selection)
2. Toggle between 7 module types
3. Search modules by name, displayName, or appliesTo
4. Select a module to see script preview
5. AD-enabled modules show dual-pane view (AD left, Collection right)
6. Click "Load" to load script into editor
7. Confirmation dialog if editor has unsaved changes
8. Auto-sets language and execution mode based on loaded script

**Acceptance Criteria:**
- [x] Browse all 7 module types
- [x] Filter by script-based collection methods
- [x] Search modules by name/displayName/appliesTo
- [x] Show collectMethod, AD status, appliesTo in list
- [x] Dual-pane preview for AD-enabled modules
- [x] Single-pane preview for non-AD modules
- [x] Load Groovy scripts with proper mode
- [x] Load PowerShell scripts with proper mode
- [x] Confirmation when loading with unsaved changes
- [x] Auto-set language (Groovy/PowerShell)
- [x] Auto-set mode (AD/Collection/Batch Collection)

**Implementation Files:**
- `src/background/module-loader.ts` - API client
- `src/editor/components/LogicModuleBrowser.tsx` - Main dialog
- `src/editor/components/ModulePreview.tsx` - Dual-pane preview

### F4.2 LogicModule Search ✅

**Description:**  
Search across module scripts (collection + AD) and datasource datapoints, with highlighted results and quick actions.

**User Story:**  
As a user, I want to find a specific snippet, deprecated call, or datapoint definition across all modules so I can reuse or update it.

**Behavior:**
1. Open the search dialog (⌘⇧F) from Actions, Command Palette, or Welcome screen
2. Choose Script or Datapoint search mode
3. Select match type (substring, exact, regex) and case sensitivity
4. View grouped results by module type
5. Preview scripts with match highlighting
6. Load into editor or create a new freeform file
7. Datapoints show alert thresholds and timing details

**Acceptance Criteria:**
- [x] Search across all module types with script + AD scanning
- [x] Highlight matches in Monaco preview (line + inline)
- [x] Load as module-backed tab with commit support
- [x] Create new freeform tab from a script
- [x] Datapoint search matches name + description
- [x] Datapoint details show thresholds, no-data rules, and timing

**Implementation Files:**
- `src/editor/components/LogicModuleSearch.tsx` - Search dialog + preview
- `src/background/module-searcher.ts` - Search logic (scripts + datapoints)
- `src/background/module-loader.ts` - Datasource list with datapoints
- `src/shared/types.ts` - Search request/response types

---

## Phase 5 Features ✅ COMPLETE

### F5.1 Resource Tree Context Menu ✅

**Description:**  
Add a context menu item to the LM resource tree to open the IDE with device context pre-filled.

**User Story:**  
As a user browsing devices in LM, I want to right-click and "Open in LogicMonitor IDE" to quickly debug scripts for that device.

**Behavior:**
1. Content script monitors for context menu opens
2. Injects "Open in LogicMonitor IDE" menu item
3. Extracts device info (hostname, collector, properties)
4. Opens editor with context pre-populated

**Implementation:**
- `src/content/index.ts` - MutationObserver watches for MUI menu popups
- Injects styled menu item that matches LM's Material UI design
- Extracts device context from URL and page DOM

**Acceptance Criteria:**
- [x] Menu item appears on device right-click
- [x] Opens editor window
- [x] Pre-fills hostname
- [x] Pre-selects correct collector
- [x] Loads device properties

---

### F5.2 Command Palette ✅

**Description:**  
Quick-access command palette for common actions and navigation.

**User Story:**  
As a power user, I want keyboard-driven access to all IDE functions via a command palette.

**Commands:**
- Run Script (⌘↵)
- Save Script to File (⌘S)
- Copy Output (⌘⇧C)
- Clear Output
- Refresh Portals
- Refresh Collectors (⌘R)
- Open from LogicModule (⌘O)
- Execution History (⌘H)
- Settings (⌘,)
- Switch Portal

**Implementation:**
- `src/editor/components/CommandPalette.tsx` - Uses shadcn Command component
- Global keyboard shortcuts registered in component
- Fuzzy search via cmdk library

**Acceptance Criteria:**
- [x] Opens with Ctrl+K or Cmd+K
- [x] Fuzzy search commands
- [x] Shows keyboard shortcuts
- [x] Closes on Escape
- [x] Switch portal commands dynamically listed

---

### F5.3 Execution History ✅

**Description:**  
Track and display history of script executions for reference.

**User Story:**  
As a user, I want to see my recent executions so I can compare results or re-run previous scripts.

**Stored Data:**
```typescript
interface ExecutionHistoryEntry {
  id: string;
  timestamp: number;
  portal: string;
  collector: string;
  collectorId: number;
  hostname?: string;
  language: ScriptLanguage;
  mode: ScriptMode;
  script: string;
  output: string;
  status: 'success' | 'error';
  duration: number;
}
```

**Implementation:**
- `src/editor/components/ExecutionHistory.tsx` - Sheet component with scrollable history
- Persisted to `chrome.storage.local` with key `lm-ide-execution-history`
- Max entries configurable in settings (default 50)

**Acceptance Criteria:**
- [x] Stores last 50 executions (configurable)
- [x] Shows in slide-out sheet
- [x] Click to view details
- [x] Option to reload script
- [x] Clear history option

---

### F5.4 Settings/Preferences ✅

**Description:**  
User preferences dialog for editor customization.

**Implementation:**
- `src/editor/components/SettingsDialog.tsx` - Dialog with grouped settings
- Persisted to `chrome.storage.local` with key `lm-ide-preferences`

**Settings:**
- Theme (dark/light/system)
- Font size (10-24px)
- Tab size (2-8 spaces)
- Word wrap toggle
- Minimap toggle
- Default language
- Default mode
- History size (10-100)

**Acceptance Criteria:**
- [x] Opens from toolbar or command palette (⌘,)
- [x] All settings persist across sessions
- [x] Reset to defaults option
- [x] Theme changes apply immediately

---

### F5.5 Retain Code on Relaunch ✅

**Description:**  
Auto-save script to local storage and restore on reopen.

**Implementation:**
- Draft auto-saved to `chrome.storage.local` with key `lm-ide-draft`
- Debounced save (2 seconds after last change)
- On app mount, checks for draft and shows restore dialog
- Stores: script, language, mode, hostname, lastModified timestamp

**Acceptance Criteria:**
- [x] Script auto-saves as user types
- [x] Prompt to restore on relaunch
- [x] Option to discard draft
- [x] Draft cleared after restore

---

### F5.6 Save to File ✅

**Description:**  
Export script to local file (.groovy / .ps1).

**Implementation:**
- Save button in toolbar and command palette (⌘S)
- Uses File System Access API with fallback to download
- Auto-detects extension based on language

**Acceptance Criteria:**
- [x] Save button in toolbar
- [x] Correct file extension (.groovy / .ps1)
- [x] Works in all browsers (fallback for Firefox)

---

### F5.7 Device/Hostname Dropdown ✅

**Description:**  
Replace hostname text input with searchable device dropdown.

**Implementation:**
- Combobox populated when collector is selected
- Calls `GET /santaba/rest/device/devices?filter=currentCollectorId:{id}`
- Shows displayName (primary) and name (secondary) for each device
- Clears when portal or collector changes

**Acceptance Criteria:**
- [x] Searchable dropdown
- [x] Shows displayName and name
- [x] Populated from selected collector's devices
- [x] Clears on portal/collector change
- [x] Clear button to reset

---

## Phase 6 Features ✅ COMPLETE

### F6.1 Open File from Disk

**Description:**  
Open local script files using the File System Access API.

**User Story:**  
As a user, I want to open script files from my local file system so I can edit and test existing scripts.

**Implementation:**
- Use `window.showOpenFilePicker()` for file selection
- Support `.groovy`, `.ps1`, and `.txt` files
- Create new tab with file content
- Store `FileSystemFileHandle` in IndexedDB for future saves
- Track `originalContent` for dirty state detection

**Acceptance Criteria:**
- [ ] Ctrl+O opens file picker dialog
- [ ] Selected file opens in new tab
- [ ] File name displayed in tab
- [ ] Language auto-detected from extension
- [ ] File handle persisted for direct save

---

### F6.2 Save File Directly

**Description:**  
Save files directly to disk without download dialog.

**User Story:**  
As a user, I want to press Ctrl+S to save my changes directly to the original file.

**Implementation:**
- Check for existing `FileSystemFileHandle` in IndexedDB
- If handle exists: write directly using `handle.createWritable()`
- If no handle: trigger Save As flow
- Update `originalContent` after successful save

**Acceptance Criteria:**
- [ ] Ctrl+S saves to existing file location
- [ ] No download dialog for files with handles
- [ ] Unsaved indicator disappears after save
- [ ] New files trigger Save As dialog

---

### F6.3 Save As

**Description:**  
Save file to a new location with file picker.

**User Story:**  
As a user, I want to save my script to a specific location on disk.

**Implementation:**
- Use `window.showSaveFilePicker()` for location selection
- Suggest file name based on current tab name
- Store new handle in IndexedDB
- Update tab with new file name

**Acceptance Criteria:**
- [ ] Ctrl+Shift+S always shows save picker
- [ ] Suggested name matches tab name
- [ ] Correct extension based on language
- [ ] Tab name updates to new file name

---

### F6.4 Unsaved Changes Indicator

**Description:**  
VS Code-like visual indicator for unsaved changes in tabs.

**User Story:**  
As a user, I want to see which files have unsaved changes so I don't lose my work.

**Implementation:**
- Track `originalContent` per tab (content when opened/saved)
- Compute dirty state: `content !== originalContent`
- Show filled dot (●) for dirty tabs
- On hover, dot transitions to X for closing

**Acceptance Criteria:**
- [ ] Dot appears when content differs from saved
- [ ] New files always show dot
- [ ] Dot disappears after save
- [ ] Hover shows X for closing

---

### F6.5 File Handle Persistence

**Description:**  
Persist file handles across browser sessions using IndexedDB.

**User Story:**  
As a user, I want my open files to remain accessible after closing and reopening the browser.

**Implementation:**
- Store handles in IndexedDB (`lm-ide-files` database)
- Key by tabId for matching to restored tabs
- Check permissions on app mount
- Show "Restore Access" button if permission needed

**Acceptance Criteria:**
- [ ] Handles saved to IndexedDB on file open
- [ ] Handles loaded on app mount
- [ ] Permission status checked per handle
- [ ] User can re-grant permission with single click

---

### F6.6 Permission Re-request Flow

**Description:**  
Handle permission re-request after browser restart.

**User Story:**  
As a user, I want to easily restore access to my files after the browser forgets permissions.

**Implementation:**
- Query permission status: `handle.queryPermission()`
- If status is 'prompt', show banner with "Restore Access" button
- On click, request permission (requires user gesture)
- Re-read file content if permission granted

**Acceptance Criteria:**
- [ ] Banner appears when permission needed
- [ ] Single click restores all file access
- [ ] Files remain editable even without permission (content in draft)
- [ ] Graceful degradation if permission denied

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
