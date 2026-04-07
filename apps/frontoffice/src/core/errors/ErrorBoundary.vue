<script setup lang="ts">
import type { AppError } from '@zidney/api-client'

import { isAppError } from '@zidney/api-client'

import type { Logger } from '@zidney/logger'

import { inject, onErrorCaptured, ref } from 'vue'
import { useRouter } from 'vue-router'

import { normalizeError } from './error-normalizer'
import { redactError } from './redact-error'

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template
const router = useRouter()
const logger = inject<Logger | undefined>('appLogger', undefined)
const isProduction = inject<boolean>('isProduction', true)

const capturedError = ref<AppError | null>(null)

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template
function reset() {
  capturedError.value = null
}

onErrorCaptured((err: unknown) => {
  const normalized = isAppError(err) ? err : normalizeError(err)
  const safe = redactError(normalized, isProduction)

  logger?.error('ErrorBoundary caught error', {
    code: safe.code,
    httpStatus: safe.httpStatus,
    isNetworkError: safe.isNetworkError,
  })

  capturedError.value = safe

  // Swallow — render fallback slot instead of propagating
  return false
})
</script>

<template>
  <slot
    v-if="capturedError !== null"
    name="fallback"
    :error="capturedError"
    :reset="reset"
  >
    <!-- Default fallback UI -->
    <div class="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6 text-center">
      <p class="text-destructive text-lg font-semibold">Something went wrong</p>
      <p class="text-muted-foreground text-sm">{{ capturedError.code }}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="bg-primary text-primary-foreground rounded px-4 py-2 text-sm"
          @click="reset"
        >
          Try again
        </button>
        <button
          type="button"
          class="border-border rounded border px-4 py-2 text-sm"
          @click="router.push({ name: 'fo-dashboard' })"
        >
          Go to Home
        </button>
      </div>
    </div>
  </slot>
  <slot v-else />
</template>
