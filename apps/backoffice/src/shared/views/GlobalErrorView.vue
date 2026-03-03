<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center"
  >
    <h1 class="text-2xl font-bold">Something Went Wrong</h1>
    <p class="text-muted-foreground">
      An unexpected error occurred. Please try again.
    </p>
    <RouterLink
      :to="{ name: 'bo-dashboard' }"
      class="text-primary underline underline-offset-4 hover:no-underline"
    >
      Return to Dashboard
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
// Stage: STAGE_UI_03_ROUTER_AND_GUARDS
// Public route — do NOT expose error details.
// Error details must never be shown to the user in this component.
</script>
