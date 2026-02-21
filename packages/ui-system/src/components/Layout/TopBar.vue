<template>
  <header class="topbar bg-white border-b border-gray-200 px-6 py-4">
    <div class="topbar-container flex items-center justify-between gap-8">
      <!-- Left section -->
      <div class="topbar-start flex items-center gap-4">
        <a v-if="logoUrl" href="/" class="topbar-logo flex items-center h-10">
          <img :src="logoUrl" :alt="appName" class="h-full w-auto" />
        </a>
        <div class="flex flex-col">
          <h1
            v-if="appName"
            class="topbar-brand text-lg font-semibold text-gray-900 m-0"
          >
            {{ appName }}
          </h1>
          <p v-if="subtitle" class="topbar-subtitle text-sm text-gray-500 m-0">
            {{ subtitle }}
          </p>
        </div>
      </div>

      <!-- Right section (slots) -->
      <div class="topbar-end flex items-center gap-4 ml-auto">
        <slot />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
interface TopBarProps {
  logoUrl?: string
  appName: string
  subtitle?: string
}

withDefaults(defineProps<TopBarProps>(), {
  appName: 'Zidney',
})
</script>

<style scoped>
@reference "tailwindcss";

.topbar-container {
  @apply flex items-center justify-between gap-8;
}

.topbar-logo {
  @apply flex items-center h-10;
}

.topbar-brand {
  @apply text-lg font-semibold text-gray-900 m-0;
}

.topbar-subtitle {
  @apply text-sm text-gray-500 m-0;
}

.topbar-end {
  @apply flex items-center gap-4 ml-auto;
}
</style>
