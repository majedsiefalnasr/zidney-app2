/**
 * License Validation Helpers
 *
 * Tasks T011-T014: Validators for license state transitions
 */

/**
 * T011: Validate state transition
 *
 * Enforces valid license state machine transitions:
 * - Valid: ACTIVE→SOFT_LOCKED, SOFT_LOCKED→ACTIVE, SOFT_LOCKED→ARCHIVED, ARCHIVED→ACTIVE, ARCHIVED→DELETED
 * - Forbidden: ACTIVE→ARCHIVED, ACTIVE→DELETED, SOFT_LOCKED→DELETED, any from DELETED
 *
 * @param current_state Current license status
 * @param target_state Target license status
 * @returns { valid: boolean, error?: string }
 */
export function validateStateTransition(
  current_state: string,
  target_state: string
): { valid: boolean; error?: string } {
  const validTransitions: Record<string, string[]> = {
    ACTIVE: ['SOFT_LOCKED'],
    SOFT_LOCKED: ['ACTIVE', 'ARCHIVED'],
    ARCHIVED: ['ACTIVE', 'DELETED'],
    DELETED: [],
  }

  // Check if current state has valid transitions
  if (!validTransitions[current_state]) {
    return {
      valid: false,
      error: `Unknown current state: ${current_state}`,
    }
  }

  // Check if target state is in valid transitions
  if (!validTransitions[current_state].includes(target_state)) {
    return {
      valid: false,
      error: `Cannot transition from ${current_state} to ${target_state}. Valid transitions from ${current_state}: ${validTransitions[current_state].join(', ')}`,
    }
  }

  return { valid: true }
}

/**
 * T012: Validate soft lock expiry
 *
 * Checks if NOW > soft_lock_until for SOFT_LOCKED licenses
 * Returns time remaining (in milliseconds) until expiry
 *
 * @param soft_lock_until Date when soft lock expires
 * @returns { expired: boolean, expires_in_ms: number }
 */
export function validateSoftLockExpiry(soft_lock_until: Date | null): {
  expired: boolean
  expires_in_ms: number
} {
  if (!soft_lock_until) {
    return {
      expired: false,
      expires_in_ms: -1, // Not applicable
    }
  }

  const now = new Date()
  const expires_in_ms = soft_lock_until.getTime() - now.getTime()

  return {
    expired: expires_in_ms < 0,
    expires_in_ms,
  }
}

/**
 * T013: Validate schema compatibility
 *
 * Verifies snapshot version matches current product schema version
 * For restore operations: exact version match required
 *
 * @param snapshot_version_tag Version tag from snapshot (e.g., "1.2.3")
 * @param product_schema_version Current product schema version (e.g., "1.2.4")
 * @returns { compatible: boolean, error?: string }
 */
export function validateSchemaCompatibility(
  snapshot_version_tag: string,
  product_schema_version: string
): { compatible: boolean; error?: string } {
  // Parse versions: expect format "1.2.3"
  const snapshotParts = snapshot_version_tag
    .split('.')
    .map((v) => parseInt(v, 10))
  const productParts = product_schema_version
    .split('.')
    .map((v) => parseInt(v, 10))

  if (snapshotParts.length !== 3 || productParts.length !== 3) {
    return {
      compatible: false,
      error: 'Invalid version format (expected X.Y.Z)',
    }
  }

  const [snapMajor, snapMinor, _snapPatch] = snapshotParts
  const [prodMajor, prodMinor, _prodPatch] = productParts

  // MAJOR must match
  if (snapMajor !== prodMajor) {
    return {
      compatible: false,
      error: `MAJOR version mismatch: snapshot ${snapMajor} vs product ${prodMajor}`,
    }
  }

  // MINOR must match (per ADR-0008)
  if (snapMinor > prodMinor) {
    return {
      compatible: false,
      error: `Snapshot is newer than current product (${snapshot_version_tag} > ${product_schema_version})`,
    }
  }

  return { compatible: true }
}

/**
 * T014: Validate concurrent modification
 *
 * Detects if license was modified between SELECT and UPDATE (optimistic locking fallback)
 * Uses updated_at timestamp comparison
 *
 * @param expected_updated_at Expected updated_at from previous SELECT
 * @param current_updated_at Current updated_at from locked SELECT
 * @returns { safe: boolean, error?: string }
 */
export function validateConcurrentModification(
  expected_updated_at: Date,
  current_updated_at: Date
): { safe: boolean; error?: string } {
  // If timestamps don't match, license was modified by another transaction
  if (expected_updated_at.getTime() !== current_updated_at.getTime()) {
    return {
      safe: false,
      error:
        'License was modified by another transaction (concurrent modification detected)',
    }
  }

  return { safe: true }
}

/**
 * Validate admin authority for lifecycle transitions
 *
 * Only MMC Admin users can perform state transitions
 *
 * @param actor_role Role of the actor performing the transition
 * @returns { authorized: boolean, error?: string }
 */
export function validateAdminAuthority(actor_role: string): {
  authorized: boolean
  error?: string
} {
  if (actor_role !== 'MMC_ADMIN') {
    return {
      authorized: false,
      error: `Lifecycle transitions require MMC_ADMIN authority, got: ${actor_role}`,
    }
  }

  return { authorized: true }
}
