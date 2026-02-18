/**
 * Provisioning Service - Handles new tenant workspace creation and initialization.
 *
 * Integrates with Audit Service (T006) to record provisioning events for compliance tracking.
 */

import { v4 as uuidv4 } from 'uuid'
import { recordTenantProvisioned } from './audit.service'

export interface TenantConfig {
  name: string
  slug: string
  product_version: string
  schema_version: number
  plan?: string
  metadata?: Record<string, any>
}

export interface ProvisionedTenant {
  workspace_id: string
  config: TenantConfig
  created_at: Date
}

/**
 * Create and provision a new tenant workspace.
 *
 * Performs all tenant initialization steps in a single transaction:
 * 1. Create workspace record in workspaces table
 * 2. Initialize tenant database schema
 * 3. Record provisioning event in audit trail
 *
 * @param db - Database connection (master DB)
 * @param tenant_config - Tenant configuration (name, slug, product_version, schema_version)
 * @param actor_id - User ID requesting provisioning (optional for system provisioning)
 * @param metadata - Optional metadata (request_id, ip_address, etc.)
 * @returns Provisioned tenant details with workspace_id
 * @throws Error if provisioning fails at any step
 */
export async function createTenantWorkspace(
  db: any,
  tenant_config: TenantConfig,
  actor_id?: string,
  metadata?: Record<string, any>
): Promise<ProvisionedTenant> {
  const workspace_id = uuidv4()

  await db.transaction(async (trx: any) => {
    // Step 1: Create workspace record
    const now = new Date()
    await trx.insert('workspaces').values({
      id: workspace_id,
      name: tenant_config.name,
      slug: tenant_config.slug,
      license_status: 'ACTIVE', // Default to ACTIVE on provisioning
      product_version: tenant_config.product_version,
      schema_version: tenant_config.schema_version,
      created_at: now,
      updated_at: now,
    })

    // Step 2: Record provisioning event in audit trail (within same transaction)
    const auditMetadata: Record<string, any> = { timestamp: now.toISOString() }
    if (metadata) {
      Object.assign(auditMetadata, metadata)
    }

    const config_snapshot = {
      name: tenant_config.name,
      slug: tenant_config.slug,
      product_version: tenant_config.product_version,
      schema_version: tenant_config.schema_version,
      plan: tenant_config.plan,
      ...(tenant_config.metadata && { metadata: tenant_config.metadata }),
    }

    await recordTenantProvisioned(
      trx,
      workspace_id,
      actor_id,
      config_snapshot,
      auditMetadata
    )
  })

  return {
    workspace_id,
    config: tenant_config,
    created_at: new Date(),
  }
}

/**
 * Get tenant provisioning details by workspace ID.
 *
 * @param db - Database connection
 * @param workspace_id - Workspace UUID
 * @returns Tenant configuration or null if not found
 */
export async function getTenantByWorkspaceId(
  db: any,
  workspace_id: string
): Promise<Partial<TenantConfig> | null> {
  const result = await db
    .select('name', 'slug', 'product_version', 'schema_version')
    .from('workspaces')
    .where('id', '=', workspace_id)
    .first()

  return result || null
}

/**
 * Get tenant provisioning details by slug.
 *
 * @param db - Database connection
 * @param slug - Tenant slug/subdomain
 * @returns Tenant configuration with workspace_id or null if not found
 */
export async function getTenantBySlug(
  db: any,
  slug: string
): Promise<(Partial<TenantConfig> & { workspace_id: string }) | null> {
  const result = await db
    .select(
      'id as workspace_id',
      'name',
      'slug',
      'product_version',
      'schema_version'
    )
    .from('workspaces')
    .where('slug', '=', slug)
    .first()

  return result || null
}

/**
 * Check if tenant slug is already in use.
 *
 * @param db - Database connection
 * @param slug - Tenant slug to check
 * @returns true if slug is taken, false if available
 */
export async function isSlugTaken(db: any, slug: string): Promise<boolean> {
  const result = await db
    .select('id')
    .from('workspaces')
    .where('slug', '=', slug)
    .first()

  return !!result
}
