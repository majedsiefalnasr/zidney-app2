/**
 * MMC Dashboard Domain Package - Export Index
 *
 * File: packages/domain-core/mmc-dashboard/index.ts
 * Task: T003
 * Phase: 0 - Setup & Preparation
 */

export * from './types'

// Re-export query builders
export * as affiliateQuery from './queries/affiliate-query'
export * as exportQuery from './queries/export-query'
export * as geographicQuery from './queries/geographic-query'
export * as revenueBreakdownQuery from './queries/revenue-breakdown-query'
export * as summaryQuery from './queries/summary-query'
export * as trendsQuery from './queries/trends-query'

// Re-export aggregators
export * as affiliateAggregator from './metrics/affiliate-aggregator'
export * as geographicAggregator from './metrics/geographic-aggregator'
export * as licenseAggregator from './metrics/license-aggregator'
export * as revenueAggregator from './metrics/revenue-aggregator'

// Namespace for organized imports
export const Dashboard = {
  Types: require('./types'),
}
