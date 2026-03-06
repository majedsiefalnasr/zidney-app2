// @ts-expect-error: pinia not declared as dependency of apps/mmc [INFRA-001-DEPS-07]
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  AffiliatesResponse,
  GeographicResponse,
  RevenueBreakdownResponse,
  SummaryResponse,
  TrendsResponse,
} from './api'
import { dashboardClient } from './api'

/**
 * Dashboard Store (Pinia)
 * Centralized state management for MMC dashboard
 * Handles data fetching, caching, and error state
 */
export const useDashboardStore = defineStore('dashboard', () => {
  // State - API Data
  const summary = ref<SummaryResponse | null>(null)
  const revenueBreakdown = ref<RevenueBreakdownResponse | null>(null)
  const geographic = ref<GeographicResponse | null>(null)
  const affiliates = ref<AffiliatesResponse | null>(null)
  const trends = ref<TrendsResponse | null>(null)

  // State - Loading & Error
  const loading = ref({
    summary: false,
    revenueBreakdown: false,
    geographic: false,
    affiliates: false,
    trends: false,
  })

  const errors = ref({
    summary: null as string | null,
    revenueBreakdown: null as string | null,
    geographic: null as string | null,
    affiliates: null as string | null,
    trends: null as string | null,
  })

  // State - Pagination
  const pagination = ref({
    geographic: { page: 1, limit: 50 },
    affiliates: { page: 1, limit: 20 },
  })

  // Computed - Global Loading State
  const isLoading = computed(() => {
    return Object.values(loading.value).some((v) => v === true)
  })

  // Computed - Global Error State
  const hasErrors = computed(() => {
    return Object.values(errors.value).some((v) => v !== null)
  })

  // Computed - Formatted Summary (2-decimal currency)
  const formattedSummary = computed(() => {
    if (!summary.value) return null
    return {
      ...summary.value,
      monthlyRevenue: (summary.value.monthlyRevenue / 100).toFixed(2),
      arpl: (summary.value.arpl / 100).toFixed(2),
    }
  })

  // Computed - Formatted Revenue Breakdown
  const formattedRevenueBreakdown = computed(() => {
    if (!revenueBreakdown.value) return null
    return {
      ...revenueBreakdown.value,
      topProducts: revenueBreakdown.value.topProducts.map((p: any) => ({
        ...p,
        revenue: (p.revenue / 100).toFixed(2),
      })),
      totalRevenue: (revenueBreakdown.value.totalRevenue / 100).toFixed(2),
    }
  })

  // Computed - Formatted Geographic
  const formattedGeographic = computed(() => {
    if (!geographic.value) return null
    return {
      ...geographic.value,
      countries: geographic.value.countries.map((c: any) => ({
        ...c,
        revenue: (c.revenue / 100).toFixed(2),
      })),
      totalRevenue: (geographic.value.totalRevenue / 100).toFixed(2),
    }
  })

  // Computed - Formatted Affiliates
  const formattedAffiliates = computed(() => {
    if (!affiliates.value) return null
    return {
      ...affiliates.value,
      affiliates: affiliates.value.affiliates.map((a: any) => ({
        ...a,
        totalRevenue: (a.totalRevenue / 100).toFixed(2),
      })),
      totalRevenue: (affiliates.value.totalRevenue / 100).toFixed(2),
    }
  })

  // Actions - Fetch Summary
  const fetchSummary = async (forceRefresh = false) => {
    if (loading.value.summary && !forceRefresh) return
    if (summary.value && !forceRefresh) return // Use cached data

    loading.value.summary = true
    errors.value.summary = null

    try {
      summary.value = await dashboardClient.getSummary()
    } catch (error) {
      errors.value.summary = error instanceof Error ? error.message : 'Unknown error'
      // biome-ignore lint/suspicious/noConsole: frontend error boundary
      console.error('Summary fetch error:', error)
    } finally {
      loading.value.summary = false
    }
  }

  // Actions - Fetch Revenue Breakdown
  const fetchRevenueBreakdown = async (forceRefresh = false) => {
    if (loading.value.revenueBreakdown && !forceRefresh) return
    if (revenueBreakdown.value && !forceRefresh) return // No cache for this endpoint

    loading.value.revenueBreakdown = true
    errors.value.revenueBreakdown = null

    try {
      revenueBreakdown.value = await dashboardClient.getRevenueBreakdown()
    } catch (error) {
      errors.value.revenueBreakdown = error instanceof Error ? error.message : 'Unknown error'
      // biome-ignore lint/suspicious/noConsole: frontend error boundary
      console.error('Revenue breakdown fetch error:', error)
    } finally {
      loading.value.revenueBreakdown = false
    }
  }

  // Actions - Fetch Geographic
  const fetchGeographic = async (page = 1, forceRefresh = false) => {
    if (loading.value.geographic && !forceRefresh) return

    loading.value.geographic = true
    errors.value.geographic = null

    try {
      pagination.value.geographic.page = page
      geographic.value = await dashboardClient.getGeographic(
        page,
        pagination.value.geographic.limit
      )
    } catch (error) {
      errors.value.geographic = error instanceof Error ? error.message : 'Unknown error'
      // biome-ignore lint/suspicious/noConsole: frontend error boundary
      console.error('Geographic fetch error:', error)
    } finally {
      loading.value.geographic = false
    }
  }

  // Actions - Fetch Affiliates
  const fetchAffiliates = async (page = 1, forceRefresh = false) => {
    if (loading.value.affiliates && !forceRefresh) return

    loading.value.affiliates = true
    errors.value.affiliates = null

    try {
      pagination.value.affiliates.page = page
      affiliates.value = await dashboardClient.getAffiliates()
    } catch (error) {
      errors.value.affiliates = error instanceof Error ? error.message : 'Unknown error'
      // biome-ignore lint/suspicious/noConsole: frontend error boundary
      console.error('Affiliates fetch error:', error)
    } finally {
      loading.value.affiliates = false
    }
  }

  // Actions - Fetch Trends
  const fetchTrends = async (months = 12, forceRefresh = false) => {
    if (loading.value.trends && !forceRefresh) return
    if (trends.value && !forceRefresh) return // Use cached data (10-min cache on backend)

    loading.value.trends = true
    errors.value.trends = null

    try {
      trends.value = await dashboardClient.getTrends(months)
    } catch (error) {
      errors.value.trends = error instanceof Error ? error.message : 'Unknown error'
      // biome-ignore lint/suspicious/noConsole: frontend error boundary
      console.error('Trends fetch error:', error)
    } finally {
      loading.value.trends = false
    }
  }

  // Actions - Export Data
  const exportData = async (section: string, options: any = {}) => {
    try {
      await dashboardClient.exportData(section as any, options)
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: frontend error boundary
      console.error('Export error:', error)
      throw error
    }
  }

  // Actions - Refresh All Data
  const refreshAll = async () => {
    await Promise.all([
      fetchSummary(true),
      fetchRevenueBreakdown(true),
      fetchGeographic(1, true),
      fetchAffiliates(1, true),
      fetchTrends(12, true),
    ])
  }

  // Actions - Clear All Data
  const clearAll = () => {
    summary.value = null
    revenueBreakdown.value = null
    geographic.value = null
    affiliates.value = null
    trends.value = null

    Object.keys(errors.value).forEach((key) => {
      errors.value[key as keyof typeof errors.value] = null
    })
  }

  // Actions - Paginate Geographic
  const setGeographicPage = (page: number) => {
    return fetchGeographic(page)
  }

  // Actions - Paginate Affiliates
  const setAffiliatesPage = (page: number) => {
    return fetchAffiliates(page)
  }

  // Getters - Get error for specific section
  const getError = (section: string): string | null => {
    return errors.value[section as keyof typeof errors.value] ?? null
  }

  // Getters - Get loading state for specific section
  const isLoading_ = (section: string): boolean => {
    return loading.value[section as keyof typeof loading.value] ?? false
  }

  return {
    // State
    summary,
    revenueBreakdown,
    geographic,
    affiliates,
    trends,
    loading,
    errors,
    pagination,

    // Computed
    isLoading,
    hasErrors,
    formattedSummary,
    formattedRevenueBreakdown,
    formattedGeographic,
    formattedAffiliates,

    // Actions
    fetchSummary,
    fetchRevenueBreakdown,
    fetchGeographic,
    fetchAffiliates,
    fetchTrends,
    exportData,
    refreshAll,
    clearAll,
    setGeographicPage,
    setAffiliatesPage,

    // Getters
    getError,
    isLoading_,
  }
})
