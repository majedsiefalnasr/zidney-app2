<template>
  <TopBar :appName="_appTitle">
    <slot name="left" />
    <div class="app-header__search-placeholder" aria-hidden="true" />
    <div class="app-header__notification-placeholder" aria-hidden="true" />
    <slot name="right" />
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button
          class="app-header__avatar"
          :aria-label="`User menu for ${_userName}`"
        >
          <Avatar>
            <AvatarFallback>{{ _userInitials }}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled class="pointer-events-none">{{
          _userName
        }}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="_handleLogout">Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TopBar>
</template>

<script setup lang="ts">
/**
 * MMC AppHeader
 * Renders the application top bar with user avatar and logout dropdown.
 * Reads user name from the MMC auth store.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */

import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useMmcAuthStore } from '@/core/state/auth.store'

interface AppHeaderProps {
  showWorkspace?: boolean
}

withDefaults(defineProps<AppHeaderProps>(), {
  showWorkspace: false,
})

defineSlots<{
  left(): void
  right(): void
}>()

const authStore = useMmcAuthStore()
const { user } = storeToRefs(authStore)

const _appTitle = 'MMC'

const _userName = computed(() => user.value?.name ?? '')

const _userInitials = computed(() => {
  const name = user.value?.name ?? ''
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
})

async function _handleLogout(): Promise<void> {
  try {
    await authStore.logout()
  } catch {
    // Errors handled inside auth store — do not propagate uncaught rejections
  }
}
</script>
