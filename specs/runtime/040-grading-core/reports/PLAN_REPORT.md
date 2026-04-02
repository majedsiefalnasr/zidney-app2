# Plan Report — Grading Core

**Step:** 3 — Plan  
**Timestamp:** 2026-04-02T00:03:00.000Z  
**Status:** COMPLETE

---

## Summary

Technical plan defines a pure domain-layer grading engine in `packages/domain-core/src/grading/` with 3 new database tables, 1 column addition to `attempts`, and 8 domain-core source files. Zero new API endpoints — domain logic only.

---

## Inputs Reviewed

- `specs/runtime/040-grading-core/spec.md`
- `specs/runtime/040-grading-core/plan.md`
- `specs/runtime/040-grading-core/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                       |
| --------- | --------------------------------------------------------------------- |
| API       | None (no new endpoints in this stage)                                 |
| Worker    | None (worker integration deferred to Phase 04_RUNTIME)                |
| Frontend  | None                                                                  |
| DB Master | None                                                                  |
| DB Tenant | 3 new tables, 1 column addition, 1 check constraint update, migration |

---

## Key Technical Decisions

| #   | Decision                                     | Rationale                                               |
| --- | -------------------------------------------- | ------------------------------------------------------- |
| 1   | Pure domain layer, zero HTTP deps            | Separation of concerns; grading invoked by worker later |
| 2   | All-or-nothing binary scoring (v1)           | Simplicity; partial/negative scoring deferred to v2     |
| 3   | Separate `grading_status` column on attempts | Grading state machine independent of attempt lifecycle  |
| 4   | Per-question result rows (not JSONB blob)    | Enables individual question audit, override, query      |
| 5   | SELECT FOR UPDATE for concurrency            | Prevent double-grading without external locks           |
| 6   | Snapshot-only data access                    | ADR-0002 compliance; deterministic results              |

---

## Migration Impact

| Item                  | Value | Notes                                          |
| --------------------- | ----- | ---------------------------------------------- |
| Migration required    | Yes   | `20260404_019_grading_core.ts`                 |
| `schema_version` bump | Yes   | 1.24.0 → 1.25.0                                |
| Backward compatible   | Yes   | New tables + new column with default; no drops |

---

## Transaction Boundaries

- `gradeAttempt()`: Single transaction wrapping SELECT FOR UPDATE → compute → INSERT results → UPDATE attempt status → COMMIT
- Full rollback on any failure — no partial grading state persisted

---

## Idempotency Strategy

- `grading_status = GRADED` check before computation
- `UNIQUE(attempt_id)` on `grading_results` prevents duplicate inserts at DB level
- Re-invocation returns existing result without re-computing

---

## Architecture Governance Compliance

| Check                                               | Status | Notes                                           |
| --------------------------------------------------- | ------ | ----------------------------------------------- |
| No cross-tenant logic introduced (ADR-0001)         | ✅     | All queries scoped by workspace_id              |
| All writes are transactional by design              | ✅     | Single transaction for entire grading flow      |
| Server-authoritative time enforced (ADR-0006)       | ✅     | graded_at = NOW() in DB                         |
| License middleware enforced                         | ✅     | N/A — no API endpoints in this stage            |
| Version compatibility enforced (ADR-0007, ADR-0008) | ✅     | grading_version tracked; schema 1.24.0 → 1.25.0 |
| No architecture redesign without ADR                | ✅     | Domain layer addition, no architecture changes  |
| Trust chain respected                               | ✅     | Domain layer only — no auth/license bypass      |
| Import boundaries respected                         | ✅     | domain-core imports zero apps/\* modules        |

**Overall:** COMPLIANT

---

## Open Risks

- None identified. All scope items are well-defined with clear grading rules and snapshot data already captured by prior stages.

---

## Next Step

Proceed to Step 4 — Tasks.
