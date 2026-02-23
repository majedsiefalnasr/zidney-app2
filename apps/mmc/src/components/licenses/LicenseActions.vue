<script setup lang="ts">
/**
 * T079: License Status Actions - Soft-lock, unlock, archive, restore buttons
 */

import { Button } from '@zidney/ui/components/shadcn-vue/button'
import { Card, CardContent, CardHeader, CardTitle } from '@zidney/ui/components/shadcn-vue/card'
import { ref } from 'vue'

interface Props {
  licenseId: string
  status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED' | 'PENDING_PROVISION'
}

const props = defineProps<Props>()

const loading = ref<string | null>(null)

const performAction = async (action: string) => {
  loading.value = action
  try {
    // TODO: Call API based on action
    // POST /v1/mmc/licenses/:id/soft-lock
    // POST /v1/mmc/licenses/:id/unlock
    // POST /v1/mmc/licenses/:id/archive
    // POST /v1/mmc/licenses/:id/restore
  } finally {
    loading.value = null
  }
}

const getAvailableActions = () => {
  const actions: Array<{ label: string; action: string; variant: string }> = []

  switch (props.status) {
    case 'ACTIVE':
      actions.push({
        label: 'Soft-Lock',
        action: 'soft-lock',
        variant: 'outline',
      })
      break
    case 'SOFT_LOCKED':
      actions.push(
        { label: 'Unlock', action: 'unlock', variant: 'outline' },
        { label: 'Archive', action: 'archive', variant: 'destructive' }
      )
      break
    case 'ARCHIVED':
      actions.push({ label: 'Restore', action: 'restore', variant: 'outline' })
      break
  }

  actions.push({ label: 'Delete', action: 'delete', variant: 'destructive' })
  return actions
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Status Actions</CardTitle>
    </CardHeader>
    <CardContent class="flex gap-2 flex-wrap">
      <Button
        v-for="action in getAvailableActions()"
        :key="action.action"
        :variant="action.variant"
        :disabled="loading !== null"
        @click="performAction(action.action)"
      >
        {{ loading === action.action ? 'Processing...' : action.label }}
      </Button>
    </CardContent>
  </Card>
</template>
