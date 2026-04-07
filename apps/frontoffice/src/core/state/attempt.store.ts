/**
 * STUB: Attempt store — Frontoffice
 * Provides isExamActive flag consumed by useNotify exam-mode guard.
 * This stub will be replaced by the exam engine stage.
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

// STUB: replaced by exam engine stage
export const useAttemptStore = defineStore('frontoffice-attempt', () => {
  const isExamActive = ref(false)
  return { isExamActive }
})
