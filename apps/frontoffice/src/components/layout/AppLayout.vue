<template>
  <div
    class="app-layout"
    :class="{
      'app-layout--mobile': isMobile,
      'app-layout--collapsed': sidebarCollapsed,
    }"
  >
    <!-- Sidebar (suppressed when hideSidebar=true, e.g. for attempt runtime) -->
    <AppSidebar v-if="!hideSidebar" :navigation-config="navigationConfig">
      <template #footer>
        <slot name="sidebar-footer" />
      </template>
    </AppSidebar>

    <!-- Main content area -->
    <div class="app-layout__main">
      <!-- Header -->
      <AppHeader :show-workspace="false">
        <template #left>
          <slot name="header-left" />
        </template>
        <template #right>
          <slot name="header-right" />
        </template>
      </AppHeader>

      <!-- Content -->
      <main class="app-layout__content">
        <slot name="content-top" />
        <RouterView />
        <slot name="content-bottom" />
      </main>
    </div>

    <!-- Mobile backdrop (only when sidebar is visible) -->
    <div
      v-if="!hideSidebar && isMobile && !sidebarCollapsed"
      class="app-layout__backdrop"
      aria-hidden="true"
      @click="toggleSidebar"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Frontoffice AppLayout
 * Composes AppHeader and AppSidebar into the full application shell.
 * Accepts hideSidebar prop to suppress the sidebar (e.g. during exam attempts).
 * Initializes useBreakpoint composable for responsive sidebar behavior.
 * showWorkspaceInHeader=false (Frontoffice does not show workspace name).
 * Exposes 5 named slots: header-left, header-right, sidebar-footer, content-top, content-bottom.
 * Contains <router-view /> directly — App.vue uses self-closing <AppLayout v-else />.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */
import { useBreakpoint } from '@/composables/useBreakpoint'
import { navigationConfig } from '@/core/navigation/index'
import { useFrontofficeUiStore } from '@/core/state/ui.store'
import { storeToRefs } from 'pinia'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

interface AppLayoutProps {
  hideSidebar?: boolean
}

withDefaults(defineProps<AppLayoutProps>(), {
  hideSidebar: false,
})

useBreakpoint()

const uiStore = useFrontofficeUiStore()
const { sidebarCollapsed, isMobile } = storeToRefs(uiStore)

function toggleSidebar(): void {
  uiStore.toggleSidebar()
}
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.app-layout__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.app-layout__content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.app-layout__backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 30;
}

.app-layout--mobile .app-layout__main {
  /* On mobile, main takes full width; sidebar overlays */
  width: 100%;
}
</style>
