# Specification Quality Checklist: Router & Access Guard Architecture

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-03-02
**Stage**: STAGE_UI_03_ROUTER_AND_GUARDS
**Feature**: [spec.md](../spec.md)
**Checklist Version**: 1.0

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) leak into business requirements
- [x] Focused on user value and behavioral contracts
- [x] Written to be understandable by both technical and non-technical stakeholders
- [x] All mandatory sections completed
- [x] No `[NEEDS CLARIFICATION]` markers remain in spec

---

## Requirement Completeness

- [x] All 10 user stories have explicit acceptance criteria
- [x] Every acceptance criterion is testable and unambiguous
- [x] Success criteria (Completion Criteria) are measurable and verifiable
- [x] Success criteria are implementation-agnostic (no framework references in acceptance criteria)
- [x] All acceptance scenarios are defined (happy path + edge cases)
- [x] Edge cases are explicitly identified (loop prevention, invalid redirect targets, null user)
- [x] Scope is clearly bounded (in-scope and out-of-scope lists provided)
- [x] All dependencies and assumptions documented (7 assumptions listed)

---

## Guard Coverage

- [x] AuthGuard acceptance criteria defined (US1, US2)
- [x] AuthGuard redirect target defined: `<app>-login` with `?redirect=<path>`
- [x] AuthGuard reverse behavior (authenticated → guest-only route) defined
- [x] AuthGuard loop prevention rule defined (short-circuit when `to.name === loginRouteName`)
- [x] WorkspaceGuard acceptance criteria defined (US3)
- [x] WorkspaceGuard redirect target defined: `bo-workspace-selector`
- [x] WorkspaceGuard restricted to Backoffice only (confirmed in multi-app matrix)
- [x] WorkspaceGuard loop prevention rule defined
- [x] RoleGuard acceptance criteria defined (US4)
- [x] RoleGuard redirect target defined: `<app>-unauthorized`
- [x] RoleGuard loop prevention rule defined
- [x] RoleGuard explicitly marked as UI-hint only (backend authoritative)
- [x] FeatureFlagGuard stub defined (FR-07)
- [x] All guards follow factory function (injectable dependency) pattern

---

## Route Meta Schema

- [x] Canonical `RouteMeta` TypeScript interface is fully typed
- [x] All four fields documented: `requiresAuth`, `public`, `roles`, `requiresWorkspace`
- [x] Each field has a JSDoc comment explaining its purpose
- [x] Legacy field migration defined: `guestOnly` → `public`, `requiredRole` → `roles[]`
- [x] Migration table provided with action per field
- [x] Usage examples provided for all common patterns

---

## Multi-App Coverage

- [x] MMC guard configuration documented
- [x] MMC login and dashboard route names defined
- [x] Backoffice guard configuration documented (includes WorkspaceGuard)
- [x] Backoffice login and dashboard route names defined
- [x] Backoffice migration from STAGE_17 inline-guard fully specified (FR-10)
- [x] Frontoffice guard configuration documented
- [x] Frontoffice login and dashboard route names defined
- [x] All three apps covered in multi-app variation matrix
- [x] Constraints specific to each app explicitly stated

---

## Error Handling

- [x] 404 route fallback defined (FR-08.1, US5)
- [x] Unauthorized route fallback defined (FR-08.2, US6)
- [x] GlobalError view fallback defined (FR-08.3)
- [x] No blank screen condition enforced (FR-08.4)
- [x] All fallback routes marked public (FR-08.5)
- [x] Invalid/external `?redirect` param handled (FR-09.4, open-redirect prevention)
- [x] Guard crash protection defined (error handling contract — try/catch rule)
- [x] Full error handling contract table provided

---

## Testability Requirements

- [x] Guard unit test requirements documented (Testability Contract section)
- [x] Test file location convention defined
- [x] All required test scenarios listed per guard (AuthGuard: 7 scenarios, WorkspaceGuard: 4 scenarios, RoleGuard: 5 scenarios)
- [x] Router integration test requirements listed
- [x] Test infrastructure requirements specified (fresh router per test, injectable mocks, Pinia test isolation)
- [x] `createAppRouter()` factory pattern mandated for testability (FR-01.1, AC10.1)
- [x] Guards are injectable (no direct store imports inside factory) — AC10.3

---

## Backoffice Migration Completeness

- [x] Migration from `src/router/index.ts` to `src/core/router/index.ts` specified (FR-10.1)
- [x] Removal of STAGE_17 inline license guard specified (FR-10.2)
- [x] Context loading relocation to `main.ts` bootstrap specified (FR-10.3)
- [x] Route migration to module files specified (FR-10.4)
- [x] `WorkspaceLocked.vue` disposition clarified (FR-10.5)

---

## Constitutional Compliance

- [x] CCD-01: No cross-tenant access — confirmed
- [x] CCD-02: No middleware bypass — N/A confirmed
- [x] CCD-03: No license enforcement in router — confirmed and STAGE_17 violation removal specified
- [x] CCD-04: No JWT decoding — confirmed (FR-04.5)
- [x] CCD-05: No backend RBAC duplication — confirmed (RoleGuard documented as UI-hint only)
- [x] CCD-06: Tenant isolation not violated — confirmed
- [x] CCD-07: No hardcoded workspace identifiers — confirmed
- [x] CCD-08: Structured logging only (`@zidney/logger`) — confirmed (NFR-04)
- [x] CCD-09: Trust chain order respected — confirmed (bootstrap before guards)
- [x] All 9 compliance declarations covered in spec

---

## Non-Functional Requirements

- [x] Performance constraint defined (guards synchronous, < 5 ms, no API calls)
- [x] Type safety constraint defined (strict mode, no `any` in meta)
- [x] Observability requirements defined (log events per guard)
- [x] Maintainability rules defined (single-responsibility, no business logic in guards)
- [x] Security requirements defined (open-redirect prevention, no JWT in router layer)

---

## Feature Readiness Verdict

| Area                      | Status   | Notes                                          |
| ------------------------- | -------- | ---------------------------------------------- |
| User Stories              | COMPLETE | 10 stories, all with acceptance criteria       |
| Guard Pipeline            | COMPLETE | 4 guards, full condition matrix                |
| Route Meta Schema         | COMPLETE | Canonical interface + migration table          |
| Multi-App Matrix          | COMPLETE | MMC, Backoffice, Frontoffice all covered       |
| Error Handling            | COMPLETE | 404, Unauthorized, GlobalError, open-redirect  |
| Testability               | COMPLETE | All scenarios listed, infrastructure specified |
| Backoffice Migration      | COMPLETE | Full migration path specified                  |
| Constitutional Compliance | COMPLETE | 9 declarations, all confirmed                  |

**Overall Status**: ✅ READY FOR PLANNING (`/speckit.plan`)

---

## Notes

- The most significant hidden complexity in this stage is the **Backoffice STAGE_17 migration**. The existing `apps/backoffice/src/router/index.ts` embeds a license-check guard (`isActive`) which is a constitutional violation. FR-10 specifies its removal. The planner must account for this as a refactoring task with regression risk.
- The **RouteMeta schema migration** (from `guestOnly`/`requiredRole` to `public`/`roles[]`) affects existing routes in MMC and Frontoffice. These are low-risk but must be tracked as explicit migration tasks.
- The **`FeatureFlagGuard` stub** is intentionally a no-op. Its sole purpose is to hold pipeline position 4 for a future stage. The planner should create a simple stub task, not a full implementation task.
- No clarifications were needed — all ambiguities were resolved by reading the stage file, existing router code, and AGENTS.md constitutional constraints.
