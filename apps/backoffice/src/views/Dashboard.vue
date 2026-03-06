<template>
  <div class="p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
    <p class="text-gray-500">
      Welcome to <strong>{{ workspaceSlug }}</strong
      >. Select a module from the sidebar to get started.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Dashboard View — STAGE_17
 *
 * File: apps/backoffice/src/views/Dashboard.vue
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Placeholder landing page rendered on /.
 * Reads workspace_slug from useContextStore() for display.
 * No hardcoded workspace identity.
 *
 * Constitutional Compliance:
 * ✓ workspace_slug from store only — not hardcoded
 * ✓ No additional API calls — context is already loaded by router guard
 */

import { computed } from 'vue'
import { useContextStore } from '../stores/context'

const contextStore = useContextStore()

const workspaceSlug = computed(
  () => contextStore.context?.workspace_slug ?? 'your workspace'
)
</script>
