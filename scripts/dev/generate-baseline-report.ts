#!/usr/bin/env bun

/**
 * generate-baseline-report.ts
 *
 * Generates comprehensive baseline report consolidating all Phase 1 diagnostics.
 * Creates BASELINE_REPORT.md in docs/audit-reports/ for Phase 1 completion.
 *
 * Usage: bun scripts/dev/generate-baseline-report.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  AIContextAnalyzer,
  DirectorySizeAnalyzer,
  FileSizeAnalyzer,
  ScriptPerformanceProfiler,
} from '../../tests/audit-helpers'
import { flushAi, log } from '../utils/logger'

const rootDir = process.cwd()
const reportDir = path.join(rootDir, 'docs/audit-reports')
const contextDir = path.join(rootDir, 'docs/ai/context')

log.header('GENERATE BASELINE REPORT', 'Generates Phase 1 baseline diagnostic report')

log.step('Analyzing file sizes...')
const fileSizes = FileSizeAnalyzer.findOversizedFiles(rootDir, 2000, 1_000_000)

log.step('Measuring directory sizes...')
const dirSizes = DirectorySizeAnalyzer.analyzeKeyDirectories(rootDir)

log.step('Analyzing AI context artifacts...')
const aiArtifacts = AIContextAnalyzer.analyzeArtifactDirectory(contextDir)

log.step('Profiling script performance...')
const scripts = [
  'scripts/ai-guard.ts',
  'scripts/infra-audit.ts',
  'scripts/type-safety-guard.ts',
  'scripts/architecture-diff.ts',
  'scripts/governance/validate-architecture-brain.ts',
]
const scriptProfiles = ScriptPerformanceProfiler.profileMultipleScripts(scripts, 3)

// Generate report
const timestamp = new Date().toISOString()

const report = `# Phase 1 Baseline Report — Repository Diagnostics

**Generated:** ${timestamp}  
**Repository State:** $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')  
**Phase:** 01 — Repository Diagnostics & Baseline  
**Status:** ✅ Complete

---

## Executive Summary

Phase 1 establishes comprehensive baseline measurements across 8 optimization areas. These metrics serve as the before-state for measuring Phase 2-5 improvements.

### Key Findings

| Category | Metric | Current | Target | Gap |
| --- | --- | --- | --- | --- |
| **File Sizes** | Oversized files (>2000 lines) | ${fileSizes.length} | 0 | ⚠️ ${fileSizes.length} to reduce |
| **Directory Sizes** | Total repo (excl. node_modules) | ~${Math.round(dirSizes.reduce((s, d) => s + d.sizeBytes, 0) / (1024 * 1024))}MB | <150MB | — |
| **AI Context** | Total artifact size | ${Math.round(aiArtifacts.reduce((s, a) => s + a.sizeBytes, 0) / 1024)}KB | <10MB | ⚠️ $(Math.round(aiArtifacts.reduce((s, a) => s + a.sizeBytes, 0) / (1024 * 1024)))MB |
| **Script Performance** | ai-guard P95 | ${scriptProfiles[0]?.p95TimeMs.toFixed(0)}ms | <1000ms | $(${scriptProfiles[0]?.p95TimeMs || 0} > 1000 ? '🔴 FAIL' : '✓ PASS') |
| **Script Performance** | infra-audit P95 | ${scriptProfiles[1]?.p95TimeMs.toFixed(0)}ms | <3000ms | $(${scriptProfiles[1]?.p95TimeMs || 0} > 3000 ? '🔴 FAIL' : '✓ PASS') |

---

## 1. File Size Analysis

### Oversized Files (>2000 lines)

**Count:** ${fileSizes.filter((f) => f.status === 'oversized').length} files  
**Total Size:** ${Math.round(fileSizes.filter((f) => f.status === 'oversized').reduce((s, f) => s + f.sizeBytes, 0) / 1024)}KB

Top offenders:
${fileSizes
  .filter((f) => f.status === 'oversized')
  .slice(0, 5)
  .map(
    (f) =>
      `  • \`${path.relative(rootDir, f.filePath)}\` — ${f.lineCount} lines (${Math.round(f.sizeBytes / 1024)}KB)`
  )
  .join('\n')}

### Large Files (>1MB)

**Count:** ${fileSizes.filter((f) => f.status === 'large').length} files  
**Total Size:** ${Math.round(fileSizes.filter((f) => f.status === 'large').reduce((s, f) => s + f.sizeBytes, 0) / (1024 * 1024))}MB

---

## 2. Directory Size Analysis

### Repository Structure

${dirSizes.map((d) => `  • \`${d.dirPath}\` — ${d.scaledSize} (${d.fileCount} files)`).join('\n')}

**Total (excl. node_modules):** ~${Math.round(
  dirSizes.filter((d) => !d.dirPath.includes('node_modules')).reduce((s, d) => s + d.sizeBytes, 0) /
    (1024 * 1024)
)}MB

### Largest Contributors

${dirSizes
  .slice(0, 5)
  .map((d) => `  • ${d.dirPath}: ${d.scaledSize}`)
  .join('\n')}

---

## 3. AI Context Artifact Analysis

### Artifact Sizes

${aiArtifacts
  .sort((a, b) => b.sizeBytes - a.sizeBytes)
  .map(
    (a) =>
      `  • ${a.artifactName}: ${Math.round(a.sizeBytes / 1024)}KB (compressed: ${Math.round(a.compressedSizeBytes / 1024)}KB, ratio: ${a.compressionRatio.toFixed(1)}:1)`
  )
  .join('\n')}

**Total size:** ${Math.round(aiArtifacts.reduce((s, a) => s + a.sizeBytes, 0) / 1024)}KB  
**Total compressed:** ${Math.round(aiArtifacts.reduce((s, a) => s + a.compressedSizeBytes, 0) / 1024)}KB

### Phase 3 Optimization Targets

- Reduce uncompressed total to <10MB
- Achieve <2s generation time (cold run)
- Achieve <500ms generation time (warm/cached run)
- Maintain mini-context <50KB (bootstrap critical)

---

## 4. Script Performance Analysis

### Governance Script Baseline

${scriptProfiles
  .map(
    (s) =>
      `  • **${s.scriptName}**\n    - Runs: ${s.executionTimeMs.length}\n    - Min: ${s.minTimeMs.toFixed(0)}ms, Max: ${s.maxTimeMs.toFixed(0)}ms\n    - Avg: ${s.avgTimeMs.toFixed(0)}ms, P95: ${s.p95TimeMs.toFixed(0)}ms`
  )
  .join('\n')}

### Performance Targets (Phase 2)

- \`ai-guard.ts\`: Current ${scriptProfiles.find((s) => s.scriptName === 'ai-guard.ts')?.p95TimeMs.toFixed(0)}ms → Target <1000ms
- \`infra-audit.ts\`: Current ${scriptProfiles.find((s) => s.scriptName === 'infra-audit.ts')?.p95TimeMs.toFixed(0)}ms → Target <3000ms
- \`type-safety-guard.ts\`: Current ${scriptProfiles.find((s) => s.scriptName === 'type-safety-guard.ts')?.p95TimeMs.toFixed(0)}ms → Target <1000ms
- \`architecture-diff.ts\`: Current ${scriptProfiles.find((s) => s.scriptName === 'architecture-diff.ts')?.p95TimeMs.toFixed(0)}ms → Target <2000ms

---

## Phase 1 Completion Checklist

- [x] T001: Created audits/ directory structure with audit-helpers utility
- [x] T002: Created FILE_SIZE_ANALYSIS.md template
- [x] T003: Created DIRECTORY_SIZE_ANALYSIS.md template
- [x] T004: Created AI_CONTEXT_ARTIFACT_ANALYSIS.md template
- [x] T005: Created SCRIPT_PERFORMANCE_PROFILE.md template
- [x] T006: Generated file size analysis script
- [x] T007: Generated directory size measurement script
- [x] T008: Generated AI context artifact analysis script
- [x] T009: Generated script performance profiler
- [x] T010: Generated baseline report generator (this report)

---

## Next Steps: Phase 2

With Phase 1 baseline established, Phase 2 focuses on:

1. **Script Modularization (T011-T025)**
   - Extract repeated utilities (schema-validator, file-analyzer, graph-analyzer, performance-profiler)
   - Move governance scripts to scripts/architecture/, scripts/ai-context/, scripts/governance/
   - Move development scripts to scripts/dev/
   - Move CI scripts to scripts/ci/
   - Move build scripts to scripts/build/

2. **Architecture Tools Refactoring (T019-T024)**
   - Refactor ai-guard.ts, infra-audit.ts, architecture-diff.ts
   - Target <1s, <3s, <2s respectively

3. **Expected Phase 2 Outcomes:**
   - Script execution times reduced by 15-30%
   - Code duplication <5%
   - Repository better organized by function

---

## Baseline Metrics for Tracking

Save these for comparison after each phase:

\`\`\`json
{
  "phase": 1,
  "timestamp": "${timestamp}",
  "filesOversized": ${fileSizes.filter((f) => f.status === 'oversized').length},
  "filesLarge": ${fileSizes.filter((f) => f.status === 'large').length},
  "repositorySize": ${Math.round(dirSizes.reduce((s, d) => s + d.sizeBytes, 0) / (1024 * 1024))},
  "aiArtifactSize": ${Math.round(aiArtifacts.reduce((s, a) => s + a.sizeBytes, 0) / 1024)},
  "scriptPerformance": {
    "aiGuard_p95Ms": ${scriptProfiles.find((s) => s.scriptName === 'ai-guard.ts')?.p95TimeMs.toFixed(0)},
    "infraAudit_p95Ms": ${scriptProfiles.find((s) => s.scriptName === 'infra-audit.ts')?.p95TimeMs.toFixed(0)},
    "typeSafetyGuard_p95Ms": ${scriptProfiles.find((s) => s.scriptName === 'type-safety-guard.ts')?.p95TimeMs.toFixed(0)},
    "architectureDiff_p95Ms": ${scriptProfiles.find((s) => s.scriptName === 'architecture-diff.ts')?.p95TimeMs.toFixed(0)}
  }
}
\`\`\`

---

## Phase 1 Status

✅ **COMPLETE** — All diagnostics collected and analyzed. Ready to proceed to Phase 2.
`

// Write report
const reportPath = path.join(reportDir, 'BASELINE_REPORT.md')
fs.writeFileSync(reportPath, report)

log.success(`Baseline report generated: ${reportPath}`)

log.step('Phase 1 Complete Summary:')
log.info(`  Files oversized: ${fileSizes.length}`)
log.info(`  Directory count analyzed: ${dirSizes.length}`)
log.info(`  Artifact count: ${aiArtifacts.length}`)
log.info(`  Scripts profiled: ${scriptProfiles.length}`)
log.info(`  Report location: docs/audit-reports/BASELINE_REPORT.md`)
log.result({
  total: fileSizes.length + aiArtifacts.length,
  passed: 0,
  failed: 0,
  message: 'Baseline captured',
})
flushAi()
