# Clarify Report — Tags

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-23T00:15:00Z  
**Status:** COMPLETE

---

## Summary

Ambiguity scan performed on `spec.md`. Five targeted clarification questions were identified and
resolved, with answers appended directly into `spec.md` under `## Clarifications → ### Session 2026-03-23`.
Three supplementary checklists were generated (tenant-isolation, security, performance) covering
76 items across the key compliance domains.

---

## Clarifications Resolved (Session 2026-03-23)

| #   | Question                                           | Resolution                                                                                                                                                                                        |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Transaction scope for assignment preconditions** | All 4 precondition checks run INSIDE the write transaction (BEGIN → checks → INSERT → COMMIT), eliminating TOCTOU. Consistent with `lessons.service.ts` / `subjects.service.ts` platform pattern. |
| 2   | **Concurrent normalized_name collision**           | Catch `err.code === '23505'` and map to `409 TAG_DUPLICATE` — same as app-level detection. DB unique constraint is safety backstop.                                                               |
| 3   | **Default tag list status visibility**             | Returns ALL tags (ENABLED + DISABLED) by default. `status` is an optional query filter, not a default gate. Confirmed by User Story 2.                                                            |
| 4   | **entity_type validation layer**                   | App layer is PRIMARY (FR-007 mandates structured error code). DB CHECK constraint is backstop. VARCHAR(40)+CHECK chosen over pg ENUM for forward-extensibility.                                   |
| 5   | **Pagination defaults and maximum**                | `per_page` default = 20, max = 100. Confirmed by `hierarchy.schemas.ts` platform pattern. Validated via Zod: `z.coerce.number().int().min(1).max(100).default(20)`.                               |

---

## Checklists Generated

| File                             | Items | Coverage                                                                                 |
| -------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `checklists/tenant-isolation.md` | 22    | DB isolation, resolver chain, license enforcement, cross-tenant prohibition              |
| `checklists/security.md`         | 32    | Input validation, error contract, access control, rate limiting, data integrity, logging |
| `checklists/performance.md`      | 22    | Index coverage, query efficiency, pagination limits, response time                       |

---

## Open Gaps Noted

- Rate limiting thresholds (checklists/security.md CHK020–CHK023): specific request/minute limits not defined — to be resolved in planning.
- Response time SLO (checklists/performance.md CHK019–CHK022): p95 latency threshold not quantified in spec — to be addressed in plan or noted as non-blocking.

---

## Risk Level Assessment

**Score computation:**

- Database migration (schema change): +3
- New table added (tags + tag_relations): +2
- Security-sensitive logic (permission checks): +3
- No worker interaction: 0
- Multi-tenant data isolation logic: +3
- No external API: 0
- Tasks estimate ~15–20: +1
- No new external package dependency: 0

**Total score: 12 → Risk Level: HIGH**

---

## Constitutional Compliance

| Check                              | Status | Notes                                                  |
| ---------------------------------- | ------ | ------------------------------------------------------ |
| No cross-tenant access introduced  | ✅     | Clarified: all ops via tenant DB resolver              |
| License middleware requirement     | ✅     | Mandatory on all workspace/tag routes                  |
| Idempotency strategy defined       | ✅     | 409 TAG_DUPLICATE on duplicate create/assign           |
| Transaction boundaries identified  | ✅     | Clarified: assignment preconditions inside transaction |
| Server-authoritative time enforced | ✅     | created_at/updated_at set server-side                  |
| Error contract followed            | ✅     | Standard { success, data, error } envelope             |

**Overall:** COMPLIANT — planning authorized

---

## Next Step

Proceed to Step 3 — Plan.
