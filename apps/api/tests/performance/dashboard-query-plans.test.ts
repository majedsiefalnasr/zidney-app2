/**
 * Dashboard Query Plan Verification Tests
 *
 * Purpose: Verify that all dashboard endpoint queries use indexes efficiently
 * - Run EXPLAIN ANALYZE on each query
 * - Verify: Seq Scan = 0 (all use indexes)
 * - Capture: Execution time, rows returned
 * - Save baseline for regression testing
 *
 * File: apps/api/tests/performance/dashboard-query-plans.test.ts
 * Task: T029
 * Phase: 1 - Backend Implementation
 *
 * Constitutional Compliance:
 * ✓ Performance verification: <300ms per endpoint
 * ✓ Query optimization: No sequential scans
 * ✓ Baseline documentation: Saved for regression testing
 * ✓ Performance SLA: Validates <300ms latency guarantee
 *
 * Query Plan Analysis:
 * - EXPLAIN ANALYZE shows actual execution times
 * - Seq Scan count must be 0 for all queries (all must use indexes)
 * - Index Scan or Bitmap Index Scan is expected
 * - Total Planning + Execution time should be < 100ms (margin for load)
 *
 * Baseline Output:
 * - Captured in docs/mmc-dashboard-query-plans.md
 * - Used for regression testing in future deployments
 * - Compared against performance targets
 */

import fs from 'fs'
import path from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { getTestDb } from '../fixtures/test-db'

interface QueryPlan {
  query: string
  endpoint: string
  planText: string
  executionTime: number
  planningTime: number
  rowsReturned: number
  seqScans: number
  indexScans: number
  status: 'PASS' | 'FAIL'
  notes: string
}

let db: any
const queryPlans: QueryPlan[] = []

describe('Dashboard Query Plan Verification (T029)', () => {
  beforeAll(async () => {
    db = await getTestDb()
  })

  /**
   * Helper: Parse EXPLAIN ANALYZE output
   */
  function parseExplainOutput(explainText: string): {
    executionTime: number
    planningTime: number
    seqScans: number
    indexScans: number
  } {
    const executionMatch = explainText.match(/Execution Time:\s+([\d.]+)\s+ms/)
    const planningMatch = explainText.match(/Planning Time:\s+([\d.]+)\s+ms/)
    const seqScanMatch = explainText.match(/Seq Scan/g)
    const indexScanMatch = explainText.match(/Index Scan|Bitmap Index Scan/g)

    return {
      executionTime: executionMatch ? parseFloat(executionMatch[1]) : 0,
      planningTime: planningMatch ? parseFloat(planningMatch[1]) : 0,
      seqScans: seqScanMatch ? seqScanMatch.length : 0,
      indexScans: indexScanMatch ? indexScanMatch.length : 0,
    }
  }

  /**
   * Helper: Run EXPLAIN ANALYZE on a query
   */
  async function analyzeQuery(
    endpoint: string,
    query: string
  ): Promise<QueryPlan> {
    const explainQuery = `EXPLAIN ANALYZE ${query}`

    try {
      const result = await db.query(explainQuery)
      const planText = result.rows
        .map((row: any) => Object.values(row).join(' '))
        .join('\n')

      const { executionTime, planningTime, seqScans, indexScans } =
        parseExplainOutput(planText)

      // Get actual row count by running the original query
      const dataResult = await db.query(query)
      const rowsReturned = dataResult.rowCount

      const status = seqScans === 0 ? 'PASS' : 'FAIL'

      return {
        query,
        endpoint,
        planText,
        executionTime,
        planningTime,
        rowsReturned,
        seqScans,
        indexScans,
        status,
        notes:
          seqScans > 0
            ? `⚠️ Sequential scan detected: ${seqScans} scans (indexes not used)`
            : '✓ All indexes used effectively',
      }
    } catch (error) {
      return {
        query,
        endpoint,
        planText: `Error: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: 0,
        planningTime: 0,
        rowsReturned: 0,
        seqScans: -1,
        indexScans: 0,
        status: 'FAIL',
        notes: 'Query execution failed',
      }
    }
  }

  // ============================================================================
  // T029-1: Summary Endpoint Query Plan
  // ============================================================================
  it('should verify summary endpoint query uses indexes', async () => {
    const query = `
      SELECT 
        status,
        COUNT(*) as count
      FROM licenses
      WHERE deleted_at IS NULL
      GROUP BY status
    `

    const plan = await analyzeQuery('summary', query)
    queryPlans.push(plan)

    expect(plan.status).toBe('PASS')
    expect(plan.seqScans).toBe(0)
    expect(plan.executionTime).toBeLessThan(100)
    console.log(`✓ Summary query: ${plan.executionTime.toFixed(2)}ms`)
  })

  // ============================================================================
  // T029-2: Revenue Summary Query Plan
  // ============================================================================
  it('should verify revenue summary query uses time index', async () => {
    const query = `
      SELECT 
        SUM(amount_cents) as total_cents,
        COUNT(*) as record_count
      FROM revenue_records
      WHERE created_at >= DATE_TRUNC('month', NOW())
    `

    const plan = await analyzeQuery('summary_revenue', query)
    queryPlans.push(plan)

    expect(plan.status).toBe('PASS')
    expect(plan.seqScans).toBe(0)
    expect(plan.executionTime).toBeLessThan(100)
    console.log(`✓ Revenue summary query: ${plan.executionTime.toFixed(2)}ms`)
  })

  // ============================================================================
  // T029-3: Revenue Breakdown Query Plan (Top 5 Products)
  // ============================================================================
  it('should verify revenue breakdown query uses product + time composite index', async () => {
    const query = `
      SELECT 
        r.product_id,
        SUM(r.amount_cents) as total_cents,
        COUNT(DISTINCT r.license_id) as license_count
      FROM revenue_records r
      WHERE created_at >= DATE '2026-02-26' - INTERVAL '30 days'
        AND created_at < DATE '2026-02-26'
      GROUP BY r.product_id
      ORDER BY total_cents DESC
      LIMIT 5
    `

    const plan = await analyzeQuery('revenue_breakdown', query)
    queryPlans.push(plan)

    expect(plan.status).toBe('PASS')
    expect(plan.seqScans).toBe(0)
    expect(plan.executionTime).toBeLessThan(150)
    console.log(`✓ Revenue breakdown query: ${plan.executionTime.toFixed(2)}ms`)
  })

  // ============================================================================
  // T029-4: Geographic Query Plan (Country Aggregation)
  // ============================================================================
  it('should verify geographic query uses billing_country index', async () => {
    const query = `
      SELECT 
        billing_country,
        COUNT(DISTINCT license_id) as license_count,
        SUM(amount_cents) as total_cents,
        AVG(amount_cents) as avg_per_record
      FROM revenue_records
      WHERE billing_country IS NOT NULL
      GROUP BY billing_country
      ORDER BY total_cents DESC
      LIMIT 100
    `

    const plan = await analyzeQuery('geographic', query)
    queryPlans.push(plan)

    expect(plan.status).toBe('PASS')
    expect(plan.seqScans).toBe(0)
    expect(plan.executionTime).toBeLessThan(150)
    console.log(`✓ Geographic query: ${plan.executionTime.toFixed(2)}ms`)
  })

  // ============================================================================
  // T029-5: Affiliates Query Plan (Affiliate + Usage Join)
  // ============================================================================
  it('should verify affiliates query uses composite affiliate index', async () => {
    const query = `
      SELECT 
        a.id as affiliate_id,
        a.name,
        a.status,
        COUNT(u.id) as usage_count,
        SUM(u.commission_cents) as total_commission_cents
      FROM affiliates a
      LEFT JOIN affiliate_usages u ON a.id = u.affiliate_id
      WHERE a.status = 'ACTIVE'
      GROUP BY a.id, a.name, a.status
      ORDER BY total_commission_cents DESC NULLS LAST
      LIMIT 50
      OFFSET 0
    `

    const plan = await analyzeQuery('affiliates', query)
    queryPlans.push(plan)

    expect(plan.status).toBe('PASS')
    expect(plan.seqScans).toBe(0)
    expect(plan.executionTime).toBeLessThan(200)
    console.log(`✓ Affiliates query: ${plan.executionTime.toFixed(2)}ms`)
  })

  // ============================================================================
  // T029-6: Trends Query Plan (Monthly Aggregation)
  // ============================================================================
  it('should verify trends query uses time index for monthly aggregation', async () => {
    const query = `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(DISTINCT license_id) as license_count,
        SUM(amount_cents) as total_cents
      FROM revenue_records
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `

    const plan = await analyzeQuery('trends', query)
    queryPlans.push(plan)

    expect(plan.status).toBe('PASS')
    expect(plan.seqScans).toBe(0)
    expect(plan.executionTime).toBeLessThan(200)
    console.log(`✓ Trends query: ${plan.executionTime.toFixed(2)}ms`)
  })

  // ============================================================================
  // Query Plan Summary & Baseline Capture
  // ============================================================================
  it('should generate baseline performance documentation', async () => {
    // Verify all queries passed
    const failedPlans = queryPlans.filter((p) => p.status === 'FAIL')
    expect(failedPlans).toHaveLength(0)

    // Generate markdown documentation
    const baselineDoc = generateBaselineDocumentation(queryPlans)

    // Save to docs folder
    const docsPath = path.join(
      __dirname,
      '../../../..',
      'docs',
      'mmc-dashboard-query-plans.md'
    )

    // Create docs directory if it doesn't exist
    const docsDir = path.dirname(docsPath)
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true })
    }

    fs.writeFileSync(docsPath, baselineDoc)

    console.log(`\n✓ Query plan baseline documentation saved to: ${docsPath}`)
    console.log(`\n📊 Query Plan Summary:`)
    console.log(`   Total Queries: ${queryPlans.length}`)
    console.log(
      `   Passed: ${queryPlans.filter((p) => p.status === 'PASS').length}`
    )
    console.log(`   Failed: ${failedPlans.length}`)
    console.log(
      `   Average Execution Time: ${(
        queryPlans.reduce((sum, p) => sum + p.executionTime, 0) /
        queryPlans.length
      ).toFixed(2)}ms`
    )
  })
})

/**
 * Generate baseline documentation in markdown format
 */
function generateBaselineDocumentation(plans: QueryPlan[]): string {
  const now = new Date().toISOString()
  const totalExecTime = plans.reduce((sum, p) => sum + p.executionTime, 0)
  const avgExecTime = totalExecTime / plans.length

  let doc = `# MMC Dashboard Query Plan Baseline

**Generated**: ${now}  
**Total Queries**: ${plans.length}  
**Total Execution Time**: ${totalExecTime.toFixed(2)}ms  
**Average Execution Time**: ${avgExecTime.toFixed(2)}ms  
**Performance Target**: <300ms per endpoint  

## Summary

All ${plans.length} dashboard endpoint queries have been verified to use indexes effectively.
No sequential scans detected.

| Endpoint | Execution Time | Rows Returned | Seq Scans | Index Scans | Status |
|----------|----------------|---------------|-----------|------------|--------|
`

  for (const plan of plans) {
    const statusEmoji = plan.status === 'PASS' ? '✓' : '✗'
    doc += `| ${plan.endpoint} | ${plan.executionTime.toFixed(2)}ms | ${plan.rowsReturned} | ${plan.seqScans} | ${plan.indexScans} | ${statusEmoji} ${plan.status} |
`
  }

  doc += `\n## Detailed Query Plans\n`

  for (const plan of plans) {
    doc += `\n### ${plan.endpoint.toUpperCase()}\n\n`
    doc += `**Query**: \`\`\`sql\n${plan.query.trim()}\n\`\`\`\n\n`
    doc += `**Execution Plan**:\n\`\`\`\n${plan.planText}\n\`\`\`\n\n`
    doc += `**Metrics**:\n`
    doc += `- Execution Time: ${plan.executionTime.toFixed(2)}ms\n`
    doc += `- Planning Time: ${plan.planningTime.toFixed(2)}ms\n`
    doc += `- Rows Returned: ${plan.rowsReturned}\n`
    doc += `- Sequential Scans: ${plan.seqScans}\n`
    doc += `- Index Scans: ${plan.indexScans}\n`
    doc += `- Status: ${plan.status}\n`
    doc += `- Notes: ${plan.notes}\n`
  }

  doc += `\n## Performance SLA Compliance\n\n`
  doc += `✓ All endpoints <300ms: ${
    plans.every((p) => p.executionTime < 300) ? 'YES' : 'NO'
  }\n`
  doc += `✓ No sequential scans: ${
    plans.every((p) => p.seqScans === 0) ? 'YES' : 'NO'
  }\n`
  doc += `✓ Average <150ms: ${avgExecTime < 150 ? 'YES' : 'NO'}\n`

  doc += `\n## Index Strategy\n\n`
  doc += `Indexes created for MMC Dashboard:\n\n`
  doc += `- \`idx_licenses_status\`: License status aggregation\n`
  doc += `- \`idx_licenses_deleted_at\`: Soft deletion filtering\n`
  doc += `- \`idx_revenue_records_created_at\`: Time-range queries\n`
  doc += `- \`idx_revenue_records_product_created\`: Product + time composite\n`
  doc += `- \`idx_revenue_records_billing_country\`: Geographic grouping\n`
  doc += `- \`idx_affiliate_usages_affiliate_created\`: Affiliate + time composite\n`
  doc += `- \`idx_affiliates_status\`: Affiliate status filtering\n`

  doc += `\n---\n`
  doc += `*This baseline was generated as part of Task T029 (Query Plan Verification).*\n`
  doc += `*Use this as regression test baseline for future deployments.*\n`

  return doc
}
