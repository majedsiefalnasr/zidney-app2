<template>
  <div class="app-layout flex flex-col h-screen bg-white">
    <!-- Topbar -->
    <header v-if="$slots.topbar" class="shrink-0 border-b border-gray-200">
      <slot name="topbar" />
    </header>

    <!-- Main container -->
    <div class="app-layout__container flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <aside
        v-if="$slots.sidebar"
        class="shrink-0 w-64 border-r border-gray-200 overflow-y-auto"
      >
        <slot name="sidebar" />
      </aside>

      <!-- Main content -->
      <main class="app-layout__main flex-1 overflow-y-auto p-4">
        <slot />
      </main>
    </div>

    <!-- Footer -->
    <footer v-if="$slots.footer" class="shrink-0 border-t border-gray-200">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup lang="ts">
interface AppLayoutProps {
  logoUrl?: string
  appName: string
  subtitle?: string
}

withDefaults(defineProps<AppLayoutProps>(), {
  appName: 'Zidney',
})
</script>

<style scoped>
@reference "tailwindcss";

.app-layout__container {
  @apply flex flex-1 overflow-hidden;
}

.app-layout__main {
  @apply flex-1 overflow-y-auto p-4;
}
</style>
