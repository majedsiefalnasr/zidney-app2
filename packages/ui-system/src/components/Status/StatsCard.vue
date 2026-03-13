<template>
  <Card class="stats-card hover:shadow-md transition-all">
    <!-- Icon -->
    <div
      v-if="icon"
      class="w-12 h-12 flex items-center justify-center bg-blue-50 rounded-md text-blue-600 text-lg"
      v-html="icon"
    />

    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="h-24 bg-linear-to-r from-gray-100 via-gray-50 to-gray-100 rounded-sm animate-pulse"
    />

    <!-- Content -->
    <div v-else class="space-y-2">
      <p class="text-sm text-gray-600 font-medium uppercase tracking-wider m-0">
        {{ title }}
      </p>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-bold text-gray-900">{{ value }}</span>
        <span v-if="unit" class="text-sm text-gray-600 font-medium">{{
          unit
        }}</span>
      </div>

      <!-- Trend indicator -->
      <div
        v-if="trend"
        :class="[
          'flex items-center gap-1 text-xs font-semibold pt-2 border-t',
          {
            'text-green-600': trend.direction === 'up',
            'text-red-600': trend.direction === 'down',
          },
        ]"
      >
        <span class="text-base">{{
          trend.direction === 'up' ? '↑' : '↓'
        }}</span>
        <span>{{ trend.percentage }}%</span>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
interface Trend {
  direction: 'up' | 'down'
  percentage: number
}

interface Props {
  title: string
  value: string | number
  unit?: string
  trend?: Trend
  icon?: string
  isLoading?: boolean
}

withDefaults(defineProps<Props>(), {
  isLoading: false,
})
</script>

<style scoped>
@reference "tailwindcss";

/* Styles handled by Tailwind utilities and shadcn-vue Card */
</style>
