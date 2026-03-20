/**
 * Drizzle ORM Schema — Staff Teams Join Table (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-teams.schema.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Drizzle pgTable definition for the `staff_teams` join table.
 * Table created by migration 20260319_004_teams.ts.
 *
 * Composite primary key: (staff_id, team_id).
 *
 * FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
 *   Deleting a staff user removes all their team assignments.
 *
 * FK team_id → teams(id) ON DELETE CASCADE:
 *   ARCHITECTURAL NOTE: teams use soft-delete (deleted_at). This CASCADE will not
 *   fire in normal operation because teams rows are never hard-deleted. The CASCADE
 *   exists solely as a safety net for manual DB maintenance. Service-layer logic
 *   must rely on soft-delete guards, not this FK cascade.
 *
 * Idempotency:
 *   The composite PK enables `INSERT ... ON CONFLICT (staff_id, team_id) DO NOTHING`
 *   as a DB-level safety net for the idempotent assignment endpoint.
 *
 * No separate idx_staff_teams_staff_id is needed:
 *   The composite PK (staff_id, team_id) has staff_id as the leading column, so
 *   PostgreSQL can use it for all staff_id-prefix lookups without a redundant index.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'

import { backofficeStaffUsers } from './backoffice-staff-users.schema'
import { teams } from './teams.schema'

export const staffTeams = pgTable(
  'staff_teams',
  {
    /** FK → backoffice_staff_users(id) ON DELETE CASCADE */
    staff_id: uuid('staff_id')
      .notNull()
      .references(() => backofficeStaffUsers.id, { onDelete: 'cascade' }),

    /**
     * FK → teams(id) ON DELETE CASCADE (soft-delete safety net — see file JSDoc).
     * Service layer must check team existence via soft-delete guard before this fires.
     */
    team_id: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),

    /** Server-set assignment timestamp (ADR-0006 — client time not trusted). */
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Composite PK enforces uniqueness of (staff_id, team_id) at DB level.
     * Enables idempotent ON CONFLICT DO NOTHING upsert at service layer.
     */
    pk: primaryKey({ columns: [table.staff_id, table.team_id] }),

    /**
     * Index for team member count queries and TEAM_HAS_ASSIGNMENTS deletion guard.
     * Used by: countStaffInTeam(), findTeamMembers().
     */
    teamIdIdx: index('idx_staff_teams_team_id').on(table.team_id),
  })
)

export type StaffTeamRow = typeof staffTeams.$inferSelect
export type NewStaffTeam = typeof staffTeams.$inferInsert
