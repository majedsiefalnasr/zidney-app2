<template>
  <ErrorBoundary>
    <!-- biome-ignore lint/correctness/noUnusedComponents: Toaster is a Vue component used in template -->
    <Toaster />
    <RouterView v-if="_route.meta.standaloneLayout === true" />
    <AppLayout v-else />
  </ErrorBoundary>
</template>

<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: used as Vue component in template
import { Toaster } from '@zidney/ui-system'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
// biome-ignore lint/correctness/noUnusedImports: used as Vue component in template
import ErrorBoundary from '@/core/errors/ErrorBoundary.vue'
import { useBackofficeNotificationStore } from '@/core/state/notification.store'

const _route = useRoute()

const notifStore = useBackofficeNotificationStore()
const { visibleNotifications } = storeToRefs(notifStore)
const seen = new Set<string>()
watch(
  visibleNotifications,
  (notifications) => {
    for (const n of notifications) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      toast[n.type](n.title, { description: n.message, duration: n.duration })
    }
  },
  { deep: true }
)
</script>
