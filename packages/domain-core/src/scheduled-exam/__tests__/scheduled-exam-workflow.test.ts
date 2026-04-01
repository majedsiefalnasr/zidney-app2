/**
 * Unit Tests — scheduled-exam-workflow.ts
 *
 * File: packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-workflow.test.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { describe, expect, it } from 'vitest'
import {
  canTransitionToEnabled,
  getImmutableFields,
  IMMUTABLE_WHEN_ENABLED,
  IMMUTABLE_WITH_ATTEMPTS,
  isFieldMutable,
} from '../scheduled-exam-workflow'

describe('canTransitionToEnabled', () => {
  const baseApproved = {
    workflow_status: 'APPROVED' as const,
    base_exam_modified: false,
    deleted_at: null,
  }

  it('returns true for a valid APPROVED exam with unmodified base exam', () => {
    expect(canTransitionToEnabled(baseApproved)).toBe(true)
  })

  it('returns false if workflow_status is already ENABLED', () => {
    expect(canTransitionToEnabled({ ...baseApproved, workflow_status: 'ENABLED' })).toBe(false)
  })

  it('returns false if base_exam_modified is true', () => {
    expect(canTransitionToEnabled({ ...baseApproved, base_exam_modified: true })).toBe(false)
  })

  it('returns false if deleted_at is set (soft-deleted)', () => {
    expect(canTransitionToEnabled({ ...baseApproved, deleted_at: '2026-01-01T00:00:00Z' })).toBe(
      false
    )
  })
})

describe('getImmutableFields', () => {
  it('returns no immutable fields for APPROVED status with no attempts', () => {
    const fields = getImmutableFields('APPROVED', 0)
    expect(fields).toHaveLength(0)
  })

  it('returns IMMUTABLE_WHEN_ENABLED fields for ENABLED status with no attempts', () => {
    const fields = getImmutableFields('ENABLED', 0)
    for (const f of IMMUTABLE_WHEN_ENABLED) {
      expect(fields).toContain(f)
    }
  })

  it('returns IMMUTABLE_WITH_ATTEMPTS fields for APPROVED status with >=1 attempts', () => {
    const fields = getImmutableFields('APPROVED', 1)
    for (const f of IMMUTABLE_WITH_ATTEMPTS) {
      expect(fields).toContain(f)
    }
  })

  it('returns union of ALL immutable fields for ENABLED with >=1 attempts', () => {
    const fields = getImmutableFields('ENABLED', 5)
    for (const f of IMMUTABLE_WHEN_ENABLED) {
      expect(fields).toContain(f)
    }
    for (const f of IMMUTABLE_WITH_ATTEMPTS) {
      expect(fields).toContain(f)
    }
  })
})

describe('isFieldMutable', () => {
  it('returns true for mutable field in APPROVED status with no attempts', () => {
    expect(isFieldMutable('name', 'APPROVED', 0)).toBe(true)
  })

  it('returns false for immutable field when ENABLED', () => {
    // e.g. 'code' is in IMMUTABLE_WHEN_ENABLED
    expect(isFieldMutable('code', 'ENABLED', 0)).toBe(false)
  })

  it('returns false for immutable field after attempts exist', () => {
    // 'allow_single_attempt' is in IMMUTABLE_WITH_ATTEMPTS
    expect(isFieldMutable('allow_single_attempt', 'APPROVED', 1)).toBe(false)
  })

  it('returns true for a field not in any immutable list regardless of status', () => {
    // Arbitrary field name not in any immutable list
    expect(isFieldMutable('some_unknown_field', 'ENABLED', 5)).toBe(true)
  })
})

describe('IMMUTABLE_WHEN_ENABLED constant', () => {
  it('contains expected scheduling fields', () => {
    expect(IMMUTABLE_WHEN_ENABLED).toContain('base_exam_id')
    expect(IMMUTABLE_WHEN_ENABLED).toContain('exam_type')
    expect(IMMUTABLE_WHEN_ENABLED).toContain('code')
  })
})

describe('IMMUTABLE_WITH_ATTEMPTS constant', () => {
  it('contains exam window and attempt-control fields', () => {
    expect(IMMUTABLE_WITH_ATTEMPTS).toContain('start_datetime')
    expect(IMMUTABLE_WITH_ATTEMPTS).toContain('end_datetime')
    expect(IMMUTABLE_WITH_ATTEMPTS).toContain('allow_single_attempt')
  })
})
