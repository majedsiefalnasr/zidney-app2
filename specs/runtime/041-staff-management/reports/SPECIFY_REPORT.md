# Specify Report — Stage 41: Staff Management

**Stage**: `STAGE_41_STAFF_MANAGEMENT`
**Branch**: `spec/041-staff-management`
**Phase**: `03_BACKOFFICE_CORE / 05_USER_MANAGEMENT`
**Generated**: 2026-04-03
**Step**: Specify (Step 1 of 7)

---

## Summary

The specification for Stage 41 (Staff Management) has been drafted and all inline clarifications
have been resolved. The spec covers the full backoffice staff lifecycle: secure account creation
with Argon2id hashing, license-limit-enforced transactional creation, RBAC-guarded CRUD endpoints,
status management with token invalidation, transactional deletion with assignment cleanup, and
updating the backoffice login route from a legacy `users` table to `backoffice_staff_users`.

---

## Specification Artefacts

| Artefact               | Path                                                            | Status |
| ---------------------- | --------------------------------------------------------------- | ------ |
| Feature Specification  | `specs/runtime/041-staff-management/spec.md`                    | ✅     |
| Requirements Checklist | `specs/runtime/041-staff-management/checklists/requirements.md` | ✅     |

---

## Key Scope Items

### In Scope (Stage 41)

1. **Database migration** (`20260404_020_staff_management.ts`, schema `1.25.0 → 1.26.0`):
   - ADD `status VARCHAR(20)` column to `backoffice_staff_users` (backfill from `is_active`)
   - ALTER `password_hash` from `varchar(72)` to `text` (Argon2id output length ~95+ chars)
   - CREATE `staff_hierarchy_levels` join table (many-to-many staff × hierarchy_nodes)
2. **Drizzle schema updates** — updated `backoffice-staff-users.schema.ts`, new `staff-hierarchy-levels.schema.ts`
3. **Domain-core `staff` module** at `packages/domain-core/src/staff/` — Argon2id hashing, license
   limit check, business logic, repository, types, error codes
4. **`staff-password.ts`** in `packages/domain-core/src/auth/` — Argon2id hash/verify functions
5. **Validation schemas** at `packages/validation/src/staff.schema.ts`
6. **Staff router** at `apps/api/src/routes/backoffice/staff/` — 7 endpoints (POST, GET, GET/:id,
   PATCH/:id, PATCH/:id/disable, PATCH/:id/enable, DELETE/:id)
7. **Backoffice login update** — `apps/api/src/routes/auth/backoffice-login.ts` updated to query
   `backoffice_staff_users` with Argon2id verification
8. **Dead code removal** — `apps/api/src/routes/backoffice/users.ts` deleted
9. **App registration** — `staffRouter` registered in `apps/api/src/app.ts`

### Out of Scope (Explicit)

- `PATCH /staff/:userId/role` — already in `roles.ts` (Stage 21)
- Division/department/group/team assignment routes — already in Stage 22–26
- `is_active` column removal — deferred
- `division_ids` array removal — deferred
- Bulk staff import
- Password reset / change-password

---

## Clarifications Resolved

| #   | Question                                                   | Resolution                                                                         |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Remove `is_active` column in this migration?               | No — retained for backward compat; service keeps both columns synchronized         |
| 2   | Should backoffice login update be IN scope?                | Yes — mandatory for staff to be loginable after creation                           |
| 3   | Argon2id or bcrypt for staff passwords?                    | Argon2id per stage spec; new `staff-password.ts` added to `domain-core/auth/`      |
| 4   | Remove `division_ids` array from `backoffice_staff_users`? | No — kept for backward compat; join table is authoritative for Stage 41 operations |
| 5   | Delete dead-code `users.ts`?                               | Yes — not registered in `app.ts`, uses wrong table, violates module boundaries     |

---

## Architecture Risk Assessment

| Risk                                         | Level  | Mitigation                                                                     |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Argon2 performance on high concurrency       | LOW    | `memoryCost 64MiB` is safely within API server specs; Argon2id standard params |
| `password_hash varchar(72) → text` migration | LOW    | Backward-compatible; existing rows fit in TEXT; no data loss                   |
| Backoffice login route overhaul              | MEDIUM | New login queries correct table; unit + integration tests required             |
| License limit TOCTOU on concurrent creates   | MEDIUM | `SELECT FOR UPDATE` + SERIALIZABLE isolation mitigates race                    |
| Dead code deletion (`users.ts`)              | LOW    | File not registered in `app.ts`; no external callers                           |

**Overall Risk Level: MEDIUM** (login route change requires careful testing)

---

## Next Step

**Step 2 — Clarify**: Spec includes inline clarifications. Auto-advancing to Step 2 (Clarify)
to confirm no remaining ambiguities exist before planning.
