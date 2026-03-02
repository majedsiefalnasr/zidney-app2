/**
 * Drizzle ORM Schema — Backoffice Staff Users (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM (extended from STAGE_17 base)
 * Date: 2026-03-02
 *
 * Drizzle pgTable definition for the `backoffice_staff_users` table.
 * The table was created by migration 20260228_001_tenant_rbac_skeleton.ts (STAGE_17).
 * This schema file reflects the STAGE_21 extended shape
 * (after adding `role_id` FK and `division_ids` UUID array).
 *
 * Note on `is_active` vs `status`:
 * The spec refers to "user.status == ACTIVE". In this codebase that maps to
 * `is_active = true`. No schema change for this column — permission guard logic
 * maps `is_active = true → ACTIVE` in code. A future migration may normalize this.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 * ✓ password_hash and token_version are present but never exposed in API responses
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { backofficeRoles } from './backoffice-roles.schema'

// ---------------------------------------------------------------------------
// backoffice_staff_users
// ---------------------------------------------------------------------------

export const backofficeStaffUsers = pgTable(
  'backoffice_staff_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    /** Staff member email address. Unique per workspace. */
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    /**
     * bcrypt password hash — plaintext is never stored.
     * NEVER included in API response payloads per SC-007.
     */
    password_hash: varchar('password_hash', { length: 72 }).notNull(),
    /**
     * Token version for forced-logout / credential-change invalidation.
     * Incremented on password change or admin revoke.
     */
    token_version: integer('token_version').notNull().default(0),
    /**
     * Whether the staff user account is active.
     * false → guard returns 403 even with a valid JWT.
     * Maps to "status == ACTIVE" in spec language.
     */
    is_active: boolean('is_active').notNull().default(true),
    /**
     * Single-role FK — references backoffice_roles(id).
     * ON DELETE SET NULL: deleting a role nulls role_id here (no cascade deletion of user).
     * null → treated as no-access (FR-018 deny-by-default).
     * Added in STAGE_21 (migration 20260302_001_rbac_role_permissions_complete.ts).
     */
    role_id: uuid('role_id').references(() => backofficeRoles.id, {
      onDelete: 'set null',
    }),
    /**
     * Division membership UUIDs.
     * Stores the divisions this staff user belongs to.
     * Default empty array — existing rows unaffected by migration.
     * Added in STAGE_21 (migration 20260302_001_rbac_role_permissions_complete.ts).
     */
    division_ids: uuid('division_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Role lookup — used by DELETE /roles/:id active-user count guard. */
    idx_role_id: index('idx_bsu_role_id').on(table.role_id),
    /** Login lookup — workspace + email composite index. */
    idx_workspace_email: index('idx_bsu_workspace_email').on(
      table.workspace_id,
      table.email
    ),
  })
)

export type BackofficeStaffUser = typeof backofficeStaffUsers.$inferSelect
export type NewBackofficeStaffUser = typeof backofficeStaffUsers.$inferInsert
