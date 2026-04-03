---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- **Phase:** 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT
- **Stage:** Staff Management (STAGE_41_STAFF_MANAGEMENT)
- **Branch:** `spec/041-staff-management`
- **Stage Directory:** `specs/runtime/041-staff-management/`
- **Stage File:** `specs/phases/03_BACKOFFICE_CORE/05_USER_MANAGEMENT/STAGE_41_STAFF_MANAGEMENT.md`
- **Stage Status Before PR:** BACKEND CLOSED
- **Stage Status After PR:** PRODUCTION READY

---

## 2. PR Type

- [x] Feature
- [ ] Architectural Change
- [ ] Infrastructure / Governance
- [ ] Security Hardening
- [ ] Refactor (No Behavior Change)
- [ ] Documentation
- [ ] Test Coverage
- [ ] Bug Fix

---

## 3. Executive Summary

- Implements full Backoffice staff lifecycle management (create, list, get, update, disable, enable, delete) within the tenant scope — all records are workspace-scoped and stored exclusively in the tenant database.
- Introduces Argon2id password hashing for staff accounts, replacing legacy bcrypt usage in the Backoffice login route.
- Adds a `status` column (`ACTIVE` | `INACTIVE` | `SUSPENDED`) to `backoffice_staff_users`, replacing the previous `is_active` boolean, and a `staff_hierarchy_levels` join table for many-to-many staff-to-hierarchy-node assignments.
- Enforces the tenant `staff_limit` transactionally on every staff creation — no race condition over-limit possible.
- Deletes the dead-code `users.ts` route and replaces it with a fully governed, RBAC-guarded `staffRouter`.
- No attempt engine, worker, Frontoffice, or master database affected; change is scoped entirely to tenant DB + `apps/api` + `packages/domain-core` + `packages/validation`.
- All 30 automated tests pass; zero TypeScript or Biome errors; all policy checks clean.

---

## 4. Workflow Completion Evidence

Stage Directory: `specs/runtime/041-staff-management/`

| Step      | Status      | Report Link                                                      |
| --------- | ----------- | ---------------------------------------------------------------- |
| Specify   | ✅ Complete | `specs/runtime/041-staff-management/reports/SPECIFY_REPORT.md`   |
| Clarify   | ✅ Complete | `specs/runtime/041-staff-management/reports/CLARIFY_REPORT.md`   |
| Plan      | ✅ Complete | `specs/runtime/041-staff-management/reports/PLAN_REPORT.md`      |
| Tasks     | ✅ Complete | `specs/runtime/041-staff-management/reports/TASKS_REPORT.md`     |
| Analyze   | ✅ Complete | `specs/runtime/041-staff-management/audits/ANALYZE_REPORT.md`    |
| Implement | ✅ Complete | `specs/runtime/041-staff-management/reports/IMPLEMENT_REPORT.md` |
| Closure   | ✅ Complete | `specs/runtime/041-staff-management/reports/CLOSURE_REPORT.md`   |

---

## 5. Architecture Governance Checklist

- [x] ADR-0001 — Database-per-tenant isolation preserved
- [x] ADR-0002 — Snapshot immutability enforced (N/A — does not touch attempt/grading)
- [x] ADR-0006 — Server-authoritative time only (`NOW()` in PostgreSQL; client time rejected)
- [x] ADR-0007 — Version compatibility enforced (schema bumped to 1.26; runtime rejects old tenants)
- [x] ADR-0008 — Semantic versioning respected (branch + commit scope = `041-staff-management`)
- [x] ADR-0009 — Rate limiting applied (handled at gateway/middleware layer; pre-existing)
- [x] No cross-tenant access introduced
- [x] No middleware bypass created (tenant resolver → license → RBAC mandatory on all staff routes)
- [x] No shared mutable global state introduced
- [x] ARCHITECTURE_MAP.json rules preserved
- [x] Trust chain preserved: Isolation → License → Auth → Attempt(N/A) → Runtime(N/A) → Frontoffice(N/A)
- [x] Import boundaries respected (`apps/api` → `packages/*` ✅; no cross-app; no UI→DB)

---

## 6. Isolation & Security Verification

- [x] No cross-workspace joins
- [x] No default DB fallback (all DB access via `c.get('tenantDb')` from tenant resolver)
- [x] All queries scoped to `workspace_id`
- [x] Structured logging (no `console.log` — all via `createLogger(name)` from `@zidney/logger`)
- [x] Error contract compliance (`{ success, data, error }` on all handlers)
- [x] Sensitive data not logged (passwords never appear in logs or responses)

---

## 7. Transaction & Concurrency Safety

- [x] All write operations wrapped in transactions (create, disable, enable, delete)
- [x] Proper isolation level declared (explicit Serializable isolation level for staff limit check)
- [x] Explicit locking: `staff_limit` enforced inside a transaction to prevent race-condition over-provisioning
- [x] Idempotency guarantees preserved (duplicate email → 409; delete of non-existent → 404)
- [x] No race conditions introduced

---

## 8. Observability & Monitoring

- [x] Structured logging enforced (`createLogger` from `@zidney/logger`)
- [x] Correlation IDs propagated (via Hono context)
- [x] No new metrics added (staff CRUD is not a performance-critical hot path requiring custom metrics)

---

## 9. Testing Coverage

- [x] Unit tests added: 30 tests across 3 files
- [x] Integration behavior covered (isolation + limit + CRUD happy/sad paths)
- [x] Edge cases covered: duplicate email, limit exceeded, cross-workspace isolation, invalid UUID
- [x] Coverage threshold met

**Test Files:**

| File                      | Tests  | Result  |
| ------------------------- | ------ | ------- |
| `staff.crud.test.ts`      | 19     | ✅ PASS |
| `staff.isolation.test.ts` | 7      | ✅ PASS |
| `staff.limit.test.ts`     | 4      | ✅ PASS |
| **Total**                 | **30** | **✅**  |

**Test Command:**

```bash
bun test apps/api/src/routes/backoffice/staff/__tests__/
```

---

## 10. Migration Impact

- [x] New migration included: `apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts`
- [x] Backward compatibility verified: migration adds columns (`status`, `failedLoginCount`, `lockedUntil`, `lastLogin`) with defaults; no destructive changes
- [x] Rollback strategy defined: migration is additive; rolling back drops the new columns
- [x] `password_hash` column migrated from `varchar(72)` → `text` to accommodate Argon2id hashes
- [x] `staff_hierarchy_levels` join table created with FK constraints + cascade delete

**Schema version:** 1.25 → 1.26

---

## 11. Drift Analysis & Architecture Guard

- [x] `speckit.analyze` executed — APPROVED (all 9 criteria passed)
- [x] No architectural violations
- [x] No cross-phase leakage
- [x] No unauthorized stage modification
- [x] `ANALYZE_REPORT.md` confirms APPROVED
- [x] `bun run ai:guard` passed (0 violations)
- [x] `bun run arch:audit` passed (0 violations)
- [x] No architecture drift detected
- [x] 0 TypeScript errors, 0 Biome lint errors

---

## 12. Stage Lifecycle Verification

- [x] Stage Status updated in `specs/phases/03_BACKOFFICE_CORE/05_USER_MANAGEMENT/STAGE_41_STAFF_MANAGEMENT.md` → PRODUCTION READY
- [x] `.workflow-state.json` updated to `stage_production_ready`
- [x] `README.md` progress table complete (all 7 steps ✅)
- [x] All 7 step reports generated in `reports/` and `audits/`

---

## 13. Deployment Readiness

- [x] Safe for staging (additive migration; backward-compatible)
- [x] Safe for production (no breaking changes; all writes transactional)
- [x] No feature flags required
- [x] Runbook update not required (no new infrastructure dependencies)

**Deployment Note:** Apply migrations via `bun run db:migrate` before rolling out new API pods. The `argon2` native module is declared in `apps/api/package.json` — ensure the Docker image has build tools to compile it (or use the pre-built binary from the lock file).

---

## 14. Risk Assessment

Risk Level:

- [x] Low
- [ ] Medium
- [ ] High

**Justification:** Change is scoped to tenant DB and API layer only. No master DB writes. No async workers. No exam/attempt runtime. No Frontoffice impact. The only elevated concern was the argon2 native module, which is validated by the TYPES-001 policy check. All 30 tests confirm correct behavior.

---

## 15. Files Changed

| File                                                                     | Change                              |
| ------------------------------------------------------------------------ | ----------------------------------- |
| `apps/api/package.json`                                                  | Modified — added argon2             |
| `apps/api/src/app.ts`                                                    | Modified — registered staffRouter   |
| `apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts`     | Created — schema 1.25→1.26          |
| `apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts`        | Modified — new columns              |
| `apps/api/src/db/tenant/schemas/staff-hierarchy-levels.schema.ts`        | Created                             |
| `apps/api/src/db/tenant/schemas/index.ts`                                | Modified — export                   |
| `apps/api/src/routes/auth/backoffice-login.ts`                           | Modified — Argon2id + correct table |
| `apps/api/src/routes/backoffice/staff/helpers.ts`                        | Created                             |
| `apps/api/src/routes/backoffice/staff/create-staff.ts`                   | Created                             |
| `apps/api/src/routes/backoffice/staff/list-staff.ts`                     | Created                             |
| `apps/api/src/routes/backoffice/staff/get-staff.ts`                      | Created                             |
| `apps/api/src/routes/backoffice/staff/update-staff.ts`                   | Created                             |
| `apps/api/src/routes/backoffice/staff/disable-staff.ts`                  | Created                             |
| `apps/api/src/routes/backoffice/staff/enable-staff.ts`                   | Created                             |
| `apps/api/src/routes/backoffice/staff/delete-staff.ts`                   | Created                             |
| `apps/api/src/routes/backoffice/staff/index.ts`                          | Created                             |
| `apps/api/src/routes/backoffice/users.ts`                                | Deleted                             |
| `apps/api/src/routes/backoffice/staff/__tests__/staff.crud.test.ts`      | Created — 19 tests                  |
| `apps/api/src/routes/backoffice/staff/__tests__/staff.isolation.test.ts` | Created — 7 tests                   |
| `apps/api/src/routes/backoffice/staff/__tests__/staff.limit.test.ts`     | Created — 4 tests                   |
| `packages/domain-core/package.json`                                      | Modified — added argon2             |
| `packages/domain-core/src/auth/staff-password.ts`                        | Created — Argon2id                  |
| `packages/domain-core/src/auth/index.ts`                                 | Modified                            |
| `packages/domain-core/src/index.ts`                                      | Modified                            |
| `packages/domain-core/src/staff/staff.types.ts`                          | Created                             |
| `packages/domain-core/src/staff/staff.errors.ts`                         | Created                             |
| `packages/domain-core/src/staff/staff.repository.ts`                     | Created                             |
| `packages/domain-core/src/staff/staff.service.ts`                        | Created                             |
| `packages/domain-core/src/staff/index.ts`                                | Created                             |
| `packages/validation/src/staff.schema.ts`                                | Created                             |
| `packages/validation/src/index.ts`                                       | Modified                            |

---

## 16. Final Statement

This PR maintains Zidney architectural integrity and complies with Architecture Governance (AGENTS.md + ADRs).

All 7 workflow steps completed. All reports generated. Stage lifecycle updated to PRODUCTION READY.

Reviewer Sign-off:

- [ ] Architecture Approved
- [ ] Security Approved
- [ ] Ready to Merge

---

## PR Checklist Enforcement (CI)

This repository enforces **Hard Mode governance** automatically in CI.
