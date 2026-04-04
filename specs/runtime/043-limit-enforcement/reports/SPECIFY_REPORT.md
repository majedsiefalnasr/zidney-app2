# SPECIFY_REPORT — STAGE 43 – License Limit Enforcement

**Stage:** STAGE_43_LIMIT_ENFORCEMENT
**Phase:** 3 – Backoffice Core
**Branch:** `spec/043-limit-enforcement`
**Stage File:** `specs/phases/03_BACKOFFICE_CORE/05_USER_MANAGEMENT/STAGE_43_LIMIT_ENFORCEMENT.md`

---

## Objective

Implement robust, transactional enforcement of `student_limit` and `staff_limit` license
constraints across all user creation and activation entry points (create, re-activate, bulk import).

Null semantics: `NULL` means unlimited. All paths must accept and propagate `number | null`.

Isolation: all count-then-insert or count-then-update checks must run under
`BEGIN ISOLATION LEVEL SERIALIZABLE` to avoid phantom/ race conditions.

---

## Key Scope Items (Specify)

- Enforce limits for: createStudent, createStaff, enableStudent, enableStaff, bulk imports.
- Normalize types: `student_limit` / `staff_limit` → `number | null` end-to-end.
- Add staff bulk-import domain + route (mirrors students pattern).
- Extend `StudentError` / `StaffError` to carry `limit_value` and `current_value`.
- Map domain limit errors to public `LICENSE_LIMIT_REACHED` payloads in helpers.

---

## Gaps Identified (summary)

- G1/G2: Missing enable (reactivation) checks for students and staff — CRITICAL.
- G3–G4: Route handlers were not reading typed `student_limit` / `staff_limit` from context.
- G5–G9: Domain & bulk-import signatures used non-nullable numbers — must accept `number | null`.
- G10: Error/HTTP mapping needs unified `LICENSE_LIMIT_REACHED` shape.
- G11: Staff bulk import feature required (new domain + route).
- G12–G13: Middleware and BackofficeVariables must provide and type nullable numeric limits.

---

## Decision Highlights

- Treat `null` limit as unlimited; only enforce when limit !== null.
- Preserve existing HTTP mapping: student limit errors map to 422, staff to 403 (domain HTTP map).
- Do not retry on serialization failure — return `LICENSE_LIMIT_REACHED` to caller.

---

## Artifacts to Generate

- This `SPECIFY_REPORT.md` (created)
- `CLARIFY_REPORT.md` (already present)
- `PLAN_REPORT.md`, `TASKS_REPORT.md`, `IMPLEMENT_REPORT.md`, `ANALYZE_REPORT.md`

---

## Next Steps

1. Ensure middleware sets `student_limit` / `staff_limit` as `number | null`.
2. Update route handlers to read `c.get('student_limit')` / `c.get('staff_limit')` and pass into domain functions.
3. Normalize domain signatures and implement staff bulk-import.
4. Run full validation: lint, typecheck, unit tests.

---

**Prepared from:** `specs/runtime/043-limit-enforcement/spec.md`
