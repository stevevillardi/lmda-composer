# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LMDA Composer is a Chrome Extension (Manifest V3) that provides an enhanced script development experience for LogicMonitor. It features a Monaco-based IDE for Groovy/PowerShell script editing, module browsing, and script execution against LogicMonitor collectors.

## Build/Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server with hot reload - extension auto-reloads
npm run lint       # TypeScript check + ESLint
npm run lint:fix   # Auto-fix lint issues
npm run test       # Run tests once
npm run test:watch # Run tests in watch mode
npm run test:ui    # Run tests with Vitest UI
```

**CRITICAL: Do NOT run `npm run build` unless explicitly requested.** The app uses `npm run dev` for hot reload development. Building breaks the extension and requires manual reload in `chrome://extensions/`.

## Architecture Overview

### Three Execution Contexts

1. **Service Worker** (`src/background/`) - Central coordinator, event-driven, can be terminated when idle
   - Handles all LogicMonitor API communication
   - Persists state to `chrome.storage.local`
   - Key files: `service-worker.ts` (message routing), `portal-manager.ts` (CSRF/collectors), `script-executor.ts` (execution orchestration)

2. **Editor UI** (`src/editor/`) - Full React app in extension tab
   - Monaco Editor, Zustand state management, File System Access API
   - Entry: `App.tsx` with resizable panels
   - State: `stores/editor-store.ts` combining slice-based architecture

3. **Content Script** (`src/content/`) - Injected into LogicMonitor pages
   - Minimal footprint, relays CSRF tokens to service worker

### Message Flow

All contexts communicate via `chrome.runtime.sendMessage`:
```
Content Script ──messages──▶ Service Worker ──HTTPS──▶ LogicMonitor API
                                   ▲
Editor Tab ────messages────────────┘
```

Message handlers organized by domain in `src/background/handlers/`.

### State Persistence

| Context | Storage | Use Case |
|---------|---------|----------|
| Service Worker | `chrome.storage.local` | Portals, collectors, CSRF tokens |
| Editor UI | Zustand (memory) | Active session state |
| Editor UI | IndexedDB | File handles, drafts |

## Code Conventions

### TypeScript
- Use `interface` for object shapes, union types instead of enums
- Use `@/*` path alias for imports from `src/`
- Use `import type` for type-only imports
- Shared types go in `src/shared/types.ts`

### React Components
- Use `function` keyword for components (not arrow functions)
- Fine-grained Zustand selectors to minimize re-renders:
  ```typescript
  // Good
  const selectedPortalId = useEditorStore((state) => state.selectedPortalId);
  // Avoid - re-renders on ANY state change
  const { selectedPortalId } = useEditorStore();
  ```

### Zustand Store Structure

Slice-based architecture in `src/editor/stores/slices/`:
- Each slice exports: State interface, Actions interface, Combined type, Initial state, Slice creator
- Cross-slice dependencies declared via dependency interfaces
- Use `set()` callback form for updates based on current state

### UI Components
- shadcn/ui components with Tailwind CSS v4
- Use `cn()` utility for class merging
- Button variants: `execute` (green), `commit` (blue), `warning` (amber), `destructive` (red)
- Icons from `lucide-react` or project icons file

## Testing

- Framework: Vitest + React Testing Library + jsdom
- Tests in `tests/` directory or co-located as `.test.ts(x)`
- Chrome APIs mocked in `tests/setup.ts`
- Test behavior, not implementation; use Arrange-Act-Assert pattern
