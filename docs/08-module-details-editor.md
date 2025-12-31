# Module Details Editor (Datasource First)

## Overview
Add a Module Details dialog for editing datasource metadata and datapoints in the LMDA Composer workflow. The dialog is available when a LogicModule is opened via LMX import (or otherwise in module context) and edits are committed together with script changes. This is designed to scale to other LogicModule types later.

## Goals
- Provide a dedicated Module Details dialog that matches existing dialog styles.
- Edit datasource metadata and datapoints without leaving the script workflow.
- Commit changes only when the user performs the existing commit flow.
- Patch only fields that changed (no unmodified fields in payload).
- Keep a slim appliesTo editor and results viewer (reuse AppliesTo components but avoid nested dialogs).
- Build a structure that can support other module types in future iterations.

## Non-Goals (Initial)
- No graph definition editing in v1 (future).
- No auto-save of module details outside of commit.
- No custom AppliesTo function management in this dialog.

## UX Entry Point
- Add a "Module Details" button in `Toolbar.tsx`.
- Button appears only when a module tab is open and module context is available (e.g., LMX import tracking enabled).
- Clicking opens a full-size dialog, similar to other editor dialogs.

## Dialog Structure (Datasource)
Dialog layout should follow existing patterns (DialogHeader, DialogContent, tabs/sections, standard buttons).

Suggested sections (tabs or stacked panels):
1) Overview
   - Name (required)
   - Display Name
   - Description
   - Applies To (slim editor + test results)
   - Group
   - Technology
   - Tags
   - Collect Interval (seconds)
   - Access Groups (multi-select)

2) Datapoints
   - Left: list of datapoints (name + type + status)
   - Right: datapoint editor panel for selected datapoint
   - Controls: Add datapoint, Remove datapoint

3) Thresholds (part of datapoint editor)
   - Alert settings fields for selected datapoint

## AppliesTo Editor (Slim)
Reuse AppliesToTester components but limit to:
- AppliesTo input editor
- Result viewer (matches count, test results)
- Test action button

Exclude:
- Built-in function list
- Custom function list

Implementation idea:
- Extract a reusable AppliesToEditor component from `AppliesToTester.tsx` that accepts props to hide advanced lists.
- Keep validation and evaluation logic in the same store actions used by AppliesToTester.

## Datapoint Editor Fields (Datasource)
Support editing the following fields per datapoint:
- name (required)
- description
- alertForNoData (0-4)
- alertExpr
- alertTransitionInterval
- alertClearTransitionInterval
- alertSubject
- alertBody
- postProcessorMethod
- postProcessorParam
- rawDataFieldName
- maxDigits
- minValue
- maxValue
- type (0-8)
- dataType (1-8)
- userParam1
- userParam2
- userParam3
- enableAnomalyAlertSuppression
- warnAdAdvSetting
- errorAdAdvSetting
- criticalAdAdvSetting
- adAdvSettingEnabled
- alertExprNote
- originId
- statusDisplayNames

## Datasource Metadata Fields
Support editing:
- displayName
- description
- appliesTo
- group
- technology
- tags
- collectInterval
- name
- accessGroupIds (and display accessGroups for selection)

## State Management
Add module details draft state alongside existing module script tracking:
- `moduleDetailsDraftByTabId` keyed by tab/module id
- `moduleDetailsDirty` state per section
- `moduleDetailsValidation` errors
- `moduleDetailsLoadedAt` to prevent stale updates

Draft creation rules:
- When module tab opened, load full module details (if not already cached)
- Initialize draft from source module
- Track dirty state per field and per section

## Patch / Commit Behavior
Enhance `ModuleCommitConfirmationDialog.tsx`:
- Show summary of script changes and module details changes
- Allow user to expand and review changes
- Commit merges script changes + module details changes

Patch behavior:
- Build payload containing only changed fields
- Omit script fields if unchanged
- Omit datasource metadata fields if unchanged
- Include datapoint changes only when changed (add/update/remove)
- Use existing commit endpoint (same as script commit)

Suggested diff strategy:
- Maintain original module details snapshot
- Compare draft vs original at commit time
- Build patch payload from diff

## API Integration
Use existing datasource commit endpoint (same as current script commit). Add/update fields in payload based on diff.

Read:
- Fetch full datasource details on module open for edit.

Write:
- Commit only changed fields during Module Commit.
- Ensure accessGroups mapped to accessGroupIds for payload.

## Validation Rules
- name required
- collectInterval required and > 0
- datapoint name required
- alertForNoData must be 0-4
- type and dataType must be valid enum values
- AppliesTo should be non-empty if required by LM (check API error handling)

## UI Components (New)
- `ModuleDetailsDialog.tsx` (datasource-focused)
- `ModuleDetailsTabs.tsx` (overview/datapoints)
- `DatapointList.tsx` + `DatapointEditor.tsx`
- `AppliesToEditorSlim.tsx` (extracted from AppliesToTester)

## Where It Hooks In
- `Toolbar.tsx`: add "Module Details" button
- `ModuleCommitConfirmationDialog.tsx`: surface module detail diffs
- `editor-store.ts`: add module details state, load/edit/diff actions
- `module-api.ts`: add read details API call if not already present

## Extensibility (Other Module Types)
Design the dialog to accept a `moduleType` with a per-type schema:
- Datasource: metadata + datapoints + thresholds
- ConfigSource: metadata + script only
- TopologySource: metadata + topology settings
- PropertySource: metadata + rules
- LogSource: metadata + extraction + rules
- EventSource/DiagnosticSource: metadata + scripts

Architecture idea:
- `ModuleDetailsDialog` renders type-specific subcomponents
- shared overview section used by multiple types
- datapoint editor only for datasource

## Risks / Open Questions
- Access group editing: confirm if accessGroups can be patched directly or via accessGroupIds only.
- Datapoint add/remove format in commit payload: confirm API shape and required fields.
- AppliesTo validation: reuse existing tester logic and keep UI compact.
- Performance: large datapoint lists need virtualization or pagination later.

## Milestones
1) Datasource details read + draft state + UI skeleton
2) AppliesTo slim editor (reuse logic)
3) Datapoint list + editor
4) Commit dialog diff summary + patch payload
5) End-to-end commit for datasource metadata + datapoints

