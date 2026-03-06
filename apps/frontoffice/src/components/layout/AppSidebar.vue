<template>
  <SidebarLayout
    :items="sidebarItems"
    :collapsed="sidebarCollapsed"
    :collapsible="true"
    :active-item="activeRouteName"
    @collapse-toggled="toggleSidebar"
  >
    <!-- FR-030: Group label separator rows (non-interactive) -->
    <template v-if="hasGroups">
      <div
        v-for="group in visibleGroups"
        :key="group.label ?? '__default__'"
        class="app-sidebar__group"
      >
        <div
          v-if="group.label && !sidebarCollapsed"
          class="app-sidebar__group-label"
          role="separator"
          aria-hidden="true"
        >
          {{ group.label }}
        </div>
        <RouterLink
          v-for="item in group.visibleItems"
          :key="item.routeName"
          :to="{ name: item.routeName }"
          class="app-sidebar__nav-item"
          :class="{
            'app-sidebar__nav-item--active': activeRouteName === item.routeName,
          }"
          :title="sidebarCollapsed ? item.label : undefined"
        >
          <span v-if="item.icon" class="app-sidebar__nav-icon shrink-0">{{
            item.icon
          }}</span>
          <span v-if="!sidebarCollapsed" class="app-sidebar__nav-label">{{
            item.label
          }}</span>
        </RouterLink>
      </div>
    </template>

    <!-- Mobile overlay backdrop -->
    <teleport to="body" v-if="isMobile && !sidebarCollapsed">
      <div
        class="app-sidebar__backdrop"
        aria-hidden="true"
        @click="toggleSidebar"
      />
    </teleport>

    <template #footer>
      <slot name="footer" />
    </template>
  </SidebarLayout>
</template>

<script setup lang="ts">
/**
 * Frontoffice AppSidebar
 * Renders the application sidebar with navigation items filtered by permissions.
 * Highlights active route and drives collapse state from ui.store.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */
import type { NavigationConfig, NavigationGroup } from '@/core/navigation/index'
import { useFrontofficeAuthStore } from '@/core/state/auth.store'
import { useFrontofficeUiStore } from '@/core/state/ui.store'
import { SidebarLayout } from '@zidney/ui-system'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface AppSidebarProps {
  navigationConfig: NavigationConfig
}

const props = defineProps<AppSidebarProps>()

defineSlots<{
  footer(): void
}>()

const uiStore = useFrontofficeUiStore()
const authStore = useFrontofficeAuthStore()
const route = useRoute()

const { sidebarCollapsed, isMobile } = storeToRefs(uiStore)
const { resolvedPermissions } = storeToRefs(authStore)

const activeRouteName = computed(() => String(route.name ?? ''))

function canView(permission?: string): boolean {
  if (!permission) return true
  return resolvedPermissions.value[permission] === true
}

interface VisibleGroup {
  label?: string
  visibleItems: NavigationConfig[number]['items']
}

const visibleGroups = computed((): VisibleGroup[] =>
  props.navigationConfig
    .map((group: NavigationGroup) => ({
      label: group.label,
      visibleItems: group.items.filter((item) => canView(item.permission)),
    }))
    .filter((group) => group.visibleItems.length > 0)
)

const hasGroups = computed(() => visibleGroups.value.length > 0)

// Flatten items for SidebarLayout (it expects a flat list)
const sidebarItems = computed(() =>
  visibleGroups.value.flatMap((group) =>
    group.visibleItems.map((item) => ({
      id: item.routeName,
      label: item.label,
      icon: item.icon,
      show: true,
    }))
  )
)

function toggleSidebar(): void {
  uiStore.toggleSidebar()
}
</script>

<style scoped>
.app-sidebar__group-label {
  padding: 0.5rem 1rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted-foreground, #6b7280);
  pointer-events: none;
  user-select: none;
}

.app-sidebar__nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  text-decoration: none;
  color: inherit;
  transition: background-color 0.15s;
}

.app-sidebar__nav-item:hover {
  background-color: var(--color-accent, #f3f4f6);
}

.app-sidebar__nav-item--active {
  background-color: var(--color-primary, #3b82f6);
  color: var(--color-primary-foreground, #ffffff);
}

.app-sidebar__backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 40;
}
</style>
