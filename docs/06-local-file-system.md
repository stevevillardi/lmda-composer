# LogicMonitor IDE - Local File System Support

## Overview

This document specifies the implementation for opening and saving local files in LogicMonitor IDE. Due to Chrome Extension limitations, the File System Access API is not available in service workers, so all file operations occur in the editor UI context.

---

## Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Editor UI | File System Access API | Open/save files to disk |
| Editor UI | IndexedDB | Persist file handles across sessions |
| Service Worker | `chrome.storage.local` | Autosave backup (fallback) |

### Constraints

1. **File System Access API** is NOT available in service workers
2. **File handles** stored in IndexedDB require permission re-request after browser restart
3. **User gesture required** to request file permissions (can't auto-prompt on load)

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
│  └────────────────────────────────┬────────────────────────────────────────┘│
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │ chrome.storage.local
                                    ▼
                    ┌───────────────────────────────┐
                    │     Service Worker Context    │
                    │   (autosave backup storage)   │
                    └───────────────────────────────┘
```

---

## File Handle Persistence

### IndexedDB Schema

**Database Name:** `lm-ide-files`
**Version:** 1

**Object Store:** `file-handles`

| Field | Type | Description |
|-------|------|-------------|
| `tabId` | string (key) | Unique identifier matching EditorTab.id |
| `handle` | FileSystemFileHandle | The actual file handle object |
| `fileName` | string | Display name of the file |
| `lastAccessed` | number | Timestamp of last access |

### Handle Lifecycle

1. **Creation**: When user opens a file via File System Access API
2. **Persistence**: Immediately stored in IndexedDB after open/save
3. **Restoration**: Loaded on app mount, matched to tabs by tabId
4. **Permission Check**: Query permission status, prompt if needed
5. **Deletion**: Removed when tab is closed

---

## Dirty State Tracking

### EditorTab Extensions

```typescript
interface EditorTab {
  // ... existing fields ...
  
  /** Content when file was opened or last saved */
  originalContent?: string;
  
  /** Whether this tab has a persisted file handle in IndexedDB */
  hasFileHandle?: boolean;
  
  /** Distinguishes local files from modules, new files, history entries */
  isLocalFile?: boolean;
}
```

### Dirty State Logic

```typescript
function isTabDirty(tab: EditorTab): boolean {
  // New file without originalContent is always "dirty" (never saved)
  if (tab.originalContent === undefined) {
    return true;
  }
  
  // Compare current content to original
  return tab.content !== tab.originalContent;
}
```

### Visual States

| Tab State | Indicator | On Hover |
|-----------|-----------|----------|
| New file (never saved) | ● (dot) | Shows X |
| Local file (clean) | X (close) | X remains |
| Local file (dirty) | ● (dot) | Shows X |
| Module script (any) | X (close) | X remains |

---

## File Operations

### Open File (`Ctrl+O`)

```typescript
async function openFileFromDisk(): Promise<void> {
  // 1. Show file picker
  const [fileHandle] = await window.showOpenFilePicker({
    types: [
      {
        description: 'Script Files',
        accept: {
          'text/plain': ['.groovy', '.ps1', '.txt'],
        },
      },
    ],
    multiple: false,
  });
  
  // 2. Read file content
  const file = await fileHandle.getFile();
  const content = await file.text();
  
  // 3. Create new tab
  const tabId = crypto.randomUUID();
  const language = file.name.endsWith('.ps1') ? 'powershell' : 'groovy';
  
  const newTab: EditorTab = {
    id: tabId,
    displayName: file.name,
    content,
    language,
    mode: 'freeform',
    originalContent: content,
    hasFileHandle: true,
    isLocalFile: true,
    source: { type: 'file' },
  };
  
  // 4. Store handle in IndexedDB
  await fileHandleStore.saveHandle(tabId, fileHandle, file.name);
  
  // 5. Add tab to store
  set({ tabs: [...tabs, newTab], activeTabId: tabId });
}
```

### Save File (`Ctrl+S`)

```typescript
async function saveFile(tabId?: string): Promise<void> {
  const tab = tabId ? tabs.find(t => t.id === tabId) : getActiveTab();
  if (!tab) return;
  
  // Check for existing handle
  const handle = await fileHandleStore.getHandle(tab.id);
  
  if (handle) {
    // Direct save to existing file
    await writeToHandle(handle, tab.content);
    
    // Update originalContent to mark as clean
    updateTab(tab.id, { originalContent: tab.content });
  } else {
    // No handle - trigger Save As
    await saveFileAs(tab.id);
  }
}
```

### Save As (`Ctrl+Shift+S`)

```typescript
async function saveFileAs(tabId?: string): Promise<void> {
  const tab = tabId ? tabs.find(t => t.id === tabId) : getActiveTab();
  if (!tab) return;
  
  const extension = tab.language === 'groovy' ? '.groovy' : '.ps1';
  const suggestedName = tab.displayName.replace(/\.(groovy|ps1)$/, '') + extension;
  
  // 1. Show save picker
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: 'Script Files',
        accept: tab.language === 'groovy' 
          ? { 'text/plain': ['.groovy'] }
          : { 'text/plain': ['.ps1'] },
      },
    ],
  });
  
  // 2. Write content
  await writeToHandle(handle, tab.content);
  
  // 3. Store handle in IndexedDB
  await fileHandleStore.saveHandle(tab.id, handle, handle.name);
  
  // 4. Update tab state
  updateTab(tab.id, {
    displayName: handle.name,
    originalContent: tab.content,
    hasFileHandle: true,
    isLocalFile: true,
  });
}
```

### Write Helper

```typescript
async function writeToHandle(
  handle: FileSystemFileHandle, 
  content: string
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
```

---

## App Startup Flow

### Restoration Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                        App Mount                                 │
│                            │                                     │
│                            ▼                                     │
│              ┌─────────────────────────────┐                    │
│              │ Load draft tabs from        │                    │
│              │ chrome.storage.local        │                    │
│              └──────────────┬──────────────┘                    │
│                            │                                     │
│                            ▼                                     │
│              ┌─────────────────────────────┐                    │
│              │ Load file handles from      │                    │
│              │ IndexedDB                   │                    │
│              └──────────────┬──────────────┘                    │
│                            │                                     │
│                            ▼                                     │
│              ┌─────────────────────────────┐                    │
│              │ Match handles to tabs       │                    │
│              │ by tabId                    │                    │
│              └──────────────┬──────────────┘                    │
│                            │                                     │
│                            ▼                                     │
│              ┌─────────────────────────────┐                    │
│              │ Check permissions for       │                    │
│              │ each handle                 │                    │
│              └──────────────┬──────────────┘                    │
│                            │                                     │
│           ┌────────────────┼────────────────┐                   │
│           ▼                ▼                ▼                   │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│     │ Granted  │    │ Prompt   │    │ Denied   │               │
│     │          │    │ Required │    │          │               │
│     └────┬─────┘    └────┬─────┘    └────┬─────┘               │
│          │               │               │                      │
│          │               ▼               │                      │
│          │    ┌───────────────────┐      │                      │
│          │    │ Show "Restore     │      │                      │
│          │    │ Files" button     │      │                      │
│          │    └─────────┬─────────┘      │                      │
│          │              │                │                      │
│          ▼              ▼                ▼                      │
│     ┌───────────────────────────────────────────┐              │
│     │ Optionally re-read file content to        │              │
│     │ detect external changes                   │              │
│     └───────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Permission States

| State | Action |
|-------|--------|
| `granted` | Handle ready to use, can save directly |
| `prompt` | Need user gesture to request permission |
| `denied` | Cannot use handle, fall back to Save As |

### External Change Detection

When permission is granted, optionally re-read the file to check if it was modified externally:

```typescript
async function checkForExternalChanges(
  tab: EditorTab, 
  handle: FileSystemFileHandle
): Promise<'unchanged' | 'modified' | 'deleted'> {
  try {
    const file = await handle.getFile();
    const diskContent = await file.text();
    
    if (diskContent === tab.originalContent) {
      return 'unchanged';
    }
    return 'modified';
  } catch {
    return 'deleted';
  }
}
```

---

## UI Components

### Permission Restore Banner

When handles need permission re-request, show a non-intrusive banner:

```tsx
function FilePermissionBanner() {
  const { tabsNeedingPermission, requestFilePermissions } = useEditorStore();
  
  if (tabsNeedingPermission.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
      <FileWarning className="size-4 text-amber-500" />
      <span className="text-sm text-amber-500">
        {tabsNeedingPermission.length} file(s) need permission to save
      </span>
      <Button 
        variant="outline" 
        size="sm"
        onClick={requestFilePermissions}
      >
        Restore Access
      </Button>
    </div>
  );
}
```

### Tab Close Confirmation

When closing a dirty tab, show confirmation:

```tsx
function CloseConfirmDialog({ tab, onClose, onSave, onDiscard }) {
  return (
    <AlertDialog>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save changes to {tab.displayName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Your changes will be lost if you don't save them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Don't Save</AlertDialogCancel>
          <AlertDialogAction onClick={onClose}>Cancel</AlertDialogAction>
          <AlertDialogAction onClick={onSave}>Save</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## Keyboard Shortcuts

| Shortcut | Action | Behavior |
|----------|--------|----------|
| `Ctrl+O` / `Cmd+O` | Open File | Show file picker, create new tab |
| `Ctrl+S` / `Cmd+S` | Save | Save to existing handle, or Save As if new |
| `Ctrl+Shift+S` / `Cmd+Shift+S` | Save As | Always show save picker |

---

## Error Handling

### Handle Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `NotAllowedError` | Permission denied | Fall back to Save As |
| `NotFoundError` | File deleted | Show warning, allow Save As |
| `AbortError` | User cancelled picker | No action needed |
| `TypeMismatchError` | Handle type mismatch | Delete handle, treat as new file |

### Graceful Degradation

```typescript
async function robustSave(tab: EditorTab): Promise<boolean> {
  try {
    await saveFile(tab.id);
    return true;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      // Permission denied - try Save As
      try {
        await saveFileAs(tab.id);
        return true;
      } catch {
        // Save As also failed - use download fallback
        downloadAsFile(tab);
        return true;
      }
    }
    
    if (error.name === 'NotFoundError') {
      // File deleted - clear handle and Save As
      await fileHandleStore.deleteHandle(tab.id);
      updateTab(tab.id, { hasFileHandle: false });
      await saveFileAs(tab.id);
      return true;
    }
    
    // Unknown error
    console.error('Save failed:', error);
    return false;
  }
}
```

---

## Browser Compatibility

### Supported Browsers

| Browser | File System Access API | IndexedDB |
|---------|------------------------|-----------|
| Chrome 86+ | ✅ Full support | ✅ |
| Edge 86+ | ✅ Full support | ✅ |
| Firefox | ❌ Not supported | ✅ |
| Safari | ❌ Not supported | ✅ |

Since LogicMonitor IDE is a Chrome Extension, we have guaranteed support for File System Access API.

### Feature Detection

```typescript
function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}
```

---

## Storage Considerations

### IndexedDB Size

File handles are lightweight objects - only metadata is stored, not file content. Storage impact is minimal (~1KB per handle).

### chrome.storage.local Limits

- **Default quota**: 5MB
- **unlimitedStorage permission**: Increases to ~10% of disk space

For autosave drafts, we should:
- Only store tab content, not file handles
- Limit total stored content size
- Clear old drafts when approaching limits

---

## Testing Considerations

### Manual Test Cases

1. **Open file** → Tab shows file name, content loaded
2. **Edit file** → Dot indicator appears
3. **Save file** → Dot disappears, file updated on disk
4. **Close and reopen app** → Tabs restored, files still accessible
5. **Browser restart** → Permission prompt appears, can restore access
6. **External file change** → Detected on next save/read
7. **File deleted externally** → Graceful error, Save As offered
8. **Multiple files** → Each tab tracks its own handle independently

### Edge Cases

- Open same file twice → Create two tabs (both reference same handle)
- Rename file externally → Handle still works (tracks by inode)
- Move file externally → Handle may fail, graceful degradation
- Large files → Consider size limits, streaming for very large files

