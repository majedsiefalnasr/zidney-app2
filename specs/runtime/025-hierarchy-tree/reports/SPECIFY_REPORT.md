# Specify Report — Hierarchy Tree

**Step:** 1 — Specify
**Timestamp:** 2026-03-19T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification for the **Hierarchy Tree** stage has been authored and validated. The feature implements a staff-only organizational hierarchy tree per tenant: an unlimited-depth, self-referencing `hierarchy_nodes` table with cycle detection, parent-restricted deletion, unique name scoping per parent, status toggling, and a full suite of CRUD + tree traversal endpoints. All 25 functional requirements are captured and testable. No `[NEEDS CLARIFICATION]` markers remain.

---

## Inputs Reviewed

- `specs/runtime/025-hierarchy-tree/spec.md`
- `specs/runtime/025-hierarchy-tree/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_25_HIERARCHY_TREE.md` (authoritative domain source)

---

## Key Decisions

| #   | Decision                                                                        | Rationale                                                                              |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Cycle detection enforced at API layer (not DB trigger)                          | Enables explicit error messaging and avoids DB-level ambiguity in deep trees           |
| 2   | Staff assignment (`hierarchy_node_id` on `users`) is a downstream stage concern | Keeps this spec focused; prevents scope creep; downstream stage owns its own migration |
| 3   | Parent deletion blocked when children exist (`ON DELETE RESTRICT`)              | Prevents orphaned tree nodes; data integrity over convenience                          |
| 4   | Name uniqueness enforced per-parent scope (not globally)                        | Matches real organizational practice; siblings under different parents can share names |
| 5   | Root nodes allowed (parent_id = NULL)                                           | Multiple root nodes form a forest; no artificial single-root constraint                |
| 6   | Full-tree endpoint returns nested JSON structure                                | Enables direct UI rendering without client-side tree reconstruction                    |
| 7   | Reparenting validates no cycle before committing                                | Atomic operation — validation and write in the same transaction                        |

---

## Functional Requirements Captured

- FR-001: Create root node (parent_id = NULL) with required name
- FR-002: Create child node with validated parent_id
- FR-003: Reject self-referencing parent (id = parent_id)
- FR-004: Reject circular hierarchy (cycle detection on reparent/create)
- FR-005: Read a single hierarchy node by ID
- FR-006: List all nodes with flat structure (includes depth and parent context)
- FR-007: Retrieve full tree as nested JSON from root
- FR-008: Retrieve subtree from specified node ID
- FR-009: Update node name and description
- FR-010: Reparent a node with cycle validation before commit
- FR-011: Toggle node status (ENABLED / DISABLED)
- FR-012: Block deletion if node has children
- FR-013: Enforce name uniqueness per parent scope
- FR-014: Apply tenant resolver before all hierarchy routes
- FR-015: Apply license middleware after tenant resolver
- FR-016: All writes transactional with rollback on failure
- FR-017: Set server-authoritative timestamps on create/update
- FR-018: Return structured error responses `{ success, data, error: { code, message } }`
- FR-019: Emit structured logs with correlation_id and workspace_slug on all operations
- FR-020: Forward-only migration with schema_version increment
- FR-021: Index on parent_id and status columns
- FR-022: ACTIVE license required; SOFT_LOCKED → 423, ARCHIVED → 403
- FR-023: Idempotency on critical write endpoints (create de-dup by name+parent)
- FR-024: Paginated flat-list endpoint for large tenants
- FR-025: Interface contract is stable before downstream staff assignment stage activates

---

## Clarifications Required

None — spec is unambiguous and ready for clarification audit.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                         |
| --------------------------------------- | ------ | ------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | `hierarchy_nodes` in tenant DB only                           |
| License middleware requirement captured | ✅     | Mandatory on all routes                                       |
| Snapshot integrity requirement captured | ✅     | N/A — feature does not touch attempt engine                   |
| Idempotency strategy defined            | ✅     | Create de-dup by name+parent; reparent is transactional       |
| Transaction boundaries identified       | ✅     | All writes (create, update, reparent, delete) in transactions |
| Server-authoritative time enforced      | ✅     | created_at/updated_at set server-side only                    |

**Overall:** COMPLIANT

---

## Open Risks

- Deep tree traversal (100+ levels) may require recursive CTE query optimization — noted for Plan step
- Concurrent reparenting of the same node requires row-level lock strategy — flagged for Plan step

---

## Next Step

Proceed to Step 2 — Clarify.
