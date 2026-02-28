<script setup lang="ts">
/**
 * T080-T081: Soft-Lock Display & Grace Period Timer
 */

import { Badge } from '@zidney/ui/components/shadcn-vue/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@zidney/ui/components/shadcn-vue/card'
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface Props {
  softLockUntil: string | null
}

const props = defineProps<Props>()

const now = ref(new Date())
let interval: NodeJS.Timeout | null = null

onMounted(() => {
  interval = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})

const timeRemaining = computed(() => {
  if (!props.softLockUntil) return null

  const expiresAt = new Date(props.softLockUntil).getTime()
  const remaining = expiresAt - now.value.getTime()

  if (remaining <= 0) return 'Expired'

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
  const hours = Math.floor(
    (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  )
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))

  return `${days}d ${hours}h ${minutes}m`
})

const isExpiring = computed(() => {
  if (!props.softLockUntil) return false
  const expiresAt = new Date(props.softLockUntil).getTime()
  const remaining = expiresAt - now.value.getTime()
  return remaining > 0 && remaining < 7 * 24 * 60 * 60 * 1000 // Less than 7 days
})
</script>

<template>
  <Card v-if="softLockUntil" class="bg-yellow-50 border-yellow-200">
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle class="text-base">Grace Period Active</CardTitle>
        <Badge :variant="isExpiring ? 'destructive' : 'secondary'">
          {{ isExpiring ? 'Expiring Soon' : 'Active' }}
        </Badge>
      </div>
      <CardDescription
        >License will auto-transition to ARCHIVED after grace period
        expires</CardDescription
      >
    </CardHeader>
    <CardContent class="space-y-2">
      <div>
        <p class="text-sm font-semibold">Time Remaining</p>
        <p class="text-2xl font-bold">{{ timeRemaining }}</p>
      </div>
      <div class="text-sm">
        <p>Expires: {{ new Date(softLockUntil).toLocaleString() }}</p>
      </div>
      <!-- TODO: Add countdown progress bar -->
    </CardContent>
  </Card>
</template>
