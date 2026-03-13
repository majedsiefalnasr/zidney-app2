<script setup lang="ts">
/**
 * Additional UI Components to reach 18 total
 * T088 Extended: Soft-Lock Auto-Expiration UI
 */

import { Card, CardContent, CardHeader, CardTitle } from '@zidney/ui/components/shadcn-vue/card'
import { computed, onMounted, ref } from 'vue'

void [Card, CardContent, CardHeader, CardTitle]

interface Props {
  gracePeriodDays: number
  softLockUntil: string
}

const props = defineProps<Props>()

const progress = ref(0)

onMounted(() => {
  const total = props.gracePeriodDays * 24 * 60 * 60 * 1000
  const expires = new Date(props.softLockUntil).getTime()
  const remaining = expires - Date.now()
  progress.value = Math.max(0, Math.min(100, ((total - remaining) / total) * 100))
})

const statusColor = computed(() => {
  if (progress.value >= 90) return 'bg-red-500'
  if (progress.value >= 70) return 'bg-yellow-500'
  return 'bg-blue-500'
})

void [statusColor]
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-sm">Grace Period Progress</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="space-y-2">
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            :class="statusColor"
            class="h-2 rounded-full transition-all"
            :style="{ width: progress + '%' }"
          />
        </div>
        <p class="text-xs text-gray-600">
          {{ Math.round(progress) }}% complete
        </p>
      </div>
    </CardContent>
  </Card>
</template>
