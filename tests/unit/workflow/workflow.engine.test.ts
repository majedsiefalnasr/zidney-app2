/**
 * Workflow Engine — Unit Tests
 *
 * File: tests/unit/workflow/workflow.engine.test.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Tests business logic: state transitions, permission checks, justification
 * enforcement, error codes, transaction rollback behaviour.
 *
 * All DB access is mocked — no real DB connection required.
 *
 * Covers:
 *   T012 — US1: valid COMPLETED→UNDER_REVIEW with permission
 *   T013 — US1: COMPLETED→UNDER_REVIEW without permission → 403
 *   T014 — US1: UNDER_REVIEW→UNDER_REVIEW same-state re-attempt → 400
 *   T016 — US2: valid UNDER_REVIEW→APPROVED with permission
 *   T017 — US2: COMPLETED→APPROVED state-skip → 400
 *   T019 — US3: valid APPROVED→ENABLED with permission
 *   T020 — US3: COMPLETED→ENABLED and UNDER_REVIEW→ENABLED state-skip → 400
 *   T021 — US3: ENABLED→ENABLED re-enable → 400
 *   T023 — US4: valid UNDER_REVIEW→COMPLETED backward with reason
 *   T024 — US4: backward transition without reason → 400
 *   T025 — US4: backward transition without permission → 403
 *   T027 — US5: successful INSERT INTO workflow_logs with all required fields
 *   T028 — US5: workflow_logs INSERT failure → transaction rollback
 */

import { describe, expect, it, vi } from 'vitest'

import { executeTransition } from '../../../packages/domain-core/src/workflow/workflow.engine'
import {
  WORKFLOW_ERROR_CODES,
  WorkflowError,
} from '../../../packages/domain-core/src/workflow/workflow.errors'
import { WorkflowState } from '../../../packages/domain-core/src/workflow/workflow.states'
import type {
  DbClient,
  WorkflowContext,
} from '../../../packages/domain-core/src/workflow/workflow.types'

// -------------------------------------------------------------------------
// Test Fixtures
// -------------------------------------------------------------------------

const BASE_ENTITY_ID = '11111111-1111-1111-1111-111111111111'
const BASE_ACTOR_ID = '22222222-2222-2222-2222-222222222222'
const BASE_LOG_ID = '33333333-3333-3333-3333-333333333333'
const BASE_CHANGED_AT = new Date('2026-03-01T10:00:00Z')

function baseContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    entityType: 'subject',
    entityId: BASE_ENTITY_ID,
    targetState: WorkflowState.UNDER_REVIEW,
    actorId: BASE_ACTOR_ID,
    permissions: ['subject.review'],
    correlationId: 'corr-test-001',
    workspaceSlug: 'test-workspace',
    workspaceId: 'ws-uuid-001',
    ...overrides,
  }
}

/**
 * Creates a mock PoolClient that simulates the transaction lifecycle.
 * Each query call matches on SQL keywords and returns controlled data.
 */
function createMockClient(options: {
  entityStatus?: WorkflowState
  entityExists?: boolean
  failOnInsert?: boolean
}) {
  const {
    entityStatus = WorkflowState.COMPLETED,
    entityExists = true,
    failOnInsert = false,
  } = options

  const queryLog: Array<{ sql: string; params?: unknown[] }> = []

  const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    queryLog.push({ sql: sql.trim(), params })

    if (/^BEGIN/i.test(sql.trim())) return { rows: [], rowCount: 0 }
    if (/^COMMIT/i.test(sql.trim())) return { rows: [], rowCount: 0 }
    if (/^ROLLBACK/i.test(sql.trim())) return { rows: [], rowCount: 0 }

    // SELECT FOR UPDATE — entity row fetch
    if (/FOR UPDATE/i.test(sql)) {
      if (!entityExists) return { rows: [], rowCount: 0 }
      return {
        rows: [
          {
            id: BASE_ENTITY_ID,
            status: entityStatus,
            status_updated_at: new Date('2026-03-01T09:00:00Z'),
            status_updated_by: null,
          },
        ],
        rowCount: 1,
      }
    }

    // UPDATE entity status
    if (/^UPDATE/i.test(sql.trim())) return { rows: [], rowCount: 1 }

    // INSERT INTO workflow_logs
    if (/INSERT INTO workflow_logs/i.test(sql)) {
      if (failOnInsert) throw new Error('DB: workflow_logs INSERT failed')
      return {
        rows: [{ id: BASE_LOG_ID, changed_at: BASE_CHANGED_AT }],
        rowCount: 1,
      }
    }

    return { rows: [], rowCount: 0 }
  })

  return {
    query: clientQuery,
    release: vi.fn(),
    _queryLog: queryLog,
  }
}

/**
 * Creates a mock DbClient wrapping a mock PoolClient.
 */
function createMockDb(options: Parameters<typeof createMockClient>[0] = {}) {
  const client = createMockClient(options)
  const db: DbClient = {
    query: vi.fn(),
    connect: vi.fn(async () => client),
  }
  return { db, client }
}

// -------------------------------------------------------------------------
// T012 — US1: Valid COMPLETED→UNDER_REVIEW with subject.review permission
// -------------------------------------------------------------------------
describe('T012 — executeTransition: valid COMPLETED→UNDER_REVIEW', () => {
  it('returns WorkflowTransitionResult with correct shape', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.COMPLETED })
    const ctx = baseContext({
      targetState: WorkflowState.UNDER_REVIEW,
      permissions: ['subject.review'],
    })

    const result = await executeTransition(db, ctx)

    expect(result.entityType).toBe('subject')
    expect(result.entityId).toBe(BASE_ENTITY_ID)
    expect(result.previousState).toBe(WorkflowState.COMPLETED)
    expect(result.newState).toBe(WorkflowState.UNDER_REVIEW)
    expect(result.changedBy).toBe(BASE_ACTOR_ID)
    expect(result.logId).toBe(BASE_LOG_ID)
    expect(result.changedAt).toEqual(BASE_CHANGED_AT)
  })

  it('calls BEGIN, SELECT FOR UPDATE, UPDATE, INSERT, COMMIT in order', async () => {
    const { db, client } = createMockDb({
      entityStatus: WorkflowState.COMPLETED,
    })
    const ctx = baseContext()

    await executeTransition(db, ctx)

    const calls = client._queryLog.map((q) => q.sql.split(/\s+/)[0]!.toUpperCase())
    const beginIdx = calls.indexOf('BEGIN')
    const select = client._queryLog.findIndex((q) => /FOR UPDATE/i.test(q.sql))
    const update = client._queryLog.findIndex((q) => /^UPDATE/i.test(q.sql.trim()))
    const insert = client._queryLog.findIndex((q) => /INSERT INTO workflow_logs/i.test(q.sql))
    const commit = client._queryLog.findIndex((q) => /^COMMIT/i.test(q.sql.trim()))

    expect(beginIdx).toBeGreaterThanOrEqual(0)
    expect(select).toBeGreaterThan(beginIdx)
    expect(update).toBeGreaterThan(select)
    expect(insert).toBeGreaterThan(update)
    expect(commit).toBeGreaterThan(insert)
  })
})

// -------------------------------------------------------------------------
// T013 — US1: COMPLETED→UNDER_REVIEW without subject.review permission → 403
// -------------------------------------------------------------------------
describe('T013 — executeTransition: missing permission → 403', () => {
  it('throws WorkflowError workflow_permission_denied with httpStatus 403', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.COMPLETED })
    const ctx = baseContext({
      targetState: WorkflowState.UNDER_REVIEW,
      permissions: [], // no permissions
    })

    await expect(executeTransition(db, ctx)).rejects.toThrow(WorkflowError)
    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_PERMISSION_DENIED,
      httpStatus: 403,
    })
  })
})

// -------------------------------------------------------------------------
// T014 — US1: UNDER_REVIEW→UNDER_REVIEW same-state re-attempt → 400
// -------------------------------------------------------------------------
describe('T014 — executeTransition: same-state re-attempt → 400', () => {
  it('throws WorkflowError invalid_state_transition with httpStatus 400', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.UNDER_REVIEW })
    const ctx = baseContext({
      targetState: WorkflowState.UNDER_REVIEW, // same as current state
      permissions: ['subject.review'],
    })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.INVALID_STATE_TRANSITION,
      httpStatus: 400,
    })
  })
})

// -------------------------------------------------------------------------
// T016 — US2: Valid UNDER_REVIEW→APPROVED with subject.approve permission
// -------------------------------------------------------------------------
describe('T016 — executeTransition: valid UNDER_REVIEW→APPROVED', () => {
  it('returns correct WorkflowTransitionResult shape', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.UNDER_REVIEW })
    const ctx = baseContext({
      targetState: WorkflowState.APPROVED,
      permissions: ['subject.approve'],
    })

    const result = await executeTransition(db, ctx)

    expect(result.previousState).toBe(WorkflowState.UNDER_REVIEW)
    expect(result.newState).toBe(WorkflowState.APPROVED)
    expect(result.logId).toBe(BASE_LOG_ID)
  })
})

// -------------------------------------------------------------------------
// T017 — US2: COMPLETED→APPROVED state-skip → 400
// -------------------------------------------------------------------------
describe('T017 — executeTransition: COMPLETED→APPROVED state-skip → 400', () => {
  it('throws invalid_state_transition 400', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.COMPLETED })
    const ctx = baseContext({
      targetState: WorkflowState.APPROVED,
      permissions: ['subject.approve'],
    })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.INVALID_STATE_TRANSITION,
      httpStatus: 400,
    })
  })
})

// -------------------------------------------------------------------------
// T019 — US3: Valid APPROVED→ENABLED with subject.enable permission
// -------------------------------------------------------------------------
describe('T019 — executeTransition: valid APPROVED→ENABLED', () => {
  it('returns correct WorkflowTransitionResult shape', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.APPROVED })
    const ctx = baseContext({
      targetState: WorkflowState.ENABLED,
      permissions: ['subject.enable'],
    })

    const result = await executeTransition(db, ctx)

    expect(result.previousState).toBe(WorkflowState.APPROVED)
    expect(result.newState).toBe(WorkflowState.ENABLED)
  })
})

// -------------------------------------------------------------------------
// T020 — US3: COMPLETED→ENABLED and UNDER_REVIEW→ENABLED state-skips → 400
// -------------------------------------------------------------------------
describe('T020 — executeTransition: state-skip to ENABLED → 400', () => {
  it('COMPLETED→ENABLED throws invalid_state_transition 400', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.COMPLETED })
    const ctx = baseContext({
      targetState: WorkflowState.ENABLED,
      permissions: ['subject.enable'],
    })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.INVALID_STATE_TRANSITION,
      httpStatus: 400,
    })
  })

  it('UNDER_REVIEW→ENABLED throws invalid_state_transition 400', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.UNDER_REVIEW })
    const ctx = baseContext({
      targetState: WorkflowState.ENABLED,
      permissions: ['subject.enable'],
    })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.INVALID_STATE_TRANSITION,
      httpStatus: 400,
    })
  })
})

// -------------------------------------------------------------------------
// T021 — US3: ENABLED→ENABLED re-enable → 400
// -------------------------------------------------------------------------
describe('T021 — executeTransition: ENABLED→ENABLED re-enable → 400', () => {
  it('throws invalid_state_transition', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.ENABLED })
    const ctx = baseContext({
      targetState: WorkflowState.ENABLED,
      permissions: ['subject.enable'],
    })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.INVALID_STATE_TRANSITION,
      httpStatus: 400,
    })
  })
})

// -------------------------------------------------------------------------
// T023 — US4: Valid UNDER_REVIEW→COMPLETED backward with reason
// -------------------------------------------------------------------------
describe('T023 — executeTransition: valid backward UNDER_REVIEW→COMPLETED', () => {
  it('returns correct result with reason stored', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.UNDER_REVIEW })
    const ctx = baseContext({
      targetState: WorkflowState.COMPLETED,
      permissions: ['subject.return'],
      reason: 'Content needs significant revision',
    })

    const result = await executeTransition(db, ctx)

    expect(result.previousState).toBe(WorkflowState.UNDER_REVIEW)
    expect(result.newState).toBe(WorkflowState.COMPLETED)
    expect(result.logId).toBe(BASE_LOG_ID)
  })
})

// -------------------------------------------------------------------------
// T024 — US4: Backward transition with permission but no reason → 400
// -------------------------------------------------------------------------
describe('T024 — executeTransition: backward without reason → 400', () => {
  it('throws justification_required 400 when reason is missing', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.UNDER_REVIEW })
    const ctx = baseContext({
      targetState: WorkflowState.COMPLETED,
      permissions: ['subject.return'],
      reason: undefined, // missing reason
    })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.JUSTIFICATION_REQUIRED,
      httpStatus: 400,
    })
  })

  it('throws justification_required 400 when reason is empty string', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.UNDER_REVIEW })
    const ctx = baseContext({
      targetState: WorkflowState.COMPLETED,
      permissions: ['subject.return'],
      reason: '   ', // whitespace-only reason
    })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.JUSTIFICATION_REQUIRED,
      httpStatus: 400,
    })
  })
})

// -------------------------------------------------------------------------
// T025 — US4: Backward transition without subject.return permission → 403
// -------------------------------------------------------------------------
describe('T025 — executeTransition: backward without permission → 403', () => {
  it('throws workflow_permission_denied 403 even when reason is provided', async () => {
    const { db } = createMockDb({ entityStatus: WorkflowState.UNDER_REVIEW })
    const ctx = baseContext({
      targetState: WorkflowState.COMPLETED,
      permissions: ['subject.review'], // has review but not return
      reason: 'Good reason provided',
    })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_PERMISSION_DENIED,
      httpStatus: 403,
    })
  })
})

// -------------------------------------------------------------------------
// T027 — US5: INSERT INTO workflow_logs called with all required fields
// -------------------------------------------------------------------------
describe('T027 — executeTransition: workflow_logs INSERT fields', () => {
  it('calls INSERT with entity_type, entity_id, previous_state, new_state, changed_by, reason', async () => {
    const { db, client } = createMockDb({
      entityStatus: WorkflowState.COMPLETED,
    })
    const ctx = baseContext({
      targetState: WorkflowState.UNDER_REVIEW,
      permissions: ['subject.review'],
      reason: 'Submitted for review',
    })

    const result = await executeTransition(db, ctx)

    // Find the INSERT query in the query log
    const insertCall = client._queryLog.find((q) => /INSERT INTO workflow_logs/i.test(q.sql))
    expect(insertCall).toBeDefined()

    // Verify required params: [entityType, entityId, previousState, newState, changedBy, reason]
    expect(insertCall!.params).toEqual([
      'subject', // entity_type
      BASE_ENTITY_ID, // entity_id
      WorkflowState.COMPLETED, // previous_state
      WorkflowState.UNDER_REVIEW, // new_state
      BASE_ACTOR_ID, // changed_by
      'Submitted for review', // reason
    ])

    // Returned logId matches RETURNING id
    expect(result.logId).toBe(BASE_LOG_ID)
    expect(result.changedAt).toEqual(BASE_CHANGED_AT)
  })

  it('passes null reason to INSERT for forward transitions with no reason', async () => {
    const { db, client } = createMockDb({
      entityStatus: WorkflowState.COMPLETED,
    })
    const ctx = baseContext({
      targetState: WorkflowState.UNDER_REVIEW,
      permissions: ['subject.review'],
      // no reason
    })

    await executeTransition(db, ctx)

    const insertCall = client._queryLog.find((q) => /INSERT INTO workflow_logs/i.test(q.sql))
    expect(insertCall!.params![5]).toBeNull()
  })
})

// -------------------------------------------------------------------------
// T028 — US5: workflow_logs INSERT failure → full transaction rollback
// -------------------------------------------------------------------------
describe('T028 — executeTransition: INSERT failure triggers ROLLBACK', () => {
  it('throws when workflow_logs INSERT fails and issues ROLLBACK', async () => {
    const { db, client } = createMockDb({
      entityStatus: WorkflowState.COMPLETED,
      failOnInsert: true,
    })
    const ctx = baseContext({
      targetState: WorkflowState.UNDER_REVIEW,
      permissions: ['subject.review'],
    })

    await expect(executeTransition(db, ctx)).rejects.toThrow('workflow_logs INSERT failed')

    // ROLLBACK must have been called
    const rollbackCall = client._queryLog.find((q) => /^ROLLBACK/i.test(q.sql.trim()))
    expect(rollbackCall).toBeDefined()

    // COMMIT must NOT have been called
    const commitCall = client._queryLog.find((q) => /^COMMIT/i.test(q.sql.trim()))
    expect(commitCall).toBeUndefined()
  })
})

// -------------------------------------------------------------------------
// Additional: entity not found → 404
// -------------------------------------------------------------------------
describe('executeTransition: entity not found → 404', () => {
  it('throws entity_not_found 404 when SELECT returns no row', async () => {
    const { db } = createMockDb({ entityExists: false })
    const ctx = baseContext()

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.ENTITY_NOT_FOUND,
      httpStatus: 404,
    })
  })
})

// -------------------------------------------------------------------------
// Additional: unknown entity type → 400 (pre-DB validation)
// -------------------------------------------------------------------------
describe('executeTransition: unknown entity type → 400', () => {
  it('throws unknown_entity_type 400 without touching DB', async () => {
    const { db } = createMockDb()
    const ctx = baseContext({ entityType: 'custom_unknown_thing' })

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.UNKNOWN_ENTITY_TYPE,
      httpStatus: 400,
    })

    // db.connect must NOT have been called
    expect(db.connect).not.toHaveBeenCalled()
  })
})
