/**
 * Drizzle ORM Schema — subjects
 *
 * File: apps/api/src/db/tenant/schemas/subjects.schema.ts
 * Stage: STAGE_28_SUBJECTS
 *
 * NOTE: The partial functional unique indexes
 *   - subjects_name_lower_unique_active  (LOWER(name) WHERE deleted_at IS NULL)
 *   - subjects_code_unique_non_null      (code WHERE code IS NOT NULL AND deleted_at IS NULL)
 * are owned by the migration DDL. Drizzle cannot represent partial functional indexes,
 * so they are intentionally absent here. This follows the convention established for
 * divisions, teams, and semesters.
 *
 * FK constraints (division_id → divisions.id, semester_id → semesters.id) are also
 * migration-owned to allow ON DELETE RESTRICT alongside partial indexes without
 * conflicting Drizzle-generated DDL.
 */

import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 100 }),
    division_id: uuid('division_id'),
    semester_id: uuid('semester_id'),
    is_multilanguage: boolean('is_multilanguage').notNull().default(false),
    default_language: varchar('default_language', { length: 10 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    divisionIdIdx: index('idx_subjects_division_id').on(table.division_id),
    semesterIdIdx: index('idx_subjects_semester_id').on(table.semester_id),
    statusIdx: index('idx_subjects_status').on(table.status),
    divisionStatusIdx: index('idx_subjects_division_status').on(table.division_id, table.status),
    semesterStatusIdx: index('idx_subjects_semester_status').on(table.semester_id, table.status),
    deletedAtIdx: index('idx_subjects_deleted_at').on(table.deleted_at),
    // subjects_name_lower_unique_active: migration-owned partial functional index
    // subjects_code_unique_non_null: migration-owned partial unique index
    // FK constraints (division_id, semester_id): migration-owned
  })
)

export type Subject = typeof subjects.$inferSelect
export type NewSubject = typeof subjects.$inferInsert
