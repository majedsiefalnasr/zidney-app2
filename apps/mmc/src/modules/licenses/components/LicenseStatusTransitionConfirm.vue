<!--
COMPONENT: LicenseStatusTransitionConfirm
T091a: Status Transition Confirmation Dialog

Purpose: Confirm destructive or irreversible status transitions
  - ACTIVE → SOFT_LOCKED: 90-day grace period (reversible)
  - SOFT_LOCKED → ARCHIVED: permanent (not reversible)
  - ARCHIVED → DELETED: permanent (not reversible)

Props:
  - license: License (full object with current status)
  - targetStatus: string (target status)
  - onConfirm: () => void
  - onCancel: () => void

Integrations:
  - Uses shadcn-vue Dialog + Button components
  - Calls LicenseActions API (parent component handles)
  - Displays grace period info if SOFT_LOCKED
-->

<template>
  <Dialog :open="isOpen" @update:open="onCancel">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle v-if="targetStatus === 'SOFT_LOCKED'">
          Soft-Lock License?
        </DialogTitle>
        <DialogTitle v-else-if="targetStatus === 'ARCHIVED'">
          Archive License? This Cannot Be Undone.
        </DialogTitle>
        <DialogTitle v-else-if="targetStatus === 'DELETED'">
          Delete License? This Is Permanent.
        </DialogTitle>
      </DialogHeader>

      <!-- SOFT_LOCKED: Grace Period Info -->
      <div v-if="targetStatus === 'SOFT_LOCKED'" class="space-y-4">
        <p class="text-sm text-gray-600">
          This license will enter a 90-day grace period.
        </p>
        <div class="bg-blue-50 border border-blue-200 rounded p-3">
          <p class="text-sm text-blue-900">
            📋 Grace Period: 90 days from today
          </p>
          <p class="text-xs text-blue-700 mt-1">
            Students can still access resources during this period.
          </p>
          <p class="text-xs text-blue-700 mt-1">
            You can unlock it anytime before expiration.
          </p>
        </div>
        <p class="text-sm text-gray-600">
          After 90 days, it will automatically archive.
        </p>
      </div>

      <!-- ARCHIVED: Warning -->
      <div v-else-if="targetStatus === 'ARCHIVED'" class="space-y-4">
        <p class="text-sm text-gray-600">
          Archiving this license is permanent. Students will lose access to all
          resources.
        </p>
        <div class="bg-amber-50 border border-amber-200 rounded p-3">
          <p class="text-sm text-amber-900 font-semibold">⚠️ Warning</p>
          <p class="text-xs text-amber-700 mt-1">
            This action cannot be reversed.
          </p>
          <p class="text-xs text-amber-700 mt-1">
            Audit logs will be preserved.
          </p>
        </div>
        <p class="text-sm text-gray-600">
          Type "<span class="font-mono text-red-600">ARCHIVE</span>" to confirm:
        </p>
        <input
          v-model="confirmationInput"
          type="text"
          placeholder="Type ARCHIVE to confirm"
          class="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </div>

      <!-- DELETED: Critical Warning -->
      <div v-else-if="targetStatus === 'DELETED'" class="space-y-4">
        <p class="text-sm text-gray-600">
          Deleting this license is permanent and irreversible.
        </p>
        <div class="bg-red-50 border border-red-200 rounded p-3">
          <p class="text-sm text-red-900 font-semibold">🚨 Critical Action</p>
          <p class="text-xs text-red-700 mt-1">
            This action cannot be reversed.
          </p>
          <p class="text-xs text-red-700 mt-1">
            Databases and student data will be permanently removed.
          </p>
          <p class="text-xs text-red-700 mt-1">
            Audit logs will be retained for 7 years (compliance).
          </p>
        </div>
        <p class="text-sm text-gray-600">
          Type "<span class="font-mono text-red-600">DELETE FOREVER</span>" to
          confirm:
        </p>
        <input
          v-model="confirmationInput"
          type="text"
          placeholder="Type DELETE FOREVER to confirm"
          class="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </div>

      <!-- License Summary -->
      <div class="bg-gray-50 rounded p-3 text-xs">
        <div class="flex justify-between">
          <span class="text-gray-600">License ID:</span>
          <span class="font-mono text-gray-900">{{ license?.id }}</span>
        </div>
        <div class="flex justify-between mt-1">
          <span class="text-gray-600">Current Status:</span>
          <span class="font-semibold">{{ license?.status }}</span>
        </div>
        <div class="flex justify-between mt-1">
          <span class="text-gray-600">Workspace:</span>
          <span class="font-mono">{{ license?.workspace_slug }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <DialogFooter>
        <Button variant="outline" @click="onCancel"> Cancel </Button>
        <Button
          v-if="targetStatus === 'SOFT_LOCKED'"
          variant="primary"
          @click="onConfirm"
        >
          Soft-Lock License
        </Button>
        <Button
          v-else
          variant="destructive"
          :disabled="!isConfirmationValid"
          @click="onConfirm"
        >
          {{ confirmButtonText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from '@zidney/ui/components/shadcn-vue/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@zidney/ui/components/shadcn-vue/dialog'
import { computed, ref } from 'vue'

interface License {
  id: string
  status: string
  workspace_slug: string
}

interface Props {
  license: License | null
  targetStatus: string
  isOpen: boolean
}

interface Emits {
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const confirmationInput = ref('')

const isConfirmationValid = computed(() => {
  if (props.targetStatus === 'SOFT_LOCKED') return true
  if (props.targetStatus === 'ARCHIVED')
    return confirmationInput.value === 'ARCHIVE'
  if (props.targetStatus === 'DELETED')
    return confirmationInput.value === 'DELETE FOREVER'
  return false
})

const confirmButtonText = computed(() => {
  if (props.targetStatus === 'ARCHIVED') return 'Archive License'
  if (props.targetStatus === 'DELETED') return 'Delete Forever'
  return 'Continue'
})

const onConfirm = () => {
  if (isConfirmationValid.value) {
    emit('confirm')
  }
}

const onCancel = () => {
  confirmationInput.value = ''
  emit('cancel')
}
</script>

<style scoped>
/* Handled by Tailwind + shadcn-vue */
</style>
