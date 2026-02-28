<script setup lang="ts">
/**
 * License Status Badge - Reusable status indicator
 */

import { Badge } from '@zidney/ui/components/shadcn-vue/badge'
import { computed } from 'vue'

interface Props {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const variant = computed(() => {
  const variants: Record<string, string> = {
    ACTIVE: 'default',
    SOFT_LOCKED: 'secondary',
    ARCHIVED: 'destructive',
    PENDING_PROVISION: 'outline',
    PROVISION_FAILED: 'destructive',
  }
  return variants[props.status] || 'outline'
})

const sizeClass = computed(() => {
  const sizes: Record<string, string> = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  }
  return sizes[props.size] || 'text-sm px-3 py-1'
})
</script>

<template>
  <Badge :variant="variant" :class="sizeClass">
    {{ status }}
  </Badge>
</template>
