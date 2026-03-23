# Analyze Report — MCQ Baskets

**Step:** 5 — Analyze (Drift Detector)
**Timestamp:** 2026-03-23T01:30:00.000Z
**Status:** PASS

---

## Summary

Full drift analysis of Stage 033 (MCQ Baskets) completed. All 22 functional requirements (FR-001–
FR-022) are mapped to tasks. All 14 business rules (BR-01–BR-14) are satisfied by the task graph.
No constitutional violations detected across isolation, license enforcement, transaction boundaries,
idempotency, snapshot integrity, versioning, observability, or security domains.

One potential drift risk was investigated: the spec's "Basket Filtering on Entity Lists" section
references a `basketId` query parameter on the MCQ question list endpoint. This section is a
**reference design** for how the auto-selection engine (a future stage) will query basket contents
using an indexed subquery. The required index (`idx_mcq_basket_questions_basket_id`) is created in
T003's migration, satisfying FR-020's performance constraint. No modification to the existing MCQ
questions list endpoint is required in Stage 33. No drift. No tasks added.

**Final gate: APPROVED. Implementation authorized.**

---

## Inputs Reviewed

- `specs/runtime/033-mcq-baskets/spec.md`
- `specs/runtime/033-mcq-baskets/plan.md`
- `specs/runtime/033-mcq-baskets/tasks.md`
- `specs/runtime/033-mcq-baskets/research.md`
- `specs/runtime/033-mcq-baskets/data-model.md`

---

## FR → Task Coverage Matrix

| FR     | Requirement Summary                                                | Task(s)                | Status |
| ------ | ------------------------------------------------------------------ | ---------------------- | ------ |
| FR-001 | `DRAFT` state added to basket workflow progression                 | T001                   | ✅     |
| FR-002 | `mcq_baskets` table created with all required columns              | T003, T004             | ✅     |
| FR-003 | `mcq_basket_questions` join table created                          | T003, T005             | ✅     |
| FR-004 | Schema version bumped 1.16.0 → 1.17.0                              | T003, T007             | ✅     |
| FR-005 | Basket CRUD: create, list, get, update, delete endpoints           | T017–T021, T011        | ✅     |
| FR-006 | Basket list supports `type`, `status`, `search` filters            | T014, T018             | ✅     |
| FR-007 | `code` uniqueness enforced at DB + returns `BASKET_CODE_DUPLICATE` | T003, T009, T011       | ✅     |
| FR-008 | List returns paginated results                                     | T011, T014, T018       | ✅     |
| FR-009 | Single basket retrieval by ID                                      | T011, T019             | ✅     |
| FR-010 | Update basket metadata; `type` and `status` excluded               | T014, T015, T020       | ✅     |
| FR-011 | Deletion blocked if referenced in exam config or auto-selection    | T009, T010, T011       | ✅     |
| FR-012 | Basket delete cascades to `mcq_basket_questions`                   | T003                   | ✅     |
| FR-013 | Link question with UNIQUE(basket_id, question_id) constraint       | T003, T009, T011, T022 | ✅     |
| FR-014 | Link rejected with 422 if `max_questions` reached                  | T009, T011, T022       | ✅     |
| FR-015 | Unlink question from basket                                        | T011, T023             | ✅     |
| FR-016 | List questions linked to a basket with pagination                  | T011, T025             | ✅     |
| FR-017 | MCQ question delete cascades `mcq_basket_questions` rows           | T003                   | ✅     |
| FR-018 | License middleware enforced on all basket routes                   | T016, T026             | ✅     |
| FR-019 | Server-set timestamps; client-supplied timestamps rejected         | T004, T015             | ✅     |
| FR-020 | Auto-selection filter uses `idx_mcq_basket_questions_basket_id`    | T003 (index)           | ✅     |
| FR-021 | All write operations execute inside explicit DB transaction        | T011                   | ✅     |
| FR-022 | All responses conform to `{ success, data, error }` contract       | T009, T016, T026       | ✅     |

**Coverage:** 22/22 FRs covered.

---

## Violations Detected

None.

---

## Audit Checklist

| Domain             | Check                                                                             | Status | Notes                                                                                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolation          | No cross-tenant joins                                                             | ✅     | `mcq_baskets` and `mcq_basket_questions` are tenant-DB-only; no master DB joins                                                                                                                                                                                                                             |
| Isolation          | Tenant resolver required for tenant DB access                                     | ✅     | T016 `getDb(c)` extracts the per-tenant pool from `c.get('tenant').pool`. No global singleton.                                                                                                                                                                                                              |
| License            | License middleware enforced before tenant DB access                               | ✅     | T016 helpers implement the full `tenant-resolver → license-enforcement` chain. FR-018 covered.                                                                                                                                                                                                              |
| Transactions       | All write paths transactional                                                     | ✅     | T011: `createBasket` (TX), `updateBasket` (TX + FOR UPDATE lock), `deleteBasket` (TX + FOR UPDATE), `linkQuestion` (TX), `unlinkQuestion` (TX). `transitionStatus` delegates to engine-owned TX per plan AD-003.                                                                                            |
| Idempotency        | Replay protection defined for critical flows                                      | ✅     | `linkQuestion`: UNIQUE(basket_id, question_id) DB constraint + 409 error code `BASKET_QUESTION_DUPLICATE` (both app-layer pre-check and DB constraint). Migration uses `CREATE TABLE IF NOT EXISTS`. Boot registry checks `migration_history` before applying.                                              |
| Snapshot Integrity | Snapshot remains immutable after attempt start (if applicable)                    | N/A    | Stage 33 has no attempt-engine involvement. Basket content is captured at exam configuration snapshot time (future stage). No live basket reads during grading.                                                                                                                                             |
| Versioning         | Schema/product compatibility checks enforced                                      | ✅     | Migration bumps `schema_version` from 1.16.0 to 1.17.0 (T003). Boot registry registers migration at version 1.17.0 (T007). `information_schema` guards in `checkExamConfigReference` and `checkAutoSelectionReference` handle tables not yet present per plan AD-004.                                       |
| Observability      | Structured logs include `correlation_id` and `workspace_slug`                     | ✅     | T016 `buildAuditCtx(c)` captures `correlation_id`, `workspace_slug`, `workspace_id`, `actor_id`, `basket_id` for all route handlers.                                                                                                                                                                        |
| Security           | No tenant override from request body                                              | ✅     | Tenant is always resolved from URL slug via middleware. T014 Zod schemas do not include `tenantId`, `workspaceId`, or any route-level tenant override fields.                                                                                                                                               |
| Routing            | Routing authority registry consulted where required                               | N/A    | Stage 33 does not touch routing authority, agent prompts, or template trees.                                                                                                                                                                                                                                |
| Templates          | Canonical parity exists for every rewired legacy template consumer                | N/A    | No template rewiring in this stage.                                                                                                                                                                                                                                                                         |
| Prompts            | Authoritative and compatibility prompt surfaces stay synchronized                 | N/A    | No prompt surface changes.                                                                                                                                                                                                                                                                                  |
| Guidance           | Stale legacy references to nonexistent template trees are removed                 | N/A    | Not applicable.                                                                                                                                                                                                                                                                                             |
| Entrypoints        | Touched shell and loader paths resolve one authority model                        | N/A    | Not applicable.                                                                                                                                                                                                                                                                                             |
| Validation Cadence | Per-batch smoke evidence recorded for each routing-affecting batch                | N/A    | No routing changes.                                                                                                                                                                                                                                                                                         |
| Validation Cadence | Full governance suite reruns after rewiring and cleanup states                    | N/A    | Not applicable.                                                                                                                                                                                                                                                                                             |
| Stage Authority    | Stage-file requirements and validation boundaries reflected in analyzed artifacts | ✅     | All 22 FRs from spec.md mapped to tasks. All 14 BRs satisfied by task coverage.                                                                                                                                                                                                                             |
| Support Surfaces   | All named in-scope support surfaces have explicit dispositions                    | N/A    | Not applicable.                                                                                                                                                                                                                                                                                             |
| Protected Surfaces | Protected governance files remain unchanged                                       | ✅     | Stage 33 modifies only: `workflow.states.ts`, `workflow.engine.ts`, `migration-registry.ts`, `schemas/index.ts`, `app.ts` (mount only), new files under `packages/domain-core/src/baskets/`, `packages/validation/src/backoffice/`, `apps/api/src/routes/backoffice/baskets/`. No governance files touched. |

---

## Drift Investigation: "Basket Filtering on Entity Lists"

**Trigger:** `spec.md` contains a section describing a `basketId` query parameter on the existing
MCQ question list endpoint (`GET /workspace/:slug/mcq-questions`), which would filter questions
using a subquery into `mcq_basket_questions`.

**Finding:** This section is a **reference design**, not a Stage 33 implementation mandate.

Evidence:

1. The 22 functional requirements (FR-001–FR-022) do not include a requirement to modify the MCQ
   questions list endpoint.
2. FR-020 and BR-12 reference the **auto-selection engine** — a separate future stage — not this
   stage's API surface.
3. The spec's "Out of Scope" section explicitly excludes the auto-selection rule implementation.
4. The `plan.md` Phase 4 API Route Layer lists only 9 basket-specific handlers. No modification to
   an existing MCQ questions endpoint appears in plan.md.
5. The index that enables the future filter (`idx_mcq_basket_questions_basket_id`) IS created in
   T003's migration, satisfying the performance contract (FR-020 / BR-12) for future consumers.

**Conclusion:** No drift. No new task required. The index is in place; the MCQ questions endpoint
filter is a future stage's responsibility.

---

## Workflow Engine Safety Assessment

T001 prepends `DRAFT` to the existing `WorkflowState` enum and `WORKFLOW_STATE_ORDER` array.

**Risk:** If the engine uses hardcoded index positions to validate transitions, prepending DRAFT
shifts all existing state indexes by +1 and could break existing entity transitions.

**Assessment:** The `transitionStatus` engine uses `WORKFLOW_STATE_ORDER.indexOf(from) <
WORKFLOW_STATE_ORDER.indexOf(to)` for forward-transition validation. Relative ordering of the
existing states (`COMPLETED < UNDER_REVIEW < APPROVED < ENABLED`) is preserved after prepending
`DRAFT`. No existing entity type (`subject`, `mcq_question`, `traditional_question`, `exam`,
`topic`, `library_file`, `template`) uses or transitions through `DRAFT`. Adding `mcq_basket` to
`WORKFLOW_ENTITY_TYPES` does not affect existing entity routing.

**Conclusion:** T001 is safe. No regression risk to existing workflow transitions.

---

## Guardian Verdicts

| Guardian                     | Verdict | Key Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zidney-security-auditor      | PASS    | All endpoints protected by tenant resolver → license middleware → RBAC guard chain (T016, T026). Input validated via Zod at API boundary (T014, T015). Client timestamps rejected at schema layer. No stack traces to client — error shape is `{ code, message }` only (T009). No tenant override from request body.                                                                                                                                          |
| zidney-performance-optimizer | PASS    | 5 indexes created in T003: `UNIQUE(code)`, `idx_mcq_baskets_type`, `idx_mcq_baskets_status`, `idx_mcq_basket_questions_basket_id`, `idx_mcq_basket_questions_question_id`. CONCURRENT unique index creation in migration Phase 2 avoids table-level locks. `listBaskets` uses parallel count + fetch queries (T011). `questionCount` computed via COUNT subquery — no stored column, no staleness. Indexed subquery ready for auto-selection engine (FR-020). |
| zidney-qa-engineer           | PASS    | 7 test files covering: unit tests for service layer (T028) + repository (T029); integration tests for CRUD (T030, 12 cases), workflow transitions (T031, 9 cases), question linking (T032, 7 cases), tenant isolation (T033, 1 case), deletion guard + license enforcement (T034, 6 cases). Full transition chain tested. Invalid transition guard tested. Cascade behavior tested.                                                                           |
| zidney-code-reviewer         | PASS    | Domain package structure follows existing `packages/domain-core/src/` conventions. Hono route handler pattern is consistent with existing backoffice routes. T016 helpers centralize shared utilities (DRY). Router assembly (T026) uses `createBasketsRouter()` consistent with other routers. `BasketError` class follows existing domain error patterns. `UpdateBasketBodySchema` correctly excludes `type` (AD-006) and `status` (AD-005).                |

---

## Final Gate Decision

**PASS — Implementation authorized.**

All 22 FRs covered. All 14 BRs satisfied. Zero constitutional violations. Zero drift. Four guardian
verdicts: PASS. Workflow engine safety verified. Implementation gate is open.

---

## Next Step

Proceed to Step 6 — Implement.
