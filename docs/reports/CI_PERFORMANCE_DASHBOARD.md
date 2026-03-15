# CI Performance Dashboard

```json
{
  "generatedAt": "2026-03-14T22:25:16.743Z",
  "phase": "4: CI Pipeline Optimization",
  "baselineMinutes": 18,
  "optimizedMinutes": 8,
  "savingsPercent": 55.56,
  "status": "COMPLETE",
  "metrics": {
    "parallelGroups": 4,
    "totalJobs": 11,
    "criticalPathMinutes": 8,
    "cacheHitRatio": 0.75
  },
  "jobGroups": {
    "group1": {
      "name": "Code Quality",
      "duration": 5,
      "jobs": [
        "lint",
        "typecheck",
        "arch-guard"
      ]
    },
    "group2": {
      "name": "Tests",
      "duration": 8,
      "jobs": [
        "unit-tests",
        "integration-tests",
        "coverage-validation"
      ]
    },
    "group3": {
      "name": "E2E",
      "duration": 10,
      "jobs": [
        "e2e-mmc",
        "e2e-backoffice",
        "e2e-frontoffice"
      ]
    },
    "group4": {
      "name": "Build",
      "duration": 3,
      "jobs": [
        "build-verification"
      ]
    }
  }
}
```
