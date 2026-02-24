/**
 * Schema version compatibility check integrated into tenant resolver
 * Called on every request after license middleware
 * Blocks incompatible requests with 426 Upgrade Required
 */

import { isCompatible } from '@zidney/validation'
import { Pool } from 'pg'

export interface TenantResolverContext {
  workspace_id: string
  workspace_slug: string
}

// In-memory cache with TTL for platform settings
const platformSettingsCache = new Map<string, { data: any; expiry: number }>()
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

/**
 * Validate tenant schema version against platform minimum requirement
 * Called by tenant resolver on every request
 * @throws Error with 426 status if incompatible
 */
export async function validateSchemaCompatibility(
  tenantContext: TenantResolverContext,
  masterDb: Pool,
  tenantDb: Pool
): Promise<void> {
  try {
    // Get minimum_supported from cache or fetch fresh
    let minimumSupported: string

    const cached = platformSettingsCache.get('minimum_supported_schema_version')
    if (cached && cached.expiry > Date.now()) {
      minimumSupported = cached.data
    } else {
      const result = await masterDb.query(
        `SELECT minimum_supported_schema_version FROM platform_settings 
         LIMIT 1`
      )

      if (result.rows.length === 0) {
        throw new Error('Platform settings not found')
      }

      minimumSupported = result.rows[0].minimum_supported_schema_version

      // Update cache
      platformSettingsCache.set('minimum_supported_schema_version', {
        data: minimumSupported,
        expiry: Date.now() + CACHE_TTL_MS,
      })
    }

    // Get tenant schema version
    const tenantVersionResult = await tenantDb.query(
      `SELECT version FROM schema_version 
       WHERE id = '00000000-0000-0000-0000-000000000001'::uuid`
    )

    if (tenantVersionResult.rows.length === 0) {
      throw new Error('Tenant schema version not found')
    }

    const tenantVersion = tenantVersionResult.rows[0].version

    // Validate compatibility
    const compatible = isCompatible(tenantVersion, minimumSupported)

    if (!compatible) {
      const err = new Error(
        `Workspace schema version ${tenantVersion} below minimum supported ${minimumSupported}. Upgrade required.`
      )
      ;(err as any).statusCode = 426
      ;(err as any).errorCode = 'SCHEMA_VERSION_MISMATCH'
      throw err
    }

    console.log(
      JSON.stringify({
        level: 'DEBUG',
        service: 'schema-compatibility-checker',
        event: 'schema_version_check_passed',
        workspace_id: tenantContext.workspace_id,
        tenant_version: tenantVersion,
        minimum_version: minimumSupported,
        compatible: true,
        timestamp: new Date().toISOString(),
      })
    )
  } catch (err: any) {
    if (err.statusCode === 426) {
      throw err
    }

    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'schema-compatibility-checker',
        event: 'schema_version_check_failed',
        workspace_id: tenantContext.workspace_id,
        error_message: err.message,
        timestamp: new Date().toISOString(),
      })
    )

    // Re-throw as compatibility error
    const err426 = new Error(err.message)
    ;(err426 as any).statusCode = 500
    throw err426
  }
}

/**
 * Invalidate platform settings cache (called on update)
 */
export function invalidatePlatformSettingsCache(): void {
  platformSettingsCache.delete('minimum_supported_schema_version')

  console.log(
    JSON.stringify({
      level: 'DEBUG',
      service: 'schema-compatibility-checker',
      event: 'cache_invalidated',
      key: 'minimum_supported_schema_version',
      timestamp: new Date().toISOString(),
    })
  )
}
