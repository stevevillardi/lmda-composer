# LogicMonitor IDE - API Explorer Spec

## Overview

The API Explorer is a portal-scoped, LM-tailored API playground that uses the existing session context (CSRF + JSESSIONID) to execute LogicMonitor REST API v3 calls. It avoids Swagger UI embeds and instead uses the existing IDE design patterns (Monaco, shadcn, tabs, resizable panels) to deliver a seamless, IDE-grade experience.

**Scope:** REST API v3 only. No LMv1, no bearer tokens.

---

## Goals

- Execute any endpoint from the bundled OpenAPI schema using the current portal session.
- Provide a refined, native UI that matches the IDE's look and feel.
- Support request history, tab persistence, and environment variables (portal-scoped).
- Generate code snippets from the executed request (curl, python, powershell, groovy).
- Offer response helpers: JSON path copy/save and pagination assist.

---

## Non-Goals

- LMv1 endpoints or token-based auth flows.
- Generic Swagger UI embed.
- API use outside of authenticated LM portals.

---

## UX & Layout

**Entry Points**
- Welcome screen tile: API Explorer
- Command palette: Open API Explorer, New API Request
- Action menu: API Explorer

**Layout (reuses IDE patterns)**
- Left: Endpoint catalog (tag groups, search)
- Center: Request builder (params + headers + body)
- Bottom: Response viewer (tabs, Monaco)
- Right: Variables + helpers (JSON path tools, pagination)

**Design Guidelines**
- Match existing resizable panel behavior and spacing.
- Use existing shadcn components for tabs, inputs, tables, dialogs.
- Monaco for JSON body editor and response viewer.
- Keep interactions keyboard-friendly and predictable.

---

## Schema Handling

**Source:** `docs/logicmonitor-api.yaml`

**Bundling:** Convert to JSON at build time and import into the editor UI.

**Indexing:**
- Group endpoints by tag.
- Each entry includes method, path, params, body schema, response schema.

**Example Generation:**
- Ignore OpenAPI examples (inconsistent quality).
- Generate safe default examples from schema:
  - string: "string"
  - number: 0
  - boolean: false
  - object: 1-3 properties
  - array: single element

---

## Request Builder

**Params**
- Path params: required inputs
- Query params: table with enable toggles
- Header params: table with enable toggles

**Body**
- Content type: `application/json` only
- Two modes:
  - Form fields (schema-driven)
  - Raw JSON (Monaco)
- Sync model: form writes into raw JSON; if raw is edited, warn that raw overrides form until reset.

**Variable Substitution**
- Syntax: `{{var}}`
- Applied to path/query/header/body at execution time.
- Optional preview of resolved request.

---

## Response Viewer

**Tabs**
- JSON (Monaco with decorations)
- Raw
- Headers
- Snippets

**JSON Path Helpers**
- Copy JSON path on field hover/click.
- Save JSON path value to a variable.

**History**
- Keep the last 10 responses per portal, including response bodies.
- Limit is configurable in settings.

---

## Pagination Helper

- Toggle per request.
- Detect size/offset parameters.
- Fetch all pages and aggregate items.
- Show summary: page count, total items, elapsed time, rate usage.

---

## Service Worker Flow

**Executor:** `background/api-executor.ts`

**Request Flow**
1. UI sends request spec to service worker.
2. Acquire CSRF token using existing `PortalManager` logic.
3. Execute HTTP request to `https://{portal}/santaba/rest{path}`.
4. Return status, headers, response body, elapsed time.

**Headers**
```
X-CSRF-Token: {token}
X-Requested-With: XMLHttpRequest
X-version: 3
```

---

## State & Persistence

**Portal-Scoped Storage**
- Variables and history are scoped to portal ID.

**Tabs**
- API requests are persisted like editor tabs (restore/discard).

**Suggested Data Models**
- `ApiTab`
- `ApiEnv`
- `ApiHistoryItem`
- `ApiRequestSpec`
- `ApiResponseSummary`

---

## Component Plan

**New Editor Components**
- `ApiExplorer.tsx`
- `ApiEndpointCatalog.tsx`
- `ApiRequestBuilder.tsx`
- `ApiResponseViewer.tsx`
- `ApiHistoryPanel.tsx`
- `ApiEnvPanel.tsx`
- `ApiSnippetsPanel.tsx`

**Reused Components**
- Monaco loader
- shadcn tabs, table, dialog, input, select
- existing resizable panel system

---

## MVP Scope (Phase 1 + Phase 2)

- Endpoint catalog + search
- Request builder (params, headers, body)
- Request execution via service worker
- Monaco response viewer
- History (last 10, portal-scoped)
- Tab persistence + restore/discard
- Env vars + JSON path helper
- Snippet generation
- Pagination toggle

---

## Open Questions (Resolve Before Implementation)

- Define default history limit and max response size for storage.
- Decide if raw JSON edits should fully disable form editing or allow re-sync.
- Confirm where to expose settings for history limit and response size cap.
