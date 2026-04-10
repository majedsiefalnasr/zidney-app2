import { describe, expect, it } from 'vitest'
import {
  ValidationError,
  validateCreateLicenseInput,
  validateCreateProductInput,
} from '../../src/master-db-schema'

describe('master-db-schema validation', () => {
  it('validates create product input successfully', () => {
    const input = { name: 'My Product', slug: 'my-product', version: '1.2.3' }
    const out = validateCreateProductInput(input)
    expect(out.name).toBe('My Product')
    expect(out.slug).toBe('my-product')
    expect(out.version).toBe('1.2.3')
  })

  it('throws for invalid product slug', () => {
    const input = { name: 'x', slug: 'INVALID_SLUG' }
    expect(() => validateCreateProductInput(input)).toThrow(ValidationError)
  })

  it('validates license input and rejects invalid student_limit', () => {
    const valid = {
      product_id: 'prod-1',
      workspace_slug: 'acme',
      student_limit: 10,
    }
    const out = validateCreateLicenseInput(valid)
    expect(out.product_id).toBe('prod-1')

    const bad = { ...valid, student_limit: -1 }
    expect(() => validateCreateLicenseInput(bad)).toThrow(ValidationError)
  })
})
