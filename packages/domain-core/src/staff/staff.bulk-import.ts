/**
 * Staff Domain — Bulk Import
 *
 * File: packages/domain-core/src/staff/staff.bulk-import.ts
 * Stage: STAGE_43_LIMIT_ENFORCEMENT
 *
 * Processes bulk staff import rows in batches of 50.
 * Each batch runs in a SERIALIZABLE transaction.
 * Per-row errors are collected and returned; a single row failure
 * does not abort the entire batch.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ SERIALIZABLE isolation per batch for limit enforcement
 * ✓ Idempotent — duplicate emails within a batch produce a per-row error, not a crash
 * ✓ password_hash never logged or returned
 */

import { hashStaffPassword } from '../auth/staff-password'
import { countActiveStaff, findStaffByEmailForUpdate, insertStaff } from './staff.repository'
import type {
  AuditContext,
  DbClient,
  StaffBulkImportResult,
  StaffBulkImportRow,
  StaffBulkImportRowError,
} from './staff.types'

const BATCH_SIZE = 50

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

/**
 * Process staff bulk import rows in batches.
 * staffLimit of null means unlimited.
 */
export async function processStaffBulkImport(
  db: DbClient,
  workspaceId: string,
  rows: StaffBulkImportRow[],
  staffLimit: number | null,
  _audit: AuditContext
): Promise<StaffBulkImportResult> {
  const batches = chunks(rows, BATCH_SIZE)

  let inserted = 0
  let skipped = 0
  const errors: StaffBulkImportRowError[] = []

  let rowOffset = 0

  for (const batch of batches) {
    const client = await db.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

      const currentActive = await countActiveStaff(client, workspaceId)
      let batchInserted = 0

      for (const [batchIdx, row] of batch.entries()) {
        const absoluteIdx = rowOffset + batchIdx

        // Enforce limit (counts already-inserted rows in this batch)
        if (staffLimit !== null && currentActive + inserted + batchInserted >= staffLimit) {
          errors.push({
            row_index: absoluteIdx,
            email: row.email,
            reason: `Workspace has reached the staff limit of ${staffLimit}`,
            code: 'STAFF_LIMIT_EXCEEDED',
          })
          skipped++
          continue
        }

        // Email uniqueness check within transaction
        const existing = await findStaffByEmailForUpdate(client, workspaceId, row.email)
        if (existing) {
          errors.push({
            row_index: absoluteIdx,
            email: row.email,
            reason: `Email already registered: ${row.email}`,
            code: 'STAFF_EMAIL_CONFLICT',
          })
          skipped++
          continue
        }

        // Hash password
        const passwordHash = await hashStaffPassword(row.password)

        // Insert row
        await insertStaff(client, {
          workspace_id: workspaceId,
          email: row.email,
          name: row.name,
          password_hash: passwordHash,
          role_id: row.role_id ?? null,
        })
        batchInserted++
      }

      await client.query('COMMIT')
      inserted += batchInserted
    } catch (err) {
      await client.query('ROLLBACK')

      // Mark all rows in the batch as failed
      for (let batchIdx = 0; batchIdx < batch.length; batchIdx++) {
        const absoluteIdx = rowOffset + batchIdx
        const row = batch[batchIdx]
        if (!row) continue
        errors.push({
          row_index: absoluteIdx,
          email: row.email,
          reason: err instanceof Error ? err.message : 'Batch transaction failed',
          code: 'STAFF_BATCH_FAILED',
        })
        skipped++
      }
    } finally {
      client.release()
    }

    rowOffset += batch.length
  }

  return { inserted, skipped, errors }
}
