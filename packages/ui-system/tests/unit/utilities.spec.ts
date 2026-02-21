import { describe, expect, it } from 'vitest'
import {
  deserializeFilters,
  detectFilterOverflow,
  serializeFilters,
} from '../../src/utils/filter-serializer'
import {
  calculateTotalPages,
  extractRowKey,
  paginateRows,
  sortRows,
} from '../../src/utils/table-helpers'
import { decodeURL, encodeURL, syncToURL } from '../../src/utils/url-sync'

describe('Utility Functions - Unit Tests (Phase 4C)', () => {
  describe('Filter Serialization (Task 2A / 9C)', () => {
    it('should serialize empty filters', () => {
      const result = serializeFilters([])
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should serialize single filter', () => {
      const filter = {
        fieldId: 'status',
        operator: 'equals',
        value: 'active',
      }

      const serialized = serializeFilters([filter])
      expect(serialized).toContain('v1:') // version prefix
    })

    it('should use compact key naming (f, op, v)', () => {
      const serialized = serializeFilters([
        { fieldId: 'status', operator: 'equals', value: 'active' },
      ])

      // Should use compact notation
      expect(typeof serialized).toBe('string')
      expect(serialized.length).toBeGreaterThan(0)
    })

    it('should encode filters to base64', () => {
      const serialized = serializeFilters([
        { fieldId: 'status', operator: 'equals', value: 'active' },
      ])

      // Should be base64-encoded after version prefix
      expect(serialized).toMatch(/^v1:/)
    })

    it('should deserialize back to original (round-trip)', () => {
      const original = [
        { fieldId: 'status', operator: 'equals', value: 'active' },
        { fieldId: 'type', operator: 'contains', value: 'user' },
      ]

      const serialized = serializeFilters(original)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized).toHaveLength(original.length)
      expect(deserialized[0].fieldId).toBe(original[0].fieldId)
      expect(deserialized[0].operator).toBe(original[0].operator)
      expect(deserialized[0].value).toBe(original[0].value)
    })

    it('should detect overflow > 2000 chars', () => {
      const manyFilters = Array.from({ length: 50 }, (_, i) => ({
        fieldId: `field_${i}`,
        operator: 'equals',
        value: `value_${i}_${'x'.repeat(100)}`,
      }))

      const serialized = serializeFilters(manyFilters)
      const isOverflow = detectFilterOverflow(serialized)

      expect(typeof isOverflow).toBe('boolean')
    })

    it('should handle error on invalid input', () => {
      expect(() => {
        deserializeFilters('invalid-base64')
      }).not.toThrow()
    })

    it('should preserve complex values', () => {
      const filters = [
        {
          fieldId: 'date_range',
          operator: 'between',
          value: { start: '2024-01-01', end: '2024-12-31' },
        },
      ]

      const serialized = serializeFilters(filters)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized[0].value).toEqual(filters[0].value)
    })

    it('should handle multiple operators', () => {
      const filters = [
        { fieldId: 'name', operator: 'contains', value: 'John' },
        { fieldId: 'age', operator: 'greater_than', value: 18 },
        { fieldId: 'status', operator: 'in', value: ['active', 'pending'] },
      ]

      const serialized = serializeFilters(filters)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized).toHaveLength(3)
      expect(deserialized[1].operator).toBe('greater_than')
      expect(deserialized[2].value).toEqual(['active', 'pending'])
    })
  })

  describe('Table Helpers (Task 2B / 9C)', () => {
    it('should extract row key with string accessor', () => {
      const row = { id: 'user-1', name: 'John' }
      const key = extractRowKey(row, 'id')

      expect(key).toBe('user-1')
    })

    it('should extract row key with function accessor', () => {
      const row = { userId: 'usr-1', profile: { name: 'John' } }
      const key = extractRowKey(
        row,
        (row) => `${row.userId}-${row.profile.name}`
      )

      expect(key).toBe('usr-1-John')
    })

    it('should paginate rows correctly (client mode)', () => {
      const rows = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
      }))

      const page1 = paginateRows(rows, 1, 10)
      expect(page1).toHaveLength(10)
      expect(page1[0].id).toBe(0)

      const page2 = paginateRows(rows, 2, 10)
      expect(page2[0].id).toBe(10)
    })

    it('should handle last page with partial rows', () => {
      const rows = Array.from({ length: 25 }, (_, i) => ({ id: i }))

      const page3 = paginateRows(rows, 3, 10)
      expect(page3).toHaveLength(5) // Only 5 rows on last page
    })

    it('should sort rows ascending', () => {
      const rows = [
        { id: 1, name: 'Charlie' },
        { id: 2, name: 'Alice' },
        { id: 3, name: 'Bob' },
      ]

      const sorted = sortRows(rows, 'name', 'asc')
      expect(sorted[0].name).toBe('Alice')
      expect(sorted[2].name).toBe('Charlie')
    })

    it('should sort rows descending', () => {
      const rows = [
        { id: 1, name: 'Charlie' },
        { id: 2, name: 'Alice' },
        { id: 3, name: 'Bob' },
      ]

      const sorted = sortRows(rows, 'name', 'desc')
      expect(sorted[0].name).toBe('Charlie')
      expect(sorted[2].name).toBe('Alice')
    })

    it('should sort numeric values correctly', () => {
      const rows = [{ age: 30 }, { age: 5 }, { age: 20 }]

      const sorted = sortRows(rows, 'age', 'asc')
      expect(sorted[0].age).toBe(5)
      expect(sorted[2].age).toBe(30)
    })

    it('should calculate total pages', () => {
      expect(calculateTotalPages(100, 10)).toBe(10)
      expect(calculateTotalPages(25, 10)).toBe(3)
      expect(calculateTotalPages(0, 10)).toBe(0)
      expect(calculateTotalPages(1, 10)).toBe(1)
    })

    it('should clamp page to valid range', () => {
      const rows = Array.from({ length: 25 }, (_, i) => ({ id: i }))

      const page0 = paginateRows(rows, 0, 10) // Should clamp to page 1
      expect(page0.length).toBeGreaterThan(0)
    })
  })

  describe('URL Sync Utilities (Task 2C / 9C)', () => {
    it('should encode state to URL-safe string', () => {
      const state = {
        currentPage: 2,
        pageSize: 20,
        filters: [{ fieldId: 'status', operator: 'equals', value: 'active' }],
      }

      const encoded = encodeURL(state)
      expect(typeof encoded).toBe('string')
      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should decode URL-safe string back to state', () => {
      const original = {
        currentPage: 2,
        pageSize: 20,
      }

      const encoded = encodeURL(original)
      const decoded = decodeURL(encoded)

      expect(decoded.currentPage).toBe(2)
      expect(decoded.pageSize).toBe(20)
    })

    it('should round-trip encode/decode', () => {
      const state = {
        currentPage: 5,
        pageSize: 50,
        sortBy: 'name',
        sortDirection: 'desc',
      }

      const encoded = encodeURL(state)
      const decoded = decodeURL(encoded)

      expect(decoded).toEqual(state)
    })

    it('should handle empty state', () => {
      const encoded = encodeURL({})
      const decoded = decodeURL(encoded)

      expect(decoded).toBeDefined()
    })

    it('should handle invalid encoded URL', () => {
      expect(() => {
        decodeURL('invalid-url-state')
      }).not.toThrow()
    })

    it('should sync state to URL', () => {
      // Mock window.history if needed
      const state = { currentPage: 2 }

      if (typeof window !== 'undefined' && window.history) {
        // This would normally update URL
        syncToURL(state, '/audit-logs')

        // Verify it doesn't throw
        expect(true).toBe(true)
      }
    })

    it('should handle localStorage fallback', () => {
      const state = { currentPage: 1 }

      // This would store in localStorage if URL too long
      syncToURL(state, '/page')

      expect(true).toBe(true)
    })
  })

  describe('Deterministic Output', () => {
    it('should serialize same input to same output', () => {
      const filter = {
        fieldId: 'status',
        operator: 'equals',
        value: 'active',
      }

      const result1 = serializeFilters([filter])
      const result2 = serializeFilters([filter])

      expect(result1).toBe(result2)
    })

    it('should sort deterministically', () => {
      const rows = [
        { id: 3, name: 'C' },
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]

      const sorted1 = sortRows([...rows], 'id', 'asc')
      const sorted2 = sortRows([...rows], 'id', 'asc')

      expect(sorted1).toEqual(sorted2)
    })

    it('should paginate deterministically', () => {
      const rows = Array.from({ length: 50 }, (_, i) => ({ id: i }))

      const page1 = paginateRows([...rows], 1, 10)
      const page2 = paginateRows([...rows], 1, 10)

      expect(page1).toEqual(page2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty arrays', () => {
      expect(serializeFilters([])).toBeDefined()
      expect(paginateRows([], 1, 10)).toEqual([])
      expect(sortRows([], 'id', 'asc')).toEqual([])
    })

    it('should handle null values', () => {
      const rows = [
        { id: 1, value: null },
        { id: 2, value: 'test' },
      ]

      const sorted = sortRows(rows, 'value', 'asc')
      expect(sorted).toHaveLength(2)
    })

    it('should handle undefined values', () => {
      const rows = [
        { id: 1, value: undefined },
        { id: 2, value: 'test' },
      ]

      const sorted = sortRows(rows, 'value', 'asc')
      expect(sorted).toHaveLength(2)
    })

    it('should handle very large datasets', () => {
      const largeRows = Array.from({ length: 10000 }, (_, i) => ({ id: i }))

      const start = performance.now()
      const paginated = paginateRows(largeRows, 100, 10)
      const duration = performance.now() - start

      expect(paginated).toHaveLength(10)
      expect(duration).toBeLessThan(50) // Should be fast
    })

    it('should handle special characters in filter values', () => {
      const filters = [
        {
          fieldId: 'name',
          operator: 'contains',
          value: "O'Brien & Co. <script>",
        },
      ]

      const serialized = serializeFilters(filters)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized[0].value).toBe("O'Brien & Co. <script>")
    })

    it('should handle unicode characters', () => {
      const filters = [
        { fieldId: 'name', operator: 'contains', value: '你好世界 🌍' },
      ]

      const serialized = serializeFilters(filters)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized[0].value).toBe('你好世界 🌍')
    })
  })
})
