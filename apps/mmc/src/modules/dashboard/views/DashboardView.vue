<template>
  <div class="dashboard-container">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1>MMC Dashboard</h1>
        <p class="subtitle">Multi-tenant analytics and performance metrics</p>
      </div>
      <div class="header-actions">
        <Button
          v-if="!isRefreshing"
          variant="outline"
          @click="refreshData"
          class="refresh-btn"
        >
          <RefreshCw class="w-4 h-4 mr-2" />
          Refresh
        </Button>
        <Button v-else disabled class="refresh-btn">
          <Loader class="w-4 h-4 mr-2 animate-spin" />
          Refreshing...
        </Button>
      </div>
    </div>

    <!-- Error State -->
    <Alert v-if="error" variant="destructive" class="mb-6">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-skeleton-grid">
      <Skeleton class="h-[200px]" />
      <Skeleton class="h-[200px]" />
      <Skeleton class="h-[300px]" />
      <Skeleton class="h-[300px]" />
      <Skeleton class="h-[300px]" />
      <Skeleton class="h-[300px]" />
    </div>

    <!-- Main Dashboard Grid -->
    <div v-else class="dashboard-grid">
      <!-- Row 1: Commercial Health + Revenue Breakdown -->
      <Card class="col-span-full md:col-span-1 lg:col-span-1">
        <CardHeader>
          <CardTitle class="flex items-center">
            <BarChart3 class="w-5 h-5 mr-2 text-blue-600" />
            Commercial Health
          </CardTitle>
          <CardDescription>License status & revenue overview</CardDescription>
        </CardHeader>
        <CardContent>
          <CommercialHealth
            v-if="dashboardData?.summary"
            :data="dashboardData.summary"
          />
          <div v-else class="text-center py-8 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>

      <!-- Row 1: Revenue Breakdown -->
      <Card class="col-span-full md:col-span-1 lg:col-span-1">
        <CardHeader>
          <CardTitle class="flex items-center">
            <TrendingUp class="w-5 h-5 mr-2 text-green-600" />
            Revenue Breakdown
          </CardTitle>
          <CardDescription>Top 5 products by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueBreakdown
            v-if="dashboardData?.revenueBreakdown"
            :data="dashboardData.revenueBreakdown"
          />
          <div v-else class="text-center py-8 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>

      <!-- Row 2: Geographic Distribution -->
      <Card class="col-span-full">
        <CardHeader>
          <CardTitle class="flex items-center">
            <Globe class="w-5 h-5 mr-2 text-purple-600" />
            Geographic Distribution
          </CardTitle>
          <CardDescription>Revenue by country</CardDescription>
        </CardHeader>
        <CardContent>
          <GeographicDistribution
            v-if="dashboardData?.geographic"
            :data="dashboardData.geographic"
          />
          <div v-else class="text-center py-8 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>

      <!-- Row 3: Affiliate Leaderboard + Growth Trends -->
      <Card class="col-span-full md:col-span-1 lg:col-span-1">
        <CardHeader>
          <CardTitle class="flex items-center">
            <Award class="w-5 h-5 mr-2 text-amber-600" />
            Affiliate Leaderboard
          </CardTitle>
          <CardDescription>Top performing affiliates</CardDescription>
        </CardHeader>
        <CardContent>
          <AffiliateLeaderboard
            v-if="dashboardData?.affiliates"
            :data="dashboardData.affiliates"
          />
          <div v-else class="text-center py-8 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>

      <!-- Row 3: Growth Trends -->
      <Card class="col-span-full md:col-span-1 lg:col-span-1">
        <CardHeader>
          <CardTitle class="flex items-center">
            <LineChart class="w-5 h-5 mr-2 text-indigo-600" />
            Growth Trends
          </CardTitle>
          <CardDescription>12-month revenue & license trends</CardDescription>
        </CardHeader>
        <CardContent>
          <GrowthTrends
            v-if="dashboardData?.trends"
            :data="dashboardData.trends"
          />
          <div v-else class="text-center py-8 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>

      <!-- Row 4: Data Export -->
      <Card class="col-span-full">
        <CardHeader>
          <CardTitle class="flex items-center">
            <Download class="w-5 h-5 mr-2 text-cyan-600" />
            Data Export
          </CardTitle>
          <CardDescription>Download dashboard data as CSV</CardDescription>
        </CardHeader>
        <CardContent>
          <DataExport @export="handleExport" />
        </CardContent>
      </Card>
    </div>

    <!-- Last Updated Footer -->
    <div
      v-if="lastUpdated && !isLoading"
      class="mt-6 text-center text-sm text-muted-foreground"
    >
      Last updated: {{ formatTime(lastUpdated) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircle,
  Award,
  BarChart3,
  Download,
  Globe,
  LineChart,
  Loader,
  RefreshCw,
  TrendingUp,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { dashboardClient } from '@/api/dashboard-client'
import AffiliateLeaderboard from '@/components/Dashboard/AffiliateLeaderboard.vue'
import CommercialHealth from '@/components/Dashboard/CommercialHealth.vue'
import DataExport from '@/components/Dashboard/DataExport.vue'
import GeographicDistribution from '@/components/Dashboard/GeographicDistribution.vue'
import GrowthTrends from '@/components/Dashboard/GrowthTrends.vue'
import RevenueBreakdown from '@/components/Dashboard/RevenueBreakdown.vue'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui'
import { useDashboardStore } from '@/stores/dashboard-store'

void [
  AlertCircle,
  Award,
  BarChart3,
  Download,
  Globe,
  LineChart,
  Loader,
  RefreshCw,
  TrendingUp,
  AffiliateLeaderboard,
  CommercialHealth,
  DataExport,
  GeographicDistribution,
  GrowthTrends,
  RevenueBreakdown,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
]

// Store
const dashboardStore = useDashboardStore()

// State
const isLoading = ref(false)
const isRefreshing = ref(false)
const error = ref<string | null>(null)
const lastUpdated = ref<Date | null>(null)

// Computed
const dashboardData = computed(() => ({
  summary: dashboardStore.summary,
  revenueBreakdown: dashboardStore.revenueBreakdown,
  geographic: dashboardStore.geographic,
  affiliates: dashboardStore.affiliates,
  trends: dashboardStore.trends,
}))

// Methods
const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const loadDashboardData = async () => {
  isLoading.value = true
  error.value = null

  try {
    // Load all dashboard data in parallel
    await Promise.all([
      dashboardStore.fetchSummary(),
      dashboardStore.fetchRevenueBreakdown(),
      dashboardStore.fetchGeographic(),
      dashboardStore.fetchAffiliates(),
      dashboardStore.fetchTrends(),
    ])

    lastUpdated.value = new Date()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load dashboard data'
    // biome-ignore lint/suspicious/noConsole: frontend error boundary
    console.error('Dashboard load error:', err)
  } finally {
    isLoading.value = false
  }
}

const refreshData = async () => {
  isRefreshing.value = true
  error.value = null

  try {
    // Refresh all data
    await Promise.all([
      dashboardStore.fetchSummary(),
      dashboardStore.fetchRevenueBreakdown(),
      dashboardStore.fetchGeographic(),
      dashboardStore.fetchAffiliates(),
      dashboardStore.fetchTrends(),
    ])

    lastUpdated.value = new Date()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to refresh dashboard data'
    // biome-ignore lint/suspicious/noConsole: frontend error boundary
    console.error('Dashboard refresh error:', err)
  } finally {
    isRefreshing.value = false
  }
}

const handleExport = async (section: string) => {
  try {
    await dashboardClient.exportData(section, {})
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Export failed'
    // biome-ignore lint/suspicious/noConsole: frontend error boundary
    console.error('Export error:', err)
  }
}

void [
  AlertCircle,
  Award,
  BarChart3,
  Download,
  Globe,
  LineChart,
  Loader,
  RefreshCw,
  TrendingUp,
  AffiliateLeaderboard,
  CommercialHealth,
  DataExport,
  GeographicDistribution,
  GrowthTrends,
  RevenueBreakdown,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  dashboardData,
  formatTime,
  refreshData,
  handleExport,
]

// Lifecycle
onMounted(async () => {
  await loadDashboardData()
})
</script>

<style scoped>
.dashboard-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

.header-content h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  margin-bottom: 0.25rem;
}

.header-content .subtitle {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 1.5rem;
}

.loading-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .dashboard-grid,
  .loading-skeleton-grid {
    grid-template-columns: 1fr;
  }
}
</style>
