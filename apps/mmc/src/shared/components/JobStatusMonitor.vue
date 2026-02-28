<template>
  <div class="job-status-monitor">
    <div class="progress-section">
      <p class="status-text">{{ statusText }}</p>
      <div class="progress-bar" v-if="status === 'RUNNING'">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <p v-if="currentStep" class="step-text">{{ currentStep }}</p>
      <p v-if="eta" class="eta-text">ETA: {{ eta }}</p>
    </div>

    <div v-if="status === 'COMPLETED'" class="completed">
      <p>✓ Completed at {{ completedAt }}</p>
    </div>

    <div v-if="status === 'FAILED'" class="error-section">
      <p class="error-message">{{ errorMessage }}</p>
      <button @click="handleRetry" class="btn btn-primary">Retry</button>
      <button @click="handleContact" class="btn btn-secondary">
        Contact Support
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface Props {
  jobId: string
  jobName: string
  initialStatus?: string
}

const props = defineProps<Props>()

type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

const status = ref<JobStatus>((props.initialStatus as JobStatus) || 'QUEUED')
const progress = ref(0)
const currentStep = ref<string | null>(null)
const eta = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const completedAt = ref<string | null>(null)

const statusText = computed(() => {
  const texts = {
    QUEUED: 'Waiting in queue...',
    RUNNING: 'Processing...',
    COMPLETED: 'Complete',
    FAILED: 'Failed',
  }
  return texts[status.value]
})

onMounted(async () => {
  // TODO: Phase 7 implementation
  // Use job polling helper to poll job status
  // Update progress, currentStep, eta based on response
  // Automatically close dialog on completion or error
})

function handleRetry() {
  // TODO: Retry job
}

function handleContact() {
  // TODO: Open support contact dialog
}
</script>

<style scoped>
.job-status-monitor {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 6px;
}

.progress-section {
  margin-bottom: 1rem;
}

.status-text {
  margin: 0 0 0.5rem 0;
  font-weight: 500;
  color: #111827;
}

.progress-bar {
  background: #e5e7eb;
  border-radius: 4px;
  height: 24px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  background: #3b82f6;
  height: 100%;
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
}

.step-text {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.eta-text {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.completed {
  padding: 1rem;
  background: #dcfce7;
  border: 1px solid #86efac;
  border-radius: 4px;
  color: #166534;
}

.error-section {
  padding: 1rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 4px;
}

.error-message {
  margin: 0 0 1rem 0;
  color: #7f1d1d;
}
</style>
