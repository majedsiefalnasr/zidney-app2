import { describe, expect, it } from 'vitest'
import { ValidationError, validateCreateTenantRegistryInput } from '../../src/master-db-schema'

describe('validateCreateTenantRegistryInput', () => {
  it('accepts valid tenant registry input', () => {
    const input = {
      license_id: 'lic-1',
      workspace_slug: 'acme-inc',
      db_host: 'db.local',
      db_name: 'zidney',
      db_user: 'user',
      db_password_encrypted: 'secret',
    }
    const out = validateCreateTenantRegistryInput(input)
    expect(out.workspace_slug).toBe('acme-inc')
  })

  it('throws for invalid db_port', () => {
    const bad = {
      license_id: 'lic-1',
      workspace_slug: 'acme',
      db_host: 'host',
      db_name: 'db',
      db_user: 'u',
      db_password_encrypted: 'p',
      db_port: 70000,
    }
    expect(() => validateCreateTenantRegistryInput(bad)).toThrow(ValidationError)
  })
})
