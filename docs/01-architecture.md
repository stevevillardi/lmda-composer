# LM IDE - Extension Architecture

## Overview

LM IDE is a Chrome Extension (Manifest V3) that provides an enhanced script development experience for LogicMonitor. It intercepts and replaces the native debug dialog with a full-featured Monaco-based editor.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Chrome Browser                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     Service Worker (background)                          ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐ ││
│  │  │  PortalManager  │  │  CollectorPool  │  │    LogicModuleLoader     │ ││
│  │  │  - Tab discovery│  │  - Fetch list   │  │    - Search modules      │ ││
│  │  │  - CSRF tokens  │  │  - Status cache │  │    - Load scripts        │ ││
│  │  └────────┬────────┘  └────────┬────────┘  └────────────┬─────────────┘ ││
│  │           │                    │                        │                ││
│  │           └────────────────────┼────────────────────────┘                ││
│  │                                │                                          ││
│  │                    ┌───────────▼───────────┐                             ││
│  │                    │    ScriptExecutor     │                             ││
│  │                    │  - Groovy execution   │                             ││
│  │                    │  - PowerShell w/props │                             ││
│  │                    │  - Result polling     │                             ││
│  │                    └───────────────────────┘                             ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐  │
│  │ Content Script  │    │    Editor Window    │    │  LogicMonitor Tab   │  │
│  │ (LM pages)      │    │    (Popup)          │    │  (User's session)   │  │
│  │                 │    │                     │    │                     │  │
│  │ - Context menu  │    │  ┌───────────────┐  │    │  - Authenticated    │  │
│  │ - Device info   │    │  │ Monaco Editor │  │    │  - CSRF token       │  │
│  │ - CSRF relay    │    │  └───────────────┘  │    │  - Portal context   │  │
│  └─────────────────┘    │  ┌───────────────┐  │    └─────────────────────┘  │
│                         │  │ Output Panel  │  │                             │
│                         │  └───────────────┘  │                             │
│                         │  ┌───────────────┐  │                             │
│                         │  │ Target Select │  │                             │
│                         │  └───────────────┘  │                             │
│                         └─────────────────────┘                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
                    ┌───────────────────────────────┐
                    │     LogicMonitor REST API     │
                    │     (*.logicmonitor.com)      │
                    │                               │
                    │  /santaba/rest/debug/         │
                    │  /santaba/rest/setting/       │
                    │  /santaba/rest/device/        │
                    │  /santaba/rest/functions/     │
                    └───────────────────────────────┘
```

---

## Component Breakdown

### 1. Service Worker (`background/`)

The service worker is the central coordinator. It:
- Manages portal discovery across open tabs
- Maintains collector lists per portal
- Handles script execution requests
- Caches CSRF tokens with refresh logic

**Key Design Decisions:**
- Service workers are event-driven and can be terminated by Chrome when idle
- State must be persisted to `chrome.storage` for durability
- Use `chrome.alarms` for periodic CSRF token refresh

**Files:**
```
background/
├── service-worker.ts      # Entry point, message routing
├── portal-manager.ts      # Multi-portal detection, CSRF tokens, collectors, state persistence
├── script-executor.ts     # Orchestrates script execution flow with cancellation support
├── debug-api.ts           # Debug API client (execute/poll, command builders, rate limiting)
├── property-prefetcher.ts # Fetches device props via Groovy for PowerShell
├── token-substitutor.ts   # ##TOKEN## detection and replacement
├── module-loader.ts       # LogicModule fetching with pagination
└── rate-limiter.ts        # Rate limit detection and exponential backoff
```

**Script Execution Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                      ScriptExecutor                              │
│  - acquireCsrfToken() with 3-level fallback                     │
│  - executeGroovy() → prepends hostProps preamble                │
│  - executePowerShell() → token substitution flow                │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌───────────────┐ ┌─────────────┐ ┌──────────────────┐
│  debug-api    │ │  property-  │ │  token-          │
│               │ │  prefetcher │ │  substitutor     │
│ - execute()   │ │             │ │                  │
│ - poll()      │ │ - Groovy    │ │ - hasTokens()    │
│ - buildCmd()  │ │   prefetch  │ │ - substitute()   │
└───────────────┘ │ - JSON parse│ │ - extractTokens()│
                  └─────────────┘ └──────────────────┘
```

### 2. Content Scripts (`content/`)

Injected into LogicMonitor pages to:
- Extract device/portal context from the DOM
- Inject context menu items into the resource tree
- Relay CSRF tokens to the service worker
- (Optional) Intercept native debug dialogs

**Injection Targets:**
```json
{
  "matches": [
    "https://*.logicmonitor.com/*"
  ]
}
```

**Resource Tree Menu Target:**

The overflow menu button doesn't have a unique class, so we target by attribute combo:

```typescript
// Option 1: By title attribute
const menuButton = document.querySelector(
  'button.MuiIconButton-root[title="Manage Resource Options"]'
);

// Option 2: By data-testid (more stable)
const menuButton = document.querySelector(
  '[data-testid="LM_navigationMoreOptions24PxIcon"]'
);
```

**Files:**
```
content/
└── index.ts               # All content script functionality:
                           #   - CSRF token relay to service worker
                           #   - Context menu injection into resource tree
                           #   - Device context extraction from page
```

### 3. Editor Window (`editor/`)

A standalone popup window containing the IDE UI:
- Monaco Editor for script editing
- Target selector (portal, collector, device)
- Mode selector (AD, Collection, Freeform)
- Output panel with validation
- Module browser

**Opened via:**
```typescript
chrome.windows.create({
  url: 'editor.html',
  type: 'popup',
  width: 1200,
  height: 800
});
```

**Files:**
```
editor/
├── index.html             # HTML entry
├── index.tsx              # React entry
├── App.tsx                # Main layout with resizable panels
├── monaco-loader.ts       # Monaco Editor configuration (CSP compliance, Groovy lang)
├── components/            # UI components
│   ├── Toolbar.tsx        # Portal/Collector/Device selectors, actions
│   ├── EditorPanel.tsx    # Monaco Editor integration
│   ├── OutputPanel.tsx    # Raw/Parsed/Validation tabs
│   ├── StatusBar.tsx      # Status info display
│   ├── CommandPalette.tsx # Quick command access (Ctrl+K)
│   ├── ExecutionContextDialog.tsx  # Wildvalue/DatasourceId prompts
│   ├── ExecutionHistory.tsx        # History sheet
│   ├── LogicModuleBrowser.tsx      # Module search and preview
│   ├── SettingsDialog.tsx # User preferences
│   ├── ModulePreview.tsx  # Script preview tabs
│   ├── ParsedContent.tsx  # Parsed output display
│   └── ValidationContent.tsx # Validation results
├── stores/
│   └── editor-store.ts    # Zustand state management
└── utils/
    └── output-parser.ts   # AD/Collection output parsing and validation
```

---

## Communication Flow

### Message Passing

All components communicate via Chrome's messaging APIs:

```typescript
// Content Script → Service Worker
chrome.runtime.sendMessage({ 
  type: 'CSRF_TOKEN', 
  payload: { portal: 'acme.logicmonitor.com', token: 'xyz' } 
});

// Editor → Service Worker
chrome.runtime.sendMessage({ 
  type: 'EXECUTE_SCRIPT', 
  payload: { collectorId: 123, script: '...', mode: 'groovy' } 
});

// Service Worker → Editor (response)
// Uses sendResponse callback or chrome.runtime.sendMessage to specific tab
```

### Message Types

| Type | Direction | Payload |
|------|-----------|---------|
| `DISCOVER_PORTALS` | Editor → SW | - |
| `PORTALS_UPDATE` | SW → Editor | `Portal[]` |
| `GET_COLLECTORS` | Editor → SW | `{ portalId: string }` |
| `COLLECTORS_UPDATE` | SW → Editor | `Collector[]` |
| `EXECUTE_SCRIPT` | Editor → SW | `ExecuteRequest` |
| `EXECUTION_UPDATE` | SW → Editor | `ExecutionResult` |
| `CSRF_TOKEN` | Content → SW | `{ portal, token }` |
| `OPEN_EDITOR` | Content → SW | `DeviceContext` |
| `SEARCH_MODULES` | Editor → SW | `{ query, portalId }` |
| `LOAD_MODULE` | Editor → SW | `{ moduleId, portalId }` |

---

## State Management

### Service Worker State

Persisted to `chrome.storage.local`:

```typescript
interface ExtensionState {
  portals: Portal[];
  collectors: Record<string, Collector[]>;  // keyed by portalId
  csrfTokens: Record<string, { token: string; expiry: number }>;
  recentExecutions: ExecutionHistory[];
}
```

### Editor State (Zustand)

In-memory, synced from service worker:

```typescript
interface EditorState {
  // Target selection
  selectedPortal: Portal | null;
  selectedCollector: Collector | null;
  hostname: string;
  wildvalue: string;
  
  // Editor
  script: string;
  language: 'groovy' | 'powershell';
  mode: 'ad' | 'collection' | 'freeform';
  
  // Execution
  isExecuting: boolean;
  output: string;
  validationResults: ValidationResult[];
  
  // Module browser
  searchQuery: string;
  searchResults: LogicModule[];
  loadedModule: LogicModule | null;
}
```

---

## Security Considerations

### CSRF Token Handling

1. Content script fetches token from authenticated LM tab
2. Token relayed to service worker via messaging
3. Service worker caches with expiry (refresh every 10 mins)
4. All API calls include token in `X-CSRF-Token` header

### Permissions

```json
{
  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],
  "host_permissions": [
    "https://*.logicmonitor.com/*"
  ]
}
```

### Data Handling

- No credentials stored (uses browser session)
- Scripts stored only in memory (optional: local storage for drafts)
- No external analytics or telemetry

---

## Error Handling

### API Errors

```typescript
interface APIError {
  status: number;
  code: string;
  message: string;
}

// Common errors:
// 401 - Session expired, need re-auth
// 403 - CSRF token invalid, refresh needed
// 404 - Collector not found / offline
// 429 - Rate limited, implement backoff
// 500 - LM server error
```

### Collector Offline

- Poll collector status before execution
- Show clear error if collector is down
- Suggest alternative collectors

### Script Timeout

- LM debug commands have a timeout (~60 seconds)
- Show progress indicator during polling
- Allow cancellation

---

## Performance Considerations

### Bundle Size

- Monaco Editor is ~2MB - load asynchronously
- Use code splitting for editor vs content scripts
- shadcn/ui components are tree-shakeable

### Memory

- Large script outputs may need virtualization
- Limit execution history to last N items
- Clear caches periodically

### Network

- Batch collector list fetches per portal
- Cache module search results
- Debounce search input

---

## Future Extensibility

### Potential Features

1. **Script version control** - Local git-like history
2. **Collaborative editing** - Share scripts via URL
3. **Custom snippets** - User-defined code templates
4. **Multi-tab execution** - Compare outputs across collectors
5. **Export to LogicModule** - Create/update DataSources directly

### Plugin Architecture (Future)

```typescript
interface LMIDEPlugin {
  name: string;
  version: string;
  onActivate(api: LMIDEAPI): void;
  onDeactivate(): void;
}
```

