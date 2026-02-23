<script setup lang="ts">
/**
 * T091: Role-Based Menu Visibility
 * Shows/hides license menu items based on user role
 */

import { useAuthStore } from '@/stores/auth'

interface MenuItem {
  label: string
  href: string
  icon?: string
  requiredRoles: string[]
}

const auth = useAuthStore()

const menuItems: MenuItem[] = [
  {
    label: 'Licenses',
    href: '/mmc/licenses',
    icon: '📋',
    requiredRoles: ['mmc_admin'],
  },
  {
    label: 'Create License',
    href: '/mmc/licenses/new',
    icon: '➕',
    requiredRoles: ['mmc_admin'],
  },
  {
    label: 'License Reports',
    href: '/mmc/licenses/reports',
    icon: '📊',
    requiredRoles: ['mmc_admin'],
  },
]

const visibleItems = computed(() => {
  return menuItems.filter((item) => item.requiredRoles.includes(auth.userRole))
})

import { computed } from 'vue'
</script>

<template>
  <nav class="space-y-2">
    <a
      v-for="item in visibleItems"
      :key="item.href"
      :href="item.href"
      class="flex items-center gap-2 px-4 py-2 rounded hover:bg-gray-100"
    >
      <span v-if="item.icon">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </a>
  </nav>
</template>
