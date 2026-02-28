/**
 * Workspace Settings — Data Access Layer (Repository)
 *
 * File: apps/api/src/modules/workspace-settings/workspace-settings.repository.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Database operations for workspace settings and audit entries.
 * All DB access uses the tenant pool from request context — no direct DB instantiation.
 *
 * Guardian Audit Conditions:
 * ✓ Use ON CONFLICT for upsert to prevent singleton race condition
 * ✓ Composite indexes for audit table: (workspace_id, created_at DESC, id DESC)
 * ✓ Truncate user_agent to 500 chars before storage
 * ✓ Validate decoded audit cursor with Zod (datetime + UUID)
 *
 * Constitutional Compliance:
 * ✓ All DB access through tenant pool from request context
 * ✓ No direct DB instantiation
 * ✓ No cross-tenant joins
 * ✓ Transactions managed by caller (service layer)
 */

import { SettingsVersionConflictError } from './workspace-settings.errors'
import type {
  AuditCursor,
  AuditDiffEntry,
  AuditQueryFilters,
  PaginatedAuditResult,
  SettingsGroup,
  WorkspaceSettings,
  WorkspaceSettingsAuditEntry,
} from './workspace-settings.types'
import { auditCursorSchema } from './workspace-settings.validation'

/** Database client interface — matches pg PoolClient or Pool */
interface DbClient {
  query: <T = any>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// Settings CRUD
// ---------------------------------------------------------------------------

/**
 * T010: Retrieve workspace settings row.
 * Returns raw row or null if no settings row exists.
 * No transaction needed — read-only.
 */
export async function getSettings(
  db: DbClient
): Promise<WorkspaceSettings | null> {
  const result = await db.query<WorkspaceSettings>(
    `SELECT id, singleton_key, config_version,
            general_settings, language_settings, branding_settings,
            payment_settings, security_settings,
            created_at, updated_at
     FROM workspace_settings
     WHERE singleton_key = 'SETTINGS'
     LIMIT 1`
  )

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0] ?? null
}

/**
 * T015: Upsert settings for a specific group with optimistic locking.
 *
 * Uses ON CONFLICT for upsert to prevent singleton race condition (guardian audit).
 * Conditional UPDATE: WHERE config_version = expected. If no match → version conflict.
 *
 * @returns The new config_version after update
 * @throws SettingsVersionConflictError if version mismatch
 */
export async function upsertSettings(
  db: DbClient,
  group: SettingsGroup,
  data: Record<string, unknown>,
  expectedVersion: number
): Promise<{ config_version: number }> {
  const columnName = `${group}_settings`
  const jsonData = JSON.stringify(data)

  // Try UPDATE first with optimistic locking
  const updateResult = await db.query(
    `UPDATE workspace_settings
     SET ${columnName} = $1::jsonb,
         config_version = $2 + 1,
         updated_at = NOW()
     WHERE singleton_key = 'SETTINGS'
       AND config_version = $2
     RETURNING config_version`,
    [jsonData, expectedVersion]
  )

  if (updateResult.rows.length > 0) {
    return { config_version: (updateResult.rows[0] as any).config_version }
  }

  // Check if row exists but version mismatch
  const existing = await db.query<{ config_version: number }>(
    `SELECT config_version FROM workspace_settings WHERE singleton_key = 'SETTINGS'`
  )

  if (existing.rows.length > 0 && existing.rows[0]) {
    // Row exists but version mismatch → throw conflict
    throw new SettingsVersionConflictError(existing.rows[0].config_version)
  }

  // No row exists → INSERT with ON CONFLICT for race safety
  const insertResult = await db.query(
    `INSERT INTO workspace_settings (
       singleton_key, config_version,
       organization_name,
       ${columnName},
       created_at, updated_at
     ) VALUES (
       'SETTINGS', 1,
       'Uninitialized',
       $1::jsonb,
       NOW(), NOW()
     )
     ON CONFLICT (singleton_key) DO UPDATE SET
       ${columnName} = $1::jsonb,
       config_version = workspace_settings.config_version + 1,
       updated_at = NOW()
     RETURNING config_version`,
    [jsonData]
  )

  return { config_version: (insertResult.rows[0] as any).config_version }
}

// ---------------------------------------------------------------------------
// Audit Operations
// ---------------------------------------------------------------------------

/**
 * T016: Insert an immutable audit entry.
 * Must be called within the same transaction as upsertSettings.
 *
 * Guardian audit: truncate user_agent to 500 chars before storage.
 */
export async function insertAuditEntry(
  db: DbClient,
  entry: {
    workspace_id: string
    user_id: string
    settings_group: SettingsGroup
    config_version: number
    changes: AuditDiffEntry[]
    request_id: string
    ip_address: string | null
    user_agent: string | null
  }
): Promise<void> {
  // Guardian audit: truncate user_agent to 500 chars
  const truncatedUserAgent = entry.user_agent
    ? entry.user_agent.substring(0, 500)
    : null

  await db.query(
    `INSERT INTO workspace_settings_audit (
       workspace_id, user_id, settings_group, config_version,
       changes, request_id, ip_address, user_agent, created_at
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::inet, $8, NOW())`,
    [
      entry.workspace_id,
      entry.user_id,
      entry.settings_group,
      entry.config_version,
      JSON.stringify(entry.changes),
      entry.request_id,
      entry.ip_address,
      truncatedUserAgent,
    ]
  )
}

/**
 * T023: Retrieve audit entries with cursor-based pagination.
 *
 * Cursor: composite (created_at, id) — decoded from opaque base64 string.
 * Guardian audit: validate decoded cursor with Zod (datetime + UUID).
 *
 * Order: created_at DESC, id DESC for consistent pagination.
 */
export async function getAuditEntries(
  db: DbClient,
  workspaceId: string,
  filters: AuditQueryFilters
): Promise<PaginatedAuditResult> {
  const params: unknown[] = [workspaceId]
  let paramIndex = 2

  // Decode cursor if present
  let cursorData: AuditCursor | null = null
  if (filters.cursor) {
    try {
      const decoded = JSON.parse(
        Buffer.from(filters.cursor, 'base64').toString('utf8')
      )
      // Guardian audit: validate decoded cursor with Zod
      const parsed = auditCursorSchema.safeParse(decoded)
      if (!parsed.success) {
        // Invalid cursor — return empty result
        return { items: [], nextCursor: null }
      }
      cursorData = parsed.data
    } catch {
      // Malformed base64 — return empty result
      return { items: [], nextCursor: null }
    }
  }

  // Build WHERE conditions
  const conditions: string[] = ['workspace_id = $1']

  if (filters.group) {
    conditions.push(`settings_group = $${paramIndex}`)
    params.push(filters.group)
    paramIndex++
  }

  if (cursorData) {
    conditions.push(
      `(created_at, id) < ($${paramIndex}::timestamptz, $${paramIndex + 1}::uuid)`
    )
    params.push(cursorData.created_at, cursorData.id)
    paramIndex += 2
  }

  // Fetch one extra row to determine if there's a next page
  const fetchLimit = filters.limit + 1
  params.push(fetchLimit)

  const query = `
    SELECT id, workspace_id, user_id, settings_group, config_version,
           changes, request_id, ip_address, user_agent, created_at
    FROM workspace_settings_audit
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT $${paramIndex}
  `

  const result = await db.query<WorkspaceSettingsAuditEntry>(query, params)

  const hasMore = result.rows.length > filters.limit
  const items = hasMore ? result.rows.slice(0, filters.limit) : result.rows

  let nextCursor: string | null = null
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1]!
    const cursorPayload: AuditCursor = {
      created_at:
        lastItem.created_at instanceof Date
          ? lastItem.created_at.toISOString()
          : String(lastItem.created_at),
      id: lastItem.id,
    }
    nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString('base64')
  }

  return { items, nextCursor }
}

/**
 * Get current config_version from the settings row.
 * Used for version conflict detection.
 */
export async function getCurrentVersion(db: DbClient): Promise<number | null> {
  const result = await db.query<{ config_version: number }>(
    `SELECT config_version FROM workspace_settings WHERE singleton_key = 'SETTINGS'`
  )
  return result.rows.length > 0 && result.rows[0]
    ? result.rows[0].config_version
    : null
}
