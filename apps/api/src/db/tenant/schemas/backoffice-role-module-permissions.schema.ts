/**
 * Drizzle ORM Schema — Backoffice Role Module Permissions (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/backoffice-role-module-permissions.schema.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Drizzle pgTable definition for the `backoffice_role_module_permissions` table.
 * Boolean-flags permission model — one row per (role_id, module) pair.
 * Absent row = full denial (FR-018 / A7).
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 * ✓ ON DELETE CASCADE: removing a role removes all its permission rows
 */

import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { backofficeRoles } from './backoffice-roles.schema'

// ---------------------------------------------------------------------------
// backoffice_role_module_permissions
// ---------------------------------------------------------------------------

export const backofficeRoleModulePermissions = pgTable(
  'backoffice_role_module_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * FK → backoffice_roles.id ON DELETE CASCADE.
     * Deleting a role cascades to all its permission rows.
     */
    role_id: uuid('role_id')
      .notNull()
      .references(() => backofficeRoles.id, { onDelete: 'cascade' }),
    /**
     * Module key — validates against PermissionModule enum at application layer.
     * Stored as varchar (not enum) to allow extension without migration.
     * Valid values: academic_structure | content_classification | exam_engine | users |
     *               commercial | media_assets | communication | ads | dashboard | settings
     */
    module: varchar('module', { length: 100 }).notNull(),
    /** Whether this role can view resources in the module. */
    can_view: boolean('can_view').notNull().default(false),
    /** Whether this role can create resources in the module. */
    can_create: boolean('can_create').notNull().default(false),
    /** Whether this role can edit resources in the module. */
    can_edit: boolean('can_edit').notNull().default(false),
    /** Whether this role can delete resources in the module. */
    can_delete: boolean('can_delete').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Prevents duplicate permission rows per role per module. */
    unique_role_module: uniqueIndex(
      'backoffice_role_module_permissions_unique'
    ).on(table.role_id, table.module),
    /** Permission evaluation hot path — lookup all permissions for a role. */
    idx_role_id: index('idx_brmp_role_id').on(table.role_id),
    /** Per-module permission lookup for guard evaluation. */
    idx_role_module: index('idx_brmp_role_module').on(
      table.role_id,
      table.module
    ),
  })
)

export type BackofficeRoleModulePermission =
  typeof backofficeRoleModulePermissions.$inferSelect
export type NewBackofficeRoleModulePermission =
  typeof backofficeRoleModulePermissions.$inferInsert
