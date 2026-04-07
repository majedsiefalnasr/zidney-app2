/**
 * STUB: Attempt store — Frontoffice
 * Provides isExamActive flag consumed by useNotify exam-mode guard.
 * This stub will be replaced by the exam engine stage.
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// STUB: replaced by exam engine stage
export const useAttemptStore = defineStore('frontoffice-attempt', () => {
  const _isExamActive = ref(false)
  // Return immutable computed to prevent client-side modification
  const isExamActive = computed(() => _isExamActive.value)
  return { isExamActive: isExamActive as unknown as typeof isExamActive }
})
