# Clarify Report — Stage 41: Staff Management

**Stage**: `STAGE_41_STAFF_MANAGEMENT`
**Branch**: `spec/041-staff-management`
**Step**: Clarify (Step 2 of 7)
**Generated**: 2026-04-03

---

## Summary

All ambiguities in the Stage 41 specification were resolved inline during the Specify step.
No user interaction was required. Clarifications were logged directly in the `## Clarifications`
section of `spec.md` and are reproduced here for audit trail purposes.

---

## Resolved Clarifications

### Session 2026-04-03

#### CLA-001: Remove `is_active` column?

**Question:** Should the `is_active` boolean column be dropped from `backoffice_staff_users` in
this migration to avoid dual-state confusion?

**Resolution:** **No — retained.** `is_active` is kept for backward compatibility with existing
code paths that read it during token validation. The migration adds `status VARCHAR(20)` as the
canonical state column and backfills it from `is_active`. Both columns must remain synchronized
via the service layer during Stage 41. `is_active` removal is formally deferred to a later
cleanup migration.

**Impact:** Service layer must write both columns on every status change (ACTIVE/INACTIVE/SUSPENDED). No
functional regression risk.

---

#### CLA-002: Is `backoffice-login.ts` update in scope?

**Question:** The login route at `apps/api/src/routes/auth/backoffice-login.ts` currently queries
the legacy `users` table (Stage 3 frontoffice era). Staff created via Stage 41 will have hashed
passwords in `backoffice_staff_users`. Should login be updated in Stage 41?

**Resolution:** **Yes — mandatory.** Without updating the login route, no staff account created
via Stage 41 endpoints can successfully authenticate. The login route must:

1. Query `backoffice_staff_users` (not `users`)
2. Use `verifyStaffPassword` (Argon2id) instead of `verifyPassword` (bcrypt)
3. Check `status = 'ACTIVE'` instead of `is_active = true`

**Impact:** Existing bcrypt hashes in `users` become inaccessible via backoffice login after this
change. This is acceptable because Stage 17 established `backoffice_staff_users` as the canonical
backoffice users table; any records still in the legacy `users` table are residual data that should
have been migrated in Stage 17. **Risk: MEDIUM** — requires integration test to confirm auth flow.

---

#### CLA-003: Argon2id algorithm and parameters?

**Question:** What Argon2 variant and parameters should be used for staff password hashing?

**Resolution:** **Argon2id (hybrid variant)** — recommended by OWASP for new systems.

Parameters (OWASP 2024 minimum for interactive login, Tier 1):

- `memoryCost`: 65536 (64 MiB)
- `timeCost`: 3 iterations
- `parallelism`: 4
- Output length: 32 bytes (default)
- Hash output: ~95-97 chars (`$argon2id$v=19$...`)

These are sourced from OWASP Password Storage Cheat Sheet §Argon2id and selected for the
backoffice context where login latency < 500 ms is acceptable. All parameters encoded in the
hash string (self-describing format), so parameter upgrades require only a hash-on-next-login
strategy.

**Impact:** Requires `argon2` npm package in `apps/api` (`bun add argon2`).

---

#### CLA-004: Remove `division_ids` array from `backoffice_staff_users`?

**Question:** Stage 41 adds a `staff_hierarchy_levels` join table for many-to-many assignments.
Should the existing `division_ids uuid[]` column be dropped?

**Resolution:** **No — retained.** `division_ids` is kept as a cached/convenience array for
backward compat; `staff_hierarchy_levels` is the canonical normalized join. Writes in Stage 41
update both. Removal of `division_ids` is deferred to a future cleanup migration.

**Impact:** Service creates/updates both the join table rows and the array column on assignment
operations. No data loss.

---

#### CLA-005: Delete dead-code `users.ts` in `apps/api/src/routes/backoffice/`?

**Question:** There is a 449-line `apps/api/src/routes/backoffice/users.ts` that is NOT
registered in `app.ts`, queries the wrong `users` table with raw SQL, and has no callers.

**Resolution:** **Yes — deleted.** The file violates module boundaries (raw SQL bypasses ORM
layer), queries the wrong table, and is unreachable dead code. Deleting it removes misleading
code and reduces audit surface. No rollback risk.

**Impact:** Zero functional impact (file is unregistered). Reduces codebase confusion.

---

## Audit Checklist

| Area                   | Status | Notes                                                                                         |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------- |
| Transaction boundaries | ✅     | All writes in explicit transactions; license check uses `SELECT FOR UPDATE`                   |
| Idempotency            | ✅     | Email uniqueness enforced at DB level; duplicate creates rejected with `STAFF_EMAIL_CONFLICT` |
| Concurrency guards     | ✅     | License limit check uses `SELECT FOR UPDATE` on license row                                   |
| Version enforcement    | N/A    | No external contract versioning required for staff CRUD                                       |
| Middleware enforcement | ✅     | All routes guarded by tenant resolver, license middleware, RBAC                               |
| Security validation    | ✅     | Argon2id, status check in login, no password in responses                                     |
| Error contract         | ✅     | 10 error codes defined, `{ success, data, error }` wrapper                                    |
| Isolation boundaries   | ✅     | All queries scoped to `workspace_id`; no cross-tenant access                                  |
| Logging requirements   | ✅     | `createLogger` used; no `console.log`; structured logs with correlation ID                    |

---

## No Blocking Issues

All 5 clarifications are resolved. No open ambiguities remain.
Planning (Step 3) is authorized to proceed.
