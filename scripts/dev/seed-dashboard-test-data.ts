/**
 * MMC Dashboard Test Data Seeding Script
 *
 * Purpose: Generate realistic test data in master_db for dashboard testing
 * - 1000 test licenses across 3 statuses (ACTIVE, SOFT_LOCKED, ARCHIVED)
 * - 100 revenue records with diverse products and countries
 * - 20 affiliates with 200 usage records
 *
 * File: scripts/dev/seed-dashboard-test-data.ts
 * Task: T005 / T038 moved to scripts/dev/
 * Phase: 0 - Setup & Preparation
 *
 * Environmental Requirements:
 * - DATABASE_URL must point to master_db (test environment)
 * - Script should NOT run in production (safety check included)
 * - Idempotent: safe to re-run (checks for existing data first)
 *
 * Constitutional Compliance:
 * ✓ Master DB only (zero tenant DB access)
 * ✓ Forward-only data (no deletes of existing production data)
 * ✓ Structured logging with correlation_id
 * ✓ Monetary values in cents (integers)
 *
 * Usage:
 * ```sh
 * npx ts-node scripts/dev/seed-dashboard-test-data.ts
 * ```
 *
 * Execution Time: ~5-10 seconds for 1320 records
 */

import * as console from 'node:console'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CORRELATION_ID = randomUUID()
const ENVIRONMENT = process.env.NODE_ENV || 'development'
const DATABASE_URL = process.env.DATABASE_URL

// Safety check: prevent running in production
if (ENVIRONMENT === 'production') {
  console.error(`❌ ABORT: seed-dashboard-test-data cannot run in production environment`)
  process.exit(1)
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set')
  process.exit(1)
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Product {
  id: string
  name: string
  slug: string
}

interface _Affiliate {
  id: string
  name: string
  email: string
}

// ============================================================================
// SEED DATA GENERATORS
// ============================================================================

const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX']

const PRODUCT_NAMES: Product[] = [
  {
    id: randomUUID(),
    name: 'Zidney Pro',
    slug: 'zidney-pro',
  },
  {
    id: randomUUID(),
    name: 'Zidney Enterprise',
    slug: 'zidney-enterprise',
  },
  {
    id: randomUUID(),
    name: 'Zidney Essentials',
    slug: 'zidney-essentials',
  },
]

const AFFILIATE_NAMES = [
  'Partner Inc',
  'Tech Solutions LLC',
  'Digital Partners',
  'Education First',
  'Global Resellers',
  'Cloud Services Ltd',
  'Innovation Partners',
  'Strategic Growth Inc',
  'Educational Tech Partners',
  'Future Learning Group',
]

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

async function seedDashboardTestData(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL })
  const client = await pool.connect()

  try {
    console.log(`[${CORRELATION_ID}] Starting dashboard test data seeding... (ENV: ${ENVIRONMENT})`)

    // Check if test data already exists
    const existingLicenses = await client.query(
      'SELECT COUNT(*) FROM licenses WHERE workspace_slug LIKE $1',
      ['test-%']
    )

    if (existingLicenses.rows[0].count > 0) {
      console.log(
        `[${CORRELATION_ID}] ⚠️ Test data already exists (${existingLicenses.rows[0].count} licenses found)`
      )
      console.log(
        `[${CORRELATION_ID}] To re-seed, run: npm run seed:clean && npm run seed:dashboard`
      )
      return
    }

    // Phase 1: Seed products
    console.log(`[${CORRELATION_ID}] [1/4] Seeding products...`)
    for (const product of PRODUCT_NAMES) {
      await client.query(
        `INSERT INTO products (id, name, slug, description, enabled_modules)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          product.id,
          JSON.stringify({
            en: product.name,
            ar: `منتج ${product.name}`,
          }),
          product.slug,
          `Test product: ${product.name}`,
          JSON.stringify({}),
        ]
      )
    }
    console.log(`[${CORRELATION_ID}] ✓ Seeded ${PRODUCT_NAMES.length} products`)

    // Phase 2: Seed licenses (1000 licenses across 3 statuses)
    console.log(`[${CORRELATION_ID}] [2/4] Seeding 1000 licenses...`)
    const licenseStatuses = ['ACTIVE', 'SOFT_LOCKED', 'ARCHIVED']
    let licenseCount = 0

    for (let i = 0; i < 1000; i++) {
      const status = licenseStatuses[i % 3]
      const product = PRODUCT_NAMES[i % PRODUCT_NAMES.length]
      const workspaceSlug = `test-ws-${i}`
      const workspaceId = randomUUID()

      let softLockUntil = null
      let archivedAt = null

      if (status === 'SOFT_LOCKED') {
        softLockUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      } else if (status === 'ARCHIVED') {
        archivedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      }

      await client.query(
        `INSERT INTO licenses (id, product_id, workspace_slug, workspace_id, status, student_limit, staff_limit, soft_lock_until, archived_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          randomUUID(),
          product.id,
          workspaceSlug,
          workspaceId,
          status,
          Math.floor(Math.random() * 500) + 50,
          Math.floor(Math.random() * 50) + 10,
          softLockUntil,
          archivedAt,
          new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        ]
      )
      licenseCount++

      if ((i + 1) % 200 === 0) {
        console.log(`[${CORRELATION_ID}]   ~ Seeded ${i + 1} licenses so far...`)
      }
    }
    console.log(
      `[${CORRELATION_ID}] ✓ Seeded ${licenseCount} licenses (ACTIVE:${licenseCount / 3}, SOFT_LOCKED:${licenseCount / 3}, ARCHIVED:${licenseCount / 3})`
    )

    // Phase 3: Seed revenue records (100 records)
    console.log(`[${CORRELATION_ID}] [3/4] Seeding 100 revenue records...`)

    // First, get a sample of licenses to create revenue against
    const licenseResults = await client.query(
      'SELECT id, workspace_id, product_id FROM licenses WHERE deleted_at IS NULL LIMIT 100'
    )
    const sampleLicenses = licenseResults.rows

    for (let i = 0; i < 100; i++) {
      const license = sampleLicenses[i % sampleLicenses.length] || sampleLicenses[0]
      const product = PRODUCT_NAMES[i % PRODUCT_NAMES.length]
      const country = COUNTRIES[i % COUNTRIES.length]
      const amountCents = Math.floor(Math.random() * 500000) + 50000 // $500 to $5500

      await client.query(
        `INSERT INTO revenue_records (id, license_id, product_id, workspace_id, amount_cents, currency, billing_country, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          license.id,
          product.id,
          license.workspace_id,
          amountCents,
          'USD',
          country,
          new Date(
            Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000 // Last 90 days
          ),
        ]
      )
    }
    console.log(`[${CORRELATION_ID}] ✓ Seeded 100 revenue records`)

    // Phase 4: Seed affiliates and affiliate usages (20 affiliates, 200 usages)
    console.log(`[${CORRELATION_ID}] [4/4] Seeding 20 affiliates with 200 usages...`)

    const affiliateIds: string[] = []

    for (let i = 0; i < 20; i++) {
      const affiliateId = randomUUID()
      affiliateIds.push(affiliateId)

      const affiliateName =
        AFFILIATE_NAMES[i % AFFILIATE_NAMES.length] + (i > 9 ? ` #${Math.floor(i / 10)}` : '')

      await client.query(
        `INSERT INTO affiliates (id, name, email, status, commission_rate, total_commission_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          affiliateId,
          affiliateName,
          `partner-${i}@example.com`,
          i % 5 === 0 ? 'INACTIVE' : 'ACTIVE',
          0.15,
          Math.floor(Math.random() * 500000) + 50000,
        ]
      )
    }

    // Create affiliate usages
    for (let i = 0; i < 200; i++) {
      const affiliate = affiliateIds[i % affiliateIds.length]
      const license = sampleLicenses[i % sampleLicenses.length]
      const amountCents = Math.floor(Math.random() * 100000) + 10000

      await client.query(
        `INSERT INTO affiliate_usages (id, affiliate_id, license_id, product_id, usage_type, amount_cents, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          affiliate,
          license.id,
          license.product_id,
          'REFERRAL',
          amountCents,
          new Date(
            Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000 // Last 90 days
          ),
        ]
      )
    }
    console.log(`[${CORRELATION_ID}] ✓ Seeded 20 affiliates with 200 usage records`)

    // Summary
    console.log(`[${CORRELATION_ID}] `)
    console.log(`[${CORRELATION_ID}] ✅ SEEDING COMPLETE - Dashboard test data ready!`)
    console.log(`[${CORRELATION_ID}] `)
    console.log(`[${CORRELATION_ID}] Test Data Summary:`)
    console.log(`[${CORRELATION_ID}]   • 3 Products`)
    console.log(`[${CORRELATION_ID}]   • 1000 Licenses (ACTIVE/SOFT_LOCKED/ARCHIVED mix)`)
    console.log(`[${CORRELATION_ID}]   • 100 Revenue Records (across 10 countries)`)
    console.log(`[${CORRELATION_ID}]   • 20 Affiliates with 200 Usage Records`)
    console.log(`[${CORRELATION_ID}] `)
    console.log(`[${CORRELATION_ID}] Dashboard API is now ready for testing with realistic data.`)
    console.log(`[${CORRELATION_ID}] Run: npm run dev:api`)
  } catch (error) {
    console.error(
      `[${CORRELATION_ID}] ❌ Seeding failed:`,
      error instanceof Error ? error.message : error
    )
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

seedDashboardTestData()
  .then(() => {
    console.log(`[${CORRELATION_ID}] Process complete.`)
    process.exit(0)
  })
  .catch((error) => {
    console.error(`[${CORRELATION_ID}] Fatal error:`, error)
    process.exit(1)
  })
