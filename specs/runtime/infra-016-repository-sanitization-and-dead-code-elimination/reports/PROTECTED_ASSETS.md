# Protected Assets

## Hard Allowlist

- `docs/ai/`
- `docs/architecture/`
- `.github/workflows/`
- `.husky/`
- `AGENTS.md`
- `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`
- `docs/AGENT_GOVERNANCE.md`
- `docs/PROJECT_CONTEXT_PRIMER.md`
- `specs/STAGE_LIFECYCLE_POLICY.md`
- `specs/phases/MASTER_EXECUTION_ROADMAP.md`
- `scripts/ai-guard.ts`
- `scripts/architecture-diff.ts`
- `scripts/infra-audit.ts`
- `scripts/type-safety-guard.ts`
- `scripts/generate-ai-context.ts`
- `scripts/gitnexus-context.ts`
- `scripts/validate-architecture-brain.ts`
- Root `package.json` governance script wiring for architecture, AI-context, typecheck, lint, test, and hook validation flows

## Derived Protection Rules

- Any asset referenced by governance docs, agent-routing instructions, hooks, CI workflows, or AI-context generation inherits protected status until explicitly superseded.
- Duplicate assets inside protected or governance-adjacent surfaces default to `manual_review` in this stage.
- The only approved authority-file mutation in this stage is the explicit remediation already applied to `.github/workflows/hard-mode-guard.yml`.

## Protected-Adjacent Surfaces Under Review

- `.github/agents/*`
- `.github/prompts/*`
- `.agents/agents/*`
- `.agents/prompts/*`
- `.specify/templates/*`

These surfaces are not being deleted in the current batch because their routing and execution semantics remain under review.
