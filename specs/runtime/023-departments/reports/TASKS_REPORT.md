# Tasks Report — Departments

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-17T00:04:00Z  
**Status:** COMPLETE

---

## Summary

29 atomic, dependency-ordered tasks generated across 6 groups. All tasks written to
`specs/runtime/023-departments/tasks.md`. Tasks follow the plan.md phase structure.
Service agent deviation note: plan describes "8 functions" but authoritative plan source
defines 10 — task T008 covers all 10 functions correctly.

---

## Inputs Reviewed

- `specs/runtime/023-departments/spec.md`
- `specs/runtime/023-departments/plan.md`
- `specs/runtime/023-departments/data-model.md`
- `specs/runtime/023-departments/research.md`
- `specs/runtime/023-departments/tasks.md`

---

## Task Breakdown

| Group                  | Count  | Tasks     | Notes                                                        |
| ---------------------- | ------ | --------- | ------------------------------------------------------------ |
| 1 — Data Layer         | 5      | T001–T005 | Sequential; migration must complete before schemas           |
| 2 — Domain Package     | 6      | T006–T011 | Sequential within group                                      |
| 3 — Validation         | 2      | T012–T013 | Sequential within group                                      |
| 4 — API Routes         | 10     | T014–T023 | T014 (helpers) sequential; T015–T022 [P] parallel; T023 last |
| 5 — Route Registration | 1      | T024      | Requires all routes complete                                 |
| 6 — Tests              | 5      | T025–T029 | All [P] — full parallelization available                     |
| **Total**              | **29** |           |                                                              |

---

## Transactional Tasks

- **T008** — `createDepartment`: single transaction wrapping parent check, division check, consistency check, uniqueness check, INSERT, log
- **T008** — `updateDepartment`: single transaction wrapping fetch, division check, cycle detection CTE, consistency check, uniqueness check, UPDATE, log
- **T008** — `deleteDepartment`: single transaction wrapping fetch + 3 guard checks + DELETE
- **T008** — `assignStaffDepartment`: single transaction wrapping existence + status + division check + INSERT
- **T008** — `removeStaffDepartment`: single transaction wrapping assignment check + DELETE
- **T001** — Migration file itself is wrapped in `BEGIN … COMMIT` per migration discipline

---

## Idempotency Tasks

- **T022** — `POST /staff/:staff_id/departments` handler calls `assignStaffDepartment` with `ON CONFLICT DO NOTHING` — safe to retry
- **T019** — `DELETE /departments/:id` — returns 404 if already deleted; safe to retry
- **T022** — `DELETE /staff/:staff_id/departments/:department_id` — returns 404 if assignment absent; safe to retry
- **T018** — `PUT /departments/:id` — deterministic on identical input; idempotent

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                        |
| -------------------------------------------- | ------ | ------------------------------------------------------------ |
| All write paths include transaction tasks    | ✅     | All 5 mutating service functions wrapped in transactions     |
| Idempotency tasks are defined where required | ✅     | 4 endpoints with idempotency properties explicitly tasked    |
| Layer boundary rules are respected           | ✅     | Data(T001–T005) → Domain(T006–T011) → API(T012–T024) → Tests |
| No unrelated file modifications planned      | ✅     | 6 updates all within scope; no unrelated files touched       |
| Migration tasks included when required       | ✅     | T001 covers migration; schema_version 1.5.0 → 1.6.0          |

**Overall:** COMPLIANT

---

## Open Risks

1. **T002 Drizzle self-reference complexity** — `parent_id` requires `(): AnyPgColumn =>` deferred lambda; implementer must follow data-model.md precisely to avoid Drizzle circular reference compile error
2. **T023 Router barrel ordering** — `GET /departments/tree` MUST be registered before `GET /departments/:id`; incorrect order will cause tree endpoint to never be reached
3. **T025–T029 Test isolation** — All test files require clean tenant DB seeding; concurrent test (T029) requires two concurrent DB connections

---

## Next Step

Proceed to Step 5 — Analyze.
