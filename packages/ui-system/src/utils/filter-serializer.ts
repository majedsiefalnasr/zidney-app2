/**
 * Filter Serialization Utilities
 * LOCKED DECISION 3: URL-primary with localStorage fallback + visibility flag
 * Handles Base64 encoding, compact representation, overflow detection
 */

import type { Filter } from '../types'

const VERSION_PREFIX = 'v1:'
const URL_LENGTH_LIMIT = 2000

/**
 * Serialize filters to compact Base64-encoded JSON string
 * Compact representation: { f: fieldId, op: operator, v: value }
 */
export function serializeFilters(filters: Filter[]): string {
  try {
    const compact = filters.map((f) => ({
      f: f.fieldId,
      op: f.operator,
      v: f.value,
    }))

    const json = JSON.stringify({ filters: compact })
    const base64 = btoa(json)

    return `${VERSION_PREFIX}${base64}`
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown serialization error'
    throw new Error(`Cannot serialize filters: ${message}`)
  }
}

/**
 * Deserialize Base64-encoded JSON string back to filters
 * Validates version and structure before parsing
 */
export function deserializeFilters(encoded: string): Filter[] {
  try {
    if (!encoded.startsWith(VERSION_PREFIX)) {
      throw new Error('Invalid filter encoding version')
    }

    const base64 = encoded.slice(VERSION_PREFIX.length)
    const json = atob(base64)
    const data = JSON.parse(json)

    // Validate structure
    if (!data.filters || !Array.isArray(data.filters)) {
      throw new Error('Invalid filter structure: missing or invalid filters array')
    }

    // Map back to full Filter objects
    const filters: Filter[] = data.filters.map((f: unknown) => {
      const fi = f as { f?: string; op?: string; v?: unknown }
      if (!fi.f || !fi.op) {
        throw new Error('Invalid filter: missing fieldId or operator')
      }

      return {
        fieldId: fi.f,
        operator: fi.op,
        value: fi.v,
      }
    })

    return filters
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown deserialization error'
    throw new Error(`Cannot deserialize filters: ${message}`)
  }
}

/**
 * Detect if serialized filter string would exceed URL length limit
 * LOCKED DECISION 3: Triggers overflow warning at > 2000 chars
 */
export function checkUrlOverflow(filters: Filter[]): boolean {
  try {
    const serialized = serializeFilters(filters)
    // Add estimated query param overhead (key + value encoded)
    const fullUrl = `?filters=${encodeURIComponent(serialized)}`
    return fullUrl.length > URL_LENGTH_LIMIT
  } catch {
    // If serialization fails, consider it an overflow (safeguard)
    return true
  }
}

/**
 * Get the serialized size in characters
 */
export function getSerializedSize(filters: Filter[]): number {
  try {
    return serializeFilters(filters).length
  } catch {
    return 0
  }
}

/**
 * Estimate overhead for URL encoding
 */
export function getUrlEncodedSize(filters: Filter[]): number {
  try {
    const serialized = serializeFilters(filters)
    return encodeURIComponent(serialized).length
  } catch {
    return 0
  }
}

/**
 * Get the full URL parameter string
 */
export function getFilterQueryParam(filters: Filter[]): string {
  try {
    const serialized = serializeFilters(filters)
    return `filters=${encodeURIComponent(serialized)}`
  } catch (_error) {
    return ''
  }
}

/**
 * Parse filter query parameter from URL
 */
export function parseFilterQueryParam(queryParam: string): Filter[] {
  try {
    // Handle both "filters=..." and just the value
    let encoded = queryParam
    if (queryParam.startsWith('filters=')) {
      encoded = queryParam.slice(8)
    }

    const decoded = decodeURIComponent(encoded)
    return deserializeFilters(decoded)
  } catch (_error) {
    return []
  }
}

/**
 * Get compression info (useful for logging)
 */
export function getSerializationInfo(filters: Filter[]): {
  filterCount: number
  rawSize: number
  serializedSize: number
  urlEncodedSize: number
  isOverflow: boolean
  compressionRatio: number
} {
  const rawJson = JSON.stringify(filters, null, 2)
  const rawSize = rawJson.length
  const serializedSize = getSerializedSize(filters)
  const urlEncodedSize = getUrlEncodedSize(filters)

  return {
    filterCount: filters.length,
    rawSize,
    serializedSize,
    urlEncodedSize,
    isOverflow: checkUrlOverflow(filters),
    compressionRatio: rawSize > 0 ? Number((serializedSize / rawSize).toFixed(2)) : 0,
  }
}

/**
 * Validate filter array before serialization
 */
export function validateFilters(filters: unknown[]): boolean {
  if (!Array.isArray(filters)) return false

  return filters.every((f) => {
    if (!f || typeof f !== 'object') return false
    const obj = f as { fieldId?: unknown; operator?: unknown; value?: unknown }
    if (typeof obj.fieldId !== 'string' || typeof obj.operator !== 'string') return false
    if (obj.value === undefined && obj.operator !== 'is_empty' && obj.operator !== 'is_not_empty') {
      return false
    }
    return true
  })
}

/**
 * Filter a filter value based on type (for casting/coercion)
 * Useful for normalizing values before comparison
 */
export function filterByColumnType(
  value: unknown,
  fieldType: 'text' | 'select' | 'date' | 'boolean' | 'number'
): unknown {
  if (value === null || value === undefined) return value

  switch (fieldType) {
    case 'text':
      return String(value).trim()
    case 'number':
      return Number(value)
    case 'boolean':
      return value === true || value === 'true' || value === 1
    case 'date':
      return new Date(String(value)).toISOString()
    case 'select':
      return value
    default:
      return value
  }
}

/**
 * Compare two filter arrays for equality
 */
export function areFiltersEqual(filters1: Filter[], filters2: Filter[]): boolean {
  if (filters1.length !== filters2.length) return false

  return filters1.every((f1, index) => {
    const f2 = filters2[index]
    if (!f2) return false
    return (
      f1.fieldId === f2.fieldId &&
      f1.operator === f2.operator &&
      JSON.stringify(f1.value) === JSON.stringify(f2.value)
    )
  })
}
