/**
 * Table State Management Utilities
 * Pagination helpers, sorting, row ID extraction, type coercion
 */

import type { Accessor, FilterFieldType, SortDirection } from '../types'

/**
 * Calculate total pages from total count and page size
 */
export function calculateTotalPages(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 0
  return Math.ceil(totalCount / pageSize)
}

/**
 * Clamp page number to valid range [1, totalPages]
 */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages === 0) return 1
  return Math.max(1, Math.min(Math.floor(page), totalPages))
}

/**
 * Extract row key/ID from row object
 * Handles both direct property access and custom extraction
 */
export function extractRowKey<TRow = any>(
  row: TRow,
  keyExtractor?: (r: TRow) => string | number
): string | number {
  if (!row) return ''

  // If custom extractor provided, use it
  if (keyExtractor) {
    try {
      return keyExtractor(row)
    } catch {
      return ''
    }
  }

  // Try common ID properties
  const idProperties = ['id', '_id', 'key', 'uuid', 'uid', 'rowId']
  for (const prop of idProperties) {
    const value = (row as any)[prop]
    if (value !== undefined && value !== null) {
      return String(value)
    }
  }

  // Fallback: use object reference (not ideal but safe)
  return String(Math.random())
}

/**
 * Sort rows by column accessor
 * Supports both property paths and custom accessors
 */
export function sortRows<TRow = any>(
  rows: TRow[],
  column: string,
  direction: SortDirection,
  accessor?: Accessor<TRow>
): TRow[] {
  if (!rows.length) return rows

  const sorted = [...rows].sort((a, b) => {
    let valueA: any
    let valueB: any

    // Extract values using accessor
    if (typeof accessor === 'function') {
      valueA = accessor(a)
      valueB = accessor(b)
    } else if (accessor && typeof accessor === 'string') {
      valueA = getNestedValue(a, accessor)
      valueB = getNestedValue(b, accessor)
    } else {
      // Infer accessor from column name
      valueA = getNestedValue(a, column)
      valueB = getNestedValue(b, column)
    }

    // Handle null/undefined
    if (valueA == null && valueB == null) return 0
    if (valueA == null) return direction === 'asc' ? 1 : -1
    if (valueB == null) return direction === 'asc' ? -1 : 1

    // Compare values
    let comparison = 0
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      comparison = valueA.localeCompare(valueB)
    } else if (typeof valueA === 'number' && typeof valueB === 'number') {
      comparison = valueA - valueB
    } else if (valueA instanceof Date && valueB instanceof Date) {
      comparison = valueA.getTime() - valueB.getTime()
    } else {
      comparison = String(valueA).localeCompare(String(valueB))
    }

    return direction === 'asc' ? comparison : -comparison
  })

  return sorted
}

/**
 * Get nested property value from object
 * Supports dot notation: "user.address.city"
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined

  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current == null) return undefined
    current = current[key]
  }

  return current
}

/**
 * Set nested property value on object
 * Supports dot notation, creates intermediate objects if needed
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  if (!obj || !path) return

  const keys = path.split('.')
  let current = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }

  current[keys[keys.length - 1]!] = value
}

/**
 * Filter rows by column value
 * Handles type coercion and comparison
 */
export function filterRowsByColumn<TRow = any>(
  rows: TRow[],
  column: string,
  query: string,
  _fieldType?: FilterFieldType
): TRow[] {
  if (!query) return rows

  const normalizedQuery = query.toLowerCase().trim()

  return rows.filter((row) => {
    const value = getNestedValue(row, column)
    const stringValue = String(value || '').toLowerCase()
    return stringValue.includes(normalizedQuery)
  })
}

/**
 * Paginate rows array
 * Returns slice for given page and page size
 */
export function paginateRows<TRow = any>(
  rows: TRow[],
  currentPage: number,
  pageSize: number
): TRow[] {
  if (!rows.length) return []

  const start = (currentPage - 1) * pageSize
  const end = start + pageSize

  return rows.slice(start, end)
}

/**
 * Type coercion for filter comparisons
 * Ensures values are comparable based on field type
 */
export function coerceValue(value: any, fieldType: FilterFieldType): any {
  if (value === null || value === undefined) return null

  switch (fieldType) {
    case 'text':
    case 'select':
    case 'multiselect':
      return String(value).trim().toLowerCase()

    case 'number': {
      const num = Number(value)
      return isNaN(num) ? value : num
    }

    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1'
      }
      return Boolean(value)

    case 'date':
      if (value instanceof Date) return value
      try {
        return new Date(value)
      } catch {
        return value
      }

    default:
      return value
  }
}

/**
 * Compare two values based on field type
 */
export function compareValues(valueA: any, valueB: any, fieldType: FilterFieldType): number {
  const a = coerceValue(valueA, fieldType)
  const b = coerceValue(valueB, fieldType)

  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1

  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b)
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime()
  }

  return String(a).localeCompare(String(b))
}

/**
 * Get row selection state utilities
 */
export function selectAllRows<TRow = any>(
  rows: TRow[],
  keyExtractor?: (r: TRow) => string | number
): Set<string | number> {
  const selected = new Set<string | number>()
  rows.forEach((row) => {
    selected.add(extractRowKey(row, keyExtractor))
  })
  return selected
}

export function deselectAllRows(): Set<string | number> {
  return new Set()
}

export function toggleRowSelection(
  selected: Set<string | number>,
  rowKey: string | number
): Set<string | number> {
  const newSelected = new Set(selected)
  if (newSelected.has(rowKey)) {
    newSelected.delete(rowKey)
  } else {
    newSelected.add(rowKey)
  }
  return newSelected
}

export function isRowSelected(selected: Set<string | number>, rowKey: string | number): boolean {
  return selected.has(rowKey)
}

export function getSelectedRows(
  selected: Set<string | number>,
  rows: any[],
  keyExtractor?: (r: any) => string | number
): any[] {
  return rows.filter((row) => {
    const key = extractRowKey(row, keyExtractor)
    return selected.has(key)
  })
}
