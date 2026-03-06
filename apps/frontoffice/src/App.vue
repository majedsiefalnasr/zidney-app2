<template>
  <RouterView v-if="route.meta.standaloneLayout === true" />
  <AppLayout v-else :hide-sidebar="route.meta.hideSidebar === true" />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>
