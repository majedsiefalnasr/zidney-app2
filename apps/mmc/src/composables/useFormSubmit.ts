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

  async function submit(action: () => Promise<void>): Promise<void> {
    if (isSubmitting.value) return
    isSubmitting.value = true
    try {
      await action()
    } finally {
      isSubmitting.value = false
    }
  }

  return { isSubmitting: readonly(isSubmitting), submit }
}
