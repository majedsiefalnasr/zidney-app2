/**
 * useColumnVisibility Composable
 * Column visibility state with optional localStorage persistence
 * SECURITY ENHANCEMENT: App MUST namespace localStorage keys by tenant+domain
 */

import { computed, onMounted, ref } from 'vue'

export interface UseColumnVisibilityOptions {
  availableColumns: string[]
  persistKey?: string
}

export function useColumnVisibility(options: UseColumnVisibilityOptions) {
  const { availableColumns, persistKey } = options

  // State: Visibility set
  const visibleColumns = ref<Set<string>>(new Set(availableColumns))

  // Computed: Visible columns as array
  const visibleColumnsArray = computed(() => Array.from(visibleColumns.value))

  // Computed: Hidden columns as array
  const hiddenColumns = computed(() =>
    availableColumns.filter((col) => !visibleColumns.value.has(col))
  )

  // Computed: Are all columns visible?
  const areAllVisible = computed(
    () => visibleColumns.value.size === availableColumns.length
  )

  // Computed: Are all columns hidden?
  const areAllHidden = computed(() => visibleColumns.value.size === 0)

  // Computed: Visibility state as object
  const visibilityMap = computed(() => {
    const map: Record<string, boolean> = {}
    availableColumns.forEach((col) => {
      map[col] = visibleColumns.value.has(col)
    })
    return map
  })

  // Method: Load from localStorage (if persistKey provided)
  const loadFromStorage = (): void => {
    if (!persistKey) return

    try {
      const stored = localStorage.getItem(persistKey)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed)) {
          // Validate columns exist in availableColumns
          const valid = parsed.filter((col) => availableColumns.includes(col))
          if (valid.length > 0) {
            visibleColumns.value = new Set(valid)
          }
        }
      }
    } catch {
      // Invalid stored value; ignore
    }
  }

  // Method: Save to localStorage (if persistKey provided)
  const saveToStorage = (): void => {
    if (!persistKey) return

    try {
      localStorage.setItem(
        persistKey,
        JSON.stringify([...visibleColumns.value])
      )
    } catch {
      // localStorage unavailable or quota exceeded
    }
  }

  // Method: Toggle column visibility
  const toggleColumn = (columnId: string): void => {
    if (!availableColumns.includes(columnId)) return

    if (visibleColumns.value.has(columnId)) {
      visibleColumns.value.delete(columnId)
    } else {
      visibleColumns.value.add(columnId)
    }

    saveToStorage()
  }

  // Method: Show all columns
  const showAll = (): void => {
    visibleColumns.value = new Set(availableColumns)
    saveToStorage()
  }

  // Method: Hide all columns
  const hideAll = (): void => {
    visibleColumns.value.clear()
    saveToStorage()
  }

  // Method: Set visible columns explicitly
  const setVisibleColumns = (columns: string[]): void => {
    // Validate all columns exist
    const valid = columns.filter((col) => availableColumns.includes(col))
    visibleColumns.value = new Set(valid)
    saveToStorage()
  }

  // Method: Check if column is visible
  const isVisible = (columnId: string): boolean => {
    return visibleColumns.value.has(columnId)
  }

  // Method: Reset to all visible
  const reset = (): void => {
    showAll()
  }

  // Lifecycle: Load from storage on mount
  onMounted(() => {
    loadFromStorage()
  })

  return {
    // State (reactive computed)
    visibleColumns: visibleColumnsArray,
    visableColumnsSet: computed(() => visibleColumns.value), // For internal use

    // Computed properties
    hiddenColumns,
    areAllVisible,
    areAllHidden,
    visibilityMap,

    // Methods
    toggleColumn,
    showAll,
    hideAll,
    setVisibleColumns,
    isVisible,
    reset,

    // Storage methods
    loadFromStorage,
    saveToStorage,
  }
}
