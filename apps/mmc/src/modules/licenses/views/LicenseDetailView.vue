<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { License } from '@/types/license'

/**
 * T076: License Detail View - Full license information display
 * TODO: Connect to API route parameter
 */

const license = ref<License | null>(null)
const _loading = ref(false)

const _statusColor = computed(() => {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    SOFT_LOCKED: 'bg-yellow-100 text-yellow-800',
    ARCHIVED: 'bg-red-100 text-red-800',
    PENDING_PROVISION: 'bg-blue-100 text-blue-800',
  }
  return colors[license.value?.status || ''] || ''
})

onMounted(async () => {
  // TODO: Get license ID from route: const { id } = useRoute().params
  // TODO: Fetch license details from API
})
</script>

<template>
  <div v-if="loading" class="flex justify-center items-center h-96">
    <span>Loading...</span>
  </div>

  <div v-else-if="license" class="space-y-6">
    <Card>
      <CardHeader>
        <div class="flex justify-between items-start">
          <div>
            <CardTitle>{{ license.workspace_slug }}</CardTitle>
            <CardDescription class="font-mono">{{
              license.id
            }}</CardDescription>
          </div>
          <Badge :class="statusColor">{{ license.status }}</Badge>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm font-semibold">Product ID</label>
            <p class="font-mono">{{ license.product_id }}</p>
          </div>
          <div>
            <label class="text-sm font-semibold">Workspace ID</label>
            <p class="font-mono">{{ license.workspace_id }}</p>
          </div>
          <div>
            <label class="text-sm font-semibold">Student Limit</label>
            <p>{{ license.student_limit ?? 'Unlimited' }}</p>
          </div>
          <div>
            <label class="text-sm font-semibold">Staff Limit</label>
            <p>{{ license.staff_limit ?? 'Unlimited' }}</p>
          </div>
          <div>
            <label class="text-sm font-semibold">Created</label>
            <p>{{ new Date(license.created_at).toLocaleString() }}</p>
          </div>
          <div>
            <label class="text-sm font-semibold">Updated</label>
            <p>{{ new Date(license.updated_at).toLocaleString() }}</p>
          </div>
        </div>

        <!-- Grace period info if soft-locked -->
        <div
          v-if="license.status === 'SOFT_LOCKED' && license.soft_lock_until"
          class="bg-yellow-50 p-4 rounded"
        >
          <p class="text-sm font-semibold">Grace Period Ends</p>
          <p class="text-lg">
            {{ new Date(license.soft_lock_until).toLocaleString() }}
          </p>
        </div>

        <!-- Schema/Product version tracking -->
        <div class="border-t pt-4">
          <p class="text-sm font-semibold mb-2">Version Bindings</p>
          <div class="space-y-2 text-sm">
            <p>
              Schema Version:
              <span class="font-mono">{{
                license.expected_schema_version
              }}</span>
            </p>
            <p>
              Product Version:
              <span class="font-mono">{{
                license.expected_product_version
              }}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- TODO: Add action buttons section when LicenseActions ready -->
  </div>

  <div v-else class="text-center py-12">
    <p>License not found</p>
  </div>
</template>
