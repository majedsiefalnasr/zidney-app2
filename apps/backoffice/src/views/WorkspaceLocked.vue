<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen text-center p-8"
  >
    <h1 class="text-2xl font-semibold text-gray-900 mb-2">
      Workspace Suspended
    </h1>
    <p class="text-gray-500">
      This workspace has been temporarily suspended. Please contact support.
    </p>
    <p class="mt-4 text-sm text-gray-400">
      Error code: <code class="font-mono">LICENSE_SOFT_LOCKED</code>
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * WorkspaceLocked View — STAGE_17
 *
 * File: apps/backoffice/src/views/WorkspaceLocked.vue
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * 423 LICENSE_SOFT_LOCKED workspace-suspended screen.
 * Rendered when the router license gate detects non-ACTIVE workspace.
 *
 * Constitutional Compliance:
 * ✓ No hardcoded brand colors — uses Tailwind v4 + theme tokens
 * ✓ No API calls — purely presentational
 */
</script>
