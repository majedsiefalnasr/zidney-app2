# STAGE 43 – License Limit Enforcement

Phase: 3 – Backoffice Core  
Subdomain: 05_USER_MANAGEMENT  
Scope: Transactional enforcement of student and staff limits per license

---

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: HIGH
Last Updated: 2026-04-04T03:30:00.000Z

Implementation: COMPLETE
Tasks: 24 / 24 completed

Scope Closed:

- ✅ BackofficeVariables limit types fixed (`number | null`)
- ✅ License enforcement middleware updated to pass `number | null`
- ✅ StaffError + StudentError extended with `limit_value`/`current_value`
- ✅ `createStaff()`, `enableStaff()`, `createStudent()`, `enableStudent()` enforce null/count checks
- ✅ `processStaffBulkImport()` limit enforcement per batch
- ✅ Route-level `staffErrorResponse()` returns 403 with `LICENSE_LIMIT_REACHED` + metadata
- ✅ Unit tests: null-limit allowed, count-at-limit blocked, correct error metadata
- ✅ Route tests: 200 success, 403 limit exceeded, 422 validation, 503 license inactive
- ✅ TypeScript: zero errors (`typecheck` passes)

Deferred Scope:

- Aggregated counter table (v2 scaling)
- Frontend error display components
- Alerting on repeated limit hits

Architecture Governance Compliance:

- ADR alignment verified
- Implementation compliant with Architecture Governance (AGENTS.md + ADRs)

Notes:
Backend implementation complete. No structural backend modifications allowed.

---

## Objective

Implement strict, transactional enforcement of:

- student_limit
- staff_limit

as defined in the master license record.

This stage guarantees that workspace growth respects contractual constraints.

Limit enforcement must be:

- Server-side only
- Transactional
- Race-condition safe
- Consistent across all entry points
- Fully auditable

No soft overflow allowed.

---

## Source of Truth

Limits are defined in:

master_db.licenses

Fields:

- student_limit (integer | NULL)
- staff_limit (integer | NULL)

NULL = unlimited.

Limits apply per workspace.

Limits are evaluated against ACTIVE users only.

---

## Enforcement Scope

Limits must be enforced at:

- Student creation
- Staff creation
- Bulk import (students)
- Bulk import (staff)
- Account reactivation (DISABLED → ACTIVE)

Limit enforcement must not rely on:

- Cached counters
- In-memory counters
- Client-side checks

All enforcement must happen in backend inside a transaction.

---

## Transactional Enforcement Model

On creation flow:

1. Begin transaction
2. Count ACTIVE users of relevant type
3. Compare count with limit
4. If count >= limit → abort
5. Else insert record
6. Commit transaction

Example rule:

If student_limit = 200  
And ACTIVE students = 200  
→ Reject new student creation

The count query must:

- Use indexed status column
- Lock appropriately if necessary
- Be consistent under concurrent inserts

---

## Concurrency Safety

To prevent race conditions:

- Use SELECT COUNT(\*) FOR UPDATE (if supported strategy) OR
- Use application-level advisory locking per workspace OR
- Use serializable isolation level (if required)

The chosen strategy must guarantee:

No two concurrent inserts bypass the limit.

Failure to enforce atomicity is considered a platform integrity failure.

---

## Bulk Import Enforcement

Bulk import must:

- Process in batches
- Check limit before each batch
- Stop immediately when limit reached
- Return structured partial failure report

Import must never:

- Insert beyond limit
- Silently truncate without reporting

If remaining capacity is 10 And batch size is 50 → Insert only 10 → Reject 40 with explicit report

---

## Reactivation Handling

If user status changes from:

DISABLED → ACTIVE

System must:

1. Re-check limit
2. Reject reactivation if limit exceeded

Reactivation counts toward limit.

---

## Edge Cases

Unlimited limit (NULL):

- Skip limit check
- Allow creation

License in SOFT_LOCKED:

- Creation blocked regardless of limit

License in ARCHIVED:

- All operations blocked

License validation must run before limit enforcement.

---

## Performance Requirements

Counting must:

- Use indexed status column
- Avoid full table scans
- Be sub-50ms under 50k users

If scaling increases:

- Introduce aggregated counter table
- Maintain counter via transactional increment
- Validate periodically against actual count

v1 may use direct COUNT(\*) with proper indexing.

---

## Error Contract

When limit exceeded:

Return structured error:

code: LICENSE_LIMIT_REACHED  
type: STUDENT_LIMIT | STAFF_LIMIT  
limit_value  
current_value

No generic 500 errors allowed.

Frontend must receive explicit failure reason.

---

## Observability Requirements

Every limit rejection must log:

- workspace_slug
- user_type
- limit_value
- current_value
- request_id

Repeated limit hits should trigger alerting in future scaling phase.

---

## Validation Checklist

Stage complete when:

- Student creation blocked at limit
- Staff creation blocked at limit
- Reactivation blocked at limit
- Bulk import respects limit
- Concurrent insert race tested
- Unlimited limit validated
- Structured error returned
- Logs generated correctly

---

## Hard Rules

No UI-only enforcement  
No cached counter shortcuts  
No silent overflow  
No eventual consistency window  
No cross-tenant limit aggregation

Limit Enforcement is a contractual guarantee.

Violating limits breaks institutional trust.
