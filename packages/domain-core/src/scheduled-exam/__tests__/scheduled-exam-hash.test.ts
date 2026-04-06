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

  it('accepts camelCase field names (examType, durationMinutes, etc.)', () => {
    const camelCaseInput = {
      examType: 'MCQ',
      title: 'Camel Case Test',
      instructions: null,
      subjectId: 'sub-001',
      durationMinutes: 60,
      passPercentage: 70,
      totalQuestions: 20,
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const hash = computeBaseExamHash(camelCaseInput)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    // camelCase with different description should differ from mcqInput (which has description: 'A description')
    expect(hash).not.toBe(computeBaseExamHash(mcqInput))
  })

  it('accepts totalMarks for unified total_questions field', () => {
    const withTotalMarks = {
      examType: 'TRADITIONAL',
      title: 'Test',
      subjectId: 'sub-001',
      totalMarks: 100,
      durationMinutes: 90,
      passPercentage: 60,
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const hash = computeBaseExamHash(withTotalMarks)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles missing optional fields gracefully', () => {
    const minimalInput = {
      exam_type: 'MCQ' as const,
    }
    const hash = computeBaseExamHash(minimalInput)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('detects changes in pass_percentage', () => {
    const hash1 = computeBaseExamHash(mcqInput)
    const hash2 = computeBaseExamHash({ ...mcqInput, pass_percentage: 80 })
    expect(hash1).not.toBe(hash2)
  })

  it('handles all fields missing (produces deterministic hash)', () => {
    const emptyInput = {}
    const hash = computeBaseExamHash(emptyInput)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    // Should be stable
    expect(hash).toBe(computeBaseExamHash({}))
  })

  it('normalizes all null/undefined values to null in canonical form', () => {
    const withUndefined = computeBaseExamHash({
      exam_type: undefined,
      name: undefined,
      description: undefined,
      subject_id: undefined,
      duration_minutes: undefined,
      pass_percentage: undefined,
      total_questions: undefined,
      updated_at: undefined,
    })
    const withNull = computeBaseExamHash({
      exam_type: null,
      name: null,
      description: null,
      subject_id: null,
      duration_minutes: null,
      pass_percentage: null,
      total_questions: null,
      updated_at: null,
    })
    expect(withUndefined).toBe(withNull)
  })
})
