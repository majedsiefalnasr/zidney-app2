<script setup lang="ts">
/**
 * T083: Provisioning Status Indicator
 */

import { Badge } from '@zidney/ui/components/shadcn-vue/badge'
import { Card, CardContent } from '@zidney/ui/components/shadcn-vue/card'
import { computed } from 'vue'

interface Props {
  status: string
  provisioning_retries?: number
  provisioning_error?: string
  provisioning_last_attempt_at?: string
}

const props = withDefaults(defineProps<Props>(), {
  provisioning_retries: 0,
})

const statusIcon = computed(() => {
  const icons: Record<string, string> = {
    PENDING_PROVISION: '⏳',
    ACTIVE: '✅',
    SOFT_LOCKED: '🔒',
    ARCHIVED: '📦',
    PROVISION_FAILED: '❌',
  }
  return icons[props.status] || '❓'
})

const statusMessage = computed(() => {
  const messages: Record<string, string> = {
    PENDING_PROVISION: 'Provisioning workspace...',
    ACTIVE: 'Ready for use',
    SOFT_LOCKED: 'Grace period active',
    ARCHIVED: 'Archived (read-only)',
    PROVISION_FAILED: `Failed (${props.provisioning_retries}/6 retries)`,
  }
  return messages[props.status] || 'Unknown'
})

const variant = computed(() => {
  if (props.status === 'ACTIVE') return 'default'
  if (props.status === 'PROVISION_FAILED') return 'destructive'
  if (props.status === 'SOFT_LOCKED') return 'secondary'
  return 'outline'
})
</script>

<template>
  <Card>
    <CardContent class="pt-6">
      <div class="flex items-center gap-4">
        <span class="text-3xl">{{ statusIcon }}</span>
        <div>
          <Badge :variant="variant">{{ status }}</Badge>
          <p class="text-sm text-gray-600 mt-1">{{ statusMessage }}</p>
          <p v-if="provisioning_last_attempt_at" class="text-xs text-gray-500">
            Last attempt:
            {{ new Date(provisioning_last_attempt_at).toLocaleString() }}
          </p>
          <p v-if="provisioning_error" class="text-xs text-red-600">
            Error: {{ provisioning_error }}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
