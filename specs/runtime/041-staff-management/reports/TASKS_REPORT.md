# Tasks Report — Stage 41: Staff Management

**Generated**: 2026-04-03T04:00:00Z  
**Source**: `specs/runtime/041-staff-management/tasks.md`

---

## Summary

| Field          | Value                                               |
| -------------- | --------------------------------------------------- |
| Total Tasks    | 34                                                  |
| New Files      | 21                                                  |
| Modified Files | 7                                                   |
| Deleted Files  | 1                                                   |
| Parallel Tasks | 3 (T028, T029, T030 — test files)                   |
| Blocking Task  | T001 (argon2 install — Group A must complete first) |

---

## Full Task List

| ID   | Group | Description                                               | Risk      |
| ---- | ----- | --------------------------------------------------------- | --------- |
| T001 | A     | Install argon2 package in apps/api                        | 🟡 MEDIUM |
| T002 | B     | Write migration 20260404_020_staff_management.ts          | 🔴 HIGH   |
| T003 | B     | Update backoffice-staff-users.schema.ts (add columns)     | 🔴 HIGH   |
| T004 | B     | Create staff-hierarchy-levels.schema.ts                   | 🟢 LOW    |
| T005 | B     | Update db/tenant/schemas/index.ts exports                 | 🟢 LOW    |
| T006 | C     | Create auth/staff-password.ts (Argon2id)                  | 🔴 HIGH   |
| T007 | C     | Update auth/index.ts (add staff-password exports)         | 🟡 MEDIUM |
| T008 | C     | Create staff/staff.types.ts                               | 🟢 LOW    |
| T009 | C     | Create staff/staff.errors.ts                              | 🟢 LOW    |
| T010 | C     | Create staff/staff.repository.ts (raw SQL)                | 🔴 HIGH   |
| T011 | C     | Create staff/staff.service.ts (business logic)            | 🔴 HIGH   |
| T012 | C     | Create staff/index.ts (barrel)                            | 🟢 LOW    |
| T013 | C     | Update domain-core/src/index.ts (add staff namespace)     | 🟡 MEDIUM |
| T014 | D     | Create validation/src/staff.schema.ts (4 Zod schemas)     | 🟡 MEDIUM |
| T015 | D     | Update validation/src/index.ts (add staff exports)        | 🟢 LOW    |
| T016 | E     | Create staff/helpers.ts (getDb, buildAuditCtx, error map) | 🟡 MEDIUM |
| T017 | E     | Create create-staff.ts route handler                      | 🟡 MEDIUM |
| T018 | E     | Create list-staff.ts route handler                        | 🟡 MEDIUM |
| T019 | E     | Create get-staff.ts route handler                         | 🟡 MEDIUM |
| T020 | E     | Create update-staff.ts route handler                      | 🟡 MEDIUM |
| T021 | E     | Create disable-staff.ts route handler                     | 🟡 MEDIUM |
| T022 | E     | Create enable-staff.ts route handler                      | 🟡 MEDIUM |
| T023 | E     | Create delete-staff.ts route handler                      | 🟡 MEDIUM |
| T024 | E     | Create staff/index.ts (Hono router + RBAC guards)         | 🔴 HIGH   |
| T025 | E     | Update backoffice-login.ts (staff table + Argon2id)       | 🔴 HIGH   |
| T026 | E     | Update app.ts (register staffRouter)                      | 🟡 MEDIUM |
| T027 | E     | Delete apps/api/src/routes/backoffice/users.ts            | 🟢 LOW    |
| T028 | F [P] | Create staff.crud.test.ts                                 | 🟡 MEDIUM |
| T029 | F [P] | Create staff.isolation.test.ts                            | 🔴 HIGH   |
| T030 | F [P] | Create staff.limit.test.ts                                | 🔴 HIGH   |
| T031 | G     | Verify schema index exports (typecheck)                   | 🟢 LOW    |
| T032 | H     | Run bun run typecheck — zero errors required              | 🔴 HIGH   |
| T033 | H     | Run bun run lint / biome check — zero errors required     | 🟡 MEDIUM |
| T034 | I     | Run bun run test — all staff tests pass                   | 🔴 HIGH   |

---

## Risk-Ranked Task Summary

| Task ID | Risk    | Description                                                              |
| ------- | ------- | ------------------------------------------------------------------------ |
| T002    | 🔴 HIGH | Database migration — ALTER TABLE + schema version bump                   |
| T003    | 🔴 HIGH | Schema file change — password_hash type + new columns                    |
| T006    | 🔴 HIGH | Argon2id password module — security-critical                             |
| T010    | 🔴 HIGH | Repository layer — raw SQL, multi-tenant WHERE clause required           |
| T011    | 🔴 HIGH | Service layer — SERIALIZABLE transaction, license limit enforcement      |
| T024    | 🔴 HIGH | Router index — RBAC guards, registration order critical                  |
| T025    | 🔴 HIGH | Login route update — security-critical, brute-force protection preserved |
| T029    | 🔴 HIGH | Isolation test — must confirm cross-tenant 404 behavior                  |
| T030    | 🔴 HIGH | Limit test — must confirm SERIALIZABLE enforcement under concurrency     |
| T032    | 🔴 HIGH | TypeScript gate — blocking quality gate                                  |
| T034    | 🔴 HIGH | Test execution gate — blocking quality gate                              |

---

## External Dependency Tasks

| Task ID | Package | Version Note                                                                                                                  |
| ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| T001    | argon2  | Latest compatible with Bun; used in T006                                                                                      |
| T006    | argon2  | `argon2.hash(plain, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 })`; `argon2.verify(hash, plain)` |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots — extra review attention recommended.

| Task ID | Module               | Description                                                                 |
| ------- | -------------------- | --------------------------------------------------------------------------- |
| T013    | packages/domain-core | Adds staff namespace to main barrel — affects all consumers                 |
| T025    | apps/api login route | Login route handles ALL backoffice auth; Argon2id swap is security-critical |
| T026    | apps/api app.ts      | Registers new router into main Hono app — affects routing table             |

---

## Dependency Order

```
T001 (argon2 install)
  └── T006 (staff-password.ts) — requires argon2 package
        └── T011 (staff.service.ts) — imports hashStaffPassword
              └── T016-T027 (API handlers) — import staff service
T002 (migration) — must run before any test that exercises the DB
T008 (staff.types.ts) — no deps; can start after T006
T010 (staff.repository.ts) — imports DbClient from types
T011 (staff.service.ts) — imports repository + service
T014 (staff.schema.ts) — independent
T028–T030 [P] — require all E-group complete
```

---

## Notes

- **T025 is the most sensitive task**: backoffice-login.ts handles all authentication. Update must preserve SERIALIZABLE transaction, 5-attempt brute-force lock (5 min), timing-safe dummy hash on miss, and `FOR UPDATE OF bsu` row lock. All UPDATE queries must target `backoffice_staff_users` (not `users`).
- **T024 registration order critical**: PATCH `/:id/disable` and `/:id/enable` must register BEFORE `/:id` generic param routes; otherwise Hono interprets `disable`/`enable` as UUID param values.
- **T027 is safe to delete**: users.ts is 449 lines of dead code — NOT imported anywhere in app.ts or any other file.
- **password_hash never in response**: StaffRecord type must omit `password_hash`. Audit all SELECT projections to confirm hash is excluded from API responses.
