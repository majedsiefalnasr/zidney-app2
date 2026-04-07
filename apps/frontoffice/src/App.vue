<template>
  <ErrorBoundary>
    <!-- biome-ignore lint/correctness/noUnusedComponents: Toaster is a Vue component used in template -->
    <Toaster />
    <RouterView v-if="_route.meta.standaloneLayout === true" />
    <AppLayout v-else :hide-sidebar="_route.meta.hideSidebar === true" />
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
import { useFrontofficeNotificationStore } from '@/core/state/notification.store'

const _route = useRoute()

const notifStore = useFrontofficeNotificationStore()
const { visibleNotifications } = storeToRefs(notifStore)
const activeToasts = new Map<string, string>()

watch(
  visibleNotifications,
  (notifications) => {
    // Compute current set of notification IDs
    const currentIds = new Set(notifications.map((n) => n.id))

    // Create toasts for new notifications
    for (const n of notifications) {
      if (activeToasts.has(n.id)) continue
      const toastId = toast[n.type](n.title, { description: n.message, duration: n.duration })
      activeToasts.set(n.id, toastId as unknown as string)
    }

    // Dismiss toasts for removed notifications
    for (const [notifId, toastId] of activeToasts.entries()) {
      if (!currentIds.has(notifId)) {
        toast.dismiss(toastId)
        activeToasts.delete(notifId)
      }
    }
  },
  { immediate: true, deep: true }
)
</script>
