<script setup lang="ts">
/**
 * T078: License Edit Form - Update mutable fields (limits only)
 * T082: License Limits Editor
 */

import { Button } from '@zidney/ui/components/shadcn-vue/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@zidney/ui/components/shadcn-vue/card'
import { Input } from '@zidney/ui/components/shadcn-vue/input'
import { ref } from 'vue'

interface Props {
  licenseId: string
  initialStudentLimit?: number
  initialStaffLimit?: number
}

const props = withDefaults(defineProps<Props>(), {})

const form = ref({
  student_limit: props.initialStudentLimit,
  staff_limit: props.initialStaffLimit,
})

const loading = ref(false)
const submitted = ref(false)

const onSubmit = async () => {
  loading.value = true
  try {
    // TODO: Call API: PATCH /v1/mmc/licenses/:id
    submitted.value = true
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Edit Workspace Limits</CardTitle>
    </CardHeader>
    <CardContent>
      <form @submit.prevent="onSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Student Limit</label>
          <Input v-model.number="form.student_limit" type="number" min="0" />
          <p class="text-xs text-gray-500 mt-1">
            Leave blank for unlimited. Must be ≥ 0.
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Staff Limit</label>
          <Input v-model.number="form.staff_limit" type="number" min="0" />
        </div>

        <div v-if="submitted" class="bg-green-50 p-3 rounded text-sm">
          ✓ Limits updated successfully
        </div>

        <Button type="submit" :disabled="loading">
          {{ loading ? 'Saving...' : 'Save Changes' }}
        </Button>
      </form>
    </CardContent>
  </Card>
</template>
