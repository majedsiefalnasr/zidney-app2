/**
 * Job Hash Computation - Deterministic payload hashing for integrity verification.
 *
 * Per clarification Q5: Payload hash computed at enqueue time, verified at dequeue.
 * Hash mismatch indicates configuration mutation (payload changed between enqueue and dequeue).
 * Hashing is non-blocking and deterministic (same payload → same hash always).
 *
 * Implementation:
 * - Algorithm: SHA256
 * - Input: Job payload (JSON stringified with sorted keys)
 * - Output: Hex string (64 characters)
 * - Determinism: JSON.stringify with sorted keys ensures consistency
 */

import { createHash } from 'node:crypto'

/**
 * Compute deterministic SHA256 hash of job payload.
 *
 * Hashing process:
 * 1. JSON stringify payload with sorted keys (ensures determinism)
 * 2. Compute SHA256 hash of JSON string
 * 3. Return hex-encoded hash
 *
 * Determinism guarantee:
 * - Same payload always produces same hash
 * - Order of object keys does not affect hash
 * - No random elements in computation
 *
 * Performance:
 * - Typically < 5ms for typical job payloads
 * - Non-blocking (sync operation, small input)
 *
 * @param payload - Job payload object to hash
 * @returns SHA256 hash as hex string (64 characters)
 * @throws Error if payload cannot be stringified (e.g., circular references)
 */
export function computeJobPayloadHash(payload: unknown): string {
  try {
    // Use a stable stringify that sorts object keys to guarantee
    // deterministic output regardless of key insertion order.
    const stableStringify = (value: unknown): string => {
      return JSON.stringify(value, (_key, val) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          // Preserve non-null object but reorder keys
          const obj = val as Record<string, unknown>
          const sortedKeys = Object.keys(obj).sort()
          const sorted: Record<string, unknown> = {}
          for (const k of sortedKeys) sorted[k] = obj[k]
          return sorted
        }
        return val
      })
    }

    const jsonString = stableStringify(payload)

    // Compute SHA256 hash
    const hash = createHash('sha256').update(jsonString).digest('hex')

    return hash
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to compute job payload hash: ${error.message}`)
    }
    throw error
  }
}

/**
 * Verify that payload hash matches expected value.
 *
 * Used during job dequeue to detect configuration mutations.
 * If hashes differ, payload was modified after enqueue (logged but non-blocking per Q5).
 *
 * @param payload - Current job payload
 * @param expectedHash - Hash computed at enqueue time
 * @returns true if hashes match, false if mutation detected
 */
export function verifyPayloadHashConsistency(payload: unknown, expectedHash: string): boolean {
  try {
    const currentHash = computeJobPayloadHash(payload)
    return currentHash === expectedHash
  } catch {
    // If hash computation fails, treat as mismatch
    return false
  }
}

/**
 * Get hash mismatch details (for logging/debugging).
 *
 * @param payload - Current job payload
 * @param expectedHash - Hash computed at enqueue time
 * @returns Object with both hashes (for comparison logging)
 */
export function getHashMismatchDetails(payload: unknown, expectedHash: string) {
  try {
    const currentHash = computeJobPayloadHash(payload)
    return {
      matchesExpected: currentHash === expectedHash,
      expectedHash,
      currentHash,
      payloadChanged: currentHash !== expectedHash,
    }
  } catch (error) {
    return {
      matchesExpected: false,
      expectedHash,
      currentHash: null,
      error: error instanceof Error ? error.message : String(error),
      payloadChanged: true,
    }
  }
}
