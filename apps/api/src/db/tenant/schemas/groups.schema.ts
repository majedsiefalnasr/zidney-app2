/**
 * Drizzle ORM Schema — Groups (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/groups.schema.ts
 * Stage: STAGE_24_GROUPS
 * Date: 2026-03-19
 *
 * Drizzle pgTable definition for the `groups` table.
 * Table created by migration 20260319_001_groups.ts.
 *
 * Functional partial unique index:
 *   UNIQUE (LOWER(name)) WHERE deleted_at IS NULL is owned by the migration
 *   (`groups_name_lower_unique_active`). Drizzle cannot express this partial
 *   functional index via uniqueIndex(); no uniqueIndex() declaration here to
 *   avoid generating a conflicting plain UNIQUE constraint.
 *
 * Soft-delete pattern:
 *   Groups use soft-delete (deleted_at IS NOT NULL = deleted). Hard-delete is
 *   not available. All list/lookup queries must filter WHERE deleted_at IS NULL.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { departments } from './departments.schema'

// ---------------------------------------------------------------------------
// groups
// ---------------------------------------------------------------------------

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Group display name. Unique among active (non-deleted) groups (partial functional index). */
    name: varchar('name', { length: 255 }).notNull(),

    /**
     * Optional department association.
     * Null = "global" group — accessible from any division/department.
     * FK → departments(id) ON DELETE RESTRICT:
     *   prevents deleting a department that still has active groups.
     */
    department_id: uuid('department_id').references(() => departments.id, { onDelete: 'restrict' }),

    /**
     * Maximum number of students assignable to this group.
     * Null = unlimited.
     * Positive integer only — CHECK (max_members IS NULL OR max_members > 0) enforced in migration.
     * Enforcement uses SELECT FOR UPDATE on the groups row inside the student
     * assignment transaction (AD-04).
     */
    max_members: integer('max_members'),

    /** Optional description. Nullable — no default. */
    description: text('description'),

    /**
     * Group lifecycle status.
     * 'ENABLED'  → group is operational and accepting assignments.
     * 'DISABLED' → group is inactive; existing assignments preserved,
     *              new assignments rejected (GROUP_DISABLED error).
     * CHECK constraint enforced at DB layer in migration.
     */
    status: varchar('status', { length: 20 }).notNull().default('ENABLED'),

    /**
     * Soft-delete timestamp.
     * Null = active group.
     * Set to NOW() on delete — group is hidden from list/lookup queries.
     * Hard delete is not allowed; rows are retained for audit trail.
     */
    deleted_at: timestamp('deleted_at', { withTimezone: true }),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Department filter — list all groups scoped to a department.
     * Also serves the department deletion guard (FK scan on department_id).
     */
    departmentIdIdx: index('idx_groups_department_id').on(table.department_id),

    /** Status filter — list ENABLED/DISABLED groups. */
    statusIdx: index('idx_groups_status').on(table.status),

    /**
     * Soft-delete filter.
     * All list/lookup queries include WHERE deleted_at IS NULL; this partial
     * index improves performance on the most common query pattern.
     */
    deletedAtIdx: index('idx_groups_deleted_at').on(table.deleted_at),

    /**
     * Keyset pagination composite index (created_at, id).
     * Handled by migration:
     *   CREATE INDEX idx_groups_created_at_id ON groups (created_at ASC, id ASC)
     * Not declared via Drizzle index() to avoid conflicts with the migration-managed index.
     */
  })
)

export type GroupRow = typeof groups.$inferSelect
export type NewGroup = typeof groups.$inferInsert
