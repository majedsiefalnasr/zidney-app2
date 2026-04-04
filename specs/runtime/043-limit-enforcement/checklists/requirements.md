# Stage 43 – Spec Quality Checklist

**Stage:** STAGE_43_LIMIT_ENFORCEMENT  
**Generated:** Step 1 — Specify

---

## Functional Requirements Checklist

- [x] FR-01: Student creation blocked at limit (`createStudent()` with SERIALIZABLE — confirmed working)
- [x] FR-02: Staff creation blocked at limit (`createStaff()` with SERIALIZABLE — type fix required)
- [x] FR-03: Student bulk import respects limit — null = unlimited (null-safety fix required)
- [x] FR-04: Staff bulk import respects limit — new feature scoped and designed
- [x] FR-05: Student reactivation (`enableStudent`) checks limit before ACTIVE transition
- [x] FR-06: Staff reactivation (`enableStaff`) checks limit before ACTIVE transition
- [x] FR-07: `null` limit = unlimited across ALL paths — no `?? 50` or string `'unlimited'`
- [x] FR-08: Structured error `LICENSE_LIMIT_REACHED` with `{type, limit_value, current_value}`
- [x] FR-09: Type consistency `number | null` — middleware → BackofficeVariables → domain

---

## Non-Functional Requirements Checklist

- [x] NFR-01: SERIALIZABLE isolation level used for all limit-check + insert/update paths
- [x] NFR-02: COUNT query uses indexed `status` column (sub-50ms under 50k users)
- [x] NFR-03: Observability — every rejection logged with 5 required fields

---

## Security & Correctness Checklist

- [x] No client-side enforcement
- [x] No cached counters
- [x] No silent overflow
- [x] No eventual-consistency window
- [x] License middleware runs before limit enforcement
- [x] All limit checks inside a database transaction
- [x] Unlimited (null) properly propagated — no default numeric fallback
- [x] Concurrent race condition handled by SERIALIZABLE (not retried — return 422/403)

---

## Architecture Compliance Checklist

- [x] Domain functions in `packages/domain-core/` — no HTTP imports
- [x] Route handlers in `apps/api/` — no embedded business logic
- [x] No cross-tenant queries
- [x] Tenant DB pool used for count + insert (not master DB)
- [x] `BackofficeVariables` updated to `number | null` (Hono type consistency)
- [x] Error contract follows `{ success, data, error: { code, message } }` standard
- [x] New staff bulk import feature follows same pattern as student bulk import

---

## Testing Checklist (pre-implementation)

- [ ] Unit: `enableStudent()` rejects at limit under SERIALIZABLE
- [ ] Unit: `enableStaff()` rejects at limit under SERIALIZABLE
- [ ] Unit: `processBulkImport()` handles null limit (unlimited)
- [ ] Unit: `processStaffBulkImport()` handles null limit (unlimited)
- [ ] Unit: `StudentError` carries `limit_value` and `current_value`
- [ ] Unit: `StaffError` carries `limit_value` and `current_value`
- [ ] Unit: `studentErrorResponse()` maps to `LICENSE_LIMIT_REACHED` shape
- [ ] Unit: `staffErrorResponse()` maps to `LICENSE_LIMIT_REACHED` shape
- [ ] Integration: concurrent `enableStudent()` race — only one succeeds at limit
- [ ] Integration: concurrent `enableStaff()` race — only one succeeds at limit
- [ ] Integration: bulk import stops at limit without silent overflow
- [ ] Integration: null limit → unlimited (all paths pass without count check)
- [ ] Integration: middleware sets `student_limit` / `staff_limit` as `number | null`
