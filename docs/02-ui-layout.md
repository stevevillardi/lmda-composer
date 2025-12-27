# LogicMonitor IDE - UI Layout & Design

## Design Philosophy

- **IDE-like experience** - Familiar to developers who use VS Code
- **Dark theme default** - Easier on eyes for extended coding sessions
- **Information density** - Show relevant context without overwhelming
- **Keyboard-first** - Power users can navigate entirely via keyboard

---

## Main Window Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Toolbar                                                              │    │
│  │ [Portal ▼] [Collector ▼] [Device: ___________] [Mode: AD ▼] [▶ Run] │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┬───────────────────────────────────┐   │
│  │                                  │                                    │   │
│  │                                  │  Device Context Panel              │   │
│  │                                  │  ┌──────────────────────────────┐  │   │
│  │                                  │  │ system.hostname: 10.0.0.1   │  │   │
│  │       Monaco Editor              │  │ system.displayname: WebSrv1 │  │   │
│  │                                  │  │ system.collector: coll-01   │  │   │
│  │       (Resizable)                │  │ snmp.community: ********    │  │   │
│  │                                  │  │ ...                         │  │   │
│  │                                  │  └──────────────────────────────┘  │   │
│  │                                  │                                    │   │
│  │                                  │  WildValue Input                   │   │
│  │                                  │  ┌──────────────────────────────┐  │   │
│  │                                  │  │ eth0                         │  │   │
│  │                                  │  └──────────────────────────────┘  │   │
│  │                                  │                                    │   │
│  ├──────────────────────────────────┴───────────────────────────────────┤   │
│  │                                                                       │   │
│  │  Output Panel (Resizable)                                             │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │   │
│  │  │ [Raw] [Parsed] [Validation]                              Clear  │  │   │
│  │  ├─────────────────────────────────────────────────────────────────┤  │   │
│  │  │                                                                 │  │   │
│  │  │  eth0##Ethernet 0##Primary network interface                    │  │   │
│  │  │  eth1##Ethernet 1##Secondary network interface                  │  │   │
│  │  │  lo##Loopback##Loopback interface                               │  │   │
│  │  │                                                                 │  │   │
│  │  │  ✓ 3 instances discovered                                       │  │   │
│  │  │                                                                 │  │   │
│  │  └─────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Status Bar: Ready │ Groovy │ UTF-8 │ Ln 42, Col 15 │ 1,234 chars    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Toolbar

**Location:** Top of window, fixed height (48px)

**Components:**

| Element | shadcn Component | Description |
|---------|------------------|-------------|
| Portal Selector | `Select` | Dropdown of discovered LM portals |
| Portal Refresh | `Button` (icon) | Refresh portal discovery |
| Collector Selector | `Select` | Dropdown of collectors for selected portal |
| Device Input | `Input` | Hostname/IP (system.hostname) |
| Language Toggle | `Button` group | Groovy / PowerShell toggle (shows confirmation if dirty) |
| Mode Selector | `Select` | Freeform / AD / Collection / Batch Collection |
| Run Button | `Button` | Execute script (primary action) |
| Settings | `Button` (icon) | Settings menu (future) |

**Behavior:**
- Portal selector shows status indicator (green dot = active session)
- Collector selector shows collector status (online/offline/warning)
- Device input supports paste, auto-detects format
- Run button shows loading spinner during execution
- Keyboard shortcut: `Ctrl+Enter` or `F5` to run
- Language toggle shows `AlertDialog` confirmation if editor has unsaved changes
  - Warns that switching will reset to default template
  - Options: Cancel (keep current) or Switch & Reset (confirm)

### 2. Monaco Editor Panel

**Location:** Main content area, left side (resizable)

**Features:**
- Syntax highlighting for Groovy and PowerShell
- Line numbers
- Bracket matching
- Auto-indentation
- Code folding
- Minimap (optional, can toggle)
- Find/Replace (`Ctrl+F`, `Ctrl+H`)

**LM-Specific Enhancements:**
- Custom completions for `hostProps.get()`, `Snmp.get()`, etc.
- Snippet insertion for common patterns
- Hover documentation for LM APIs (stretch goal)

**Theme:** VS Code Dark+ or Monokai (user preference)

### 3. Device Context Panel

**Location:** Right sidebar, collapsible

**Content:**
- Host properties (from selected device)
- Instance properties (when wildvalue provided)
- Quick-copy buttons for property values

**shadcn Components:**
- `ScrollArea` for scrollable list
- `Table` for property display
- `Button` with copy icon

**Behavior:**
- Loads when device hostname is entered
- Shows loading skeleton while fetching
- Allows search/filter of properties
- Click property name to insert into editor

### 4. Output Panel

**Location:** Bottom panel, resizable height

**Tabs:**

| Tab | Description |
|-----|-------------|
| Raw | Unprocessed script output |
| Parsed | Formatted based on mode (AD table, datapoints) |
| Validation | Errors and warnings |

**AD Mode Parsed View:**

```
┌──────────────────────────────────────────────────────────────────┐
│ Instance ID │ Name       │ Description               │ Status   │
├─────────────┼────────────┼───────────────────────────┼──────────┤
│ eth0        │ Ethernet 0 │ Primary network interface │ ✓ Valid  │
│ eth1        │ Ethernet 1 │ Secondary network...      │ ✓ Valid  │
│ eth 2       │ Ethernet 2 │ -                         │ ⚠ Space  │
└──────────────────────────────────────────────────────────────────┘
```

**Collection Mode Parsed View:**

```
┌────────────────────────────────────────────────────┐
│ Datapoint           │ Value      │ Status         │
├─────────────────────┼────────────┼────────────────┤
│ CPUUsage            │ 45.2       │ ✓ Valid        │
│ MemoryUsed          │ 8192       │ ✓ Valid        │
│ InvalidDatapoint    │ "text"     │ ✗ Non-numeric  │
└────────────────────────────────────────────────────┘
```

**shadcn Components:**
- `Tabs` for Raw/Parsed/Validation
- `Table` for parsed data
- `ScrollArea` for output content
- `Badge` for status indicators

### 5. Status Bar

**Location:** Bottom of window, fixed height (24px)

**Content (left to right):**
- Execution status (Ready / Executing... / Complete / Error)
- Language indicator (Groovy / PowerShell)
- Encoding (UTF-8)
- Cursor position (Ln X, Col Y)
- Character count (with warning at 64K limit)
- Execution time (after run completes)

---

## Overlays & Modals

### Command Palette (`Cmd+K` / `Ctrl+K`)

**shadcn Component:** `Command`

```
┌─────────────────────────────────────────────────────────┐
│  🔍 Search commands, modules, devices...                │
├─────────────────────────────────────────────────────────┤
│  Recently Used                                          │
│    📄 Load DataSource: Linux_SSH_NetworkInterfaces     │
│    📄 Load DataSource: WinOS_CPU                       │
│                                                         │
│  Commands                                               │
│    ▶️  Run Script                           Ctrl+Enter  │
│    📋 Copy Output                           Ctrl+Shift+C│
│    🔄 Refresh Collectors                    Ctrl+R      │
│    ⚙️  Open Settings                        Ctrl+,      │
│                                                         │
│  Switch Portal                                          │
│    🌐 acme.logicmonitor.com                            │
│    🌐 demo.logicmonitor.com                            │
└─────────────────────────────────────────────────────────┘
```

### Module Browser (`Ctrl+O`)

**shadcn Component:** `Sheet` (slides in from right)

```
┌───────────────────────────────────────────────────┐
│  Load LogicModule                            [X]  │
├───────────────────────────────────────────────────┤
│  🔍 Search DataSources...                         │
├───────────────────────────────────────────────────┤
│  Results                                          │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 📦 Linux_SSH_NetworkInterfaces              │ │
│  │    Type: DataSource                         │ │
│  │    Collection: Script (Groovy)              │ │
│  │    [Load AD] [Load Collection]              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 📦 WinOS_CPU                                │ │
│  │    Type: DataSource                         │ │
│  │    Collection: PowerShell                   │ │
│  │    [Load AD] [Load Collection]              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
└───────────────────────────────────────────────────┘
```

### Settings Dialog

**shadcn Component:** `Dialog`

**Sections:**
- Editor preferences (theme, font size, minimap)
- Default mode (AD/Collection/Freeform)
- Keyboard shortcut customization (future)
- About / Version info

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `F5` | Run script |
| `Ctrl+K` | Open command palette |
| `Ctrl+O` | Open module browser |
| `Ctrl+S` | Save to local storage (draft) |
| `Ctrl+Shift+C` | Copy output to clipboard |
| `Ctrl+,` | Open settings |
| `Ctrl+\`` | Toggle output panel |
| `Escape` | Close overlays/modals |
| `Ctrl+1` | Focus editor |
| `Ctrl+2` | Focus output |

---

## Responsive Behavior

### Minimum Window Size
- Width: 800px
- Height: 600px

### Panel Defaults
- Editor: 60% width
- Context panel: 40% width (collapsible)
- Output: 30% height

### Collapsed States
- Context panel can collapse to just show toggle button
- Output panel can minimize to just status bar

---

## Color Palette (Dark Theme)

| Element | Color | Hex |
|---------|-------|-----|
| Background | Zinc 950 | `#09090b` |
| Surface | Zinc 900 | `#18181b` |
| Border | Zinc 800 | `#27272a` |
| Text Primary | Zinc 50 | `#fafafa` |
| Text Secondary | Zinc 400 | `#a1a1aa` |
| Accent | Blue 500 | `#3b82f6` |
| Success | Green 500 | `#22c55e` |
| Warning | Yellow 500 | `#eab308` |
| Error | Red 500 | `#ef4444` |

---

## Loading States

### Initial Load
- Show skeleton UI while fetching portals/collectors
- Monaco editor shows loading placeholder

### Script Execution
- Run button shows spinner
- Status bar shows "Executing..."
- Output panel shows animated dots

### Module Search
- Debounced input (300ms)
- Show skeleton cards while searching
- "No results" state with suggestions

---

## Error States

### No Portals Found
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     🔌 No LogicMonitor Portals Detected                │
│                                                         │
│     Open a LogicMonitor tab and log in, then           │
│     click "Refresh" to detect available portals.       │
│                                                         │
│                    [Refresh]                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Collector Offline
```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Collector "prod-collector-01" is offline           │
│                                                         │
│  Script cannot be executed. Select a different          │
│  collector or wait for the collector to come online.    │
│                                                         │
│  [Select Different Collector]                           │
└─────────────────────────────────────────────────────────┘
```

### Script Error
- Output panel shows error in red
- Validation tab highlights issues
- Status bar shows "Error" with error count

