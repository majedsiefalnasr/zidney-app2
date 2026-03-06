<template>
  <RouterView v-if="route.meta.standaloneLayout === true" />
  <AppLayout v-else />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'

const route = useRoute()
</script>
