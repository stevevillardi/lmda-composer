# Save & Sync Architecture

This document describes the file save and portal synchronization architecture for the LM Composer extension.

## Document Types and States

### Document Types

| Type | Description | Source |
|------|-------------|--------|
| `scratch` | New unsaved file | Created in editor |
| `local` | File saved to local disk | File System Access API |
| `portal` | Module imported from LogicMonitor portal | LMX import |
| `local+portal` | Directory-saved module with portal binding | Module directory |
| `history` | Read-only execution history | History panel |
| `api` | API request/response tab | API Explorer |

### Dirty State Indicators

The tab bar shows two independent dirty indicators:

1. **Amber Dot (●)** - Unsaved disk changes
   - Shows when `tab.content !== document.file.lastSavedContent`
   - Cleared after saving to disk

2. **Blue Cloud (☁)** - Unpushed portal changes
   - Shows when `tab.content !== document.portal.lastKnownContent`
   - Cleared after pushing to portal

## Script Synchronization Flow

### Import from LMX (Portal → Editor)

```
Portal API → FETCH_MODULE → Extract Script → Create Tab
                                              ├─ content: script content
                                              ├─ document.type: 'portal'
                                              └─ document.portal.lastKnownContent: script content
```

### Save to Module Directory (Editor → Disk)

```
Editor Tab → User clicks "Save to Module Directory"
          → showDirectoryPicker() → User selects parent folder
          → Create subfolder (module name)
          → Write script files (.groovy/.ps1)
          → Write module.json
          → Store directory handle in IndexedDB
          → Update tab:
              ├─ document.type: 'local' (preserves portal binding)
              ├─ document.file.lastSavedContent: content
              └─ directoryHandleId: stored handle ID
```

### Push to Portal (Editor → Portal)

```
Editor → User clicks "Push to Portal"
      → fetchModuleForCommit() - Fetch latest from portal
      → Compare portal baseline vs fresh portal (conflict detection)
      → If conflict: Show warning banner
      → User confirms → COMMIT_MODULE API call
      → On success:
          ├─ Update document.portal.lastKnownContent
          ├─ Clear module details dirty fields
          └─ If directory-saved: Update module.json checksums
```

### Pull from Portal (Portal → Editor)

```
User clicks "Pull" → fetchModuleForPull()
                  → Show PullFromPortalDialog
                  → User selects scripts + module details
                  → pullLatestFromPortal()
                      ├─ Update tab.content with portal content
                      ├─ Update document.portal.lastKnownContent
                      ├─ Update moduleDetailsDraftByTabId
                      └─ If directory-saved:
                          ├─ Write script files to disk
                          └─ Update module.json
```

## Module Details Synchronization

### Data Structure

```typescript
interface ModuleDetailsDraft {
  original: Partial<ModuleMetadata> | null;  // Baseline from portal
  draft: Partial<ModuleMetadata>;            // Current edited values
  dirtyFields: Set<string>;                  // Changed field names
  loadedAt: number;                          // Timestamp
  version: number;                           // Portal version at load
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
  portalId?: string;
}
```

### Module Details Load Flow

```
Open Module Details Dialog
  → Check for existing draft with dirty fields?
    ├─ Yes → Use cached draft + background refresh for conflict check
    └─ No → Fetch fresh from FETCH_MODULE_DETAILS API
         → Store in moduleDetailsDraftByTabId
```

### Conflict Detection

When opening the Module Details dialog with existing dirty fields:

1. Background fetch of latest module details from portal
2. Compare `draft.original` with fresh portal data
3. If `original.version !== portal.version`:
   - Find conflicting fields
   - Show warning banner with options:
     - **Keep My Changes**: Dismiss warning, keep local edits
     - **Use Portal Version**: Replace draft with portal values

### Pull Operation

Module details are included in pull:
- `includeDetailsInPull` checkbox in PullFromPortalDialog
- Shows field-by-field diff (local vs portal values)
- On pull: Updates `moduleDetailsDraftByTabId` for all related tabs

## Module Directory Structure

When a portal-bound module is saved locally:

```
ParentFolder/
└── ModuleName/
    ├── module.json          # Configuration and metadata
    ├── collection.groovy    # Collection script (or .ps1)
    └── ad.groovy            # Active Discovery script (if applicable)
```

### module.json Schema

```typescript
interface ModuleDirectoryConfig {
  version: 1;
  
  portalBinding: {
    portalId: string;
    portalHostname: string;
    moduleId: number;
    moduleType: LogicModuleType;
    moduleName: string;
    lineageId?: string;
  };
  
  scripts: {
    collection?: {
      fileName: string;
      language: 'groovy' | 'powershell';
      mode: 'collection';
      portalChecksum: string;  // SHA-256 of portal content
      diskChecksum: string;    // SHA-256 of disk content
    };
    ad?: {
      fileName: string;
      language: 'groovy' | 'powershell';
      mode: 'ad';
      portalChecksum: string;
      diskChecksum: string;
    };
  };
  
  moduleDetails?: {
    portalVersion: number;
    lastPulledAt: string;            // ISO timestamp
    portalBaseline: Record<string, unknown>;  // Original from portal (like portalChecksum for scripts)
    localDraft?: Record<string, unknown>;     // User's local changes (like disk content for scripts)
  };
  
  lastSyncedAt: string;        // ISO timestamp
}
```

### Checksum and Baseline Usage

**For Scripts:**
- **portalChecksum**: Hash of script content last synced with portal
- **diskChecksum**: Hash of script content currently on disk
- Dirty detection: `currentContent checksum !== portalChecksum`

**For Module Details:**
- **portalBaseline**: Full module details values last synced with portal
- **localDraft**: User's current local values (only stored if different from baseline)
- Dirty detection: Compare `localDraft` fields vs `portalBaseline` fields

These parallel structures are used to detect:
- External file modifications (scripts)
- User's unsaved changes (module details)
- Portal changes since last sync

## Edge Cases

### Multiple Tabs for Same Module

All tabs with matching `moduleId` + `portalId` share:
- Module details draft (`moduleDetailsDraftByTabId`)
- Push/pull operations update all related tabs

### Portal Context Mismatch

When opening a directory-saved module:
- If `selectedPortalId !== config.portalBinding.portalId`:
  - Use stored portal checksums for change detection
  - Display warning: "Portal baseline may be stale"
  - Full sync available once correct portal is selected

### External File Modifications

When opening a module directory:
1. Compute current file checksums
2. Compare with `diskChecksum` in module.json
3. If different → Show "Modified externally" badge
4. User can proceed with modified content

### Missing Script Files

When opening a module directory:
1. Check if script files exist on disk
2. If missing → Show "Missing" badge, disable checkbox
3. Offer "Re-export" option (if portal context active)
4. Re-export fetches script from portal and writes to disk

## Storage Locations

| Data | Storage | Purpose |
|------|---------|---------|
| File handles | IndexedDB (`file-handles`) | Persist file access between sessions |
| Directory handles | IndexedDB (`directory-handles`) | Persist module directory access |
| Tab drafts | IndexedDB (`tab-drafts`) | Crash recovery, session persistence |
| Recent files | IndexedDB (`recent-documents`) | Quick access list |
| Module details drafts | In-memory (Zustand) | Edit session state |

## Key Functions

### document-helpers.ts

- `getOriginalContent(tab, purpose)` - Get baseline content
  - `purpose='local'`: For disk dirty detection
  - `purpose='portal'`: For portal conflict detection
- `hasPortalChanges(tab)` - Check if tab differs from portal
- `parseModuleDetailsFromResponse(module, schema)` - Extract details from API response
- `extractScriptFromModule(module, type, scriptType)` - Extract script content
- `normalizeScriptContent(content)` - Normalize for comparison

### tabs-slice.ts

- `saveModuleDirectory(tabId)` - Save module as directory
- `openModuleDirectory(directoryId)` - Open saved module directory
- `saveFile(tabId)` - Smart save (directory or file)

### module-slice.ts

- `commitModuleScript(tabId, reason)` - Push changes to portal
- `pullLatestFromPortal(tabId, scripts)` - Pull from portal
- `fetchModuleForCommit(tabId)` - Prepare push dialog data
- `fetchModuleForPull(tabId)` - Prepare pull dialog data

### tools-slice.ts

- `loadModuleDetails(tabId, forceRefresh)` - Load module metadata
- `refreshModuleDetailsBaseline(tabId)` - Check for portal changes
- `resolveModuleDetailsConflict(tabId, resolution)` - Handle conflicts
- `persistModuleDetailsToDirectory(tabId)` - Save details to module.json

## Diagram: Complete Sync Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        Portal (LMX)                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Module: DataSource-A                                     │   │
│  │  - Collection Script                                      │   │
│  │  - AD Script                                              │   │
│  │  - Module Details (appliesTo, description, etc.)          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        │                                          ▲
        │ Import (FETCH_MODULE)                    │ Push (COMMIT_MODULE)
        ▼                                          │
┌─────────────────────────────────────────────────────────────────┐
│                        Editor Tabs                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tab: DataSource-A (Collection)                           │   │
│  │  - content: current editor text                           │   │
│  │  - document.portal.lastKnownContent: portal baseline      │   │
│  │  - document.file.lastSavedContent: disk baseline          │   │
│  │  - directoryHandleId: link to saved directory             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  moduleDetailsDraftByTabId[tabId]                         │   │
│  │  - original: portal baseline                              │   │
│  │  - draft: current edits                                   │   │
│  │  - dirtyFields: changed field names                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        │                                          ▲
        │ Save to Directory                        │ Open from Directory
        ▼                                          │
┌─────────────────────────────────────────────────────────────────┐
│                     Local File System                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  DataSource-A/                                            │   │
│  │  ├── module.json (portal binding, checksums, details)     │   │
│  │  ├── collection.groovy                                    │   │
│  │  └── ad.groovy                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

