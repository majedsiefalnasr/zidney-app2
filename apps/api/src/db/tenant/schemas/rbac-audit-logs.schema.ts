/**
 * Drizzle ORM Schema — RBAC Audit Logs (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/rbac-audit-logs.schema.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Drizzle pgTable definition for the `rbac_audit_logs` table.
 * Immutable, append-only audit trail for all destructive RBAC operations.
 * Immutability enforced at DB level via `prevent_rbac_audit_modification` trigger.
 *
 * Valid action values: CREATE_ROLE | UPDATE_ROLE | DISABLE_ROLE | DELETE_ROLE |
 *                      UPDATE_PERMISSIONS | ASSIGN_ROLE
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 * ✓ user_id / role_id nullable — preserved after deletion (GDPR model: audit durability)
 */

import { sql } from 'drizzle-orm'
import { boolean, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// RBAC_AUDIT_ACTIONS allowlist
// NOTE: The canonical definition lives in packages/domain-core/src/rbac/rbac.types.ts.
// This copy mirrors it for Drizzle schema typing at the api-layer.
// The DB-level CHECK constraint in the migration DDL is the enforcement authority.
// ---------------------------------------------------------------------------

export const RBAC_AUDIT_ACTIONS = [
  'CREATE_ROLE',
  'UPDATE_ROLE',
  'DISABLE_ROLE',
  'DELETE_ROLE',
  'UPDATE_PERMISSIONS',
  'ASSIGN_ROLE',
] as const

export type RbacAuditAction = (typeof RBAC_AUDIT_ACTIONS)[number]

// ---------------------------------------------------------------------------
// rbac_audit_logs
// ---------------------------------------------------------------------------

export const rbacAuditLogs = pgTable(
  'rbac_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Actor who performed the RBAC operation.
     * Nullable — value preserved after user deletion (GDPR durability model).
     * No FK — audit row must survive if user record is deleted.
     */
    user_id: uuid('user_id'),
    /**
     * Target role affected by the operation.
     * Nullable — value preserved after role deletion.
     * No FK — audit row must survive if role record is deleted.
     */
    role_id: uuid('role_id'),
    /**
     * Permission module affected.
     * Null for non-permission-specific actions (e.g. CREATE_ROLE, DELETE_ROLE).
     */
    module: varchar('module', { length: 100 }),
    /**
     * RBAC operation type.
     * Validated against RBAC_AUDIT_ACTIONS allowlist at application layer.
     * DB-level CHECK constraint is enforced in migration DDL.
     */
    action: varchar('action', { length: 50 }).notNull(),
    /**
     * Correlation / request ID from the initiating HTTP request.
     * Used for end-to-end tracing (matches correlationId middleware output).
     */
    request_id: varchar('request_id', { length: 50 }).notNull(),
    /**
     * Workspace slug at time of operation.
     * Denormalized — remains readable even if workspace slug changes.
     */
    workspace_slug: varchar('workspace_slug', { length: 100 }).notNull(),
    /**
     * Server-authoritative timestamp. Immutable after insert.
     * DEFAULT NOW() — client timestamps are never trusted per ADR-0006.
     */
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().default(sql`NOW()`),
    /**
     * Database-level immutability flag.
     * Always true — signal to application layer that this row is final.
     * Actual immutability is enforced by DB trigger.
     */
    is_immutable: boolean('is_immutable').notNull().default(true),
    /**
     * Additional context — old/new values, affected user count, etc.
     * JSONB for extensibility without further schema changes.
     */
    metadata: jsonb('metadata'),
  },
  (table) => ({
    /** Role audit history — "what happened to this role?" */
    idx_role_id: index('idx_rbac_al_role_id').on(table.role_id),
    /** Actor history — "what did this user do?" */
    idx_user_id: index('idx_rbac_al_user_id').on(table.user_id),
    /** Time-series queries — most-recent-first pagination. */
    idx_timestamp: index('idx_rbac_al_timestamp').on(table.timestamp),
  })
)

export type RbacAuditLog = typeof rbacAuditLogs.$inferSelect
export type NewRbacAuditLog = typeof rbacAuditLogs.$inferInsert
