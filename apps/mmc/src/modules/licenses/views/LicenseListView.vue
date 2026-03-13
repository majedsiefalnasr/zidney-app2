<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { License } from '@/types/license'

/**
 * T075: License List View
 *
 * Displays paginated table of licenses with filtering and status indicators
 * TODO: Bind to real API when pattern library ready
 */

const licenses = ref<License[]>([])
const loading = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const selectedStatus = ref<string | null>(null)

const _paginatedLicenses = computed(() => {
  let filtered = licenses.value

  if (searchQuery.value) {
    filtered = filtered.filter(
      (l) =>
        l.workspace_slug.includes(searchQuery.value) || l.product_id.includes(searchQuery.value)
    )
  }

  if (selectedStatus.value) {
    filtered = filtered.filter((l) => l.status === selectedStatus.value)
  }

  const start = (currentPage.value - 1) * pageSize.value
  return filtered.slice(start, start + pageSize.value)
})

const _statusBadgeVariant = (status: string) => {
  const variants: Record<string, string> = {
    ACTIVE: 'default',
    SOFT_LOCKED: 'secondary',
    ARCHIVED: 'destructive',
    PENDING_PROVISION: 'outline',
  }
  return variants[status] || 'outline'
}

onMounted(() => {
  // TODO: Fetch licenses from API
  // fetchLicenses()
})

const _fetchLicenses = async () => {
  loading.value = true
  try {
    // TODO: Bind to API endpoint
    // const response = await api.get('/v1/mmc/licenses', { params: { status: selectedStatus.value } })
    // licenses.value = response.data.items
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-4">
      <Input
        v-model="searchQuery"
        placeholder="Search by workspace or product..."
        class="flex-1"
      />
      <Button @click="fetchLicenses" :disabled="loading">
        {{ loading ? 'Loading...' : 'Refresh' }}
      </Button>
    </div>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workspace Slug</TableHead>
          <TableHead>Product ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Student Limit</TableHead>
          <TableHead>Staff Limit</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="license in paginatedLicenses" :key="license.id">
          <TableCell class="font-mono">{{ license.workspace_slug }}</TableCell>
          <TableCell class="font-mono text-sm"
            >{{ license.product_id.slice(0, 8) }}...</TableCell
          >
          <TableCell>
            <Badge :variant="statusBadgeVariant(license.status)">
              {{ license.status }}
            </Badge>
          </TableCell>
          <TableCell>{{ license.student_limit ?? '-' }}</TableCell>
          <TableCell>{{ license.staff_limit ?? '-' }}</TableCell>
          <TableCell class="text-sm">{{
            new Date(license.created_at).toLocaleDateString()
          }}</TableCell>
          <TableCell>
            <!-- TODO: Add action buttons when LicenseActions component ready -->
            <span class="text-xs text-gray-500">View | Edit</span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <!-- TODO: Add pagination controls when pattern library ready -->
    <div class="flex justify-between items-center text-sm">
      <span
        >Page {{ currentPage }} of
        {{ Math.ceil(licenses.length / pageSize) }}</span
      >
      <div class="flex gap-2">
        <!-- Pagination buttons -->
      </div>
    </div>
  </div>
</template>
