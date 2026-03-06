/**
 * useFilterBuilder Composable
 * LOCKED DECISION 3: Filter state management with URL/localStorage serialization
 * Exposes isPersistedExternally flag and storage fallback handling
 */

import { computed, ref, watch } from 'vue'
import type { Filter, FilterField } from '../types'
import { checkUrlOverflow, deserializeFilters, serializeFilters } from '../utils/filter-serializer'

export interface UseFilterBuilderOptions {
  initialFilters?: Filter[]
  serializationMode?: 'url' | 'localStorage'
  availableFields?: FilterField[]
  maxFilters?: number
}

export function useFilterBuilder(options: UseFilterBuilderOptions = {}) {
  // State
  const filters = ref<Filter[]>(options.initialFilters ?? [])
  const serializationMode = ref<'url' | 'localStorage'>(options.serializationMode ?? 'url')
  const maxFilters = ref(options.maxFilters ?? 10)
  const error = ref<Error | null>(null)

  // Computed: Serialized filter string (compact, Base64-encoded)
  const serialized = computed(() => {
    try {
      return serializeFilters(filters.value)
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      return ''
    }
  })

  // Computed: Is persisted externally? (LOCKED DECISION 3)
  // Returns true when using localStorage fallback
  const isPersistedExternally = computed(() => {
    return serializationMode.value === 'localStorage'
  })

  // Computed: Is URL overflow detected? (LOCKED DECISION 3)
  const isOverflowed = computed(() => {
    return checkUrlOverflow(filters.value)
  })

  // Computed: Can add more filters?
  const canAddFilter = computed(() => {
    return filters.value.length < maxFilters.value && !isOverflowed.value
  })

  // Methods: Filter management
  const addFilter = (filter: Filter): void => {
    if (filters.value.length >= maxFilters.value) {
      error.value = new Error(`Maximum ${maxFilters.value} filters reached`)
      return
    }

    filters.value.push(filter)
    error.value = null
  }

  const removeFilter = (index: number): void => {
    if (index >= 0 && index < filters.value.length) {
      filters.value.splice(index, 1)
      error.value = null
    }
  }

  const updateFilter = (index: number, filter: Filter): void => {
    if (index >= 0 && index < filters.value.length) {
      filters.value.splice(index, 1, filter)
      error.value = null
    }
  }

  const resetFilters = (): void => {
    filters.value = []
    error.value = null
  }

  // Methods: Serialization
  const serialize = (): string => {
    try {
      return serialized.value
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err
      throw err
    }
  }

  const deserialize = (encoded: string): void => {
    try {
      filters.value = deserializeFilters(encoded)
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      filters.value = []
      throw error.value
    }
  }

  // Methods: URL sync
  const syncToUrl = (urlUpdateCallback: (serialized: string) => void): void => {
    try {
      urlUpdateCallback(serialized.value)
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    }
  }

  // Methods: Storage sync (LOCKED DECISION 3)
  const syncToStorage = (key: string): void => {
    try {
      localStorage.setItem(key, serialized.value)
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Failed to save to localStorage')
    }
  }

  // Methods: Storage sync from localStorage
  const syncFromStorage = (key: string): void => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        deserialize(stored)
      }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Failed to load from localStorage')
    }
  }

  // Methods: Storage fallback (LOCKED DECISION 3)
  // Called when URL approach doesn't work (overflow)
  const switchToStorageFallback = (): void => {
    if (isOverflowed.value) {
      serializationMode.value = 'localStorage'
    }
  }

  // Methods: Check overflow
  const checkOverflow = (): boolean => {
    return isOverflowed.value
  }

  // Watch for overflow and auto-switch if needed
  watch(
    () => filters.value.length,
    () => {
      if (isOverflowed.value && serializationMode.value === 'url') {
        // Don't auto-switch; let component/app decide
        // Just expose via isPersistedExternally computed property
      }
    }
  )

  return {
    // State (readonly from template)
    filters: computed(() => filters.value),
    serialized,
    isPersistedExternally,
    isOverflowed,
    canAddFilter,
    error: computed(() => error.value),

    // Methods
    addFilter,
    removeFilter,
    updateFilter,
    resetFilters,
    serialize,
    deserialize,
    syncToUrl,
    syncToStorage,
    syncFromStorage,
    switchToStorageFallback,
    checkOverflow,
  }
}
