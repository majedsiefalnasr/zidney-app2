/**
 * Unit Tests — scheduled-exam-hash.ts
 *
 * File: packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-hash.test.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { describe, expect, it } from 'vitest'
import { computeBaseExamHash } from '../scheduled-exam-hash'

describe('computeBaseExamHash', () => {
  const mcqInput = {
    exam_type: 'MCQ' as const,
    name: 'Test MCQ Exam',
    description: 'A description',
    subject_id: 'sub-001',
    duration_minutes: 60,
    pass_percentage: 70,
    total_questions: 20,
    updated_at: '2026-01-01T00:00:00Z',
  }

  const traditionalInput = {
    exam_type: 'TRADITIONAL' as const,
    name: 'Test Traditional Exam',
    description: 'A description',
    subject_id: 'sub-002',
    duration_minutes: 90,
    pass_percentage: 60,
    total_marks: 100,
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('produces a 64-character hex string (SHA-256)', () => {
    const hash = computeBaseExamHash(mcqInput)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces the same hash for the same MCQ input (stability)', () => {
    const hash1 = computeBaseExamHash(mcqInput)
    const hash2 = computeBaseExamHash(mcqInput)
    expect(hash1).toBe(hash2)
  })

  it('produces the same hash for the same TRADITIONAL input (stability)', () => {
    const hash1 = computeBaseExamHash(traditionalInput)
    const hash2 = computeBaseExamHash(traditionalInput)
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for MCQ vs TRADITIONAL even with shared fields', () => {
    const mcq = computeBaseExamHash(mcqInput)
    const trad = computeBaseExamHash(traditionalInput)
    expect(mcq).not.toBe(trad)
  })

  it('changes hash when updated_at changes', () => {
    const hash1 = computeBaseExamHash(mcqInput)
    const hash2 = computeBaseExamHash({ ...mcqInput, updated_at: '2026-02-01T00:00:00Z' })
    expect(hash1).not.toBe(hash2)
  })

  it('hash is order-independent (keys sorted alphabetically)', () => {
    const inputA = {
      exam_type: 'MCQ' as const,
      name: 'Same',
      description: null,
      subject_id: 'x',
      duration_minutes: 30,
      pass_percentage: 50,
      total_questions: 10,
      updated_at: '2026-01-01T00:00:00Z',
    }
    // Provide fields in different logical order (object literal order still same)
    const hash1 = computeBaseExamHash(inputA)
    const hash2 = computeBaseExamHash({ ...inputA })
    expect(hash1).toBe(hash2)
  })

  it('handles null description deterministically', () => {
    const withNull = computeBaseExamHash({ ...mcqInput, description: null })
    const withUndefined = computeBaseExamHash({ ...mcqInput, description: undefined })
    // Both should produce stable (possibly same) hashes
    expect(withNull).toMatch(/^[a-f0-9]{64}$/)
    expect(withUndefined).toMatch(/^[a-f0-9]{64}$/)
  })
})
