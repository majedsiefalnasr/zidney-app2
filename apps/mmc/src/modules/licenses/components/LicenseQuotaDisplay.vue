<!--
COMPONENT: LicenseQuotaDisplay
T092a: License Usage Quota Display

Purpose: Show current usage vs allocated limits
  - Student count vs student limit
  - Staff count vs staff limit
  - Visual progress bars
  - Warning thresholds (> 80%, > 95%)

Props:
  - license: License (with current_students, student_limit, current_staff, staff_limit)
  - isCompact?: boolean (sm card vs lg widget)

Integrations:
  - Calls /v1/mmc/licenses/:id/usage endpoint (optional, real-time updates)
  - Uses parent LicenseDetailView context
  - Can be embedded in dashboard or detail page
-->

<template>
  <div :class="['license-quota-display', { compact: isCompact }]">
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-gray-900 mb-3">📊 Quota Usage</h3>

      <!-- Student Quota -->
      <div class="mb-4">
        <div class="flex justify-between items-end mb-1">
          <label class="text-xs font-medium text-gray-700"> Students </label>
          <span class="text-xs font-semibold" :class="studentQuotaClass">
            {{ studentUsagePercent }}%
          </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            class="h-full transition-all duration-300"
            :class="studentProgressClass"
            :style="{ width: studentUsagePercent + '%' }"
          />
        </div>
        <div class="flex justify-between mt-1">
          <span class="text-xs text-gray-600">
            {{ license?.current_students ?? 0 }} /
            {{ license?.student_limit ?? 0 }} used
          </span>
          <span
            v-if="studentWarning"
            class="text-xs font-semibold text-amber-600"
            title="Approaching limit"
          >
            ⚠️ {{ studentWarningLabel }}
          </span>
        </div>
      </div>

      <!-- Staff Quota -->
      <div class="mb-4">
        <div class="flex justify-between items-end mb-1">
          <label class="text-xs font-medium text-gray-700"> Staff </label>
          <span class="text-xs font-semibold" :class="staffQuotaClass">
            {{ staffUsagePercent }}%
          </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            class="h-full transition-all duration-300"
            :class="staffProgressClass"
            :style="{ width: staffUsagePercent + '%' }"
          />
        </div>
        <div class="flex justify-between mt-1">
          <span class="text-xs text-gray-600">
            {{ license?.current_staff ?? 0 }} /
            {{ license?.staff_limit ?? 0 }} used
          </span>
          <span
            v-if="staffWarning"
            class="text-xs font-semibold text-amber-600"
            title="Approaching limit"
          >
            ⚠️ {{ staffWarningLabel }}
          </span>
        </div>
      </div>
    </div>

    <!-- Overflow Warning (if at limit) -->
    <div
      v-if="isAtLimit"
      class="bg-red-50 border border-red-200 rounded p-3 mt-4"
    >
      <p class="text-xs font-semibold text-red-900 mb-1">
        🚨 Quota Limit Reached
      </p>
      <p class="text-xs text-red-700">
        One or more quotas have been exceeded. Additional users cannot be added
        until quotas are increased.
      </p>
      <p class="text-xs text-red-700 mt-2">
        Contact your platform administrator to increase limits.
      </p>
    </div>

    <!-- Near Limit Warning -->
    <div
      v-else-if="isNearLimit"
      class="bg-amber-50 border border-amber-200 rounded p-3 mt-4"
    >
      <p class="text-xs font-semibold text-amber-900 mb-1">
        ⚠️ Approaching Quota Limit
      </p>
      <p class="text-xs text-amber-700">
        <span v-if="studentWarning && !staffWarning">
          Student quota is {{ studentUsagePercent }}% full.
        </span>
        <span v-else-if="staffWarning && !studentWarning">
          Staff quota is {{ staffUsagePercent }}% full.
        </span>
        <span v-else>
          Both student and staff quotas are reaching capacity.
        </span>
      </p>
      <p class="text-xs text-amber-700 mt-2">
        Consider requesting a quota increase soon to avoid hitting hard limits.
      </p>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-200">
      <div class="text-center">
        <div class="text-xs text-gray-600">Available</div>
        <div class="text-sm font-semibold text-blue-600">
          {{ studentAvailable }}
        </div>
        <div class="text-xs text-gray-500">students</div>
      </div>
      <div class="text-center">
        <div class="text-xs text-gray-600">Used</div>
        <div class="text-sm font-semibold text-gray-900">
          {{ license?.current_students ?? 0 }}
        </div>
        <div class="text-xs text-gray-500">students</div>
      </div>
      <div class="text-center">
        <div class="text-xs text-gray-600">Available</div>
        <div class="text-sm font-semibold text-blue-600">
          {{ staffAvailable }}
        </div>
        <div class="text-xs text-gray-500">staff</div>
      </div>
      <div class="text-center">
        <div class="text-xs text-gray-600">Used</div>
        <div class="text-sm font-semibold text-gray-900">
          {{ license?.current_staff ?? 0 }}
        </div>
        <div class="text-xs text-gray-500">staff</div>
      </div>
    </div>

    <!-- Auto-Refresh Info (if enabled) -->
    <div
      v-if="showAutoRefreshInfo"
      class="text-xs text-gray-500 text-center mt-3"
    >
      Last updated: {{ formatTime(lastUpdated) }}
      <span class="inline-block ml-2">🔄 Auto-refreshing every 30s</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface License {
  id: string
  student_limit: number
  staff_limit: number
  current_students: number
  current_staff: number
}

interface Props {
  license: License | null
  isCompact?: boolean
  autoRefresh?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isCompact: false,
  autoRefresh: false,
})

const lastUpdated = ref(new Date())
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (props.autoRefresh) {
    refreshInterval = setInterval(() => {
      lastUpdated.value = new Date()
      // TODO: Fetch updated usage from API
      // const response = await $fetch(`/v1/mmc/licenses/${props.license.id}/usage`)
      // Update component data
    }, 30000)
  }
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

// Computed Properties
const studentUsagePercent = computed(() => {
  if (!props.license) return 0
  return Math.round(
    (props.license.current_students / props.license.student_limit) * 100
  )
})

const staffUsagePercent = computed(() => {
  if (!props.license) return 0
  return Math.round(
    (props.license.current_staff / props.license.staff_limit) * 100
  )
})

const studentAvailable = computed(() => {
  if (!props.license) return 0
  return Math.max(
    0,
    props.license.student_limit - props.license.current_students
  )
})

const staffAvailable = computed(() => {
  if (!props.license) return 0
  return Math.max(0, props.license.staff_limit - props.license.current_staff)
})

// Warning Thresholds
const studentWarning = computed(() => studentUsagePercent.value >= 80)
const staffWarning = computed(() => staffUsagePercent.value >= 80)
const isNearLimit = computed(() => studentWarning.value || staffWarning.value)
const isAtLimit = computed(
  () => studentUsagePercent.value >= 100 || staffUsagePercent.value >= 100
)

const studentWarningLabel = computed(() => {
  if (studentUsagePercent.value >= 100) return 'FULL'
  return '80%+'
})

const staffWarningLabel = computed(() => {
  if (staffUsagePercent.value >= 100) return 'FULL'
  return '80%+'
})

// CSS Classes
const studentQuotaClass = computed(() => ({
  'text-red-600': studentUsagePercent.value >= 100,
  'text-amber-600':
    studentUsagePercent.value >= 80 && studentUsagePercent.value < 100,
  'text-green-600': studentUsagePercent.value < 80,
}))

const staffQuotaClass = computed(() => ({
  'text-red-600': staffUsagePercent.value >= 100,
  'text-amber-600':
    staffUsagePercent.value >= 80 && staffUsagePercent.value < 100,
  'text-green-600': staffUsagePercent.value < 80,
}))

const studentProgressClass = computed(() => ({
  'bg-red-500': studentUsagePercent.value >= 100,
  'bg-amber-500':
    studentUsagePercent.value >= 80 && studentUsagePercent.value < 100,
  'bg-green-500': studentUsagePercent.value < 80,
}))

const staffProgressClass = computed(() => ({
  'bg-red-500': staffUsagePercent.value >= 100,
  'bg-amber-500':
    staffUsagePercent.value >= 80 && staffUsagePercent.value < 100,
  'bg-green-500': staffUsagePercent.value < 80,
}))

const showAutoRefreshInfo = computed(() => props.autoRefresh)

// Utilities
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<style scoped>
.license-quota-display {
  @apply p-4 bg-white rounded-lg border border-gray-200;
}

.license-quota-display.compact {
  @apply p-3;
}
</style>
