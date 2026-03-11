/**
 * License Service - Manages workspace license status and related operations.
 *
 * Integrates with Audit Service (T006) to record license changes for compliance tracking.
 */

import { recordLicenseChange } from './audit.service'

type QueryBuilder = {
  select: (...fields: string[]) => QueryBuilder
  from: (table: string) => QueryBuilder
  where: (field: string, op: string, value: string) => QueryBuilder
  first: () => Promise<LicenseStatus | null>
  update: (values: Record<string, unknown>) => Promise<unknown>
}

type TransactionDb = {
  select: (...fields: string[]) => QueryBuilder
  from: (table: string) => QueryBuilder
  where: (field: string, op: string, value: string) => QueryBuilder
  first: () => Promise<LicenseStatus | null>
  transaction: (fn: (trx: TransactionQuery) => Promise<void>) => Promise<void>
}

type TransactionQuery = QueryBuilder & ((table: string) => QueryBuilder)

export interface LicenseStatus {
  status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED' | 'DELETED'
  updated_at: string
}

/**
 * Update workspace license status with audit trail integration.
 *
 * Performs license status change with automatic audit event recording.
 * Transaction encompasses both license update and audit record creation.
 *
 * @param db - Database connection (from tenant resolver context)
 * @param workspace_id - Workspace UUID to update
 * @param new_status - New license status
 * @param actor_id - User ID making the change (optional for system actions)
 * @param reason - Change reason for audit metadata
 * @throws Error if either license update or audit recording fails
 */
export async function updateLicenseStatus(
  db: TransactionDb,
  workspace_id: string,
  new_status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED' | 'DELETED',
  actor_id?: string,
  reason?: string
): Promise<void> {
  await db.transaction(async (trx: TransactionQuery) => {
    // Fetch current license status before change
    const currentLicense = await trx
      .select('license_status as status', 'updated_at')
      .from('workspaces')
      .where('id', '=', workspace_id)
      .first()

    if (!currentLicense) {
      throw new Error(`Workspace not found: ${workspace_id}`)
    }

    const previousStatus = currentLicense.status

    // Update license status
    await trx('workspaces').where('id', '=', workspace_id).update({
      license_status: new_status,
      updated_at: new Date(),
    })

    // Record audit event (within same transaction)
    const metadata: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
    }
    if (reason) {
      metadata.reason = reason
    }

    await recordLicenseChange(
      trx,
      workspace_id,
      actor_id,
      { status: previousStatus },
      { status: new_status },
      metadata
    )
  })
}

/**
 * Get current license status for a workspace.
 *
 * @param db - Database connection
 * @param workspace_id - Workspace UUID
 * @returns Current license status or null if workspace not found
 */
export async function getLicenseStatus(
  db: TransactionDb,
  workspace_id: string
): Promise<LicenseStatus | null> {
  const result = await db
    .select('license_status as status', 'updated_at')
    .from('workspaces')
    .where('id', '=', workspace_id)
    .first()

  return result || null
}

/**
 * Check if license is in active state (permits operations).
 *
 * @param status - License status to check
 * @returns true if license is ACTIVE or SOFT_LOCKED, false for ARCHIVED/DELETED
 */
export function isLicenseActive(status: string): boolean {
  return status === 'ACTIVE' || status === 'SOFT_LOCKED'
}

/**
 * Check if license is soft-locked (permits read-only operations).
 *
 * @param status - License status to check
 * @returns true if license is SOFT_LOCKED
 */
export function isSoftLocked(status: string): boolean {
  return status === 'SOFT_LOCKED'
}
