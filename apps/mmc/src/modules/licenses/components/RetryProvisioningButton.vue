<script setup lang="ts">
/**
 * Retry Provisioning Button Component
 */

import { Button } from '@zidney/ui/components/shadcn-vue/button'
import { Card, CardContent } from '@zidney/ui/components/shadcn-vue/card'
import { ref } from 'vue'

interface Props {
  licenseId: string
  canRetry: boolean
  provisioning_retries?: number
}

const props = withDefaults(defineProps<Props>(), {
  provisioning_retries: 0,
})

const retrying = ref(false)

const retry = async () => {
  retrying.value = true
  try {
    // TODO: Call API: POST /v1/mmc/licenses/:id/retry-provisioning
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <Card>
    <CardContent class="pt-6">
      <div class="flex justify-between items-center">
        <p class="text-sm">
          Retry attempts: {{ props.provisioning_retries ?? 0 }}/6
        </p>
        <Button
          @click="retry"
          :disabled="!canRetry || retrying"
          variant="outline"
        >
          {{ retrying ? 'Retrying...' : 'Retry Now' }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
