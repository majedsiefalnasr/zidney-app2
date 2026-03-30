/**
 * MCQ Questions — Dependency Registry Unit Tests
 *
 * File: packages/domain-core/src/mcq-questions/__tests__/dependency-registry.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T037
 *
 * Tests checker registration, result aggregation, active attempt priority,
 * and empty registry default.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

// We need fresh module state per test to avoid polluted checker arrays.
// Use dynamic import via vi.importActual and reset between tests.

const QUESTION_ID = '11111111-1111-1111-1111-111111111111'

function makeDb() {
  return {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  }
}

describe('dependency-registry', () => {
  // Force fresh module state for each test, since the checkers array is module-scoped
  afterEach(() => {
    vi.resetModules()
  })

  it('returns no references when no checkers are registered', async () => {
    const { checkQuestionReferences } = await import('../mcq-questions.dependency-registry')
    const db = makeDb()
    const result = await checkQuestionReferences(db as any, QUESTION_ID)
    expect(result).toEqual({ hasReferences: false, isActiveAttempt: false })
  })

  it('registers a checker and invokes it during reference check', async () => {
    const { registerQuestionReferenceChecker, checkQuestionReferences } = await import(
      '../mcq-questions.dependency-registry'
    )
    const db = makeDb()

    const checker = vi.fn(async () => ({
      hasReferences: true,
      isActiveAttempt: false,
    }))

    registerQuestionReferenceChecker(checker)
    const result = await checkQuestionReferences(db as any, QUESTION_ID)

    expect(checker).toHaveBeenCalledWith(db, QUESTION_ID)
    expect(result.hasReferences).toBe(true)
    expect(result.isActiveAttempt).toBe(false)
  })

  it('aggregates results from multiple checkers', async () => {
    const { registerQuestionReferenceChecker, checkQuestionReferences } = await import(
      '../mcq-questions.dependency-registry'
    )
    const db = makeDb()

    const checker1 = vi.fn(async () => ({
      hasReferences: false,
      isActiveAttempt: false,
    }))
    const checker2 = vi.fn(async () => ({
      hasReferences: true,
      isActiveAttempt: false,
    }))

    registerQuestionReferenceChecker(checker1)
    registerQuestionReferenceChecker(checker2)
    const result = await checkQuestionReferences(db as any, QUESTION_ID)

    expect(checker1).toHaveBeenCalled()
    expect(checker2).toHaveBeenCalled()
    expect(result.hasReferences).toBe(true)
    expect(result.isActiveAttempt).toBe(false)
  })

  it('short-circuits on active attempt (stops processing remaining checkers)', async () => {
    const { registerQuestionReferenceChecker, checkQuestionReferences } = await import(
      '../mcq-questions.dependency-registry'
    )
    const db = makeDb()

    const checkerActive = vi.fn(async () => ({
      hasReferences: true,
      isActiveAttempt: true,
    }))
    const checkerNeverCalled = vi.fn(async () => ({
      hasReferences: false,
      isActiveAttempt: false,
    }))

    registerQuestionReferenceChecker(checkerActive)
    registerQuestionReferenceChecker(checkerNeverCalled)
    const result = await checkQuestionReferences(db as any, QUESTION_ID)

    expect(checkerActive).toHaveBeenCalled()
    expect(checkerNeverCalled).not.toHaveBeenCalled()
    expect(result).toEqual({ hasReferences: true, isActiveAttempt: true })
  })

  it('returns hasReferences=true on first positive checker even if later checkers differ', async () => {
    const { registerQuestionReferenceChecker, checkQuestionReferences } = await import(
      '../mcq-questions.dependency-registry'
    )
    const db = makeDb()

    const checker1 = vi.fn(async () => ({
      hasReferences: true,
      isActiveAttempt: false,
    }))
    // This checker would say "no references" but should not override the first result
    const checker2 = vi.fn(async () => ({
      hasReferences: false,
      isActiveAttempt: false,
    }))

    registerQuestionReferenceChecker(checker1)
    registerQuestionReferenceChecker(checker2)
    const result = await checkQuestionReferences(db as any, QUESTION_ID)

    // First checker found references → short-circuits
    expect(result.hasReferences).toBe(true)
    expect(result.isActiveAttempt).toBe(false)
  })

  it('passes db and questionId to each checker', async () => {
    const { registerQuestionReferenceChecker, checkQuestionReferences } = await import(
      '../mcq-questions.dependency-registry'
    )
    const db = makeDb()

    const checker = vi.fn(async () => ({
      hasReferences: false,
      isActiveAttempt: false,
    }))

    registerQuestionReferenceChecker(checker)
    await checkQuestionReferences(db as any, QUESTION_ID)

    expect(checker).toHaveBeenCalledWith(db, QUESTION_ID)
  })
})
