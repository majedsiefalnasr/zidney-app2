<template>
  <div class="audit-trail-viewer">
    <div class="viewer-header">
      <h2>Audit Trail</h2>
      <div class="controls">
        <input
          v-model="dateFrom"
          type="date"
          placeholder="From"
          class="date-input"
        />
        <input
          v-model="dateTo"
          type="date"
          placeholder="To"
          class="date-input"
        />
        <select v-model="filterActorType" class="select-input">
          <option value="">All Actors</option>
          <option value="ADMIN">Admin</option>
          <option value="SYSTEM">System</option>
        </select>
        <button @click="downloadAudit" class="btn btn-secondary">Export</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading audit trail...</div>

    <div v-if="!loading && auditLogs.length === 0" class="empty">
      No audit logs found.
    </div>

    <div v-else class="timeline">
      <div v-for="log in auditLogs" :key="log.id" class="timeline-entry">
        <div class="timeline-marker"></div>
        <div class="timeline-content">
          <div class="header">
            <span class="timestamp">{{ formatDate(log.timestamp) }}</span>
            <span class="actor">{{
              log.actor_type === 'ADMIN' ? `Admin: ${log.actor_id}` : 'System'
            }}</span>
          </div>
          <div class="transition">
            <span class="status status-from">{{ log.previous_status }}</span>
            <span class="arrow">→</span>
            <span class="status status-to">{{ log.new_status }}</span>
          </div>
          <p class="reason">{{ log.reason }}</p>
          <div v-if="log.transition_metadata" class="metadata">
            <pre>{{ JSON.stringify(log.transition_metadata, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasMore" class="load-more">
      <button @click="loadMore" class="btn btn-primary">Load More</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface AuditLog {
  id: string
  license_id: string
  previous_status: string
  new_status: string
  actor_id?: string
  actor_type: 'ADMIN' | 'SYSTEM'
  reason: string
  transition_metadata?: Record<string, unknown>
  timestamp: Date
}

interface Props {
  licenseId: string
}

const _props = defineProps<Props>()

const loading = ref(true)
const _auditLogs = ref<AuditLog[]>([])
const _dateFrom = ref('')
const _dateTo = ref('')
const _filterActorType = ref('')
const offset = ref(0)
const limit = 50
const _hasMore = ref(false)

onMounted(async () => {
  await loadAuditLogs()
})

async function loadAuditLogs() {
  try {
    loading.value = true
    // TODO: Phase 7 implementation
    // Build query params from filters
    // Call GET /api/v1/licenses/{licenseId}/audit-trail
    // Handle pagination
    // auditLogs.value = response.logs
    // hasMore.value = response.total_count > offset + limit
  } catch (err: unknown) {
    // biome-ignore lint/suspicious/noConsole: frontend error boundary
    console.error('Failed to load audit logs:', err)
  } finally {
    loading.value = false
  }
}

function _loadMore() {
  offset.value += limit
  loadAuditLogs()
}

async function _downloadAudit() {
  try {
    // TODO: Trigger CSV/JSON export
    // Query all logs with current filters
    // Generate and download file
    // biome-ignore lint/correctness/noUnreachable: catch block retained as error boundary for pending TODO implementation
  } catch (err: unknown) {
    // biome-ignore lint/suspicious/noConsole: frontend error boundary
    console.error('Failed to export audit logs:', err)
  }
}

function _formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString()
}
</script>

<style scoped>
.audit-trail-viewer {
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.viewer-header h2 {
  margin: 0;
}

.controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.date-input,
.select-input {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.timeline {
  position: relative;
  padding-left: 2rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 0.5rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}

.timeline-entry {
  position: relative;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
}

.timeline-marker {
  position: absolute;
  left: -0.875rem;
  top: 0.25rem;
  width: 1.25rem;
  height: 1.25rem;
  background: white;
  border: 2px solid #3b82f6;
  border-radius: 50%;
}

.timeline-content {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.timestamp {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.actor {
  font-size: 0.75rem;
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
}

.transition {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  background: #f0f9ff;
  color: #0369a1;
}

.status-from {
  background: #fee2e2;
  color: #991b1b;
}

.status-to {
  background: #dcfce7;
  color: #166534;
}

.arrow {
  color: #9ca3af;
}

.reason {
  margin: 0.5rem 0 0 0;
  color: #374151;
  font-size: 0.875rem;
}

.metadata {
  margin-top: 0.5rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  padding: 0.5rem;
  font-size: 0.75rem;
  overflow-x: auto;
}

.metadata pre {
  margin: 0;
  color: #374151;
}

.loading,
.empty {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.load-more {
  text-align: center;
  margin-top: 1.5rem;
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

.btn-secondary {
  background-color: #e5e7eb;
  color: #111827;
}
</style>
