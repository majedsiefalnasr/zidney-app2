<!--
  OfflineBanner Component — Frontoffice
  Renders a full-width destructive banner when the application loses network connectivity.
  Displays WiFi-off icon and informative message. Used in AppLayout.
  
  Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
-->
<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: used in Vue template
import { WifiOff } from 'lucide-vue-next'
import { useOfflineBanner } from '@/composables/useOfflineBanner'

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template v-if
const { showBanner } = useOfflineBanner()
</script>

<template>
  <div
    v-if="showBanner"
    role="status"
    class="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground text-sm"
  >
    <WifiOff class="h-4 w-4 shrink-0" aria-hidden="true" />
    <span>Connection lost — working offline. Some features may be unavailable.</span>
  </div>
</template>
