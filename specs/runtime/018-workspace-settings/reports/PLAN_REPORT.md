# Plan Report — WORKSPACE_SETTINGS

**Step:** 3 — Plan **Timestamp:** 2026-02-28T19:20:00Z **Status:** COMPLETE

---

## Summary

Technical plan produced for workspace settings with 8 implementation layers covering migration,
schema, validation, encryption, repository, service, routes, and error handling. Research resolved 5
unknowns. Data model defines 2 tables (workspace_settings ALTER + workspace_settings_audit CREATE).
API contract defines 3 endpoints. Guardian validation passed after 6 remediation fixes (middleware
chain, route versioning, migration naming, env var alignment, cursor pagination, RBAC matrix).

---

## Inputs Reviewed

- `specs/runtime/018-workspace-settings/spec.md`
- `specs/runtime/018-workspace-settings/plan.md`
- `specs/runtime/018-workspace-settings/research.md`
- `specs/runtime/018-workspace-settings/data-model.md`
- `specs/runtime/018-workspace-settings/contracts/api-contract.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| API       | 3 new routes under `/api/v1/backoffice/workspace/settings` (GET, PUT/:group, GET/audit)                               |
| Worker    | None — synchronous CRUD only                                                                                          |
| Frontend  | None — API-only stage                                                                                                 |
| DB Master | None — tenant DB only                                                                                                 |
| DB Tenant | ALTER workspace_settings (add JSONB columns + config_version + singleton constraint), CREATE workspace_settings_audit |

---

## Key Technical Decisions

| #   | Decision                                          | Rationale                                                                                          |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | AES-256-GCM for payment credentials               | Industry standard; authenticated encryption prevents tampering; Node.js crypto built-in            |
| 2   | CHECK + UNIQUE replaces trigger singleton         | Deterministic constraint-level enforcement; race-proof vs trigger approach                         |
| 3   | Dedicated workspace_settings_audit table          | Existing audit_logs has CHECK constraint for auth events; separate table avoids breaking migration |
| 4   | Module co-location in modules/workspace-settings/ | Follows existing module pattern (attempt, csrf, schema); clean boundaries                          |
| 5   | Cursor-based audit pagination                     | Scales with growing audit log; uses (created_at, id) composite cursor                              |
| 6   | Sentinel pattern for credential updates           | Cleanly separates keep/clear/replace without exposing existing values                              |
| 7   | Key identifier prefix (v1:) in encrypted values   | Future-proofs key rotation without data migration                                                  |

---

## Migration Impact

| Item                  | Value | Notes                                                                                    |
| --------------------- | ----- | ---------------------------------------------------------------------------------------- |
| Migration required    | Yes   | `20260228_002_workspace_settings_jsonb.ts` — ALTERs existing table + creates audit table |
| `schema_version` bump | Yes   | New columns require schema version increment                                             |
| Backward compatible   | Yes   | No columns dropped; old columns preserved; forward-only                                  |

---

## Transaction Boundaries

- Settings upsert + audit insert wrapped in single DB transaction
- Encryption happens before transaction begins (fails fast if key unavailable)
- Optimistic locking check (config_version) within the transaction

---

## Idempotency Strategy

- config_version prevents duplicate mutations (same version can't update twice)
- Audit entries are append-only — no duplicate risk from retry
- Encryption produces unique ciphertext per call (random IV) — safe for retry

---

## Guardian Validation Results

### Architecture Checker: VERDICT: PASS

- 0 critical violations
- 2 high issues (H-001: middleware chain, H-002: migration naming) — REMEDIATED
- 3 medium issues (M-001: env var name, M-002: rate limiting, M-003: new schemas dir) — REMEDIATED
- 1 low issue (L-001: route versioning) — REMEDIATED

### API Designer: VERDICT: PASS (after remediation)

- 3 blocking issues (route prefix, schema version middleware, middleware errors) — REMEDIATED
- 3 significant issues (pagination, RBAC matrix, rate limiting) — REMEDIATED
- 4 minor recommendations (3 applied, 1 deferred)

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                      |
| -------------------------------------- | ------ | ---------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All tables in tenant DB, no cross-tenant caching           |
| All writes are transactional by design | ✅     | Single transaction wraps upsert + audit insert             |
| Server-authoritative time enforced     | ✅     | PostgreSQL now() for all timestamps                        |
| License middleware enforced            | ✅     | Full middleware chain including schema version enforcement |
| Version compatibility enforced         | ✅     | Schema version middleware in chain                         |
| No architecture redesign without ADR   | ✅     | No ADR-level changes — uses existing patterns              |

**Overall:** COMPLIANT

---

## Implementation Files Planned

| File                                                                         | Layer              |
| ---------------------------------------------------------------------------- | ------------------ |
| `apps/api/src/db/tenant/migrations/20260228_002_workspace_settings_jsonb.ts` | Migration          |
| `apps/api/src/db/tenant/schemas/workspace-settings.schema.ts`                | Schema             |
| `apps/api/src/modules/workspace-settings/workspace-settings.validation.ts`   | Validation         |
| `apps/api/src/modules/workspace-settings/encryption.service.ts`              | Encryption         |
| `apps/api/src/modules/workspace-settings/workspace-settings.repository.ts`   | Repository         |
| `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`      | Service            |
| `apps/api/src/modules/workspace-settings/workspace-settings.routes.ts`       | Routes             |
| `apps/api/src/modules/workspace-settings/workspace-settings.types.ts`        | Types              |
| `apps/api/src/modules/workspace-settings/workspace-settings.errors.ts`       | Errors             |
| `apps/api/src/routes/backoffice/settings.ts`                                 | Route Registration |

---

## Next Step

Proceed to Step 4 — Tasks.
