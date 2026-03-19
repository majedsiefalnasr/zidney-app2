# Plan Report — Hierarchy Tree

**Step:** 3 — Plan  
**Timestamp:** 2026-03-19T13:07:11Z  
**Status:** COMPLETE

---

## Summary

The technical plan for STAGE_25_HIERARCHY_TREE is complete and guardian-approved. The stage adds a
tenant-scoped `hierarchy_nodes` table, a `packages/domain-core/src/hierarchy/` domain package, a
validation package surface for hierarchy request schemas, and a Backoffice Hono route layer mounted
under `/api/v1/backoffice/workspace/hierarchy-nodes`.

The plan explicitly normalizes the architectural details that were previously blocked during the
guardian pass: `VARCHAR(20) + CHECK` instead of PostgreSQL ENUM, deterministic dual-row locking for
concurrent reparenting, `TIMESTAMPTZ` with tenant-DB `NOW()` for authoritative time, structured
error envelopes with `correlationId`, and Backoffice RBAC enforcement through
`createPermissionGuard(..., PermissionModule.ACADEMIC_STRUCTURE, action)`.

---

## Inputs Reviewed

- `specs/runtime/025-hierarchy-tree/spec.md`
- `specs/runtime/025-hierarchy-tree/plan.md`
- `specs/runtime/025-hierarchy-tree/research.md`
- `specs/runtime/025-hierarchy-tree/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------ |
| API       | New Backoffice hierarchy router, handlers, helpers, and app mount under `/api/v1/backoffice/workspace` |
| Worker    | None                                                                                                   |
| Frontend  | None in this stage                                                                                     |
| DB Master | None                                                                                                   |
| DB Tenant | New `hierarchy_nodes` table, indexes, and schema version bump `1.7.0 -> 1.8.0`                         |

---

## Key Technical Decisions

| #   | Decision                                                                      | Rationale                                                                                             |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Use tenant-scoped `hierarchy_nodes` with self-reference FK                    | Preserves database-per-tenant isolation and keeps hierarchy data fully tenant-local                   |
| 2   | Use `VARCHAR(20) + CHECK` for `status`                                        | Matches Zidney convention and avoids PostgreSQL ENUM drift                                            |
| 3   | Use `WITH RECURSIVE` for tree, subtree, and flat-list reads                   | Single-query traversal is required for hierarchy reads and avoids N+1 query amplification             |
| 4   | Use deterministic dual-row locking for reparent operations                    | Prevents reciprocal concurrent moves from committing a cycle                                          |
| 5   | Mount routes under `/api/v1/backoffice/workspace` using `Hono<BackofficeEnv>` | Aligns with the existing Backoffice runtime contract already used by Stage 19–24 routes               |
| 6   | Enforce RBAC via `PermissionModule.ACADEMIC_STRUCTURE` per-route guards       | Reuses the established Stage 21 permission model instead of inventing hierarchy-specific auth strings |
| 7   | Keep hierarchy CRUD synchronous                                               | No worker involvement is needed for this stage                                                        |
| 8   | Use offset pagination for flat-list reads                                     | Node counts are bounded per workspace and deterministic ordering makes offset pagination acceptable   |
| 9   | Use tenant-DB `NOW()` for `created_at` / `updated_at`                         | Preserves server-authoritative time with a single authoritative source                                |

---

## Migration Impact

| Item                  | Value | Notes                                                                               |
| --------------------- | ----- | ----------------------------------------------------------------------------------- |
| Migration required    | Yes   | Adds `apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts`            |
| `schema_version` bump | Yes   | `1.7.0 -> 1.8.0`                                                                    |
| Backward compatible   | Yes   | Additive tenant migration; downstream staff assignment remains optional and guarded |

---

## Transaction Boundaries

- `createHierarchyNode`: transaction wraps parent validation, scoped uniqueness check, and insert.
- `updateHierarchyNode`: transaction wraps node lock, proposed-parent lock, ancestor walk, scoped uniqueness check, and update.
- `deleteHierarchyNode`: transaction wraps node lock, child count, downstream staff count safe-pass, and delete.
- Read endpoints are non-transactional and read-only.

---

## Idempotency Strategy

- `POST /hierarchy-nodes`: intentionally non-idempotent; duplicate scoped name returns 409.
- `PATCH /hierarchy-nodes/:id`: effectively idempotent for identical payloads; repeated writes remain safe.
- `DELETE /hierarchy-nodes/:id`: non-idempotent by response contract; deleting a missing node returns 404.
- Reads are fully idempotent.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                                          |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All data remains in tenant DB via resolver context                                             |
| All writes are transactional by design | ✅     | Create, update, and delete all execute inside explicit transactions                            |
| Server-authoritative time enforced     | ✅     | `created_at` / `updated_at` use tenant-DB `NOW()`                                              |
| License middleware enforced            | ✅     | Backoffice chain preserves tenant resolver, license enforcement, schema version, JWT, and RBAC |
| Version compatibility enforced         | ✅     | Tenant schema version bumped to `1.8.0` and remains middleware-validated                       |
| No architecture redesign without ADR   | ✅     | Plan stays within existing Backoffice/API/domain structure                                     |

**Overall:** COMPLIANT

---

## Open Risks

- Deep traversal performance depends on recursive CTE cost and index selectivity; timeout guard is planned at 5 seconds.
- Downstream `users.hierarchy_node_id` integration is intentionally deferred, so delete safety relies on the safe-pass column existence check until Stage 26 lands.

---

## Next Step

Proceed to Step 4 — Tasks.
