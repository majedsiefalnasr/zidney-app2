/**
 * Drizzle ORM Schema — Teams (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/teams.schema.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Drizzle pgTable definition for the `teams` table.
 * Table created by migration 20260319_004_teams.ts.
 *
 * Partial functional unique index:
 *   UNIQUE (LOWER(name)) WHERE deleted_at IS NULL
 *   is owned by migration 20260319_004_teams.ts (`teams_name_lower_unique_active`).
 *   Drizzle cannot express a partial functional index; no uniqueIndex() declaration here.
 *
 * FK teams.team_type_id → team_types(id) ON DELETE SET NULL:
 *   Hard-deleting a team_types row (manual maintenance only) sets team_type_id to null.
 *   In normal operation team_types use soft-delete; this FK fires only for manual cleanup.
 *
 * max_members CHECK:
 *   Must be a positive integer when set. Enforced at DB layer (migration).
 *   NULL = uncapped.
 *
 * Soft-delete pattern:
 *   deleted_at IS NOT NULL = soft-deleted. Hard delete is forbidden.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 * ✓ Academic isolation: teams must not appear in exam/content/student-visibility queries
 */

import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { teamTypes } from './team-types.schema'

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Team display name.
     * Unique among active (non-soft-deleted) teams — enforced by partial functional
     * index `teams_name_lower_unique_active` (migration-owned, case-insensitive).
     */
    name: varchar('name', { length: 255 }).notNull(),

    /**
     * Optional classification via Team Type.
     * NULL = unclassified team — valid and fully operational.
     * FK → team_types(id) ON DELETE SET NULL.
     */
    team_type_id: uuid('team_type_id').references(() => teamTypes.id, {
      onDelete: 'set null',
    }),

    /**
     * Maximum number of staff members assignable to this team.
     * NULL = uncapped.
     * Positive integer only — CHECK (max_members IS NULL OR max_members > 0) in migration.
     */
    max_members: integer('max_members'),

    /** Optional description. Nullable — no default. */
    description: text('description'),

    /**
     * Team lifecycle status.
     * 'ENABLED'  → team is operational and accepting new staff assignments.
     * 'DISABLED' → team is inactive; new assignments rejected (TEAM_DISABLED error).
     * CHECK constraint enforced at DB layer in migration.
     */
    status: varchar('status', { length: 20 }).notNull().default('ENABLED'),

    /**
     * Soft-delete timestamp.
     * NULL = active team.
     * Set to NOW() at deletion — team is hidden from list/lookup queries.
     * Hard delete is not allowed; rows are retained for audit trail.
     */
    deleted_at: timestamp('deleted_at', { withTimezone: true }),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Team type filter — list teams scoped to a type.
     * Also serves the TEAM_TYPE_HAS_TEAMS deletion guard scan.
     */
    teamTypeIdIdx: index('idx_teams_team_type_id').on(table.team_type_id),

    /** Status filter — list ENABLED/DISABLED teams. */
    statusIdx: index('idx_teams_status').on(table.status),

    /**
     * Soft-delete filter.
     * All list/lookup queries include WHERE deleted_at IS NULL.
     */
    deletedAtIdx: index('idx_teams_deleted_at').on(table.deleted_at),

    /**
     * Keyset pagination composite index (created_at, id).
     * Owned by migration: CREATE INDEX idx_teams_created_at_id ON teams (created_at ASC, id ASC)
     * Not declared via Drizzle index() to avoid conflicts.
     */
  })
)

export type TeamRow = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
