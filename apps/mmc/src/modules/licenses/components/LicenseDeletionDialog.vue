<template>
  <div v-if="isopen" class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2>Permanently Delete License</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>

      <div class="modal-body">
        <div class="warning-box">
          <p class="warning-text">
            ⚠️ This action is irreversible. All data will be permanently
            deleted:
          </p>
          <ul>
            <li>Tenant database dropped</li>
            <li>All snapshots deleted from S3</li>
            <li>License permanently marked DELETED</li>
            <li>No recovery option available</li>
          </ul>
        </div>

        <!-- Step 1: Confirmation phrase -->
        <div v-if="step === 1" class="step">
          <h3>Step 1: Confirm Deletion</h3>
          <p>Type the following phrase exactly to proceed:</p>
          <div class="confirmation-phrase">
            <code>{{ confirmationPhrase }}</code>
          </div>
          <input
            v-model="userInput"
            type="text"
            placeholder="Enter confirmation phrase here"
            class="input-field"
            @input="validatePhrase"
          />
          <p v-if="phraseError" class="error-text">{{ phraseError }}</p>
          <button
            @click="proceedToTwoFa"
            :disabled="!phraseMatches"
            class="btn btn-danger btn-large"
          >
            Proceed to 2FA
          </button>
        </div>

        <!-- Step 2: 2FA Verification -->
        <div v-if="step === 2" class="step">
          <h3>Step 2: Two-Factor Authentication</h3>
          <p>Enter your 2FA code:</p>
          <input
            v-model="twoFaCode"
            type="text"
            placeholder="000000"
            maxlength="6"
            class="input-field input-code"
          />
          <p v-if="twoFaError" class="error-text">{{ twoFaError }}</p>
          <button
            @click="completeDeletion"
            :disabled="twoFaCode.length !== 6 || isDeleting"
            class="btn btn-danger btn-large"
          >
            {{ isDeleting ? 'Deleting...' : 'Confirm Deletion' }}
          </button>
        </div>

        <!-- Step 3: Deletion in Progress -->
        <div v-if="step === 3" class="step">
          <h3>Deletion in Progress</h3>
          <JobStatusMonitor
            v-if="jobId"
            :job-id="jobId"
            job-name="delete_license"
          />
        </div>
      </div>

      <div class="modal-footer">
        <button @click="close" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import JobStatusMonitor from './JobStatusMonitor.vue'

interface Props {
  isopen: boolean
  licenseId: string
  onClose: () => void
}

const props = defineProps<Props>()

const step = ref<1 | 2 | 3>(1)
const confirmationPhrase = ref('')
const userInput = ref('')
const phraseMatches = computed(
  () => userInput.value === confirmationPhrase.value
)
const phraseError = ref<string | null>(null)
const twoFaCode = ref('')
const twoFaError = ref<string | null>(null)
const isDeleting = ref(false)
const jobId = ref<string | null>(null)

onMounted(async () => {
  if (props.isopen) {
    try {
      // TODO: Call DELETE initiate endpoint to get confirmation phrase
      // const response = await fetch(`/api/v1/licenses/${props.licenseId}/delete/initiate`, { method: 'POST' })
      // const data = await response.json()
      // confirmationPhrase.value = data.confirmation_phrase
    } catch (err: any) {
      phraseError.value = err.message
    }
  }
})

function validatePhrase() {
  phraseError.value = phraseMatches.value ? null : 'Phrase does not match'
}

function proceedToTwoFa() {
  if (!phraseMatches.value) return
  step.value = 2
}

async function completeDeletion() {
  if (twoFaCode.value.length !== 6) return

  try {
    isDeleting.value = true
    twoFaError.value = null

    // TODO: Phase 7 implementation
    // 1. Call DELETE confirm endpoint with phrase + 2FA code
    // 2. API returns job_id
    // 3. Set step to 3 (show job monitor)
    // 4. Monitor job until completion
    // 5. Close dialog and refresh parent on success

    step.value = 3
    // jobId.value = response.job_id
  } catch (err: any) {
    twoFaError.value = err.message
  } finally {
    isDeleting.value = false
  }
}

function close() {
  userInput.value = ''
  twoFaCode.value = ''
  phraseError.value = null
  twoFaError.value = null
  step.value = 1
  props.onClose()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.warning-box {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #7f1d1d;
}

.warning-text {
  margin: 0 0 0.5rem 0;
  font-weight: 500;
}

.warning-box ul {
  margin: 0;
  padding-left: 1.5rem;
}

.warning-box li {
  margin: 0.25rem 0;
}

.step {
  margin-bottom: 1.5rem;
}

.step h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #111827;
}

.confirmation-phrase {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  font-family: monospace;
  font-size: 0.875rem;
  word-break: break-all;
}

.input-field {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  box-sizing: border-box;
}

.input-code {
  font-size: 1.5rem;
  letter-spacing: 0.5rem;
  text-align: center;
  font-family: monospace;
}

.error-text {
  color: #dc2626;
  font-size: 0.875rem;
  margin: 0.5rem 0 1rem 0;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-large {
  width: 100%;
  padding: 0.75rem 1rem;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #e5e7eb;
  color: #111827;
}
</style>
