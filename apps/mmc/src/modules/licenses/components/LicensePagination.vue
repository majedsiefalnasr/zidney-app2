<script setup lang="ts">
/**
 * T087: License Pagination Controls
 * T088: License Bulk Actions
 */

import { computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
}

const _emit = defineEmits<{
  'update:page': [page: number]
  'bulk-action': [action: string, ids: string[]]
}>()

const props = defineProps<Props>()

const _pages = computed(() => {
  const start = Math.max(1, props.currentPage - 2)
  const end = Math.min(props.totalPages, props.currentPage + 2)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

const _canGoBack = computed(() => props.currentPage > 1)
const _canGoNext = computed(() => props.currentPage < props.totalPages)
</script>

<template>
  <div class="flex justify-between items-center">
    <div class="text-sm text-gray-600">
      Showing {{ (currentPage - 1) * pageSize + 1 }} to
      {{ Math.min(currentPage * pageSize, totalItems) }} of {{ totalItems }}
    </div>

    <div class="flex gap-2">
      <Button
        variant="outline"
        :disabled="!canGoBack"
        @click="emit('update:page', currentPage - 1)"
      >
        ← Previous
      </Button>

      <div class="flex gap-1">
        <Button
          v-for="page in pages"
          :key="page"
          :variant="currentPage === page ? 'default' : 'outline'"
          @click="emit('update:page', page)"
        >
          {{ page }}
        </Button>
      </div>

      <Button
        variant="outline"
        :disabled="!canGoNext"
        @click="emit('update:page', currentPage + 1)"
      >
        Next →
      </Button>
    </div>
  </div>
</template>
