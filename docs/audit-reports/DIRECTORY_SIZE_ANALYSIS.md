# Directory Size Analysis Report

**Generated:** [timestamp]  
**Repository State:** [branch/commit]  
**Purpose:** Measure directory sizes at key repository locations to identify bloat areas

---

## Summary

| Directory        | Size (MB) | File Count | % of Total | Growth Trend |
| ---------------- | --------- | ---------- | ---------- | ------------ |
| node_modules     | X         | N          | XX%        | ↑            |
| apps/            | X         | N          | XX%        | ↔            |
| packages/        | X         | N          | XX%        | ↔            |
| scripts/         | X         | N          | XX%        | ↑            |
| docs/ai/context/ | X         | N          | XX%        | ↑            |
| coverage/        | X         | N          | XX%        | ↑            |
| TOTAL            | Y         | -          | 100%       | ⚠️           |

---

## Detailed Breakdown by Directory

### Core Application Code

```
apps/
├── api/              X MB (N files)
├── backoffice/       X MB (N files)
├── frontoffice/      X MB (N files)
├── mmc/              X MB (N files)
└── worker/           X MB (N files)
```

Total: X MB (target <X MB)

### Shared Packages

```
packages/
├── api-client/       X MB (N files)
├── config/           X MB (N files)
├── domain-core/      X MB (N files)
├── job-queue/        X MB (N files)
├── logger/           X MB (N files)
├── redis-utils/      X MB (N files)
├── types/            X MB (N files)
├── ui-system/        X MB (N files)
└── validation/       X MB (N files)
```

Total: X MB (target <X MB)

### Governance & Tooling

```
scripts/
├── ai-context/       X MB (N files)
├── architecture/      X MB (N files)
└── [*.ts files]      X MB
```

Total: X MB (target <X MB after refactoring)

### AI Context Artifacts

```
docs/ai/context/
├── ai-context-mini.json          X KB
├── ai-module-map.json             X KB
├── ai-dependency-graph.json       X MB
├── ai-architecture-brain.json     X KB
├── ai-runtime-map.json            X KB
└── [other artifacts]              X KB
```

Total: X MB (target <10 MB)

### Documentation

```
docs/
├── architecture/      X MB
├── ai/                X MB
├── reports/           X MB
└── [other]            X MB
```

Total: X MB (target maintain <X MB)

### Test & Build Artifacts

```
coverage/             X MB (N files) → DELETE IN CLEANUP
build/                X MB (N files) → DELETE IN CLEANUP
dist/                 X MB (N files) → DELETE IN CLEANUP
```

Total: X MB (target DELETE before measurement)

---

## Growth Analysis

### Historical Trend

| Date                      | Total (MB) | Trend | Notes               |
| ------------------------- | ---------- | ----- | ------------------- |
| 2026-03-14 (baseline)     | Y          | —     | Phase 1 diagnostics |
| 2026-03-21 (post-Phase 2) | Y          | ↓     | Expected reduction  |
| 2026-04-04 (post-Phase 3) | Y          | ↓     | Cache optimization  |

---

## Size Reduction Opportunities

1. **node_modules** (largest contributor)
   - Audit transitive dependencies
   - Remove unused packages
   - Target reduction: 15-25%

2. **AI Context Artifacts**
   - Implement caching (Phase 3)
   - Archive old snapshots
   - Target: <10MB total

3. **Coverage Reports**
   - Store only in CI artifacts (not in repo)
   - Archive locally only
   - Target: Remove from repo

4. **Merged branches / dead code**
   - Identify and remove old scripts
   - Archive to separate branch if needed
   - Target: 5-10% reduction

---

## Recommendations

- [ ] Archive directories stored outside VCS (coverage/, build/, dist/)
- [ ] Audit dependencies (follow Phase 5 Q5 strategy)
- [ ] Implement AI context caching (Phase 3)
- [ ] Remove unnecessary transitive deps
- [ ] Monitor node_modules after each package.json change

---

## Target Metrics

- **Total repo size:** <150 MB (uncompressed)
- **Compressed (tar.gz):** <50 MB
- **node_modules:** <800 MB (not affecting compressed size)
- **Artifacts:** <10 MB total
