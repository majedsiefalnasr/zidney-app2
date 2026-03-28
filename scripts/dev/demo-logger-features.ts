#!/usr/bin/env bun

/**
 * @script dev:demo-logger-features
 * @domain dev
 * @category development
 * @description Demonstrates all available logger customization options and features
 * @usage bun run dev:demo-logger-features
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createLogger, exit, log } from '../utils/logger'

const CACHE_PATH = resolve(process.cwd(), '.cache/logger-demo.json')

function loadPrevious() {
  if (!existsSync(CACHE_PATH)) return null
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function saveCurrent(data: unknown) {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2))
  } catch {}
}

const logger = createLogger('demo-logger-features')

async function main(): Promise<void> {
  const isBenchmark = process.argv.includes('--benchmark')
  const isCiSim = process.argv.includes('--ci-sim')
  log.header(
    'Logger Features Demo',
    'Comprehensive guide to all available logger customization options'
  )

  if (isCiSim) {
    process.env.GITHUB_ACTIONS = 'true'
    log.badge('CI SIMULATION MODE ENABLED', 'warning')
  }

  log.section('Usage Modes')
  log.line([
    { content: '--json', color: 'cyan' },
    { content: '→ machine readable output', color: 'dim' },
  ])
  log.line([
    { content: '--pretty', color: 'cyan' },
    { content: '→ formatted JSON output', color: 'dim' },
  ])
  log.line([
    { content: '--compact', color: 'cyan' },
    { content: '→ minimal output mode', color: 'dim' },
  ])

  log.section('Export Modes Example')
  log.line([{ content: 'bun run repo:script --json', color: 'cyan' }])
  log.line([{ content: 'bun run repo:script --json --pretty', color: 'cyan' }])

  // Demo 1: Single badges (basic)
  log.section('Demo 1: Single Badges (All Color Types)')
  log.badge('All Systems OK', 'success')
  log.badge('Warning Detected', 'warning')
  log.badge('Error Occurred', 'error')
  log.badge('Information', 'info')
  log.badge('Directory', 'gray')

  // Demo 2: Multiple badges on same line
  log.section('Demo 2: Multiple Badges (Same Line with Different Colors)')
  log.badges([
    { text: 'PASSED', type: 'success' },
    { text: 'DIR', type: 'gray' },
    { text: '125ms', type: 'info' },
  ])
  log.badges([
    { text: 'CONFIG', type: 'gray' },
    { text: 'VALID', type: 'success' },
    { text: 'OPTIMIZED', type: 'success' },
  ])
  log.badges([
    { text: 'FILE', type: 'gray' },
    { text: '45KB', type: 'warning' },
    { text: 'CHECK', type: 'error' },
  ])

  // Demo 3: Statistics display
  log.section('Demo 3: Statistics Display')
  log.stat('Total Tests', '453', 'cyan')
  log.stat('Passed', '441', 'green')
  log.stat('Failed', '8', 'red')
  log.stat('Duration', '12.4s', 'yellow')
  log.stat('Coverage', '94.2%', 'magenta')

  // Demo 4: Code snippets
  log.section('Demo 4: Code Snippets Highlight')
  log.code('log.badges([{ text: "STATUS", type: "success" }])', 'typescript')
  log.code('SELECT * FROM attempts WHERE status = "submitted"', 'sql')

  // Demo 5: Colored messages
  log.section('Demo 5: Colored Messages')
  log.success('Operation completed successfully')
  log.warn('This is a warning message')
  log.error('This is an error message')
  log.info('This is an informational message')

  // Demo 6: Lists
  log.section('Demo 6: Formatted Lists')
  log.list(['Database migrated', 'Cache warmed', 'API health check passed', 'Worker jobs drained'])
  log.section('Demo 7: Indented Lists')
  log.list(['Monorepo structure', '  ├─ apps/', '  ├─ packages/', '  └─ scripts/'], 2)

  // Demo 8: Highlight text
  log.section('Demo 8: Text Highlighting')
  log.highlight('CRITICAL: Update required!', 'red', true)
  log.highlight('Note: This is important', 'dim', false)
  log.highlight('Success: All checks passed', 'green', true)

  // Demo 9: Tags
  log.section('Demo 9: Inline Tags')
  log.tags(['zidney', 'multi-tenant', 'b2b2c'], 'magenta')
  log.tags(['database', 'migration', 'production'], 'cyan')
  log.tags(['validation', 'schema', 'governance'], 'yellow')

  // Demo 10: Box display
  log.section('Demo 10: Boxed Messages')
  log.line([{ content: 'Box alignment examples:', color: 'dim' }])
  // Explicit alignment options
  log.box('Important (start)', 'Review deployment checklist before proceeding', { align: 'start' })
  log.box('Important (center)', 'Review deployment checklist before proceeding', {
    align: 'center',
  })
  log.box('Important (end)', 'Review deployment checklist before proceeding', { align: 'end' })
  // Env-driven alignment (LOG_BOX_ALIGN)
  process.env.LOG_BOX_ALIGN = 'center'
  log.line([{ content: 'Env-driven alignment example (LOG_BOX_ALIGN=center):', color: 'dim' }])
  log.box('Env Aligned', 'This box uses LOG_BOX_ALIGN=center')
  delete process.env.LOG_BOX_ALIGN
  // Traditional config box (left-aligned)
  log.box('Config', 'Environment: production, Region: us-east-1', { align: 'start' })

  // Demo 10A: Header & Result Alignment
  log.section('Demo 10A: Header & Result Alignment')
  log.header('Centered Header Example', 'Header aligned to center', { align: 'center' })
  log.header('End Aligned Header Example', 'Header aligned to end', { align: 'end' })

  log.section('Demo 10A: Result Alignment')
  const sampleSummary = { total: 10, passed: 8, failed: 2, message: '2 failures found' }
  log.result(sampleSummary, { align: 'start' })
  log.result(sampleSummary, { align: 'center' })
  log.result(sampleSummary, { align: 'end' })

  log.section('Demo 10C: Result Details')
  log.result(
    {
      total: 12,
      passed: 9,
      failed: 1,
      warnings: 2,
      status: 'warning',
      message: 'Extended summary metrics render inside the result block',
      details: {
        scannedFiles: 12,
        autoFixed: 3,
        dryRun: true,
        mode: 'staged',
      },
    },
    { align: 'center' }
  )

  // Demo 10B: Title-only Result (Simple)
  log.section('Demo 10B: Title-only Result (Simple)')
  log.line([
    { content: 'Use log.resultSimple(title, status) for title-only results', color: 'dim' },
  ])
  log.resultSimple('CONTEXT FRESH', 'success')
  log.resultSimple('CONTEXT STALE', 'error')

  // Demo 11: Progress bar
  log.section('Demo 11: Progress Bar (Extended - 5 seconds)')
  log.info('Processing 20 tasks with 250ms each...')
  log.progressStart(20)
  for (let i = 0; i < 20; i++) {
    log.progressTick()
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  log.progressEnd()
  log.success('All tasks completed')

  // Demo 11A: Text and bold inline
  log.section('Demo 11A: Inline Text and Bold Elements')
  log.line([
    { content: 'Status:', bold: true, color: 'white' },
    { content: 'RUNNING', color: 'green' },
  ])
  log.line([
    { content: 'Database:', bold: true, color: 'white' },
    { content: 'postgresql://prod-db', color: 'cyan' },
  ])
  log.line([
    { content: 'Workers Active:', bold: true, color: 'white' },
    { content: '42', color: 'yellow' },
  ])

  // Demo 11B: Number formatting on same line
  log.section('Demo 11B: Numbers on Same Line with Context')
  log.line([
    { content: 'Total:', bold: true, color: 'white' },
    { content: '1000', color: 'cyan' },
    { content: '│', color: 'dim' },
    { content: 'Passed:', bold: true, color: 'white' },
    { content: '950', color: 'green' },
    { content: '│', color: 'dim' },
    { content: 'Failed:', bold: true, color: 'white' },
    { content: '50', color: 'red' },
  ])
  log.line([
    { content: 'Response Time:', bold: true, color: 'white' },
    { content: '125ms', color: 'green' },
    { content: '(avg)', color: 'dim' },
  ])

  // Demo 11C: File/path display with colors
  log.section('Demo 11C: Path and File Display')
  log.line([
    { content: 'File:', bold: true, color: 'white' },
    { content: 'scripts/', color: 'blue' },
    { content: 'validate/', color: 'blue' },
    { content: 'ai-context-schemas.ts', color: 'yellow' },
  ])
  log.line([
    { content: 'Size:', bold: true, color: 'white' },
    { content: '12.4KB', color: 'cyan' },
    { content: '│', color: 'dim' },
    { content: 'Modified:', bold: true, color: 'white' },
    { content: '2 hours ago', color: 'dim' },
  ])

  // Demo 12: Tables with borders
  log.section('Demo 12: Tables with Borders')
  const testResults = [
    { test: 'Unit Tests', status: '✓ PASS', duration: '234ms' },
    { test: 'Integration Tests', status: '✓ PASS', duration: '567ms' },
    { test: 'E2E Tests', status: '⚠ WARN', duration: '1203ms' },
    { test: 'Performance Tests', status: '✖ FAIL', duration: '5000ms' },
  ]
  log.table(testResults, { title: 'Test Results (With Borders)', colors: true })

  // Demo 13: Borderless tables (aligned spaces only)
  log.section('Demo 13: Borderless Tables (Aligned Spaces)')
  const packageStatus = [
    { package: 'api-client', version: 'v1.2.3', status: '✓ OK', size: '45KB' },
    { package: 'domain-core', version: 'v2.0.1', status: '✓ OK', size: '128KB' },
    { package: 'ui-system', version: 'v1.5.0', status: '✓ OK', size: '256KB' },
    { package: 'logger', version: 'v1.0.0', status: '⚠ UPDATE', size: '12KB' },
  ]
  log.table(packageStatus, { title: 'Package Status', colors: true, borderless: true })

  // Demo 14: Deployment checklist
  log.section('Demo 14: Deployment Checklist')
  const deploymentChecks = [
    { step: 'Database migration', status: '✓ PASS' },
    { step: 'Cache warmed', status: '✓ PASS' },
    { step: 'API health check', status: '✓ PASS' },
    { step: 'Worker jobs drained', status: '✓ PASS' },
    { step: 'Smoke tests', status: '✓ PASS' },
  ]
  log.table(deploymentChecks, { title: 'Pre-deployment Checklist', colors: true, borderless: true })

  // Demo 15: Result summary with colors
  log.section('Demo 15: Result Summary')
  log.result({
    total: 100,
    passed: 85,
    failed: 5,
    message: '85 tests passed, 5 failed, 10 skipped',
    details: {
      skipped: 10,
      flaky: 2,
    },
  })

  log.section('Demo 15A: Trend Comparison')
  log.trend(5, 8, 'Failures')
  log.trend(85, 80, 'Passed')

  log.section('Demo 15B: Persistent Trend (Real Previous Run)')
  const prevData = loadPrevious()
  const currData = { passed: 85, failed: 5 }

  if (prevData) {
    log.trend(currData.failed, prevData.failed, 'Failures')
    log.trend(currData.passed, prevData.passed, 'Passed')
  } else {
    log.empty('No previous run data found (first run)')
  }

  saveCurrent(currData)

  // Demo 16: Mixed results (warning case)
  log.section('Demo 16: Mixed Results (With Warnings)')
  log.badge('VALIDATION COMPLETE WITH WARNINGS', 'warning')
  log.result({
    total: 50,
    passed: 45,
    failed: 2,
    warnings: 3,
    status: 'warning',
    message: '45 items valid, 2 errors, 3 warnings',
    details: {
      retried: 4,
      mode: 'ci',
    },
  })

  log.section('Demo 16A: CI Annotations')

  if (isCiSim) {
    log.error('Simulated CI error (should appear as annotation)')
    log.warn('Simulated CI warning (slow execution)')
  } else {
    log.empty('Run with --ci-sim to enable GitHub Actions annotations')
  }

  // Demo 17: Spinner
  log.section('Demo 17: Spinner Animation (4 seconds)')
  log.spin('Processing data...')
  await new Promise((resolve) => setTimeout(resolve, 4000))
  log.stopSpin('✓ Done!')

  // Demo 18: Audit reports
  log.section('Demo 18: Audit Report (Borderless)')
  const auditResults = [
    { component: 'Module A', tests: '125', coverage: '94%', result: '✓ PASS' },
    { component: 'Module B', tests: '89', coverage: '87%', result: '⚠ WARN' },
    { component: 'Module C', tests: '156', coverage: '98%', result: '✓ PASS' },
    { component: 'Module D', tests: '42', coverage: '76%', result: '✖ FAIL' },
  ]
  log.table(auditResults, { title: 'Code Quality Audit', colors: true, borderless: true })

  // Demo 19: Extended spinner with longer animation
  log.section('Demo 19: Spinner - Database Migration (6 seconds)')
  log.spin('Running database migrations...')
  await new Promise((resolve) => setTimeout(resolve, 6000))
  log.stopSpin('✓ Migrations complete!')

  // Demo 20: Multi-stage progress (slow)
  log.section('Demo 20: Multi-stage Progress (10 seconds)')
  log.info('Stage 1: Compiling assets...')
  log.progressStart(15)
  for (let i = 0; i < 15; i++) {
    log.progressTick()
    await new Promise((resolve) => setTimeout(resolve, 300)) // 4.5 seconds total
  }
  log.progressEnd()
  log.success('Assets compiled')

  log.info('Stage 2: Bundling code...')
  log.progressStart(10)
  for (let i = 0; i < 10; i++) {
    log.progressTick()
    await new Promise((resolve) => setTimeout(resolve, 400)) // 4 seconds total
  }
  log.progressEnd()
  log.success('Code bundled')

  // Demo 13: Rapid progress (fast updates)
  log.section('Demo 21: Rapid Progress (100 items, fast)')
  log.progressStart(100)
  for (let i = 0; i < 100; i++) {
    log.progressTick()
    await new Promise((resolve) => setTimeout(resolve, 20)) // Quick updates
  }
  log.progressEnd()
  log.success('100 items processed')

  // Demo 14: Spinner with different durations
  log.section('Demo 22: Spinner - Testing (3 seconds)')
  log.spin('Running test suite...')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  log.stopSpin('✓ Tests passed!')

  // Demo 23.5: Colored Progress Result - Test Results
  log.section('Demo 23.5: Progress Result - Test Summary')
  log.progressResult(
    { success: 145, error: 8, warning: 12 },
    { title: 'Unit Test Results', showPercentage: true }
  )

  // Demo 23.6: Colored Progress Result - Build Status
  log.section('Demo 23.6: Progress Result - Build Status')
  log.progressResult(
    { success: 1250, warning: 45, error: 5 },
    { title: 'Build Quality Metrics', showPercentage: true }
  )

  // Demo 23.7: Colored Progress Result - Deployment
  log.section('Demo 23.7: Progress Result - Deployment Checks')
  log.progressResult(
    { success: 38, info: 2 },
    { title: 'Pre-deployment Validation', showPercentage: true }
  )

  // Demo 15: Advanced badge combinations
  log.section('Demo 23: Advanced Badge Combinations')
  log.badges([
    { text: 'ENV', type: 'gray' },
    { text: 'production', type: 'info' },
    { text: 'REGION', type: 'gray' },
    { text: 'us-east-1', type: 'info' },
  ])
  log.badges([
    { text: 'BUILD', type: 'gray' },
    { text: '#5427', type: 'info' },
    { text: 'TIME', type: 'gray' },
    { text: '12.4s', type: 'success' },
  ])

  // Demo 16: Final performance summary
  log.section('Demo 24: Performance Summary with Badges')
  log.badges([
    { text: 'TOTAL', type: 'gray' },
    { text: '6/6', type: 'success' },
  ])
  const perfResults = [
    { operation: 'Database migrations', time: '6.0s', status: '✓ OK' },
    { operation: 'Asset compilation', time: '4.5s', status: '✓ OK' },
    { operation: 'Code bundling', time: '4.0s', status: '✓ OK' },
    { operation: 'Item processing', time: '2.0s', status: '✓ OK' },
    { operation: 'Test suite', time: '3.0s', status: '✓ OK' },
  ]
  log.table(perfResults, { title: 'Operation Times', colors: true, borderless: true })

  log.section('Demo 24A: Benchmark Comparison')
  const prevTime = 4500
  const currentTime = isBenchmark ? Math.floor(Math.random() * 6000) : 5042
  log.trend(currentTime, prevTime, 'Execution Time (ms)')

  log.result({
    total: 5,
    passed: 5,
    failed: 0,
    message: 'All demo tests completed successfully',
  })

  // Demo 25: Advanced line composition - real-world scenarios
  log.divider()
  log.section('Demo 25: Real-World Scenarios with Line Composition')

  log.line([
    { content: '▸', color: 'cyan' },
    { content: 'DATABASE', bold: true, color: 'gray' },
    { content: 'migration_20260326', color: 'yellow' },
    { content: '[✓]', color: 'green', bold: true },
  ])

  log.line([
    { content: '▸', color: 'cyan' },
    { content: 'TESTS', bold: true, color: 'gray' },
    { content: 'unit + integration', color: 'white' },
    { content: '[✓]', color: 'green', bold: true },
  ])

  log.line([
    { content: '▸', color: 'cyan' },
    { content: 'BUILD', bold: true, color: 'gray' },
    { content: 'bundle optim', color: 'white' },
    { content: '[✓]', color: 'green', bold: true },
  ])

  // Demo 26: Build/deployment-style output
  log.section('Demo 26: Deployment Status')
  log.line([{ content: '┌─ Deployment #5427', bold: true, color: 'blue' }])
  log.line([
    { content: '├─ Branch:', bold: true, color: 'white' },
    { content: 'main', color: 'cyan' },
  ])
  log.line([
    { content: '├─ Status:', bold: true, color: 'white' },
    { content: 'IN_PROGRESS', color: 'yellow', bold: true },
    { content: '(', color: 'dim' },
    { content: '45s', color: 'cyan' },
    { content: ')', color: 'dim' },
  ])
  log.line([
    { content: '└─ Trigger:', bold: true, color: 'white' },
    { content: 'github-webhook', color: 'green' },
  ])

  // Demo 27: Mixed data types on one line
  log.section('Demo 27: Mixed Data Types (Text, Numbers, Symbols)')
  log.line([
    { content: '◆', color: 'cyan' },
    { content: 'Requests', bold: true, color: 'white' },
    { content: '→', color: 'dim' },
    { content: '15,234', color: 'green' },
    { content: '│', color: 'dim' },
    { content: 'Errors', bold: true, color: 'white' },
    { content: '→', color: 'dim' },
    { content: '12', color: 'red' },
    { content: '│', color: 'dim' },
    { content: 'Avg', bold: true, color: 'white' },
    { content: '→', color: 'dim' },
    { content: '124ms', color: 'cyan' },
  ])

  // Demo 28: File system-like output
  log.section('Demo 28: File Navigation Output')
  log.line([
    { content: 'PWD:', bold: true, color: 'white' },
    { content: '/home/user', color: 'cyan' },
    { content: '→', color: 'dim' },
    { content: 'scripts', color: 'blue' },
    { content: '→', color: 'dim' },
    { content: 'utils', color: 'blue' },
    { content: '→', color: 'dim' },
    { content: 'logger.ts', color: 'yellow', bold: true },
  ])

  // Demo 29: Performance metrics
  log.section('Demo 29: Performance Metrics Summary')
  log.line([
    { content: '[PERF]', bold: true, color: 'magenta' },
    { content: 'Load:', bold: true, color: 'white' },
    { content: '245ms', color: 'green' },
    { content: '│', color: 'dim' },
    { content: 'Render:', bold: true, color: 'white' },
    { content: '89ms', color: 'green' },
    { content: '│', color: 'dim' },
    { content: 'Total:', bold: true, color: 'white' },
    { content: '334ms', color: 'cyan', bold: true },
  ])

  // Demo 30: Summary and features list
  log.divider()
  log.section('Demo 30: All Features Demonstrated')
  log.list([
    'Single badges with 5 color types (success, error, warning, info, gray)',
    'Multiple badges on same line with different colors',
    'Statistics display with colored values',
    'Code snippets with language syntax highlighting',
    'Formatted lists with optional indentation',
    'Text highlighting with colors and bold options',
    'Inline tags with color customization',
    'Boxed message display for emphasis',
    'Progress bars with customizable length',
    'Spinners with custom duration',
    'Colored tables with/without borders',
    'Result summaries with metrics and messaging',
    'Inline text/bold/number composition with log.line()',
    'Real-world scenarios (deployment, build, metrics)',
    'Colored progress results with multi-status visualization',
    'Complete AI mode compatibility',
  ])

  log.section('Demo 30A: Performance Threshold Warning')
  await new Promise((r) => setTimeout(r, 2200))
  log.result({
    total: 1,
    passed: 1,
    failed: 0,
    message: 'Simulated slow operation (threshold demo)',
  })

  log.section('Export Mode Demo')

  if (process.argv.includes('--json')) {
    log.success('JSON mode active')
    log.result({
      total: 2,
      passed: 2,
      failed: 0,
      message: 'JSON export working',
      details: {
        format: 'json',
      },
    })
  } else if (process.argv.includes('--pretty')) {
    log.success('Pretty JSON mode active')
    log.result({
      total: 2,
      passed: 2,
      failed: 0,
      message: 'Pretty export working',
      details: {
        format: 'pretty-json',
      },
    })
  } else {
    log.empty('Run with --json or --pretty to see structured output')
  }

  logger.info('Full comprehensive demo completed with all features')
  log.badge('ALL FEATURES DEMONSTRATED', 'success')
  log.result({
    total: 33,
    passed: 33,
    failed: 0,
    message: 'All logger customization options available and working',
  })

  exit(0)
}

main()
