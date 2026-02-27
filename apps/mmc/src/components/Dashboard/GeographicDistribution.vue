<template>
  <div class="geographic-distribution">
    <!-- Controls -->
    <div class="controls">
      <Input
        v-model="searchQuery"
        type="search"
        placeholder="Search countries..."
        class="search-input"
      />
      <Select v-model="sortBy">
        <SelectTrigger class="sort-select">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="revenue">Revenue (High to Low)</SelectItem>
          <SelectItem value="growth">Growth Rate</SelectItem>
          <SelectItem value="name">Country Name</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Countries Table -->
    <div class="table-container">
      <table class="countries-table">
        <thead>
          <tr>
            <th class="flag-col">Flag</th>
            <th class="country-col">Country</th>
            <th class="revenue-col">Revenue</th>
            <th class="percentage-col">% of Total</th>
            <th class="growth-col">Growth</th>
            <th class="licenses-col">Licenses</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in paginatedData"
            :key="item.country"
            class="table-row"
          >
            <td class="flag-col">{{ countryFlag(item.countryCode) }}</td>
            <td class="country-col">
              <div>{{ item.country }}</div>
              <div class="country-code">{{ item.countryCode }}</div>
            </td>
            <td class="revenue-col font-semibold">
              ${{ formatCurrency(item.revenue) }}
            </td>
            <td class="percentage-col">
              <div class="percentage-bar">
                <div
                  class="bar-fill"
                  :style="{ width: item.percentOfTotal + '%' }"
                ></div>
              </div>
              <span class="percentage-text"
                >{{ item.percentOfTotal.toFixed(1) }}%</span
              >
            </td>
            <td
              class="growth-col"
              :class="item.growth >= 0 ? 'positive' : 'negative'"
            >
              <TrendingUp v-if="item.growth >= 0" class="w-4 h-4" />
              <TrendingDown v-else class="w-4 h-4" />
              {{ Math.abs(item.growth).toFixed(1) }}%
            </td>
            <td class="licenses-col">{{ item.licenseCount }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <div v-if="paginatedData.length === 0" class="empty-state">
        <Globe class="w-8 h-8 text-muted-foreground" />
        <div class="empty-text">No countries match your search</div>
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

    <!-- Summary -->
    <div class="summary">
      <div class="summary-item">
        <span class="summary-label">Total Countries:</span>
        <span class="summary-value">{{ filteredData.length }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total Revenue:</span>
        <span class="summary-value">${{ formatCurrency(totalRevenue) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total Licenses:</span>
        <span class="summary-value">{{ totalLicenses }}</span>
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
import { Globe, TrendingDown, TrendingUp } from 'lucide-vue-next'
import { computed, ref } from 'vue'

interface GeographicData {
  country: string
  countryCode: string
  revenue: number
  percentOfTotal: number
  growth: number
  licenseCount: number
}

interface Props {
  data: {
    countries: GeographicData[]
    totalRevenue: number
  }
}

const props = defineProps<Props>()

// State
const searchQuery = ref('')
const sortBy = ref('revenue')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Methods
const formatCurrency = (value: number): string => {
  return (value / 100).toFixed(2)
}

const countryFlag = (code: string): string => {
  // Convert country code to flag emoji
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

// Computed
const filteredData = computed(() => {
  let result = [...(props.data.countries || [])]

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (item) =>
        item.country.toLowerCase().includes(query) ||
        item.countryCode.toLowerCase().includes(query)
    )
  }

  // Sort
  if (sortBy.value === 'revenue') {
    result.sort((a, b) => b.revenue - a.revenue)
  } else if (sortBy.value === 'growth') {
    result.sort((a, b) => b.growth - a.growth)
  } else if (sortBy.value === 'name') {
    result.sort((a, b) => a.country.localeCompare(b.country))
  }

  return result
})

const totalPages = computed(() => {
  return Math.ceil(filteredData.value.length / itemsPerPage.value)
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredData.value.slice(start, end)
})

const totalRevenue = computed(() => {
  return filteredData.value.reduce((sum, item) => sum + item.revenue, 0)
})

const totalLicenses = computed(() => {
  return filteredData.value.reduce((sum, item) => sum + item.licenseCount, 0)
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
.geographic-distribution {
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
  position: relative;
}

.countries-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.countries-table thead {
  border-bottom: 2px solid var(--border);
  background-color: var(--muted);
}

.countries-table th {
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.countries-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background-color 0.2s;
}

.countries-table tbody tr:last-child {
  border-bottom: none;
}

.countries-table tbody tr:hover {
  background-color: var(--muted);
}

.countries-table td {
  padding: 0.75rem;
  vertical-align: middle;
}

.flag-col {
  width: 50px;
  text-align: center;
  font-size: 1.5rem;
}

.country-col {
  min-width: 150px;
}

.country-code {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.revenue-col {
  width: 100px;
  text-align: right;
}

.percentage-col {
  min-width: 150px;
}

.growth-col {
  width: 90px;
  text-align: center;
}

.licenses-col {
  width: 90px;
  text-align: right;
}

.percentage-bar {
  display: flex;
  height: 6px;
  background-color: var(--muted);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.bar-fill {
  background-color: #8b5cf6;
  transition: width 0.3s ease;
}

.percentage-text {
  font-size: 0.75rem;
  color: var(--muted-foreground);
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

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background-color: var(--muted);
  border-radius: 0.5rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.summary-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted-foreground);
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--foreground);
}
</style>
