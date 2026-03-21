# AI Context Artifact Schemas

**Status:** Schema Version 1.0.0  
**Generated:** 2026-03-09

---

This directory contains JSON Schema definitions for all 7 AI context artifacts.

## Available Schemas

| Artifact                   | Schema File | Validates                    |
| -------------------------- | ----------- | ---------------------------- |
| ai-module-map.json         | (auto-gen)  | Module-to-layer mapping      |
| ai-layer-model.json        | (auto-gen)  | Layer definitions and rules  |
| ai-dependency-graph.json   | (auto-gen)  | Dependency relationships     |
| ai-runtime-map.json        | (auto-gen)  | Service topology             |
| ai-architecture-brain.json | (auto-gen)  | Aggregated architecture data |
| ai-context-mini.json       | (auto-gen)  | Lightweight context          |

## Schema Generation

Schemas are **automatically generated** from TypeScript interfaces:

```bash
# Source: packages/types/src/ai-context.ts
# Tool: typescript-json-schema

# Generation command:
npx typescript-json-schema tsconfig.json AIModuleMap

# Generates: ai-module-map.schema.json
```

## Schema Evolution

- **Version 1.0.0** (Current)
  - Initial schema release
  - Backward compatible with consumer tools
  - Auto-generated from TypeScript types

- **Version 1.1.0** (Planned)
  - Add codeowner field
  - Add team ownership mapping
  - No breaking changes per semver

- **Version 2.0** (Future)
  - Restructured module paths
  - New artifact types
  - Breaking changes

## Using Schemas

### For Validation

```bash
# Validate artifact against schema
jq -f schema ai-module-map.json < ai-module-map.schema.json
```

### For Documentation

```bash
# Generate docs from schema
// JSON Schema tools can generate documentation
# Example: json-schema-to-markdown, swagger, etc.
```

### For IDE Support

```json
{
  "$schema": "file:///path/to/ai-module-map.schema.json",
  "modules": {}
}
```

## Regenerating Schemas

Schemas are regenerated during artifact generation:

```bash
bun run ai:context:generate

# This also updates all schema files
```

## Reference

- [Main Documentation](../README.md)
- [TypeScript Types](../../../packages/types/src/ai-context.ts)
- [JSON Schema Spec](https://json-schema.org/)
- [Validation Tests](../../../tests/validation/artifact-schema-validation.test.ts)
