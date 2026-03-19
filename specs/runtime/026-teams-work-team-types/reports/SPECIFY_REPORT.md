# Specify Report — Teams & Work Team Types

**Step:** 1 — Specify
**Timestamp:** 2026-03-19T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification for **Teams & Work Team Types** (STAGE_26) is complete. The spec defines three new
tenant-scoped tables (`team_types`, `teams`, `staff_teams`) with full CRUD endpoints, transactional
`max_members` enforcement, status behaviour rules, and deletion guards. Teams are confirmed as
**staff-only operational structures** with zero academic isolation impact.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_26_TEAMS.md`
- `specs/runtime/026-teams-work-team-types/spec.md`
- `specs/runtime/026-teams-work-team-types/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                           | Rationale                                                                             |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1   | `staff_teams` uses composite PK `(staff_id, team_id)`              | Prevents duplicate assignments natively; no extra unique constraint required          |
| 2   | `SELECT FOR UPDATE` on `teams` row before assignment               | Prevents TOCTOU race condition when multiple concurrent assignment requests arrive    |
| 3   | `team_type_id` is nullable FK → team_types                         | Allows teams without a type for flexibility; type reference checked only when present |
| 4   | Soft delete preferred for teams and team types                     | Guards against data loss; hard delete only after explicit member/reference checks     |
| 5   | Teams must not be used in content filtering or division visibility | Academic isolation guarantee — non-negotiable per AGENTS.md                           |
| 6   | No cascade DISABLE on team_type → teams                            | Disabling a type does not auto-disable teams; prevents accidental operational impact  |

---

## Functional Requirements Captured

30 functional requirements (FR-001 – FR-030) covering:

- **Team Types** — create, read, list, update name/description/status, delete (guarded)
- **Teams** — create with optional type ref, read, list by status, update, delete (guarded)
- **Staff Assignment** — assign staff to team, remove assignment, list team members
- **max_members enforcement** — transactional cap check with SELECT FOR UPDATE
- **Status rules** — DISABLED teams block new assignments; DISABLED types block new team references
- **Deletion guards** — team deletion blocked when members assigned; type deletion blocked when teams reference it

---

## Clarifications Required

None — all specification ambiguities resolved at spec authoring stage.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                       |
| --------------------------------------- | ------ | --------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All 3 tables reside exclusively in tenant DB                                |
| License middleware requirement captured | ✅     | Tenant resolver → license middleware mandatory before any team route        |
| Snapshot integrity requirement captured | ✅     | Feature does not touch attempt snapshots                                    |
| Idempotency strategy defined            | ✅     | Assignment endpoint idempotent; re-assigning existing pair returns 200/409  |
| Transaction boundaries identified       | ✅     | All writes transactional; max_members check and deletion guards included    |
| Server-authoritative time enforced      | ✅     | `created_at`/`updated_at` set by server only                                |
| Academic isolation preserved            | ✅     | Teams explicitly excluded from exam visibility, content filtering, division |

**Overall:** COMPLIANT

---

## Open Risks

None identified at specification stage.

---

## Next Step

Proceed to Step 2 — Clarify.
