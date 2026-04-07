/**
 * useFormSubmit composable — MMC
 * Guards async form actions with an isSubmitting flag and double-submit prevention.
 * Consumer binds :disabled="isSubmitting" and :loading="isSubmitting" on submit button.
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 * Task: T036
 */

import { readonly, ref } from 'vue'

export function useFormSubmit() {
  const isSubmitting = ref(false)
  let inFlight: Promise<void> | null = null

  async function submit(action: () => Promise<void>): Promise<void> {
    if (inFlight) return inFlight
    isSubmitting.value = true
    inFlight = (async () => {
      try {
        await action()
      } finally {
        isSubmitting.value = false
        inFlight = null
      }
    })()
    return inFlight
  }

  return { isSubmitting: readonly(isSubmitting), submit }
}
