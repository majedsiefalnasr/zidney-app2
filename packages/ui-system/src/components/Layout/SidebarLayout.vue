<template>
  <aside
    :class="[
      'sidebar-layout flex flex-col h-full bg-white border-r border-gray-200 transition-all',
      { 'w-16': isCollapsed, 'w-64': !isCollapsed },
    ]"
  >
    <!-- Header -->
    <div class="shrink-0 p-4 border-b border-gray-200">
      <Button
        v-if="collapsible"
        variant="ghost"
        size="sm"
        @click="toggleCollapse"
        :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        class="w-full"
      >
        ☰
      </Button>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav flex-1 overflow-y-auto p-2">
      <ul class="space-y-1">
        <li v-for="item in items" :key="item.id" v-show="item.show !== false">
          <Button
            :variant="activeItem === item.id ? 'default' : 'ghost'"
            :disabled="item.disabled"
            @click="handleItemClick(item)"
            :class="[
              'w-full justify-start gap-2',
              { 'opacity-50 cursor-not-allowed': item.disabled },
            ]"
            :title="isCollapsed && item.label ? item.label : ''"
          >
            <span v-if="item.icon" class="shrink-0">{{ item.icon }}</span>
            <span
              v-if="!isCollapsed"
              class="overflow-hidden text-ellipsis whitespace-nowrap"
              >{{ item.label }}</span
            >
            <Badge
              v-if="item.badge && !isCollapsed"
              variant="secondary"
              class="ml-auto"
              >{{ item.badge }}</Badge
            >
          </Button>
        </li>
      </ul>
    </nav>

    <!-- Footer -->
    <div v-if="$slots.footer" class="shrink-0 p-4 border-t border-gray-200">
      <slot name="footer" />
    </div>

    <slot />
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Badge } from '../shadcn-vue/badge'
import { Button } from '../shadcn-vue/button'

interface NavItem {
  id: string
  label: string
  icon?: string
  href?: string
  disabled?: boolean
  show?: boolean
  badge?: number
  children?: NavItem[]
}

interface SidebarLayoutProps {
  items: NavItem[]
  collapsible?: boolean
  /** @deprecated Use `collapsed` for reactive binding. `defaultCollapsed` sets initial value only. */
  defaultCollapsed?: boolean
  /** Reactive collapsed state — driven by Pinia ui.store.sidebarCollapsed */
  collapsed?: boolean
  activeItem?: string
}

const props = withDefaults(defineProps<SidebarLayoutProps>(), {
  collapsible: true,
  defaultCollapsed: false,
  collapsed: undefined,
})

const emit = defineEmits<{
  'item-clicked': [item: NavItem]
  'collapse-toggled': [isCollapsed: boolean]
}>()

// Initialize from `collapsed` if provided, otherwise fall back to `defaultCollapsed`
const isCollapsed = ref(props.collapsed !== undefined ? props.collapsed : props.defaultCollapsed)

// T055: Watch-synced collapsed prop — keeps isCollapsed in sync with external Pinia state
watch(
  () => props.collapsed,
  (val) => {
    if (val !== undefined) {
      isCollapsed.value = val
    }
  }
)

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  emit('collapse-toggled', isCollapsed.value)
}

const handleItemClick = (item: NavItem) => {
  if (!item.disabled) {
    emit('item-clicked', item)
  }
}
</script>

<style scoped>
@reference "tailwindcss";

.sidebar-nav {
  @apply flex-1 overflow-y-auto p-2;
}

.sidebar-nav ul {
  @apply space-y-1 list-none p-0 m-0;
}
</style>
