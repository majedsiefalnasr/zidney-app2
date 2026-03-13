/**
 * Workflow Engine — Core Transition Executor
 *
 * File: packages/domain-core/src/workflow/workflow.engine.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Exports `executeTransition(db, context)` — the single entry point for
 * all workflow state transitions across all entity types.
 *
 * Implements the 10-step SELECT FOR UPDATE transaction pattern:
 *   1.  Validate entityType ∈ WORKFLOW_ENTITY_TYPES
 *   2.  Acquire PoolClient via db.connect()
 *   3.  BEGIN transaction
 *   4.  SELECT ... FOR UPDATE (row-level lock)
 *   5.  Lookup valid transition edge
 *   6.  Check actor permission
 *   7.  Validate reason for backward transitions
 *   8.  UPDATE entity row (status + timestamps)
 *   9.  INSERT workflow_logs RETURNING id, changed_at
 *   10. COMMIT
 *   (ROLLBACK + rethrow on any failure in steps 3–10)
 *
 * Constitutional Compliance:
 * ✓ db injected as first parameter — no global singleton
 * ✓ All writes in BEGIN/COMMIT/ROLLBACK transaction
 * ✓ Server-authoritative timestamps via NOW()
 * ✓ Structured logging via @zidney/logger — no console.log
 * ✓ workspace_slug, workspace_id, correlation_id in all log calls
 * ✓ No cross-tenant DB access — tenant context supplied by caller
 */

import { createLogger } from '@zidney/logger'

import {
  entityNotFound,
  invalidStateTransition,
  justificationRequired,
  unknownEntityType,
  workflowConflict,
  workflowPermissionDenied,
} from './workflow.errors'
import { WORKFLOW_ENTITY_TYPES, WORKFLOW_TRANSITIONS, type WorkflowState } from './workflow.states'
import type {
  DbClient,
  WorkflowContext,
  WorkflowEnabledEntityRow,
  WorkflowTransitionResult,
} from './workflow.types'

const logger = createLogger('workflow-engine')

// -------------------------------------------------------------------------
// Entity Table Name Resolution
// -------------------------------------------------------------------------

/**
 * Maps entity type identifiers to their PostgreSQL table names.
 * Covers all 7 Phase 3 entity types.
 */
const ENTITY_TABLE_MAP: Record<string, string> = {
  subject: 'subjects',
  mcq_question: 'mcq_questions',
  traditional_question: 'traditional_questions',
  exam: 'exams',
  topic: 'topics',
  library_file: 'library_files',
  template: 'templates',
}

// -------------------------------------------------------------------------
// executeTransition — Main Public API
// -------------------------------------------------------------------------

/**
 * Execute a workflow state transition for a single entity.
 *
 * All validation, permission checking, and DB writes happen inside a
 * single SELECT FOR UPDATE transaction. Throws WorkflowError on any
 * domain validation failure. Re-throws unknown errors after ROLLBACK.
 *
 * @param db      - Tenant-scoped pg.Pool (injected, never a singleton)
 * @param context - Fully resolved WorkflowContext from the route handler
 * @returns       - WorkflowTransitionResult on success
 * @throws        - WorkflowError on validation/permission/state failure
 */
export async function executeTransition(
  db: DbClient,
  context: WorkflowContext
): Promise<WorkflowTransitionResult> {
  // ------------------------------------------------------------------
  // STEP 1: Validate entityType ∈ WORKFLOW_ENTITY_TYPES (before any DB)
  // ------------------------------------------------------------------
  if (!WORKFLOW_ENTITY_TYPES.has(context.entityType)) {
    logger.warn({
      event: 'workflow.transition.rejected',
      reason: 'unknown_entity_type',
      workspace_slug: context.workspaceSlug,
      workspace_id: context.workspaceId,
      correlation_id: context.correlationId,
      entity_type: context.entityType,
      entity_id: context.entityId,
      actor_id: context.actorId,
    })
    throw unknownEntityType(context.entityType)
  }

  const tableName = ENTITY_TABLE_MAP[context.entityType]
  if (!tableName) throw unknownEntityType(context.entityType)

  logger.info({
    event: 'workflow.transition.attempt',
    workspace_slug: context.workspaceSlug,
    workspace_id: context.workspaceId,
    correlation_id: context.correlationId,
    entity_type: context.entityType,
    entity_id: context.entityId,
    target_state: context.targetState,
    actor_id: context.actorId,
  })

  // ------------------------------------------------------------------
  // STEP 2: Acquire PoolClient for transaction lifecycle control
  // ------------------------------------------------------------------
  if (!db.connect) {
    throw new Error('DbClient must implement connect() for transaction support.')
  }
  const client = await db.connect()

  try {
    // ----------------------------------------------------------------
    // STEP 3: BEGIN transaction
    // ----------------------------------------------------------------
    await client.query('BEGIN')

    // ----------------------------------------------------------------
    // STEP 4: SELECT ... FOR UPDATE (exclusive row lock)
    // ----------------------------------------------------------------
    const selectResult = await client.query<WorkflowEnabledEntityRow>(
      // Table name is resolved from ENTITY_TABLE_MAP — never from user input
      `SELECT id, status, status_updated_at, status_updated_by
         FROM ${tableName}
        WHERE id = $1
          FOR UPDATE`,
      [context.entityId]
    )

    const entityRow = selectResult.rows[0]
    if (!entityRow) {
      logger.warn({
        event: 'workflow.transition.rejected',
        reason: 'entity_not_found',
        workspace_slug: context.workspaceSlug,
        workspace_id: context.workspaceId,
        correlation_id: context.correlationId,
        entity_type: context.entityType,
        entity_id: context.entityId,
        actor_id: context.actorId,
      })
      throw entityNotFound(context.entityType, context.entityId)
    }

    const currentState = entityRow.status as WorkflowState

    // ----------------------------------------------------------------
    // STEP 5: Lookup transition match in WORKFLOW_TRANSITIONS
    // ----------------------------------------------------------------
    const transitionDef = WORKFLOW_TRANSITIONS.find(
      (t) => t.from === currentState && t.to === context.targetState
    )

    if (!transitionDef) {
      logger.warn({
        event: 'workflow.transition.rejected',
        reason: 'invalid_state_transition',
        workspace_slug: context.workspaceSlug,
        workspace_id: context.workspaceId,
        correlation_id: context.correlationId,
        entity_type: context.entityType,
        entity_id: context.entityId,
        actor_id: context.actorId,
        from_state: currentState,
        to_state: context.targetState,
      })
      throw invalidStateTransition(currentState, context.targetState)
    }

    // ----------------------------------------------------------------
    // STEP 6: Check actor permission
    // Required format: `{entityType}.{actionKey}`
    // ----------------------------------------------------------------
    const requiredPermission = `${context.entityType}.${transitionDef.actionKey}`
    if (!context.permissions.includes(requiredPermission)) {
      logger.warn({
        event: 'workflow.transition.rejected',
        reason: 'workflow_permission_denied',
        workspace_slug: context.workspaceSlug,
        workspace_id: context.workspaceId,
        correlation_id: context.correlationId,
        entity_type: context.entityType,
        entity_id: context.entityId,
        actor_id: context.actorId,
        required_permission: requiredPermission,
      })
      throw workflowPermissionDenied(requiredPermission, context.actorId)
    }

    // ----------------------------------------------------------------
    // STEP 7: Validate reason for backward transitions
    // ----------------------------------------------------------------
    if (!transitionDef.forward) {
      if (!context.reason || context.reason.trim().length === 0) {
        logger.warn({
          event: 'workflow.transition.rejected',
          reason: 'justification_required',
          workspace_slug: context.workspaceSlug,
          workspace_id: context.workspaceId,
          correlation_id: context.correlationId,
          entity_type: context.entityType,
          entity_id: context.entityId,
          actor_id: context.actorId,
        })
        throw justificationRequired()
      }
    }

    // ----------------------------------------------------------------
    // STEP 8: UPDATE entity status + timestamps
    // NOW() is used for status_updated_at — never a client timestamp
    // ----------------------------------------------------------------
    await client.query(
      `UPDATE ${tableName}
          SET status            = $1,
              status_updated_at = NOW(),
              status_updated_by = $2
        WHERE id = $3`,
      [context.targetState, context.actorId, context.entityId]
    )

    // ----------------------------------------------------------------
    // STEP 9: INSERT workflow_logs RETURNING id, changed_at
    // ----------------------------------------------------------------
    const insertResult = await client.query<{
      id: string
      changed_at: Date
    }>(
      `INSERT INTO workflow_logs
              (entity_type, entity_id, previous_state, new_state, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, changed_at`,
      [
        context.entityType,
        context.entityId,
        currentState,
        context.targetState,
        context.actorId,
        context.reason ?? null,
      ]
    )

    const logRow = insertResult.rows[0]
    if (!logRow) {
      throw new Error('workflow_logs INSERT returned no row — unexpected failure.')
    }

    // ----------------------------------------------------------------
    // STEP 10: COMMIT
    // ----------------------------------------------------------------
    await client.query('COMMIT')

    const result: WorkflowTransitionResult = {
      entityType: context.entityType,
      entityId: context.entityId,
      previousState: currentState,
      newState: context.targetState,
      changedBy: context.actorId,
      changedAt: logRow.changed_at,
      logId: logRow.id,
    }

    logger.info({
      event: 'workflow.transition.success',
      workspace_slug: context.workspaceSlug,
      workspace_id: context.workspaceId,
      correlation_id: context.correlationId,
      entity_type: context.entityType,
      entity_id: context.entityId,
      actor_id: context.actorId,
      previous_state: currentState,
      new_state: context.targetState,
      log_id: logRow.id,
      transition: `${currentState}→${context.targetState}`,
    })

    return result
  } catch (err) {
    // ------------------------------------------------------------------
    // ROLLBACK on any failure — release back to pool after rollback
    // ------------------------------------------------------------------
    try {
      await client.query('ROLLBACK')
    } catch (rollbackErr) {
      // Log rollback failure but still rethrow the original error
      logger.warn({
        event: 'workflow.rollback.error',
        workspace_slug: context.workspaceSlug,
        workspace_id: context.workspaceId,
        correlation_id: context.correlationId,
        entity_type: context.entityType,
        entity_id: context.entityId,
        actor_id: context.actorId,
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      })
    }

    // Check for PostgreSQL serialization/deadlock errors → workflow_conflict
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === '40001') {
      throw workflowConflict(context.entityId)
    }

    throw err
  } finally {
    client.release()
  }
}
