<template>
  <div class="data-table-wrapper">
    <!-- CONTEXT & IMPORTS
         This component uses shadcn-vue Table as base with Tailwind v4 styling. 
         All styling via @apply directives in scoped styles block. -->

    <!-- Loading state -->
    <div v-if="loading" class="loading-container">
      <div class="skeleton-loader" />
    </div>

    <!-- Empty state -->
    <div v-else-if="displayedRows.length === 0" class="empty-state">
      <p class="empty-text">
        {{ $t('common.noData') ?? 'No data available' }}
      </p>
    </div>

    <!-- Table using shadcn-vue Table component -->
    <div v-else class="table-container">
      <Table>
        <TableHeader>
          <TableRow>
            <!-- Selection Checkbox -->
            <TableHead v-if="enableRowSelection" class="w-12">
              <Checkbox
                :checked="allRowsSelected"
                :indeterminate="someRowsSelected"
                @update:checked="handleSelectAll"
                aria-label="Select all rows"
              />
            </TableHead>

            <!-- Column Headers -->
            <TableHead
              v-for="column in visibleColumns"
              :key="column.id"
              class="font-semibold"
            >
              <Button
                v-if="enableColumnSorting && column.enableSorting !== false"
                variant="ghost"
                size="sm"
                class="gap-2 -ml-2"
                @click="handleSort(column.id)"
              >
                <span>{{ column.header }}</span>
                <ChevronUp
                  v-if="
                    sortState?.column === column.id &&
                    sortState.direction === 'asc'
                  "
                  class="w-4 h-4"
                />
                <ChevronDown
                  v-else-if="
                    sortState?.column === column.id &&
                    sortState.direction === 'desc'
                  "
                  class="w-4 h-4"
                />
              </Button>
              <span v-else class="px-2">{{ column.header }}</span>
            </TableHead>

            <!-- Actions Column Header -->
            <TableHead v-if="rowActions && rowActions.length > 0" class="w-24">
              {{ $t('common.actions') ?? 'Actions' }}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow
            v-for="row in displayedRows"
            :key="getRowKey(row)"
            :class="
              isRowSelected(getRowKey(row)) ? 'bg-blue-50' : 'hover:bg-gray-50'
            "
          >
            <!-- Selection Checkbox -->
            <TableCell v-if="enableRowSelection" class="w-12">
              <Checkbox
                :checked="isRowSelected(getRowKey(row))"
                @update:checked="(checked) => handleSelectRow(row, checked)"
              />
            </TableCell>

            <!-- Data Cells -->
            <TableCell
              v-for="column in visibleColumns"
              :key="column.id"
              class="text-sm"
            >
              <component
                v-if="column.cell"
                :is="column.cell"
                :row="row"
                :column="column"
                :value="getCellValue(row, column)"
              />
              <span v-else class="text-gray-900">
                {{ getCellValue(row, column) }}
              </span>
            </TableCell>

            <!-- Row Actions -->
            <TableCell
              v-if="rowActions && rowActions.length > 0"
              class="text-right"
            >
              <div class="actions-group">
                <Button
                  v-for="action in rowActions"
                  :key="action.id"
                  :variant="(action.variant as any) || 'outline'"
                  size="sm"
                  :disabled="
                    isActionLoading(getRowKey(row), action.id) ||
                    action.disabled
                  "
                  @click="executeAction(row, action)"
                  :title="action.label"
                  class="gap-2"
                >
                  <Loader
                    v-if="isActionLoading(getRowKey(row), action.id)"
                    class="w-4 h-4 animate-spin"
                  />
                  {{ action.label }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination using shadcn-vue Button -->
    <div v-if="paginationMode" class="pagination-footer">
      <Button
        variant="outline"
        size="sm"
        :disabled="currentPage <= 1"
        @click="handlePreviousPage"
        aria-label="Previous page"
      >
        ← {{ $t('common.previous') ?? 'Previous' }}
      </Button>

      <span class="page-info">
        {{ $t('common.page') ?? 'Page' }} {{ currentPage }} of {{ totalPages }}
      </span>

      <Button
        variant="outline"
        size="sm"
        :disabled="currentPage >= totalPages"
        @click="handleNextPage"
        aria-label="Next page"
      >
        {{ $t('common.next') ?? 'Next' }} →
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Button,
  Checkbox,
  ChevronDown,
  ChevronUp,
  Loader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@zidney/shadcn-vue'
import { computed, ref, watch } from 'vue'

// STORIES & COMPOSABLES

interface Column {
  id: string
  header: string
  accessor?: keyof any
  cell?: any
  size?: string
  enableSorting?: boolean
}

interface RowAction {
  id: string
  label: string
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive'
  disabled?: boolean
}

interface Props {
  rows: any[]
  columns: Column[]
  rowActions?: RowAction[]
  paginationMode?: 'server' | 'client' | false
  enableRowSelection?: boolean
  enableColumnSorting?: boolean
  loading?: boolean
  rowKey?: keyof any | string
  currentPage?: number
  pageSize?: number
}

// PROPS & EMITS

const props = withDefaults(defineProps<Props>(), {
  paginationMode: false,
  enableRowSelection: true,
  enableColumnSorting: true,
  loading: false,
  rowKey: 'id',
  currentPage: 1,
  pageSize: 10,
})

const emit = defineEmits<{
  sort: [columnId: string, direction: 'asc' | 'desc']
  selectRow: [rowKey: string, selected: boolean]
  selectAll: [selected: boolean]
  action: [rowKey: string, actionId: string]
  'update:page': [page: number]
}>()

// REACTIVE STATE

const sortState = ref<{ column: string; direction: 'asc' | 'desc' } | null>(
  null
)
const selectedRows = ref<Set<string>>(new Set())
const actionLoading = ref<Map<string, Set<string>>>(new Map())
const currentPageInternal = ref(props.currentPage)
const pageSize = ref(props.pageSize)

// COMPUTED PROPERTIES

const displayedRows = computed(() => {
  if (props.paginationMode === 'client') {
    const start = (currentPageInternal.value - 1) * pageSize.value
    return props.rows.slice(start, start + pageSize.value)
  }
  return props.rows
})

const allRowsSelected = computed(
  () =>
    displayedRows.value.length > 0 &&
    displayedRows.value.every((row) => isRowSelected(getRowKey(row)))
)

const someRowsSelected = computed(
  () =>
    displayedRows.value.some((row) => isRowSelected(getRowKey(row))) &&
    !allRowsSelected.value
)

const visibleColumns = computed(() =>
  props.columns.filter((col) => col.id !== 'actions')
)

const totalPages = computed(() => Math.ceil(props.rows.length / pageSize.value))

// UTILITY METHODS

const getRowKey = (row: any): string => {
  const key = props.rowKey as string
  return String(row[key] || '')
}

const isRowSelected = (rowKey: string): boolean =>
  selectedRows.value.has(rowKey)

const getCellValue = (row: any, column: Column): any => {
  if (column.accessor) {
    return row[column.accessor as string]
  }
  return row[column.id]
}

const isActionLoading = (rowKey: string, actionId: string): boolean => {
  return actionLoading.value.get(rowKey)?.has(actionId) ?? false
}

// EVENT HANDLERS

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    displayedRows.value.forEach((row) => selectedRows.value.add(getRowKey(row)))
  } else {
    selectedRows.value.clear()
  }
  emit('selectAll', checked)
}

const handleSelectRow = (row: any, checked: boolean) => {
  const key = getRowKey(row)
  if (checked) {
    selectedRows.value.add(key)
  } else {
    selectedRows.value.delete(key)
  }
  emit('selectRow', [key, checked])
}

const handleSort = (columnId: string) => {
  if (sortState.value?.column === columnId) {
    sortState.value.direction =
      sortState.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    sortState.value = { column: columnId, direction: 'asc' }
  }
  emit('sort', [columnId, sortState.value.direction])
}

const executeAction = async (row: any, action: RowAction) => {
  const rowKey = getRowKey(row)
  if (!actionLoading.value.has(rowKey)) {
    actionLoading.value.set(rowKey, new Set())
  }
  actionLoading.value.get(rowKey)!.add(action.id)

  try {
    emit('action', [rowKey, action.id])
    await new Promise((resolve) => setTimeout(resolve, 500))
  } finally {
    actionLoading.value.get(rowKey)!.delete(action.id)
  }
}

const handlePreviousPage = () => {
  if (currentPageInternal.value > 1) {
    currentPageInternal.value--
    emit('update:page', currentPageInternal.value)
  }
}

const handleNextPage = () => {
  if (currentPageInternal.value < totalPages.value) {
    currentPageInternal.value++
    emit('update:page', currentPageInternal.value)
  }
}

// LIFECYCLE

watch(
  () => props.rows,
  () => {
    selectedRows.value.clear()
  }
)

// Methods: Pagination
const handlePreviousPage = (): void => {
  if (currentPageInternal.value > 1) {
    currentPageInternal.value--
    emit('update:page', currentPageInternal.value)
  }
}

const handleNextPage = (): void => {
  if (currentPageInternal.value < totalPages.value) {
    currentPageInternal.value++
    emit('update:page', currentPageInternal.value)
  }
}

// Methods: Sorting
const handleSort = (columnId: string): void => {
  const newDirection =
    sortState.value?.column === columnId && sortState.value?.direction === 'asc'
      ? 'desc'
      : 'asc'

  sortState.value = { column: columnId, direction: newDirection }
  emit('sort', [columnId, newDirection])
}

// Methods: Row selection
const handleSelectAll = (event: Event): void => {
  const target = event.target as HTMLInputElement
  if (target.checked) {
    displayedRows.value.forEach((row) => {
      selectedRows.value.add(getRowKey(row))
    })
  } else {
    selectedRows.value.clear()
  }
  emit('selectAll', Array.from(selectedRows.value))
}

const handleSelectRow = (row: any): void => {
  const key = getRowKey(row)
  if (selectedRows.value.has(key)) {
    selectedRows.value.delete(key)
  } else {
    selectedRows.value.add(key)
  }
  emit('selectRow', [key, selectedRows.value.has(key)])
}

const isRowSelected = (rowKey: string): boolean => {
  return selectedRows.value.has(rowKey)
}

// Methods: Row actions
const isActionLoading = (rowKey: string, actionId: string): boolean => {
  return rowActionLoading.value.get(rowKey)?.get(actionId) ?? false
}

const executeAction = async (row: any, action: RowAction): Promise<void> => {
  const rowKey = getRowKey(row)

  if (!rowActionLoading.value.has(rowKey)) {
    rowActionLoading.value.set(rowKey, new Map())
  }

  // Mark as loading
  rowActionLoading.value.get(rowKey)!.set(action.id, true)

  try {
    // Execute action
    emit('action', [rowKey, action.id])
    await new Promise((resolve) => setTimeout(resolve, 500))
  } finally {
    rowActionLoading.value.get(rowKey)!.set(action.id, false)
  }
}

// Lifecycle
watch(
  () => props.rows,
  () => {
    // Reset selection when rows change
    selectedRows.value.clear()
  }
)
</script>

<style scoped>
.data-table-wrapper {
  @apply flex flex-col gap-4 w-full;
}

.loading-container {
  @apply flex justify-center py-12;
}

.skeleton-loader {
  @apply w-full h-12 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 rounded animate-pulse;
}

.empty-state {
  @apply flex items-center justify-center py-16;
}

.empty-text {
  @apply text-gray-500 text-sm font-medium;
}

.table-container {
  @apply border rounded-lg overflow-hidden;
}

.actions-group {
  @apply flex justify-end gap-2;
}

.pagination-footer {
  @apply flex items-center justify-between gap-4 py-4 px-4 border-t bg-gray-50;
}

.page-info {
  @apply text-sm text-gray-600 font-medium;
}
</style>

<script lang="ts"></script>
