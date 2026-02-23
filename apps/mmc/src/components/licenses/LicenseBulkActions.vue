<script setup lang="ts">
/**
 * T087: License Bulk Actions Component
 */

import { Button } from '@zidney/ui/components/shadcn-vue/button'
import { Card, CardContent } from '@zidney/ui/components/shadcn-vue/card'

interface Props {
  selectedCount: number
  selectedIds: string[]
}

const emit = defineEmits<{
  'bulk-action': [action: string]
}>()

defineProps<Props>()

const performBulkAction = (action: string) => {
  // TODO: Confirm action with user
  // TODO: Send to API
  emit('bulk-action', action)
}
</script>

<template>
  <Card v-if="selectedCount > 0" class="bg-blue-50 border-blue-200">
    <CardContent class="pt-6">
      <div class="flex items-center justify-between">
        <p class="font-semibold">{{ selectedCount }} selected</p>
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            @click="performBulkAction('soft-lock')"
          >
            Bulk Soft-Lock
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="performBulkAction('export')"
          >
            Export
          </Button>
          <!-- TODO: Add more bulk actions -->
        </div>
      </div>
    </CardContent>
  </Card>
</template>
