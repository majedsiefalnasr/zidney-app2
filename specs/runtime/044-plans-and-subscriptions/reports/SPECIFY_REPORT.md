# Specify Report — STAGE 44 – Plans & Subscriptions

**Step:** 1 — Specify
**Timestamp:** 2026-04-04T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification complete for the Plans & Subscriptions commercial layer (Stage 44). The spec defines a full B2C subscription management system within each tenant workspace: plan CRUD, manual and gateway-based activation, runtime expiration enforcement, module-level access control, and reporting. Architecture governance compliance confirmed across all dimensions.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/06_COMMERCIAL_LAYER/STAGE_44_PLANS_AND_SUBSCRIPTIONS.md`
- `specs/runtime/044-plans-and-subscriptions/spec.md`
- `specs/runtime/044-plans-and-subscriptions/checklists/requirements.md`
- Existing codebase: `packages/domain-core/src/students/`, `apps/api/src/db/tenant/schemas/`
- Migration history: `20260406_022_student_management.ts` (last migration = 022)

---

## Key Decisions

| #   | Decision                                                                  | Rationale                                                                                  |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Two new tenant tables: `plans` + `subscriptions`                          | Clean separation — plan config is independent from subscription lifecycle                  |
| 2   | `students.subscription_status` kept and synced                            | Preserves Stage 42 compatibility; used for fast-path frontoffice auth checks               |
| 3   | Unique partial index on `subscriptions(student_id) WHERE status='ACTIVE'` | Database enforces "one active subscription" — no application-layer race condition possible |
| 4   | `enabled_modules` stored as JSONB array in plans table                    | Flexible module set without schema changes; validated at application layer                 |
| 5   | Gateway activation is a stub/callback handler only                        | Full payment gateway integration is out of scope; structure is in place                    |
| 6   | Expiration checked at request time in middleware                          | Eliminates cron-only dependency; ensures immediate enforcement on every request            |
| 7   | Soft-delete for plans (`is_deleted = FALSE`)                              | Preserves referential integrity with historical subscriptions                              |
| 8   | Migration 023 as forward-only DDL transaction                             | ADR-0003 compliance — no rollback, no data transformation needed                           |

---

## Functional Requirements Captured

- FR-01: Plan creation (name, price, billing_type, duration_days, enabled_modules)
- FR-02: Plan edit (non-destructive — existing subscriptions unaffected)
- FR-03: Soft-delete plan (blocked if active subscriptions exist)
- FR-04: Manual subscription activation with SERIALIZABLE transaction
- FR-05: Gateway subscription activation callback handler
- FR-06: Runtime expiration enforcement in Frontoffice middleware
- FR-07: Auto-renew trigger for recurring plans (async / job queue)
- FR-08: Module access control — backend gates and Frontoffice visibility
- FR-09: Student subscription_status sync on every state transition
- FR-10: Backoffice reporting (list by student, status, date range; revenue overview)

---

## Clarifications Required

None. All functional requirements are unambiguous from the stage file. Specification is ready for Step 2 (Clarify) to surface any edge cases.

---

## Architecture Governance Compliance

| Check                                    | Status | Notes                                                                     |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------- |
| No cross-tenant access (ADR-0001)        | ✅     | All queries scoped by workspace_id                                        |
| License middleware requirement captured  | ✅     | License middleware runs on all workspace routes before subscription logic |
| Snapshot integrity (ADR-0002)            | ✅     | Not applicable — no attempt engine involvement                            |
| Server-authoritative time (ADR-0006)     | ✅     | expires_at, started_at derived from DB NOW()                              |
| Forward-only migration (ADR-0003)        | ✅     | Migration 023 creates new tables only                                     |
| Version enforcement (ADR-0007, ADR-0008) | ✅     | Semantic versioning tracked via migration numbering                       |
| Transaction boundaries                   | ✅     | All activation/expiration writes in SERIALIZABLE transactions             |
| Idempotency                              | ✅     | Unique partial index prevents duplicate ACTIVE subscriptions              |
