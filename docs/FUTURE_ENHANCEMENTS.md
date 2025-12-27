# LogicMonitor IDE - Future Enhancements

This document tracks usability improvements, new features, and production polish items for future releases.

---

## Usability Improvements

### Cancel Button During Script Execution

When a script is running, users can only wait. Add a "Cancel" button next to the "Running..." state in the toolbar.

**Priority:** High  
**Effort:** Medium  
**Files:** `Toolbar.tsx`, `editor-store.ts`

### Device Dropdown Pagination

Currently loads all devices for a collector (up to 1000). For collectors with thousands of devices, this could be slow.

**Improvements:**
- Pagination or virtual scrolling
- Show loading count ("Loading 1,234 devices...")

**Priority:** Medium  
**Effort:** Medium

### Server-Side Module Browser Search

Search is client-side after fetching all modules. For portals with thousands of modules, consider server-side filtering via the API `filter` parameter.

**Priority:** Medium  
**Effort:** Low

### Keyboard Shortcut Help

Users must know shortcuts (Cmd+K opens palette). Add a small "?" help button or tooltip showing common shortcuts.

**Priority:** Low  
**Effort:** Low

### Enhanced Script Character Limit Warning

The status bar shows character count but no prominent warning as users approach the 64K limit. Add a yellow/red indicator earlier (e.g., at 50K and 60K).

**Priority:** Low  
**Effort:** Low

### Collector Status Tooltips

Collectors show a colored dot but no explanation of what red/green means. Add tooltip explaining "Collector is offline" vs "Collector is online".

**Priority:** Low  
**Effort:** Low

### Better Empty States

When no modules match search, show helpful text like "Try a different search term" instead of just "No modules found".

**Priority:** Low  
**Effort:** Low

---

## New Features

### Quick Re-run Last Execution

Add a "Re-run" button that executes the same script with same parameters (portal, collector, device, mode).

**Priority:** Medium  
**Effort:** Low

### Output Diff Comparison

When re-running, optionally show diff between current and previous output to highlight changes.

**Priority:** Low  
**Effort:** Medium

### Snippet Library

Add ability to save/load code snippets (e.g., "SNMP Walk template", "WMI Query template"). Store in `chrome.storage.local`.

**Priority:** Medium  
**Effort:** Medium

### Device Property Viewer Sidebar

The docs mention a "Device Context Panel" but it's not implemented. Show fetched `hostProps` in a collapsible sidebar panel.

**Priority:** Low  
**Effort:** Medium

### Export Execution Context to File

Save the full execution context (script + output + metadata) as JSON for debugging/sharing.

**Priority:** Low  
**Effort:** Low

### Quick Theme Toggle in Toolbar

Currently requires opening Settings dialog. Add a quick light/dark toggle button in the toolbar.

**Priority:** Low  
**Effort:** Low

---

## Production Polish

### React Error Boundaries

Add error boundaries to main components (`App.tsx`, `EditorPanel.tsx`, `OutputPanel.tsx`) to catch and display errors gracefully instead of crashing the entire UI.

**Priority:** High  
**Effort:** Medium

### Version Number Display

Display the extension version (from manifest) in the Settings dialog or status bar.

**Priority:** Medium  
**Effort:** Low

### JSDoc Documentation

Add JSDoc documentation to exported store methods in `editor-store.ts` for better developer experience.

**Priority:** Low  
**Effort:** Medium

---

## Implementation Notes

These items were identified during the v1.0 final review and deferred to keep the initial release focused on core functionality. They should be prioritized based on user feedback after the initial release.

