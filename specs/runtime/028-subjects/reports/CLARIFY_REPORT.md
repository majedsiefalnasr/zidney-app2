# Clarify Report — Subjects

**Step:** 2 — Clarify
**Timestamp:** 2026-03-20T00:20:00.000Z
**Status:** COMPLETE

---

## Summary

5 targeted clarification questions were identified and answered for STAGE 28 — Subjects. All ambiguities related to concurrency, RBAC, multi-language fallback, dependency guard extensibility, and division-toggle ownership are fully resolved and encoded into `spec.md`. No open items remain. Two additional checklists (security: 46 items, performance: 34 items) were generated for use during Analyze and Implement steps.

**Risk Level Assessment:** MEDIUM

- Database migration (new `subjects` table) → +3
- Security-sensitive logic (RBAC, tenant isolation) → +3
- New table with FKs → +2
- **Total: 8 → HIGH** (due to migration + multi-table FK dependencies + security scope)

---

## Inputs Reviewed

- `specs/runtime/028-subjects/spec.md` (including `## Clarifications` / `### Session 2026-03-20`)
- `specs/runtime/028-subjects/checklists/requirements.md`
- `specs/runtime/028-subjects/checklists/security.md` (generated)
- `specs/runtime/028-subjects/checklists/performance.md` (generated)

---

## Clarifications Resolved

| #   | Question                                                            | Resolution                                                                                                                                          | Impact                                                                                      |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Workflow transition concurrency — optimistic vs pessimistic locking | CAS pattern (`WHERE status = <expected_current>`); zero rows = 409 SUBJECT_TRANSITION_CONFLICT; no `version` column needed                          | No schema change; simplifies concurrency model                                              |
| 2   | RBAC — `subjects:manage` vs separate transition permission          | Single unified `subjects:manage` scope covers CRUD + workflow transitions; consistent with prior academic stages                                    | Simpler permission model; no dual-scope guards                                              |
| 3   | Multi-language fallback chain when translation missing              | requested_language → default_language → name field; translation gaps logged as warnings; API never blocked                                          | Translation gaps non-fatal; surfaced via structured logs                                    |
| 4   | Dependency guard scope when downstream tables don't exist yet       | Configurable dependency check registry — only checks currently-existing tables; downstream stages add their checks additively; no hardcoded queries | Extensible architecture; no circular stage dependency                                       |
| 5   | Division toggle ownership and transactional responsibility          | Toggle is workspace-settings concern (separate stage); Subject routes query workspace config reactively at request time; no event-driven coupling   | Clean separation of concerns; Subject service is stateless with respect to workspace config |

---

## Open Items

None — all 5 ambiguities fully resolved.

---

## Spec Updates Applied

- **Failure Modes & Recovery:** CAS pattern explicitly named; configurable dependency registry documented
- **Functional Requirements FR-08:** Extensible dependency check registry requirement added
- **Functional Requirements FR-15:** `subjects:manage` as the single permission scope documented
- **Functional Requirements FR-17:** 3-tier fallback chain (requested → default_language → name) documented
- **User Story 5, Scenario 5:** Permission reference updated to `subjects:manage`
- **User Story 7, Scenario 4:** Full fallback resolution chain documented
- **User Story 9, Scenario 4:** Reactive workspace-config query pattern; no event coupling
- **Transaction Boundaries:** Division-disabled reactive model documented
- **Assumptions #5:** Configurable dependency registry language updated
- **Section Added:** `## Clarifications / ### Session 2026-03-20` with all 5 Q→A bullets

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                                   |
| ----------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions answered; 0 open items                                                    |
| Transaction strategy confirmed            | ✅     | CAS for status transitions; all writes in transaction                                   |
| Idempotency strategy confirmed            | ✅     | Soft delete idempotent; create guarded by DB unique constraints                         |
| Isolation boundaries confirmed            | ✅     | subjects table in tenant DB only; reactive config query pattern preserves isolation     |
| Version and license constraints confirmed | ✅     | schema_version enforcement via middleware; product_version enforced at request boundary |

**Overall:** COMPLIANT

---

## Open Risks

- **Compound index gap:** Checklists identified missing compound indexes `(division_id, status)` and `(semester_id, status)` for runtime queries. Plan must include these.
- **Whitespace name validation:** Spec gap — `name` with only whitespace characters is not explicitly rejected. Plan must add `name.trim().length > 0` validation.
- **Max description length:** No cap defined. Plan should add a reasonable limit (e.g., 2000 chars) to avoid unbounded writes.
- **Rate limiting contract:** 429 error code and per-tenant rate limit strategy unspecified. Plan must resolve.

---

## Next Step

Proceed to Step 3 — Plan.
