<script setup lang="ts">
/**
 * T089: Audit Log Viewer - Timeline of license state changes
 */

import { Badge } from '@zidney/ui/components/shadcn-vue/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@zidney/ui/components/shadcn-vue/card'
import { onMounted, ref } from 'vue'

interface AuditEntry {
  id: string
  action: string
  old_status?: string
  new_status?: string
  reason?: string
  correlation_id: string
  created_at: string
}

interface Props {
  licenseId: string
}

defineProps<Props>()

const auditLog = ref<AuditEntry[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    // TODO: Fetch audit log from API
    // GET /v1/mmc/licenses/:id/audit
  } finally {
    loading.value = false
  }
})

const getActionColor = (action: string) => {
  const colors: Record<string, string> = {
    created: 'bg-green-100',
    edited: 'bg-blue-100',
    soft_locked: 'bg-yellow-100',
    unlocked: 'bg-green-100',
    archived: 'bg-red-100',
    restored: 'bg-green-100',
    deleted: 'bg-red-200',
  }
  return colors[action] || 'bg-gray-100'
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Audit Trail</CardTitle>
    </CardHeader>
    <CardContent>
      <div v-if="loading" class="text-center py-8">
        <span>Loading audit log...</span>
      </div>

      <div v-else-if="auditLog.length > 0" class="space-y-4">
        <div
          v-for="entry in auditLog"
          :key="entry.id"
          :class="getActionColor(entry.action) + ' p-3 rounded'"
        >
          <div class="flex justify-between items-start mb-2">
            <Badge>{{ entry.action }}</Badge>
            <span class="text-xs text-gray-600">{{
              new Date(entry.created_at).toLocaleString()
            }}</span>
          </div>

          <div v-if="entry.old_status || entry.new_status" class="text-sm">
            <p>{{ entry.old_status }} → {{ entry.new_status }}</p>
          </div>

          <p v-if="entry.reason" class="text-sm">{{ entry.reason }}</p>

          <p class="text-xs text-gray-600 font-mono">
            {{ entry.correlation_id }}
          </p>
        </div>
      </div>

      <div v-else class="text-center py-8 text-gray-500">
        <p>No audit entries yet</p>
      </div>
    </CardContent>
  </Card>
</template>
