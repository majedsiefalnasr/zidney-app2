/**
 * State Machine
 *
 * File: packages/domain-core/src/license/state-machine.ts
 * Task: T006 – Create State Machine (Domain-Core)
 *
 * Validates allowed state transitions.
 * Generates idempotency keys for transitions.
 *
 * Allowed Transitions:
 * ACTIVE → SOFT_LOCKED (payment failure)
 * ACTIVE → ARCHIVED (manual, should not happen)
 * SOFT_LOCKED → ACTIVE (renewal)
 * SOFT_LOCKED → ARCHIVED (auto-expiry OR manual)
 * ARCHIVED → ACTIVE (manual restore)
 * ARCHIVED → DELETED (manual confirmation)
 * DELETED → (terminal; no transitions)
 */

import { LicenseStatus } from './types'

export { LicenseStatus } from './types'

/**
 * StateTransition class
 *
 * Responsibility:
 * - Validate allowed transitions
 * - Generate idempotency keys
 * - Prevent invalid state changes
 */
export class StateTransition {
  /**
   * Validate if transition is allowed
   *
   * @param from - Current status
   * @param to - Target status
   * @returns true if transition is valid, false otherwise
   *
   * Valid transitions:
   * - ACTIVE → SOFT_LOCKED ✓
   * - ACTIVE → ARCHIVED ✓
   * - SOFT_LOCKED → ACTIVE ✓
   * - SOFT_LOCKED → ARCHIVED ✓
   * - ARCHIVED → ACTIVE ✓
   * - ARCHIVED → DELETED ✓
   * - DELETED → (none) ✗
   *
   * Invalid transitions:
   * - ACTIVE → ACTIVE ✗
   * - ACTIVE → DELETED ✗
   * - SOFT_LOCKED → SOFT_LOCKED ✗
   * - SOFT_LOCKED → DELETED ✗
   * - ARCHIVED → ARCHIVED ✗
   * - ARCHIVED → SOFT_LOCKED ✗
   * - DELETED → ACTIVE ✗
   * - DELETED → SOFT_LOCKED ✗
   * - DELETED → ARCHIVED ✗
   * - DELETED → DELETED ✗
   */
  isValidTransition(from: LicenseStatus, to: LicenseStatus): boolean {
    if (from === to) {
      return false // No same-state transitions
    }

    switch (from) {
      case LicenseStatus.ACTIVE:
        return to === LicenseStatus.SOFT_LOCKED || to === LicenseStatus.ARCHIVED

      case LicenseStatus.SOFT_LOCKED:
        return to === LicenseStatus.ACTIVE || to === LicenseStatus.ARCHIVED

      case LicenseStatus.ARCHIVED:
        return to === LicenseStatus.ACTIVE || to === LicenseStatus.DELETED

      case LicenseStatus.DELETED:
        return false // Terminal state

      default:
        return false
    }
  }

  /**
   * Return all valid target states for a given current state.
   */
  getValidTransitions(from: LicenseStatus): LicenseStatus[] {
    switch (from) {
      case LicenseStatus.ACTIVE:
        return [LicenseStatus.SOFT_LOCKED, LicenseStatus.ARCHIVED]
      case LicenseStatus.SOFT_LOCKED:
        return [LicenseStatus.ACTIVE, LicenseStatus.ARCHIVED]
      case LicenseStatus.ARCHIVED:
        return [LicenseStatus.ACTIVE, LicenseStatus.DELETED]
      case LicenseStatus.DELETED:
      default:
        return []
    }
  }

  /**
   * Generate idempotency key for transition
   *
   * Format: {license_id}_{target_state}
   * Used for Redis cache deduplication (24-hour TTL, clarification Q2)
   *
   * @param license_id - License UUID
   * @param target_state - Target LicenseStatus
   * @returns Idempotency key string
   */
  getIdempotencyKey(license_id: string, target_state: string): string {
    return `${license_id}_${target_state}`
  }
}
