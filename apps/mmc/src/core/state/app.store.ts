/**
 * MMC Application Store
 * Manages global app layout preferences: sidebar, theme, locale.
 * Persists: sidebarCollapsed, theme, locale (pinia-plugin-persistedstate).
 *
 * NOTE (CR-M2): This store is synchronous-only. No isLoading, error, or clearError.
 * Dead state for a synchronous store must not be added.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

type Theme = 'light' | 'dark' | 'system'

export const useMmcAppStore = defineStore(
  'mmc-app',
  () => {
    // ── State ──────────────────────────────────────────────────────────────
    const sidebarCollapsed = ref<boolean>(false)
    const theme = ref<Theme>('system')
    const locale = ref<string>('en')

    // ── Actions ────────────────────────────────────────────────────────────
    function setSidebarCollapsed(value: boolean): void {
      sidebarCollapsed.value = value
    }

    function setTheme(value: Theme): void {
      theme.value = value
    }

    function setLocale(value: string): void {
      locale.value = value
    }

    function $reset(): void {
      sidebarCollapsed.value = false
      theme.value = 'system'
      locale.value = 'en'
    }

    return {
      sidebarCollapsed,
      theme,
      locale,
      setSidebarCollapsed,
      setTheme,
      setLocale,
      $reset,
    }
  },
  {
    persist: {
      pick: ['sidebarCollapsed', 'theme', 'locale'],
    },
  }
)

// ── HMR (development only) ────────────────────────────────────────────────────
import { acceptHMRUpdate } from 'pinia'
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMmcAppStore, import.meta.hot))
}
