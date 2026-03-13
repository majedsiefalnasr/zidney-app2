<template>
  <div class="revenue-breakdown">
    <!-- Top 5 Products Table -->
    <div class="table-container">
      <table class="revenue-table">
        <thead>
          <tr>
            <th class="rank-col">Rank</th>
            <th class="product-col">Product</th>
            <th class="revenue-col">Revenue</th>
            <th class="percentage-col">% of Total</th>
            <th class="growth-col">Growth</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in data.topProducts"
            :key="item.productId"
            class="table-row"
          >
            <td class="rank-col">
              <div class="rank-badge" :class="`rank-${index + 1}`">
                {{ index + 1 }}
              </div>
            </td>
            <td class="product-col">{{ item.productName }}</td>
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
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Summary Stats -->
    <div class="summary-stats">
      <div class="stat">
        <div class="stat-label">Total Top 5 Revenue</div>
        <div class="stat-value">${{ formatCurrency(totalTopRevenue) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">% of Total Revenue</div>
        <div class="stat-value">{{ topProductsPercentage.toFixed(1) }}%</div>
      </div>
      <div class="stat">
        <div class="stat-label">Average Growth</div>
        <div
          class="stat-value"
          :class="averageGrowth >= 0 ? 'positive' : 'negative'"
        >
          {{ averageGrowth.toFixed(1) }}%
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!data.topProducts || data.topProducts.length === 0"
      class="empty-state"
    >
      <div class="empty-icon">📊</div>
      <div class="empty-text">No product data available</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TrendingDown, TrendingUp } from 'lucide-vue-next'
import { computed } from 'vue'

void [TrendingDown, TrendingUp]

interface ProductRevenue {
  productId: string
  productName: string
  revenue: number
  percentOfTotal: number
  growth: number
}

interface RevenueBreakdownData {
  topProducts: ProductRevenue[]
  totalRevenue: number
}

interface Props {
  data: RevenueBreakdownData
}

const props = defineProps<Props>()

const formatCurrency = (value: number): string => {
  return (value / 100).toFixed(2)
}

const totalTopRevenue = computed(() => {
  return props.data.topProducts?.reduce((sum, p) => sum + p.revenue, 0) ?? 0
})

const topProductsPercentage = computed(() => {
  if (!props.data.totalRevenue || props.data.totalRevenue === 0) return 0
  return (totalTopRevenue.value / props.data.totalRevenue) * 100
})

const averageGrowth = computed(() => {
  if (!props.data.topProducts || props.data.topProducts.length === 0) return 0
  const sum = props.data.topProducts.reduce((acc, p) => acc + p.growth, 0)
  return sum / props.data.topProducts.length
})

void [formatCurrency, totalTopRevenue, topProductsPercentage, averageGrowth]
</script>

<style scoped>
.revenue-breakdown {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.table-container {
  overflow-x: auto;
}

.revenue-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.revenue-table thead {
  border-bottom: 2px solid var(--border);
  background-color: var(--muted);
}

.revenue-table th {
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.revenue-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background-color 0.2s;
}

.revenue-table tbody tr:last-child {
  border-bottom: none;
}

.revenue-table tbody tr:hover {
  background-color: var(--muted);
}

.revenue-table td {
  padding: 0.75rem;
}

.rank-col {
  width: 60px;
}

.product-col {
  min-width: 150px;
}

.revenue-col {
  width: 100px;
  text-align: right;
}

.percentage-col {
  min-width: 150px;
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

.rank-badge.rank-4,
.rank-badge.rank-5 {
  background-color: #6b7280;
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
  background-color: #3b82f6;
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

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background-color: var(--muted);
  border-radius: 0.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--muted-foreground);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.empty-text {
  font-size: 0.875rem;
}
</style>
