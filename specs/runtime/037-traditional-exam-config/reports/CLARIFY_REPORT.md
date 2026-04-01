# Clarify Report — Traditional Exam Configuration

**Step:** 2 — Clarify  
**Timestamp:** 2026-04-01T00:02:00Z  
**Status:** COMPLETE

---

## Summary

Five targeted clarification questions were identified and resolved. All ambiguities concerned boundary behaviors: template validation on creation, semester FK strategy, code uniqueness scope, division-null semantics, and reorder operation contract. No architectural changes needed — all resolutions are consistent with existing patterns.

---

## Clarifications Resolved

| #   | Question                                | Resolution                                                                              |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Q1  | Template ID validation on exam creation | Query template tables, initialize sections/subsections. 404 if template not found.      |
| Q2  | Semester_id FK constraint               | Opaque UUID — no FK in this stage. UUID format validated only.                          |
| Q3  | Code uniqueness scope                   | Simple unique index on code column. DB-per-tenant provides tenant scoping.              |
| Q4  | Division-null fallback behavior         | Null division_id = globally visible within tenant. No default division lookup.          |
| Q5  | Question reorder contract               | PUT accepts ordered array matching exactly current subsection questions. Atomic update. |

---

## Risk Level Assessment

| Factor                             | Points                   |
| ---------------------------------- | ------------------------ |
| Database migration (schema change) | +3                       |
| New table or column added          | +2                       |
| Multi-tenant data isolation logic  | +3                       |
| More than 20 tasks expected        | +2                       |
| Security-sensitive logic (RBAC)    | +0 (existing middleware) |

**Total: 10 → Risk Level: HIGH**

---

## Unresolved Items

None. All clarifications resolved.

---

## Architecture Governance Compliance

| Check                             | Status | Notes                                  |
| --------------------------------- | ------ | -------------------------------------- |
| Tenant isolation confirmed        | ✅     | DB-per-tenant, resolver context only   |
| Template reference strategy clear | ✅     | Query existing tables, no blind insert |
| Division scoping behavior defined | ✅     | Null = visible to all staff            |
| Snapshot integrity confirmed      | ✅     | Score copied at assignment time        |
