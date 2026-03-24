# Requirements Checklist — Policy Engine Bootstrap Minimal

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-03-24
**Feature**: [spec.md](../spec.md)

---

## Functional Requirements

- [ ] `policy:check` script defined in root `package.json` invoking `bun run scripts/policy-engine/runner.ts`
- [ ] `types.ts` exports `PolicyContext` interface with `mode: "full" | "changed"`
- [ ] `types.ts` exports `PolicyResult` interface with `ruleId`, `success`, `severity`, and optional `message`
- [ ] `types.ts` exports `PolicyRule` interface with `id` and `run(context): Promise<PolicyResult>`
- [ ] `registry.ts` exports a `rules: PolicyRule[]` array
- [ ] `registry.ts` contains at least one dummy rule that returns `success: true`
- [ ] `runner.ts` parses `--changed` from `process.argv` and sets `context.mode` accordingly
- [ ] `runner.ts` defaults to `mode: "full"` when `--changed` is absent
- [ ] `runner.ts` executes all rules sequentially (no concurrent execution)
- [ ] `runner.ts` collects all `PolicyResult` objects before evaluating exit code
- [ ] `runner.ts` exits with code `1` when any result has `success: false` AND `severity: "error"`
- [ ] `runner.ts` exits with code `0` when all failures are `severity: "warning"` or there are no failures
- [ ] `runner.ts` prints `"Policy check passed"` to stdout on exit code `0`
- [ ] `runner.ts` prints `"Policy check failed"` to stderr on exit code `1`
- [ ] Runner handles an empty rules array without crashing (exits `0`)

---

## Non-Functional Requirements

- [ ] Total implementation ≤ 200 LOC across `types.ts`, `registry.ts`, and `runner.ts`
- [ ] No external package dependencies added to any `package.json`
- [ ] All three files reside under `scripts/policy-engine/`
- [ ] TypeScript strict mode compatible (no implicit `any`, no unjustified type assertions)
- [ ] Adding a new rule requires only one change: push a rule object into `registry.ts`

---

## Architecture Compliance

- [ ] No import boundary violations (`scripts/policy-engine/` does not import from `apps/*` or `packages/*`)
- [ ] Does not introduce new pnpm workspace packages
- [ ] Does not modify any database schema or migration files
- [ ] Does not touch tenant isolation logic or license middleware
- [ ] Does not partially implement any Out-of-Scope feature (scoring, grouping, GitNexus, CI integration, caching, dependency graphs)

---

## Testing

- [ ] Manual: `bun run policy:check` exits `0` and prints `"Policy check passed"`
- [ ] Manual: `bun run policy:check --changed` exits `0` and prints `"Policy check passed"`
- [ ] Manual: temporarily registering a rule that returns `{ success: false, severity: "error" }` causes exit `1` and prints `"Policy check failed"`
- [ ] Manual: registering a rule that returns `{ success: false, severity: "warning" }` still exits `0`
- [ ] Manual: emptying the `rules` array and running `policy:check` exits `0` without crashing

---

## Notes

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
- No `[NEEDS CLARIFICATION]` markers were identified — all requirements have clear defaults from the stage file
