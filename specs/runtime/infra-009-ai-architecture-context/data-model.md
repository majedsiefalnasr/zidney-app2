# Data Model: STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT

**Stage:** AI Architecture Context  
**Phase:** PHASE_01_PLATFORM_FOUNDATION  
**Document Type:** Data Model & Artifact Schemas  
**Status:** Finalized  
**Date:** 2026-03-09

---

## Overview

This document defines the data model for all 7 AI context artifacts. These are governance metadata, not runtime data, and are generated from source systems rather than produced by runtime operations.

---

## Artifact Models

### Artifact 1: ai-architecture-summary.md

**Type:** Markdown document  
**Purpose:** Human-readable system overview  
**Consumers:** Developers, documentation systems, SpecKit agents  
**Update Frequency:** When ADRs or structure changes  
**Size:** ~5-10 KB

**Data Model:**

```markdown
# Zidney Architecture Summary

Generated: [ISO-8601 timestamp]
Schema Version: 1.0.0

## System Layers Overview

### UI Layer

- Vue 3 + TypeScript
- shadcn-vue components
- Tailwind CSS v4
- No business logic, no DB access

### Runtime Layer

- Bun runtime
- Hono framework (API)
- Redis-based worker
- Central business logic execution

### Domain Layer

- Pure business logic
- Framework-independent
- packages/domain-core

### Infrastructure Layer

- Database drivers
- Logging infrastructure
- External service integrations

## Applications Directory

### apps/api

**Role:** Central API service  
**Runtime:** Bun + Hono  
**Depends On:** postgres, redis  
**Key Responsibilities:**

- Route handling
- Tenant resolution
- License enforcement
- Business logic execution

### apps/worker

**Role:** Background job processor  
**Runtime:** Bun  
**Queue:** Redis-based  
**Key Responsibilities:**

- Attempt finalization
- Email delivery
- Long-running operations

### apps/mmc

**Role:** Multi-tenant control console  
**Runtime:** Vue 3  
**Key Responsibilities:**

- Institution administrative interface
- License management
- User provisioning

### apps/backoffice

**Role:** Provider management console  
**Runtime:** Vue 3  
**Key Responsibilities:**

- Platform administration
- Institution management
- Analytics dashboard

### apps/frontoffice

**Role:** Student exam runtime  
**Runtime:** Vue 3  
**Key Responsibilities:**

- Exam interface
- Question display
- Answer submission

## Packages Directory

### packages/domain-core

**Layer:** Domain  
**Type:** Business logic package  
**Purpose:** Core business rules, attempt logic, grading
**Constraints:** No framework dependencies, no external service calls

### packages/types

**Layer:** Domain  
**Type:** Type definitions  
**Purpose:** Shared TypeScript types across all apps

### packages/validation

**Layer:** Domain  
**Type:** Validation logic  
**Purpose:** Input validation, constraint checking

### packages/api-client

**Layer:** UI / Infrastructure  
**Type:** HTTP client  
**Purpose:** API communication from UI apps
**Constraint:** No domain-core imports

### packages/ui-system

**Layer:** UI  
**Type:** UI component library  
**Purpose:** shadcn-vue components, theme tokens, design system
**Constraint:** No domain logic, no external service calls

### packages/logger

**Layer:** Infrastructure  
**Type:** Logging service  
**Purpose:** Structured JSON logging
**Consumers:** All services

### packages/config

**Layer:** Infrastructure  
**Type:** Configuration management  
**Purpose:** Environment-aware configuration
**Consumers:** All services

### packages/redis-utils

**Layer:** Infrastructure  
**Type:** Redis utilities  
**Purpose:** Redis connection pooling, queue operations

## Architecture Principles

### 1. Database-per-Tenant Isolation

Essential to Zidney's multi-tenancy model. No cross-tenant data access.

### 2. Middleware Ordering is Authoritative

1. Correlation ID middleware
2. Tenant resolver middleware
3. License enforcement middleware
4. Schema/product version enforcement
5. Route handler

### 3. Layer Boundaries are Strict

- UI → Domain: Forbidden
- Domain → UI: Forbidden
- Apps → Apps: Forbidden
- Packages → Apps: Forbidden

### 4. White-Label is Visual Only

Theme customization allowed, not structural.

### 5. Determinism Over Magic

Explicit state management, no implicit behavior.

## Key Constraints & Rules

### Isolation Constraints

- No row-based multi-tenancy
- No shared student tables
- No shared attempt tables
- No cross-tenant joins
- Tenant resolution mandatory

### Runtime Constraints

- Server time is authoritative
- Attempt configuration snapshotted at start
- Submission is idempotent
- Worker finalizes attempts

### Import Constraints

- Forbidden: ui-system → domain-core
- Forbidden: apps/X → apps/Y
- Forbidden: packages/X → apps/Y
- Allowed: apps/X → packages/Y
- Allowed: packages/X → packages/Y (with exceptions for domain-core)

## Related ADRs

- ADR-0001: Database-per-Tenant Isolation
- ADR-0002: Snapshot Attempt Model
- ADR-0003: White-Label Visual Only
- ADR-0006: Runtime Authoritative Time
- ADR-0008: Semantic Versioning Policy

---
```

**Schema Notes:**

- Pure Markdown, no strict schema
- Structure defined above for consistency
- Human-readable for developers and documentation systems
- Rendered by markdown parsers across tools

---

### Artifact 2: ai-module-map.json

**Type:** JSON  
**Purpose:** Machine-readable module-to-layer mapping  
**Consumers:** AI-Guard, IDEs, validation tools, all building systems  
**Update Frequency:** When modules added/removed or layers change  
**Size:** ~5 KB

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Module Map",
  "type": "object",
  "required": ["schema_version", "generated_at", "modules"],
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version of artifact schema"
    },
    "generated_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO-8601 timestamp of generation"
    },
    "source_metadata": {
      "type": "object",
      "required": ["module_boundaries_hash", "audit_timestamp"],
      "properties": {
        "module_boundaries_hash": {
          "type": "string",
          "description": "SHA256 hash of module-boundaries.json source"
        },
        "module_boundaries_modified": {
          "type": "string",
          "format": "date-time"
        },
        "audit_timestamp": {
          "type": "string",
          "format": "date-time",
          "description": "Timestamp of latest infra-audit run"
        }
      }
    },
    "modules": {
      "type": "object",
      "description": "Map of module path to module entry",
      "additionalProperties": {
        "type": "object",
        "required": ["layer", "type", "description", "path"],
        "properties": {
          "layer": {
            "type": "string",
            "enum": ["ui", "runtime", "domain", "infrastructure"],
            "description": "Architectural layer assignment"
          },
          "type": {
            "type": "string",
            "enum": ["application", "package"],
            "description": "Module type"
          },
          "description": {
            "type": "string",
            "description": "Human-readable module purpose"
          },
          "path": {
            "type": "string",
            "description": "Filesystem path to module"
          },
          "dependencies": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Direct dependencies (optional)"
          }
        }
      }
    }
  }
}
```

**Example Content:**

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-03-09T12:00:00Z",
  "source_metadata": {
    "module_boundaries_hash": "sha256:abc123...",
    "module_boundaries_modified": "2026-03-08T10:00:00Z",
    "audit_timestamp": "2026-03-09T11:55:00Z"
  },
  "modules": {
    "apps/api": {
      "layer": "runtime",
      "type": "application",
      "description": "Main API service (Bun, Hono)",
      "path": "apps/api",
      "dependencies": ["packages/domain-core", "packages/validation", "packages/logger"]
    },
    "apps/worker": {
      "layer": "runtime",
      "type": "application",
      "description": "Background job processor"
    },
    "packages/domain-core": {
      "layer": "domain",
      "type": "package",
      "description": "Core business logic (attempt, grading)"
    },
    "packages/ui-system": {
      "layer": "ui",
      "type": "package",
      "description": "Shared UI components (shadcn-vue)"
    }
  }
}
```

**TypeScript Type Definition:**

See `packages/types/src/ai-context.ts#AIModuleMap`

---

### Artifact 3: ai-layer-model.json

**Type:** JSON  
**Purpose:** Authoritative layer definitions and import rules  
**Consumers:** Architecture validators, AI-Guard, governance systems  
**Update Frequency:** When layer rules change in module-boundaries.json  
**Size:** ~2-3 KB

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Layer Model",
  "type": "object",
  "required": ["schema_version", "generated_at", "layers", "rules"],
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "generated_at": {
      "type": "string",
      "format": "date-time"
    },
    "source_metadata": {
      "type": "object",
      "properties": {
        "module_boundaries_hash": {"type": "string"}
      }
    },
    "layers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "description"],
        "properties": {
          "name": {
            "type": "string",
            "enum": ["ui", "runtime", "domain", "infrastructure"]
          },
          "description": {"type": "string"}
        }
      }
    },
    "rules": {
      "type": "object",
      "description": "Import rules per layer",
      "additionalProperties": {
        "type": "object",
        "required": ["imports_allowed", "imports_forbidden"],
        "properties": {
          "imports_allowed": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Whitelist of allowed imports"
          },
          "imports_forbidden": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Blacklist of forbidden imports"
          }
        }
      }
    }
  }
}
```

**Example Content:**

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-03-09T12:00:00Z",
  "source_metadata": {
    "module_boundaries_hash": "sha256:abc123..."
  },
  "layers": [
    {
      "name": "ui",
      "description": "User interface layer (Vue 3, shadcn-vue)"
    },
    {
      "name": "runtime",
      "description": "Backend runtime layer (Bun, API, Worker)"
    },
    {
      "name": "domain",
      "description": "Business logic layer (pure, framework-independent)"
    },
    {
      "name": "infrastructure",
      "description": "Infrastructure layer (DB drivers, logging)"
    }
  ],
  "rules": {
    "ui": {
      "imports_allowed": [
        "packages/ui-system",
        "packages/api-client",
        "packages/types",
        "packages/config"
      ],
      "imports_forbidden": [
        "packages/domain-core",
        "packages/logger",
        "packages/redis-utils",
        "apps/*"
      ]
    },
    "runtime": {
      "imports_allowed": [
        "packages/domain-core",
        "packages/validation",
        "packages/logger",
        "packages/config",
        "packages/types",
        "packages/redis-utils"
      ],
      "imports_forbidden": ["packages/ui-system", "packages/api-client", "apps/*"]
    },
    "domain": {
      "imports_allowed": ["packages/types", "packages/validation"],
      "imports_forbidden": [
        "packages/ui-system",
        "packages/api-client",
        "packages/logger",
        "packages/redis-utils",
        "packages/config",
        "apps/*"
      ]
    },
    "infrastructure": {
      "imports_allowed": ["packages/types"],
      "imports_forbidden": [
        "packages/domain-core",
        "packages/ui-system",
        "packages/api-client",
        "apps/*"
      ]
    }
  }
}
```

**TypeScript Type Definition:**

See `packages/types/src/ai-context.ts#AILayerModel`

---

### Artifact 4: ai-dependency-graph.json

**Type:** JSON  
**Purpose:** Dependency relationships and impact analysis  
**Consumers:** Impact analysis tools, GitNexus, refactoring safety  
**Update Frequency:** When actual code dependencies change  
**Size:** ~8-10 KB

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Dependency Graph",
  "type": "object",
  "required": ["schema_version", "generated_at", "modules"],
  "properties": {
    "schema_version": {"type": "string"},
    "generated_at": {"type": "string", "format": "date-time"},
    "source_metadata": {
      "type": "object",
      "properties": {
        "infra_audit_timestamp": {"type": "string"}
      }
    },
    "modules": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "dependencies": {
            "type": "array",
            "items": {"type": "string"}
          },
          "layer": {"type": "string"},
          "type": {"type": "string"}
        }
      }
    },
    "reverse_dependencies": {
      "type": "object",
      "description": "Who depends on this module",
      "additionalProperties": {
        "type": "array",
        "items": {"type": "string"}
      }
    },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": {"type": "string"},
          "to": {"type": "string"},
          "reason": {"type": "string"},
          "severity": {"enum": ["error", "warning"]}
        }
      }
    }
  }
}
```

**Example Content:**

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-03-09T12:00:00Z",
  "source_metadata": {
    "infra_audit_timestamp": "2026-03-09T11:55:00Z"
  },
  "modules": {
    "apps/api": {
      "dependencies": ["packages/domain-core", "packages/validation", "packages/logger"],
      "layer": "runtime",
      "type": "app"
    },
    "packages/domain-core": {
      "dependencies": ["packages/types", "packages/validation"],
      "layer": "domain",
      "type": "package"
    }
  },
  "reverse_dependencies": {
    "packages/types": ["packages/domain-core", "packages/ui-system", "apps/api", "apps/worker"],
    "packages/validation": ["packages/domain-core", "apps/api"]
  },
  "violations": []
}
```

**TypeScript Type Definition:**

See `packages/types/src/ai-context.ts#AIDependencyGraph`

---

### Artifact 5: ai-runtime-map.json

**Type:** JSON  
**Purpose:** Runtime service to module mapping  
**Consumers:** DevOps, deployment systems, service documentation  
**Update Frequency:** When services added/removed or configuration changes  
**Size:** ~2-3 KB

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Runtime Map",
  "type": "object",
  "required": ["schema_version", "generated_at", "services"],
  "properties": {
    "schema_version": {"type": "string"},
    "generated_at": {"type": "string", "format": "date-time"},
    "services": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["module", "runtime", "framework", "depends_on"],
        "properties": {
          "module": {
            "type": "string",
            "description": "Source module for service"
          },
          "runtime": {
            "type": "string",
            "description": "Runtime environment"
          },
          "framework": {
            "type": "string",
            "description": "Framework used"
          },
          "depends_on": {
            "type": "array",
            "items": {"type": "string"},
            "description": "External dependencies (postgres, redis, etc.)"
          },
          "port": {"type": "integer"},
          "environment": {
            "type": "object",
            "additionalProperties": {"type": "string"}
          }
        }
      }
    }
  }
}
```

**Example Content:**

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-03-09T12:00:00Z",
  "services": {
    "api": {
      "module": "apps/api",
      "runtime": "Bun",
      "framework": "Hono",
      "depends_on": ["postgres", "redis"],
      "port": 3000,
      "environment": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    },
    "worker": {
      "module": "apps/worker",
      "runtime": "Bun",
      "framework": "Redis Queue",
      "depends_on": ["postgres", "redis"]
    },
    "mmc": {
      "module": "apps/mmc",
      "runtime": "Node.js",
      "framework": "Vue 3",
      "depends_on": []
    }
  }
}
```

**TypeScript Type Definition:**

See `packages/types/src/ai-context.ts#AIRuntimeMap`

---

### Artifact 6: ai-architecture-brain.json

**Type:** JSON  
**Purpose:** Comprehensive architecture intelligence document  
**Consumers:** Governance systems, AI-Guard, infra-audit  
**Update Frequency:** When anything changes (comprehensive aggregate)  
**Size:** ~12-15 KB

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Architecture Brain",
  "type": "object",
  "required": [
    "schema_version",
    "generated_at",
    "metadata",
    "module_assignments",
    "dependency_graph",
    "rules_active",
    "violations",
    "architecture_score"
  ],
  "properties": {
    "schema_version": {"type": "string"},
    "generated_at": {"type": "string", "format": "date-time"},
    "metadata": {
      "type": "object",
      "properties": {
        "total_modules": {"type": "integer"},
        "layer_distribution": {
          "type": "object",
          "additionalProperties": {"type": "integer"}
        },
        "total_dependencies": {"type": "integer"},
        "violations_found": {"type": "integer"}
      }
    },
    "module_assignments": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "layer": {"type": "string"},
          "type": {"type": "string"},
          "risk_level": {"enum": ["LOW", "MEDIUM", "HIGH"]}
        }
      }
    },
    "dependency_graph": {
      /* same as AIDependencyGraph */
    },
    "rules_active": {
      /* same as AILayerModel.rules */
    },
    "violations": {"type": "array"},
    "architecture_score": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100
    }
  }
}
```

**Example Content:**

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-03-09T12:00:00Z",
  "metadata": {
    "total_modules": 13,
    "layer_distribution": {
      "ui": 5,
      "runtime": 2,
      "domain": 2,
      "infrastructure": 4
    },
    "total_dependencies": 28,
    "violations_found": 0
  },
  "module_assignments": {
    "apps/api": {
      "layer": "runtime",
      "type": "application",
      "risk_level": "LOW"
    },
    "packages/domain-core": {
      "layer": "domain",
      "type": "package",
      "risk_level": "MEDIUM"
    }
  },
  "dependency_graph": {
    /* embedded from ai-dependency-graph.json */
  },
  "rules_active": {
    /* embedded from ai-layer-model.json */
  },
  "violations": [],
  "architecture_score": 100
}
```

**TypeScript Type Definition:**

See `packages/types/src/ai-context.ts#AIArchitectureBrain`

---

### Artifact 7: ai-context-mini.json

**Type:** JSON (minimal)  
**Purpose:** Lightweight context for fast AI bootstrap  
**Consumers:** Copilot, fast-path context loading  
**Update Frequency:** Same as ai-layer-model.json  
**Size:** < 1 KB

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Context Mini",
  "type": "object",
  "required": [
    "schema_version",
    "generated_at",
    "layers",
    "module_to_layer",
    "key_constraints",
    "forbidden_dependencies"
  ],
  "properties": {
    "schema_version": {"type": "string"},
    "generated_at": {"type": "string", "format": "date-time"},
    "layers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "description": {"type": "string"}
        }
      }
    },
    "module_to_layer": {
      "type": "object",
      "additionalProperties": {"type": "string"}
    },
    "key_constraints": {
      "type": "array",
      "items": {"type": "string"}
    },
    "forbidden_dependencies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": {"type": "string"},
          "to": {"type": "string"}
        }
      }
    }
  }
}
```

**Example Content:**

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-03-09T12:00:00Z",
  "layers": [
    {
      "name": "ui",
      "description": "User interface (Vue 3, shadcn-vue)"
    },
    {
      "name": "runtime",
      "description": "Backend execution (Bun, Hono, Worker)"
    },
    {
      "name": "domain",
      "description": "Business logic (pure, framework-independent)"
    },
    {
      "name": "infrastructure",
      "description": "Infrastructure (DB, logging, services)"
    }
  ],
  "module_to_layer": {
    "apps/api": "runtime",
    "apps/worker": "runtime",
    "packages/domain-core": "domain",
    "packages/ui-system": "ui"
  },
  "key_constraints": [
    "Database per tenant; no cross-tenant joins",
    "Apps cannot import other apps",
    "Packages cannot import apps",
    "UI cannot import domain logic",
    "Server time is authoritative"
  ],
  "forbidden_dependencies": [
    {"from": "packages/ui-system", "to": "packages/domain-core"},
    {"from": "apps/api", "to": "apps/worker"},
    {"from": "packages/api-client", "to": "packages/domain-core"}
  ]
}
```

**TypeScript Type Definition:**

See `packages/types/src/ai-context.ts#AIContextMini`

---

## Schema Versioning Strategy

### Semantic Versioning for Artifacts

All artifacts follow semantic versioning per ADR-0008:

**Format:** `MAJOR.MINOR.PATCH`

**Initial Release:** `1.0.0`

**Version Bump Rules:**

| Change                       | Bump  | Example                    |
| ---------------------------- | ----- | -------------------------- |
| Breaking schema change       | MAJOR | Remove required field      |
| New optional field           | MINOR | Add optional property      |
| Metadata/value update        | PATCH | Update timestamp precision |
| Reordering (no logic change) | PATCH | Reorder JSON fields        |

### Backward Compatibility

- MAJOR version bumps require migration guide
- MINOR version changes are backward compatible
- PATCH changes are transparent

### Consumer Validation

AI tools should check `schema_version` before loading:

```typescript
const artifact = loadArtifact('ai-architecture-brain.json')
if (artifact.schema_version !== '1.0.0') {
  console.warn(`Schema version mismatch: ${artifact.schema_version}`)
}
```

---

## Storage & Locations

**All artifacts stored in:** `docs/ai/context/`

**File Naming Convention:**

```
docs/ai/context/
├─ ai-architecture-summary.md
├─ ai-module-map.json
├─ ai-layer-model.json
├─ ai-dependency-graph.json
├─ ai-runtime-map.json
├─ ai-architecture-brain.json
├─ ai-context-mini.json
├─ schemas/
│  ├─ ai-module-map.schema.json
│  ├─ ai-layer-model.schema.json
│  ├─ ai-dependency-graph.schema.json
│  ├─ ai-runtime-map.schema.json
│  ├─ ai-architecture-brain.schema.json
│  └─ ai-context-mini.schema.json
├─ README.md
├─ USER_GUIDE.md
└─ ARTIFACT_REFERENCE.md
```

---

## Validation Rules

### Schema Validation

All JSON artifacts must:

1. Parse without error (`jq .`)
2. Validate against published JSON schema
3. Include required fields: `schema_version`, `generated_at`
4. Have valid timestamp format (ISO-8601)
5. Have semantic version format (X.Y.Z)

### Consistency Validation

- ai-module-map.json module list must match directory structure
- ai-layer-model.json rules must match source module-boundaries.json
- ai-dependency-graph.json must match infra-audit.ts output
- ai-architecture-brain.json must aggregate other artifacts correctly

### Freshness Validation

- Artifacts must be regenerated when sources change
- Warning if artifacts > 7 days old
- Error if artifacts > 30 days old in CI

---

## Related Documentation

See also:

- `plan.md` — Implementation roadmap
- `research.md` — Investigation findings
- `contracts/` — Interface specifications
- `quickstart.md` — Developer quickstart
- `spec.md` — Feature specification

---

**Data Model Status:** ✅ **FINALIZED**

**Next Steps:** Implement TypeScript types in packages/types/src/ai-context.ts
