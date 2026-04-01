/**
 * Unit Tests — scheduled-exam-time.ts
 *
 * File: packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-time.test.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { describe, expect, it } from 'vitest'
import {
  computeAttemptEndTime,
  computeRemainingSeconds,
  isAfterWindow,
  isAttemptExpired,
  isBeforeWindow,
  isConnectionTimedOut,
  isWindowOpen,
} from '../scheduled-exam-time'

describe('isWindowOpen', () => {
  it('returns true when current time is within the window', () => {
    const now = new Date('2026-06-15T10:00:00Z')
    const start = new Date('2026-06-15T09:00:00Z')
    const end = new Date('2026-06-15T11:00:00Z')
    const toleranceMins = 0
    expect(isWindowOpen(now, start, end, toleranceMins)).toBe(true)
  })

  it('returns false when current time is before window start minus tolerance', () => {
    const now = new Date('2026-06-15T08:00:00Z')
    const start = new Date('2026-06-15T09:00:00Z')
    const end = new Date('2026-06-15T11:00:00Z')
    expect(isWindowOpen(now, start, end, 0)).toBe(false)
  })

  it('returns false when current time is after window end', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    const start = new Date('2026-06-15T09:00:00Z')
    const end = new Date('2026-06-15T11:00:00Z')
    expect(isWindowOpen(now, start, end, 0)).toBe(false)
  })

  it('applies late tolerance correctly (student can start 5 mins before window)', () => {
    const now = new Date('2026-06-15T08:56:00Z') // 4 mins before start
    const start = new Date('2026-06-15T09:00:00Z')
    const end = new Date('2026-06-15T11:00:00Z')
    expect(isWindowOpen(now, start, end, 5)).toBe(true)
  })

  it('returns false when tolerance does not reach current time', () => {
    const now = new Date('2026-06-15T08:50:00Z') // 10 mins before start, tolerance 5
    const start = new Date('2026-06-15T09:00:00Z')
    const end = new Date('2026-06-15T11:00:00Z')
    expect(isWindowOpen(now, start, end, 5)).toBe(false)
  })
})

describe('isBeforeWindow', () => {
  it('returns true when now is before (start - tolerance)', () => {
    const now = new Date('2026-06-15T08:50:00Z')
    const start = new Date('2026-06-15T09:00:00Z')
    expect(isBeforeWindow(now, start, 5)).toBe(true)
  })

  it('returns false when now is within tolerance', () => {
    const now = new Date('2026-06-15T08:58:00Z')
    const start = new Date('2026-06-15T09:00:00Z')
    expect(isBeforeWindow(now, start, 5)).toBe(false)
  })

  it('returns false when now is after start', () => {
    const now = new Date('2026-06-15T09:30:00Z')
    const start = new Date('2026-06-15T09:00:00Z')
    expect(isBeforeWindow(now, start, 0)).toBe(false)
  })
})

describe('isAfterWindow', () => {
  it('returns true when now is after end', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    const end = new Date('2026-06-15T11:00:00Z')
    expect(isAfterWindow(now, end)).toBe(true)
  })

  it('returns false when now is before end', () => {
    const now = new Date('2026-06-15T10:00:00Z')
    const end = new Date('2026-06-15T11:00:00Z')
    expect(isAfterWindow(now, end)).toBe(false)
  })

  it('returns false at exact boundary (end === now)', () => {
    const now = new Date('2026-06-15T11:00:00Z')
    const end = new Date('2026-06-15T11:00:00Z')
    // At exactly the end time window is still open (not yet after)
    expect(isAfterWindow(now, end)).toBe(false)
  })
})

describe('computeAttemptEndTime', () => {
  it('returns schedule end if no duration (unbounded attempt)', () => {
    const start = new Date('2026-06-15T09:00:00Z')
    const schedEnd = new Date('2026-06-15T11:00:00Z')
    const result = computeAttemptEndTime(start, schedEnd, null)
    expect(result.getTime()).toBe(schedEnd.getTime())
  })

  it('returns start + duration when duration ends before schedule end', () => {
    const start = new Date('2026-06-15T09:00:00Z')
    const schedEnd = new Date('2026-06-15T11:00:00Z')
    const durationMins = 30
    const result = computeAttemptEndTime(start, schedEnd, durationMins)
    const expected = new Date('2026-06-15T09:30:00Z')
    expect(result.getTime()).toBe(expected.getTime())
  })

  it('returns schedule end when duration would exceed it (MIN logic)', () => {
    const start = new Date('2026-06-15T09:00:00Z')
    const schedEnd = new Date('2026-06-15T11:00:00Z')
    const durationMins = 180 // 3 hours — exceeds window
    const result = computeAttemptEndTime(start, schedEnd, durationMins)
    expect(result.getTime()).toBe(schedEnd.getTime())
  })
})

describe('isAttemptExpired', () => {
  it('returns true when attempt_end_time is in the past', () => {
    const now = new Date('2026-06-15T10:30:00Z')
    const attemptEnd = new Date('2026-06-15T10:00:00Z')
    expect(isAttemptExpired(now, attemptEnd)).toBe(true)
  })

  it('returns false when attempt_end_time is in the future', () => {
    const now = new Date('2026-06-15T09:30:00Z')
    const attemptEnd = new Date('2026-06-15T10:00:00Z')
    expect(isAttemptExpired(now, attemptEnd)).toBe(false)
  })
})

describe('isConnectionTimedOut', () => {
  it('returns true when last_heartbeat_at is more than 30s ago', () => {
    const now = new Date('2026-06-15T10:00:35Z')
    const lastPing = new Date('2026-06-15T10:00:00Z')
    expect(isConnectionTimedOut(now, lastPing)).toBe(true)
  })

  it('returns false when last_heartbeat_at is 25s ago', () => {
    const now = new Date('2026-06-15T10:00:25Z')
    const lastPing = new Date('2026-06-15T10:00:00Z')
    expect(isConnectionTimedOut(now, lastPing)).toBe(false)
  })
})

describe('computeRemainingSeconds', () => {
  it('returns positive seconds when attempt_end is in the future', () => {
    const now = new Date('2026-06-15T10:00:00Z')
    const end = new Date('2026-06-15T10:01:00Z')
    expect(computeRemainingSeconds(now, end)).toBe(60)
  })

  it('returns 0 when attempt_end is in the past (never negative)', () => {
    const now = new Date('2026-06-15T10:05:00Z')
    const end = new Date('2026-06-15T10:00:00Z')
    expect(computeRemainingSeconds(now, end)).toBe(0)
  })

  it('returns 0 exactly at the boundary', () => {
    const now = new Date('2026-06-15T10:00:00Z')
    const end = new Date('2026-06-15T10:00:00Z')
    expect(computeRemainingSeconds(now, end)).toBe(0)
  })
})
