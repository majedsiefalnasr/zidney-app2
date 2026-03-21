/**
 * @script dev:seed:dashboard-test-data
 * @domain dev
 * @category runtime
 * @description Seed realistic MMC dashboard test data into master_db for dashboard testing
 * @mode manual
 * @usage bun run dev:seed:dashboard-test-data
 * @dependencies pg,packages/config,node:crypto
 *
 * Merge Header: Canonical content absorbed from:
 *   - scripts/seed-dashboard-test-data.ts (root-level duplicate, Task T005)
 *   - scripts/dev/seed-dashboard-test-data.ts (dev/ location, Task T038 move note)
 * Decision: scripts/dev/ version was the intentional canonical destination per T038 task comment.
 * Forward-only canonical path: scripts/seed/dashboard-test-data.ts
 *
 * Purpose: Generate realistic test data in master_db for dashboard testing
 * - 1000 test licenses across 3 statuses (ACTIVE, SOFT_LOCKED, ARCHIVED)
 * - 100 revenue records with diverse products and countries
 * - 20 affiliates with 200 usage records
 *
 * Environmental Requirements:
 * - DATABASE_URL must point to master_db (test environment)
 * - Script should NOT run in production (safety check included)
 * - Idempotent: safe to re-run (checks for existing data first)
 *
 * Constitutional Compliance:
 * ✓ Master DB only (zero tenant DB access)
 * ✓ Forward-only data (no deletes of existing production data)
 * ✓ Structured logging via createLogger (FR-05 compliant)
 * ✓ Monetary values in cents (integers)
 *
 * Usage:
 * ```sh
 * bun run dev:seed:dashboard-test-data
 * ```
 *
 * Execution Time: ~5-10 seconds for 1320 records
 */

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createLogger } from '../core/logger-factory'

// ============================================================================
// CONFIGURATION
// ============================================================================

const correlationId = randomUUID()
const logger = createLogger('seed:dashboard-test-data')
logger.setContext({ correlationId })

const ENVIRONMENT = process.env.NODE_ENV || 'development'
const DATABASE_URL = process.env.DATABASE_URL

// Safety check: prevent running in production
if (ENVIRONMENT === 'production') {
  logger.error('ABORT: seed-dashboard-test-data cannot run in production environment', {
    environment: ENVIRONMENT,
  })
  process.exit(1)
}

if (!DATABASE_URL) {
  logger.warn('Infrastructure dependency unavailable: DATABASE_URL not set', {
    service: 'seed:dashboard-test-data',
  })
  process.exit(0)
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
    logger.info('Starting dashboard test data seeding', { environment: ENVIRONMENT })

    // Check if test data already exists
    const existingLicenses = await client.query(
      'SELECT COUNT(*) FROM licenses WHERE workspace_slug LIKE $1',
      ['test-%']
    )

    if (existingLicenses.rows[0].count > 0) {
      logger.warn('Test data already exists', {
        count: existingLicenses.rows[0].count,
        hint: 'To re-seed, run: bun run dev:seed:dashboard-test-data (after clearing test data manually)',
      })
      return
    }

    // Phase 1: Seed products
    logger.info('Seeding products', { phase: '1/4' })
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
    logger.info('Products seeded', { count: PRODUCT_NAMES.length })

    // Phase 2: Seed licenses (1000 licenses across 3 statuses)
    logger.info('Seeding licenses', { phase: '2/4', target: 1000 })
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
        logger.info('License seeding progress', { seeded: i + 1, total: 1000 })
      }
    }
    logger.info('Licenses seeded', {
      count: licenseCount,
      distribution: {
        ACTIVE: licenseCount / 3,
        SOFT_LOCKED: licenseCount / 3,
        ARCHIVED: licenseCount / 3,
      },
    })

    // Phase 3: Seed revenue records (100 records)
    logger.info('Seeding revenue records', { phase: '3/4', target: 100 })

    const licenseResults = await client.query(
      'SELECT id, workspace_id, product_id FROM licenses WHERE deleted_at IS NULL LIMIT 100'
    )
    const sampleLicenses = licenseResults.rows

    for (let i = 0; i < 100; i++) {
      const license = sampleLicenses[i % sampleLicenses.length] || sampleLicenses[0]
      const product = PRODUCT_NAMES[i % PRODUCT_NAMES.length]
      const country = COUNTRIES[i % COUNTRIES.length]
      const amountCents = Math.floor(Math.random() * 500000) + 50000

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
          new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        ]
      )
    }
    logger.info('Revenue records seeded', { count: 100 })

    // Phase 4: Seed affiliates and affiliate usages (20 affiliates, 200 usages)
    logger.info('Seeding affiliates and usages', { phase: '4/4', affiliates: 20, usages: 200 })

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
          new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        ]
      )
    }
    logger.info('Affiliates and usages seeded', { affiliates: 20, usages: 200 })

    // Summary
    logger.info('SEEDING COMPLETE — Dashboard test data ready', {
      summary: {
        products: 3,
        licenses: 1000,
        licenseDistribution: 'ACTIVE/SOFT_LOCKED/ARCHIVED mix',
        revenueRecords: 100,
        countries: 10,
        affiliates: 20,
        affiliateUsages: 200,
      },
    })
  } catch (error) {
    logger.error('Seeding failed', {
      error: error instanceof Error ? error.message : String(error),
    })
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
    logger.info('Process complete')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('Fatal error', { error: error instanceof Error ? error.message : String(error) })
    process.exit(1)
  })
