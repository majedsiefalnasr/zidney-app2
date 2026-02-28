<template>
  <div class="affiliate-leaderboard">
    <!-- Controls -->
    <div class="controls">
      <Input
        v-model="searchQuery"
        type="search"
        placeholder="Search affiliates..."
        class="search-input"
      />
      <Select v-model="sortBy">
        <SelectTrigger class="sort-select">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="revenue">Revenue (High to Low)</SelectItem>
          <SelectItem value="licenses">Licenses Referred</SelectItem>
          <SelectItem value="growth">Growth Rate</SelectItem>
          <SelectItem value="conversionRate">Conversion Rate</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Leaderboard Table -->
    <div class="table-container">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="rank-col">Rank</th>
            <th class="name-col">Affiliate</th>
            <th class="revenue-col">Revenue</th>
            <th class="licenses-col">Licenses</th>
            <th class="conversion-col">Conv. Rate</th>
            <th class="growth-col">Growth</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in paginatedData"
            :key="item.affiliateId"
            class="table-row"
          >
            <td class="rank-col">
              <div class="rank-badge" :class="`rank-${Math.min(index + 1, 3)}`">
                {{
                  index + currentPage * itemsPerPage - itemsPerPage + index + 1
                }}
              </div>
            </td>
            <td class="name-col">
              <div class="affiliate-name">{{ item.affiliateName }}</div>
              <div class="affiliate-email">{{ item.email }}</div>
            </td>
            <td class="revenue-col font-semibold">
              ${{ formatCurrency(item.totalRevenue) }}
            </td>
            <td class="licenses-col">
              <div class="license-badge">{{ item.licensesReferred }}</div>
            </td>
            <td class="conversion-col">
              <div class="conversion-rate">
                {{ item.conversionRate.toFixed(1) }}%
              </div>
            </td>
            <td
              class="growth-col"
              :class="item.growth >= 0 ? 'positive' : 'negative'"
            >
              <TrendingUp v-if="item.growth >= 0" class="w-4 h-4" />
              <TrendingDown v-else class="w-4 h-4" />
              {{ Math.abs(item.growth).toFixed(1) }}%
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <div v-if="paginatedData.length === 0" class="empty-state">
        <Users class="w-8 h-8 text-muted-foreground" />
        <div class="empty-text">No affiliates match your search</div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <Button
        variant="outline"
        size="sm"
        @click="previousPage"
        :disabled="currentPage === 1"
      >
        Previous
      </Button>
      <div class="page-info">Page {{ currentPage }} of {{ totalPages }}</div>
      <Button
        variant="outline"
        size="sm"
        @click="nextPage"
        :disabled="currentPage === totalPages"
      >
        Next
      </Button>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Top Performer</div>
        <div class="stat-value">{{ topAffiliateRevenue }}</div>
        <div class="stat-secondary">{{ topAffiliateName }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Conversion Rate</div>
        <div class="stat-value">{{ averageConversionRate.toFixed(1) }}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Referred Licenses</div>
        <div class="stat-value">{{ totalReferredLicenses }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { TrendingDown, TrendingUp, Users } from 'lucide-vue-next'
import { computed, ref } from 'vue'

interface AffiliateData {
  affiliateId: string
  affiliateName: string
  email: string
  totalRevenue: number
  licensesReferred: number
  conversionRate: number
  growth: number
}

interface Props {
  data: {
    affiliates: AffiliateData[]
    totalRevenue: number
  }
}

const props = defineProps<Props>()

// State
const searchQuery = ref('')
const sortBy = ref('revenue')
const currentPage = ref(1)
const itemsPerPage = 10

// Methods
const formatCurrency = (value: number): string => {
  return (value / 100).toFixed(2)
}

// Computed
const filteredData = computed(() => {
  let result = [...(props.data.affiliates || [])]

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (item) =>
        item.affiliateName.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query)
    )
  }

  // Sort
  if (sortBy.value === 'revenue') {
    result.sort((a, b) => b.totalRevenue - a.totalRevenue)
  } else if (sortBy.value === 'licenses') {
    result.sort((a, b) => b.licensesReferred - a.licensesReferred)
  } else if (sortBy.value === 'growth') {
    result.sort((a, b) => b.growth - a.growth)
  } else if (sortBy.value === 'conversionRate') {
    result.sort((a, b) => b.conversionRate - a.conversionRate)
  }

  return result
})

const totalPages = computed(() => {
  return Math.ceil(filteredData.value.length / itemsPerPage)
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredData.value.slice(start, end)
})

const topAffiliateName = computed(() => {
  if (filteredData.value.length === 0) return 'N/A'
  return filteredData.value[0].affiliateName
})

const topAffiliateRevenue = computed(() => {
  if (filteredData.value.length === 0) return '$0.00'
  return '$' + formatCurrency(filteredData.value[0].totalRevenue)
})

const averageConversionRate = computed(() => {
  if (filteredData.value.length === 0) return 0
  const sum = filteredData.value.reduce((acc, a) => acc + a.conversionRate, 0)
  return sum / filteredData.value.length
})

const totalReferredLicenses = computed(() => {
  return filteredData.value.reduce((sum, a) => sum + a.licensesReferred, 0)
})

// Pagination methods
const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}
</script>

<style scoped>
.affiliate-leaderboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.controls {
  display: flex;
  gap: 1rem;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.sort-select {
  min-width: 180px;
}

.table-container {
  overflow-x: auto;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.leaderboard-table thead {
  border-bottom: 2px solid var(--border);
  background-color: var(--muted);
}

.leaderboard-table th {
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.leaderboard-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background-color 0.2s;
}

.leaderboard-table tbody tr:last-child {
  border-bottom: none;
}

.leaderboard-table tbody tr:hover {
  background-color: var(--muted);
}

.leaderboard-table td {
  padding: 0.75rem;
  vertical-align: middle;
}

.rank-col {
  width: 60px;
}

.name-col {
  min-width: 200px;
}

.revenue-col {
  width: 120px;
  text-align: right;
}

.licenses-col {
  width: 110px;
  text-align: center;
}

.conversion-col {
  width: 100px;
  text-align: center;
}

.growth-col {
  width: 100px;
  text-align: center;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-weight: 700;
  color: white;
  font-size: 0.875rem;
}

.rank-badge.rank-1 {
  background-color: #fbbf24;
}

.rank-badge.rank-2 {
  background-color: #d1d5db;
}

.rank-badge.rank-3 {
  background-color: #ea580c;
}

.affiliate-name {
  font-weight: 600;
  color: var(--foreground);
}

.affiliate-email {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.license-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 0.25rem 0.5rem;
  background-color: var(--primary);
  color: white;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.conversion-rate {
  font-weight: 600;
}

.growth-col.positive {
  color: #10b981;
}

.growth-col.negative {
  color: #ef4444;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--muted-foreground);
  gap: 0.75rem;
}

.empty-text {
  font-size: 0.875rem;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.page-info {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  min-width: 120px;
  text-align: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background-color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--foreground);
}

.stat-secondary {
  font-size: 0.875rem;
  color: var(--muted-foreground);
}
</style>
