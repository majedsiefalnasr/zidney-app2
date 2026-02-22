/**
 * License Audit Repository
 *
 * File: packages/domain-core/src/licenses/audit.repository.ts
 * Task: T038
 *
 * Handles audit log operations for license lifecycle events.
 * Provides audit trail for compliance and observability.
 */

import { Database } from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { AuditLogEntry, LicenseStatus } from './types'

export class AuditRepository {
  constructor(private masterDb: Database) {}

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
    const stmt = this.masterDb.prepare(`
      INSERT INTO audit_log (
        id, license_id, action, old_status, new_status, reason, correlation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      RETURNING *
    `)

    const result = stmt.get(
      uuidv4(),
      entry.license_id,
      entry.action,
      entry.old_status || null,
      entry.new_status || null,
      entry.reason || null,
      entry.correlation_id
    ) as any

    return this.mapToAuditLogEntry(result)
  }

  /**
   * T063: Get audit entries by license
   */
  async getByLicenseId(
    license_id: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    const stmt = this.masterDb.prepare(`
      SELECT * FROM audit_log 
      WHERE license_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)

    const results = stmt.all(license_id, limit, offset) as any[]
    return results.map((r) => this.mapToAuditLogEntry(r))
  }

  /**
   * T063: Get recent transitions (for dashboard/monitoring)
   */
  async getRecentTransitions(limit: number = 50): Promise<AuditLogEntry[]> {
    const stmt = this.masterDb.prepare(`
      SELECT * FROM audit_log 
      WHERE action IN ('SOFT_LOCK', 'UNLOCK', 'ARCHIVE', 'RESTORE', 'DELETE')
      ORDER BY created_at DESC
      LIMIT ?
    `)

    const results = stmt.all(limit) as any[]
    return results.map((r) => this.mapToAuditLogEntry(r))
  }

  /**
   * Helper: Map database row to AuditLogEntry
   */
  private mapToAuditLogEntry(row: any): AuditLogEntry {
    return {
      id: row.id,
      license_id: row.license_id,
      action: row.action,
      old_status: row.old_status as LicenseStatus | null,
      new_status: row.new_status as LicenseStatus | null,
      reason: row.reason,
      correlation_id: row.correlation_id,
      created_at: new Date(row.created_at),
    }
  }
}
