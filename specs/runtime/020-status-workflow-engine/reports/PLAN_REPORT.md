# Plan Report — STAGE_20_STATUS_WORKFLOW_ENGINE

**Step:** 3 — Plan **Timestamp:** 2026-03-01T00:03:00.000Z **Status:** COMPLETE

---

## Summary

Full technical plan generated for the Status Workflow Engine. The engine is a domain-package-layer
service (`packages/domain-core/src/workflow/`) with API routes at `apps/api/src/modules/workflow/`.
One tenant migration (`20260301_002_workflow_engine.ts`) creates the `workflow_logs` table and bumps
`schema_version` from `1.2.0` to `1.3.0`. Two guardian validators ran (Architecture Checker + API
Designer). Architecture Checker returned VERDICT: PASS with one high-priority logging defect. API
Designer returned VERDICT: BLOCKED (V-001 error envelope, V-002 workspace_slug logging). Both
defects were remediated in-plan before proceeding: `WorkflowContext` extended with
`workspaceSlug`/`workspaceId`, error envelope updated to include `details` and `correlationId` in
all error responses.

---

## Inputs Reviewed

- `specs/runtime/020-status-workflow-engine/spec.md`
- `specs/runtime/020-status-workflow-engine/plan.md`
- `specs/runtime/020-status-workflow-engine/research.md`
- `specs/runtime/020-status-workflow-engine/data-model.md`
- `specs/runtime/020-status-workflow-engine/contracts/workflow-transition-api.md`

---

## Architecture Layers Touched

| Layer          | Planned Changes                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| API            | New module `apps/api/src/modules/workflow/` — route handler, validation, context builder              |
| Worker         | None                                                                                                  |
| Frontend       | None                                                                                                  |
| DB Master      | None                                                                                                  |
| DB Tenant      | Migration `20260301_002_workflow_engine.ts` — `workflow_logs` table + WorkflowState VARCHAR(50) check |
| Domain Package | New `packages/domain-core/src/workflow/` — engine, types, errors, states                              |

---

## Key Technical Decisions

| #   | Decision                                                                              | Rationale                                                                                       |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Engine in `packages/domain-core/src/workflow/`                                        | Domain package layer rule; no HTTP logic, no framework dependency                               |
| 2   | `executeTransition(db: TenantDb, context: WorkflowContext)` explicit injection        | Eliminates singleton risk; FR-015 compliance; testable in isolation                             |
| 3   | `VARCHAR(50) + CHECK` constraint instead of PostgreSQL ENUM for state storage         | Migration-safe; adding new states in future phases does not require ALTER TYPE (painful in PG)  |
| 4   | `SELECT FOR UPDATE` row lock as first transaction step                                | Eliminates concurrent transition race; SC-006 compliance; no optimistic retry complexity needed |
| 5   | `workflow_logs` trigger reuses existing `prevent_audit_modification()` DB function    | Consistency with audit pattern; no new trigger function needed                                  |
| 6   | `WorkflowContext` carries `workspaceSlug` + `workspaceId` (added post-guardian audit) | AGENTS.md mandatory log fields; pre-resolved from tenant resolver context in route handler      |
| 7   | Error envelope includes `details: null, correlationId` (added post-guardian audit)    | Zidney standard error envelope compliance; correlationId enables request tracing                |
| 8   | Entity status columns NOT in this migration                                           | Avoids coupling to entity tables that don't yet exist; added per-entity in Stage 21+            |
| 9   | `schema_version` bumped `1.2.0 → 1.3.0`                                               | Minor version bump for new `workflow_logs` table; no breaking change for existing queries       |

---

## Migration Impact

| Item                   | Value | Notes                                                               |
| ---------------------- | ----- | ------------------------------------------------------------------- |
| Migration required     | Yes   | `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts` |
| `schema_version` bump  | Yes   | `1.2.0 → 1.3.0`                                                     |
| Backward compatible    | Yes   | New table only; no existing columns/tables modified                 |
| `down()` is reversible | No    | `down()` throws non-reversible error per ADR-0008                   |

---

## Transaction Boundaries

- Transition execution:
  `BEGIN → SELECT FOR UPDATE → validate → UPDATE entity → INSERT workflow_logs → COMMIT`
- On any failure in steps 4–10: `ROLLBACK` — no partial state reaches the database
- No nested transactions; one client connection per transition call

---

## Idempotency Strategy

- **FR-017**: Duplicate transition on an entity already in `targetState` →
  `400 invalid_state_transition` (not silent success)
- **Concurrent race**: `SELECT FOR UPDATE` ensures second concurrent caller sees post-commit state
  after lock release → returns `400 invalid_state_transition` or `409 workflow_conflict` depending
  on race outcome
- Workflow logs are append-only — no deduplication required; idempotency is maintained by state
  validation, not by log uniqueness

---

## Constitutional Compliance

| Check                                         | Status | Notes                                                                            |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| No cross-tenant logic introduced              | ✅     | `db: TenantDb` injected explicitly; no cross-tenant joins possible               |
| All writes are transactional by design        | ✅     | 5-step SELECT FOR UPDATE atomic transaction in engine                            |
| Server-authoritative time enforced            | ✅     | `NOW()` in UPDATE and `DEFAULT NOW()` in INSERT; no client timestamp path        |
| License middleware enforced                   | ✅     | Middleware chain: Tenant Resolver → License → Auth → Rate Limit → Handler        |
| Version compatibility enforced                | ✅     | `schema_version 1.2.0 → 1.3.0`; version enforced by existing middleware chain    |
| No architecture redesign without ADR          | ✅     | No new ADR needed; all decisions within existing framework patterns              |
| AGENTS.md logging compliance (workspace_slug) | ✅     | Fixed post-guardian: `workspaceSlug`/`workspaceId` added to `WorkflowContext`    |
| Zidney error envelope compliance              | ✅     | Fixed post-guardian: `details: null, correlationId` added to all error responses |

**Overall:** COMPLIANT — tasks authorized.

---

## Guardian Verdicts

| Guardian                    | Verdict                  | Notes                                                                              |
| --------------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| Zidney Architecture Checker | PASS                     | One logging defect found (workspace_slug); marked high priority; corrected in plan |
| Zidney API Designer         | BLOCKED → PASS after fix | V-001 error envelope + V-002 logging; both corrected in-plan before proceeding     |

---

## Open Risks

- `prevent_audit_modification()` DB function assumed to exist from prior migration (source migration
  not cited in plan — dependency implicit). This must be validated during implementation.

---

## Next Step

Proceed to Step 4 — Tasks.
