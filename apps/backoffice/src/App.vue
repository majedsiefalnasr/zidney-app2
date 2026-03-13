<template>
  <RouterView v-if="_route.meta.standaloneLayout === true" />
  <AppLayout v-else />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const _route = useRoute()
</script>
