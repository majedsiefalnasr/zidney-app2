# Zidney Backoffice – Institutional Control Panel Contract

This document is a strict behavioral contract for AI agents and developers working inside:

apps/backoffice/

Backoffice is the institutional (B2B) control panel.
It manages workspace-level configuration and content.
It does not execute runtime business logic.

Stack:

- Vue 3 (Composition API only)
- TypeScript (strict mode)
- Pinia
- Tailwind v4
- shadcn-vue
- Vite

Backoffice is a thin, API-driven configuration layer.

---

## Architectural Boundary

Backoffice MUST NOT:

- Access database directly
- Execute grading logic
- Modify attempt state
- Enforce license lifecycle logic
- Enforce student/staff limits
- Perform billing logic
- Bypass API permission checks
- Import backend-only modules
- Import from other apps/
- Contain core business logic

Backoffice MAY:

- Render UI
- Manage forms
- Trigger API actions
- Display derived state
- Perform client-side validation strictly for UX

All authoritative rules are enforced by API.

---

## Workspace Context Rules

All routes follow:

/workspace/:slug/backoffice/...

Backoffice must:

- Read workspace_slug from route
- Never allow manual override of workspace context
- Never store workspace context in localStorage for authority
- Treat backend tenant resolver as authoritative

On workspace change:

- Reset all Pinia stores
- Clear cached data
- Refetch permission + profile state

No cross-workspace state reuse allowed.

---

## UI System Contract (Mandatory)

Backoffice MUST use:

1. shadcn-vue components first
2. packages/ui-system abstractions when available
3. Tailwind v4 utilities for layout only

Never:

- Recreate base components that exist in ui-system
- Hardcode colors or design tokens
- Override structural component internals
- Mix alternative UI libraries

Workspace theming:

- Use controlled theme tokens only
- Modify via configuration, not component mutation
- Never change component structure based on theme

---

## State Management Rules (Pinia)

Rules:

- One store per domain module
- No global mutable singletons
- No storing large datasets without pagination
- No storing entire exam configs unbounded

Stores must:

- Reset on logout
- Reset on workspace change
- Never contain sensitive tokens

No business rules inside stores.

---

## Permission Model (RBAC)

Backoffice enforces UI-level guards based on:

- role
- permissions (provided by API)

Rules:

- Role applies to entire workspace
- No division-level role overrides in Phase 1
- UI may hide actions based on permission
- API remains final authority

Backoffice must never assume permission without backend validation.

---

## Academic Structure Constraints

Backoffice manages:

- Divisions
- Departments
- Groups
- Subjects
- Lessons
- Semesters
- Teams
- Hierarchy tree

Hard rules:

- Student belongs to exactly 1 division
- Staff may belong to multiple divisions
- Default division cannot be removed
- Disabling divisions must show irreversible warning
- Division disable must warn about data reassignment to default division

Backoffice must not simulate structural logic — API enforces integrity.

---

## Content & Exam Configuration

Backoffice may:

- Create MCQ questions
- Create Traditional questions
- Configure exams
- Configure scheduled exams
- Configure auto-selection rules
- Configure grading strategy

Backoffice must NOT:

- Compute grading results
- Execute grading logic
- Modify attempt snapshot after start
- Mutate attempt state

Exam configuration changes must not retroactively affect past attempts.

---

## Translation System

Translation model:

entity_id + entity_type

Rules:

- Track translation coverage per language
- Fallback to default language
- Translations stored inside tenant DB
- No cross-workspace translation leakage

Backoffice displays coverage only.
API enforces integrity.

---

## Workflow System

Example:

Completed → Under Review → Approved → Enabled

Rules:

- API defines allowed transitions
- UI displays only allowed transitions
- UI must not allow illegal transitions
- Transition requires permission

Backoffice must treat workflow engine as backend-controlled.

---

## Subscription & Commercial Layer

Backoffice may:

- Configure plans
- Configure packages
- View billing records
- Manage promo codes
- Enable/disable ads

Backoffice must NOT:

- Override license limits
- Override lifecycle state
- Bypass subscription enforcement
- Directly manipulate payment state

Commercial authority resides in MMC + API.

---

## Media & Assets

Backoffice manages:

- Media library
- Certificate templates
- Branding assets
- Email templates

Rules:

- No direct file system access
- Upload through API only
- Enforce file size/type via API
- No secret storage in media
- No inline base64 storage in DB

---

## Observability Behavior

Backoffice must:

- Include correlation_id in API calls
- Handle 401, 403, 423, 426 correctly
- Render license lock states accurately
- Render subscription expiration accurately
- Surface backend validation errors clearly

UI must never swallow backend errors silently.

---

## Performance Rules

Backoffice must:

- Lazy load heavy modules
- Paginate large datasets server-side
- Use virtualization for large tables
- Avoid deep watchers on large objects
- Avoid large reactive nested exam configs

Never fetch full dataset without pagination.

---

## AI Enforcement Block (Local Scope)

AI generating Backoffice code MUST:

- Use Composition API only
- Use strict TypeScript
- Use shadcn-vue components
- Use Tailwind v4 utilities
- Respect UI system abstractions
- Never invent backend endpoints
- Never embed grading logic
- Never bypass permission checks
- Never manipulate attempt state
- Never modify license lifecycle
- Never store business authority in frontend

If backend contract is unclear:
Stop and request clarification.

---

## Stability Principle

Backoffice is a configuration layer.

If Backoffice:

- Embeds core logic
- Overrides backend enforcement
- Leaks cross-workspace state
- Mutates runtime data

Zidney’s isolation and institutional trust collapse.

Backoffice must remain thin, deterministic, and API-driven.
