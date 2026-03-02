/**
 * Drizzle ORM Schema — Backoffice Roles (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/backoffice-roles.schema.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM (extended from STAGE_17 base)
 * Date: 2026-03-02
 *
 * Drizzle pgTable definition for the `backoffice_roles` table.
 * The table was created by migration 20260228_001_tenant_rbac_skeleton.ts (STAGE_17).
 * This schema file reflects the STAGE_21 extended shape (after adding `status`).
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { sql } from 'drizzle-orm'
import {
  check,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// backoffice_roles
// ---------------------------------------------------------------------------

export const backofficeRoles = pgTable(
  'backoffice_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Workspace UUID — denormalized for cross-query safety and audit tracing.
     * The tenant DB is already workspace-scoped; stored here for completeness.
     */
    workspace_id: uuid('workspace_id').notNull(),
    /** Human-readable role name. Unique per workspace (enforced by DB UNIQUE constraint). */
    name: varchar('name', { length: 128 }).notNull(),
    /** Optional description of the role's purpose. */
    description: text('description'),
    /**
     * Role lifecycle status.
     * ACTIVE  → role is operational; can be assigned to staff users.
     * DISABLED → role is inactive; assigned users receive 403 on protected routes.
     * Default: 'ACTIVE' (additive migration — existing rows receive 'ACTIVE' automatically).
     * Added in STAGE_21 migration (20260302_001_rbac_role_permissions_complete.ts).
     */
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** CHECK constraint mirrors the DB-level check set in migration DDL. */
    status_check: check(
      'backoffice_roles_status_check',
      sql`${table.status} IN ('ACTIVE', 'DISABLED')`
    ),
  })
)

export type BackofficeRole = typeof backofficeRoles.$inferSelect
export type NewBackofficeRole = typeof backofficeRoles.$inferInsert
