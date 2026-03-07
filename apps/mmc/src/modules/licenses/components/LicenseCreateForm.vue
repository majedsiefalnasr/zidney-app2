<script setup lang="ts">
import { Button } from '@zidney/ui/components/shadcn-vue/button'
import { Input } from '@zidney/ui/components/shadcn-vue/input'
import { ref } from 'vue'

/**
 * T077-T079: License Create Form
 * TODO: Connect to API POST endpoint
 */

const form = ref({
  product_id: '',
  workspace_slug: '',
  student_limit: '',
  staff_limit: '',
  language_code: 'en',
})

const loading = ref(false)
const errors = ref<Record<string, string>>({})

const onSubmit = async () => {
  loading.value = true
  errors.value = {}

  try {
    // TODO: Validate form
    // TODO: Call API: POST /v1/mmc/licenses
    // TODO: Redirect to detail page on success
    // biome-ignore lint/correctness/noUnreachable: catch block retained as error boundary for pending TODO implementation
  } catch (err: any) {
    errors.value = err.details || {}
  } finally {
    loading.value = false
  }
}

const validateWorkspaceSlug = (slug: string) => {
  // TODO: Real validation
  return /^[a-z0-9-]+$/.test(slug)
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6 max-w-lg">
    <div>
      <label class="block text-sm font-medium mb-1">Product ID</label>
      <Input
        v-model="form.product_id"
        placeholder="prod-xxxxxx"
        :error="errors.product_id"
        disabled
      />
      <p v-if="errors.product_id" class="text-sm text-red-600">
        {{ errors.product_id }}
      </p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Workspace Slug *</label>
      <Input
        v-model="form.workspace_slug"
        placeholder="my-workspace"
        @blur="() => validateWorkspaceSlug(form.workspace_slug)"
      />
      <p v-if="errors.workspace_slug" class="text-sm text-red-600">
        {{ errors.workspace_slug }}
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Lowercase letters, numbers, hyphens only. Immutable after creation.
      </p>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Student Limit</label>
        <Input v-model="form.student_limit" type="number" placeholder="100" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Staff Limit</label>
        <Input v-model="form.staff_limit" type="number" placeholder="10" />
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Language</label>
      <select
        v-model="form.language_code"
        class="border rounded px-3 py-2 w-full"
      >
        <option value="en">English</option>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
      </select>
    </div>

    <div class="flex gap-3">
      <Button type="submit" :disabled="loading">
        {{ loading ? 'Creating...' : 'Create License' }}
      </Button>
      <!-- TODO: Add cancel button linked to router -->
    </div>

    <!-- TODO: Show provisioning status indicator once created -->
  </form>
</template>

<style scoped>
/* TODO: Move to Tailwind or shadcn-vue classes */
</style>
