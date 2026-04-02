# Plan Report - Auto Selection Engine

**Step:** 3 - Plan  
**Timestamp:** 2026-04-02T00:05:30Z  
**Status:** COMPLETE

---

## Summary

Technical planning completed with deterministic selection architecture, transaction boundaries, contract definitions, and migration scope defined. Guardian review passed after remediating API consistency issues.

---

## Inputs Reviewed

- `specs/runtime/039-auto-selection-engine/spec.md`
- `specs/runtime/039-auto-selection-engine/plan.md`
- `specs/runtime/039-auto-selection-engine/research.md`
- `specs/runtime/039-auto-selection-engine/data-model.md`
- `specs/runtime/039-auto-selection-engine/contracts/`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                               |
| --------- | --------------------------------------------------------------------------------------------- |
| API       | Attempt-start orchestration, criteria validation endpoints/contracts, middleware-guarded flow |
| Worker    | No behavior change; consumes frozen snapshot/selection output                                 |
| Frontend  | No authority changes; backoffice submits config and receives validation errors                |
| DB Master | No changes                                                                                    |
| DB Tenant | Additive table/column support for deterministic seed + attempt question persistence           |

---

## Key Technical Decisions

| #   | Decision                                                                             | Rationale                                                         |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Deterministic selection uses stable candidate ordering + seeded shuffle              | Guarantees replayability and audit integrity                      |
| 2   | Save/publish validation blocks overlap scenarios that can undersize unique final set | Prevents runtime start failures and enforces fairness pre-runtime |
| 3   | Attempt start and selected-question persistence run in one transaction               | Prevents partial state and preserves trust chain invariants       |

---

## Migration Impact

| Item                  | Value | Notes                                                                       |
| --------------------- | ----- | --------------------------------------------------------------------------- |
| Migration required    | Yes   | Tenant DB additive schema for attempt question persistence/snapshot support |
| `schema_version` bump | Yes   | Minor additive bump only                                                    |
| Backward compatible   | Yes   | Additive-only design with compatibility guards                              |

---

## Transaction Boundaries

- Attempt start: validate -> seed -> select -> persist attempt + attempt_questions in one atomic transaction.
- Criteria save/publish: validate block totals/overlap/refs before status mutation in one transaction.

---

## Idempotency Strategy

- Attempt-start requires `Idempotency-Key`.
- Same key + same payload replays original success response.
- Same key + different payload returns `ATTEMPT_START_IDEMPOTENCY_CONFLICT` (409).

---

## Architecture Governance Compliance

| Check                                               | Status | Notes                                                        |
| --------------------------------------------------- | ------ | ------------------------------------------------------------ |
| No cross-tenant logic introduced (ADR-0001)         | ✅     | Tenant DB only, workspace slug routing                       |
| All writes are transactional by design              | ✅     | Attempt start and publish/save flows are atomic              |
| Server-authoritative time enforced (ADR-0006)       | ✅     | Runtime windows and selection timing are server-side         |
| License middleware enforced                         | ✅     | Middleware chain preserved before handlers                   |
| Version compatibility enforced (ADR-0007, ADR-0008) | ✅     | Middleware compatibility checks retained                     |
| No architecture redesign without ADR                | ✅     | Existing layers preserved; no ADR-required structural change |
| Trust chain respected                               | ✅     | Isolation -> License -> Auth -> Attempt runtime maintained   |
| Import boundaries respected                         | ✅     | apps->packages only; no forbidden cross-app imports          |

**Overall:** COMPLIANT

---

## Open Risks

- Performance target (500 concurrent starts at 200 ms target) requires implementation + validation proof.
- Overlap and uniqueness checks may require query/index tuning under large pools.

---

## Next Step

Proceed to Step 4 - Tasks.
