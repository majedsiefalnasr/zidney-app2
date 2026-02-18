import { v4 as uuidv4 } from 'uuid'

/**
 * Audit Service - Records critical events for compliance and accountability.
 *
 * Supported Event Types:
 * - LICENSE_CHANGE: License status change (ACTIVE → SOFT_LOCKED, etc.)
 * - TENANT_PROVISION: New tenant provisioned
 * - SCHEMA_UPGRADE: Database schema version upgrade
 * - ROLE_CHANGE: User role assignment change
 *
 * All audit events are:
 * - Transactional (wrapped in db.transaction())
 * - Workspace-isolated (workspace_id required)
 * - Immutable (append-only, no UPDATE/DELETE)
 * - Actor-trackable (actor_id mandatory for user actions)
 */

export interface AuditEventRecord {
  id: string
  workspace_id: string
  action_type:
    | 'LICENSE_CHANGE'
    | 'TENANT_PROVISION'
    | 'SCHEMA_UPGRADE'
    | 'ROLE_CHANGE'
  actor_id?: string
  previous_state?: Record<string, any>
  new_state?: Record<string, any>
  metadata?: Record<string, any>
  created_at: Date
}

/**
 * Record a license status change event for audit trail.
 *
 * Called when license status changes (e.g., ACTIVE → SOFT_LOCKED, ACTIVE → ARCHIVED).
 * Captures previous and new states for compliance reconstruction.
 *
 * @param db - Database connection (resolved from tenant context)
 * @param workspace_id - Workspace UUID (required for isolation)
 * @param actor_id - User ID making the change (optional for system actions)
 * @param previousState - Previous license state object
 * @param newState - New license state object
 * @param metadata - Optional metadata (request_id, reason, etc.)
 */
export async function recordLicenseChange(
  db: any,
  workspace_id: string,
  actor_id: string | undefined,
  previousState: Record<string, any>,
  newState: Record<string, any>,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await db.transaction(async (trx: any) => {
      await trx.insert('audit_log').values({
        id: uuidv4(),
        workspace_id,
        actor_id,
        action_type: 'LICENSE_CHANGE',
        previous_state: previousState,
        new_state: newState,
        metadata: metadata || null,
        created_at: new Date(),
      })
    })
  } catch (error) {
    // Log error but don't block calling operation (audit is secondary)
    console.error('Audit service: LICENSE_CHANGE event recording failed', {
      error: error instanceof Error ? error.message : String(error),
      workspace_id,
    })
    // Re-throw for caller to decide handling strategy
    throw error
  }
}

/**
 * Record a new tenant provisioning event for audit trail.
 *
 * Called when a new tenant workspace is provisioned.
 * Captures tenant configuration for accountability.
 *
 * @param db - Database connection (resolved from tenant context)
 * @param workspace_id - New workspace UUID
 * @param actor_id - User ID requesting provisioning (optional for system actions)
 * @param tenantConfig - Tenant configuration (name, slug, product_version, etc.)
 * @param metadata - Optional metadata (request_id, etc.)
 */
export async function recordTenantProvisioned(
  db: any,
  workspace_id: string,
  actor_id: string | undefined,
  tenantConfig: Record<string, any>,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await db.transaction(async (trx: any) => {
      await trx.insert('audit_log').values({
        id: uuidv4(),
        workspace_id,
        actor_id,
        action_type: 'TENANT_PROVISION',
        previous_state: null, // New tenant, no prior state
        new_state: tenantConfig,
        metadata: metadata || null,
        created_at: new Date(),
      })
    })
  } catch (error) {
    console.error('Audit service: TENANT_PROVISION event recording failed', {
      error: error instanceof Error ? error.message : String(error),
      workspace_id,
    })
    throw error
  }
}

/**
 * Record a schema upgrade event for audit trail.
 *
 * Called when database schema is upgraded.
 * Captures version transition for compliance.
 *
 * @param db - Database connection (resolved from tenant context)
 * @param workspace_id - Workspace UUID
 * @param actor_id - User ID requesting upgrade (optional for automated upgrades)
 * @param fromVersion - Previous schema version number
 * @param toVersion - New schema version number
 * @param metadata - Optional metadata (request_id, migration_name, etc.)
 */
export async function recordSchemaUpgrade(
  db: any,
  workspace_id: string,
  actor_id: string | undefined,
  fromVersion: number,
  toVersion: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await db.transaction(async (trx: any) => {
      await trx.insert('audit_log').values({
        id: uuidv4(),
        workspace_id,
        actor_id,
        action_type: 'SCHEMA_UPGRADE',
        previous_state: { schema_version: fromVersion },
        new_state: { schema_version: toVersion },
        metadata: metadata || null,
        created_at: new Date(),
      })
    })
  } catch (error) {
    console.error('Audit service: SCHEMA_UPGRADE event recording failed', {
      error: error instanceof Error ? error.message : String(error),
      workspace_id,
    })
    throw error
  }
}

/**
 * Record a role change event for audit trail.
 *
 * Called when user role is assigned or modified.
 * Captures role transition for compliance.
 *
 * @param db - Database connection (resolved from tenant context)
 * @param workspace_id - Workspace UUID
 * @param actor_id - User ID making the change (optional for system actions)
 * @param userId - User UUID whose role is changing
 * @param previousRole - Previous role (or null for new assignment)
 * @param newRole - New role
 * @param metadata - Optional metadata (request_id, etc.)
 */
export async function recordRoleChange(
  db: any,
  workspace_id: string,
  actor_id: string | undefined,
  userId: string,
  previousRole: string | null,
  newRole: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await db.transaction(async (trx: any) => {
      await trx.insert('audit_log').values({
        id: uuidv4(),
        workspace_id,
        actor_id,
        action_type: 'ROLE_CHANGE',
        previous_state: previousRole
          ? { user_id: userId, role: previousRole }
          : null,
        new_state: { user_id: userId, role: newRole },
        metadata: metadata || null,
        created_at: new Date(),
      })
    })
  } catch (error) {
    console.error('Audit service: ROLE_CHANGE event recording failed', {
      error: error instanceof Error ? error.message : String(error),
      workspace_id,
    })
    throw error
  }
}
