<template>
  <div class="flex flex-col h-full">
    <SidebarLayout
      :items="filteredNavItems"
      :activeItem="activeItem"
      :collapsible="true"
      @item-click="$emit('nav', $event)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Sidebar Component — STAGE_17
 *
 * File: apps/backoffice/src/components/Sidebar.vue
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Sidebar component filtered by enabledModules from useContextStore().
 * Wraps SidebarLayout from @zidney/ui-system.
 * Data-driven navigation only — no hardcoded module names.
 *
 * Constitutional Compliance:
 * ✓ Uses SidebarLayout from @zidney/ui-system
 * ✓ No hardcoded module names — driven by enabledModules store
 * ✓ No business logic — pure display component
 */

import type { Module } from '@zidney/types'
import { MODULE_LABELS } from '@zidney/types'
import { SidebarLayout } from '@zidney/ui-system'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useContextStore } from '../stores/context'

defineEmits<{
  nav: [item: { id: string }]
}>()

const contextStore = useContextStore()
const route = useRoute()

// Build nav items from enabledModules — no hardcoded list
const filteredNavItems = computed(() =>
  contextStore.enabledModules.map((mod: Module) => ({
    id: mod,
    label: MODULE_LABELS[mod]?.en ?? mod,
    show: true,
  }))
)

const activeItem = computed(
  () => (route.meta.requiredModule as string | undefined) ?? ''
)
</script>
