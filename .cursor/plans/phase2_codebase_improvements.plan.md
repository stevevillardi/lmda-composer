# Phase 2: Codebase Improvements

## Overview

Follow-up improvements identified from the comprehensive code review. These items were not addressed in Phase 1 either due to complexity, lower priority, or being discovered during implementation.---

## Phase 2A: Bug Fixes (Safety-Critical)

### 2A.1 Fix Module Search Listener Memory Leak

**File:** `src/editor/stores/slices/module-slice.ts`**Issue:** `activeModuleSearchListener` is a module-level variable that's removed in the `finally` block, but if an error occurs before the listener is added, it could leave stale listeners.**Impact:** Memory leaks and unexpected state updates.**Fix:** Use AbortController pattern consistently or ensure cleanup in all code paths.

```typescript
// Before: listener cleanup only in finally
// After: Use AbortController or ensure cleanup on all error paths
const abortController = new AbortController();
try {
  // ... add listener referencing abortController.signal
} finally {
  abortController.abort();
  // cleanup
}
```

---

### 2A.2 Add Tab ID Validation in tools-slice

**File:** `src/editor/stores/slices/tools-slice.ts` (lines ~1369-1375)**Issue:** The code queries for LogicMonitor tabs and uses the first one's ID, but doesn't verify it's actually a valid portal tab managed by the extension.**Impact:** Could send requests to wrong tabs or fail silently.**Fix:** Use the `portalManager.getValidTabIdForPortal()` pattern from the service worker, or validate via message to service worker.

```typescript
// Current (unsafe):
const lmTabs = await chrome.tabs.query({ url: '*://*.logicmonitor.com/*' });
const tabId = lmTabs[0]?.id;

// Better (validate through service worker):
const response = await sendMessage({ 
  type: 'GET_VALID_TAB_FOR_PORTAL', 
  payload: { portalId } 
});
```

---

### 2A.3 Add Runtime Validation for Chrome Message Responses

**Files:** All slices that use `chrome.runtime.sendMessage`**Issue:** Response payloads are cast directly without validation (e.g., `response.payload as ExecutionResult`).**Impact:** Runtime errors if the service worker sends unexpected data.**Fix:** Add runtime validation using type guards or Zod schemas.

```typescript
// Option 1: Simple type guard
function isExecutionResult(obj: unknown): obj is ExecutionResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'status' in obj &&
    typeof (obj as ExecutionResult).status === 'string'
  );
}

// Option 2: Zod schema
const ExecutionResultSchema = z.object({
  status: z.enum(['success', 'error', 'running']),
  output: z.string().optional(),
  // ...
});
```

---

## Phase 2B: DRY & Simplification

### 2B.1 Export Empty Module State from module-slice

**Files:**

- `src/editor/stores/slices/portal-slice.ts`
- `src/editor/stores/slices/module-slice.ts`

**Issue:** `createEmptyModuleState()` in portal-slice duplicates `emptyModuleCache`, `emptyModuleMeta`, `emptyModuleSearch` from module-slice.**Fix:** Export these constants from module-slice and import in portal-slice.

```typescript
// module-slice.ts
export const emptyModuleCache = { ... };
export const emptyModuleMeta = { ... };
export const emptyModuleSearch = { ... };
export function createEmptyModuleState() { ... }

// portal-slice.ts
import { createEmptyModuleState } from './module-slice';
```

---

### 2B.2 Simplify closeTab Logic

**File:** `src/editor/stores/slices/tabs-slice.ts` (lines ~232-286)**Issue:** `closeTab` has nested loops to find the next tab of the same kind.**Fix:** Extract a cleaner `findNextTab` helper.

```typescript
function findNextTab(
  tabs: EditorTab[], 
  closedIndex: number, 
  kind: 'script' | 'api'
): string | null {
  const sameKindTabs = tabs.filter(t => (t.kind ?? 'script') === kind);
  const closedTab = tabs[closedIndex];
  const currentIdx = sameKindTabs.findIndex(t => t.id === closedTab.id);
  
  // Prefer previous tab of same kind, then next, then any tab
  return (
    sameKindTabs[currentIdx - 1]?.id ?? 
    sameKindTabs[currentIdx + 1]?.id ?? 
    null
  );
}
```

---

### 2B.3 Create Reusable Zustand Selectors

**Files:** Multiple components**Issue:** Components manually compute derived state like `activeTab` instead of using selectors.**Fix:** Create a selectors file for common patterns.

```typescript
// src/editor/stores/selectors.ts
import { useEditorStore } from './editor-store';

export const useActiveTab = () => 
  useEditorStore(state => state.tabs.find(t => t.id === state.activeTabId));

export const useSelectedPortal = () =>
  useEditorStore(state => state.portals.find(p => p.id === state.selectedPortalId));

export const useSelectedCollector = () =>
  useEditorStore(state => state.collectors.find(c => c.id === state.selectedCollectorId));

export const useIsModuleTab = () =>
  useEditorStore(state => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    return tab?.source?.type === 'module';
  });
```

---

## Phase 2C: Type Organization

### 2C.1 Create editor/types/ Directory

**Issue:** Types are split across `shared/types.ts` (800+ lines), inline in slices, and in component files.**Fix:** Organize types by domain.

```javascript
src/editor/types/
├── index.ts          # Barrel exports
├── tabs.ts           # EditorTab, DocumentState extensions
├── module-browser.ts # Module browser specific types  
├── execution.ts      # Execution state types
├── api-explorer.ts   # API tab types
└── ui.ts             # Dialog states, preferences
```

**Guidelines:**

- Keep cross-boundary types (messages, shared interfaces) in `shared/types.ts`
- Move editor-only types to `editor/types/`
- Use barrel exports for clean imports

---

## Phase 2D: UI Consistency

### 2D.1 Create Toolbar Button Variants

**File:** `src/components/ui/button.tsx` and `src/editor/components/Toolbar.tsx`**Issue:** Toolbar has repetitive button class compositions.**Fix:** Add toolbar-specific button variants.

```typescript
// button.tsx - add variant
const buttonVariants = cva(
  // ... base classes
  {
    variants: {
      variant: {
        // existing variants...
        toolbar: "gap-1.5 text-xs font-medium",
        toolbarPrimary: "gap-1.5 text-xs font-medium bg-primary text-primary-foreground",
      },
      size: {
        // existing sizes...
        toolbar: "h-7 px-3",
      },
    },
  }
);
```

---

### 2D.2 Standardize Loading State Patterns

**Issue:** Mix of inline `<Loader2 className="animate-spin" />` and `<LoadingState />` components.**Guidelines:**

- Use `<LoadingState />` for full-panel/section loading
- Use inline `<Loader2 className="size-4 animate-spin" />` for button loading states only
- Consider creating `<ButtonLoader />` component for consistent button loading
```typescript
// src/editor/components/shared/ButtonLoader.tsx
export function ButtonLoader({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}
```


---

## Phase 2E: Messaging Migration (Optional)

### 2E.1 Migrate Slices to Use sendMessage Utility

**Files:** All slices using `chrome.runtime.sendMessage`**Issue:** The typed `sendMessage()` utility was created but slices still use raw `chrome.runtime.sendMessage`.**Current pattern:**

```typescript
const response = await chrome.runtime.sendMessage({ type: 'X', payload: {...} });
if (response?.type === 'SUCCESS') { ... }
else if (response?.type === 'ERROR') { ... }
```

**New pattern:**

```typescript
import { sendMessage } from '../../utils/chrome-messaging';

const result = await sendMessage({ type: 'X', payload: {...} });
if (result.ok) {
  // result.data is typed
} else {
  toast.error(result.error);
}
```

**Migration order:**

1. portal-slice.ts (5 usages)
2. tools-slice.ts (12 usages)
3. module-slice.ts (11 usages)
4. execution-slice.ts (3 usages)
5. api-slice.ts (1 usage)

---

## Priority Order

| Phase | Priority | Effort | Risk if Not Done |

|-------|----------|--------|------------------|

| 2A.1 | High | Medium | Memory leaks |

| 2A.2 | High | Low | Wrong tab requests |

| 2A.3 | High | Medium | Runtime crashes |

| 2B.1 | Medium | Low | Code duplication |

| 2B.2 | Medium | Low | Maintenance burden |

| 2B.3 | Medium | Medium | Inconsistent patterns |

| 2C.1 | Medium | Medium | Type sprawl |

| 2D.1 | Low | Low | Inconsistent UI |

| 2D.2 | Low | Low | Inconsistent UI |

| 2E.1 | Low | High | Working fine, just not using new utility |---

## Implementation Notes

- **2A items** should be done first as they address potential bugs
- **2B items** are safe refactors that improve maintainability
- **2C and 2D** can be done incrementally as files are touched