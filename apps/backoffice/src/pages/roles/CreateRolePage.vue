<template>
  <BackofficeLayout>
    <div class="p-8 max-w-2xl">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-6">
        <a
          href="/roles"
          class="text-sm text-muted-foreground hover:text-foreground"
          >← Roles</a
        >
        <h1 class="text-2xl font-semibold text-gray-900">Create Role</h1>
      </div>

      <!-- 403 -->
      <div
        v-if="forbidden"
        class="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center"
      >
        <p class="text-sm font-medium text-destructive">Access Denied</p>
        <p class="text-sm text-muted-foreground mt-1">
          You do not have permission to create roles.
        </p>
      </div>

      <!-- Form -->
      <form v-else class="space-y-6" @submit.prevent="submit">
        <!-- Name -->
        <div class="space-y-1">
          <label
            for="role-name"
            class="block text-sm font-medium text-foreground"
          >
            Role Name <span class="text-destructive">*</span>
          </label>
          <input
            id="role-name"
            v-model="form.name"
            type="text"
            maxlength="100"
            placeholder="e.g. Content Manager"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            :class="nameError ? 'border-destructive ring-destructive/20' : ''"
            @input="nameError = null"
          />
          <p v-if="nameError" class="text-xs text-destructive">
            {{ nameError }}
          </p>
        </div>

        <!-- Description -->
        <div class="space-y-1">
          <label
            for="role-description"
            class="block text-sm font-medium text-foreground"
          >
            Description
          </label>
          <textarea
            id="role-description"
            v-model="form.description"
            rows="3"
            maxlength="500"
            placeholder="Optional description of this role's responsibilities"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>

        <!-- Permission Matrix -->
        <div class="rounded-md border border-border overflow-hidden">
          <div class="px-4 py-3 bg-muted">
            <h2 class="text-sm font-semibold text-foreground">Permissions</h2>
            <p class="text-xs text-muted-foreground mt-0.5">
              All flags default to off. Enable only what this role needs.
            </p>
          </div>

          <div
            v-if="loadingModules"
            class="px-4 py-6 text-center text-sm text-muted-foreground"
          >
            Loading modules…
          </div>

          <div v-else class="overflow-x-auto">
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
                      :checked="form.permissions[mod.key]?.[action] ?? false"
                      class="h-4 w-4 rounded border-input text-primary focus:ring-ring"
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

        <!-- Module error (422) -->
        <p v-if="moduleError" class="text-xs text-destructive">
          {{ moduleError }}
        </p>

        <!-- Submit -->
        <div class="flex items-center gap-4">
          <button
            type="submit"
            :disabled="submitting"
            class="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {{ submitting ? 'Creating…' : 'Create Role' }}
          </button>
          <a
            href="/roles"
            class="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  </BackofficeLayout>
</template>

<script setup lang="ts">
/**
 * CreateRolePage — STAGE_21
 *
 * File: apps/backoffice/src/pages/roles/CreateRolePage.vue
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 *
 * Form to create a new role with name, description, and permission matrix.
 * Submits via POST /api/v1/backoffice/workspace/roles.
 * On success, redirects to /roles/:id (the created role's detail page).
 *
 * Error handling:
 * - 409 ROLE_NAME_CONFLICT → inline name field error
 * - 422 INVALID_MODULE → inline module error below the matrix
 * - 403 → access-denied state
 *
 * Constitutional Compliance:
 * ✓ Display-only usePermission — no client-side auth enforcement
 * ✓ credentials: 'include' — cookie auth
 * ✓ shadcn-vue Input / Checkbox via native elements styled with Tailwind tokens
 * ✓ All flags default to false (deny-by-default)
 * ✓ Safe error messages — no internal structure exposed
 */

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePermission } from '../../composables/usePermission'
import BackofficeLayout from '../../layouts/BackofficeLayout.vue'

type PermissionFlags = {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

type ModuleEntry = { key: string; display_name: string }

const router = useRouter()
const { fetchPermissions } = usePermission()

const form = ref<{
  name: string
  description: string
  permissions: Record<string, PermissionFlags>
}>({
  name: '',
  description: '',
  permissions: {},
})

const moduleList = ref<ModuleEntry[]>([])
const loadingModules = ref(false)
const forbidden = ref(false)
const submitting = ref(false)
const nameError = ref<string | null>(null)
const moduleError = ref<string | null>(null)

function setPermission(
  module: string,
  flag: keyof PermissionFlags,
  value: boolean
): void {
  if (!form.value.permissions[module]) {
    form.value.permissions[module] = {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    }
  }
  form.value.permissions[module][flag] = value
}

async function loadModules(): Promise<void> {
  loadingModules.value = true
  try {
    const response = await fetch(
      '/api/v1/backoffice/workspace/role-permission-modules',
      {
        credentials: 'include',
      }
    )
    if (response.status === 403) {
      forbidden.value = true
      return
    }
    const json = (await response.json()) as {
      success: boolean
      data: { modules?: ModuleEntry[] } | null
    }
    if (json.success && json.data?.modules) {
      moduleList.value = json.data.modules
      // Initialize all modules to default-off
      for (const mod of moduleList.value) {
        form.value.permissions[mod.key] = {
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
        }
      }
    }
  } catch {
    // Non-blocking — user can still submit without module list
  } finally {
    loadingModules.value = false
  }
}

async function submit(): Promise<void> {
  nameError.value = null
  moduleError.value = null

  if (!form.value.name.trim()) {
    nameError.value = 'Role name is required'
    return
  }

  submitting.value = true
  try {
    const response = await fetch('/api/v1/backoffice/workspace/roles', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        permissions: form.value.permissions,
      }),
    })

    if (response.status === 403) {
      forbidden.value = true
      return
    }

    const json = (await response.json()) as {
      success: boolean
      data: { id: string } | null
      error: { code: string; message: string } | null
    }

    if (!json.success) {
      const code = json.error?.code
      if (code === 'ROLE_NAME_CONFLICT') {
        nameError.value = 'A role with this name already exists'
      } else if (code === 'INVALID_MODULE') {
        moduleError.value = 'One or more module keys are invalid'
      } else {
        nameError.value = 'Failed to create role. Please try again.'
      }
      return
    }

    if (json.data?.id) {
      await router.push(`/roles/${json.data.id}`)
    } else {
      await router.push('/roles')
    }
  } catch {
    nameError.value = 'Failed to create role. Please try again.'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await fetchPermissions()
  await loadModules()
})
</script>
