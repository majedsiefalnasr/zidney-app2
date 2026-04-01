/**
 * Scheduled Exam — Time Utilities
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam-time.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 *
 * Pure time-gate functions. All comparisons use server-provided `now` (ADR-0006).
 */

const CONNECTION_TIMEOUT_SECONDS = 30

export function isWindowOpen(windowStart: Date, windowEnd: Date, now?: Date): boolean {
  const t = now ?? new Date()
  return t >= windowStart && t <= windowEnd
}

export function isBeforeWindow(windowStart: Date, now?: Date): boolean {
  const t = now ?? new Date()
  return t < windowStart
}

export function isAfterWindow(windowEnd: Date, now?: Date): boolean {
  const t = now ?? new Date()
  return t > windowEnd
}

export function computeAttemptEndTime(
  windowEnd: Date,
  startedAt: Date,
  durationMinutes?: number | null
): Date {
  if (!durationMinutes) return windowEnd
  const durationEnd = new Date(startedAt.getTime() + durationMinutes * 60 * 1000)
  return durationEnd < windowEnd ? durationEnd : windowEnd
}

export function isAttemptExpired(scheduledEndTime: Date, now?: Date): boolean {
  const t = now ?? new Date()
  return t > scheduledEndTime
}

export function isConnectionTimedOut(lastHeartbeatAt: Date | null, now?: Date): boolean {
  if (!lastHeartbeatAt) return false
  const t = now ?? new Date()
  const diffSeconds = (t.getTime() - lastHeartbeatAt.getTime()) / 1000
  return diffSeconds > CONNECTION_TIMEOUT_SECONDS
}

export function computeRemainingSeconds(scheduledEndTime: Date, now?: Date): number {
  const t = now ?? new Date()
  const diff = Math.floor((scheduledEndTime.getTime() - t.getTime()) / 1000)
  return Math.max(0, diff)
}
