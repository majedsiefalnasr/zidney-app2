# UI TASKS – STAGE_02C (Upgrade & Versioning UI)

Phase Alignment:

- Phase 1 — Platform Foundation (STAGE_02C backend complete)
- Phase 2 — Platform MMC (Stage 16 — Shared UI System not yet implemented)

Status: Ready for Development (Safe to Start)

---

## Scope Definition

This file isolates all UI-related tasks for STAGE_02C to prevent architectural drift before:

Phase 2 — PLATFORM MMC  
Stage 16 — Shared UI System

UI development must:

- Use shadcn-vue components
- Use Tailwind v4 utility classes
- Follow current AGENTS.md UI enforcement rules
- Avoid creating custom UI system primitives (temporary usage only)
- Avoid redefining theme system (defer to Stage 16)

---

## Architectural Guardrails

The following constraints are mandatory:

- No business logic in UI
- No version comparison logic in frontend
- No migration orchestration logic in frontend
- UI consumes API only
- All authority remains server-side
- UI must respect error contract: `{ success, data, error }`

---

## UI Components (Tasks 31–34)

### Task 31 — UpgradeForm Component

File:  
apps/backoffice/src/features/upgrade/UpgradeForm.vue

Responsibilities:

- Input: target_version (SemVer string)
- Validation: client-side format only (X.Y.Z)
- Submit: POST /admin/upgrade
- Display:
  - Loading state
  - 202 Accepted response
  - Error message (standardized error)

Must Use:

- shadcn-vue Card
- shadcn-vue Input
- shadcn-vue Button
- shadcn-vue Alert
- Tailwind v4 spacing utilities

Must Not:

- Validate compatibility
- Infer version policy
- Store upgrade state globally

---

### Task 32 — UpgradeStatus Component

File:  
apps/backoffice/src/features/upgrade/UpgradeStatus.vue

Responsibilities:

- Fetch GET /admin/upgrade/status
- Display:
  - Current schema version
  - Target version (if upgrading)
  - Status: PENDING | RUNNING | SUCCESS | FAILED
  - Timestamp

Visual States:

- Running → Spinner + Warning Badge
- Failed → Error Alert
- Success → Success Badge

Polling Strategy:

- Poll every 5 seconds while status = RUNNING
- Stop polling on SUCCESS or FAILED

---

### Task 33 — UpgradeHistory Component

File:  
apps/backoffice/src/features/upgrade/UpgradeHistory.vue

Responsibilities:

- Fetch migration history
- Display table:
  - migration_file
  - applied_at
  - status
  - checksum

Must Use:

- shadcn-vue Table
- shadcn-vue Badge
- shadcn-vue ScrollArea

No sorting logic server-side assumed.

---

### Task 34 — UpgradePage Container

File:  
apps/backoffice/src/pages/UpgradePage.vue

Responsibilities:

- Compose:
  - UpgradeForm
  - UpgradeStatus
  - UpgradeHistory
- Layout using shared layout container
- Protect route via role check (PLATFORM_OPERATOR)

No layout system duplication.  
Use existing layout wrapper.

---

## API Contracts Required

UI depends on:

POST /admin/upgrade  
GET /admin/upgrade/status  
POST /admin/upgrade/rollback

Error contract:

```
{
  "success": false,
  "data": null,
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message"
  }
}
```

UI must not assume HTTP 200 for success — respect status codes.

---

## Deferred to Phase 2 — Stage 16 (Shared UI System)

The following are explicitly deferred:

- Global toast system
- Global loading overlay
- Centralized modal manager
- Theme switching
- Shared Badge variants registry
- Shared Table abstraction layer
- Shared ErrorBoundary component

Temporary local usage allowed until Stage 16 refactor.

---

## Refactor Plan (When Stage 16 Begins)

When Stage 16 — Shared UI System starts:

- Extract UpgradeForm UI primitives into shared/ui
- Replace local Badge styling with system variants
- Replace polling logic with shared data-fetching abstraction
- Replace alerts with global notification system
- Remove duplicate Tailwind class patterns

---

## Development Order

1. UpgradeForm
2. UpgradeStatus
3. UpgradeHistory
4. UpgradePage integration
5. Route registration
6. Manual test against backend
7. Write minimal component tests

---

## Safety Alignment with Zidney Architecture

This UI layer:

- Does not violate multi-tenancy
- Does not bypass license enforcement
- Does not access DB directly
- Does not duplicate versioning logic
- Does not introduce new domain rules

Safe to implement before Phase 2 — PLATFORM MMC — Stage 16.
