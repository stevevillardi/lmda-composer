# LogicMonitor IDE - Extension Architecture

## Overview

LogicMonitor IDE is a Chrome Extension (Manifest V3) that provides an enhanced script development experience for LogicMonitor. It intercepts and replaces the native debug dialog with a full-featured Monaco-based editor.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Chrome Browser                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     Service Worker (background)                          ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐ ││
│  │  │  PortalManager  │  │ Collector Cache │  │      ModuleLoader        │ ││
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
│  │ Content Script  │    │     Editor Tab      │    │  LogicMonitor Tab   │  │
│  │ (LM pages)      │    │ (extension page)    │    │  (User's session)   │  │
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
- CSRF tokens are refreshed on demand and cached with TTL logic

**Files:**
```
background/
├── service-worker.ts      # Entry point, message routing
├── portal-manager.ts      # Multi-portal detection, CSRF tokens, collectors, state persistence
├── script-executor.ts     # Orchestrates script execution flow with cancellation support
├── api-executor.ts        # API explorer request execution
├── debug-api.ts           # Debug API client (execute/poll, command builders, rate limiting)
├── token-substitutor.ts   # ##TOKEN## detection and replacement
├── module-loader.ts       # LogicModule fetching with pagination
├── module-searcher.ts     # Script/datapoint search across modules
├── module-snippets-cache.ts # Snippet cache and lookup
├── sender-validation.ts   # Sender origin validation
├── handlers/              # Domain message handlers
│   ├── portal-handlers.ts
│   ├── execution-handlers.ts
│   ├── module-handlers.ts
│   ├── snippets-handlers.ts
│   └── custom-function-handlers.ts
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
┌───────────────┐ ┌──────────────────┐
│  debug-api    │ │  token-          │
│               │ │  substitutor     │
│ - execute()   │ │                  │
│ - poll()      │ │ - hasTokens()    │
│ - buildCmd()  │ │ - substitute()   │
└───────────────┘ │ - extractTokens()│
                  └──────────────────┘
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

### 3. Editor Tab (`editor/`)

A dedicated extension tab containing the IDE UI:
- Monaco Editor for script editing
- Target selector (portal, collector, device)
- Mode selector (AD, Collection, Freeform)
- Output panel with validation
- Module browser

**Opened via:**
```typescript
chrome.tabs.create({
  url: chrome.runtime.getURL('src/editor/index.html'),
  active: true
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
│   ├── RightSidebar.tsx   # Properties/Snippets/History panel
│   ├── SnippetLibraryPanel.tsx # Snippet filters and insertion
│   ├── StatusBar.tsx      # Status info display
│   ├── CommandPalette.tsx # Quick command access (Ctrl+Shift+P)
│   ├── ExecutionContextDialog.tsx  # Wildvalue/DatasourceId prompts
│   ├── ExecutionHistoryPanel.tsx   # History sidebar panel
│   ├── LogicModuleBrowser.tsx      # Module search and preview
│   ├── LogicModuleSearch.tsx       # Cross-module script/datapoint search
│   ├── SettingsDialog.tsx # User preferences
│   ├── ModulePreview.tsx  # Script preview tabs
│   ├── ModuleLineageDialog.tsx # Historical diffs/restores
│   ├── ModuleCommitConfirmationDialog.tsx # Commit changes back to LM
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

## Local File System Architecture

### Overview

LogicMonitor IDE supports opening and saving local files using the File System Access API. Due to Chrome Extension limitations, file operations occur in the editor UI context, not the service worker.

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Editor UI | File System Access API | Open/save files to disk |
| Editor UI | IndexedDB | Persist file handles across sessions |
| Service Worker | `chrome.storage.local` | Autosave backup (fallback) |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Editor UI Context                                 │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────────────┐ │
│  │   TabBar +      │    │  File System    │    │       IndexedDB          │ │
│  │   Editor        │◄──►│  Access API     │◄──►│   (file-handles store)   │ │
│  └────────┬────────┘    └─────────────────┘    └──────────────────────────┘ │
│           │                                                                  │
│           │ auto-save                                                        │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     Zustand Editor Store                                 ││
│  │  - tabs[] with originalContent, hasFileHandle                           ││
│  │  - file operations (open, save, saveAs)                                 ││
│  │  - dirty state computation                                              ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │ chrome.storage.local
                                     ▼
                    ┌───────────────────────────────┐
                    │     Service Worker Context    │
                    │   (autosave backup storage)   │
                    └───────────────────────────────┘
```

### Key Constraints

1. **File System Access API** is NOT available in service workers
2. **FileSystemFileHandle** objects stored in IndexedDB require permission re-request after browser restart
3. **User gesture required** to request file permissions (can't auto-prompt on load)

### File Handle Persistence

File handles are stored in IndexedDB to persist across sessions:

**Database:** `lm-ide-files`
**Object Store:** `file-handles`

| Field | Type | Description |
|-------|------|-------------|
| `tabId` | string (key) | Matches EditorTab.id |
| `handle` | FileSystemFileHandle | The file handle object |
| `fileName` | string | Display name |
| `lastAccessed` | number | Timestamp |

### Permission Flow After Restart

```
App Mount → Load handles from IndexedDB
         → For each handle: queryPermission()
         → If 'prompt': Show "Restore Access" button
         → User clicks → requestPermission()
         → If granted: Handle ready to use
```

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
