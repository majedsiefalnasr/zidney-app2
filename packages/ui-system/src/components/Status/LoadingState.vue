<template>
  <div :class="['loading-state flex flex-col gap-6 p-8', { 'min-h-screen flex-col justify-center': fullHeight, 'min-h-48': !fullHeight }]">
    <!-- Skeleton loaders -->
    <div v-for="i in 3" :key="i" class="loading-skeleton space-y-4">
      <div class="skeleton-line skeleton-short" />
      <div class="skeleton-line" />
      <div class="skeleton-line skeleton-short" />
    </div>

    <!-- Optional message -->
    <p v-if="message" class="text-center text-gray-600 text-sm mt-8">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  message?: string
  fullHeight?: boolean
}

withDefaults(defineProps<Props>(), {
  fullHeight: false,
})
</script>

<style scoped>
.skeleton-line {
  @apply h-4 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-sm animate-pulse;
}

.skeleton-short {
  @apply w-3/4;
}

.loading-skeleton {
  @apply flex flex-col gap-4;
}
</style>
