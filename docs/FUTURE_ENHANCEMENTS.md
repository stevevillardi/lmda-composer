# LogicMonitor IDE - Future Enhancements

This document tracks usability improvements, new features, and production polish items for future releases.

---

## Current Implementation: Phase 1

### Overview

Phase 1 introduces a hybrid layout approach with a collapsible right sidebar for device properties and snippets, while reserving the left side for future multi-file support.

**Layout Structure:**
```
┌────────────────────────────────────────────────────────────────────┐
│ Toolbar                                                             │
├────────────────────────────────────────────┬───────────────────────┤
│                                            │ [Props] [Snippets]    │
│  Monaco Editor                             │                       │
│                                            │ Right Sidebar         │
│                                            │ (collapsible)         │
├────────────────────────────────────────────┤                       │
│  Output Panel                              │                       │
├────────────────────────────────────────────┴───────────────────────┤
│ Status Bar                                                          │
└────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1A: Cancel Button During Script Execution - IN PROGRESS

When a script is running, users can only wait. Add a "Cancel" button adjacent to the disabled Run button with a confirmation dialog.

**Status:** 🔄 In Progress  
**Priority:** High  
**Effort:** Low

**Implementation:**
- Create reusable `ConfirmationDialog` component (extracted from draft restore pattern)
- Track `currentExecutionId` in editor store for cancellation
- Show Cancel button adjacent to disabled Run button when executing
- Cancel with confirmation dialog to prevent accidental cancellation
- Wire up to existing `CANCEL_EXECUTION` message handler in service worker

**Files:** `Toolbar.tsx`, `editor-store.ts`, `ConfirmationDialog.tsx` (new)

---

### Phase 1B: Device Property Viewer Panel - IN PROGRESS

Show device properties in a collapsible right sidebar panel. Properties are fetched from the LM API with sensitive values masked.

**Status:** 🔄 In Progress  
**Priority:** Medium  
**Effort:** Medium

**Implementation:**
- Add `getDeviceProperties()` to portal-manager.ts using `/device/devices/{id}` endpoint
- Auto-fetch properties when device is selected from dropdown
- Display in toggleable right sidebar panel with:
  - Property table with type badges (system/custom/inherited/auto)
  - Search/filter input
  - Click-to-copy values
  - Click property name to insert `hostProps.get("name")` into editor

**Files:** `portal-manager.ts`, `service-worker.ts`, `editor-store.ts`, `DevicePropertiesPanel.tsx` (new), `App.tsx`

---

### Phase 1C: Snippet Library - IN PROGRESS

Add ability to save/load code snippets with both built-in and user-defined snippets.

**Status:** 🔄 In Progress  
**Priority:** Medium  
**Effort:** Medium

**Snippet Types:**
- **Templates:** Full script templates (SNMP Walk, HTTP API collector, SSH execution, WMI query, AD/Collection boilerplate)
- **Patterns:** Code fragments (property access, error handling, JSON parsing, credential retrieval, debug logging)

**Implementation:**
- Create `built-in-snippets.ts` with categorized snippets
- Persist user snippets to `chrome.storage.local` (key: `lm-ide-user-snippets`)
- Display in right sidebar panel with:
  - Category tabs (Templates / Patterns)
  - Language filter (Groovy / PowerShell / Both)
  - Built-in vs User snippets toggle
  - Insert button (replaces content for templates, inserts at cursor for patterns)
  - CRUD for user snippets

**Files:** `built-in-snippets.ts` (new), `editor-store.ts`, `SnippetLibraryPanel.tsx` (new), `CreateSnippetDialog.tsx` (new)

---

### Phase 1D: Right Sidebar Layout - IN PROGRESS

Enable hybrid layout with collapsible right sidebar.

**Status:** 🔄 In Progress  
**Priority:** High (enables 1B and 1C)  
**Effort:** Low

**Implementation:**
- Add horizontal `ResizablePanelGroup` to App.tsx wrapping editor area
- Create `RightSidebar` component with tabs for Device Properties and Snippets
- Add toggle button to Toolbar
- Persist sidebar open/closed state in preferences

---

## Future Features (Phase 2+)

### Multi-File Support

Support multiple open files like a true IDE (e.g., AD script and Collection script side by side).

**Considerations:**
- Left sidebar reserved for file tree
- Tab bar above editor for switching between open files
- Track multiple file states with dirty flags

**Priority:** Medium  
**Effort:** High

---

### Output Diff Comparison

When re-running, optionally show diff between current and previous output to highlight changes.

**Priority:** Low  
**Effort:** Medium

---

## Production Polish

### React Error Boundaries

Add error boundaries to main components (`App.tsx`, `EditorPanel.tsx`, `OutputPanel.tsx`) to catch and display errors gracefully instead of crashing the entire UI.

**Priority:** High  
**Effort:** Medium

---

### Version Number Display

Display the extension version (from manifest) in the Settings dialog or status bar.

**Priority:** Medium  
**Effort:** Low

---

### JSDoc Documentation

Add JSDoc documentation to exported store methods in `editor-store.ts` for better developer experience.

**Priority:** Low  
**Effort:** Medium

---
