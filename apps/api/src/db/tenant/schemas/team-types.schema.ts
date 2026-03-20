/**
 * Drizzle ORM Schema — Team Types (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/team-types.schema.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Drizzle pgTable definition for the `team_types` table.
 * Table created by migration 20260319_004_teams.ts.
 *
 * Partial functional unique index:
 *   UNIQUE (LOWER(name)) WHERE deleted_at IS NULL
 *   is owned by migration 20260319_004_teams.ts (`team_types_name_lower_unique_active`).
 *   Drizzle cannot express a partial functional index; no uniqueIndex() declaration here.
 *
 * Soft-delete pattern:
 *   deleted_at IS NOT NULL = soft-deleted. Hard delete is forbidden.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 * ✓ Academic isolation: team types must not appear in exam/content/student-visibility queries
 */

import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const teamTypes = pgTable(
  'team_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Team type display name.
     * Unique among active (non-soft-deleted) team types — enforced by partial functional
     * index `team_types_name_lower_unique_active` (migration-owned, case-insensitive).
     */
    name: varchar('name', { length: 255 }).notNull(),

    /** Optional description. Nullable — no default. */
    description: text('description'),

    /**
     * Team type lifecycle status.
     * 'ENABLED'  → type is operational; teams may be classified under it.
     * 'DISABLED' → type is inactive; new teams cannot reference it (TEAM_TYPE_DISABLED error).
     * CHECK constraint enforced at DB layer in migration.
     */
    status: varchar('status', { length: 20 }).notNull().default('ENABLED'),

    /**
     * Soft-delete timestamp.
     * NULL = active team type.
     * Set to NOW() at deletion — type is hidden from list/lookup queries.
     * Hard delete is not allowed; rows are retained for audit trail.
     */
    deleted_at: timestamp('deleted_at', { withTimezone: true }),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Status filter — list ENABLED/DISABLED team types. */
    statusIdx: index('idx_team_types_status').on(table.status),

    /**
     * Soft-delete filter.
     * All list/lookup queries include WHERE deleted_at IS NULL.
     */
    deletedAtIdx: index('idx_team_types_deleted_at').on(table.deleted_at),

    /**
     * Keyset pagination composite index (created_at, id).
     * Owned by migration: CREATE INDEX idx_team_types_created_at_id ON team_types (created_at ASC, id ASC)
     * Not declared via Drizzle index() to avoid conflicts.
     */
  })
)

export type TeamTypeRow = typeof teamTypes.$inferSelect
export type NewTeamType = typeof teamTypes.$inferInsert
