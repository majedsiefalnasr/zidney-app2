# Clarify Report — Hierarchy Tree

**Step:** 2 — Clarify
**Timestamp:** 2026-03-19T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

5 implicit architectural ambiguities were identified and resolved for the Hierarchy Tree stage. All resolutions are documented in the `## Clarifications / ### Session 2026-03-19` section of `spec.md`. No `[NEEDS CLARIFICATION]` markers remain. Spec is unambiguous and ready for technical planning.

---

## Inputs Reviewed

- `specs/runtime/025-hierarchy-tree/spec.md`

---

## Clarifications Resolved

| #   | Category                    | Question Summary                                                                             | Resolution                                                                                                             |
| --- | --------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Concurrency / Locking       | Concurrent reparent race — two transactions both pass cycle-check without a locking strategy | `SELECT ... FOR UPDATE` on the node being updated at transaction start; serializes concurrent updates to the same node |
| 2   | Traversal Query Strategy    | Full-tree / subtree / flat-list — application recursion vs DB-level recursive CTE            | Single `WITH RECURSIVE` CTE for all read traversal; application assembles tree from CTE result                         |
| 3   | Flat-List Sort / Pagination | No stable sort key defined; non-deterministic page boundaries with OFFSET pagination         | Mandatory stable sort: `ORDER BY depth ASC, name ASC` before OFFSET/LIMIT                                              |
| 4   | Status Filter Semantics     | ENABLED child of DISABLED parent creates structural incoherence in filtered nested tree      | Entire subtree rooted at DISABLED node is pruned when `status=ENABLED` filter active; no child promotion to root       |
| 5   | `updated_at` on no-op PUT   | Conflict between "updated on every write" vs "does not change updated_at erroneously"        | `updated_at` bumped unconditionally on every accepted PUT — no field-level diff detection                              |

---

## Observations

- Risk level assessed: **MEDIUM** — cycle detection concurrency requires row-level locking; recursive CTE depth may need query optimization for very deep trees. Both are documented in the plan.
- Interface contract for downstream staff assignment stage remains clearly out-of-scope.
- No ADR conflicts identified.

---

## Next Step

Proceed to Step 3 — Plan.
