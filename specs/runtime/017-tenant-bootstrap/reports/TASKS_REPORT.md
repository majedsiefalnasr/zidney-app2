# Tasks Report — TENANT_BOOTSTRAP

**Step:** 4 — Tasks  
**Timestamp:** 2026-02-28T00:30:00Z  
**Status:** COMPLETE

---

## Summary

29 atomic tasks generated for STAGE_17_TENANT_BOOTSTRAP across 6 execution phases. Tasks are ordered by compilation and runtime dependency. 15 frontend scaffold tasks, 5 API backend tasks (middleware + routes + wiring), 1 migration task, 2 type package tasks, and 5 test tasks.

---

## Inputs Reviewed

- `specs/runtime/017-tenant-bootstrap/spec.md`
- `specs/runtime/017-tenant-bootstrap/plan.md`
- `specs/runtime/017-tenant-bootstrap/data-model.md`
- `specs/runtime/017-tenant-bootstrap/research.md`
- `specs/runtime/017-tenant-bootstrap/tasks.md`

---

## Task Breakdown

| Category          | Count          | Notes                                                             |
| ----------------- | -------------- | ----------------------------------------------------------------- |
| Packages & Types  | 2 (T001–T002)  | ModuleEnum, ActionEnum, BackofficeContext types in packages/types |
| DB Migration      | 1 (T003)       | Single DDL transaction — 4 RBAC tables in tenant schema           |
| API Middleware    | 3 (T004–T006)  | license-enforcement.ts update + 2 new backoffice guards           |
| API Routes        | 2 (T007–T008)  | context.ts + ws.ts                                                |
| API App Wiring    | 1 (T009)       | app.ts — hard serial gate (all API imports must exist first)      |
| Frontend Scaffold | 15 (T010–T024) | Full Vue 3 + Vite + Pinia + Vue Router backoffice SPA             |
| Testing           | 5 (T025–T029)  | Unit + integration + migration tests                              |
| **Total**         | **29**         |                                                                   |

---

## Transactional Tasks

- **T003** (migration): entire DDL in single `BEGIN … COMMIT` block — 4 tables created atomically or none, `IF NOT EXISTS` on every statement
- **T007** (context route): read-only tenant DB query — no write transaction required (inherently safe)
- **T008** (ws.ts): Redis SET/DEL operations are atomic per command — no multi-key transaction required

---

## Idempotency Tasks

- **T003**: `CREATE TABLE IF NOT EXISTS` on all 4 tables — safe to re-run multiple times
- **T008**: Redis `wsRedis.set(wsKey, '1', { EX: ttl })` overwrite semantics — no duplicate-insert risk; `DEL` in `onClose` is idempotent

---

## Key Non-Obvious Orderings

| Constraint                                               | Reason                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| T003 must complete before T009                           | `staff_users` table read by authentication middleware at runtime after app wiring |
| T004 (license update) can run in parallel with T001–T003 | Zero TypeScript dependencies — pure extension of existing file                    |
| T009 is a hard serial gate                               | All 6 imports (T004–T008) must exist before `app.ts` compiles                     |
| T016 before T017                                         | Pinia store delegates fetch to `useBackofficeContext` composable                  |
| T024 (main.ts) is last frontend task                     | Stitches App.vue (T015), store (T017), and router (T018)                          |

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                          |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| All write paths include transaction tasks    | ✅     | T003 migration uses single DDL transaction                                     |
| Idempotency tasks are defined where required | ✅     | T003 IF NOT EXISTS, T008 Redis overwrite                                       |
| Layer boundary rules are respected           | ✅     | No frontend tasks import DB schemas; no backend tasks import Vue components    |
| No unrelated file modifications planned      | ✅     | Only 2 existing files touched: license-enforcement.ts (T004) and app.ts (T009) |
| Migration tasks included when required       | ✅     | T003 creates 20260228_001_tenant_rbac_skeleton.ts                              |

**Overall:** COMPLIANT

---

## Open Risks

- T009 (app.ts wiring) is the highest-risk task — any import error in T004–T008 will block it. Implementation must proceed in phase order.
- T025 (RBAC guard test) and T026 (module guard test) depend on T005 and T006 completing first.
- The `checklists/requirements.md` must be fully reviewed before Step 6 (Implement) begins.

---

## Next Step

Proceed to Step 5 — Analyze.
