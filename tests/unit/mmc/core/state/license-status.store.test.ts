/**
 * Unit tests for apps/mmc/src/core/state/license-status.store.ts
 * Covers FR-SEC-20/21: 423/426 state management.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T049
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLicenseStatusStore } from '../../../../../apps/mmc/src/core/state/license-status.store'

describe('useLicenseStatusStore (mmc)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  it('initializes isWorkspaceLocked as false', () => {
    const store = useLicenseStatusStore()
    expect(store.isWorkspaceLocked).toBe(false)
  })

  it('initializes isUpgradeRequired as false', () => {
    const store = useLicenseStatusStore()
    expect(store.isUpgradeRequired).toBe(false)
  })

  // ── setWorkspaceLocked ─────────────────────────────────────────────────────

  it('setWorkspaceLocked(true) sets isWorkspaceLocked to true', () => {
    const store = useLicenseStatusStore()
    store.setWorkspaceLocked(true)
    expect(store.isWorkspaceLocked).toBe(true)
  })

  it('setWorkspaceLocked(false) sets isWorkspaceLocked to false', () => {
    const store = useLicenseStatusStore()
    store.setWorkspaceLocked(true)
    store.setWorkspaceLocked(false)
    expect(store.isWorkspaceLocked).toBe(false)
  })

  // ── setUpgradeRequired ────────────────────────────────────────────────────

  it('setUpgradeRequired(true) sets isUpgradeRequired to true', () => {
    const store = useLicenseStatusStore()
    store.setUpgradeRequired(true)
    expect(store.isUpgradeRequired).toBe(true)
  })

  it('setUpgradeRequired(false) sets isUpgradeRequired to false', () => {
    const store = useLicenseStatusStore()
    store.setUpgradeRequired(true)
    store.setUpgradeRequired(false)
    expect(store.isUpgradeRequired).toBe(false)
  })

  // ── clearLicenseStatus ────────────────────────────────────────────────────

  it('clearLicenseStatus() resets both flags to false', () => {
    const store = useLicenseStatusStore()
    store.setWorkspaceLocked(true)
    store.setUpgradeRequired(true)
    store.clearLicenseStatus()
    expect(store.isWorkspaceLocked).toBe(false)
    expect(store.isUpgradeRequired).toBe(false)
  })

  it('clearLicenseStatus() is a no-op when both flags are already false', () => {
    const store = useLicenseStatusStore()
    store.clearLicenseStatus()
    expect(store.isWorkspaceLocked).toBe(false)
    expect(store.isUpgradeRequired).toBe(false)
  })

  // ── Independence ──────────────────────────────────────────────────────────

  it('setWorkspaceLocked does not affect isUpgradeRequired', () => {
    const store = useLicenseStatusStore()
    store.setWorkspaceLocked(true)
    expect(store.isUpgradeRequired).toBe(false)
  })

  it('setUpgradeRequired does not affect isWorkspaceLocked', () => {
    const store = useLicenseStatusStore()
    store.setUpgradeRequired(true)
    expect(store.isWorkspaceLocked).toBe(false)
  })
})
