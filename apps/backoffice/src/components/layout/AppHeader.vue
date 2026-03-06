<template>
  <TopBar
    :appName="appTitle"
    :subtitle="showWorkspace ? workspaceName : undefined"
  >
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
 * Backoffice AppHeader
 * Renders the application top bar with user avatar and logout dropdown.
 * Optionally shows workspace name when showWorkspace=true.
 * Reads user name from the Backoffice auth store and workspace from workspace store.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */
import { useBackofficeAuthStore } from '@/core/state/auth.store'
import { useBackofficeWorkspaceStore } from '@/core/state/workspace.store'
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

const authStore = useBackofficeAuthStore()
const workspaceStore = useBackofficeWorkspaceStore()
const { user } = storeToRefs(authStore)
const { workspace } = storeToRefs(workspaceStore)

const appTitle = 'Backoffice'

const workspaceName = computed(() => workspace.value?.name ?? '')

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
