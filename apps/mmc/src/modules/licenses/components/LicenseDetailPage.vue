<template>
  <div class="license-detail-page">
    <div class="page-header">
      <h1>License Details</h1>
      <div
        class="status-badge"
        :class="`status-${license?.status?.toLowerCase()}`"
      >
        {{ license?.status || 'LOADING' }}
      </div>
    </div>

    <div v-if="loading" class="loading">Loading license details...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="license" class="license-details">
      <!-- License Info -->
      <div class="section">
        <h2>License Information</h2>
        <div class="details-grid">
          <div class="detail-row">
            <span class="label">License ID:</span>
            <span class="value">{{ license.id }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Workspace:</span>
            <span class="value">{{ license.workspace_slug }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Product Version:</span>
            <span class="value">{{ license.product_version }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Schema Version:</span>
            <span class="value">{{ license.schema_version }}</span>
          </div>
        </div>
      </div>

      <!-- Status-specific Actions -->
      <div class="section">
        <h2>Actions</h2>
        <div class="actions">
          <button
            v-if="license.status === 'ACTIVE'"
            @click="showSoftLockDialog = true"
            class="btn btn-warning"
          >
            Soft Lock
          </button>
          <button
            v-if="license.status === 'SOFT_LOCKED'"
            @click="showRenewDialog = true"
            class="btn btn-primary"
          >
            Renew
          </button>
          <button
            v-if="license.status === 'SOFT_LOCKED'"
            @click="archiveLicense"
            class="btn btn-danger"
          >
            Archive
          </button>
          <button
            v-if="license.status === 'ARCHIVED'"
            @click="showRestoreDialog = true"
            class="btn btn-primary"
          >
            Restore
          </button>
          <button
            v-if="license.status === 'ARCHIVED'"
            @click="showDeleteDialog = true"
            class="btn btn-danger"
          >
            Permanently Delete
          </button>
        </div>
      </div>

      <!-- Soft Lock Info (if applicable) -->
      <div v-if="license.status === 'SOFT_LOCKED'" class="section">
        <h2>Soft Lock Expiry</h2>
        <p>Expires in: {{ formatCountdown(license.soft_lock_until) }}</p>
      </div>

      <!-- TODO: Phase 7 implementation
        - Wire up dialog components
        - Connect to API endpoints
        - Show job status during async operations
        - Implement 2FA for delete confirmation
      -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface License {
  id: string
  status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED' | 'DELETED'
  workspace_slug: string
  product_version: string
  schema_version: number
  soft_lock_until?: Date
}

const license = ref<License | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const showSoftLockDialog = ref(false)
const showRenewDialog = ref(false)
const showRestoreDialog = ref(false)
const showDeleteDialog = ref(false)

onMounted(async () => {
  try {
    loading.value = true
    // TODO: Fetch license details from API
    // const response = await fetch(`/api/v1/licenses/${licenseId}`)
    // license.value = await response.json()
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

function formatCountdown(date?: Date): string {
  if (!date) return 'Unknown'
  // TODO: Implement countdown formatting
  return 'Days remaining'
}

async function archiveLicense() {
  try {
    // TODO: Call archive API endpoint
    // const response = await fetch(`/api/v1/licenses/${license.value?.id}/archive`, { method: 'POST' })
  } catch (err: any) {
    error.value = err.message
  }
}
</script>

<style scoped>
.license-detail-page {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: bold;
  color: white;
}

.status-active {
  background-color: #22c55e;
}

.status-soft_locked {
  background-color: #eab308;
}

.status-archived {
  background-color: #ef4444;
}

.status-deleted {
  background-color: #6b7280;
}

.section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
}

.label {
  font-weight: 500;
  color: #374151;
}

.value {
  color: #111827;
  font-family: monospace;
}

.actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-warning {
  background-color: #f59e0b;
  color: white;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.loading,
.error {
  padding: 2rem;
  text-align: center;
  background: white;
  border-radius: 8px;
}

.error {
  color: #dc2626;
  border: 1px solid #fecaca;
  background-color: #fee2e2;
}
</style>
