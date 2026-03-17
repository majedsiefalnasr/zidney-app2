# CLARIFY REPORT — Departments (STAGE_23)

**Stage:** Departments
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
**Branch:** `spec/023-departments`
**Generated:** 2026-03-17
**Step:** 2 — Clarify

---

## Summary

Ambiguity scan completed on `spec.md`. 5 targeted clarifications were identified and resolved.
All clarifications were appended to `specs/runtime/023-departments/spec.md` under `## Clarifications / ### Session 2026-03-17`.

No unresolved markers remain. Specification is ready for technical planning.

---

## Clarifications Resolved

### Q1 — Cycle Detection Algorithm

**Ambiguity:** The spec stated cycle detection was required but did not specify the algorithm (ancestor walk vs. recursive CTE).

**Resolution:** Mandatory recursive SQL CTE inside the write transaction. Application-layer traversal is not acceptable since it risks race conditions under concurrent parent updates.

**Impact:** Implementer must use PostgreSQL `WITH RECURSIVE` CTE in the same transaction as the update.

---

### Q2 — `max_users` Reduction Below Current Count

**Ambiguity:** No rule existed for reducing `max_users` after existing student assignments already exceed the new value.

**Resolution:** Silently allowed. `max_users` is a forward-only cap. Existing assignments are never invalidated automatically. No validation error is returned on the update. Only new assignments after the cap change are blocked.

**Impact:** `PUT /departments/:id` accepts `max_users` reduction without re-validating existing assignments.

---

### Q3 — Division Consistency Scope on Reparent

**Ambiguity:** FR-004 only constrained the moved node, but it was unclear whether the entire child subtree must be re-validated for division consistency.

**Resolution:** Moved node only. Subtree re-validation is explicitly excluded (O(subtree) cost is not acceptable). The assumption is that subtree is already valid since the moved node's division_id cannot differ from its children.

**Impact:** Division consistency check on reparent only validates `parent.division_id` vs. `node.division_id` — no subtree scan.

---

### Q4 — `SELECT FOR UPDATE` Target Row

**Ambiguity:** Spec referenced "row lock" for max_users check but did not specify which row to lock.

**Resolution:** Lock the `departments` row using `SELECT ... FOR UPDATE` before counting students. Locking individual student rows is incorrect and would produce phantom reads at scale.

**Impact:** `SELECT id, max_users FROM departments WHERE id = $1 FOR UPDATE` must precede the student count query within the transaction.

---

### Q5 — `PUT` with `parent_id: null` Semantics

**Ambiguity:** JSON `null` vs. field absence was not distinguished in the spec for `parent_id` in update payloads.

**Resolution:** Explicit JSON `null` = reparent to root (no parent). Field absence = no change to parent. Handler must inspect key presence using `Object.hasOwn(body, 'parent_id')`, not just value truthiness.

**Impact:** Update handler requires PATCH-style key presence inspection for `parent_id` field.

---

## Risk Assessment After Clarifications

| Risk Area                        | Before          | After                                    |
| -------------------------------- | --------------- | ---------------------------------------- |
| Cycle detection                  | Undefined       | Specified (recursive CTE in transaction) |
| max_users cap reduction          | Undefined       | Silently allowed (forward-only)          |
| Division consistency on reparent | Ambiguous scope | Moved node only                          |
| Transactional lock target        | Undefined       | departments row via FOR UPDATE           |
| parent_id null semantics         | Ambiguous       | null = root, absent = no-op              |

**Overall Risk Level:** LOW → all implementation-blocking ambiguities resolved.

---

## Next Step

**Step 3 — Plan** — Technical planning authorized. All clarifications resolved.
