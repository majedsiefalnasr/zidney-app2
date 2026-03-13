<template>
  <div class="column-visibility-dropdown">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" class="gap-2">
          👁 Columns
          <ChevronDown class="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-56">
        <!-- Search input -->
        <div v-if="availableColumns.length > 5" class="px-2 py-1.5">
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search columns..."
            class="h-8"
          />
        </div>

        <!-- Select all option -->
        <DropdownMenuCheckboxItem
          v-if="!hideSelectAll"
          :checked="allVisible"
          :indeterminate="someVisible"
          @update:checked="toggleAll"
        >
          Select All
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator v-if="!hideSelectAll" />

        <!-- Column options -->
        <DropdownMenuCheckboxItem
          v-for="column in filteredColumns"
          :key="column"
          :checked="visibleColumns.includes(column)"
          @update:checked="toggleColumn(column)"
        >
          {{ column }}
        </DropdownMenuCheckboxItem>

        <!-- Footer -->
        <DropdownMenuSeparator v-if="availableColumns.length > 0" />
        <div class="px-2 py-1.5 text-xs text-gray-600 font-medium">
          {{ visibleCount }} / {{ availableColumns.length }} visible
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  availableColumns: string[]
  visibleColumns: string[]
  hideSelectAll?: boolean
}

interface Emits {
  'visibility-changed': [visibleColumns: string[]]
}

const props = withDefaults(defineProps<Props>(), {
  hideSelectAll: false,
})

const emit = defineEmits<Emits>()

const searchQuery = ref('')

const filteredColumns = computed(() => {
  if (!searchQuery.value) return props.availableColumns
  return props.availableColumns.filter((col) =>
    col.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const allVisible = computed(() => {
  return filteredColumns.value.every((col) => props.visibleColumns.includes(col))
})

const _someVisible = computed(() => {
  const selected = filteredColumns.value.filter((col) => props.visibleColumns.includes(col))
  return selected.length > 0 && selected.length < filteredColumns.value.length
})

const _visibleCount = computed(() => props.visibleColumns.length)

const _toggleColumn = (column: string): void => {
  const newVisibleColumns = props.visibleColumns.includes(column)
    ? props.visibleColumns.filter((col) => col !== column)
    : [...props.visibleColumns, column]
  emit('visibility-changed', newVisibleColumns)
}

const _toggleAll = (): void => {
  if (allVisible.value) {
    const newVisibleColumns = props.visibleColumns.filter(
      (col) => !filteredColumns.value.includes(col)
    )
    emit('visibility-changed', newVisibleColumns)
  } else {
    const newVisibleColumns = Array.from(
      new Set([...props.visibleColumns, ...filteredColumns.value])
    )
    emit('visibility-changed', newVisibleColumns)
  }
}
</script>

<style scoped>
@reference "tailwindcss";

.column-visibility-dropdown {
  @apply inline-block;
}
</style>
