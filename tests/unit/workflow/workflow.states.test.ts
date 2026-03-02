/**
 * Workflow States — Unit Tests
 *
 * File: tests/unit/workflow/workflow.states.test.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Tests state ordering, entity type registry, and transition table
 * correctness without any DB or HTTP access.
 *
 * Covers:
 *   T030 — US6: unknown entity type rejected before DB
 *   T031 — US6: WORKFLOW_ENTITY_TYPES contains exactly 7 Phase 3 types
 *   T032 — US6: WORKFLOW_STATE_ORDER and WORKFLOW_TRANSITIONS shape
 */

import { describe, expect, it, vi } from 'vitest'

import { executeTransition } from '../../../packages/domain-core/src/workflow/workflow.engine'
import { WORKFLOW_ERROR_CODES } from '../../../packages/domain-core/src/workflow/workflow.errors'
import {
  WORKFLOW_ENTITY_TYPES,
  WORKFLOW_STATE_ORDER,
  WORKFLOW_TRANSITIONS,
  WorkflowState,
} from '../../../packages/domain-core/src/workflow/workflow.states'
import type {
  DbClient,
  WorkflowContext,
} from '../../../packages/domain-core/src/workflow/workflow.types'

// -------------------------------------------------------------------------
// T030 — US6: Unknown entity type rejected before DB
// -------------------------------------------------------------------------
describe('T030 — WORKFLOW_ENTITY_TYPES: unknown type rejected pre-DB', () => {
  it('executeTransition throws unknown_entity_type 400 for unregistered type', async () => {
    const mockConnect = vi.fn()
    const db: DbClient = {
      query: vi.fn(),
      connect: mockConnect,
    }

    const ctx: WorkflowContext = {
      entityType: 'custom_thing', // not in WORKFLOW_ENTITY_TYPES
      entityId: 'ent-001',
      targetState: WorkflowState.UNDER_REVIEW,
      actorId: 'actor-001',
      permissions: ['custom_thing.review'],
      correlationId: 'corr-001',
      workspaceSlug: 'test-ws',
      workspaceId: 'ws-001',
    }

    await expect(executeTransition(db, ctx)).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.UNKNOWN_ENTITY_TYPE,
      httpStatus: 400,
    })

    // DB connection must NOT have been established
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('does not call DB when entity type is unregistered', async () => {
    const mockConnect = vi.fn()
    const db: DbClient = { query: vi.fn(), connect: mockConnect }

    const ctx: WorkflowContext = {
      entityType: 'not_a_real_entity',
      entityId: 'some-id',
      targetState: WorkflowState.APPROVED,
      actorId: 'actor',
      permissions: [],
      correlationId: 'c1',
      workspaceSlug: 'ws',
      workspaceId: 'ws-id',
    }

    try {
      await executeTransition(db, ctx)
    } catch {
      // expected
    }

    expect(mockConnect).not.toHaveBeenCalled()
  })
})

// -------------------------------------------------------------------------
// T031 — US6: WORKFLOW_ENTITY_TYPES contains exactly 7 Phase 3 types
// -------------------------------------------------------------------------
describe('T031 — WORKFLOW_ENTITY_TYPES: exactly 7 Phase 3 entity types', () => {
  const EXPECTED_ENTITY_TYPES = [
    'subject',
    'mcq_question',
    'traditional_question',
    'exam',
    'topic',
    'library_file',
    'template',
  ] as const

  it('has exactly 7 members', () => {
    expect(WORKFLOW_ENTITY_TYPES.size).toBe(7)
  })

  it.each(EXPECTED_ENTITY_TYPES)('contains entity type "%s"', (entityType) => {
    expect(WORKFLOW_ENTITY_TYPES.has(entityType)).toBe(true)
  })

  it('does not contain unregistered entity types', () => {
    expect(WORKFLOW_ENTITY_TYPES.has('question')).toBe(false)
    expect(WORKFLOW_ENTITY_TYPES.has('student')).toBe(false)
    expect(WORKFLOW_ENTITY_TYPES.has('custom_thing')).toBe(false)
  })
})

// -------------------------------------------------------------------------
// T032 — US6: WORKFLOW_STATE_ORDER length/order and WORKFLOW_TRANSITIONS count
// -------------------------------------------------------------------------
describe('T032 — WORKFLOW_STATE_ORDER and WORKFLOW_TRANSITIONS', () => {
  it('WORKFLOW_STATE_ORDER has exactly 4 members', () => {
    expect(WORKFLOW_STATE_ORDER).toHaveLength(4)
  })

  it('WORKFLOW_STATE_ORDER is in correct sequence', () => {
    expect(WORKFLOW_STATE_ORDER[0]).toBe(WorkflowState.COMPLETED)
    expect(WORKFLOW_STATE_ORDER[1]).toBe(WorkflowState.UNDER_REVIEW)
    expect(WORKFLOW_STATE_ORDER[2]).toBe(WorkflowState.APPROVED)
    expect(WORKFLOW_STATE_ORDER[3]).toBe(WorkflowState.ENABLED)
  })

  it('COMPLETED is at index 0', () => {
    expect(WORKFLOW_STATE_ORDER.indexOf(WorkflowState.COMPLETED)).toBe(0)
  })

  it('UNDER_REVIEW is at index 1', () => {
    expect(WORKFLOW_STATE_ORDER.indexOf(WorkflowState.UNDER_REVIEW)).toBe(1)
  })

  it('APPROVED is at index 2', () => {
    expect(WORKFLOW_STATE_ORDER.indexOf(WorkflowState.APPROVED)).toBe(2)
  })

  it('ENABLED is at index 3', () => {
    expect(WORKFLOW_STATE_ORDER.indexOf(WorkflowState.ENABLED)).toBe(3)
  })

  it('WORKFLOW_TRANSITIONS has exactly 5 entries', () => {
    expect(WORKFLOW_TRANSITIONS).toHaveLength(5)
  })

  it('has exactly 3 forward transitions', () => {
    const forwardTransitions = WORKFLOW_TRANSITIONS.filter((t) => t.forward)
    expect(forwardTransitions).toHaveLength(3)
  })

  it('has exactly 2 backward transitions', () => {
    const backwardTransitions = WORKFLOW_TRANSITIONS.filter((t) => !t.forward)
    expect(backwardTransitions).toHaveLength(2)
  })

  it('forward transitions cover: COMPLETED→UNDER_REVIEW, UNDER_REVIEW→APPROVED, APPROVED→ENABLED', () => {
    const forwardTransitions = WORKFLOW_TRANSITIONS.filter((t) => t.forward)

    expect(forwardTransitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: WorkflowState.COMPLETED,
          to: WorkflowState.UNDER_REVIEW,
          actionKey: 'review',
        }),
        expect.objectContaining({
          from: WorkflowState.UNDER_REVIEW,
          to: WorkflowState.APPROVED,
          actionKey: 'approve',
        }),
        expect.objectContaining({
          from: WorkflowState.APPROVED,
          to: WorkflowState.ENABLED,
          actionKey: 'enable',
        }),
      ])
    )
  })

  it('backward transitions cover: UNDER_REVIEW→COMPLETED and APPROVED→UNDER_REVIEW', () => {
    const backwardTransitions = WORKFLOW_TRANSITIONS.filter((t) => !t.forward)

    expect(backwardTransitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: WorkflowState.UNDER_REVIEW,
          to: WorkflowState.COMPLETED,
          actionKey: 'return',
        }),
        expect.objectContaining({
          from: WorkflowState.APPROVED,
          to: WorkflowState.UNDER_REVIEW,
          actionKey: 'return',
        }),
      ])
    )
  })
})
