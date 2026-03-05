<script setup lang="ts">
/**
 * T084: Error Message Display Component
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@zidney/ui/components/shadcn-vue/alert'

interface Props {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  } | null
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  dismissible: true,
})

const emit = defineEmits<{
  dismiss: []
}>()

const getErrorIcon = (code: string) => {
  const icons: Record<string, string> = {
    VALIDATION_ERROR: '⚠️',
    UNAUTHORIZED: '🔒',
    LICENSE_NOT_FOUND: '❌',
    RATE_LIMIT_EXCEEDED: '⏱️',
    SERVICE_UNAVAILABLE: '🔴',
  }
  return icons[code] || '❌'
}
</script>

<template>
  <Alert v-if="error" variant="destructive" class="mb-4">
    <div class="flex justify-between items-start">
      <div>
        <AlertTitle class="flex items-center gap-2">
          <span>{{ getErrorIcon(error.code) }}</span>
          <span>{{ error.code }}</span>
        </AlertTitle>
        <AlertDescription class="mt-2">
          {{ error.message }}
        </AlertDescription>
        <div v-if="error.details" class="text-xs mt-2 space-y-1">
          <p v-for="(value, key) in error.details" :key="key">
            <span class="font-semibold">{{ key }}:</span> {{ value }}
          </p>
        </div>
      </div>
      <button v-if="dismissible" @click="emit('dismiss')" class="ml-2 text-2xl">
        ✕
      </button>
    </div>
  </Alert>
</template>
