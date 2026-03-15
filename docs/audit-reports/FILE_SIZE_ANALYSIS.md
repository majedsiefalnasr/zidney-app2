# File Size Analysis Report

**Generated:** [timestamp]  
**Repository State:** [branch/commit]  
**Purpose:** Identify oversized files (>2000 lines, >1MB) contributing to repository bloat

---

## Summary

| Metric                 | Value  | Status |
| ---------------------- | ------ | ------ |
| Total oversized files  | N      | ⚠️     |
| Files >2000 lines      | N      | ⚠️     |
| Files >1MB             | N      | ⚠️     |
| Total size (oversized) | X MB   | ⚠️     |
| Target reduction       | 30-40% | 🎯     |

---

## Critical Oversized Files (>2000 lines)

| File Path        | Lines | Size (KB) | Category      | Notes                            |
| ---------------- | ----- | --------- | ------------- | -------------------------------- |
| path/to/file1.ts | 2500  | 95        | Script        | Candidate for modularization     |
| path/to/file2.md | 3200  | 120       | Documentation | Consider splitting into sections |

---

## Large Files (>1MB)

| File Path | Size (MB) | Line Count | Type | Notes                             |
| --------- | --------- | ---------- | ---- | --------------------------------- |
| file.json | 1.5       | 40000      | Data | Consider compression or splitting |

---

## Distribution by Category

```
Scripts (src): 45%
Documentation: 30%
AI Context Artifacts: 20%
Configuration: 5%
```

---

## Recommendations

1. **Modularize Large Scripts**
   - Extract utility functions from >2000 line scripts
   - Target: <1500 lines per file

2. **Split Documentation**
   - Break down SKILL.md and long guides into sections
   - Link via index files

3. **Archive AI Context**
   - Move old snapshots to docs/ai/context/archive/
   - Keep only recent 2 artifacts live

---

## Phase 1 Baseline

- **File count (oversized):** [N]
- **Total size:** [X MB]
- **Largest file:** [filename] ([Y MB], [Z lines])
- **Average oversized file size:** [AVG MB]

---

## Tracking

- **Baseline date:** 2026-03-14
- **Next review:** Phase 2 completion
- **Target state:** All files <2000 lines (except auto-generated)
