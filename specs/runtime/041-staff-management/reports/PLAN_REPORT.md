# Plan Report — Stage 41: Staff Management

**Stage**: `STAGE_41_STAFF_MANAGEMENT`  
**Step**: Plan  
**Report Date**: 2026-04-03  
**Generated From**: `specs/runtime/041-staff-management/plan.md`

---

## Summary

Technical planning for Stage 41 is complete. The implementation blueprint covers a full-stack
staff management system with database migration, domain-core service module, Argon2id password
module, validation schemas, 7 RBAC-guarded API endpoints, an updated login route, and 3 test
files. All clarifications from Step 2 are resolved and encoded in the plan.

---

## Key Architectural Decisions Locked In Plan

| Decision                                                        | Resolution                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Login column gap (locked_until, failed_login_count, last_login) | ADD to backoffice_staff_users in migration — brute-force parity maintained        |
| Role name for JWT (role_id vs role string)                      | JOIN backoffice_roles in login query to get role name string                      |
| Argon2id dummy hash                                             | generateStaffDummyHash() returns constant pre-computed string — no async          |
| staff.repository.ts pattern                                     | Raw SQL via injected DbClient — consistent with all existing domain-core services |
| status / is_active sync                                         | Both columns written together in all UPDATE statements                            |
| division_ids strategy (CLA-004)                                 | Keep uuid[] column; no join table migration for division membership               |

---

## Implementation Groups

```text
GROUP A: Package Install — bun add argon2 in apps/api
GROUP B: Database Layer — migration 020 + schema files (4 file changes)
GROUP C: Domain-Core Layer — staff module (8 files) + staff-password.ts (2 files)
GROUP D: Validation Layer — staff.schema.ts + index update (2 file changes)
GROUP E: API Layer — 9 route files + 3 updates (login, app.ts, cleanup)
GROUP F: Test Layer — 3 test files
```

Total: **21 new files** | **7 modified files** | **1 deleted file**

---

## Schema Change Summary

**Migration**: `20260404_020_staff_management.ts` — schema `1.25.0 → 1.26.0`

| Table                    | Operation  | Detail                                                                          |
| ------------------------ | ---------- | ------------------------------------------------------------------------------- |
| `backoffice_staff_users` | ALTER      | `password_hash varchar(72) → text`                                              |
| `backoffice_staff_users` | ADD COLUMN | `status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK(ACTIVE/INACTIVE/SUSPENDED)` |
| `backoffice_staff_users` | ADD COLUMN | `failed_login_count INT NOT NULL DEFAULT 0`                                     |
| `backoffice_staff_users` | ADD COLUMN | `locked_until TIMESTAMPTZ NULL`                                                 |
| `backoffice_staff_users` | ADD COLUMN | `last_login TIMESTAMPTZ NULL`                                                   |
| `backoffice_staff_users` | UPDATE     | Backfill status from is_active                                                  |
| `staff_hierarchy_levels` | CREATE     | Join table: staff_id + hierarchy_node_id composite PK                           |
| `_schema_versions`       | UPDATE     | `1.25.0 → 1.26.0`                                                               |

---

## API Endpoint Catalogue

| Method | Path                                           | RBAC Guard       | Response                                       |
| ------ | ---------------------------------------------- | ---------------- | ---------------------------------------------- |
| POST   | /api/v1/backoffice/workspace/staff             | USERS can_create | 201 StaffRecord                                |
| GET    | /api/v1/backoffice/workspace/staff             | USERS can_view   | 200 StaffListResult                            |
| GET    | /api/v1/backoffice/workspace/staff/:id         | USERS can_view   | 200 StaffRecord                                |
| PUT    | /api/v1/backoffice/workspace/staff/:id         | USERS can_edit   | 200 StaffRecord                                |
| PATCH  | /api/v1/backoffice/workspace/staff/:id/disable | USERS can_edit   | 200 StaffRecord                                |
| PATCH  | /api/v1/backoffice/workspace/staff/:id/enable  | USERS can_edit   | 200 StaffRecord                                |
| DELETE | /api/v1/backoffice/workspace/staff/:id         | USERS can_delete | 200 { success: true, data: null, error: null } |

---

## Risk Assessment

**Risk Level**: MEDIUM

| Risk                                                   | Severity | Mitigation                                                                  |
| ------------------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| Login route migration (users → backoffice_staff_users) | HIGH     | New columns added in migration; JOIN for role name; argon2 package required |
| argon2 package installation                            | MEDIUM   | Must be first step; package not yet in apps/api                             |
| status/is_active sync in service layer                 | MEDIUM   | Both columns written atomically in all UPDATE statements                    |
| staff_limit SERIALIZABLE transaction                   | MEDIUM   | FOR UPDATE lock on count prevents TOCTOU race                               |
| Dead code deletion (users.ts)                          | LOW      | File not registered in app.ts; deletion is safe                             |

---

## Governance Compliance

- ✅ ADR-0001 Database-per-tenant: all queries use injected tenant pool
- ✅ ADR-0006 Server-authoritative time: all timestamps use NOW()
- ✅ ADR-0007/0008 Version enforcement: schema bumped 1.25.0 → 1.26.0
- ✅ Security: password_hash never in API responses
- ✅ Security: RBAC guard on all 7 routes
- ✅ Forward-only migration: no schema rollback logic in migration file
- ✅ Transaction boundaries: all writes wrapped in BEGIN/COMMIT/ROLLBACK
