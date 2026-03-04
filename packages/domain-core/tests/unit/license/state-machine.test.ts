import { beforeEach, describe, expect, it } from 'vitest'
import { LicenseStatus, StateTransition } from '../../src/license/state-machine'

/**
 * Test: License State Machine (T035)
 *
 * Unit tests for state transition validation.
 * Covers: valid transitions, invalid transitions, edge cases.
 */

describe('StateTransition', () => {
  let stateMachine: StateTransition

  beforeEach(() => {
    stateMachine = new StateTransition()
  })

  // From TEST_INDEX.md: 16 tests for state machine

  // Valid transitions (6 tests)
  it('T035.1: ACTIVE → SOFT_LOCKED is valid', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ACTIVE,
      LicenseStatus.SOFT_LOCKED
    )
    expect(result).toBe(true)
  })

  it('T035.2: SOFT_LOCKED → ACTIVE is valid (renewal)', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.SOFT_LOCKED,
      LicenseStatus.ACTIVE
    )
    expect(result).toBe(true)
  })

  it('T035.3: SOFT_LOCKED → ARCHIVED is valid (expiry)', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.SOFT_LOCKED,
      LicenseStatus.ARCHIVED
    )
    expect(result).toBe(true)
  })

  it('T035.4: ARCHIVED → DELETED is valid', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ARCHIVED,
      LicenseStatus.DELETED
    )
    expect(result).toBe(true)
  })

  it('T035.5: ACTIVE → ARCHIVED is valid (direct archive)', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ACTIVE,
      LicenseStatus.ARCHIVED
    )
    expect(result).toBe(true)
  })

  it('T035.6: Any state → DELETED via archive is valid', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ACTIVE,
      LicenseStatus.DELETED
    )
    // Direct transition not valid; must go through ARCHIVED first
    expect(result).toBe(false)
  })

  // Invalid transitions (10 tests)
  it('T035.7: ACTIVE → ACTIVE is invalid', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ACTIVE,
      LicenseStatus.ACTIVE
    )
    expect(result).toBe(false)
  })

  it('T035.8: SOFT_LOCKED → SOFT_LOCKED is invalid', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.SOFT_LOCKED,
      LicenseStatus.SOFT_LOCKED
    )
    expect(result).toBe(false)
  })

  it('T035.9: ARCHIVED → ACTIVE is valid (manual restore)', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ARCHIVED,
      LicenseStatus.ACTIVE
    )
    expect(result).toBe(true)
  })

  it('T035.10: DELETED → anything is invalid', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.DELETED,
      LicenseStatus.ACTIVE
    )
    expect(result).toBe(false)
  })

  it('T035.11: ARCHIVED → ARCHIVED is invalid', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ARCHIVED,
      LicenseStatus.ARCHIVED
    )
    expect(result).toBe(false)
  })

  it('T035.12: ACTIVE → DELETED is invalid (must archive first)', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ACTIVE,
      LicenseStatus.DELETED
    )
    expect(result).toBe(false)
  })

  it('T035.13: Invalid state returns false', () => {
    const result = stateMachine.isValidTransition(
      'INVALID' as any,
      LicenseStatus.ACTIVE
    )
    expect(result).toBe(false)
  })

  it('T035.14: Unrecognized target state returns false', () => {
    const result = stateMachine.isValidTransition(
      LicenseStatus.ACTIVE,
      'UNKNOWN' as any
    )
    expect(result).toBe(false)
  })

  it('T035.15: Should return valid transition keys', () => {
    const keys = stateMachine.getValidTransitions(LicenseStatus.ACTIVE)
    expect(keys).toContain(LicenseStatus.SOFT_LOCKED)
    expect(keys).toContain(LicenseStatus.ARCHIVED)
    expect(keys).not.toContain(LicenseStatus.ACTIVE)
  })

  it('T035.16: DELETED state has no valid transitions', () => {
    const keys = stateMachine.getValidTransitions(LicenseStatus.DELETED)
    expect(keys.length).toBe(0)
  })
})
