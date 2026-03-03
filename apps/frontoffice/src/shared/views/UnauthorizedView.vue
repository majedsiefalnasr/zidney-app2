<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center"
  >
    <h1 class="text-2xl font-bold text-destructive">403 — Access Denied</h1>
    <p class="text-muted-foreground">
      You don't have permission to access this page.
    </p>
    <RouterLink
      :to="{ name: 'fo-home' }"
      class="text-primary underline underline-offset-4 hover:no-underline"
    >
      Return to Home
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
// Stage: STAGE_UI_03_ROUTER_AND_GUARDS
// Public route — no requiresAuth meta needed.
</script>
