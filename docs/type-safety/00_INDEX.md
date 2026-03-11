# Type Safety Governance - Documentation

Comprehensive guide to Zidney's 8-layer Type Safety Governance system.

## Quick Links

- [README](./README.md) — System overview and architecture
- [TypeScript Handbook](./TYPE_SAFETY_HANDBOOK.md) — Layer-by-layer guide (what, why, how)
- [Guard Script](./GUARD_SCRIPT.md) — Custom violation detection tool
- [Exception Handling](./EXCEPTION_HANDLING.md) — Exception workflow and sunset management
- [CI Enforcement](./CI_ENFORCEMENT.md) — Pre-merge type safety validation
- [Validation Patterns](./VALIDATION_PATTERNS.md) — Runtime validation at boundaries

## Runbooks & Troubleshooting

- [Fix Type Errors](./RUNBOOK_FIX_TYPE_ERRORS.md) — Troubleshooting guide for common errors
- [Validate External Data](./RUNBOOK_VALIDATE_EXTERNAL_DATA.md) — Pattern guide for API responses, DB, queues
- [Type New API Endpoint](./RUNBOOK_TYPE_NEW_API_ENDPOINT.md) — Step-by-step implementation guide
- [AI Governance Handbook](./AI_GOVERNANCE_HANDBOOK.md) — AI contribution rules and expectations
- [Testing Guide](./TESTING_GUIDE.md) — Test scenarios for all layers

## Overview

The Type Safety Governance system enforces strict typing through 8 layers:

1. **TypeScript Compiler Rules** — Strict mode configuration
2. **Biome Lint Enforcement** — Linter rules for safe type usage
3. **Type Safety Guard Script** — Custom pattern detection
4. **Runtime Validation Layer** — Validation at boundaries
5. **CI Enforcement** — Pre-merge type safety blocks
6. **Domain Layer Safety** — 100% type integrity protection
7. **Boundary-Typed Architecture** — Explicit export typing
8. **AI Governance Rules** — AI contribution guidelines

## Getting Started

### For Developers

1. Read the [README](./README.md) for system overview
2. Check [Type Safety Handbook](./TYPE_SAFETY_HANDBOOK.md) for layer details
3. When implementing new code: follow [Type New API Endpoint](./RUNBOOK_TYPE_NEW_API_ENDPOINT.md)
4. If you hit type errors: see [Fix Type Errors](./RUNBOOK_FIX_TYPE_ERRORS.md)

### For AI Agents

1. Review the [AI Governance Handbook](./AI_GOVERNANCE_HANDBOOK.md) first
2. Follow the 4 core rules for every code change
3. All code must pass the same CI gates as human-written code
4. Use `unknown` for external data, not `any`

### For QA / Code Reviewers

1. Reference [Testing Guide](./TESTING_GUIDE.md) for test scenarios
2. Validate that all layers are enforced in CI
3. Ensure exceptions are properly justified and tracked

## Key Principles

✅ **No `any` at boundaries** — All external data is `unknown`, validated before use

✅ **Explicit over implicit** — All public exports have explicit return types

✅ **Justified exceptions** — `any` usage requires explicit approval and sunset date

✅ **Same rules for all** — AI agents follow identical type safety rules as humans

✅ **CI blocks unsafe code** — Type errors prevent PR merge

## Status

- **MVP Phase (Layers 1+5)**: ✅ COMPLETE
- **Phase 1 (Guard Script)**: ✅ IMPLEMENTED
- **Phase 2-7 (Domain, Validation, Boundary, AI, Docs)**: 🚀 IN PROGRESS

---

Last Updated: 2026-03-11
