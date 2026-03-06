<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Roles</h1>
        <p class="text-sm text-gray-500 mt-1">
          Manage staff roles and their permissions.
        </p>
      </div>
      <a
        v-if="canCreate"
        href="/roles/create"
        class="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Create Role
      </a>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-12 text-center text-sm text-gray-500">
      Loading roles…
    </div>

    <!-- 403 Access Denied -->
    <div
      v-else-if="forbidden"
      class="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center"
    >
      <p class="text-sm font-medium text-destructive">Access Denied</p>
      <p class="text-sm text-muted-foreground mt-1">
        You do not have permission to view roles.
      </p>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center"
    >
      <p class="text-sm font-medium text-destructive">{{ error.message }}</p>
    </div>

    <!-- Roles table -->
    <div v-else class="rounded-md border border-border overflow-hidden">
      <!-- Empty state -->
      <div
        v-if="roles.length === 0"
        class="py-12 text-center text-sm text-muted-foreground"
      >
        No roles found. Create one to get started.
      </div>

      <!-- Table -->
      <table v-else class="w-full text-sm">
        <thead class="bg-muted text-muted-foreground">
          <tr>
            <th class="px-4 py-3 text-left font-medium">Name</th>
            <th class="px-4 py-3 text-left font-medium">Status</th>
            <th class="px-4 py-3 text-left font-medium">Created</th>
            <th class="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="role in roles"
            :key="role.id"
            class="border-t border-border hover:bg-muted/30 transition-colors"
          >
            <td class="px-4 py-3 font-medium text-foreground">
              <a :href="`/roles/${role.id}`" class="hover:underline">{{
                role.name
              }}</a>
            </td>
            <td class="px-4 py-3">
              <!-- shadcn-vue Switch for inline status toggle -->
              <div class="flex items-center gap-2">
                <button
                  v-if="canEdit"
                  :disabled="togglingId === role.id"
                  :aria-checked="role.status === 'ACTIVE'"
                  :aria-label="`Toggle ${role.name} status`"
                  role="switch"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                  :class="role.status === 'ACTIVE' ? 'bg-primary' : 'bg-input'"
                  @click="toggleStatus(role)"
                >
                  <span
                    class="inline-block h-4 w-4 rounded-full bg-background shadow-sm transform transition-transform"
                    :class="
                      role.status === 'ACTIVE'
                        ? 'translate-x-4'
                        : 'translate-x-0.5'
                    "
                  />
                </button>
                <span
                  class="text-xs font-medium"
                  :class="
                    role.status === 'ACTIVE'
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  "
                >
                  {{ role.status === 'ACTIVE' ? 'Active' : 'Disabled' }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3 text-muted-foreground">
              {{ formatDate(role.created_at) }}
            </td>
            <td class="px-4 py-3 text-right">
              <a
                :href="`/roles/${role.id}`"
                class="text-primary hover:underline text-xs mr-3"
              >
                Edit
              </a>
              <button
                v-if="canDelete"
                class="text-destructive hover:underline text-xs disabled:opacity-50"
                :disabled="deletingId === role.id"
                @click="deleteRole(role.id)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="roles.length > 0"
      class="flex items-center justify-between mt-4 text-sm text-muted-foreground"
    >
      <span>Page {{ page }} of {{ totalPages }}</span>
      <div class="flex gap-2">
        <button
          :disabled="page <= 1"
          class="px-3 py-1 rounded border hover:bg-muted disabled:opacity-40"
          @click="prev"
        >
          Previous
        </button>
        <button
          :disabled="page >= totalPages"
          class="px-3 py-1 rounded border hover:bg-muted disabled:opacity-40"
          @click="next"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * RolesListPage — STAGE_21
 *
 * File: apps/backoffice/src/pages/roles/RolesListPage.vue
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 *
 * Displays paginated list of workspace roles.
 * Inline status toggle via PATCH /api/v1/backoffice/workspace/roles/:id.
 * Uses usePermission() for display-only UI gate (not authorization).
 *
 * Constitutional Compliance:
 * ✓ Display-only usePermission — no client-side auth enforcement
 * ✓ credentials: 'include' — cookie auth; no Authorization header
 * ✓ shadcn-vue Switch pattern via native button with role="switch"
 * ✓ No hardcoded workspace identity
 * ✓ 403 access-denied state handled
 */

import { computed, onMounted, ref } from 'vue'
import { fetch } from '@/core/api/client'
import { usePermission } from '../../composables/usePermission'

type Role = {
  id: string
  name: string
  status: 'ACTIVE' | 'DISABLED'
  created_at: string
}

type PaginatedRoles = {
  roles: Role[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

const { can, fetchPermissions } = usePermission()

const roles = ref<Role[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const forbidden = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const togglingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)

/** Display-only guards — server enforces actual access */
const _canCreate = computed(() => can('settings', 'create'))
const _canEdit = computed(() => can('settings', 'edit'))
const _canDelete = computed(() => can('settings', 'delete'))

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

async function loadRoles(): Promise<void> {
  loading.value = true
  forbidden.value = false
  error.value = null
  try {
    const response = await fetch(
      `/api/v1/backoffice/workspace/roles?page=${page.value}&pageSize=${PAGE_SIZE}`,
      { credentials: 'include' }
    )
    if (response.status === 403) {
      forbidden.value = true
      return
    }
    const json = (await response.json()) as {
      success: boolean
      data: PaginatedRoles | null
      error: { code: string; message: string } | null
    }
    if (!json.success || !json.data) {
      error.value = json.error ?? {
        code: 'UNKNOWN',
        message: 'Failed to load roles',
      }
      return
    }
    roles.value = json.data.roles
    total.value = json.data.total
  } catch {
    error.value = { code: 'NETWORK_ERROR', message: 'Failed to load roles' }
  } finally {
    loading.value = false
  }
}

async function _toggleStatus(role: Role): Promise<void> {
  if (togglingId.value === role.id) return
  togglingId.value = role.id
  const newStatus = role.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try {
    const response = await fetch(`/api/v1/backoffice/workspace/roles/${role.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (response.ok) {
      role.status = newStatus
    }
  } finally {
    togglingId.value = null
  }
}

async function _deleteRole(roleId: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this role?')) return
  deletingId.value = roleId
  try {
    const response = await fetch(`/api/v1/backoffice/workspace/roles/${roleId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (response.status === 204 || response.ok) {
      roles.value = roles.value.filter((r) => r.id !== roleId)
      total.value = Math.max(0, total.value - 1)
    }
  } finally {
    deletingId.value = null
  }
}

function _prev(): void {
  if (page.value > 1) {
    page.value--
    void loadRoles()
  }
}

function _next(): void {
  if (page.value < totalPages.value) {
    page.value++
    void loadRoles()
  }
}

function _formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

onMounted(async () => {
  await fetchPermissions()
  await loadRoles()
})
</script>
