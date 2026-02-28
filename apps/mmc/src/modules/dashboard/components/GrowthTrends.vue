<template>
  <div class="growth-trends">
    <!-- Period Selector -->
    <div class="controls">
      <div class="period-selector">
        <Button
          v-for="period in ['12mo', '6mo', '3mo']"
          :key="period"
          :variant="selectedPeriod === period ? 'default' : 'outline'"
          @click="selectedPeriod = period"
          size="sm"
        >
          {{ formatPeriodLabel(period) }}
        </Button>
      </div>
      <Select v-model="metricFilter">
        <SelectTrigger class="metric-select">
          <SelectValue placeholder="Show metric" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Both Metrics</SelectItem>
          <SelectItem value="revenue">Revenue Only</SelectItem>
          <SelectItem value="licenses">Licenses Only</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Chart Area (simulated with CSS) -->
    <div class="chart-container">
      <!-- Legend -->
      <div class="chart-legend">
        <div
          v-if="metricFilter === 'all' || metricFilter === 'revenue'"
          class="legend-item"
        >
          <div class="legend-color" style="background-color: #3b82f6"></div>
          <span>Revenue</span>
        </div>
        <div
          v-if="metricFilter === 'all' || metricFilter === 'licenses'"
          class="legend-item"
        >
          <div class="legend-color" style="background-color: #10b981"></div>
          <span>Active Licenses</span>
        </div>
      </div>

      <!-- Simplified Line Chart Representation -->
      <div class="chart-area">
        <div class="y-axis">
          <div v-for="i in 5" :key="i" class="y-label">{{ i * 20 }}%</div>
        </div>

        <div class="x-axis">
          <div class="x-baseline">
            <div v-for="(month, i) in displayedMonths" :key="i" class="x-label">
              {{ month }}
            </div>
          </div>

          <!-- Revenue Line -->
          <svg
            v-if="metricFilter === 'all' || metricFilter === 'revenue'"
            class="trend-line revenue-line"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polyline :points="revenuePoints" />
          </svg>

          <!-- Licenses Line -->
          <svg
            v-if="metricFilter === 'all' || metricFilter === 'licenses'"
            class="trend-line licenses-line"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polyline :points="licensePoints" />
          </svg>
        </div>
      </div>

      <!-- Data Points Table -->
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th v-if="metricFilter === 'all' || metricFilter === 'revenue'">
                Revenue
              </th>
              <th v-if="metricFilter === 'all' || metricFilter === 'licenses'">
                Licenses
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(dataPoint, idx) in tableData" :key="idx">
              <td class="month-cell">{{ dataPoint.month }}</td>
              <td
                v-if="metricFilter === 'all' || metricFilter === 'revenue'"
                class="data-cell"
              >
                <div
                  class="trend"
                  :class="
                    dataPoint.revenueChange >= 0 ? 'positive' : 'negative'
                  "
                >
                  {{ dataPoint.revenue }}
                  <TrendingUp
                    v-if="dataPoint.revenueChange >= 0"
                    class="w-3 h-3"
                  />
                  <TrendingDown v-else class="w-3 h-3" />
                </div>
              </td>
              <td
                v-if="metricFilter === 'all' || metricFilter === 'licenses'"
                class="data-cell"
              >
                <div
                  class="trend"
                  :class="
                    dataPoint.licenseChange >= 0 ? 'positive' : 'negative'
                  "
                >
                  {{ dataPoint.licenses }}
                  <TrendingUp
                    v-if="dataPoint.licenseChange >= 0"
                    class="w-3 h-3"
                  />
                  <TrendingDown v-else class="w-3 h-3" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="summary-stats">
      <div class="stat">
        <div class="stat-label">Avg Monthly Revenue</div>
        <div class="stat-value">${{ formatCurrency(avgRevenue) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Avg Licenses/Month</div>
        <div class="stat-value">{{ Math.round(avgLicenses) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Revenue Trend</div>
        <div
          class="stat-value"
          :class="revenueTrend >= 0 ? 'positive' : 'negative'"
        >
          {{ revenueTrend >= 0 ? '+' : '' }}{{ revenueTrend.toFixed(1) }}%
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { TrendingDown, TrendingUp } from 'lucide-vue-next'
import { computed, ref } from 'vue'

interface TrendDataPoint {
  month: string
  revenue: string
  licenses: string
  revenueChange: number
  licenseChange: number
}

interface Props {
  data: {
    months: TrendDataPoint[]
    totalRevenue: number
  }
}

const props = defineProps<Props>()

// State
const selectedPeriod = ref('12mo')
const metricFilter = ref('all')

// Methods
const formatPeriodLabel = (period: string): string => {
  const labels: Record<string, string> = {
    '12mo': '12 Months',
    '6mo': '6 Months',
    '3mo': '3 Months',
  }
  return labels[period] || period
}

const formatCurrency = (value: number): string => {
  return (value / 100).toFixed(2)
}

// Computed
const displayedMonths = computed(() => {
  const months = props.data.months || []
  if (selectedPeriod.value === '3mo')
    return months.slice(-3).map((m) => m.month)
  if (selectedPeriod.value === '6mo')
    return months.slice(-6).map((m) => m.month)
  return months.map((m) => m.month)
})

const filteredData = computed(() => {
  const months = props.data.months || []
  if (selectedPeriod.value === '3mo') return months.slice(-3)
  if (selectedPeriod.value === '6mo') return months.slice(-6)
  return months
})

const tableData = computed(() => {
  return filteredData.value.map((point: TrendDataPoint) => ({
    month: point.month,
    revenue: point.revenue,
    licenses: point.licenses,
    revenueChange: point.revenueChange,
    licenseChange: point.licenseChange,
  }))
})

const revenuePoints = computed(() => {
  if (!filteredData.value.length) return ''
  return filteredData.value
    .map((point: TrendDataPoint, i: number) => {
      const value = parseInt(point.revenue) || 0
      const normalized = Math.min(value / 100000, 100)
      return `${(i / (filteredData.value.length - 1)) * 100},${100 - normalized}`
    })
    .join(' ')
})

const licensePoints = computed(() => {
  if (!filteredData.value.length) return ''
  return filteredData.value
    .map((point: TrendDataPoint, i: number) => {
      const value = parseInt(point.licenses) || 0
      const normalized = Math.min(value / 1000, 100)
      return `${(i / (filteredData.value.length - 1)) * 100},${100 - normalized}`
    })
    .join(' ')
})

const avgRevenue = computed(() => {
  if (!filteredData.value.length) return 0
  const sum = filteredData.value.reduce(
    (acc: number, point: TrendDataPoint) => {
      return acc + (parseInt(point.revenue) || 0)
    },
    0
  )
  return sum / filteredData.value.length
})

const avgLicenses = computed(() => {
  if (!filteredData.value.length) return 0
  const sum = filteredData.value.reduce(
    (acc: number, point: TrendDataPoint) => {
      return acc + (parseInt(point.licenses) || 0)
    },
    0
  )
  return sum / filteredData.value.length
})

const revenueTrend = computed(() => {
  if (!filteredData.value.length) return 0
  const first = parseInt(filteredData.value[0]?.revenue) || 0
  const last =
    parseInt(filteredData.value[filteredData.value.length - 1]?.revenue) || 0
  if (first === 0) return 0
  return ((last - first) / first) * 100
})
</script>

<style scoped>
.growth-trends {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.controls {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.period-selector {
  display: flex;
  gap: 0.5rem;
}

.metric-select {
  min-width: 150px;
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background-color: var(--muted);
}

.chart-legend {
  display: flex;
  gap: 2rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.chart-area {
  position: relative;
  height: 300px;
  display: flex;
  gap: 1rem;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 50px;
  text-align: right;
  border-right: 1px solid var(--border);
  padding-right: 0.5rem;
}

.y-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.x-axis {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.x-baseline {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  padding-top: 1rem;
}

.x-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  flex: 1;
  text-align: center;
}

.trend-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  stroke-width: 2;
  fill: none;
}

.trend-line.revenue-line {
  stroke: #3b82f6;
}

.trend-line.licenses-line {
  stroke: #10b981;
}

.data-table {
  overflow-x: auto;
}

.data-table table {
  width: 100%;
  font-size: 0.875rem;
  border-collapse: collapse;
}

.data-table thead {
  border-bottom: 1px solid var(--border);
  background-color: var(--background);
}

.data-table th {
  padding: 0.5rem;
  text-align: left;
  font-weight: 600;
  color: var(--muted-foreground);
}

.data-table tbody tr {
  border-bottom: 1px solid var(--border);
}

.data-table tbody tr:last-child {
  border-bottom: none;
}

.data-table td {
  padding: 0.5rem;
}

.month-cell {
  font-weight: 600;
  color: var(--foreground);
}

.data-cell {
  text-align: right;
}

.trend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.trend.positive {
  color: #10b981;
}

.trend.negative {
  color: #ef4444;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background-color: var(--background);
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

.stat-value.positive {
  color: #10b981;
}

.stat-value.negative {
  color: #ef4444;
}
</style>
