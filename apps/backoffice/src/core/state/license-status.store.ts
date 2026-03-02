/**
 * License status reactive store for Backoffice.
 * Holds passive flags set by the error interceptor when the API returns
 * 423 (workspace locked) or 426 (upgrade required).
 *
 * INVARIANTS:
 * - FR-SEC-20: isWorkspaceLocked is set on 423 — no retry, no override
 * - FR-SEC-21: isUpgradeRequired is set on 426 — no retry, no override
 * - Flags are NOT persisted to localStorage/sessionStorage (in-memory only)
 * - clearLicenseStatus() resets both flags (e.g. on successful re-authentication)
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLicenseStatusStore = defineStore('licenseStatus', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  /** True when the API returned 423 — workspace is locked */
  const isWorkspaceLocked = ref(false)

  /** True when the API returned 426 — an upgrade is required */
  const isUpgradeRequired = ref(false)

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Set by onLicenseError(423) callback in main.ts error interceptor wiring */
  function setWorkspaceLocked(value: boolean = true): void {
    isWorkspaceLocked.value = value
  }

  /** Set by onLicenseError(426) callback in main.ts error interceptor wiring */
  function setUpgradeRequired(value: boolean = true): void {
    isUpgradeRequired.value = value
  }

  /** Resets both flags — called on re-authentication or page reload */
  function clearLicenseStatus(): void {
    isWorkspaceLocked.value = false
    isUpgradeRequired.value = false
  }

  return {
    // State
    isWorkspaceLocked,
    isUpgradeRequired,
    // Actions
    setWorkspaceLocked,
    setUpgradeRequired,
    clearLicenseStatus,
  }
})
