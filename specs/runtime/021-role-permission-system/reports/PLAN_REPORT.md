# Plan Report — STAGE_21_ROLE_PERMISSION_SYSTEM

**Step:** 3 — Plan **Timestamp:** 2026-03-02T00:00:00.000Z **Status:** COMPLETE

---

## Summary

Technical planning for the Role & Permission System (Backoffice) is complete. The plan discovered
that STAGE_17 had already created a `backoffice_roles` table (missing `status` column) and a
triplet-model `backoffice_role_permissions` table (incompatible with this stage's boolean-flags
model). The plan introduces a new `backoffice_role_module_permissions` table alongside additive
migration operations to extend the existing schema. A new `rbac_audit_logs` table is required
because the existing STAGE_03 `audit_logs` table has an immutable `CHECK` constraint that cannot
accommodate new event types.

Both Guardian Plan Validators returned **VERDICT: PASS**:

- **Zidney Architecture Checker**: PASS — all 14 architectural rules satisfied
- **Zidney API Designer**: PASS — all 12 API standards satisfied

Three low-severity recommendations noted (non-blocking): URI versioning documentation, cursor-based
pagination future-proofing, and spec.md table name alignment.

---

## Inputs Reviewed

- `specs/runtime/021-role-permission-system/spec.md`
- `specs/runtime/021-role-permission-system/plan.md`
- `specs/runtime/021-role-permission-system/research.md`
- `specs/runtime/021-role-permission-system/data-model.md`
- `specs/runtime/021-role-permission-system/contracts/api-contracts.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | New migration; new domain package; new guard middleware; 9 new endpoints                                                                            |
| Worker    | None — no async jobs for RBAC in Phase 3                                                                                                            |
| Frontend  | New `usePermission` composable (display-only); role management UI pages                                                                             |
| DB Master | None                                                                                                                                                |
| DB Tenant | 4 schema changes: roles.status added, backoffice_role_module_permissions created, staff_users.role_id + division_ids added, rbac_audit_logs created |

---

## Key Technical Decisions

| #   | Decision                                                                              | Rationale                                                                                         |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | New `backoffice_role_module_permissions` table (not modifying STAGE_17 triplet table) | Forward-only migration policy prevents destructive modification of existing constrained table     |
| 2   | New `rbac_audit_logs` table (not extending STAGE_03 `audit_logs`)                     | Existing `audit_logs.event_type` CHECK constraint is immutable; cannot add RBAC event types       |
| 3   | `rbac_v2:` cache key prefix                                                           | Avoids collision with STAGE_17 `rbac:` keys in Redis                                              |
| 4   | Route permission registry as a static map (plain JS object)                           | Simple, verifiable at deploy time; fail-closed for unregistered routes; no dynamic discovery risk |
| 5   | JWT `workspace_id` assertion as explicit guard sub-step                               | Closes cross-tenant token replay gap regardless of upstream validateJwtClaims implementation      |
| 6   | `SELECT FOR UPDATE` only on delete-role path                                          | Only delete operation has TOCTOU risk; all other mutations are idempotent at READ COMMITTED       |
| 7   | `is_active` boolean on `backoffice_staff_users` mapped to ACTIVE in guard logic       | Avoids unnecessary schema migration; semantically equivalent                                      |
| 8   | Per-request cache as default; Redis optional                                          | Matches STAGE_17 pattern; zero invalidation complexity at per-request scope                       |

---

## Migration Impact

| Item                         | Value | Notes                                                                              |
| ---------------------------- | ----- | ---------------------------------------------------------------------------------- |
| Migration required           | Yes   | `apps/api/src/db/tenant/migrations/20260302_001_rbac_role_permissions_complete.ts` |
| `schema_version` bump        | Yes   | `1.3.0 → 1.4.0`                                                                    |
| Backward compatible          | Yes   | Additive only: ALTER TABLE (add nullable columns) + CREATE TABLE                   |
| Master migration affected    | No    | Tenant DB only                                                                     |
| Existing migrations modified | No    | Forward-only; STAGE_17 and STAGE_03 files untouched                                |

---

## Transaction Boundaries

- **Create role + initial permissions + audit log** — single transaction; all-or-nothing rollback
- **Update role name/status + audit log** — single transaction
- **Replace full permission set + audit log (PUT)** — single transaction (delete-all + insert-all)
- **Delete role (with SELECT FOR UPDATE) + audit log** — single transaction with row lock
- **Assign role to staff user + audit log** — single transaction

---

## Idempotency Strategy

- **POST /roles** — natural idempotency via `UNIQUE (name)` constraint; 409 on duplicate
- **PUT /roles/:id/permissions** — full replace semantics; explicitly idempotent
- **PATCH /staff/:userId/role** — assigning same role_id twice is a documented no-op
- **DELETE /roles/:id** — serialized via `SELECT FOR UPDATE`; second concurrent attempt returns 404
- **PATCH /roles/:id** — last-write-wins; idempotent status updates

---

## New Files Planned

| File Path                                                                          | Purpose                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260302_001_rbac_role_permissions_complete.ts` | DDL migration: 4 schema changes + schema_version bump                     |
| `packages/domain-core/src/rbac/rbac.service.ts`                                    | Pure business logic: role CRUD, permission evaluation, cache invalidation |
| `packages/domain-core/src/rbac/rbac.types.ts`                                      | TypeScript types for roles, permissions, guard context                    |
| `packages/domain-core/src/rbac/rbac.audit.ts`                                      | Audit log write function (co-transactional)                               |
| `apps/api/src/middleware/backoffice-permission-guard.ts`                           | Hono middleware factory; route permission registry                        |
| `apps/api/src/routes/backoffice/roles.ts`                                          | 9 role management endpoints                                               |
| `apps/backoffice/src/composables/usePermission.ts`                                 | Vue 3 display-only composable (no enforcement)                            |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                           |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All tables tenant-only; JWT workspace_id validated before DB access             |
| All writes are transactional by design | ✅     | All 5 mutation paths wrapped in single DB transactions including audit log      |
| Server-authoritative time enforced     | ✅     | All timestamps via `DEFAULT NOW()` / `sql\`NOW()\``, never client-supplied      |
| License middleware enforced            | ✅     | License middleware in chain before auth-jwt and permission-guard                |
| Version compatibility enforced         | ✅     | schema_version 1.3.0 → 1.4.0; runtime rejects incompatible tenants              |
| No architecture redesign without ADR   | ✅     | Plan works within existing Hono/Drizzle/Bun stack; no new frameworks introduced |

**Overall:** COMPLIANT

---

## Guardian Plan Validation Results

| Guardian                    | Verdict | Notes                                                                               |
| --------------------------- | ------- | ----------------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | All 14 rules satisfied; 2 minor non-blocking notes (spec naming, spec status field) |
| Zidney API Designer         | ✅ PASS | All 12 API standards satisfied; 3 low-severity non-blocking recommendations         |

**Composite Gate: APPROVED — Implementation authorized.**

---

## Open Risks

1. **Two permission table models coexist** — STAGE_17 triplet (`backoffice_role_permissions`) and
   STAGE_21 boolean-flags (`backoffice_role_module_permissions`) both exist in tenant DB. STAGE_21
   guard targets only the new table. Formal deprecation deferred to a post-STAGE_21 cleanup stage.
2. **JWT `workspace_id` claim in existing tokens** — Tokens issued before STAGE_21 may lack this
   claim. Guard returns 403 on mismatch; coordinated token rotation required if existing long-lived
   sessions exist.
3. **Redis cache invalidation failure** — On Redis DEL failure: log ERROR, proceed with transaction;
   next request does fresh DB read. No stale data serves as permission bypass.
4. **Route permission registry completeness** — All future Backoffice routes must be registered;
   missing registration = fail-closed (FR-024). Deployment checklist must verify registry coverage.

---

## Next Step

Proceed to Step 4 — Tasks.
