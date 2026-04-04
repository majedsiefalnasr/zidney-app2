/**
 * Drizzle ORM Schema — Students (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/students.schema.ts
 * Stage: STAGE_22_DIVISIONS / STAGE_23_DEPARTMENTS / STAGE_24_GROUPS
 * Date: 2026-03-16
 *
 * Drizzle pgTable definition for the `students` table.
 * The `students` table provides the student identity layer for tenant workspaces.
 * The `division_id` FK column was added by migration 20260316_001_divisions.ts
 * (STAGE_22); all other columns exist from the bootstrap stage.
 *
 * Note: In some tenant database bootstraps the student entity lives in a table
 * named `users` (004-create-core-application-tables.sql). In either case
 * this Drizzle schema records the shape required for division assignment and
 * the FK constraint added by STAGE_22.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import {
  check,
  index,
  integer,
  pgTable,
  sql,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { departments } from './departments.schema'
import { divisions } from './divisions.schema'
import { groups } from './groups.schema'
import { semesters } from './semesters.schema'

// ---------------------------------------------------------------------------
// students
// (Reflects the STAGE_22 shape after division_id FK is added by migration)
// ---------------------------------------------------------------------------

export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tenant-unique student identifier (may be NULL for non-bootstrapped rows). */
    external_id: varchar('external_id', { length: 255 }),
    /** Student email address — unique per workspace. */
    email: varchar('email', { length: 255 }).notNull(),
    first_name: varchar('first_name', { length: 255 }),
    last_name: varchar('last_name', { length: 255 }),
    /**
     * Division assignment — added by migration 20260316_001_divisions.ts (STAGE_22).
     * FK → divisions(id) ON DELETE RESTRICT:
     *   prevents deleting a division that still has students.
     * NOT NULL after STAGE_22 migration backfill.
     */
    division_id: uuid('division_id')
      .notNull()
      .references(() => divisions.id, { onDelete: 'restrict' }),
    /**
     * Department assignment — added by migration 20260317_001_departments.ts (STAGE_23).
     * FK → departments(id) ON DELETE SET NULL:
     *   deleting a department sets this column to null for previously assigned students.
     * NULLABLE: no backfill required; existing students start with department_id = null.
     */
    department_id: uuid('department_id').references(() => departments.id, { onDelete: 'setNull' }),
    /**
     * Group assignment — added by migration 20260319_001_groups.ts (STAGE_24).
     * FK → groups(id) ON DELETE SET NULL:
     *   deleting a groups row sets this column to null (groups use soft-delete so
     *   this fires only on manual hard-delete; it preserves student records).
     * NULLABLE: no backfill required; existing students start with group_id = null.
     * One student belongs to at most one group at a time.
     */
    group_id: uuid('group_id').references(() => groups.id, { onDelete: 'setNull' }),
    /**
     * Semester assignment — added by migration 20260320_005_semesters.ts (STAGE_27).
     * FK → semesters(id) ON DELETE RESTRICT:
     *   prevents hard-deleting a semester that still has students assigned.
     *   The application enforces soft-delete and service-layer student-count guard,
     *   so this DB constraint is a safety net only.
     * NULLABLE: no backfill required; existing students start with semester_id = null.
     */
    semester_id: uuid('semester_id').references(() => semesters.id, { onDelete: 'restrict' }),
    /** Optional contact phone number. */
    phone: varchar('phone', { length: 50 }),
    /** Argon2id password hash for frontoffice authentication. NULL until password is set. */
    password_hash: text('password_hash'),
    /**
     * Subscription binding status.
     * ACTIVE | SUSPENDED | EXPIRED | NONE (default: NONE)
     * Controlled by backoffice only. Does not block login but may restrict exam access.
     */
    subscription_status: varchar('subscription_status', { length: 20 }).notNull().default('NONE'),
    /**
     * Account status. ACTIVE | DISABLED (default: ACTIVE)
     * Disabled students cannot log in to the frontoffice.
     */
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    /**
     * Token version for JWT invalidation.
     * Incremented on disable. Frontoffice login embeds token_version in the JWT;
     * any JWT with an older version is rejected.
     */
    token_version: integer('token_version').notNull().default(0),
    /** Count of consecutive failed login attempts. Reset to 0 on successful login. */
    failed_login_count: integer('failed_login_count').notNull().default(0),
    /** Timestamp until which further login attempts are blocked (temporary lockout). */
    locked_until: timestamp('locked_until', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** List all students in a division + FK traversal path. */
    divisionIdIdx: index('idx_students_division_id').on(table.division_id),
    /** List all students in a department + FK traversal path. */
    departmentIdIdx: index('idx_students_department_id').on(table.department_id),
    /** List all students in a group + FK traversal path for assignment count. */
    groupIdIdx: index('idx_students_group_id').on(table.group_id),
    /** Sparse FK traversal index for semester assignment (STAGE_27). */
    semesterIdIdx: index('idx_students_semester_id').on(table.semester_id),
    /** uniqueIndex on email is handled by DB bootstrap — not declared here. */
    externalIdIdx: index('idx_students_external_id').on(table.external_id),
    /** Partial index for status-filtered queries (list disabled students). */
    statusIdx: index('idx_students_status').on(table.status),
    /** Partial index for subscription-filtered queries. */
    subscriptionStatusIdx: index('idx_students_subscription_status').on(table.subscription_status),
    /** Email index for uniqueness check performance (login + create). */
    emailIdx: index('idx_students_email').on(table.email),
    /** CHECK: status must be ACTIVE or DISABLED. */
    validStatus: check('chk_students_status', sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
    /** CHECK: subscription_status must be a valid enum value. */
    validSubscriptionStatus: check(
      'chk_students_subscription_status',
      sql`${table.subscription_status} IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'NONE')`
    ),
  })
)

export type Student = typeof students.$inferSelect
export type NewStudent = typeof students.$inferInsert
