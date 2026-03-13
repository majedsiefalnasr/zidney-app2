/**
 * Audit Log Verification Helpers
 * Used to verify audit trail entries for security and compliance
 */

import type { Pool } from 'pg'

export interface AuditLogEntry {
  id: string
  workspace_id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  status: 'success' | 'failure'
  details: Record<string, any>
  ip_address: string | null
  created_at: string
}

export class AuditHelper {
  constructor(private db: Pool) {}

  /**
   * Query audit log with filters
   */
  async queryAuditLog(filters: {
    action?: string
    workspace_id?: string
    user_id?: string
    status?: 'success' | 'failure'
    resource_type?: string
  }): Promise<AuditLogEntry[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (filters.action) {
      query += ` AND action = $${paramIndex}`
      params.push(filters.action)
      paramIndex++
    }

    if (filters.workspace_id) {
      query += ` AND workspace_id = $${paramIndex}`
      params.push(filters.workspace_id)
      paramIndex++
    }

    if (filters.user_id) {
      query += ` AND user_id = $${paramIndex}`
      params.push(filters.user_id)
      paramIndex++
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`
      params.push(filters.status)
      paramIndex++
    }

    if (filters.resource_type) {
      query += ` AND resource_type = $${paramIndex}`
      params.push(filters.resource_type)
      paramIndex++
    }

    query += ' ORDER BY created_at DESC'

    try {
      const result = await this.db.query(query, params)
      return result.rows
    } catch (_error) {
      // Table may not exist yet
      return []
    }
  }

  /**
   * Verify audit event exists with expected status
   */
  async verifyAuditEvent(
    action: string,
    workspaceId: string,
    expectedStatus: 'success' | 'failure'
  ): Promise<boolean> {
    const entries = await this.queryAuditLog({
      action,
      workspace_id: workspaceId,
      status: expectedStatus,
    })

    return entries.length > 0
  }

  /**
   * Count unauthorized access attempts
   */
  async countUnauthorizedAttempts(workspaceId: string): Promise<number> {
    const entries = await this.queryAuditLog({
      workspace_id: workspaceId,
      action: 'cross_tenant_access_attempt',
      status: 'failure',
    })

    return entries.length
  }

  /**
   * Get recent audit entries
   */
  async getRecentEntries(workspaceId: string, limit: number = 10): Promise<AuditLogEntry[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM audit_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2',
        [workspaceId, limit]
      )
      return result.rows
    } catch (_error) {
      return []
    }
  }
}

/**
 * Factory to create audit helper
 */
export function createAuditHelper(db: Pool): AuditHelper {
  return new AuditHelper(db)
}
