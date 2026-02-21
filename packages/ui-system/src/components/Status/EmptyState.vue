<template>
  <div
    :class="[
      'empty-state flex flex-col items-center justify-center gap-4 p-8 text-center',
      { 'min-h-screen': fullHeight, 'min-h-48': !fullHeight },
    ]"
  >
    <!-- Icon -->
    <div v-if="icon" class="text-6xl leading-none" v-html="icon" />
    <div v-else class="text-6xl text-gray-400">📭</div>

    <!-- Title -->
    <h3 class="text-lg font-bold text-gray-900 m-0">{{ title }}</h3>

    <!-- Description -->
    <p v-if="description" class="text-sm text-gray-600 m-0 max-w-xs">
      {{ description }}
    </p>

    <!-- Actions -->
    <div class="flex gap-2 mt-4">
      <!-- Primary action -->
      <Button v-if="primaryAction" @click="$emit('primary-action-clicked')">
        {{ primaryAction }}
      </Button>

      <!-- Secondary action -->
      <Button
        v-if="secondaryAction"
        variant="outline"
        @click="$emit('secondary-action-clicked')"
      >
        {{ secondaryAction }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@shadcn-vue/ui/button'

interface Props {
  title: string
  description?: string
  icon?: string
  primaryAction?: string
  secondaryAction?: string
  fullHeight?: boolean
}

interface Emits {
  'primary-action-clicked': []
  'secondary-action-clicked': []
}

withDefaults(defineProps<Props>(), {
  fullHeight: false,
})

defineEmits<Emits>()
</script>

<style scoped>
@reference "tailwindcss";

/* Styles handled by Tailwind utilities and shadcn-vue Button */
</style>
