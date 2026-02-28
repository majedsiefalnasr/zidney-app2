/**
 * Unit Test: Product Service Validation Functions (T061)
 *
 * Tests individual validation functions in isolation:
 * - validateProductName()
 * - validateModulesEnum()
 * - validateSlug()
 * - validateSlugUniqueness()
 * - getProductName()
 */

import {
  validateModulesEnum,
  validateProductName,
  validateSlugFormat as validateSlug,
} from '@zidney/validation/products/productValidation'
import { describe, expect, it } from 'vitest'

describe('T061: Product Service Validation Unit Tests', () => {
  describe('validateProductName()', () => {
    it('should accept valid English name', () => {
      const result = validateProductName({ en: 'Valid Product Name' })
      expect(result).toBe(true)
    })

    it('should accept valid bilingual names', () => {
      const result = validateProductName({
        en: 'Product',
        ar: 'منتج',
      })
      expect(result).toBe(true)
    })

    it('should reject empty English name', () => {
      expect(() => {
        validateProductName({ en: '' })
      }).toThrow()
    })

    it('should reject missing English name', () => {
      expect(() => {
        validateProductName({ ar: 'منتج' } as any)
      }).toThrow()
    })

    it('should accept without Arabic name', () => {
      const result = validateProductName({ en: 'English Only' })
      expect(result).toBe(true)
    })

    it('should accept very long names (up to 255 chars)', () => {
      const longName = 'A'.repeat(255)
      const result = validateProductName({ en: longName })
      expect(result).toBe(true)
    })

    it('should reject names exceeding max length', () => {
      const tooLong = 'A'.repeat(256)
      expect(() => {
        validateProductName({ en: tooLong })
      }).toThrow()
    })

    it('should accept special characters', () => {
      const result = validateProductName({
        en: 'Product & Services (Beta)',
      })
      expect(result).toBe(true)
    })

    it('should accept numbers in names', () => {
      const result = validateProductName({ en: 'Product123' })
      expect(result).toBe(true)
    })

    it('should accept single character name', () => {
      const result = validateProductName({ en: 'A' })
      expect(result).toBe(true)
    })

    it('should accept Unicode/RTL text', () => {
      const result = validateProductName({
        en: 'Test',
        ar: 'منتج اختبار الذي يحتوي على نص طويل',
      })
      expect(result).toBe(true)
    })
  })

  describe('validateModulesEnum()', () => {
    it('should accept single valid module', () => {
      const result = validateModulesEnum(['MODULE_ATTEMPT'])
      expect(result).toBe(true)
    })

    it('should accept all six valid modules', () => {
      const allModules = [
        'MODULE_ASSESSMENT',
        'MODULE_ATTEMPT',
        'MODULE_CONTENT',
        'MODULE_REPORTING',
        'MODULE_PROCTOR',
        'MODULE_ANALYTICS',
      ]
      const result = validateModulesEnum(allModules as any[])
      expect(result).toBe(true)
    })

    it('should accept multiple valid modules', () => {
      const result = validateModulesEnum([
        'MODULE_ATTEMPT',
        'MODULE_REPORTING',
        'MODULE_ANALYTICS',
      ])
      expect(result).toBe(true)
    })

    it('should reject invalid module name', () => {
      expect(() => {
        validateModulesEnum(['INVALID_MODULE'])
      }).toThrow()
    })

    it('should reject mixed valid and invalid modules', () => {
      expect(() => {
        validateModulesEnum(['MODULE_ATTEMPT', 'INVALID_MODULE'])
      }).toThrow()
    })

    it('should reject empty array', () => {
      expect(() => {
        validateModulesEnum([])
      }).toThrow()
    })

    it('should reject duplicate modules', () => {
      expect(() => {
        validateModulesEnum(['MODULE_ATTEMPT', 'MODULE_ATTEMPT'])
      }).toThrow()
    })

    it('should reject null/undefined', () => {
      expect(() => {
        validateModulesEnum(null as any)
      }).toThrow()
    })

    it('should reject non-array input', () => {
      expect(() => {
        validateModulesEnum('MODULE_ATTEMPT' as any)
      }).toThrow()
    })
  })

  describe('validateSlug()', () => {
    it('should accept valid lowercase slug', () => {
      const result = validateSlug('valid-slug')
      expect(result).toBe(true)
    })

    it('should accept slug with numbers', () => {
      const result = validateSlug('product-123')
      expect(result).toBe(true)
    })

    it('should accept slug with consecutive hyphens', () => {
      const result = validateSlug('test--product--name')
      expect(result).toBe(true)
    })

    it('should accept single character slug', () => {
      const result = validateSlug('a')
      expect(result).toBe(true)
    })

    it('should accept numeric slug', () => {
      const result = validateSlug('12345')
      expect(result).toBe(true)
    })

    it('should reject uppercase letters', () => {
      expect(() => {
        validateSlug('Invalid-Slug')
      }).toThrow()
    })

    it('should reject spaces', () => {
      expect(() => {
        validateSlug('invalid slug')
      }).toThrow()
    })

    it('should reject special characters (except hyphen)', () => {
      expect(() => {
        validateSlug('invalid@slug')
      }).toThrow()
    })

    it('should reject leading hyphen', () => {
      expect(() => {
        validateSlug('-invalid')
      }).toThrow()
    })

    it('should reject trailing hyphen', () => {
      expect(() => {
        validateSlug('invalid-')
      }).toThrow()
    })

    it('should reject empty string', () => {
      expect(() => {
        validateSlug('')
      }).toThrow()
    })

    it('should reject very long slug', () => {
      const veryLong = 'a'.repeat(256)
      expect(() => {
        validateSlug(veryLong)
      }).toThrow()
    })

    it('should accept max length slug', () => {
      const maxLength = 'a'.repeat(100) + '-' + 'b'.repeat(100)
      const result = validateSlug(maxLength)
      expect(result).toBe(true)
    })
  })

  describe('Edge cases & combinations', () => {
    it('should validate name with 1 char and modules with all', () => {
      const nameResult = validateProductName({ en: 'A' })
      const moduleResult = validateModulesEnum([
        'MODULE_ASSESSMENT',
        'MODULE_ATTEMPT',
        'MODULE_CONTENT',
        'MODULE_REPORTING',
        'MODULE_PROCTOR',
        'MODULE_ANALYTICS',
      ])
      expect(nameResult && moduleResult).toBe(true)
    })

    it('should validate name with special chars and simple slug', () => {
      const nameResult = validateProductName({
        en: 'Product & Services (Beta) #2',
      })
      const slugResult = validateSlug('product-services-beta-2')
      expect(nameResult && slugResult).toBe(true)
    })

    it('should handle Arabic text with Latin slug', () => {
      const nameResult = validateProductName({
        en: 'Assessment',
        ar: 'تقييم',
      })
      const slugResult = validateSlug('assessment')
      expect(nameResult && slugResult).toBe(true)
    })
  })

  describe('Type safety', () => {
    it('should handle type coercion gracefully', () => {
      expect(() => {
        validateSlug(123 as any)
      }).toThrow()
    })

    it('should handle null inputs', () => {
      expect(() => {
        validateProductName(null as any)
      }).toThrow()
    })

    it('should handle undefined inputs', () => {
      expect(() => {
        validateModulesEnum(undefined as any)
      }).toThrow()
    })
  })

  describe('Performance considerations', () => {
    it('should validate quickly for typical inputs', () => {
      const start = performance.now()
      validateProductName({ en: 'Normal Product Name' })
      validateModulesEnum(['MODULE_ATTEMPT', 'MODULE_REPORTING'])
      validateSlug('normal-product-slug')
      const duration = performance.now() - start
      expect(duration).toBeLessThan(10) // Should complete in <10ms
    })

    it('should handle max-length strings efficiently', () => {
      const start = performance.now()
      const maxName = 'A'.repeat(255)
      validateProductName({ en: maxName })
      const duration = performance.now() - start
      expect(duration).toBeLessThan(5)
    })
  })
})
