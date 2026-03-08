/**
 * Area 5: Architecture Guard Contract Validation (Static Analysis)
 *
 * Verifies that ARCHITECTURE_CONTRACT.json exists and contains the
 * mandatory governance rules that ai-guard.ts enforces at commit time.
 *
 * Stage: STAGE_INFRA_06_ARCHITECTURE_GUARD
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Area 5: Architecture Guard Contract Validation', () => {
  const contractPath = path.join(
    process.cwd(),
    'docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json'
  )

  /**
   * Test 5.1: Contract file exists and is valid JSON
   */
  it('Test 5.1: ARCHITECTURE_CONTRACT.json exists and parses as valid JSON', () => {
    expect(fs.existsSync(contractPath)).toBe(true)

    const raw = fs.readFileSync(contractPath, 'utf-8')
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  /**
   * Test 5.2: forbidPackagesImportingApps rule is enabled
   */
  it('Test 5.2: forbidPackagesImportingApps rule is enabled', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'))

    expect(contract.rules?.dependencyRules?.forbidPackagesImportingApps).toBe(true)
  })

  /**
   * Test 5.3: forbidAppsImportingOtherApps rule is enabled
   */
  it('Test 5.3: forbidAppsImportingOtherApps rule is enabled', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'))

    expect(contract.rules?.dependencyRules?.forbidAppsImportingOtherApps).toBe(true)
  })

  /**
   * Test 5.4: forbidUiImportingDomain source is packages/ui-system
   */
  it('Test 5.4: forbidUiImportingDomain.source is packages/ui-system', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'))

    expect(contract.rules?.layerRules?.forbidUiImportingDomain?.source).toBe('packages/ui-system')
  })

  /**
   * Test 5.5: forbidUiImportingDomain target is packages/domain-core
   */
  it('Test 5.5: forbidUiImportingDomain.target is packages/domain-core', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'))

    expect(contract.rules?.layerRules?.forbidUiImportingDomain?.target).toBe('packages/domain-core')
  })

  /**
   * Test 5.6: forbidApiClientImportingWorker source is packages/api-client
   */
  it('Test 5.6: forbidApiClientImportingWorker.source is packages/api-client', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'))

    expect(contract.rules?.layerRules?.forbidApiClientImportingWorker?.source).toBe(
      'packages/api-client'
    )
  })

  /**
   * Test 5.7: forbidApiClientImportingWorker target is apps/worker
   */
  it('Test 5.7: forbidApiClientImportingWorker.target is apps/worker', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'))

    expect(contract.rules?.layerRules?.forbidApiClientImportingWorker?.target).toBe('apps/worker')
  })
})
