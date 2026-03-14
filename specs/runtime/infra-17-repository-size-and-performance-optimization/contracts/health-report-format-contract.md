# Architecture Health Report Format Contract

**Purpose:** Define the health report artifact format and generation contract  
**Phase:** 7 (Repository Health Monitoring)  
**Requirement:** Auto-generated health reports with consistent structure across all CI runs

---

## Health Report File Contract

```yaml
# Contract: Repository health report artifact

Report Identification:
  Filename: HEALTH_REPORT-{ISO8601-datetime}.md
  Location: docs/reports/health/
  Format: Markdown (.md)
  Symlink: docs/reports/health/HEALTH_REPORT.md → latest report

Report Metadata:
  GeneratedBy: scripts/dev/repository-health.ts
  GenerationTrigger: "After CI tests + architecture pass (main branch only)"
  GenerationFrequency: "Every push to main branch"
  Retention: "Last 30 days + archive older"

Determinism:
  Reproducibility: "Same source files → same metrics (±rounding tolerance)"
  Timestamp: "Included; reflects generation time"
  CommitSHA: "Included; identifies code being measured"
  Consistency: "All reports follow identical structure"
```

---

## Expected Report Structure

```markdown
# Repository Health Report — YYYY-MM-DD HH:MM:SSZ

**Report Details:**

- Generated: [timestamp]
- Commit: [commit-sha]
- Branch: [branch-name]
- Duration of Report Generation: Xs

## Executive Summary

- Overall health score: NN/100
- Change since last report: ±N points
- Critical issues: N
- Action items: N

## Metrics Summary Table

| Category        | Metric           | Value  | Target  | Status | Trend |
| --------------- | ---------------- | ------ | ------- | ------ | ----- |
| Repository Size | Total (excl. nm) | NNN MB | <150 MB | ✓/⚠️/✗ | ↑/→/↓ |
| AI Context      | Generation time  | Ns     | <2s     | ✓/⚠️/✗ | ↑/→/↓ |
| AI Context      | Artifact size    | NNN KB | <700 KB | ✓/⚠️/✗ | ↑/→/↓ |
| Scripts         | ai-guard.ts      | NNNms  | <1s     | ✓/⚠️/✗ | ↑/→/↓ |
| Scripts         | infra-audit.ts   | N.Ns   | <3s     | ✓/⚠️/✗ | ↑/→/↓ |
| ...             | ...              | ...    | ...     | ...    | ...   |

## Detailed Metrics

### Repository Size Breakdown
```

Total: NNN MB (Target: <150 MB) [Status]

Breakdown by directory:

- docs/ai/context/: NN MB [breakdown]
- docs/architecture/: NN MB [breakdown]
- scripts/: NN MB [breakdown]
- .agents/skills/: N MB [breakdown]
- coverage/: 0 MB (gitignored)
- ... other directories

```

### AI Context Artifact Analysis

```

Total artifact size: NNN KB (Target: <700 KB) [Status]

Individual artifacts:

- ai-context-mini.json: NN KB (Target: <50 KB) [✓]
- ai-module-map.json: NNN KB (Target: <200 KB) [✓]
- ai-dependency-graph.json: NNN KB (Target: <250 KB) [✓]
- ai-architecture-brain.json: NNN KB (Target: <400 KB) [✓]
- ai-runtime-dependents.json: NNN KB (Target: <200 KB) [✓]
- ai-layer-model.json: NN KB (Target: <100 KB) [✓]
- ai-runtime-map.json: NN KB (Target: <50 KB) [✓]
- ai-architecture-summary.md: NN KB (Target: <20 KB) [✓]

Generation time breakdown:

- Layer model: NNNms
- Module map: NNNms
- Dependency graph: NNNms [HOTSPOT if >1.2s]
- Brain generation: NNNms [HOTSPOT if >1.8s]
- Mini + Summary: NNNms
- Total: Ns (Target: <2s warm cache) [Status]

```

### Script Performance Baselines

```

Profiling: 10 runs each (95th percentile)

- ai-guard.ts: NNNms (Target: <1s) [Status]
- infra-audit.ts: N.NNs (Target: <3s) [Status]
- type-safety-guard.ts: NNNms (Target: <1s) [Status]
- architecture-diff.ts: N.NNs (Target: <2s) [Status]
- validate-architecture-brain.ts: NNNms (Target: <1s) [Status]

Total (sequential): N.Ns (Not recommended; normally parallelized)
Total (parallelized est.): N.Ns (Target for CI)

```

### CI Pipeline Performance

```

Measured from GitHub Actions (last run):

Serial (old strategy):

- Setup: N min
- Lint: N min
- Type check: N min
- Tests: N min
- Architecture: N min
- Artifacts: N min
- Total serial: NN min (baseline)

Parallel (new strategy):

- Setup: N min (sequential blocker)
- Code quality: N min (parallel with tests)
- Tests: N min (parallel with code quality)
- Architecture: N min (parallel with code quality + tests)
- Artifacts: N min (serial after tests)
- Total parallel: N min (Target: <8 min) [Status]

Parallelization efficiency:

- Speedup factor: X.X (expected: 2-3x)
- Cache hit rate: NN% (Target: >80%)

```

### Dependency Metrics

```

Lock file metrics:

- File size: N.N MB (Target: <6 MB) [Status]
- Top-level packages: NN (Target: ~42) [Status]
- Transitive dependencies: NNN (Monitor)
- Unused packages: N (Target: 0) [Status]

Transitive bloat:

- Packages with 5+ redundant versions: N
- Candidates for consolidation: N

```

### AI Skills Audit

```

Skill file compliance: [NN/NN files compliant]

Files exceeding 500-line limit:

- [None] OR
- architecture-self-healing: NNN lines [Should be split into 3 files]
- ai-governance: NNN lines [Monitor; marginal violation]

Average skill file size: NNN lines
Largest skill file: architecture-self-healing (NNN lines) [Status]

Action items:

- [ ] Split architecture-self-healing into 3 focused skills
- [ ] Monitor ai-governance; consider splitting if >550 lines

```

## Trends

### Size Evolution (Last 30 Days)

```

| Date       | Size   | Change | Trend |
| ---------- | ------ | ------ | ----- |
| YYYY-MM-14 | NNN MB | ±0 MB  | →     |
| YYYY-MM-13 | NNN MB | +N MB  | ↑     |
| YYYY-MM-12 | NNN MB | +N MB  | ↑     |

...
YYYY-MM-01 | NNN MB | -baseline- | —

Current rate: +N MB/week (or -N MB/week if improving)
Days until target: NN if improving; NN until breakage if degrading

```

### Performance Evolution (Last 30 Days)

```

Metric: infra-audit.ts execution time

| Date       | Time | Change | Status        |
| ---------- | ---- | ------ | ------------- |
| YYYY-MM-14 | N.Ns | -0.1s  | ✓ Improving   |
| YYYY-MM-13 | N.Ns | +0.1s  | ⚠️ Regression |
| YYYY-MM-12 | N.Ns | ±0s    | → Stable      |

...

Trend: [Improving/Stable/Degrading]
[If improving] Projected to reach <3s target: NN days
[If degrading] Projected to exceed limit: NN days

```

## Action Items

### Critical (Address Before Next Phase)

- [ ] Item 1 with impact assessment
- [ ] Item 2 with deadline

### High Priority

- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

### Medium Priority

- [ ] Item 1
- [ ] Item 2

## Alerts

### ⚠️ Warnings

- Repository size trending upward (growing +N MB/week)
- Script [X] approaching target threshold
- Cache hit rate below expected (NN% actual vs NN% target)

### 🚨 Critical Issues

[None detected] OR
- Critical issue 1: Impact assessment and mitigation
- Critical issue 2: Impact assessment and mitigation

## Recommendations

1. Specific actionable recommendation with rationale
2. Recommendation with timeline
3. Recommendation with owner/responsible party

## Next Review

**Scheduled:** YYYY-MM-DD (30 days from now)
**Report Content:** Metrics evolution, trend analysis, alert status

---

*Report generated: [ISO8601 timestamp]*
*Duration: Xs*
*Status: COMPLETE*
```

---

## Metrics Definition & Validation

```typescript
// What each metric means and how to validate it

interface MetricDefinition {
  name: string;
  unit: string;
  measurement: string; // How it's measured
  target: number;
  critical: number; // Hard limit (alert if exceeded)
  acceptable: number; // Acceptable range upper bound

  validation: {
    method: string; // How to validate the measurement
    tolerance: number; // ±N% acceptable variance
    repeatability: "high" | "medium" | "low";
  };
}

// Example definitions:
const metrics: Record<string, MetricDefinition> = {
  "repo-size-mb": {
    name: "Total Repository Size",
    unit: "MB",
    measurement: "du -sh $(git ls-files | head -1000) + du -sh docs/ + du -sh scripts/",
    target: 150,
    critical: 200, // Alert if exceeds
    acceptable: 160, // Warning if exceeds
    validation: {
      method: "Run du and sum directory sizes",
      tolerance: 5, // ±5% acceptable variance
      repeatability: "high", // Very consistent
    },
  },

  "ai-context-gen-time-ms": {
    name: "AI Context Generation Time",
    unit: "milliseconds",
    measurement: "time bun scripts/ai-context/generate-ai-context.ts (warm cache)",
    target: 2000, // <2s target
    critical: 3000, // Alert if >3s
    acceptable: 2500, // Warning if >2.5s
    validation: {
      method: "Run generator 3 times; average warm-cache runs",
      tolerance: 10, // ±10% acceptable (timing has variance)
      repeatability: "medium",
    },
  },

  // ... more metrics with definitions
};
```

---

## Report Validation Rules

```typescript
// Contract: Health report must pass these validation rules

interface HealthReportValidation {
  // Structure validation
  hasAllSections: boolean; // All sections present
  metricsSummaryTableValid: boolean; // Table format correct
  statusIconsCorrect: boolean; // ✓/⚠️/✗ correct for values
  trendIconsCorrect: boolean; // ↑/→/↓ correct for changes

  // Data validation
  allMetricsPresent: boolean; // All expected metrics included
  valuesAreNumbers: boolean; // Numeric values properly formatted
  targetsAreDefinitive: boolean; // No "TBD" or unknown targets
  timestampIsISO8601: boolean; // Valid timestamp format

  // Correctness validation
  metricsAccurate: boolean; // Values match actual measurements
  trendDirectionCorrect: boolean; // Trend matches delta from previous
  statusAlignedWithValues: boolean; // Status matches value vs target
  alertsAreTriggered: boolean; // Warnings/critical shown if exceeded

  // Completeness validation
  allArtifactsListed: boolean; // All AI artifacts included
  allScriptsProfiled: boolean; // All 5 key scripts included
  trendsAvailable: boolean; // If >1 report exists, trends shown
}

// Pre-publish validation happens in scripts/dev/repository-health.ts
// before committing report to docs/reports/health/
```

---

## Integration with CI/CD

```yaml
# How health reports integrate into GitHub Actions

GitHub Actions Integration:
  Trigger: Push to main branch (after tests + architecture pass)

  Steps:
    - name: Generate Health Report
      run: bun scripts/dev/repository-health.ts
      if: success() # Only run if tests passed

    - name: Commit Report
      run: |
        git config user.name "CI Health Bot"
        git config user.email "health@zidney.local"
        git add docs/reports/health/
        git commit -m "chore: update repository health report" || true
        git push
      if: github.ref == 'refs/heads/main'

  Output Artifacts:
    - docs/reports/health/HEALTH_REPORT-{timestamp}.md (new report)
    - docs/reports/health/HEALTH_REPORT.md (symlink to latest)
    - docs/reports/health/HEALTH_TRENDS.md (auto-updated trend analysis)

  Retention Policy:
    - Keep: Last 30 calendar days of reports
    - Archive: Reports older than 30 days to docs/reports/health/archive/
    - History: Use git history for older reports if needed
```

---

## Contract Compliance Checklist

```markdown
# Health Report Contract Compliance (Phase 7)

## Generation Contract

- [ ] Report generated automatically after CI success
- [ ] Report filename: HEALTH_REPORT-{ISO8601}.md
- [ ] Symlink updated: HEALTH_REPORT.md → latest
- [ ] Commit to git with standard message

## Content Contract

- [ ] Executive summary present (score, change, critical items)
- [ ] Metrics summary table correct (all 12+ key metrics)
- [ ] Detailed metrics sections complete
- [ ] Trend analysis included (size + performance evolution)
- [ ] Action items prioritized (critical > high > medium)
- [ ] Alerts section shows warnings/critical issues

## Accuracy Contract

- [ ] All metrics match actual measurements (±tolerance)
- [ ] Status icons (✓/⚠️/✗) correct for values vs targets
- [ ] Trend arrows (↑/→/↓) correct for changes
- [ ] Timestamps correct (ISO 8601)
- [ ] Commit SHA matches running code

## Persistence Contract

- [ ] Last 30 days of reports available
- [ ] Older reports archived
- [ ] Trend dashboard aggregates all historic reports
- [ ] No data loss on archive

## Automation Contract

- [ ] Report auto-generated on main push
- [ ] No manual intervention required
- [ ] Failures logged and visible in CI
- [ ] Comparison with previous report automatic
```

---

**Contract Status:** READY FOR PHASE 7 IMPLEMENTATION

_Created: 2026-03-14_
