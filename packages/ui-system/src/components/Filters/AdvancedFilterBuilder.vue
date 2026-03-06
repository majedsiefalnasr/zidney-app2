<template>
  <div class="advanced-filter-builder space-y-4">
    <!-- Overflow warning banner (LOCKED DECISION 3) -->
    <div v-if="isOverflowed" class="warning-banner">
      <div class="flex items-start gap-3">
        <span class="text-lg">⚠</span>
        <div class="flex-1">
          <p class="text-sm font-medium text-yellow-800">
            Filters are too complex for URL ({{ serialized.length }} chars).
            Please reduce filter count or switch to session storage.
          </p>
        </div>
        <Button
          v-if="!isPersistedExternally"
          variant="outline"
          size="sm"
          @click="triggerStorageFallback"
          class="ml-auto whitespace-nowrap"
        >
          Use Session Storage
        </Button>
      </div>
    </div>

    <!-- Filter header with add button -->
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">Advanced Filters</h3>
      <Button
        @click="addFilter"
        :disabled="isOverflowed && !isPersistedExternally"
        :title="
          isOverflowed && !isPersistedExternally
            ? 'Cannot add more filters (URL too long)'
            : 'Add filter'
        "
      >
        + Add Filter
      </Button>
    </div>

    <!-- Filter list -->
    <div v-if="localFilters.length > 0" class="space-y-3">
      <div
        v-for="(filter, index) in localFilters"
        :key="index"
        class="filter-row"
      >
        <Select
          v-model="filter.fieldId"
          @update:model-value="updateFilter(index)"
        >
          <SelectTrigger aria-label="Filter field" class="w-1/3">
            <SelectValue placeholder="Select field..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select field...</SelectItem>
            <SelectItem
              v-for="field in availableFields"
              :key="field.id"
              :value="field.id"
            >
              {{ field.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          v-model="filter.operator"
          @update:model-value="updateFilter(index)"
        >
          <SelectTrigger aria-label="Filter operator" class="w-1/3">
            <SelectValue placeholder="Select operator..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select operator...</SelectItem>
            <SelectItem value="eq">Equals</SelectItem>
            <SelectItem value="ne">Not equals</SelectItem>
            <SelectItem value="gt">Greater than</SelectItem>
            <SelectItem value="lt">Less than</SelectItem>
            <SelectItem value="gte">Greater or equal</SelectItem>
            <SelectItem value="lte">Less or equal</SelectItem>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="startsWith">Starts with</SelectItem>
            <SelectItem value="endsWith">Ends with</SelectItem>
            <SelectItem value="in">In list</SelectItem>
          </SelectContent>
        </Select>

        <Input
          v-model="filter.value"
          type="text"
          placeholder="Filter value"
          @input="updateFilter(index)"
          aria-label="Filter value"
          class="w-1/3"
        />

        <Button
          variant="destructive"
          size="sm"
          @click="removeFilter(index)"
          aria-label="Remove filter"
          class="w-auto px-2"
        >
          ✕
        </Button>
      </div>
    </div>

    <!-- Persistence indicator (LOCKED DECISION 3) -->
    <div
      v-if="localFilters.length > 0"
      class="flex items-center gap-3 border-t pt-3 text-xs text-gray-600"
    >
      <Badge
        v-if="isPersistedExternally"
        variant="secondary"
        class="bg-yellow-100 text-yellow-800"
      >
        📦 Using Session Storage
      </Badge>
      <span class="ml-auto">Size: {{ serialized.length }} chars</span>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <p class="text-sm text-gray-500">
        No filters added. Click "Add Filter" to get started.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from '@shadcn-vue/ui/badge'
import { Button } from '@shadcn-vue/ui/button'
import { Input } from '@shadcn-vue/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shadcn-vue/ui/select'
import { computed, ref, watch } from 'vue'
import type { Filter } from '../../types'
import { checkUrlOverflow, serializeFilters } from '../../utils/filter-serializer'

type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'

type FilterFieldType = 'text' | 'select' | 'date' | 'boolean' | 'number' | 'multiselect'

interface FilterField {
  id: string
  label: string
  type: FilterFieldType
  operators: FilterOperator[]
  options?: Array<{ value: any; label: string }>
  placeholder?: string
  description?: string
}

interface Props {
  filters: Filter[]
  availableFields: FilterField[]
  filterSerializationMode?: 'url' | 'localStorage'
}

interface Emits {
  'filters-changed': [filters: Filter[]]
  'filter-overflow': [{ suggestedMode: 'localStorage' }]
  'storage-fallback-triggered': [{ reason: string }]
}

const props = withDefaults(defineProps<Props>(), {
  filterSerializationMode: 'url',
})

const emit = defineEmits<Emits>()

const localFilters = ref<Filter[]>(JSON.parse(JSON.stringify(props.filters)))
const persistenceMode = ref<'url' | 'localStorage'>(props.filterSerializationMode)

watch(
  () => props.filters,
  (newFilters) => {
    localFilters.value = JSON.parse(JSON.stringify(newFilters))
  }
)

// Computed: Serialized filter string (LOCKED DECISION 3: compact JSON + Base64 + v1: prefix)
const serialized = computed((): string => {
  return serializeFilters(localFilters.value)
})

// Computed: URL overflow detection (LOCKED DECISION 3: > 2000 chars)
const isOverflowed = computed((): boolean => {
  return checkUrlOverflow(localFilters.value)
})

// Computed: isPersistedExternally flag (LOCKED DECISION 3: visibility flag)
const isPersistedExternally = computed((): boolean => {
  return persistenceMode.value === 'localStorage'
})

const addFilter = (): void => {
  localFilters.value.push({
    fieldId: '',
    operator: 'eq',
    value: '',
  })
}

const removeFilter = (index: number): void => {
  localFilters.value.splice(index, 1)
  emit('filters-changed', localFilters.value)
}

const updateFilter = (index: number): void => {
  emit('filters-changed', localFilters.value)

  if (isOverflowed.value && !isPersistedExternally.value) {
    emit('filter-overflow', { suggestedMode: 'localStorage' })
  }
}

const triggerStorageFallback = (): void => {
  persistenceMode.value = 'localStorage'
  emit('storage-fallback-triggered', { reason: 'url-overflow' })
}
</script>

<style scoped>
@reference "tailwindcss";

.warning-banner {
  @apply p-3 bg-yellow-50 border border-yellow-200 rounded-md;
}

.filter-row {
  @apply flex items-center gap-3;
}

.empty-state {
  @apply p-6 text-center bg-gray-50 rounded-md;
}
</style>
