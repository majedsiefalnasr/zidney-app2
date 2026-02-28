<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen text-center p-8"
  >
    <h1 class="text-2xl font-semibold text-gray-900 mb-2">
      Workspace Archived
    </h1>
    <p class="text-gray-500">
      This workspace has been permanently archived and is no longer accessible.
    </p>
    <p class="mt-4 text-sm text-gray-400">
      Error code: <code class="font-mono">LICENSE_ARCHIVED</code>
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * WorkspaceForbidden View — STAGE_17
 *
 * File: apps/backoffice/src/views/WorkspaceForbidden.vue
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * 403 LICENSE_ARCHIVED workspace-archived screen.
 * Rendered when the router license gate detects an ARCHIVED workspace.
 *
 * Constitutional Compliance:
 * ✓ No hardcoded brand colors — uses Tailwind v4 + theme tokens
 * ✓ No API calls — purely presentational
 */
</script>
