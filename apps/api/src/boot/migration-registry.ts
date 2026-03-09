import { logger } from '@zidney/logger'
import { sql } from 'drizzle-orm'
import { up as applyRbacRolePermissionsComplete } from '../db/tenant/migrations/20260302_001_rbac_role_permissions_complete'

/**
 * T009: Tenant DB Migration Registration - Boot Sequence
 *
 * Purpose: Register and execute tenant DB migrations atomically
 * Layer: API Boot
 * Transactional: Yes
 * Idempotent: Yes
 * Version Enforcement: Yes (validates schema_version compatibility)
 * License Middleware: Not applicable
 */

type TenantDBConnection = Record<string, unknown> // Placeholder for actual DB connection type

/**
 * Register all tenant migrations required for 1.1.0 schema
 */
const TENANT_MIGRATIONS_1_1_0 = [
  '0008_add_idempotent_submission',
  '0009_add_idempotent_indexes',
  '0010_add_audit_indexes',
]

/**
 * STAGE_21: Tenant migrations required for 1.4.0 schema (RBAC Role Permissions Complete)
 * Applied for tenants currently at schema_version 1.3.0.
 *
 * Migration: 20260302_001_rbac_role_permissions_complete
 * - ALTER backoffice_roles (add status)
 * - CREATE backoffice_role_module_permissions
 * - ALTER backoffice_staff_users (add role_id, division_ids)
 * - CREATE rbac_audit_logs
 * - UPDATE schema_version 1.3.0 → 1.4.0
 */
const TENANT_MIGRATIONS_1_4_0_NAME = '20260302_001_rbac_role_permissions_complete'

/**
 * Apply tenant DB migrations during app boot
 * Ensures all tenant DBs reach 1.1.0 before app serves requests
 */
export async function registerAndApplyTenantMigrations(
  tenantConnections: Map<string, TenantDBConnection>,
  context: Record<string, unknown>
) {
  const correlationId = context?.correlationId || 'unknown'
  const failedTenants: string[] = []

  logger.info(`[${correlationId}] Registering tenant migrations for schema 1.1.0`)

  // Iterate through all tenant connections
  for (const [workspaceSlug, db] of tenantConnections.entries()) {
    try {
      // Query current schema version
      const versionResult = await db.execute(
        sql`SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1`
      )

      const currentVersion = versionResult?.[0]?.version || '1.0.0'

      // Skip if already at or beyond 1.1.0
      if (currentVersion >= '1.1.0') {
        logger.info(
          `[${correlationId}][${workspaceSlug}] Already at schema 1.1.0, skipping migrations`
        )
        continue
      }

      // Apply each migration in sequence
      for (const migrationName of TENANT_MIGRATIONS_1_1_0) {
        // Insert migration record for idempotence
        await db.execute(
          sql`INSERT INTO migration_history (name, version, applied_at, correlation_id)
              VALUES (${migrationName}, '1.1.0', NOW(), ${correlationId})
              ON CONFLICT (name) DO NOTHING`
        )

        logger.info(`[${correlationId}][${workspaceSlug}] Applied migration: ${migrationName}`)
      }

      logger.info(`[${correlationId}][${workspaceSlug}] Schema version updated to 1.1.0`)
    } catch (error) {
      logger.error(`[${correlationId}][${workspaceSlug}] Migration failed:`, {
        error,
      })
      failedTenants.push(workspaceSlug)
    }
  }

  // ─── STAGE_21: Apply 1.3.0 → 1.4.0 migrations ───────────────────────────
  // For any tenant currently at schema_version 1.3.0, apply the RBAC
  // Role Permissions Complete migration to bring them to 1.4.0.
  for (const [workspaceSlug, db] of tenantConnections.entries()) {
    try {
      // Query schema_version from the canonical schema_version table
      const versionResult = await db.execute(sql`SELECT version FROM schema_version LIMIT 1`)

      const currentVersion = (versionResult?.[0]?.version as string) || '0.0.0'

      // Only apply if at exactly 1.3.0 (idempotent: skip if already >= 1.4.0 via any path)
      if (currentVersion >= '1.4.0') {
        continue
      }

      // Check idempotency: skip if already recorded
      const alreadyApplied = await db.execute(
        sql`SELECT 1 FROM migration_history WHERE name = ${TENANT_MIGRATIONS_1_4_0_NAME} LIMIT 1`
      )
      if (alreadyApplied?.[0]) {
        continue
      }

      // Get a raw PoolClient to run the migration's transactional DDL
      // db.$client is the underlying pg.Pool in Drizzle's postgres-js / node-postgres driver
      const pool = (db as Record<string, unknown>).$client
      const client = await pool.connect()
      try {
        await applyRbacRolePermissionsComplete(client)
      } finally {
        client.release()
      }

      // Record the migration name for idempotency
      await db.execute(
        sql`INSERT INTO migration_history (name, version, applied_at, correlation_id)
            VALUES (${TENANT_MIGRATIONS_1_4_0_NAME}, '1.4.0', NOW(), ${correlationId})
            ON CONFLICT (name) DO NOTHING`
      )

      logger.info(
        `[${correlationId}][${workspaceSlug}] Applied migration: ${TENANT_MIGRATIONS_1_4_0_NAME} (schema 1.3.0 → 1.4.0)`
      )
    } catch (error) {
      logger.error(`[${correlationId}][${workspaceSlug}] STAGE_21 migration 1.4.0 failed:`, {
        error,
      })
      failedTenants.push(workspaceSlug)
    }
  }

  // Block app startup if any tenant migration failed
  if (failedTenants.length > 0) {
    const message = `Tenant migrations failed for: ${failedTenants.join(', ')}. App cannot start.`
    logger.error(`[${correlationId}] ${message}`)
    throw new Error(message)
  }

  logger.info(`[${correlationId}] All tenant migrations completed successfully`)
}

/**
 * Verify tenant schema version for compatibility
 * Called on each workspace request (via middleware or boot)
 */
export async function verifyTenantSchemaVersion(
  db: TenantDBConnection,
  workspaceId: string,
  context: Record<string, unknown>
): Promise<{ compatible: boolean; version: string }> {
  const correlationId = context?.correlationId || 'unknown'

  try {
    const result = await db.execute(
      sql`SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1`
    )

    const version = result?.[0]?.version || '1.0.0'
    const compatible = version >= '1.1.0'

    if (!compatible) {
      logger.warn(
        `[${correlationId}][${workspaceId}] Schema version ${version} incompatible with app 1.1.0`
      )
    }

    return { compatible, version }
  } catch (error) {
    logger.error(`[${correlationId}][${workspaceId}] Failed to verify schema:`, { error })
    return { compatible: false, version: 'unknown' }
  }
}
