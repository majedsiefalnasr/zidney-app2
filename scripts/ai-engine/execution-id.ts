/** @library-module */
import { createHash } from 'node:crypto'

/**
 * Generate a unique execution ID: `{timestamp_ms}-{sha256(task).slice(0, 8)}`
 * Deterministic per (timestamp, taskDescription) pair.
 */
export function generateExecutionId(taskDescription: string): string {
  const ts = Date.now()
  const hash = createHash('sha256').update(taskDescription).digest('hex').slice(0, 8)
  return `${ts}-${hash}`
}

/**
 * Derive a stable task_id from task description.
 * Returns the 16-char hex prefix of the SHA-256 hash.
 * Used as the filename for plan documents (deterministic across runs).
 */
export function deriveTaskId(taskDescription: string): string {
  return createHash('sha256').update(taskDescription).digest('hex').slice(0, 16)
}
