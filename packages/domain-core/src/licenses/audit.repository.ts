/**
 * License Audit Repository
 *
 * File: packages/domain-core/src/licenses/audit.repository.ts
 * Task: T038
 *
 * Handles audit log operations for license lifecycle events.
 * Provides audit trail for compliance and observability.
 */

import { v4 as uuidv4 } from 'uuid'
import type { MasterDbClient } from './repository'
import type { AuditLogEntry, LicenseStatus } from './types'

export class AuditRepository {
  constructor(private masterDb: MasterDbClient) {}

  /**
   * T038: Write audit log entry
   *
   * Creates audit log record for license state changes.
   * Called atomically with license status update (same transaction).
   */
  async write(entry: {
    license_id: string
    action: string
    old_status?: LicenseStatus
    new_status?: LicenseStatus
    reason?: string
    correlation_id: string
  }): Promise<AuditLogEntry> {
    const result = await this.masterDb.query(
      `
      INSERT INTO audit_log (
        id, license_id, action, old_status, new_status, reason, correlation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `,
      [
        uuidv4(),
        entry.license_id,
        entry.action,
        entry.old_status || null,
        entry.new_status || null,
        entry.reason || null,
        entry.correlation_id,
      ]
    )

    return this.mapToAuditLogEntry(result.rows[0])
  }

  /**
   * T063: Get audit entries by license
   */
  async getByLicenseId(
    license_id: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    const result = await this.masterDb.query(
      `
      SELECT * FROM audit_log 
      WHERE license_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [license_id, limit, offset]
    )

    return result.rows.map((row) => this.mapToAuditLogEntry(row))
  }

  /**
   * T063: Get recent transitions (for dashboard/monitoring)
   */
  async getRecentTransitions(limit: number = 50): Promise<AuditLogEntry[]> {
    const result = await this.masterDb.query(
      `
      SELECT * FROM audit_log 
      WHERE action IN ('SOFT_LOCK', 'UNLOCK', 'ARCHIVE', 'RESTORE', 'DELETE')
      ORDER BY created_at DESC
      LIMIT $1
    `,
      [limit]
    )

    return result.rows.map((row) => this.mapToAuditLogEntry(row))
  }

  /**
   * Helper: Map database row to AuditLogEntry
   */
  private mapToAuditLogEntry(row: Record<string, unknown>): AuditLogEntry {
    return {
      id: String(row.id),
      license_id: String(row.license_id),
      action: String(row.action),
      old_status: (row.old_status as LicenseStatus) || null,
      new_status: (row.new_status as LicenseStatus) || null,
      reason: typeof row.reason === 'string' ? row.reason : undefined,
      correlation_id: String(row.correlation_id),
      created_at: new Date(String(row.created_at)),
    }
  }
}
