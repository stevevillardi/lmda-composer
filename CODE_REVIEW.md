# LMDA Composer Code Review

## Findings (ordered by severity)

### High
- `src/background/service-worker.ts:59-72` The sender validation allows any `chrome-extension:` origin, which means other extensions could call privileged APIs if they can message the service worker. Remediation: restrict extension senders to `sender.id === chrome.runtime.id` and only allow LogicMonitor page origins for content scripts (avoid blanket `chrome-extension:`).
- `src/editor/components/api/ApiResponseViewer.tsx:451-466` The response UI is rendered twice (main view and fullscreen) with the main view only hidden. This keeps two Monaco editors mounted when fullscreen is open, which is heavy on memory/CPU and can cause duplicate workers. Remediation: render a single instance (conditionally render one container or move the tab content into a single component and only mount it once).

### Medium
- `src/editor/components/LogicModuleBrowser.tsx:125-149` `filtered.sort(...)` mutates the `modules` array from state in-place, which can reorder cached data and cause subtle UI/state bugs. Remediation: sort a copy (`return [...filtered].sort(...)`) and include `moduleMeta.hasMore` + `cachedSearch` in the memo deps to avoid stale filters.
- `src/editor/stores/editor-store.ts:573-590` `setSelectedPortal` clears `modulesCache` but leaves `modulesMeta` and `modulesSearch` intact. This can leave stale `hasMore`/search state and block module fetches after portal switch. Remediation: reset `modulesMeta` and `modulesSearch` alongside `modulesCache` (as already done in `handlePortalDisconnected`).
- `src/editor/stores/editor-store.ts:608-635` `fetchDevices` does not guard against portal/collector changes during the async call, so older responses can overwrite the new selection. Remediation: capture `selectedPortalId`/`selectedCollectorId` at call time and compare before committing the result (similar to `refreshCollectors`), or use a request token.
- `src/editor/stores/editor-store.ts:3537-3607` Debug command progress listeners are removed only on complete/error. If the user cancels and the service worker never sends a completion/error, the listener can leak. Remediation: remove the listener in `cancelDebugCommandExecution` and/or have the service worker emit a cancellation completion message.
- `src/background/module-searcher.ts:132-150` Module search loads every module of each selected type into memory and scans full scripts. This can become large and block the service worker on big portals. Remediation: stream results page-by-page with early termination, add a result limit, or use server-side search where possible.
- `src/editor/stores/editor-store.ts:1767-1825` API pagination aggregates all items in memory and then `JSON.stringify`s them, which can be very large even with `apiResponseSizeLimit` trimming after the fact. Remediation: cap aggregate size/rows, or stop aggregating once the size limit is reached.

### Low
- `src/editor/components/api/ApiResponseViewer.tsx:305-337` `formatJson(response.body)` runs on every render; large responses will repeatedly parse/pretty-print. Remediation: memoize the formatted JSON per response body or add a "Format JSON" action to avoid repeated parsing.
- `src/background/rate-limiter.ts` `rateLimitStates` is never pruned, so long-running sessions across many portals can accumulate stale entries. Remediation: evict on portal removal or add a max size/TTL.

## Unused code (static import scan)

The following UI components appear unused by import path. Consider deleting to reduce maintenance surface or keep them in a separate template folder.

- `src/components/ui/accordion.tsx`
- `src/components/ui/aspect-ratio.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/button-group.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/carousel.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/field.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/input-otp.tsx`
- `src/components/ui/item.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/spinner.tsx`

## Consolidation opportunities

- `src/editor/components/LogicModuleBrowser.tsx` and `src/editor/components/LogicModuleSearch.tsx` duplicate module type definitions; move to a shared constant.
- `src/editor/components/api/ApiResponseViewer.tsx` and `src/background/api-executor.ts` both implement `normalizePath`; consider a shared helper in `src/shared` or `src/editor/utils`.
- `src/editor/components/api/ApiResponseViewer.tsx` and `src/editor/stores/editor-store.ts` both implement env var substitution via `resolveValue`; extract a shared function to avoid drift.
- `src/editor/components/EditorPanel.tsx`, `src/editor/components/api/ApiRequestBuilder.tsx`, and `src/editor/components/api/ApiResponseViewer.tsx` all build Monaco theme/options; consider a `useMonacoSettings()` hook.

## Test gaps

- No coverage for service worker sender validation or message routing; add unit tests for `isValidSender` and message handling.
- No tests for cancellation flows (script execution + debug command cancellation) or for race conditions in portal/collector/device selection.
- No regression tests for module search memory limits or pagination aggregation size.

## Scope notes

Reviewed `src/`, `docs/`, `tests/`, and config files. Skipped `node_modules/`, `dist/`, and packaged zip artifacts.
