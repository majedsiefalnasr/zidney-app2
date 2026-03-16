/**
 * Drizzle ORM Schema — Divisions (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/divisions.schema.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Drizzle pgTable definition for the `divisions` table.
 * Table created/upgraded by migration 20260316_001_divisions.ts.
 *
 * Status uses VARCHAR (not pgEnum) — follows codebase convention established in
 * backoffice-roles.schema.ts / backoffice-staff-users.schema.ts.
 * CHECK constraint is enforced at DB layer in the migration.
 *
 * Note on functional unique index:
 * The case-insensitive LOWER(name) unique index is owned by the migration
 * (`divisions_name_lower_unique`). Drizzle cannot express functional indexes via
 * `uniqueIndex()`, so no uniqueIndex() is declared here to avoid a conflicting
 * plain UNIQUE constraint being generated.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// divisions
// ---------------------------------------------------------------------------

export const divisions = pgTable(
  'divisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Division display name. Unique per tenant workspace (LOWER(name) functional index). */
    name: varchar('name', { length: 255 }).notNull(),
    /** Optional description. Nullable — no default. */
    description: text('description'),
    /**
     * True for exactly one row per tenant: the default division.
     * Immutable after row creation (application-level invariant).
     * Default division always has status = ENABLED.
     */
    is_default: boolean('is_default').notNull().default(false),
    /**
     * Division lifecycle status.
     * 'ENABLED'  → division is operational and assignable.
     * 'DISABLED' → division is inactive; existing assignments are preserved
     *              but new assignments are rejected.
     * CHECK constraint enforced at DB level in migration.
     */
    status: varchar('status', { length: 20 }).notNull().default('ENABLED'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Case-insensitive functional unique index — handled by migration (LOWER(name)).
     * Drizzle does not generate the functional index; the migration creates
     * `CREATE UNIQUE INDEX divisions_name_lower_unique ON divisions (LOWER(name))`.
     * No uniqueIndex() declared here to avoid Drizzle generating a conflicting constraint.
     */
    /** Filter divisions by status (list active/disabled). */
    statusIdx: index('idx_divisions_status').on(table.status),
    /** Fast lookup of the single default division row. */
    isDefaultIdx: index('idx_divisions_is_default').on(table.is_default),
    /**
     * Keyset pagination composite index (created_at, id).
     * Handled by migration: `CREATE INDEX idx_divisions_created_at_id ON divisions (created_at ASC, id ASC)`.
     * Not declared via Drizzle index() to keep the definition clean and avoid conflicts.
     */
  })
)

export type Division = typeof divisions.$inferSelect
export type NewDivision = typeof divisions.$inferInsert
