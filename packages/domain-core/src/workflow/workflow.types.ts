/**
 * Workflow Engine — TypeScript Type Definitions
 *
 * File: packages/domain-core/src/workflow/workflow.types.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Pure type definitions for the tenant-scoped workflow engine.
 * No runtime code, no imports from framework or DB.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure type definitions only
 * ✓ No DB imports — types are layer-agnostic
 * ✓ No framework dependencies
 */

import type { WorkflowState } from './workflow.states'

// -------------------------------------------------------------------------
// DbClient Interface
// -------------------------------------------------------------------------

/**
 * Minimal database client interface accepted by the workflow engine.
 * Compatible with `pg.Pool` — engine calls `db.connect()` to acquire
 * a PoolClient for transaction lifecycle control.
 */
export interface DbClient {
  /**
   * Execute a parameterized query without acquiring a dedicated client.
   * Used only for non-transactional reads outside the engine transaction.
   */
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>

  /**
   * Acquire a dedicated PoolClient for transaction control.
   * The engine calls this to BEGIN/COMMIT/ROLLBACK in a single PoolClient.
   */
  connect?: () => Promise<{
    query: <T = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ) => Promise<{ rows: T[]; rowCount: number | null }>
    release: () => void
  }>
}

// -------------------------------------------------------------------------
// WorkflowContext — engine input value object
// -------------------------------------------------------------------------

/**
 * Runtime input to the workflow engine (FR-015).
 *
 * - db is NOT embedded here. It is the explicit first parameter of
 *   executeTransition().
 * - permissions[] is fully resolved by the API route handler from auth
 *   context BEFORE calling the engine (A-001, A-002).
 * - reason is optional for forward transitions, required for backward
 *   (FR-005).
 * - workspaceSlug and workspaceId MUST come from tenant resolver context
 *   (c.get('tenantSlug') / c.get('tenantId')), NEVER from request body.
 */
export interface WorkflowContext {
  /** Entity type identifier, e.g. 'subject' | 'exam' | 'topic' */
  entityType: string
  /** UUID of the target entity in the tenant database */
  entityId: string
  /** Desired target lifecycle state */
  targetState: WorkflowState
  /** UUID of the authenticated actor (from JWT payload) */
  actorId: string
  /** All permission identifiers held by actor for this tenant */
  permissions: string[]
  /** Justification text — nullable for forward, required for backward */
  reason?: string
  /** Propagated from x-correlation-id header (for structured logs) */
  correlationId: string
  /** Tenant slug — extracted from c.get('tenantSlug'), NOT request body */
  workspaceSlug: string
  /** Tenant UUID — extracted from c.get('tenantId'), NOT request body */
  workspaceId: string
}

// -------------------------------------------------------------------------
// WorkflowTransitionResult — engine output value object
// -------------------------------------------------------------------------

/**
 * Return value of a successful `executeTransition()` call.
 * Used to construct the API response envelope.
 */
export interface WorkflowTransitionResult {
  /** Entity type identifier */
  entityType: string
  /** UUID of the transitioned entity */
  entityId: string
  /** The state the entity was in before the transition */
  previousState: WorkflowState
  /** The state the entity is now in after the transition */
  newState: WorkflowState
  /** UUID of the actor who performed the transition */
  changedBy: string
  /** Server-authoritative timestamp from DB NOW() */
  changedAt: Date
  /** UUID of the inserted workflow_logs row */
  logId: string
}

// -------------------------------------------------------------------------
// WorkflowEnabledEntityRow — entity table shape
// -------------------------------------------------------------------------

/**
 * Minimal shape the engine reads/writes on any workflow-enabled entity
 * table. Each entity table must carry these three columns.
 */
export interface WorkflowEnabledEntityRow {
  /** UUID primary key */
  id: string
  /** Current lifecycle state */
  status: WorkflowState
  /** Timestamp of the last successful transition (server-authoritative) */
  status_updated_at: Date
  /** UUID of the actor who made the last transition; NULL before first */
  status_updated_by: string | null
}
