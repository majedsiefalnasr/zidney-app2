#!/usr/bin/env bun
/**
 * Simple Cache Effectiveness Test (T063)
 *
 * Tests that cache correctly stores and retrieves artifacts
 * without regenerating when source files are unchanged
 */

import { unlinkSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createCacheManager } from '../core/cache-manager'
import { createLogger } from '../core/logger-factory'

const logger = createLogger('cache-test')

async function main() {
  logger.info('Testing cache functionality...')

  const cacheManager = createCacheManager('dependency-graph')

  // Clear any existing cache
  try {
    cacheManager.clear()
  } catch (e) {
    // ignore
  }

  // Test 1: First run should miss (no cache)
  logger.info('Test 1: Cold run (cache miss)')
  const result1 = await cacheManager.get(['package.json'])
  if (result1 === null) {
    logger.info('✓ Cold run correctly returned null (cache miss)')
  } else {
    logger.warn('✗ Cold run should return null, but got cached result')
  }

  // Test 2: Set cache
  logger.info('Test 2: Storing data in cache')
  const testData = {
    timestamp: Date.now(),
    modules: ['pkg1', 'pkg2'],
    edges: [{ from: 'pkg1', to: 'pkg2' }],
  }

  await cacheManager.set(testData, ['package.json'], 100)
  logger.info('✓ Data stored in cache')

  // Test 3: Warm run should hit (cache exists and files unchanged)
  logger.info('Test 3: Warm run (cache hit)')
  const result2 = await cacheManager.get(['package.json'])
  if (result2 !== null && JSON.stringify(result2) === JSON.stringify(testData)) {
    logger.info('✓ Warm run correctly returned cached data')
  } else {
    logger.warn('✗ Warm run should return cached result')
  }

  // Test 4: Check stats
  const stats = cacheManager.getStats()
  console.log('\n📊 CACHE STATS\n')
  console.log(`Hits: ${stats.hits}`)
  console.log(`Misses: ${stats.misses}`)
  console.log(`Hit Ratio: ${(stats.hitratio * 100).toFixed(1)}%`)
  console.log(`Expirations: ${stats.expirations}`)

  // Test 5: Runtime dependents cache (second artifact type)
  logger.info('Test 4: Testing runtime-dependents cache')
  const rtCache = createCacheManager('runtime-dependents')
  rtCache.clear()

  const rtData = {
    timestamp: Date.now(),
    dependents: { 'pkg1': ['pkg2', 'pkg3'] },
    moduleCount: 1,
    totalDependentEdges: 2,
  }

  await rtCache.set(rtData, ['package.json'], 50)
  const rtResult = await rtCache.get(['package.json'])

  if (rtResult && JSON.stringify(rtResult) === JSON.stringify(rtData)) {
    logger.info('✓ Runtime dependents cache working correctly')
  }

  const rtStats = rtCache.getStats()
  console.log('\n## Runtime Dependents Cache\n')
  console.log(`Hits: ${rtStats.hits}`)
  console.log(`Hit Ratio: ${(rtStats.hitratio * 100).toFixed(1)}%`)

  // Overall result
  const depGraphStats = cacheManager.getStats()
  const overallSuccess = depGraphStats.hitratio > 0 && rtStats.hits > 0

  console.log(`\n${overallSuccess ? '✓' : '✗'} CACHE FUNCTIONALITY ${overallSuccess ? 'WORKING' : 'NEEDS DEBUGGING'}`)

  process.exit(overallSuccess ? 0 : 1)
}

main().catch((err) => {
  logger.error('Test failed', { error: String(err) })
  process.exit(1)
})
