<template>
  <ErrorBoundary>
    <RouterView v-if="_route.meta.standaloneLayout === true" />
    <AppLayout v-else :hide-sidebar="_route.meta.hideSidebar === true" />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

// biome-ignore lint/correctness/noUnusedImports: used as Vue component in template
import ErrorBoundary from '@/core/errors/ErrorBoundary.vue'

const _route = useRoute()
</script>
