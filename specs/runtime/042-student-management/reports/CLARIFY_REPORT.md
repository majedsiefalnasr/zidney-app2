# Clarify Report: Student Management

**Stage**: STAGE_42_STUDENT_MANAGEMENT
**Step**: 2 — Clarify
**Completed**: 2026-04-03
**Branch**: `spec/042-student-management`

---

## Clarification Summary

The specification was reviewed for ambiguities during Step 1 (Specify). All 5 ambiguous areas
were identified and resolved during deep-dive codebase analysis. No interactive clarification
session was required — all decisions are deterministic and backed by existing patterns.

---

## Decisions Recorded

### Decision 1 — Frontoffice Login Migration Strategy

**Question**: Should `frontoffice-login.ts` be fully migrated to the `students` table or
maintain backward-compatibility with the `users` table?

**Decision**: Full migration to `students` table. The `users` table is a legacy artifact
from bootstrap migration 004. Stage 42 makes `students` the authoritative table for student
identity. All SELECT and UPDATE SQL in `frontoffice-login.ts` (including failed_login_count
increments and locked_until updates) must target `students`.

**Rationale**: Backward compatibility would create a split-brain auth system. The students
table will have the complete identity columns after migration 022, making the users table
redundant for this path.

**Risk**: MEDIUM — tested by frontoffice auth integration tests.

---

### Decision 2 — Bulk Import Transaction Strategy

**Question**: Should bulk import use one large transaction or per-row transactions?

**Decision**: Per-batch transactions in chunks of 50. Each batch is SERIALIZABLE. A single
invalid row causes only that row to be skipped; the rest of the batch commits. The
`BulkImportResult.errors` array captures per-row failures.

**Rationale**: A single transaction wrapping all 500 rows would cause complete rollback on
any row failure. Per-batch chunking matches standard bulk import patterns and ensures progress
even with partial failures.

**Risk**: LOW — limit enforcement must account for cumulative inserts across batches.

---

### Decision 3 — Table Name Retention

**Question**: Should the `students` table be renamed to avoid confusion with the legacy
`users` table?

**Decision**: Keep `students` as the canonical table name. Migrations 22-27 (academic
hierarchy) already established foreign keys referencing `students`. Renaming would require
cascading migration changes across all subdomain stages.

**Rationale**: Renaming at this stage introduces unnecessary migration risk. The `users` table
will naturally become unused after Stage 42 (for student auth).

**Risk**: LOW.

---

### Decision 4 — Password Migration for Existing Student Rows

**Question**: What password value should be assigned to existing students (pre-Stage 42)?

**Decision**: `password_hash` defaults to empty string `''`. Existing rows cannot log in until
a backoffice operator explicitly sets their password through the update-student endpoint.

**Rationale**: There is no legacy password data to migrate (the `users` table auth data for
students is not linked to the `students` table). An empty hash is cleaner than generating
random passwords silently.

**Risk**: LOW — documented behavior; admin must trigger password-set workflow.

---

### Decision 5 — Division Active Validation Placement

**Question**: Should `division_id` active-status validation happen in the DB or service layer?

**Decision**: Service layer. The PostgreSQL FK enforces referential integrity (division must
exist), but the business rule (division must be ACTIVE) is a domain concern enforced before
INSERT.

**Rationale**: Matches the Staff Management (Stage 41) pattern exactly. Database constraints
enforce existence; service enforces business rules.

**Risk**: LOW — consistent with existing patterns.

---

## Ambiguity Audit Results

| Area                               | Status      | Notes                                       |
| ---------------------------------- | ----------- | ------------------------------------------- |
| students table migration           | ✅ Resolved | Migration 022; 7 columns added              |
| frontoffice-login target table     | ✅ Resolved | Uses `students` table exclusively           |
| Bulk import transaction boundaries | ✅ Resolved | Per-batch (50 rows), SERIALIZABLE           |
| student_limit enforcement          | ✅ Resolved | SERIALIZABLE, SELECT FOR UPDATE count       |
| Division active validation         | ✅ Resolved | Service layer (not DB trigger)              |
| Error codes and HTTP status codes  | ✅ Resolved | 9 error codes documented                    |
| password_hash API exposure         | ✅ Resolved | Never returned; excluded from StudentRecord |
| token_version on disable           | ✅ Resolved | Incremented; invalidates existing JWTs      |
| subscription_status in JWT         | ✅ Resolved | Included in token data                      |

No `[NEEDS CLARIFICATION]` markers remain in spec.md.

---

## Compliance Check

| Concern                          | Status                                              |
| -------------------------------- | --------------------------------------------------- |
| Multi-tenant isolation preserved | ✅ All queries scoped by workspace_id               |
| SERIALIZABLE used where required | ✅ Create, bulk-import, disable, delete             |
| Auth migration tested            | ✅ Integration test specified for frontoffice-login |
| Limit race condition handled     | ✅ FOR UPDATE + SERIALIZABLE on count query         |
| Existing data intact             | ✅ DEFAULT values non-destructive to existing rows  |

---

## Outcome

All spec ambiguities resolved. Requirements checklist fully populated. Feature is ready for
technical planning (Step 3).
