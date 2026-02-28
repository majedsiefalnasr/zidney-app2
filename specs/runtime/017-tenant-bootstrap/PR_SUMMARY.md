---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- Phase: 03 — Backoffice Core / 01 Foundation
- Stage: TENANT_BOOTSTRAP (Stage 17)
- Branch: `017-tenant-bootstrap`
- Stage File: `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_17_TENANT_BOOTSTRAP.md`
- Stage Status Before PR: BACKEND CLOSED
- Stage Status After PR: PRODUCTION READY

---

## 2. PR Type

- [x] Feature
- [ ] Architectural Change
- [ ] Security Hardening
- [ ] Refactor (No Behavior Change)
- [ ] Documentation
- [ ] Test Coverage
- [ ] Bug Fix

---

## 3. Executive Summary

- **Bootstraps the backoffice SPA runtime** for all tenant workspaces: `GET /api/v1/backoffice/context`
  and `WS /ws/backoffice` are the two new entry points for the backoffice application to initialise.
- **Touches API middleware chain, new tenant migration, and new Vue 3 SPA app** — all within strictly
  isolated boundaries: no cross-tenant access, no shared DB pools, no business logic in frontend.
- **Safe to deploy**: migration is forward-only with `backoffice_` prefix; no existing STAGE_12 tables
  (`roles`, `role_permissions`) are modified; `schema_version` auto-incremented by runner.
- **Constitutional guarantees intact**: database-per-tenant preserved, license middleware runs before
  all backoffice routes, server-authoritative time only, structured logging throughout.
- **All 8 guardians returned PASS** across Analyze (5 guardians) and Implement (CI/CD, Deployment
  Engineer, Docker Specialist) after remediation rounds.
- **Dockerfile and nginx** hardened: `builder-deps` stage with Vite devDeps, SPA dist copied to nginx,
  `/ws/backoffice` WS upgrade block, `/backoffice/` SPA try_files fallback, `STOPSIGNAL` fix.

---

## 4. Workflow Completion Evidence

| Step      | Status      | Report Link                                                    |
| --------- | ----------- | -------------------------------------------------------------- |
| Specify   | ✅ Complete | specs/runtime/017-tenant-bootstrap/reports/SPECIFY_REPORT.md   |
| Clarify   | ✅ Complete | specs/runtime/017-tenant-bootstrap/reports/CLARIFY_REPORT.md   |
| Plan      | ✅ Complete | specs/runtime/017-tenant-bootstrap/reports/PLAN_REPORT.md      |
| Tasks     | ✅ Complete | specs/runtime/017-tenant-bootstrap/reports/TASKS_REPORT.md     |
| Analyze   | ✅ Complete | specs/runtime/017-tenant-bootstrap/audits/ANALYZE_REPORT.md    |
| Implement | ✅ Complete | specs/runtime/017-tenant-bootstrap/reports/IMPLEMENT_REPORT.md |
| Closure   | ✅ Complete | specs/runtime/017-tenant-bootstrap/reports/CLOSURE_REPORT.md   |

---

## 5. Constitutional Compliance Checklist

- [x] ADR-0001 — Database-per-tenant isolation preserved (all DB access via tenant resolver)
- [x] ADR-0002 — Snapshot immutability enforced (N/A — no attempt engine touched)
- [x] ADR-0006 — Server-authoritative time only (no client timestamps used)
- [x] ADR-0007 — Version compatibility enforced (`product_version` injected by license middleware)
- [x] ADR-0008 — Semantic versioning respected (migration `20260228_001_*`, schema_version runner)
- [x] No cross-tenant access introduced
- [x] No middleware bypass created (license → RBAC → module enforced on all backoffice routes)
- [x] No shared mutable global state introduced

---

## 6. Isolation & Security Verification

- [x] No cross-workspace joins
- [x] No default DB fallback (tenant resolver mandatory)
- [x] All queries scoped to workspace via tenant DB pool
- [x] Structured logging (0 `console.log` instances in STAGE-17 files)
- [x] Error contract compliance (`{ success, data, error }` on all endpoints)
- [x] Sensitive data not logged (JWT claims not echoed in logs)

---

## 7. Transaction & Concurrency Safety

- [x] Migration uses explicit `BEGIN`/`COMMIT` (forward-only DDL transaction)
- [x] WS connection guard uses atomic Redis `SET NX` (single connection per user)
- [x] Read-only context endpoint — no write transactions required
- [x] Idempotency: context endpoint is fully idempotent (read-only GET)
- [x] No race conditions introduced (Redis MULTI for WS guard)

---

## 8. Observability & Monitoring

- [x] Structured logging enforced (`@zidney/logger` / Pino JSON)
- [x] Correlation IDs propagated via global `correlationIdMiddleware`
- [x] License enforcement logs: `license-engine` service name on every check
- [x] RBAC + module guard logs structured warnings on denial

---

## 9. Testing Coverage

- [x] Unit tests added — 4 unit test files (license-enforcement, rbac-guard, module-guard, migration)
- [x] Integration tests added — 3 integration test files (context, WS, isolation)
- [x] Tenant isolation tests: cross-workspace access attempts verified
- [x] Edge cases covered: soft-lock 423, archived 403, duplicate WS connection, missing permissions
- [x] 67 / 67 tests pass

Test Command:

```bash
bunx vitest run \
  tests/unit/middleware/license-enforcement.test.ts \
  tests/unit/middleware/backoffice-rbac-guard.test.ts \
  tests/unit/middleware/backoffice-module-guard.test.ts \
  tests/unit/db/migrations/tenant-rbac-skeleton.test.ts \
  tests/integration/api/backoffice/context.test.ts \
  tests/integration/api/backoffice/ws.test.ts \
  tests/integration/isolation/backoffice-isolation.test.ts
```

---

## 10. Migration Impact

- [x] New migration included: `apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts`
- [x] Backward compatibility verified: `backoffice_` prefix avoids all STAGE_12 table collisions
- [x] Rollback strategy: restore from pre-upgrade snapshot (per AGENTS.md migration rules)
- [x] No untracked schema changes: only this migration file touches the tenant schema

New tables created:

| Table                         | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| `backoffice_roles`            | Role definitions scoped to workspace           |
| `backoffice_role_permissions` | Module-level action permissions per role       |
| `backoffice_staff_users`      | Backoffice staff users (email, workspace_id)   |
| `backoffice_staff_user_roles` | Junction: staff users ↔ roles (cascade delete) |

---

## 11. Drift Analysis

- [x] speckit.analyze executed (Step 5, commit `ebe813a`)
- [x] No architectural violations
- [x] No cross-phase leakage
- [x] No unauthorized stage modification
- [x] ANALYZE_REPORT.md confirms APPROVED (all 9 structural criteria passed)

---

## 12. Stage Lifecycle Verification

- [x] Stage Status updated in `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_17_TENANT_BOOTSTRAP.md` → PRODUCTION READY
- [x] `.workflow-state.json` updated to `PRODUCTION READY`
- [x] README.md progress table complete (all 8 steps ✅)
- [x] All 7 step reports generated in `reports/`

---

## 13. Deployment Readiness

- [x] Safe for staging (migration forward-only, no destructive ops)
- [x] Safe for production (Docker image builds verified by Docker Specialist guardian)
- [x] No feature flags required
- [ ] Runbook update: add `/backoffice/` SPA endpoint and `/ws/backoffice` WS endpoint to ops runbook

---

## 14. Risk Assessment

Risk Level:

- [ ] Low
- [x] Medium
- [ ] High

Explain why: The change is broad (API + SPA + infra in one stage) but each component is well-isolated
and tested. The `backoffice_` table prefix eliminates the only real risk (schema collision).
Docker and nginx changes are verified by guardian. All 67 tests pass. ESLint 0 errors.

---

## 15. Final Statement

This PR maintains Zidney architectural integrity and complies with Hard Mode governance.

All workflow steps completed. All reports generated. Stage lifecycle updated to PRODUCTION READY.

Reviewer Sign-off:

- [ ] Architecture Approved
- [ ] Security Approved
- [ ] Ready to Merge

---

## Files Changed (46 files, 4086 insertions, 80 deletions)

**New API files:**

- `apps/api/src/middleware/backoffice-module-guard.ts`
- `apps/api/src/middleware/backoffice-rbac-guard.ts`
- `apps/api/src/routes/backoffice/context.ts`
- `apps/api/src/routes/backoffice/types.ts`
- `apps/api/src/routes/backoffice/ws.ts`
- `apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts`

**Modified API files:**

- `apps/api/src/app.ts` (backoffice routes mounted, duplicate correlationId removed)
- `apps/api/src/middleware/license-enforcement.ts` (structured logger, enabled_modules/product_version)
- `apps/api/src/middleware/rate-limit.middleware.ts` (ts-ignore description fix)

**New SPA scaffold (15 files):**

- `apps/backoffice/` (index.html, package.json, vite.config.ts, tsconfig.\*, src/\*\*)

**Infrastructure:**

- `Dockerfile` (builder-deps stage, SPA build, nginx dist COPY, STOPSIGNAL fix, nginx COPY fix)
- `docker/nginx.conf/nginx.conf` (/ws/backoffice + /backoffice/ location blocks)

**Packages:**

- `packages/types/src/tenant-rbac.ts` (new types)
- `packages/types/src/index.ts` (export update)
- `packages/redis-utils/src/index.ts` (atomicSetNx helper)
- `packages/redis-utils/package.json`

**Tests (7 files, 67 tests):**

- `tests/unit/middleware/license-enforcement.test.ts`
- `tests/unit/middleware/backoffice-rbac-guard.test.ts`
- `tests/unit/middleware/backoffice-module-guard.test.ts`
- `tests/unit/db/migrations/tenant-rbac-skeleton.test.ts`
- `tests/integration/api/backoffice/context.test.ts`
- `tests/integration/api/backoffice/ws.test.ts`
- `tests/integration/isolation/backoffice-isolation.test.ts`

**Config:** `vitest.config.ts`, `bun.lock`
