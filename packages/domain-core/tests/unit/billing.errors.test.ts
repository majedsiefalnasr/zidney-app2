import { describe, expect, it } from 'vitest'
import { BILLING_ERROR_HTTP, BillingError } from '../../src/billing/billing.errors'

describe('BillingError', () => {
  it('sets code, httpStatus and default message', () => {
    const err = new BillingError('INVOICE_NOT_FOUND')
    expect(err.name).toBe('BillingError')
    expect(err.code).toBe('INVOICE_NOT_FOUND')
    expect(err.httpStatus).toBe(BILLING_ERROR_HTTP.INVOICE_NOT_FOUND)
    expect(err.message).toBe('INVOICE_NOT_FOUND')
  })

  it('accepts a custom message', () => {
    const err = new BillingError('INVOICE_CANNOT_CANCEL', 'cannot cancel here')
    expect(err.message).toBe('cannot cancel here')
    expect(err.httpStatus).toBe(BILLING_ERROR_HTTP.INVOICE_CANNOT_CANCEL)
  })
})
