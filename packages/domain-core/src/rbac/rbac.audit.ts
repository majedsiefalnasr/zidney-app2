/**
 * RBAC Audit Logger — STAGE_21
 *
 * File: packages/domain-core/src/rbac/rbac.audit.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Writes an immutable audit entry to rbac_audit_logs within the caller's
 * DB transaction. Called by rbac.service.ts functions after each mutation.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure domain function
 * ✓ All DB access via injected db parameter
 * ✓ Validates action against RBAC_AUDIT_ACTIONS allowlist before insert
 * ✓ Does NOT throw on trigger failure — logs error and returns
 * ✓ Server-authoritative timestamp (NOW() in DB)
 * ✓ Structured logging via @zidney/logger — console.log forbidden
 */

import { createLogger } from '@zidney/logger'

import type { RbacAuditAction, RbacAuditEntry } from './rbac.types'
import { RBAC_AUDIT_ACTIONS } from './rbac.types'

const logger = createLogger('rbac-audit')

// ---------------------------------------------------------------------------
// DB Client interface (matches pg Pool / PoolClient query shape)
// ---------------------------------------------------------------------------

export interface DbClient {
  query: <T = any>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// writeRbacAuditLog
// ---------------------------------------------------------------------------

/**
 * Insert an immutable RBAC audit entry within the caller's DB transaction.
 *
 * @param db - Tenant DB client (must be within an open transaction)
 * @param entry - Audit payload
 *
 * Will NOT throw if the immutability trigger fires unexpectedly.
 * Logs ERROR and returns cleanly so the calling transaction can still commit.
 *
 * @throws Error if action is not in RBAC_AUDIT_ACTIONS allowlist.
 *         Callers must catch this before the DB write — the invalid action
 *         represents a programming error, not a runtime failure.
 */
export async function writeRbacAuditLog(
  db: DbClient,
  entry: RbacAuditEntry
): Promise<void> {
  // Validate action against allowlist — throw on invalid action
  if (!(RBAC_AUDIT_ACTIONS as ReadonlyArray<string>).includes(entry.action)) {
    throw new Error(
      `Invalid RBAC audit action: '${entry.action}'. ` +
        `Allowed values: ${RBAC_AUDIT_ACTIONS.join(', ')}`
    )
  }

  try {
    await db.query(
      `
      INSERT INTO rbac_audit_logs
        (user_id, role_id, module, action, request_id, workspace_slug, timestamp, is_immutable, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), TRUE, $7)
      `,
      [
        entry.user_id ?? null,
        entry.role_id ?? null,
        entry.module ?? null,
        entry.action as RbacAuditAction,
        entry.request_id,
        entry.workspace_slug,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    )
  } catch (err) {
    // Do not rethrow — immutability trigger failure must not abort the calling transaction.
    // The calling transaction is still valid; the audit failure is logged at ERROR.
    logger.error('Failed to write RBAC audit log entry', {
      action: entry.action,
      role_id: entry.role_id,
      user_id: entry.user_id ?? undefined,
      request_id: entry.request_id,
      workspace_slug: entry.workspace_slug,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
