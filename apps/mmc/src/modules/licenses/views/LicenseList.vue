/** * License List View Component (Stub) * * File:
apps/mmc/src/views/licenses/LicenseList.vue * Task: T075 * * Displays paginated
list of licenses with filters and actions. * Full Vue 3 component
implementation. */

<template>
  <div class="license-list-container">
    <!-- Header with Create Button -->
    <div class="license-list-header">
      <h1>License Management</h1>
      <button @click="navigateToCreate" class="btn btn-primary">
        + Create License
      </button>
    </div>

    <!-- Filters -->
    <div class="license-filters">
      <div class="filter-group">
        <select v-model="filters.status" @change="handleFilterChange">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SOFT_LOCKED">Soft Locked</option>
          <option value="ARCHIVED">Archived</option>
          <option value="PENDING_PROVISION">Pending</option>
          <option value="PROVISION_FAILED">Failed</option>
        </select>
      </div>

      <div class="filter-group">
        <input
          v-model="filters.search"
          type="text"
          placeholder="Search by slug or name..."
          @input="handleFilterChange"
        />
      </div>

      <div class="filter-group">
        <button @click="handleReset" class="btn btn-secondary">
          Reset Filters
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-spinner">Loading licenses...</div>

    <!-- Empty State -->
    <div v-else-if="licenses.length === 0" class="empty-state">
      <p>No licenses found. Create your first license to get started.</p>
      <button @click="navigateToCreate" class="btn btn-primary">
        Create License
      </button>
    </div>

    <!-- Licenses Table -->
    <table v-else class="license-table">
      <thead>
        <tr>
          <th>Workspace</th>
          <th>Product</th>
          <th>Status</th>
          <th>Limits</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="license in licenses" :key="license.id">
          <td>
            <strong>{{ license.workspace_slug }}</strong
            ><br />
            <small>{{ license.workspace_name }}</small>
          </td>
          <td>{{ license.product_id }}</td>
          <td>
            <LicenseStatusBadge :status="license.status" />
          </td>
          <td>
            <small>
              Students: {{ license.student_limit || '∞' }}<br />
              Staff: {{ license.staff_limit || '∞' }}
            </small>
          </td>
          <td>{{ formatDate(license.created_at) }}</td>
          <td class="actions">
            <button
              @click="viewDetail(license)"
              class="btn btn-sm"
              title="View Details"
            >
              View
            </button>
            <button
              @click="editLicense(license)"
              class="btn btn-sm"
              title="Edit"
            >
              Edit
            </button>
            <button
              @click="showActions(license)"
              class="btn btn-sm"
              title="More Actions"
            >
              ⋯
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button @click="previousPage" :disabled="page === 1" class="btn btn-sm">
        ← Previous
      </button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button
        @click="nextPage"
        :disabled="page === totalPages"
        class="btn btn-sm"
      >
        Next →
      </button>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-banner">
      {{ error }}
      <button @click="error = null" class="close-btn">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { licensesApi } from '@/modules/licenses/api'
import LicenseStatusBadge from '@/modules/licenses/components/LicenseStatusBadge.vue'
import type { License } from '@zidney/domain-core/licenses/types'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

// State
const licenses = ref<License[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const page = ref(1)
const limit = ref(20)
const totalPages = ref(1)
const filters = ref({
  status: '',
  search: '',
})

const router = useRouter()

// Methods
async function fetchLicenses() {
  loading.value = true
  error.value = null

  try {
    const result = await licensesApi.listLicenses(filters.value, {
      page: page.value,
      limit: limit.value,
    })

    licenses.value = result.licenses
    totalPages.value = result.pagination.pages
  } catch (err: any) {
    error.value = err.message || 'Failed to load licenses'
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  page.value = 1
  fetchLicenses()
}

function handleReset() {
  filters.value = { status: '', search: '' }
  page.value = 1
  fetchLicenses()
}

function previousPage() {
  if (page.value > 1) {
    page.value--
    fetchLicenses()
  }
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++
    fetchLicenses()
  }
}

function viewDetail(license: License) {
  router.push(`/licenses/${license.id}`)
}

function editLicense(license: License) {
  // Open edit modal or navigate
  router.push(`/licenses/${license.id}?edit=true`)
}

function showActions(license: License) {
  // Show action menu
  console.log('Actions for', license.id)
}

function navigateToCreate() {
  router.push('/licenses/new')
}

function formatDate(date: any): string {
  return new Date(date).toLocaleDateString()
}

// Lifecycle
onMounted(() => {
  fetchLicenses()
})
</script>

<style scoped lang="css">
.license-list-container {
  padding: 2rem;
}

.license-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.license-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.filter-group {
  flex: 1;
  min-width: 150px;
}

.filter-group select,
.filter-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.license-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
}

.license-table th,
.license-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.license-table th {
  background-color: #f5f5f5;
  font-weight: 600;
}

.license-table tr:hover {
  background-color: #fafafa;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  background-color: white;
  font-size: 0.9rem;
}

.btn-primary {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 1rem;
  align-items: center;
  margin-top: 2rem;
}

.loading-spinner {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.error-banner {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  color: #721c24;
  cursor: pointer;
  font-size: 1.5rem;
}
</style>
