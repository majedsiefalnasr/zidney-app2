# Legacy Script Review

Captured: 2026-03-12T17:25:53Z
Status: no consolidation required

## Canonical Governance Ownership

| Responsibility                                   | Canonical Entry Point                          |
| ------------------------------------------------ | ---------------------------------------------- |
| Architecture guard                               | `bun run arch:guard` / `bun run arch:guard:ci` |
| Type-safety audit                                | `bun scripts/type-safety-guard.ts --json`      |
| Infra audit and architecture intelligence export | `bun scripts/infra-audit.ts`                   |
| AI context refresh                               | `bun scripts/generate-ai-context.ts --force`   |
| Brain validation                                 | `bun scripts/validate-architecture-brain.ts`   |

## Review Result

- No overlapping legacy governance wrapper requires change for the captured clean baseline.
- `package.json` and `scripts/` remain frozen for this stage instance.
- Any future toolchain consolidation requires a new non-zero baseline or explicit planning reopen.
