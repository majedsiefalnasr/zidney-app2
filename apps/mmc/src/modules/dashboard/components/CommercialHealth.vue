<template>
  <div class="commercial-health">
    <div class="metrics-grid">
      <!-- Active Licenses -->
      <div class="metric-card">
        <div class="metric-label">Active Licenses</div>
        <div class="metric-value">{{ data.activeLicenses }}</div>
        <div
          class="metric-change"
          :class="data.licenseChange >= 0 ? 'positive' : 'negative'"
        >
          <TrendingUp v-if="data.licenseChange >= 0" class="w-4 h-4" />
          <TrendingDown v-else class="w-4 h-4" />
          {{ Math.abs(data.licenseChange) }}% from last month
        </div>
      </div>

      <!-- Total Revenue (Current Month) -->
      <div class="metric-card">
        <div class="metric-label">Current Month Revenue</div>
        <div class="metric-value">
          ${{ formatCurrency(data.monthlyRevenue) }}
        </div>
        <div
          class="metric-change"
          :class="data.revenueChange >= 0 ? 'positive' : 'negative'"
        >
          <TrendingUp v-if="data.revenueChange >= 0" class="w-4 h-4" />
          <TrendingDown v-else class="w-4 h-4" />
          {{ Math.abs(data.revenueChange) }}% from last month
        </div>
      </div>

      <!-- Average Revenue Per License -->
      <div class="metric-card">
        <div class="metric-label">Avg Revenue per License</div>
        <div class="metric-value">${{ formatCurrency(data.arpl) }}</div>
        <div class="metric-description">Monthly billing per active license</div>
      </div>

      <!-- Churn Rate -->
      <div class="metric-card">
        <div class="metric-label">License Churn Rate</div>
        <div class="metric-value">{{ data.churnRate.toFixed(2) }}%</div>
        <div
          class="metric-change"
          :class="data.churnRate > 5 ? 'negative' : 'positive'"
        >
          <Info class="w-4 h-4" />
          {{ data.churnRate > 5 ? 'High' : 'Healthy' }} churn rate
        </div>
      </div>
    </div>

    <!-- Detailed Breakdown -->
    <div class="breakdown-section">
      <h3 class="breakdown-title">License Status Breakdown</h3>
      <div class="status-breakdown">
        <div class="status-item">
          <div class="status-indicator" style="background-color: #10b981"></div>
          <div class="status-label">Active</div>
          <div class="status-count">
            {{ data.licensesByStatus?.active ?? 0 }}
          </div>
        </div>
        <div class="status-item">
          <div class="status-indicator" style="background-color: #f59e0b"></div>
          <div class="status-label">Soft-Locked</div>
          <div class="status-count">
            {{ data.licensesByStatus?.softLocked ?? 0 }}
          </div>
        </div>
        <div class="status-item">
          <div class="status-indicator" style="background-color: #ef4444"></div>
          <div class="status-label">Archived</div>
          <div class="status-count">
            {{ data.licensesByStatus?.archived ?? 0 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Health Indicator -->
    <div class="health-indicator">
      <Badge :variant="healthVariant">
        <Activity class="w-3 h-3 mr-1" />
        {{ healthStatus }}
      </Badge>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, Info, TrendingDown, TrendingUp } from 'lucide-vue-next'
import { computed } from 'vue'
import { Badge } from '@/components/ui'

interface CommercialHealthData {
  activeLicenses: number
  monthlyRevenue: number
  arpl: number
  churnRate: number
  licenseChange: number
  revenueChange: number
  licensesByStatus?: {
    active: number
    softLocked: number
    archived: number
  }
}

interface Props {
  data: CommercialHealthData
}

const props = defineProps<Props>()

const formatCurrency = (value: number): string => {
  return (value / 100).toFixed(2)
}

const healthStatus = computed(() => {
  const { churnRate, revenueChange } = props.data
  if (revenueChange > 10 && churnRate < 3) return 'Excellent'
  if (revenueChange > 0 && churnRate < 5) return 'Good'
  if (churnRate > 8 || revenueChange < -10) return 'At Risk'
  return 'Stable'
})

const healthVariant = computed(() => {
  const status = healthStatus.value
  if (status === 'Excellent') return 'default' // green variant
  if (status === 'Good') return 'secondary'
  if (status === 'At Risk') return 'destructive'
  return 'outline'
})
</script>

<style scoped>
.commercial-health {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.metric-card {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background-color: var(--background);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--foreground);
}

.metric-change {
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.metric-change.positive {
  color: #10b981;
}

.metric-change.negative {
  color: #ef4444;
}

.metric-description {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.breakdown-section {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background-color: var(--background);
}

.breakdown-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1rem;
  margin-top: 0;
}

.status-breakdown {
  display: flex;
  gap: 2rem;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.status-count {
  font-size: 1.125rem;
  font-weight: 700;
}

.health-indicator {
  display: flex;
  justify-content: center;
}
</style>
