/**
 * Scheduled Exam — Time Utilities
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam-time.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 *
 * Pure time-gate functions. All comparisons use server-provided `now` (ADR-0006).
 */

const CONNECTION_TIMEOUT_SECONDS = 30

// Note: tests call these helpers with `now` as the first argument for deterministic behavior.
export function isWindowOpen(
  now: Date,
  windowStart: Date,
  windowEnd: Date,
  toleranceMinutes = 0
): boolean {
  const t = now ?? new Date()
  const toleranceMs = (toleranceMinutes ?? 0) * 60 * 1000
  return t >= new Date(windowStart.getTime() - toleranceMs) && t <= windowEnd
}

export function isBeforeWindow(now: Date, windowStart: Date, toleranceMinutes = 0): boolean {
  const t = now ?? new Date()
  const toleranceMs = (toleranceMinutes ?? 0) * 60 * 1000
  return t < new Date(windowStart.getTime() - toleranceMs)
}

export function isAfterWindow(now: Date, windowEnd: Date): boolean {
  const t = now ?? new Date()
  return t > windowEnd
}

export function computeAttemptEndTime(
  startedAt: Date,
  windowEnd: Date,
  durationMinutes?: number | null
): Date {
  if (!durationMinutes) return windowEnd
  const durationEnd = new Date(startedAt.getTime() + (durationMinutes ?? 0) * 60 * 1000)
  return durationEnd < windowEnd ? durationEnd : windowEnd
}

export function isAttemptExpired(now: Date, scheduledEndTime: Date): boolean {
  const t = now ?? new Date()
  return t > scheduledEndTime
}

export function isConnectionTimedOut(now: Date, lastHeartbeatAt: Date | null): boolean {
  if (!lastHeartbeatAt) return false
  const t = now ?? new Date()
  const diffSeconds = (t.getTime() - lastHeartbeatAt.getTime()) / 1000
  return diffSeconds > CONNECTION_TIMEOUT_SECONDS
}

export function computeRemainingSeconds(now: Date, scheduledEndTime: Date): number {
  const t = now ?? new Date()
  const diff = Math.floor((scheduledEndTime.getTime() - t.getTime()) / 1000)
  return Math.max(0, diff)
}
