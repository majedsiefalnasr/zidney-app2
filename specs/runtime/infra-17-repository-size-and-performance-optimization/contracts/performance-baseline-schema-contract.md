# Performance Baseline Schema Contract

**Purpose:** Define the performance baseline artifact format and validation contract  
**Phase:** 8 (Validation & Closure)  
**Requirement:** Establish reproducible performance baseline for future optimization validation

---

## Baseline Schema Overview

```yaml
# Contract: Performance baseline artifact (Phase 8 final validation)

Artifact Identification:
  Filename: PERFORMANCE_BASELINE.json
  Location: audits/
  Format: JSON (deterministic, schema-validated)
  PublishDate: End of Phase 8 (Week 8, Day 5)

Baseline Role:
  Purpose: "Establish ground truth for all repository performance metrics"
  Audience: "Future optimization efforts, CI performance tracking, regression detection"
  Authority: "Source of truth for performance expectations"

Schema Version: "1.0"
Compatibility: "All Phase 1-8 implementations must align with this schema"
ValidationTarget: "All future health reports must validate against this baseline"
```

---

## JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Repository Performance Baseline",
  "description": "Authoritative performance baseline established at end of Phase 8",
  "type": "object",

  "definitions": {
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 datetime with timezone"
    },

    "metricValue": {
      "type": "object",
      "required": ["value", "unit", "measurement_method"],
      "properties": {
        "value": {
          "type": "number",
          "description": "Actual measured value"
        },
        "unit": {
          "type": "string",
          "enum": ["ms", "s", "MB", "KB", "count", "percent", "ratio"],
          "description": "Unit of measurement"
        },
        "measurement_method": {
          "type": "string",
          "description": "How this was measured (e.g., 'time bun command', 'du -sh')"
        },
        "runs_measured": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of measurement runs averaged"
        },
        "percentile": {
          "type": "string",
          "enum": ["min", "p50", "p95", "p99", "max", "mean"],
          "description": "Which percentile this value represents"
        },
        "variance_percent": {
          "type": "number",
          "minimum": 0,
          "description": "±N% variance observed"
        },
        "measurement_date": {
          "$ref": "#/definitions/timestamp"
        }
      }
    },

    "targetThresholds": {
      "type": "object",
      "required": ["target", "warning", "critical"],
      "properties": {
        "target": {
          "type": "number",
          "description": "Desired/expected value"
        },
        "warning": {
          "type": "number",
          "description": "Alert if exceeds this (yellow)"
        },
        "critical": {
          "type": "number",
          "description": "Alert if exceeds this (red)"
        }
      }
    }
  },

  "required": [
    "baseline_metadata",
    "measurement_environment",
    "repository_metrics",
    "ai_context_metrics",
    "script_performance_metrics",
    "ci_performance_metrics",
    "dependency_metrics",
    "skill_audit_metrics",
    "validation_summary"
  ],

  "properties": {
    "baseline_metadata": {
      "type": "object",
      "required": ["schema_version", "baseline_date", "phase_completed", "commit_sha", "branch"],
      "properties": {
        "schema_version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+$",
          "description": "Baseline schema version (e.g., '1.0')"
        },
        "baseline_date": {
          "$ref": "#/definitions/timestamp",
          "description": "When baseline was established (end of Phase 8)"
        },
        "phase_completed": {
          "type": "string",
          "pattern": "^Phase [0-8]$",
          "description": "Phase during which baseline was established"
        },
        "commit_sha": {
          "type": "string",
          "pattern": "^[a-f0-9]{40}$",
          "description": "Git commit SHA when baseline was measured"
        },
        "branch": {
          "type": "string",
          "enum": ["main"],
          "description": "Branch where baseline was measured"
        },
        "baseline_duration_weeks": {
          "type": "integer",
          "minimum": 8,
          "description": "Duration of optimization phases (8 weeks)"
        },
        "optimization_results": {
          "type": "object",
          "description": "Summary of all optimizations completed",
          "properties": {
            "phases_completed": {
              "type": "integer",
              "enum": [8],
              "description": "Total phases completed"
            },
            "total_improvements": {
              "type": "integer",
              "minimum": 1
            },
            "total_lines_added": {
              "type": "integer"
            },
            "total_lines_removed": {
              "type": "integer"
            }
          }
        }
      }
    },

    "measurement_environment": {
      "type": "object",
      "description": "Environment details for reproducibility",
      "properties": {
        "os": {
          "type": "string",
          "enum": ["macos", "linux"],
          "description": "Operating system"
        },
        "os_version": {
          "type": "string",
          "description": "OS version (e.g., 'macOS 14.6')"
        },
        "runner_type": {
          "type": "string",
          "description": "GitHub Actions runner type (ubuntu-latest, macos-latest)"
        },
        "cpu_model": {
          "type": "string",
          "description": "CPU type (e.g., 'Intel i7', 'Apple M1')"
        },
        "memory_gb": {
          "type": "number",
          "minimum": 4
        },
        "disk_free_gb": {
          "type": "number",
          "minimum": 10
        },
        "bun_version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+",
          "description": "Bun runtime version"
        },
        "node_version": {
          "type": "string",
          "pattern": "^v\\d+\\.\\d+\\.\\d+",
          "description": "Node.js version (if applicable)"
        },
        "typescript_version": {
          "type": "string"
        },
        "git_version": {
          "type": "string"
        }
      }
    },

    "repository_metrics": {
      "type": "object",
      "description": "Repository size and structure metrics",
      "required": ["total_size_mb", "directory_breakdown", "file_counts"],
      "properties": {
        "total_size_mb": {
          "$ref": "#/definitions/metricValue",
          "description": "Total repo size excluding node_modules, .git, coverage"
        },
        "directory_breakdown": {
          "type": "object",
          "description": "Size by major directory",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "size_mb": { "type": "number" },
              "percent_of_total": { "type": "number" },
              "file_count": { "type": "integer" }
            }
          }
        },
        "file_counts": {
          "type": "object",
          "properties": {
            "typescript_files": { "type": "integer" },
            "markdown_files": { "type": "integer" },
            "json_files": { "type": "integer" },
            "yaml_files": { "type": "integer" },
            "shell_files": { "type": "integer" },
            "total_tracked_files": { "type": "integer" }
          }
        },
        "target_threshold": {
          "$ref": "#/definitions/targetThresholds",
          "description": "Size targets: target=150MB, warning=160MB, critical=180MB"
        }
      }
    },

    "ai_context_metrics": {
      "type": "object",
      "description": "AI context artifact generation and size metrics",
      "required": ["total_artifact_size_kb", "generation_time_ms", "artifacts"],
      "properties": {
        "total_artifact_size_kb": {
          "$ref": "#/definitions/metricValue",
          "description": "Total size of all AI context artifacts"
        },
        "generation_time_ms": {
          "$ref": "#/definitions/metricValue",
          "description": "Total time to generate all artifacts (warm cache)"
        },
        "cache_hit_rate_percent": {
          "$ref": "#/definitions/metricValue",
          "description": "Percent of artifact generation using cache"
        },
        "artifacts": {
          "type": "object",
          "description": "Individual artifact metrics",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "size_kb": { "type": "number" },
              "generation_time_ms": { "type": "number" },
              "purpose": { "type": "string" }
            }
          }
        },
        "target_thresholds": {
          "type": "object",
          "properties": {
            "total_size": {
              "$ref": "#/definitions/targetThresholds",
              "description": "target=700KB, warning=750KB, critical=800KB"
            },
            "generation_time": {
              "$ref": "#/definitions/targetThresholds",
              "description": "target=2000ms, warning=2500ms, critical=3000ms"
            }
          }
        }
      }
    },

    "script_performance_metrics": {
      "type": "object",
      "description": "Architecture and governance script performance",
      "required": ["scripts"],
      "properties": {
        "measurement_runs": {
          "type": "integer",
          "minimum": 3,
          "description": "Number of times each script was run"
        },
        "cache_strategy": {
          "type": "string",
          "enum": ["warm_cache", "cold_cache", "no_cache"],
          "description": "Cache state during measurement"
        },
        "scripts": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "required": ["execution_time_ms", "purpose"],
            "properties": {
              "execution_time_ms": {
                "$ref": "#/definitions/metricValue"
              },
              "purpose": {
                "type": "string"
              },
              "target_ms": {
                "$ref": "#/definitions/targetThresholds"
              },
              "complexity_notes": {
                "type": "string"
              },
              "dependencies": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Scripts/tools this depends on"
              }
            }
          }
        },
        "total_sequential_ms": {
          "$ref": "#/definitions/metricValue",
          "description": "Sum of all scripts run sequentially"
        },
        "parallelization_potential": {
          "type": "object",
          "properties": {
            "currently_parallel_ms": { "type": "number" },
            "estimated_with_full_parallelization_ms": { "type": "number" },
            "speedup_factor": { "type": "number" }
          }
        }
      }
    },

    "ci_performance_metrics": {
      "type": "object",
      "description": "GitHub Actions CI pipeline performance",
      "properties": {
        "workflow_name": {
          "type": "string"
        },
        "measurements": {
          "type": "object",
          "properties": {
            "serial_baseline": {
              "type": "object",
              "properties": {
                "total_time_minutes": {
                  "$ref": "#/definitions/metricValue"
                },
                "stages": {
                  "type": "object",
                  "additionalProperties": {
                    "type": "number"
                  }
                }
              }
            },
            "optimized_parallel": {
              "type": "object",
              "properties": {
                "total_time_minutes": {
                  "$ref": "#/definitions/metricValue"
                },
                "parallel_jobs": {
                  "type": "integer"
                },
                "stages": {
                  "type": "object",
                  "additionalProperties": {
                    "type": "number"
                  }
                }
              }
            },
            "cache_performance": {
              "type": "object",
              "properties": {
                "hit_rate_percent": {
                  "type": "number"
                },
                "time_saved_per_hit_seconds": {
                  "type": "number"
                },
                "effectiveness": {
                  "type": "string",
                  "enum": ["excellent", "good", "acceptable", "poor"]
                }
              }
            }
          }
        },
        "target_thresholds": {
          "type": "object",
          "properties": {
            "optimized_time_minutes": {
              "$ref": "#/definitions/targetThresholds",
              "description": "target=7 min, warning=8 min, critical=10 min"
            },
            "cache_hit_rate": {
              "$ref": "#/definitions/targetThresholds",
              "description": "target=85%, warning=80%, critical=70%"
            }
          }
        }
      }
    },

    "dependency_metrics": {
      "type": "object",
      "description": "Dependency management and lock file metrics",
      "properties": {
        "lock_file_size_mb": {
          "$ref": "#/definitions/metricValue"
        },
        "top_level_packages": {
          "type": "integer"
        },
        "transitive_dependencies": {
          "type": "integer"
        },
        "unused_packages": {
          "type": "integer"
        },
        "duplicate_versions": {
          "type": "integer",
          "description": "Same package with multiple versions in tree"
        },
        "security_vulnerabilities": {
          "type": "integer"
        },
        "deprecated_packages": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "package_name": { "type": "string" },
              "version": { "type": "string" },
              "replacement": { "type": "string" }
            }
          }
        },
        "target_thresholds": {
          "type": "object",
          "properties": {
            "lock_file_size_mb": {
              "$ref": "#/definitions/targetThresholds",
              "description": "target=5.5MB, warning=6MB, critical=7MB"
            },
            "unused_packages": {
              "$ref": "#/definitions/targetThresholds",
              "description": "target=0, warning=1, critical=2"
            }
          }
        }
      }
    },

    "skill_audit_metrics": {
      "type": "object",
      "description": "AI Skill file compliance audit",
      "properties": {
        "total_skill_files": {
          "type": "integer"
        },
        "compliant_files": {
          "type": "integer",
          "description": "Files ≤500 lines"
        },
        "violations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "file_path": { "type": "string" },
              "line_count": { "type": "integer" },
              "target_line_count": { "type": "integer" },
              "excess_lines": { "type": "integer" },
              "remediation": { "type": "string" }
            }
          }
        },
        "average_file_size_lines": {
          "type": "number"
        },
        "compliance_rate_percent": {
          "type": "number",
          "minimum": 0,
          "maximum": 100
        },
        "remediation_completed": {
          "type": "boolean",
          "description": "All violations fixed"
        }
      }
    },

    "validation_summary": {
      "type": "object",
      "description": "Overall validation and success assessment",
      "required": ["phase_objectives_met", "all_targets_achieved", "violations_remaining"],
      "properties": {
        "phase_objectives_met": {
          "type": "integer",
          "description": "Count of Phase objectives completed"
        },
        "total_phase_objectives": {
          "type": "integer"
        },
        "all_targets_achieved": {
          "type": "boolean",
          "description": "Are all metrics at or below targets?"
        },
        "violations_remaining": {
          "type": "integer",
          "description": "Count of metrics exceeding thresholds"
        },
        "violations_detail": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "metric": { "type": "string" },
              "current_value": { "type": "number" },
              "target_value": { "type": "number" },
              "status": {
                "type": "string",
                "enum": ["warning", "critical", "satisfied"]
              }
            }
          }
        },
        "recommendations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "recommendation": { "type": "string" },
              "priority": {
                "type": "string",
                "enum": ["critical", "high", "medium", "low"]
              },
              "effort_estimate": { "type": "string" },
              "expected_improvement": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

---

## Example Baseline Document

```json
{
  "baseline_metadata": {
    "schema_version": "1.0",
    "baseline_date": "2026-05-14T16:30:00Z",
    "phase_completed": "Phase 8",
    "commit_sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
    "branch": "main",
    "baseline_duration_weeks": 8,
    "optimization_results": {
      "phases_completed": 8,
      "total_improvements": 47,
      "total_lines_added": 3200,
      "total_lines_removed": 1900
    }
  },

  "measurement_environment": {
    "os": "macos",
    "os_version": "14.6",
    "runner_type": "macos-latest",
    "cpu_model": "Apple Silicon M1 Pro",
    "memory_gb": 16,
    "disk_free_gb": 50,
    "bun_version": "1.0.30",
    "node_version": "v20.10.0",
    "typescript_version": "5.3.3",
    "git_version": "2.43.0"
  },

  "repository_metrics": {
    "total_size_mb": {
      "value": 142,
      "unit": "MB",
      "measurement_method": "du -sh with exclusions (node_modules, .git, coverage)",
      "runs_measured": 5,
      "percentile": "mean",
      "variance_percent": 1.2,
      "measurement_date": "2026-05-14T16:30:00Z"
    },
    "directory_breakdown": {
      "apps": { "size_mb": 45, "percent_of_total": 31.7, "file_count": 2850 },
      "packages": { "size_mb": 32, "percent_of_total": 22.5, "file_count": 1200 },
      "docs": { "size_mb": 38, "percent_of_total": 26.8, "file_count": 890 },
      "scripts": { "size_mb": 8, "percent_of_total": 5.6, "file_count": 320 },
      "other": { "size_mb": 19, "percent_of_total": 13.4, "file_count": 1540 }
    },
    "target_threshold": {
      "target": 150,
      "warning": 160,
      "critical": 180
    }
  },

  "ai_context_metrics": {
    "total_artifact_size_kb": {
      "value": 680,
      "unit": "KB",
      "measurement_method": "sum of all .json and .md artifacts in docs/ai/context/",
      "runs_measured": 10,
      "percentile": "p95",
      "variance_percent": 3.5,
      "measurement_date": "2026-05-14T16:30:00Z"
    },
    "generation_time_ms": {
      "value": 1850,
      "unit": "ms",
      "measurement_method": "time bun scripts/generate-ai-context.ts (warm cache)",
      "runs_measured": 10,
      "percentile": "p95",
      "variance_percent": 8.2,
      "measurement_date": "2026-05-14T16:30:00Z"
    },
    "cache_hit_rate_percent": {
      "value": 87,
      "unit": "percent",
      "measurement_method": "artifact_exists && hash_match / total_runs",
      "runs_measured": 20,
      "percentile": "mean"
    },
    "artifacts": {
      "ai-context-mini.json": {
        "size_kb": 42,
        "generation_time_ms": 45,
        "purpose": "Lightweight bootstrap context"
      },
      "ai-module-map.json": {
        "size_kb": 185,
        "generation_time_ms": 320,
        "purpose": "Module to layer mapping"
      },
      "ai-dependency-graph.json": {
        "size_kb": 220,
        "generation_time_ms": 580,
        "purpose": "Full dependency relationships"
      },
      "ai-architecture-brain.json": {
        "size_kb": 155,
        "generation_time_ms": 620,
        "purpose": "Architecture intelligence"
      }
    }
  },

  "script_performance_metrics": {
    "measurement_runs": 10,
    "cache_strategy": "warm_cache",
    "scripts": {
      "ai-guard.ts": {
        "execution_time_ms": {
          "value": 680,
          "unit": "ms",
          "percentile": "p95",
          "variance_percent": 12
        },
        "purpose": "Forbidden import detection",
        "target_ms": { "target": 1000, "warning": 1100, "critical": 1500 }
      },
      "infra-audit.ts": {
        "execution_time_ms": {
          "value": 2150,
          "unit": "ms",
          "percentile": "p95",
          "variance_percent": 15
        },
        "purpose": "Architecture audit and brain generation",
        "target_ms": { "target": 3000, "warning": 3300, "critical": 4000 }
      },
      "type-safety-guard.ts": {
        "execution_time_ms": {
          "value": 520,
          "unit": "ms",
          "percentile": "p95"
        },
        "purpose": "TypeScript strict mode verification"
      }
    }
  },

  "ci_performance_metrics": {
    "workflow_name": "Continuous Integration",
    "measurements": {
      "optimized_parallel": {
        "total_time_minutes": {
          "value": 7.2,
          "unit": "s",
          "percentile": "p95"
        },
        "parallel_jobs": 3,
        "stages": {
          "setup": 2,
          "lint_and_tests": 3.5,
          "architecture": 1.2
        }
      },
      "cache_performance": {
        "hit_rate_percent": 87,
        "time_saved_per_hit_seconds": 45,
        "effectiveness": "excellent"
      }
    },
    "target_thresholds": {
      "optimized_time_minutes": { "target": 7, "warning": 8, "critical": 10 },
      "cache_hit_rate": { "target": 85, "warning": 80, "critical": 70 }
    }
  },

  "dependency_metrics": {
    "lock_file_size_mb": {
      "value": 5.8,
      "unit": "MB"
    },
    "top_level_packages": 42,
    "transitive_dependencies": 450,
    "unused_packages": 0,
    "duplicate_versions": 3,
    "security_vulnerabilities": 0
  },

  "validation_summary": {
    "phase_objectives_met": 8,
    "total_phase_objectives": 8,
    "all_targets_achieved": true,
    "violations_remaining": 0,
    "violations_detail": [],
    "recommendations": [
      {
        "recommendation": "Monitor ai-context generation time; consider async generation if approaches 2.5s",
        "priority": "medium",
        "effort_estimate": "3-5 hours",
        "expected_improvement": "Keep below 2s target consistently"
      }
    ]
  }
}
```

---

## Validation Rules

```typescript
// Contract: Baseline document must pass these validation rules

interface BaselineValidation {
  // Schema compliance
  schemaValid: boolean; // Matches JSON schema above
  allRequiredFieldsPresent: boolean; // No missing required fields
  dataTypesCorrect: boolean; // All values match expected types

  // Measurement validity
  environmentDocumented: boolean; // All env details recorded
  measurementMethodDocumented: boolean; // How each metric was measured
  runCountAdequate: boolean; // ≥3 runs per metric
  varianceWithinAcceptable: boolean; // ±N% variance acceptable

  // Consistency validation
  allTargetsConsistent: boolean; // Targets match constitution
  percentamesCorrect: boolean; // Size percentages sum to ~100%
  timeBreakdownsConsistent: boolean; // Stage times sum to total

  // Completeness
  noTBDFields: boolean; // All values finalized (no TBD/TK)
  allScriptsMeasured: boolean; // All 5+ critical scripts included
  allArtifactsMeasured: boolean; // All 8 AI context artifacts included

  // Correctness
  valuesAreActual: boolean; // From real measurement, not estimates
  commitSHAMatches: boolean; // Matches git commit of measurements
  statsAreAccurate: boolean; // Stats correctly calculated from data
}

// Published baseline must pass all validation rules before being committed
```

---

## Publication & Archive Contract

```yaml
# Contract: How baseline is published and archived

Publication:
  Timing: "End of Phase 8 (Week 8, Day 5)"
  Location: audits/PERFORMANCE_BASELINE.json
  Access: "Public; part of repository"
  Format: "Valid JSON; machine-readable"

Permanence:
  Immutability: "Baseline document never modified after publication"
  Archival: "Versioned in git history; can be recovered"
  History: "Use git log to see baseline evolution across phases"

Reference:
  Usage: "All future optimizations measure against this baseline"
  Comparison: "Health reports compare current metrics to baseline"
  Regression: "Performance regressions detected vs baseline"

Continuation:
  Next Baseline: "After next major optimization cycle (estimated 6 months)"
  Rollback: "If optimization harms performance, baseline proves original targets"
```

---

## Contract Compliance Checklist

```markdown
# Performance Baseline Contract Compliance (Phase 8)

## Schema Contract

- [ ] JSON schema valid (matches JSON Schema Draft 7)
- [ ] All required fields present
- [ ] Data types correct for all values
- [ ] No null or undefined values

## Measurement Contract

- [ ] All metrics measured (not estimated)
- [ ] Measurement method documented for each metric
- [ ] ≥3 runs per metric (or ≥10 for CI metrics)
- [ ] Variance within acceptable ±N%
- [ ] Measurement environment fully documented
- [ ] Percentile/aggregation clearly stated

## Accuracy Contract

- [ ] Values match actual source of truth
- [ ] Commit SHA matches measurement code
- [ ] Calculations verified (percentages, sums, trends)
- [ ] No rounding errors in critical metrics

## Completeness Contract

- [ ] All 8 success metrics included
- [ ] All critical scripts measured
- [ ] All AI context artifacts measured
- [ ] All environment variables recorded
- [ ] No TBD/TK placeholders

## Validation Contract

- [ ] Passes JSON schema validation
- [ ] All targets achievable by Phase 8
- [ ] No impossible targets remaining
- [ ] Violations correctly flagged

## Archive Contract

- [ ] File committed to git audits/ directory
- [ ] Never modified after publication
- [ ] Accessible 10+ years (project lifetime)
- [ ] Used as reference for future optimizations
```

---

**Contract Status:** READY FOR PHASE 8 IMPLEMENTATION & PUBLICATION

_Created: 2026-03-14_
