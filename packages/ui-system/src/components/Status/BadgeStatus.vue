<template>
  <Badge :variant="badgeVariant" class="gap-1">
    <span
      v-if="icon"
      class="inline-flex items-center justify-center"
      v-html="icon"
    />
    <span>{{ label }}</span>
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from '@shadcn-vue/ui/badge'
import { computed } from 'vue'

type StatusType = 'active' | 'inactive' | 'pending' | 'archived' | 'warning'

interface Props {
  status: StatusType
  label: string
  icon?: string
}

const props = defineProps<Props>()

const badgeVariant = computed<
  'default' | 'secondary' | 'destructive' | 'outline'
>(() => {
  const variantMap: Record<
    StatusType,
    'default' | 'secondary' | 'destructive' | 'outline'
  > = {
    active: 'default',
    inactive: 'secondary',
    pending: 'secondary',
    archived: 'outline',
    warning: 'destructive',
  }
  return variantMap[props.status]
})
</script>

<style scoped>
@reference "tailwindcss";

/* Styles handled by shadcn-vue Badge component */
</style>
