/** @library-module */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveTaskId, generateExecutionId } from '../execution-id'

describe('generateExecutionId', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('produces output matching \\d+-[0-9a-f]{8} format', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'))
    const id = generateExecutionId('implement login feature')
    expect(id).toMatch(/^\d+-[0-9a-f]{8}$/)
  })

  it('hash suffix is deterministic for the same input', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'))
    const id1 = generateExecutionId('implement login feature')
    const id2 = generateExecutionId('implement login feature')
    const suffix1 = id1.split('-')[1]
    const suffix2 = id2.split('-')[1]
    expect(suffix1).toBe(suffix2)
  })

  it('different tasks produce different suffixes', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'))
    const id1 = generateExecutionId('implement login feature')
    const id2 = generateExecutionId('implement logout feature')
    const suffix1 = id1.split('-')[1]
    const suffix2 = id2.split('-')[1]
    expect(suffix1).not.toBe(suffix2)
  })

  it('different Date.now() values produce different prefixes', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'))
    const id1 = generateExecutionId('implement login feature')
    vi.setSystemTime(new Date('2026-03-15T10:00:01.000Z'))
    const id2 = generateExecutionId('implement login feature')
    const prefix1 = id1.split('-')[0]
    const prefix2 = id2.split('-')[0]
    expect(prefix1).not.toBe(prefix2)
  })
})

describe('deriveTaskId', () => {
  it('returns a 16-char hex string', () => {
    const id = deriveTaskId('implement login feature')
    expect(id).toMatch(/^[0-9a-f]{16}$/)
  })

  it('same input always returns the same ID', () => {
    const id1 = deriveTaskId('implement login feature')
    const id2 = deriveTaskId('implement login feature')
    expect(id1).toBe(id2)
  })

  it('different inputs return different IDs', () => {
    const id1 = deriveTaskId('implement login feature')
    const id2 = deriveTaskId('implement logout feature')
    expect(id1).not.toBe(id2)
  })
})
