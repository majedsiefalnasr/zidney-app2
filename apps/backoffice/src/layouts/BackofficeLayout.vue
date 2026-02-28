<template>
  <AppLayout :appName="workspaceName">
    <template #topbar>
      <TopBar :appName="workspaceName" />
    </template>

    <template #sidebar>
      <SidebarLayout
        :items="navItems"
        :activeItem="activeNavItem"
        :collapsible="true"
        @item-click="handleNavClick"
      />
    </template>

    <!-- Default slot = ContentArea -->
    <slot />
  </AppLayout>
</template>

<script setup lang="ts">
/**
 * Backoffice Layout — STAGE_17
 *
 * File: apps/backoffice/src/layouts/BackofficeLayout.vue
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Composes AppLayout, SidebarLayout, TopBar from @zidney/ui-system.
 * Maps enabledModules from the Pinia context store into SidebarLayout items
 * using MODULE_LABELS from @zidney/types. No hardcoded module names.
 *
 * Constitutional Compliance:
 * ✓ Uses shadcn-vue components from @zidney/ui-system
 * ✓ Tailwind v4 utilities for layout and spacing
 * ✓ No hardcoded brand colors — page uses theme tokens only
 * ✓ No hardcoded module list — driven by enabledModules from store
 */

import type { Module } from '@zidney/types'
import { MODULE_LABELS } from '@zidney/types'
import { AppLayout, SidebarLayout, TopBar } from '@zidney/ui-system'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContextStore } from '../stores/context'

const contextStore = useContextStore()
const router = useRouter()
const route = useRoute()

const workspaceName = computed(
  () => contextStore.context?.workspace_slug ?? 'Backoffice'
)

// Build nav items from enabled_modules — NO hardcoded module list
const navItems = computed(() =>
  contextStore.enabledModules.map((mod: Module) => ({
    id: mod,
    label: MODULE_LABELS[mod]?.en ?? mod,
    show: true,
  }))
)

const activeNavItem = computed(
  () => (route.meta.requiredModule as string | undefined) ?? ''
)

function handleNavClick(item: { id: string }) {
  router.push({ name: item.id.toLowerCase() })
}
</script>
