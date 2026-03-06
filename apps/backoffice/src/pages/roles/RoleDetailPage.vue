<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <a
        href="/roles"
        class="text-sm text-muted-foreground hover:text-foreground"
        >← Roles</a
      >
      <h1 class="text-2xl font-semibold text-gray-900">
        {{ role ? role.name : 'Role Detail' }}
      </h1>
      <span
        v-if="role"
        class="px-2 py-0.5 rounded text-xs font-medium"
        :class="
          role.status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-gray-100 text-gray-600'
        "
      >
        {{ role.status === 'ACTIVE' ? 'Active' : 'Disabled' }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-12 text-center text-sm text-muted-foreground">
      Loading…
    </div>

    <!-- 403 -->
    <div
      v-else-if="forbidden"
      class="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center"
    >
      <p class="text-sm font-medium text-destructive">Access Denied</p>
      <p class="text-sm text-muted-foreground mt-1">
        You do not have permission to view this role.
      </p>
    </div>

    <!-- 404 -->
    <div
      v-else-if="notFound"
      class="rounded-md border border-muted p-6 text-center"
    >
      <p class="text-sm font-medium text-foreground">Role not found</p>
      <a href="/roles" class="text-sm text-primary hover:underline mt-2 block"
        >Return to roles list</a
      >
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center"
    >
      <p class="text-sm font-medium text-destructive">{{ error.message }}</p>
    </div>

    <!-- Content -->
    <div v-else-if="role">
      <!-- Role metadata -->
      <div class="rounded-md border border-border p-6 mb-6">
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="font-medium text-muted-foreground">Name</dt>
            <dd class="mt-1 text-foreground">{{ role.name }}</dd>
          </div>
          <div>
            <dt class="font-medium text-muted-foreground">Status</dt>
            <dd class="mt-1 text-foreground">{{ role.status }}</dd>
          </div>
          <div v-if="role.description" class="col-span-2">
            <dt class="font-medium text-muted-foreground">Description</dt>
            <dd class="mt-1 text-foreground">{{ role.description }}</dd>
          </div>
        </dl>
      </div>

      <!-- Permission Matrix -->
      <div class="rounded-md border border-border overflow-hidden mb-6">
        <div class="px-4 py-3 bg-muted">
          <h2 class="text-sm font-semibold text-foreground">
            Permission Matrix
          </h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground">
              <tr>
                <th class="px-4 py-2 text-left font-medium w-48">Module</th>
                <th class="px-4 py-2 text-center font-medium">View</th>
                <th class="px-4 py-2 text-center font-medium">Create</th>
                <th class="px-4 py-2 text-center font-medium">Edit</th>
                <th class="px-4 py-2 text-center font-medium">Delete</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="mod in moduleList"
                :key="mod.key"
                class="border-t border-border hover:bg-muted/20"
              >
                <td class="px-4 py-3 font-medium text-foreground">
                  {{ mod.display_name }}
                </td>
                <td
                  v-for="action in [
                    'can_view',
                    'can_create',
                    'can_edit',
                    'can_delete',
                  ] as const"
                  :key="action"
                  class="px-4 py-3 text-center"
                >
                  <input
                    type="checkbox"
                    :checked="getPermission(mod.key, action)"
                    :disabled="!canEdit"
                    class="h-4 w-4 rounded border-input text-primary focus:ring-ring disabled:opacity-50"
                    @change="
                      setPermission(
                        mod.key,
                        action,
                        ($event.target as HTMLInputElement).checked
                      )
                    "
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Save permissions button -->
      <div v-if="canEdit" class="flex items-center gap-3">
        <button
          :disabled="saving"
          class="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          @click="savePermissions"
        >
          {{ saving ? 'Saving…' : 'Save Permissions' }}
        </button>
        <span v-if="saveSuccess" class="text-sm text-emerald-600">Saved!</span>
        <span v-if="saveError" class="text-sm text-destructive">{{
          saveError
        }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * RoleDetailPage — STAGE_21
 *
 * File: apps/backoffice/src/pages/roles/RoleDetailPage.vue
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 *
 * Displays role metadata and allows editing the permission matrix.
 * Submits changes via PUT /api/v1/backoffice/workspace/roles/:id/permissions.
 * Uses usePermission() for display-only UI gates.
 *
 * Permission matrix:
 * - 10 rows (one per module from GET /role-permission-modules)
 * - 4 columns: can_view / can_create / can_edit / can_delete
 * - Checked state = current role permission
 * - Disabled when user lacks settings.can_edit
 *
 * Constitutional Compliance:
 * ✓ Display-only usePermission — no client-side auth enforcement
 * ✓ credentials: 'include' — cookie auth
 * ✓ shadcn-vue Checkbox via native input type="checkbox"
 * ✓ All server errors normalized to safe messages
 */

import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetch } from '@/core/api/client'
import { usePermission } from '../../composables/usePermission'

type Role = {
  id: string
  name: string
  description?: string | null
  status: 'ACTIVE' | 'DISABLED'
  created_at: string
}

type PermissionFlags = {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

type ModuleEntry = {
  key: string
  display_name: string
}

const route = useRoute()
const roleId = computed(() => route.params.id as string)

const { can, fetchPermissions } = usePermission()
const _canEdit = computed(() => can('settings', 'edit'))

const role = ref<Role | null>(null)
const permissions = ref<Record<string, PermissionFlags>>({})
const moduleList = ref<ModuleEntry[]>([])
const loading = ref(false)
const forbidden = ref(false)
const notFound = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref<string | null>(null)

function _getPermission(module: string, flag: keyof PermissionFlags): boolean {
  return permissions.value[module]?.[flag] ?? false
}

function _setPermission(module: string, flag: keyof PermissionFlags, value: boolean): void {
  if (!permissions.value[module]) {
    permissions.value[module] = {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    }
  }
  permissions.value[module][flag] = value
}

async function loadRoleAndPermissions(): Promise<void> {
  loading.value = true
  forbidden.value = false
  notFound.value = false
  error.value = null

  try {
    const [roleResponse, moduleResponse] = await Promise.all([
      fetch(`/api/v1/backoffice/workspace/roles/${roleId.value}`, {
        credentials: 'include',
      }),
      fetch('/api/v1/backoffice/workspace/role-permission-modules', {
        credentials: 'include',
      }),
    ])

    if (roleResponse.status === 403) {
      forbidden.value = true
      return
    }
    if (roleResponse.status === 404) {
      notFound.value = true
      return
    }

    const roleJson = (await roleResponse.json()) as {
      success: boolean
      data: (Role & { permissions?: Record<string, PermissionFlags> }) | null
      error: { code: string; message: string } | null
    }

    if (!roleJson.success || !roleJson.data) {
      error.value = roleJson.error ?? {
        code: 'UNKNOWN',
        message: 'Failed to load role',
      }
      return
    }

    role.value = roleJson.data
    permissions.value = roleJson.data.permissions ?? {}

    if (moduleResponse.ok) {
      const modJson = (await moduleResponse.json()) as {
        success: boolean
        data: { modules?: ModuleEntry[] } | null
      }
      if (modJson.success && modJson.data?.modules) {
        moduleList.value = modJson.data.modules
        // Ensure all modules have an entry in permissions
        for (const mod of moduleList.value) {
          if (!permissions.value[mod.key]) {
            permissions.value[mod.key] = {
              can_view: false,
              can_create: false,
              can_edit: false,
              can_delete: false,
            }
          }
        }
      }
    }
  } catch {
    error.value = { code: 'NETWORK_ERROR', message: 'Failed to load role' }
  } finally {
    loading.value = false
  }
}

async function _savePermissions(): Promise<void> {
  if (saving.value) return
  saving.value = true
  saveSuccess.value = false
  saveError.value = null

  try {
    const response = await fetch(`/api/v1/backoffice/workspace/roles/${roleId.value}/permissions`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: permissions.value }),
    })
    if (response.status === 403) {
      saveError.value = 'Access denied'
      return
    }
    if (response.status === 404) {
      saveError.value = 'Role not found'
      return
    }
    const json = (await response.json()) as {
      success: boolean
      error: { code: string; message: string } | null
    }
    if (!json.success) {
      saveError.value =
        json.error?.code === 'INVALID_MODULE'
          ? 'One or more module keys are invalid'
          : 'Failed to save permissions'
      return
    }
    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch {
    saveError.value = 'Failed to save permissions'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await fetchPermissions()
  await loadRoleAndPermissions()
})
</script>
