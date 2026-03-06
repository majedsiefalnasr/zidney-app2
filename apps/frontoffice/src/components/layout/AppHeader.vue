<template>
  <TopBar :appName="appTitle">
    <slot name="left" />
    <div class="app-header__search-placeholder" aria-hidden="true" />
    <div class="app-header__notification-placeholder" aria-hidden="true" />
    <slot name="right" />
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button
          class="app-header__avatar"
          :aria-label="`User menu for ${userName}`"
        >
          <Avatar>
            <AvatarFallback>{{ userInitials }}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled class="pointer-events-none">{{
          userName
        }}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="handleLogout">Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TopBar>
</template>

<script setup lang="ts">
/**
 * Frontoffice AppHeader
 * Renders the application top bar with user avatar and logout dropdown.
 * Reads user name from the Frontoffice auth store.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */
import { useFrontofficeAuthStore } from '@/core/state/auth.store'
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  TopBar,
} from '@zidney/ui-system'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

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

const authStore = useFrontofficeAuthStore()
const { user } = storeToRefs(authStore)

const appTitle = 'Zidney'

const userName = computed(() => user.value?.name ?? '')

const userInitials = computed(() => {
  const name = user.value?.name ?? ''
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .slice(0, 2)
    .join('')
})

async function handleLogout(): Promise<void> {
  try {
    await authStore.logout()
  } catch {
    // Errors handled inside auth store — do not propagate uncaught rejections
  }
}
</script>
