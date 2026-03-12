# Research: Architecture Alignment Migration

## Decision 1

- Decision: Use the canonical full-scope baseline stack of unified architecture guard JSON output, infra audit, and type-safety guard JSON output.
- Rationale: These tools already encode the repository's current governance rules, classify violations in machine-readable form, and cover the full alignment surface across boundaries, cycles, undeclared modules, and unsafe typing.
- Alternatives considered: Manual `rg`-based inventories were rejected because they miss graph-level violations and do not provide canonical remediation metadata. Running only `ai-guard.ts` was rejected because the stage also needs infra-audit drift detection and type-safety inventory.

## Decision 2

- Decision: Normalize remediation into five categories: boundary violations, circular dependencies, unsafe type and validation gaps, explicit export typing gaps, and overlapping governance scripts.
- Rationale: The stage specification and platform stage document already describe these as the dominant rule families, and they map cleanly to existing enforcement entrypoints.
- Alternatives considered: A module-by-module migration order was rejected as the primary planning axis because it hides cross-cutting fixes and makes repository-wide progress harder to track. A purely severity-based order was rejected because different rule families require different remediation patterns.

## Decision 3

- Decision: Preserve the current architecture by moving shared contracts only into existing compliant packages such as `packages/types`, `packages/validation`, or other already-approved shared packages.
- Rationale: Current ADRs, `module-boundaries.json`, and the architecture contract forbid cross-app imports, package-to-app imports, and UI-to-domain access. Compliance work must repair code to fit that model rather than weaken the model.
- Alternatives considered: Adding new package exceptions, letting UI depend directly on domain packages, or moving logic across app boundaries were rejected because they would constitute architecture redesign and violate stage scope.

## Decision 4

- Decision: Unsafe type remediation will prefer explicit domain types or `unknown` plus runtime validation at trust boundaries, with zero new long-lived `any` usage.
- Rationale: The type safety handbook, type-safety guard, and governance docs all establish `unknown` plus validation as the approved replacement for `any` and unchecked external data.
- Alternatives considered: Retaining `any` with comments as a broad migration shortcut was rejected because this stage is supposed to remove unsafe escape hatches. Relying only on compile-time typing was rejected because external and untrusted data must be validated at runtime.

## Decision 5

- Decision: Treat the unified architecture guard, infra audit, type-safety guard, AI context generation, and architecture brain validation as the canonical governance workflow; duplicate legacy scripts must be retired, wrapped, or clearly reduced to non-overlapping roles.
- Rationale: The lint governance model and stage specification both require consolidation when overlapping checks already exist in the canonical pipeline. This avoids conflicting results and lowers maintenance overhead.
- Alternatives considered: Keeping parallel legacy scanners with overlapping enforcement was rejected because it creates contradictory signals and makes zero-violation closure ambiguous.

## Decision 6

- Decision: Regenerate architecture intelligence in canonical order: `infra-audit.ts`, `generate-ai-context.ts --force`, then `validate-architecture-brain.ts`.
- Rationale: Infra audit refreshes the repository dependency and boundary view, AI context generation rebuilds the machine-readable artifacts consumed by governance and AI tooling, and brain validation protects against malformed or stale architecture intelligence.
- Alternatives considered: Regenerating AI context without running infra audit first was rejected because it risks stale graph inputs. Skipping brain validation was rejected because corrupt intelligence artifacts can produce false-positive governance failures.

## Decision 7

- Decision: Final verification will use the existing blocking governance sequence: lint, typecheck, type validation, strict architecture guard, infra audit, then targeted tests for changed modules.
- Rationale: This matches existing package scripts, CI expectations, and the lint governance model while keeping the stage focused on compliance evidence rather than custom verification logic.
- Alternatives considered: A lighter changed-files-only verification was rejected because this migration is repository-wide. Running all tests unconditionally as the first gate was rejected because structural compliance must be restored before behavioral verification has signal value.
