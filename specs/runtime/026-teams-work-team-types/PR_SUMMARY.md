---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- Phase: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
- Stage: Teams & Work Team Types
- Branch: `spec/026-teams-work-team-types`
- Stage Directory: `specs/runtime/026-teams-work-team-types/`
- Stage File: `specs/phases/03_backoffice/STAGE_26_TEAMS_WORK_TEAM_TYPES.md`
- Stage Status Before PR: IN PROGRESS
- Stage Status After PR: PRODUCTION READY

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

- Implements **Teams & Work Team Types** — a two-level hierarchy (Team Types → Teams) with Staff Assignments, enabling institutions to organise backoffice staff into work groups
- Touches the **Domain layer** (`packages/domain-core/teams`), **Validation layer** (`packages/validation/backoffice/teams.schemas`), and **API layer** (`apps/api/routes/backoffice/teams`) — all within declared import boundaries
- Adds a forward-only **DDL migration** bumping `schema_version` from `1.9.0` to `1.10.0`; rollback is snapshot-only per ADR-0008
- All 13 endpoints enforce tenant isolation through the tenant resolver; no shared or cross-workspace state is possible
- Staff assignment is **idempotent** (upsert with `ON CONFLICT DO NOTHING`); capacity cap (`max_members`) is enforced inside a `SELECT FOR UPDATE` transaction to eliminate race conditions
- 35 / 35 tasks completed; 56 automated tests pass (28 unit + 28 integration)
- Constitutional guarantees (tenant isolation, server time, license middleware, structured logging, error contract) remain fully intact

---

## 4. Workflow Completion Evidence

Stage Directory: specs/runtime/026-teams-work-team-types/

| Step      | Status      | Report Link                                                         |
| --------- | ----------- | ------------------------------------------------------------------- |
| Specify   | ✅ Complete | specs/runtime/026-teams-work-team-types/reports/SPECIFY_REPORT.md   |
| Clarify   | ✅ Complete | specs/runtime/026-teams-work-team-types/reports/CLARIFY_REPORT.md   |
| Plan      | ✅ Complete | specs/runtime/026-teams-work-team-types/reports/PLAN_REPORT.md      |
| Tasks     | ✅ Complete | specs/runtime/026-teams-work-team-types/reports/TASKS_REPORT.md     |
| Analyze   | ✅ PASSED   | specs/runtime/026-teams-work-team-types/audits/ANALYZE_REPORT.md    |
| Implement | ✅ Complete | specs/runtime/026-teams-work-team-types/reports/IMPLEMENT_REPORT.md |
| Closure   | ✅ Complete | specs/runtime/026-teams-work-team-types/reports/CLOSURE_REPORT.md   |

---

## 5. Constitutional Compliance Checklist

- [x] ADR-0001 — Database-per-tenant isolation preserved (`getDb(c)` derives pool from tenant resolver only)
- [x] ADR-0002 — Snapshot immutability enforced (N/A — no attempt engine involvement)
- [x] ADR-0006 — Server-authoritative time only (all `created_at` / `updated_at` set server-side in DDL defaults)
- [x] ADR-0007 — Version compatibility enforced (schema_version middleware; MIN_SCHEMA_VERSION = 1.10.0)
- [x] ADR-0008 — Semantic versioning respected (1.9.0 → 1.10.0)
- [x] No cross-tenant access introduced
- [x] No middleware bypass created
- [x] No shared mutable global state introduced
- [x] ARCHITECTURE_MAP.json rules preserved (ai-guard.ts passed on all commits)

---

## 6. Isolation & Security Verification

- [x] No cross-workspace joins (all queries include `workspace_id =` scope)
- [x] No default DB fallback (getDb throws if tenant context missing)
- [x] All queries scoped to workspace_id
- [x] Structured logging (no console.log)
- [x] Error contract compliance (`{ success, data, error }` on all responses)
- [x] Sensitive data not logged (only IDs, event names, workspace_slug in logs)

---

## 7. Transaction & Concurrency Safety

- [x] All write operations wrapped in transactions (`db.transaction(trx => ...)` in every service mutator)
- [x] Proper isolation level declared (default READ COMMITTED for standard ops)
- [x] Explicit locking defined where required (`lockTeamForUpdate` → `SELECT FOR UPDATE` before capacity check in `assignStaffToTeam`)
- [x] Idempotency guarantees preserved (`upsertStaffTeamAssignment` → `ON CONFLICT (workspace_id, team_id, staff_id) DO NOTHING`)
- [x] No race conditions introduced (capacity enforcement inside the same `SELECT FOR UPDATE` transaction)

---

## 8. Observability & Monitoring

- [x] Structured logging enforced (`logger.info(ctx, { event })` with correlation_id, workspace_slug, user_id in every service function)
- [x] Correlation IDs propagated (passed via `AuditContext` from route helpers)
- [ ] Metrics added or updated (no new metrics required for this stage)
- [ ] Alerts updated (not applicable)

---

## 9. Testing Coverage

- [x] Unit tests added/updated (28 tests — `packages/domain-core/src/teams/__tests__/teams.service.test.ts`)
- [x] Integration tests added/updated (28 tests — `apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts`)
- [x] Edge cases covered (duplicate names, disabled type/team guards, non-existent staff, capacity exceeded)
- [x] Concurrency scenarios tested (SELECT FOR UPDATE path covered in service unit tests)
- [x] Coverage threshold met

Test Command:

```bash
bun run test \
  packages/domain-core/src/teams/__tests__/teams.service.test.ts \
  apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts
```

Expected: 56 tests pass.

---

## 10. Migration Impact

- [x] New migrations included (`apps/api/src/db/tenant/migrations/20260319_004_teams.ts`)
- [x] Backward compatibility verified (additive only — new tables, no existing table changes)
- [x] Rollback strategy defined (snapshot restore only; migration is forward-only per ADR)
- [x] No untracked schema changes

Migration creates:

- `team_types` (id, workspace_id, name, description, status, created_at, updated_at, deleted_at)
- `teams` (id, workspace_id, name, team_type_id FK, max_members, description, status, created_at, updated_at, deleted_at)
- `staff_teams` (id, workspace_id, team_id FK, staff_id FK, created_at, updated_at)

---

## 11. Drift Analysis

- [x] speckit.analyze executed
- [x] No architectural violations
- [x] No cross-phase leakage
- [x] No unauthorized stage modification
- [x] ANALYZE_REPORT.md confirms APPROVED
- [x] ai-guard.ts executed

---

## 11A. Architecture Guard

- [x] `ai-guard.ts` passed (confirmed in pre-commit hook output on all 4 commits)
- [x] `infra-audit.ts` passed
- [x] No architecture drift detected
- [ ] Architecture diagrams regenerated (not required — no module structure change)

---

## 12. Stage Lifecycle Verification

- [x] Stage Status updated in stage file → PRODUCTION READY
- [x] .workflow-state.json updated to `PRODUCTION READY`
- [x] README.md progress table complete
- [x] All 7 step reports generated in `reports/`

---

## 13. Deployment Readiness

- [x] Safe for staging (migration is additive; all tests pass)
- [x] Safe for production (no destructive DDL; MIN_SCHEMA_VERSION guards incompatible tenants)
- [x] No feature flags required
- [ ] Runbook updated (no runbook change required)

---

## 14. Risk Assessment

Risk Level:

- [x] Low

**Why:** Migration is purely additive (new tables only). No existing tables or indexes modified. All
routes are new additions — no existing endpoint behaviour changed. Tenant isolation is preserved
structurally. Tests cover all error paths including concurrency and capacity guards.

---

## 15. Final Statement

This PR maintains Zidney architectural integrity and complies with Hard Mode governance.

All workflow steps completed. All reports generated. Stage lifecycle updated.

**Commits included:**

| Hash       | Message                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `bbb0e053` | feat(026-teams-work-team-types): create migration, Drizzle schemas (Phase 0)                                       |
| `b42eaf75` | feat(026-teams-work-team-types): implement domain layer — types, errors, repository, service, validation (Phase 1) |
| `cecb7dab` | feat(026-teams-work-team-types): implement API route handlers and router mount (Phase 2)                           |
| `22dd361b` | test(026-teams-work-team-types): add unit and integration tests for teams domain and routes                        |

Reviewer Sign-off:

- [ ] Architecture Approved
- [ ] Security Approved
- [ ] Ready to Merge
