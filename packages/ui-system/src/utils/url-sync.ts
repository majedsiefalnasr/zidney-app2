/**
 * URL State Sync Utilities
 * Serializes and deserializes table state (filters, pagination, sorting) to/from URL
 * LOCKED DECISION 3: Compact serialization for URL efficiency
 */

import type { Filter, SortState } from '../types'
import { deserializeFilters, serializeFilters } from './filter-serializer'

export interface TableState {
  filters?: Filter[]
  page?: number
  pageSize?: number
  sort?: SortState
  search?: string
}

/**
 * Serialize table state to URLSearchParams
 */
export function serializeQueryState(state: Partial<TableState>): URLSearchParams {
  const params = new URLSearchParams()

  if (state.filters && state.filters.length > 0) {
    try {
      params.set('filters', serializeFilters(state.filters))
    } catch {
      // Silently ignore serialization errors
    }
  }

  if (state.page && state.page > 1) {
    params.set('page', String(state.page))
  }

  if (state.pageSize && state.pageSize !== 25) {
    params.set('pageSize', String(state.pageSize))
  }

  if (state.sort) {
    params.set('sort', state.sort.column)
    params.set('sortDir', state.sort.direction)
  }

  if (state.search) {
    params.set('search', state.search)
  }

  return params
}

/**
 * Deserialize table state from URLSearchParams or plain object
 */
export function deserializeQueryState(
  params: URLSearchParams | Record<string, string>
): Partial<TableState> {
  const state: Partial<TableState> = {}

  // Convert URLSearchParams to object if needed
  const paramsObj: Record<string, string> =
    params instanceof URLSearchParams ? Object.fromEntries(params) : params

  // Parse filters
  if (paramsObj.filters) {
    try {
      state.filters = deserializeFilters(paramsObj.filters)
    } catch {
      // Invalid filters; ignore
    }
  }

  // Parse pagination
  if (paramsObj.page) {
    const page = parseInt(paramsObj.page, 10)
    if (!isNaN(page) && page > 0) {
      state.page = page
    }
  }

  if (paramsObj.pageSize) {
    const pageSize = parseInt(paramsObj.pageSize, 10)
    if (!isNaN(pageSize) && pageSize > 0) {
      state.pageSize = pageSize
    }
  }

  // Parse sorting
  if (paramsObj.sort) {
    state.sort = {
      column: paramsObj.sort,
      direction: (paramsObj.sortDir as any) === 'desc' ? 'desc' : 'asc',
    }
  }

  // Parse search
  if (paramsObj.search) {
    state.search = paramsObj.search
  }

  return state
}

/**
 * Build query string from table state
 */
export function buildQueryString(state: Partial<TableState>): string {
  const params = serializeQueryState(state)
  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

/**
 * Get individual query parameter value with type coercion
 */
export function getQueryParamValue(
  params: Record<string, string> | URLSearchParams,
  key: string,
  type: 'string' | 'number' | 'boolean'
): any {
  let value: string | null = null

  if (params instanceof URLSearchParams) {
    value = params.get(key)
  } else {
    value = params[key] ?? null
  }

  if (value === null) return null

  switch (type) {
    case 'number': {
      const num = Number(value)
      return isNaN(num) ? null : num
    }

    case 'boolean':
      return value === 'true' || value === '1' || value === 'yes'

    case 'string':
    default:
      return value
  }
}

/**
 * Parse query string from URL
 */
export function parseQueryString(queryString: string): Record<string, string> {
  if (!queryString) return {}

  // Remove leading '?'
  const cleanQuery = queryString.startsWith('?') ? queryString.slice(1) : queryString

  const params = new URLSearchParams(cleanQuery)
  const result: Record<string, string> = {}

  params.forEach((value, key) => {
    result[key] = value
  })

  return result
}

/**
 * Get the current browser URL state
 */
export function getCurrentUrlState(): Partial<TableState> {
  if (typeof window === 'undefined') return {}

  const params = new URLSearchParams(window.location.search)
  return deserializeQueryState(params)
}

/**
 * Push table state to browser URL (without reload)
 */
export function pushTableStateToUrl(state: Partial<TableState>, title?: string): void {
  if (typeof window === 'undefined') return

  const queryString = buildQueryString(state)
  const newUrl = window.location.pathname + queryString

  window.history.replaceState({ ...state }, title || '', newUrl)
}

/**
 * Replace table state in browser URL (replaces history entry)
 */
export function replaceTableStateInUrl(state: Partial<TableState>, title?: string): void {
  if (typeof window === 'undefined') return

  const queryString = buildQueryString(state)
  const newUrl = window.location.pathname + queryString

  window.history.replaceState({ ...state }, title || '', newUrl)
}

/**
 * Merge table states (useful for updating partial state)
 */
export function mergeTableStates(
  current: Partial<TableState>,
  updates: Partial<TableState>
): Partial<TableState> {
  return {
    ...current,
    ...updates,
  }
}

/**
 * Reset table state to defaults
 */
export function resetTableState(): Partial<TableState> {
  return {
    filters: [],
    page: 1,
    pageSize: 25,
    sort: undefined,
    search: undefined,
  }
}

/**
 * Check if state has any non-default values
 */
export function hasTableStateChanges(state: Partial<TableState>): boolean {
  return (
    (state.filters && state.filters.length > 0) ||
    (state.page && state.page > 1) ||
    (state.pageSize && state.pageSize !== 25) ||
    !!state.sort ||
    !!state.search
  )
}

/**
 * Get state changes as readable summary
 */
export function getTableStateChangeSummary(state: Partial<TableState>): string[] {
  const changes: string[] = []

  if (state.filters && state.filters.length > 0) {
    changes.push(`${state.filters.length} filter(s) applied`)
  }

  if (state.page && state.page > 1) {
    changes.push(`Page ${state.page}`)
  }

  if (state.sort) {
    changes.push(`Sorted by ${state.sort.column} (${state.sort.direction})`)
  }

  if (state.search) {
    changes.push(`Search: "${state.search}"`)
  }

  return changes
}

/**
 * Save table state to localStorage
 */
export function saveTableStateToStorage(key: string, state: Partial<TableState>): void {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // localStorage unavailable or quota exceeded
  }
}

/**
 * Load table state from localStorage
 */
export function loadTableStateFromStorage(key: string): Partial<TableState> | null {
  try {
    const item = localStorage.getItem(key)
    if (!item) return null
    return JSON.parse(item) as Partial<TableState>
  } catch {
    return null
  }
}

/**
 * Clear table state from localStorage
 */
export function clearTableStateFromStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // localStorage unavailable
  }
}
