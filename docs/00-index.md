# LogicMonitor IDE - Documentation Index

## Project Overview

LogicMonitor IDE is a Chrome Extension that provides an enhanced script development and debugging experience for LogicMonitor power users. It replaces the native debug dialog with a full-featured Monaco-based IDE, enabling multi-portal and multi-collector script execution with proper validation.

---

## Documentation Structure

| Document | Description |
|----------|-------------|
| [01-architecture.md](./01-architecture.md) | Extension architecture, component breakdown, communication flow |
| [02-ui-layout.md](./02-ui-layout.md) | UI design, component specifications, keyboard shortcuts |
| [03-features.md](./03-features.md) | Feature specifications, user stories, acceptance criteria |
| [04-api-reference.md](./04-api-reference.md) | LogicMonitor REST API endpoints and usage |
| [05-data-models.md](./05-data-models.md) | TypeScript interfaces, types, and constants |

---

## Quick Links

### Getting Started
- [Architecture Overview](./01-architecture.md#overview)
- [Tech Stack](./01-architecture.md#component-breakdown)
- [Feature List](./03-features.md#feature-overview)

### API Reference
- [CSRF Token](./04-api-reference.md#csrf-token)
- [Debug API](./04-api-reference.md#debug-api)
- [Collector API](./04-api-reference.md#collector-api)
- [DataSource API](./04-api-reference.md#datasource-api)

### UI Design
- [Main Window Layout](./02-ui-layout.md#main-window-layout)
- [Component Specs](./02-ui-layout.md#component-specifications)
- [Keyboard Shortcuts](./02-ui-layout.md#keyboard-shortcuts)

### Data Models
- [Core Types](./05-data-models.md#core-types)
- [Execution Types](./05-data-models.md#execution-types)
- [Editor State](./05-data-models.md#editor-state)

---

## Verified Technical Details

The following items have been verified and documented:

### API Details

#### DataSource Script Field Names
Scripts are located in different fields based on the collection method:

| Script Type | Field Path |
|-------------|------------|
| Collection (Groovy) | `collectorAttribute.groovyScript` |
| Collection (PowerShell) | `collectorAttribute.groovyScript` (with `scriptType: "powerShell"`) |
| Active Discovery (Groovy) | `autoDiscoveryConfig.method.groovyScript` |
| Active Discovery (PowerShell) | `autoDiscoveryConfig.method.groovyScript` (with `scriptType: "powerShell"`) |

**Note:** PowerShell scripts are stored in `groovyScript` field but identified by `scriptType: "powerShell"`.

#### hostId Parameter
The `hostId` parameter accepts the **device ID** (numeric portal ID), not hostname. However, we don't use this approach.

**Our Implementation:** We set `hostId=null` and instead prepend a Groovy preamble that directly uses `CollectorDb.getInstance().getHost()` to fetch properties. This matches how the original extension worked and avoids needing to look up device IDs.

```
!groovy [options] \nscriptbody
Options:
    timeout: timeout in seconds, default 180 seconds
    runner: where to run the script (agent or sse, default: agent)
    hostId: send which host (in the portal) properties to groovy runner
    h: indicates which host (in the collector) the hostProps will bound to
```

**Preamble Approach (Used):**
```groovy
// Prepended to user's Groovy script when hostname is provided
import com.santaba.agent.collector3.CollectorDb;
def hostProps = [:];
def instanceProps = [:];
def datasourceinstanceProps = [:];
def taskProps = ["pollinterval": "180"];
try {
  def collectorDb = CollectorDb.getInstance();
  def hostname = new String("BASE64_HOSTNAME".decodeBase64());
  def host = collectorDb.getHost(hostname);
  if (host != null) {
    hostProps = host.getProperties();
    instanceProps["wildvalue"] = new String("BASE64_WILDVALUE".decodeBase64());
    def dsId = new String("BASE64_DATASOURCEID".decodeBase64());
    if (dsId) {
      // Support both numeric ID and string name
      def dsParam = dsId.isInteger() ? dsId.toInteger() : dsId;
      datasourceinstanceProps = collectorDb.getDatasourceInstanceProps(hostname, dsParam);
    }
  }
} catch(Exception e) {};
// User's script follows...
```

**Preamble Variables:**
| Variable | Description |
|----------|-------------|
| `hostProps` | Device properties from collector cache |
| `instanceProps` | Contains `wildvalue` for collection scripts |
| `datasourceinstanceProps` | All instance properties for batch collection (keyed by wildvalue) |
| `taskProps` | Contains `pollinterval` (defaults to "180") |

#### CSRF Token
Token is valid as long as the user session is valid. No separate expiry.

**Multi-Level Fallback (Implemented):**
Chrome service workers can be terminated after inactivity, losing in-memory state. Our `ScriptExecutor.acquireCsrfToken()` handles this:
1. **Level 1:** Try cached token from PortalManager
2. **Level 2:** Try refreshing token for the specific portal
3. **Level 3:** Re-discover all portals (re-scan LM tabs, fetch fresh tokens)
4. Try to get token again after re-discovery

This ensures execution works even after the service worker wakes from sleep.

#### Rate Limits
Rate limit info is returned in response headers:

| Header | Description |
|--------|-------------|
| `X-Rate-Limit-Limit` | Request limit per window |
| `X-Rate-Limit-Remaining` | Requests left in window |
| `X-Rate-Limit-Window` | Rolling window in seconds |

Default limits by HTTP method:

| Method | Limit |
|--------|-------|
| GET | 500/min |
| POST | 200/min |
| PUT | 200/min |
| PATCH | 250/min |
| DELETE | 300/min |

### Technical Details

#### PowerShell Property Token Substitution
PowerShell scripts use `##PROPERTY.NAME##` tokens (e.g., `##SYSTEM.HOSTNAME##`) that are substituted with actual values before execution. This matches LogicMonitor's native behavior.

**Implementation Flow:**
1. Check if script contains `##TOKEN##` patterns
2. If tokens found AND hostname provided:
   - Execute Groovy prefetch script via `CollectorDb.getInstance().getHost()`
   - Parse returned JSON properties
   - Replace all `##PROPERTY.NAME##` tokens with values (case-insensitive lookup)
   - Missing properties are replaced with empty strings
3. If prefetch fails or no hostname: Replace all tokens with empty strings
4. Execute the substituted PowerShell script

**Why Groovy Prefetch?**
The REST API redacts sensitive property values. `CollectorDb.getInstance().getHost()` returns unredacted properties from the collector's cache.

**ParamMap Iteration Note:**
LogicMonitor's `ParamMap` class doesn't support standard Java Map iteration. Use `keySet()` with `get(key)`:
```groovy
// WRONG - ParamMap.each() doesn't work like standard Map
hostProps.getProperties().each { k, v -> ... }

// RIGHT - Use keySet() and get()
for (key in hostProps.keySet()) {
  props[key] = hostProps.get(key)?.toString() ?: ""
}
```

#### Debug Timeout
Maximum script execution time is **120 seconds**.

#### Collector Cache
When querying a device not in the collector's cache via `CollectorDb.getInstance().getHost()`, behavior is undocumented. We should handle `null` returns gracefully.

### UX Details

#### Portal Detection & Verification
To prevent false positives from internal websites matching `*.logicmonitor.com`, portal discovery verifies each tab is a real LogicMonitor portal by checking for:

```javascript
window.LMGlobalData !== undefined
```

This global object is defined by LogicMonitor's application and is a reliable indicator of an actual portal page. Only tabs with this object are registered as valid portals.

#### Context Menu Target Element
The resource tree overflow menu uses this button (no unique class, must match by title + class):

```html
<button 
  class="MuiButtonBase-root MuiIconButton-root MuiIconButton-colorPrimary" 
  title="Manage Resource Options"
  data-testid="LM_navigationMoreOptions24PxIcon">
  ...
</button>
```

**Selector strategy:**
```typescript
const selector = 'button.MuiIconButton-root[title="Manage Resource Options"]';
// or
const selector = '[data-testid="LM_navigationMoreOptions24PxIcon"]';
```

#### WildValue Handling by Collection Method

| Collection Method | WildValue Behavior | User Prompt |
|-------------------|-------------------|-------------|
| `script` | Each instance runs separately. Wildvalue provided as runtime context. | Wildvalue input |
| `batchscript` | All instances run at once. Output format: `wildvalue.datapoint=value`. | DataSource ID input |

**Implementation:**
1. **Collection Mode:** 
   - Prompts for wildvalue (instance identifier)
   - Injects `instanceProps["wildvalue"] = <input>` via Groovy preamble
   - Text replacement of `##WILDVALUE##` and `##WILDVALUEBASE64##` tokens

2. **Batch Collection Mode:**
   - Prompts for datasourceId (numeric ID or datasource name)
   - Fetches `datasourceinstanceProps` via `CollectorDb.getInstance().getDatasourceInstanceProps(hostname, datasourceId)`
   - Provides all instance properties keyed by wildvalue

3. **Validation:**
   - Wildvalue in batch collection output is validated with same rules as instance ID
   - No spaces, =, :, \, # allowed in wildvalue prefix
   - Max 1024 characters

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Project setup (Vite 6 + CRXJS + TypeScript + React 19)
- [x] Tailwind CSS v4 + shadcn/ui (Base UI variant, Vega style)
- [x] Modular component architecture
- [x] Service worker with PortalManager
- [x] Monaco Editor integration (bundled locally for CSP compliance)
- [x] Portal detection with window.LMGlobalData check
- [x] Collector API integration (fetches collectors per portal)
- [x] CSRF token management

### Phase 2: Execution Engine ✅ COMPLETE
- [x] Debug API client (execute/poll)
- [x] Script execution flow (ScriptExecutor)
- [x] PowerShell property token substitution via Groovy prefetch
- [x] Groovy hostProps via CollectorDb preamble injection
- [x] CSRF token multi-level fallback with portal re-discovery
- [x] Language switch confirmation dialog for dirty editors
- [x] Raw output display with status badges

### Phase 3: Validation & Modes ✅ COMPLETE
- [x] AD mode with instance parsing
- [x] Collection mode with datapoint parsing  
- [x] Batch Collection mode with wildvalue grouping
- [x] Output validation UI (ParsedContent + ValidationContent components)
- [x] WildValue handling (dialog prompts for collection mode)
- [x] DatasourceId handling (dialog prompts for batch collection mode)
- [x] Groovy preamble with datasourceinstanceProps via CollectorDb
- [x] Validation rules for AD (ID format, length, invalid chars)
- [x] Validation rules for Collection (key=value, numeric values)
- [x] Validation rules for Batch Collection (wildvalue prefix, invalid chars)
- [x] UX improvements (mode icons, execution mode label, disabled tabs for freeform)

### Phase 4: LogicModule Integration ✅ COMPLETE
- [x] Module browser with 6 module types (DataSource, ConfigSource, TopologySource, PropertySource, LogSource, DiagnosticSource)
- [x] Paginated API fetching with script-only filter
- [x] Type toggle group with searchable module list
- [x] Dual-pane Monaco preview (AD + Collection) for AD-enabled modules
- [x] Load confirmation dialog when editor has unsaved changes
- [x] Auto-set language and execution mode when loading scripts
- [x] "Open from LMX" button in toolbar (enabled when portal is selected)

### Phase 5: Polish ✅ COMPLETE
- [x] Resource tree context menu injection
- [x] Command palette (Cmd/Ctrl+K)
- [x] Execution history with persistence
- [x] Settings/preferences dialog
- [x] Retain last edited code on relaunch (draft auto-save)
- [x] Save edited code to file (.groovy/.ps1)
- [x] Searchable device/hostname dropdown (populated from collector)

---

## Tech Stack Summary

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Build | Vite 6 + CRXJS |
| UI Framework | React 19 |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui + Base UI |
| Editor | Monaco Editor (bundled locally for CSP) |
| State | Zustand |
| Manifest | V3 |

---

## Key Design Decisions

### Why Chrome Extension (vs VS Code Extension)?
- Direct access to LM session/CSRF tokens
- Can inject into LM pages for context extraction
- Users already working in browser
- No additional authentication required

### Why Monaco Editor?
- Same editor engine as VS Code
- Full-featured (IntelliSense, themes, etc.)
- Better than CodeMirror for IDE experience
- Larger bundle but worth it for features

### Why shadcn/ui with Base UI?
- Components copied into project (full control)
- Base UI primitives (accessible, unstyled base) instead of Radix
- Tailwind v4 native styling with CSS-based configuration
- Dark mode support built-in
- Vega style variant for modern aesthetics

### Why Zustand?
- Lightweight (~1KB)
- Simple API, no boilerplate
- Works well with React
- Easy persistence integration

---

## Contributing

When implementing features:

1. Reference the relevant feature spec in [03-features.md](./03-features.md)
2. Follow the UI design in [02-ui-layout.md](./02-ui-layout.md)
3. Use the types defined in [05-data-models.md](./05-data-models.md)
4. Check API usage in [04-api-reference.md](./04-api-reference.md)
5. Update docs when discovering new information or making design changes

