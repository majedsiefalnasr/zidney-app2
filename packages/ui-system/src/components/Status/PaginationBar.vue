<template>
  <div
    class="pagination-bar flex flex-wrap items-center gap-3 p-3 bg-white border border-gray-200 rounded-sm"
  >
    <!-- Previous button -->
    <Button
      variant="outline"
      size="sm"
      :disabled="currentPage <= 1 || isLoading"
      @click="handlePrevious"
      aria-label="Previous page"
      class="whitespace-nowrap"
    >
      ← Previous
    </Button>

    <!-- Page selector -->
    <div class="pagination-info flex items-center gap-2">
      <Input
        v-model.number="inputPage"
        type="number"
        min="1"
        :max="totalPages"
        @change="handlePageChange"
        aria-label="Go to page"
        class="w-16 text-center text-sm"
      />
      <span class="text-sm text-gray-600">of {{ totalPages }}</span>
    </div>

    <!-- Page size selector -->
    <Select
      v-model="selectedPageSize"
      @update:model-value="handlePageSizeChange"
    >
      <SelectTrigger aria-label="Page size" class="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="10">10 per page</SelectItem>
        <SelectItem value="25">25 per page</SelectItem>
        <SelectItem value="50">50 per page</SelectItem>
        <SelectItem value="100">100 per page</SelectItem>
      </SelectContent>
    </Select>

    <!-- Total count -->
    <span class="text-sm text-gray-600 font-medium ml-auto"
      >Total: {{ totalCount }}</span
    >

    <!-- Next button -->
    <Button
      variant="outline"
      size="sm"
      :disabled="currentPage >= totalPages || isLoading"
      @click="handleNext"
      aria-label="Next page"
      class="whitespace-nowrap"
    >
      Next →
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  isLoading?: boolean
  disabled?: boolean
}

interface Emits {
  'page-changed': [page: number]
  'page-size-changed': [pageSize: number]
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  disabled: false,
})

const emit = defineEmits<Emits>()

const inputPage = ref(props.currentPage)
const selectedPageSize = ref(String(props.pageSize))

watch(
  () => props.currentPage,
  (newPage) => {
    inputPage.value = newPage
  }
)

watch(
  () => props.pageSize,
  (newSize) => {
    selectedPageSize.value = String(newSize)
  }
)

const _handlePrevious = (): void => {
  if (props.currentPage > 1) {
    emit('page-changed', props.currentPage - 1)
  }
}

const _handleNext = (): void => {
  if (props.currentPage < props.totalPages) {
    emit('page-changed', props.currentPage + 1)
  }
}

const _handlePageChange = (): void => {
  if (inputPage.value >= 1 && inputPage.value <= props.totalPages) {
    emit('page-changed', inputPage.value)
  } else {
    inputPage.value = props.currentPage
  }
}

const _handlePageSizeChange = (): void => {
  emit('page-size-changed', parseInt(selectedPageSize.value, 10))
}
</script>

<style scoped>
@reference "tailwindcss";

/* Styles handled by Tailwind utilities and shadcn-vue components */
</style>
